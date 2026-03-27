package task

import (
	taskService "blade/service/task"
	taskDTO "blade/service/task/dto"
	webAuth "blade/web-api/auth"
	commonRouter "common/middleware/routers"

	"github.com/gin-gonic/gin"
)

type TaskHandler struct {
	*commonRouter.BaseHandler
	taskService *taskService.TaskService
}

func NewTaskHandler() *TaskHandler {
	service := taskService.NewTaskService()
	_ = service.EnsureTable()

	return &TaskHandler{
		BaseHandler: &commonRouter.BaseHandler{},
		taskService: service,
	}
}

func (h *TaskHandler) RegisterHandler(engine *gin.RouterGroup) {
	webAuth.PublicPOST(engine, "/blade/tasks/run", h.runTask)
	webAuth.PublicPOST(engine, "/blade/tasks/stop", h.stopTask)
	webAuth.PublicGET(engine, "/blade/tasks/query", h.queryTask)
}

func (h *TaskHandler) runTask(context *gin.Context) {
	var req taskDTO.RunTaskDTO
	if err := context.ShouldBindJSON(&req); err != nil {
		commonRouter.ToJson(context, nil, err)
		return
	}

	result, err := h.taskService.SubmitTask(context.Request.Context(), &req)
	commonRouter.ToJson(context, result, err)
}

func (h *TaskHandler) stopTask(context *gin.Context) {
	var req taskDTO.StopTaskDTO
	if err := context.ShouldBindJSON(&req); err != nil {
		commonRouter.ToJson(context, nil, err)
		return
	}

	result, err := h.taskService.StopTask(context.Request.Context(), req.BusinessID)
	commonRouter.ToJson(context, result, err)
}

func (h *TaskHandler) queryTask(context *gin.Context) {
	var req taskDTO.TaskQueryDTO
	if err := context.ShouldBindQuery(&req); err != nil {
		commonRouter.ToJson(context, nil, err)
		return
	}

	result, err := h.taskService.GetTask(context.Request.Context(), req.BusinessID)
	commonRouter.ToJson(context, result, err)
}
