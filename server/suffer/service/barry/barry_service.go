package barry

type BarryService struct {
	client *Client

	ProductType             *ProductTypeService
	ShopGroup               *ShopGroupService
	ProductCategory         *ProductCategoryService
	AssignConfig            *AssignConfigService
	JudgeConfig             *JudgeConfigService
	AssignUidRule           *AssignUidRuleService
	AssignVideoRule         *AssignVideoRuleService
	AssignRefundRule        *AssignRefundRuleService
	AssignApprovalRateRule  *AssignApprovalRateRuleService
	AssignVideoUserRule     *AssignVideoUserRuleService
	AssignWhitelistSwitch   *AssignWhitelistSwitchService
	AssignUidSwitch         *AssignUidSwitchService
	Channel                 *ChannelService
	UserPoint               *UserPointService
	User                    *UserService
	UserWhitelist           *UserWhitelistService
	UserDetail              *UserDetailService
	UserWithdraw            *UserWithdrawService
	PointWithdraw           *PointWithdrawService
	Entry                   *EntryService
	Return                  *ReturnService
	OrderSummary            *OrderSummaryService
	ManualTaskStats         *ManualTaskStatisticsService
	ManualOrderDetails      *ManualOrderDetailService
	WorkbenchDashboardStats *WorkbenchDashboardStatisticsService
	OrderAssign             *OrderAssignService
}

func NewBarryService() *BarryService {
	client := NewClient()
	orderSummaryService := NewOrderSummaryService(client)
	return &BarryService{
		client:                  client,
		ProductType:             NewProductTypeService(client),
		ShopGroup:               NewShopGroupService(client),
		ProductCategory:         NewProductCategoryService(client),
		AssignConfig:            NewAssignConfigService(client),
		JudgeConfig:             NewJudgeConfigService(client),
		AssignUidRule:           NewAssignUidRuleService(client),
		AssignVideoRule:         NewAssignVideoRuleService(client),
		AssignRefundRule:        NewAssignRefundRuleService(client),
		AssignApprovalRateRule:  NewAssignApprovalRateRuleService(client),
		AssignVideoUserRule:     NewAssignVideoUserRuleService(client),
		AssignWhitelistSwitch:   NewAssignWhitelistSwitchService(client),
		AssignUidSwitch:         NewAssignUidSwitchService(client),
		Channel:                 NewChannelService(client),
		UserPoint:               NewUserPointService(client),
		User:                    NewUserService(client),
		UserWhitelist:           NewUserWhitelistService(client),
		UserDetail:              NewUserDetailService(client),
		UserWithdraw:            NewUserWithdrawService(client),
		PointWithdraw:           NewPointWithdrawService(client),
		Entry:                   NewEntryService(client),
		Return:                  NewReturnService(client),
		OrderSummary:            orderSummaryService,
		ManualTaskStats:         NewManualTaskStatisticsService(client),
		ManualOrderDetails:      NewManualOrderDetailService(client),
		WorkbenchDashboardStats: NewWorkbenchDashboardStatisticsService(client),
		OrderAssign:             NewOrderAssignService(client),
	}
}

func (s *BarryService) Client() *Client {
	return s.client
}
