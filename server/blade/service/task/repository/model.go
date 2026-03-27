package repository

import (
	"common/middleware/db"
	"time"
)

type TaskRecord struct {
	db.BaseEntity
	BusinessID    string     `gorm:"column:business_id;type:varchar(64);not null;uniqueIndex:uk_business_id" orm:"column(business_id);size(64)" description:"业务任务ID"`
	BusinessKey   string     `gorm:"column:business_key;type:varchar(128);not null;default:'';index:idx_business_key" orm:"column(business_key);size(128)" description:"业务键"`
	TaskType      string     `gorm:"column:task_type;type:varchar(64);not null;default:'';index:idx_task_type" orm:"column(task_type);size(64)" description:"任务类型"`
	QueueName     string     `gorm:"column:queue_name;type:varchar(64);not null;default:''" orm:"column(queue_name);size(64)" description:"队列名"`
	Status        string     `gorm:"column:status;type:varchar(32);not null;default:'pending';index:idx_status" orm:"column(status);size(32)" description:"任务状态"`
	TotalNum      int        `gorm:"column:total_num;not null;default:0" orm:"column(total_num)" description:"总任务数"`
	RunningNum    int        `gorm:"column:running_num;not null;default:0" orm:"column(running_num)" description:"运行中数量"`
	SuccessNum    int        `gorm:"column:success_num;not null;default:0" orm:"column(success_num)" description:"成功数量"`
	FailedNum     int        `gorm:"column:failed_num;not null;default:0" orm:"column(failed_num)" description:"失败数量"`
	MaxParallel   int        `gorm:"column:max_parallel;not null;default:1" orm:"column(max_parallel)" description:"最大并发度"`
	StopRequested int8       `gorm:"column:stop_requested;not null;default:0" orm:"column(stop_requested)" description:"是否请求停止"`
	ErrorMessage  string     `gorm:"column:error_message;type:varchar(255);not null;default:''" orm:"column(error_message);size(255)" description:"错误信息"`
	StartedAt     *time.Time `gorm:"column:started_at;type:timestamp;default:null" orm:"column(started_at);null" description:"开始时间"`
	FinishedAt    *time.Time `gorm:"column:finished_at;type:timestamp;default:null" orm:"column(finished_at);null" description:"结束时间"`
}

func (t *TaskRecord) TableName() string {
	return "blade_task_record"
}
