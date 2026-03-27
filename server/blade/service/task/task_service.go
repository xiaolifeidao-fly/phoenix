package task

import (
	taskDTO "blade/service/task/dto"
	taskRepository "blade/service/task/repository"
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	baseDTO "common/base/dto"
	"common/middleware/db"
	"common/middleware/queue"
	redisclient "common/middleware/redis"
	"common/middleware/vipper"

	"github.com/go-redis/redis"
	"gorm.io/gorm"
)

const (
	defaultQueueName         = "blade_task_dispatch"
	defaultTaskType          = "default"
	defaultWorkerParallelism = 4
	defaultMaxRetry          = 3
	taskCacheTTL             = 24 * time.Hour
)

type TaskService struct {
	taskRepository *taskRepository.TaskRepository
}

func NewTaskService() *TaskService {
	return &TaskService{
		taskRepository: db.GetRepository[taskRepository.TaskRepository](),
	}
}

func (s *TaskService) EnsureTable() error {
	return s.taskRepository.EnsureTable()
}

func (s *TaskService) SubmitTask(ctx context.Context, req *taskDTO.RunTaskDTO) (*taskDTO.TaskDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	if strings.TrimSpace(req.BusinessID) == "" {
		return nil, fmt.Errorf("businessId is required")
	}
	if req.TotalNum <= 0 {
		return nil, fmt.Errorf("totalNum must be greater than 0")
	}

	record, err := s.prepareTaskRecord(req)
	if err != nil {
		return nil, err
	}

	if err = s.saveTaskRecord(record); err != nil {
		return nil, err
	}

	dispatch := &taskDTO.TaskDispatchDTO{
		BusinessID:  record.BusinessID,
		BusinessKey: record.BusinessKey,
		TotalNum:    record.TotalNum,
		TaskType:    record.TaskType,
		MaxParallel: record.MaxParallel,
	}

	if err = s.publishTask(ctx, record.QueueName, dispatch); err != nil {
		record.Status = taskDTO.TaskStatusFailed
		record.ErrorMessage = err.Error()
		_, _ = s.persistTaskRecord(record)
		return nil, err
	}

	return s.toDTO(record), nil
}

func (s *TaskService) StopTask(ctx context.Context, businessID string) (*taskDTO.TaskDTO, error) {
	_ = ctx
	record, err := s.loadTaskRecord(businessID)
	if err != nil {
		return nil, err
	}

	if record.Status == taskDTO.TaskStatusSuccess || record.Status == taskDTO.TaskStatusFailed || record.Status == taskDTO.TaskStatusStopped {
		return s.toDTO(record), nil
	}

	record.StopRequested = 1
	if record.Status == taskDTO.TaskStatusPending {
		now := time.Now()
		record.Status = taskDTO.TaskStatusStopped
		record.FinishedAt = &now
	} else {
		record.Status = taskDTO.TaskStatusStopping
	}
	record.ErrorMessage = ""

	saved, err := s.persistTaskRecord(record)
	if err != nil {
		return nil, err
	}
	return s.toDTO(saved), nil
}

func (s *TaskService) GetTask(ctx context.Context, businessID string) (*taskDTO.TaskDTO, error) {
	_ = ctx
	if strings.TrimSpace(businessID) == "" {
		return nil, fmt.Errorf("businessId is required")
	}

	if cached, err := s.getCachedTask(businessID); err == nil && cached != nil {
		return cached, nil
	}

	record, err := s.loadTaskRecord(businessID)
	if err != nil {
		return nil, err
	}
	return s.toDTO(record), nil
}

func (s *TaskService) MarkTaskRunning(ctx context.Context, businessID string) (*taskDTO.TaskDTO, error) {
	_ = ctx
	record, err := s.loadTaskRecord(businessID)
	if err != nil {
		return nil, err
	}
	if record.StopRequested == 1 {
		now := time.Now()
		record.Status = taskDTO.TaskStatusStopped
		record.RunningNum = 0
		record.FinishedAt = &now
		saved, saveErr := s.persistTaskRecord(record)
		if saveErr != nil {
			return nil, saveErr
		}
		return s.toDTO(saved), nil
	}

	now := time.Now()
	record.Status = taskDTO.TaskStatusRunning
	record.StartedAt = &now
	record.FinishedAt = nil
	record.ErrorMessage = ""
	saved, err := s.persistTaskRecord(record)
	if err != nil {
		return nil, err
	}
	return s.toDTO(saved), nil
}

func (s *TaskService) UpdateTaskProgress(ctx context.Context, businessID string, runningNum int, successNum int, failedNum int) (*taskDTO.TaskDTO, error) {
	_ = ctx
	record, err := s.loadTaskRecord(businessID)
	if err != nil {
		return nil, err
	}

	record.RunningNum = runningNum
	record.SuccessNum = successNum
	record.FailedNum = failedNum
	saved, err := s.persistTaskRecord(record)
	if err != nil {
		return nil, err
	}
	return s.toDTO(saved), nil
}

func (s *TaskService) CompleteTask(ctx context.Context, businessID string, successNum int, failedNum int, stopped bool, runErr error) (*taskDTO.TaskDTO, error) {
	_ = ctx
	record, err := s.loadTaskRecord(businessID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	record.RunningNum = 0
	record.SuccessNum = successNum
	record.FailedNum = failedNum
	record.FinishedAt = &now

	switch {
	case stopped || record.StopRequested == 1:
		record.Status = taskDTO.TaskStatusStopped
	case runErr != nil:
		record.Status = taskDTO.TaskStatusFailed
		record.ErrorMessage = runErr.Error()
	case failedNum > 0:
		record.Status = taskDTO.TaskStatusFailed
	case successNum+failedNum >= record.TotalNum:
		record.Status = taskDTO.TaskStatusSuccess
	default:
		record.Status = taskDTO.TaskStatusRunning
	}

	saved, err := s.persistTaskRecord(record)
	if err != nil {
		return nil, err
	}
	return s.toDTO(saved), nil
}

func (s *TaskService) ShouldStop(ctx context.Context, businessID string) (bool, error) {
	_ = ctx
	record, err := s.loadTaskRecord(businessID)
	if err != nil {
		return false, err
	}
	return record.StopRequested == 1, nil
}

func (s *TaskService) DefaultQueueName() string {
	if name := strings.TrimSpace(vipper.GetString("blade.task.queue_name")); name != "" {
		return name
	}
	return defaultQueueName
}

func (s *TaskService) DefaultTaskType() string {
	if taskType := strings.TrimSpace(vipper.GetString("blade.task.default_task_type")); taskType != "" {
		return taskType
	}
	return defaultTaskType
}

func (s *TaskService) DefaultWorkerParallelism() int {
	parallelism := vipper.GetInt("blade.task.worker_parallelism")
	if parallelism <= 0 {
		return defaultWorkerParallelism
	}
	return parallelism
}

func (s *TaskService) DefaultMaxRetry() int {
	maxRetry := vipper.GetInt("blade.task.max_retry")
	if maxRetry < 0 {
		return 0
	}
	if maxRetry == 0 {
		return defaultMaxRetry
	}
	return maxRetry
}

func (s *TaskService) ResolveTaskParallelism(maxParallel int) int {
	if maxParallel <= 0 {
		maxParallel = s.DefaultWorkerParallelism()
	}
	systemParallelism := s.DefaultWorkerParallelism()
	if maxParallel > systemParallelism {
		return systemParallelism
	}
	return maxParallel
}

func (s *TaskService) TaskCacheKey(businessID string) string {
	return fmt.Sprintf("blade:task:%s", businessID)
}

func (s *TaskService) prepareTaskRecord(req *taskDTO.RunTaskDTO) (*taskRepository.TaskRecord, error) {
	queueName := s.DefaultQueueName()
	taskType := strings.TrimSpace(req.TaskType)
	if taskType == "" {
		taskType = defaultTaskType
	}

	maxParallel := s.ResolveTaskParallelism(req.MaxParallel)
	record, err := s.loadTaskRecord(req.BusinessID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if record == nil {
		record = &taskRepository.TaskRecord{
			BusinessID: req.BusinessID,
		}
	}

	record.BusinessKey = strings.TrimSpace(req.BusinessKey)
	record.TaskType = taskType
	record.QueueName = queueName
	record.TotalNum = req.TotalNum
	record.RunningNum = 0
	record.SuccessNum = 0
	record.FailedNum = 0
	record.MaxParallel = maxParallel
	record.StopRequested = 0
	record.Status = taskDTO.TaskStatusPending
	record.ErrorMessage = ""
	record.StartedAt = nil
	record.FinishedAt = nil
	return record, nil
}

func (s *TaskService) saveTaskRecord(record *taskRepository.TaskRecord) error {
	_, err := s.persistTaskRecord(record)
	return err
}

func (s *TaskService) persistTaskRecord(record *taskRepository.TaskRecord) (*taskRepository.TaskRecord, error) {
	if record == nil {
		return nil, fmt.Errorf("task record is nil")
	}

	if s.taskRepository.Db != nil {
		var (
			saved *taskRepository.TaskRecord
			err   error
		)
		if record.Id > 0 {
			record.UpdatedTime = time.Now()
			saved, err = s.taskRepository.SaveOrUpdate(record)
		} else {
			saved, err = s.taskRepository.Create(record)
		}
		if err != nil {
			return nil, err
		}
		record = saved
	}

	if err := s.setCachedTask(record); err != nil {
		return nil, err
	}
	return record, nil
}

func (s *TaskService) loadTaskRecord(businessID string) (*taskRepository.TaskRecord, error) {
	if strings.TrimSpace(businessID) == "" {
		return nil, fmt.Errorf("businessId is required")
	}

	if s.taskRepository.Db != nil {
		record, err := s.taskRepository.FindByBusinessID(businessID)
		if err == nil {
			_ = s.setCachedTask(record)
			return record, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	cached, err := s.getCachedTaskRecord(businessID)
	if err != nil {
		return nil, err
	}
	if cached == nil {
		return nil, gorm.ErrRecordNotFound
	}
	return cached, nil
}

func (s *TaskService) publishTask(ctx context.Context, queueName string, payload *taskDTO.TaskDispatchDTO) error {
	taskQueue, err := queue.NewRedisQueueFromDefaultClient(queue.WithKeyPrefix("blade:queue"))
	if err != nil {
		return err
	}

	messageID := s.buildMessageID(payload.BusinessID, payload.TaskType)
	msg, err := queue.NewMessage(payload,
		queue.WithTopic(payload.TaskType),
		queue.WithMessageID(messageID),
		queue.WithMetadata(map[string]string{
			"businessId": payload.BusinessID,
			"taskType":   payload.TaskType,
		}),
		queue.WithMaxRetry(s.DefaultMaxRetry()),
	)
	if err != nil {
		return err
	}
	return taskQueue.Publish(ctx, queueName, msg)
}

func (s *TaskService) getCachedTask(businessID string) (*taskDTO.TaskDTO, error) {
	record, err := s.getCachedTaskRecord(businessID)
	if err != nil || record == nil {
		return nil, err
	}
	return s.toDTO(record), nil
}

func (s *TaskService) getCachedTaskRecord(businessID string) (*taskRepository.TaskRecord, error) {
	if redisclient.Rdb == nil {
		return nil, nil
	}

	raw, err := redisclient.Rdb.Get(s.TaskCacheKey(businessID)).Result()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, nil
		}
		return nil, err
	}

	var record taskRepository.TaskRecord
	if err = json.Unmarshal([]byte(raw), &record); err != nil {
		return nil, err
	}
	return &record, nil
}

func (s *TaskService) setCachedTask(record *taskRepository.TaskRecord) error {
	if record == nil || redisclient.Rdb == nil {
		return nil
	}

	body, err := json.Marshal(record)
	if err != nil {
		return err
	}
	return redisclient.Rdb.Set(s.TaskCacheKey(record.BusinessID), string(body), taskCacheTTL).Err()
}

func (s *TaskService) buildMessageID(businessID string, taskType string) string {
	sum := md5.Sum([]byte(fmt.Sprintf("%s:%s:%d", businessID, taskType, time.Now().UnixNano())))
	return hex.EncodeToString(sum[:])
}

func (s *TaskService) toDTO(record *taskRepository.TaskRecord) *taskDTO.TaskDTO {
	if record == nil {
		return nil
	}

	return &taskDTO.TaskDTO{
		BaseDTO:       buildBaseDTO(record),
		BusinessID:    record.BusinessID,
		BusinessKey:   record.BusinessKey,
		TaskType:      record.TaskType,
		QueueName:     record.QueueName,
		Status:        record.Status,
		TotalNum:      record.TotalNum,
		RunningNum:    record.RunningNum,
		SuccessNum:    record.SuccessNum,
		FailedNum:     record.FailedNum,
		MaxParallel:   record.MaxParallel,
		StopRequested: record.StopRequested == 1,
		ErrorMessage:  record.ErrorMessage,
		StartedAt:     record.StartedAt,
		FinishedAt:    record.FinishedAt,
	}
}

func buildBaseDTO(record *taskRepository.TaskRecord) baseDTO.BaseDTO {
	dto := baseDTO.BaseDTO{}
	dto.Id = record.Id
	dto.Active = record.Active
	dto.CreatedTime = record.CreatedTime
	dto.CreatedBy = record.CreatedBy
	dto.UpdatedTime = record.UpdatedTime
	dto.UpdatedBy = record.UpdatedBy
	return dto
}
