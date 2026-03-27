package consumer

import (
	taskService "blade/service/task"
	taskDTO "blade/service/task/dto"
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type TaskProcessor interface {
	Process(ctx context.Context, task *taskDTO.TaskDispatchDTO) error
}

type TaskUnit struct {
	Task     *taskDTO.TaskDispatchDTO
	WorkerID int
	Index    int
}

type TaskUnitHandler interface {
	Handle(ctx context.Context, unit *TaskUnit) error
}

type TaskHandlerRegistry struct {
	mu              sync.RWMutex
	handlers        map[string]TaskUnitHandler
	defaultTaskType string
}

func NewTaskHandlerRegistry(defaultTaskType string, defaultHandler TaskUnitHandler) *TaskHandlerRegistry {
	normalizedDefaultTaskType := strings.TrimSpace(defaultTaskType)
	if normalizedDefaultTaskType == "" {
		normalizedDefaultTaskType = "default"
	}

	registry := &TaskHandlerRegistry{
		handlers:        make(map[string]TaskUnitHandler),
		defaultTaskType: normalizedDefaultTaskType,
	}
	if defaultHandler != nil {
		registry.handlers[registry.defaultTaskType] = defaultHandler
	}
	return registry
}

func (r *TaskHandlerRegistry) Register(taskType string, handler TaskUnitHandler) error {
	if r == nil {
		return fmt.Errorf("task handler registry is nil")
	}
	if handler == nil {
		return fmt.Errorf("task handler is nil")
	}

	normalizedTaskType := r.normalizeTaskType(taskType)

	r.mu.Lock()
	defer r.mu.Unlock()
	r.handlers[normalizedTaskType] = handler
	return nil
}

func (r *TaskHandlerRegistry) Resolve(taskType string) (TaskUnitHandler, error) {
	if r == nil {
		return nil, fmt.Errorf("task handler registry is nil")
	}

	normalizedTaskType := r.normalizeTaskType(taskType)

	r.mu.RLock()
	defer r.mu.RUnlock()

	if handler, ok := r.handlers[normalizedTaskType]; ok {
		return handler, nil
	}
	if handler, ok := r.handlers[r.defaultTaskType]; ok {
		return handler, nil
	}
	return nil, fmt.Errorf("task handler is not registered, taskType=%s", normalizedTaskType)
}

type DefaultTaskProcessor struct {
	taskService *taskService.TaskService
	registry    *TaskHandlerRegistry
}

func NewDefaultTaskProcessor() *DefaultTaskProcessor {
	service := taskService.NewTaskService()
	processor := &DefaultTaskProcessor{
		taskService: service,
		registry: NewTaskHandlerRegistry(service.DefaultTaskType(), &LoggingTaskUnitHandler{
			sleep: 100 * time.Millisecond,
		}),
	}
	videoPlayHandler := NewVideoPlayTaskUnitHandler()
	for _, taskType := range []string{
		TaskTypeVideoPlay,
		"play_video",
		"videoPlay",
		"video-play",
	} {
		if err := processor.RegisterHandler(taskType, videoPlayHandler); err != nil {
			log.Printf("register task handler failed, taskType=%s err=%v", taskType, err)
		}
	}
	return processor
}

func (p *DefaultTaskProcessor) RegisterHandler(taskType string, handler TaskUnitHandler) error {
	return p.registry.Register(taskType, handler)
}

func (p *DefaultTaskProcessor) Process(ctx context.Context, task *taskDTO.TaskDispatchDTO) error {
	if task == nil {
		return fmt.Errorf("task payload is nil")
	}

	handler, err := p.registry.Resolve(task.TaskType)
	if err != nil {
		return err
	}

	runner := newTaskRunner(p.taskService, handler, task)
	return runner.Run(ctx)
}

type taskRunner struct {
	taskService *taskService.TaskService
	handler     TaskUnitHandler
	task        *taskDTO.TaskDispatchDTO
}

func newTaskRunner(taskService *taskService.TaskService, handler TaskUnitHandler, task *taskDTO.TaskDispatchDTO) *taskRunner {
	return &taskRunner{
		taskService: taskService,
		handler:     handler,
		task:        task,
	}
}

func (r *taskRunner) Run(ctx context.Context) error {
	if _, err := r.taskService.MarkTaskRunning(ctx, r.task.BusinessID); err != nil {
		return err
	}

	parallelism := r.resolveParallelism()
	jobs := make(chan int)
	errCh := make(chan error, 1)
	stats := newTaskRuntimeState()

	var wg sync.WaitGroup
	for workerID := 1; workerID <= parallelism; workerID++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			r.runWorker(ctx, id, jobs, stats, errCh)
		}(workerID)
	}

	go r.dispatchJobs(ctx, jobs, stats)

	wg.Wait()

	infraErr := readInfraError(errCh)
	_, completeErr := r.taskService.CompleteTask(
		ctx,
		r.task.BusinessID,
		stats.SuccessCount(),
		stats.FailedCount(),
		stats.IsStopped(),
		infraErr,
	)
	if completeErr != nil {
		return completeErr
	}
	if infraErr != nil {
		return infraErr
	}

	if businessErr := stats.LastBusinessError(); businessErr != nil {
		log.Printf("task processor completed with business failures, businessId=%s err=%v", r.task.BusinessID, businessErr)
	}
	return nil
}

func (r *taskRunner) resolveParallelism() int {
	parallelism := r.taskService.ResolveTaskParallelism(r.task.MaxParallel)
	if parallelism > r.task.TotalNum {
		parallelism = r.task.TotalNum
	}
	if parallelism <= 0 {
		return 1
	}
	return parallelism
}

func (r *taskRunner) runWorker(ctx context.Context, workerID int, jobs <-chan int, stats *taskRuntimeState, errCh chan<- error) {
	for index := range jobs {
		if ctx.Err() != nil {
			return
		}
		if !r.beforeExecute(ctx, stats, errCh) {
			return
		}

		stats.IncRunning()
		r.syncProgress(ctx, stats)

		if err := r.handler.Handle(ctx, &TaskUnit{
			Task:     r.task,
			WorkerID: workerID,
			Index:    index,
		}); err != nil {
			stats.DecRunning()
			stats.IncFailed(err)
			r.syncProgress(ctx, stats)
			log.Printf("task processor unit failed, businessId=%s taskType=%s worker=%d index=%d err=%v", r.task.BusinessID, r.task.TaskType, workerID, index, err)
			if stats.IsStopped() {
				return
			}
			continue
		}

		stats.DecRunning()
		stats.IncSuccess()
		r.syncProgress(ctx, stats)

		if stats.IsStopped() {
			return
		}
	}
}

func (r *taskRunner) beforeExecute(ctx context.Context, stats *taskRuntimeState, errCh chan<- error) bool {
	shouldStop, err := r.taskService.ShouldStop(ctx, r.task.BusinessID)
	if err != nil {
		select {
		case errCh <- err:
		default:
		}
		return false
	}
	if shouldStop {
		stats.MarkStopped()
		return false
	}
	return true
}

func (r *taskRunner) syncProgress(ctx context.Context, stats *taskRuntimeState) {
	_, _ = r.taskService.UpdateTaskProgress(
		ctx,
		r.task.BusinessID,
		stats.RunningCount(),
		stats.SuccessCount(),
		stats.FailedCount(),
	)
}

func (r *taskRunner) dispatchJobs(ctx context.Context, jobs chan<- int, stats *taskRuntimeState) {
	defer close(jobs)
	for i := 0; i < r.task.TotalNum; i++ {
		if ctx.Err() != nil || stats.IsStopped() {
			return
		}
		jobs <- i
	}
}

type taskRuntimeState struct {
	runningCount    int32
	successCount    int32
	failedCount     int32
	stopped         int32
	lastBusinessErr atomic.Value
}

func newTaskRuntimeState() *taskRuntimeState {
	return &taskRuntimeState{}
}

func (s *taskRuntimeState) IncRunning() {
	atomic.AddInt32(&s.runningCount, 1)
}

func (s *taskRuntimeState) DecRunning() {
	atomic.AddInt32(&s.runningCount, -1)
}

func (s *taskRuntimeState) IncSuccess() {
	atomic.AddInt32(&s.successCount, 1)
}

func (s *taskRuntimeState) IncFailed(err error) {
	atomic.AddInt32(&s.failedCount, 1)
	if err != nil {
		s.lastBusinessErr.Store(err)
	}
}

func (s *taskRuntimeState) MarkStopped() {
	atomic.StoreInt32(&s.stopped, 1)
}

func (s *taskRuntimeState) IsStopped() bool {
	return atomic.LoadInt32(&s.stopped) == 1
}

func (s *taskRuntimeState) RunningCount() int {
	return int(atomic.LoadInt32(&s.runningCount))
}

func (s *taskRuntimeState) SuccessCount() int {
	return int(atomic.LoadInt32(&s.successCount))
}

func (s *taskRuntimeState) FailedCount() int {
	return int(atomic.LoadInt32(&s.failedCount))
}

func (s *taskRuntimeState) LastBusinessError() error {
	if err, ok := s.lastBusinessErr.Load().(error); ok {
		return err
	}
	return nil
}

type LoggingTaskUnitHandler struct {
	sleep time.Duration
}

func (h *LoggingTaskUnitHandler) Handle(ctx context.Context, unit *TaskUnit) error {
	if unit == nil || unit.Task == nil {
		return fmt.Errorf("task unit is nil")
	}

	log.Printf(
		"task processor executing businessId=%s taskType=%s worker=%d item=%d/%d",
		unit.Task.BusinessID,
		unit.Task.TaskType,
		unit.WorkerID,
		unit.Index+1,
		unit.Task.TotalNum,
	)

	if h.sleep <= 0 {
		return nil
	}

	timer := time.NewTimer(h.sleep)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func readInfraError(errCh <-chan error) error {
	select {
	case err := <-errCh:
		return err
	default:
		return nil
	}
}

func (r *TaskHandlerRegistry) normalizeTaskType(taskType string) string {
	normalized := strings.TrimSpace(taskType)
	if normalized == "" {
		return r.defaultTaskType
	}
	return normalized
}
