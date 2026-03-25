package model

type WebResponse[T any] struct {
	Code    string `json:"code"`
	Data    T      `json:"data,omitempty"`
	Message string `json:"message"`
}

func Success[T any](data T) WebResponse[T] {
	return WebResponse[T]{
		Code:    "0",
		Data:    data,
		Message: "操作成功",
	}
}

func Error(message string) WebResponse[any] {
	return WebResponse[any]{
		Code:    "1",
		Message: message,
	}
}
