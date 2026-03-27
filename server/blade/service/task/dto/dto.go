package dto

import (
	baseDTO "common/base/dto"
	"time"
)

const (
	TaskStatusPending  = "pending"
	TaskStatusRunning  = "running"
	TaskStatusStopping = "stopping"
	TaskStatusStopped  = "stopped"
	TaskStatusSuccess  = "success"
	TaskStatusFailed   = "failed"
)

type TaskDTO struct {
	baseDTO.BaseDTO
	BusinessID    string     `json:"businessId"`
	BusinessKey   string     `json:"businessKey"`
	TaskType      string     `json:"taskType"`
	QueueName     string     `json:"queueName"`
	Status        string     `json:"status"`
	TotalNum      int        `json:"totalNum"`
	RunningNum    int        `json:"runningNum"`
	SuccessNum    int        `json:"successNum"`
	FailedNum     int        `json:"failedNum"`
	MaxParallel   int        `json:"maxParallel"`
	StopRequested bool       `json:"stopRequested"`
	ErrorMessage  string     `json:"errorMessage"`
	StartedAt     *time.Time `json:"startedAt"`
	FinishedAt    *time.Time `json:"finishedAt"`
}

type RunTaskDTO struct {
	BusinessID  string `json:"businessId" binding:"required" form:"businessId"`
	BusinessKey string `json:"businessKey" form:"businessKey"`
	TotalNum    int    `json:"totalNum" binding:"required,min=1" form:"totalNum"`
	TaskType    string `json:"taskType" binding:"required" form:"taskType"`
	MaxParallel int    `json:"maxParallel" form:"maxParallel"`
}

type StopTaskDTO struct {
	BusinessID string `json:"businessId" binding:"required" form:"businessId"`
}

type TaskQueryDTO struct {
	BusinessID string `json:"businessId" binding:"required" form:"businessId"`
}

type TaskDispatchDTO struct {
	BusinessID  string `json:"businessId"`
	BusinessKey string `json:"businessKey"`
	TotalNum    int    `json:"totalNum"`
	TaskType    string `json:"taskType"`
	MaxParallel int    `json:"maxParallel"`
}
