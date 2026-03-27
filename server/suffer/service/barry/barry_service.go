package barry

type BarryService struct {
	client *Client

	ProductType     *ProductTypeService
	ProductCategory *ProductCategoryService
	Channel         *ChannelService
	UserPoint       *UserPointService
	User            *UserService
	UserDetail      *UserDetailService
	UserWithdraw    *UserWithdrawService
	PointWithdraw   *PointWithdrawService
	Entry           *EntryService
	Return          *ReturnService
	OrderSummary    *OrderSummaryService
	ManualTaskStats *ManualTaskStatisticsService
}

func NewBarryService() *BarryService {
	client := NewClient()
	orderSummaryService := NewOrderSummaryService(client)
	return &BarryService{
		client:          client,
		ProductType:     NewProductTypeService(client),
		ProductCategory: NewProductCategoryService(client),
		Channel:         NewChannelService(client),
		UserPoint:       NewUserPointService(client),
		User:            NewUserService(client),
		UserDetail:      NewUserDetailService(client),
		UserWithdraw:    NewUserWithdrawService(client),
		PointWithdraw:   NewPointWithdrawService(client),
		Entry:           NewEntryService(client),
		Return:          NewReturnService(client),
		OrderSummary:    orderSummaryService,
		ManualTaskStats: NewManualTaskStatisticsService(orderSummaryService),
	}
}

func (s *BarryService) Client() *Client {
	return s.client
}
