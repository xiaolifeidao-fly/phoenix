package main

import (
	"context"
	"log"
	"order-handler/business/order"
	"order-handler/initialization"
)

func main() {
	if err := initialization.Init(); err != nil {
		panic(err)
	}
	business, err := order.NewBusiness()
	if err != nil {
		panic(err)
	}
	if err = business.Run(context.Background()); err != nil {
		log.Fatal(err)
	}
}
