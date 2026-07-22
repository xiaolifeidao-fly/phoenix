package order

import (
	baseDTO "common/base/dto"
	"common/middleware/db"
	"fmt"
	"math/big"
	"strings"
	orderDTO "suffer/service/order/dto"
	orderRepository "suffer/service/order/repository"

	"gorm.io/gorm"
)

// 订单状态常量（与 order-gateway / order-handler 保持一致）
const (
	OrderStatusInit          = "INIT"
	OrderStatusPending       = "PENDING"
	OrderStatusDone          = "DONE"
	OrderStatusRefund        = "REFUND"
	OrderStatusRefundPending = "REFUND_PENDING"
)

type OrderService struct {
	orderAmountDetailRepository *orderRepository.OrderAmountDetailRepository
	orderBkRecordRepository     *orderRepository.OrderBkRecordRepository
	orderRecordRepository       *orderRepository.OrderRecordRepository
	orderRefundRecordRepository *orderRepository.OrderRefundRecordRepository
}

func NewOrderService() *OrderService {
	return &OrderService{
		orderAmountDetailRepository: db.GetRepository[orderRepository.OrderAmountDetailRepository](),
		orderBkRecordRepository:     db.GetRepository[orderRepository.OrderBkRecordRepository](),
		orderRecordRepository:       db.GetRepository[orderRepository.OrderRecordRepository](),
		orderRefundRecordRepository: db.GetRepository[orderRepository.OrderRefundRecordRepository](),
	}
}

func (s *OrderService) EnsureTable() error {
	for _, ensure := range []func() error{
		s.orderAmountDetailRepository.EnsureTable,
		s.orderBkRecordRepository.EnsureTable,
		s.orderRecordRepository.EnsureTable,
		s.orderRefundRecordRepository.EnsureTable,
	} {
		if err := ensure(); err != nil {
			return err
		}
	}
	return nil
}

func normalizeOrderPage(page, pageIndex, pageSize int) (int, int) {
	if pageIndex <= 0 {
		pageIndex = page
	}
	if pageIndex <= 0 {
		pageIndex = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 200 {
		pageSize = 200
	}
	return pageIndex, pageSize
}
func defaultOrderDecimal(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "0.00000000"
	}
	return value
}

func (s *OrderService) ListOrderAmountDetails(query orderDTO.OrderAmountDetailQueryDTO) (*baseDTO.PageDTO[orderDTO.OrderAmountDetailDTO], error) {
	if s.orderAmountDetailRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	pageIndex, pageSize := normalizeOrderPage(query.Page, query.PageIndex, query.PageSize)
	dbQuery := s.orderAmountDetailRepository.Db.Model(&orderRepository.OrderAmountDetail{}).Where("active = ?", 1)
	if query.OrderID > 0 {
		dbQuery = dbQuery.Where("order_id = ?", query.OrderID)
	}
	var total int64
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, err
	}
	var entities []*orderRepository.OrderAmountDetail
	if err := dbQuery.Order("id DESC").Offset((pageIndex - 1) * pageSize).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, err
	}
	return baseDTO.BuildPage(int(total), db.ToDTOs[orderDTO.OrderAmountDetailDTO](entities)), nil
}
func (s *OrderService) GetOrderAmountDetailByID(id uint) (*orderDTO.OrderAmountDetailDTO, error) {
	entity, err := s.orderAmountDetailRepository.FindById(id)
	if err != nil {
		return nil, err
	}
	if entity.Active == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return db.ToDTO[orderDTO.OrderAmountDetailDTO](entity), nil
}
func (s *OrderService) CreateOrderAmountDetail(req *orderDTO.CreateOrderAmountDetailDTO) (*orderDTO.OrderAmountDetailDTO, error) {
	if s.orderAmountDetailRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	created, err := s.orderAmountDetailRepository.Create(&orderRepository.OrderAmountDetail{OrderID: req.OrderID, OrderConsumerAmount: defaultOrderDecimal(req.OrderConsumerAmount), Description: strings.TrimSpace(req.Description)})
	if err != nil {
		return nil, err
	}
	return db.ToDTO[orderDTO.OrderAmountDetailDTO](created), nil
}
func (s *OrderService) UpdateOrderAmountDetail(id uint, req *orderDTO.UpdateOrderAmountDetailDTO) (*orderDTO.OrderAmountDetailDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	entity, err := s.orderAmountDetailRepository.FindById(id)
	if err != nil {
		return nil, err
	}
	if entity.Active == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	if req.OrderID != nil {
		entity.OrderID = *req.OrderID
	}
	if req.OrderConsumerAmount != nil {
		entity.OrderConsumerAmount = defaultOrderDecimal(*req.OrderConsumerAmount)
	}
	if req.Description != nil {
		entity.Description = strings.TrimSpace(*req.Description)
	}
	saved, err := s.orderAmountDetailRepository.SaveOrUpdate(entity)
	if err != nil {
		return nil, err
	}
	return db.ToDTO[orderDTO.OrderAmountDetailDTO](saved), nil
}
func (s *OrderService) DeleteOrderAmountDetail(id uint) error {
	entity, err := s.orderAmountDetailRepository.FindById(id)
	if err != nil {
		return err
	}
	if entity.Active == 0 {
		return gorm.ErrRecordNotFound
	}
	entity.Active = 0
	_, err = s.orderAmountDetailRepository.SaveOrUpdate(entity)
	return err
}

func (s *OrderService) ListOrderBkRecords(query orderDTO.OrderBkRecordQueryDTO) (*baseDTO.PageDTO[orderDTO.OrderBkRecordDTO], error) {
	if s.orderBkRecordRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	pageIndex, pageSize := normalizeOrderPage(query.Page, query.PageIndex, query.PageSize)
	dbQuery := s.orderBkRecordRepository.Db.Model(&orderRepository.OrderBkRecord{}).Where("active = ?", 1)
	if query.TenantID > 0 {
		dbQuery = dbQuery.Where("tenant_id = ?", query.TenantID)
	}
	if query.OrderID > 0 {
		dbQuery = dbQuery.Where("order_id = ?", query.OrderID)
	}
	var total int64
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, err
	}
	var entities []*orderRepository.OrderBkRecord
	if err := dbQuery.Order("id DESC").Offset((pageIndex - 1) * pageSize).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, err
	}
	return baseDTO.BuildPage(int(total), db.ToDTOs[orderDTO.OrderBkRecordDTO](entities)), nil
}
func (s *OrderService) GetOrderBkRecordByID(id uint) (*orderDTO.OrderBkRecordDTO, error) {
	entity, err := s.orderBkRecordRepository.FindById(id)
	if err != nil {
		return nil, err
	}
	if entity.Active == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return db.ToDTO[orderDTO.OrderBkRecordDTO](entity), nil
}
func (s *OrderService) CreateOrderBkRecord(req *orderDTO.CreateOrderBkRecordDTO) (*orderDTO.OrderBkRecordDTO, error) {
	if s.orderBkRecordRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	created, err := s.orderBkRecordRepository.Create(&orderRepository.OrderBkRecord{TenantID: req.TenantID, OrderID: req.OrderID, Amount: defaultOrderDecimal(req.Amount), Num: req.Num, ShopCategoryID: req.ShopCategoryID, ShopID: req.ShopID})
	if err != nil {
		return nil, err
	}
	return db.ToDTO[orderDTO.OrderBkRecordDTO](created), nil
}
func (s *OrderService) UpdateOrderBkRecord(id uint, req *orderDTO.UpdateOrderBkRecordDTO) (*orderDTO.OrderBkRecordDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	entity, err := s.orderBkRecordRepository.FindById(id)
	if err != nil {
		return nil, err
	}
	if entity.Active == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	if req.TenantID != nil {
		entity.TenantID = *req.TenantID
	}
	if req.OrderID != nil {
		entity.OrderID = *req.OrderID
	}
	if req.Amount != nil {
		entity.Amount = defaultOrderDecimal(*req.Amount)
	}
	if req.Num != nil {
		entity.Num = *req.Num
	}
	if req.ShopCategoryID != nil {
		entity.ShopCategoryID = *req.ShopCategoryID
	}
	if req.ShopID != nil {
		entity.ShopID = *req.ShopID
	}
	saved, err := s.orderBkRecordRepository.SaveOrUpdate(entity)
	if err != nil {
		return nil, err
	}
	return db.ToDTO[orderDTO.OrderBkRecordDTO](saved), nil
}
func (s *OrderService) DeleteOrderBkRecord(id uint) error {
	entity, err := s.orderBkRecordRepository.FindById(id)
	if err != nil {
		return err
	}
	if entity.Active == 0 {
		return gorm.ErrRecordNotFound
	}
	entity.Active = 0
	_, err = s.orderBkRecordRepository.SaveOrUpdate(entity)
	return err
}

func (s *OrderService) ListOrderRecords(query orderDTO.OrderRecordQueryDTO) (*baseDTO.PageDTO[orderDTO.OrderRecordDTO], error) {
	if s.orderRecordRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	pageIndex, pageSize := normalizeOrderPage(query.Page, query.PageIndex, query.PageSize)
	dbQuery := s.orderRecordRepository.Db.Model(&orderRepository.OrderRecord{}).Where("active = ?", 1)
	if query.OrderID > 0 {
		dbQuery = dbQuery.Where("id = ?", query.OrderID)
	}
	if query.TenantID > 0 {
		dbQuery = dbQuery.Where("tenant_id = ?", query.TenantID)
	}
	if query.ShopID > 0 {
		dbQuery = dbQuery.Where("shop_id = ?", query.ShopID)
	}
	if query.ShopCategoryID > 0 {
		dbQuery = dbQuery.Where("shop_category_id = ?", query.ShopCategoryID)
	}
	if query.UserID > 0 {
		dbQuery = dbQuery.Where("user_id = ?", query.UserID)
	}
	if value := strings.TrimSpace(query.OrderStatus); value != "" {
		dbQuery = dbQuery.Where("order_status = ?", value)
	}
	if value := strings.TrimSpace(query.OrderHash); value != "" {
		dbQuery = dbQuery.Where("order_hash = ?", value)
	}
	if value := strings.TrimSpace(query.BusinessID); value != "" {
		dbQuery = dbQuery.Where("business_id LIKE ?", "%"+value+"%")
	}
	if value := strings.TrimSpace(query.BusinessKey); value != "" {
		dbQuery = dbQuery.Where("business_key = ?", value)
	}
	if value := strings.TrimSpace(query.ExternalOrderID); value != "" {
		dbQuery = dbQuery.Where("external_order_id = ?", value)
	}
	if value := strings.TrimSpace(query.UserName); value != "" {
		dbQuery = dbQuery.Where("user_name LIKE ?", "%"+value+"%")
	}
	if value := strings.TrimSpace(query.Channel); value != "" {
		dbQuery = dbQuery.Where("channel = ?", value)
	}
	if value := strings.TrimSpace(query.StartTime); value != "" {
		dbQuery = dbQuery.Where("created_time >= ?", value)
	}
	if value := strings.TrimSpace(query.EndTime); value != "" {
		dbQuery = dbQuery.Where("created_time <= ?", value)
	}
	var total int64
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, err
	}
	var entities []*orderRepository.OrderRecord
	if err := dbQuery.Order("id DESC").Offset((pageIndex - 1) * pageSize).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, err
	}
	return baseDTO.BuildPage(int(total), db.ToDTOs[orderDTO.OrderRecordDTO](entities)), nil
}
func (s *OrderService) GetOrderRecordByID(id uint) (*orderDTO.OrderRecordDTO, error) {
	entity, err := s.orderRecordRepository.FindById(id)
	if err != nil {
		return nil, err
	}
	if entity.Active == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return db.ToDTO[orderDTO.OrderRecordDTO](entity), nil
}

func (s *OrderService) ListOrderRecordsByStatus(status string, limit int) ([]*orderDTO.OrderRecordDTO, error) {
	if s.orderRecordRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	status = strings.TrimSpace(status)
	if status == "" {
		return nil, fmt.Errorf("status is required")
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	var entities []*orderRepository.OrderRecord
	if err := s.orderRecordRepository.Db.
		Where("active = ? AND order_status = ?", 1, status).
		Order("id ASC").
		Limit(limit).
		Find(&entities).Error; err != nil {
		return nil, err
	}
	return db.ToDTOs[orderDTO.OrderRecordDTO](entities), nil
}

func (s *OrderService) CreateOrderRecord(req *orderDTO.CreateOrderRecordDTO) (*orderDTO.OrderRecordDTO, error) {
	if s.orderRecordRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	created, err := s.orderRecordRepository.Create(&orderRepository.OrderRecord{
		TenantID: req.TenantID, ShopID: req.ShopID, ShopName: strings.TrimSpace(req.ShopName), ShopCategoryID: req.ShopCategoryID, ShopCategoryName: strings.TrimSpace(req.ShopCategoryName),
		InitNum: req.InitNum, EndNum: req.EndNum, OrderStatus: strings.TrimSpace(req.OrderStatus), OrderNum: req.OrderNum, OrderAmount: defaultOrderDecimal(req.OrderAmount),
		UserID: req.UserID, Price: defaultOrderDecimal(req.Price), Description: strings.TrimSpace(req.Description), BusinessID: strings.TrimSpace(req.BusinessID),
		TenantName: strings.TrimSpace(req.TenantName), UserName: strings.TrimSpace(req.UserName), TinyURL: strings.TrimSpace(req.TinyURL), OrderHash: strings.TrimSpace(req.OrderHash),
		Channel: strings.TrimSpace(req.Channel), ExternalOrderRecordID: req.ExternalOrderRecordID, ExternalOrderID: strings.TrimSpace(req.ExternalOrderID),
		ExternalOrderPrice: strings.TrimSpace(req.ExternalOrderPrice), ExternalOrderAmount: strings.TrimSpace(req.ExternalOrderAmount), OrderAssignNum: req.OrderAssignNum,
		OrderSubmitNum: req.OrderSubmitNum, BusinessKey: strings.TrimSpace(req.BusinessKey), AssignFinishTimes: req.AssignFinishTimes,
	})
	if err != nil {
		return nil, err
	}
	return db.ToDTO[orderDTO.OrderRecordDTO](created), nil
}
func (s *OrderService) UpdateOrderRecord(id uint, req *orderDTO.UpdateOrderRecordDTO) (*orderDTO.OrderRecordDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	entity, err := s.orderRecordRepository.FindById(id)
	if err != nil {
		return nil, err
	}
	if entity.Active == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	if req.TenantID != nil {
		entity.TenantID = *req.TenantID
	}
	if req.ShopID != nil {
		entity.ShopID = *req.ShopID
	}
	if req.ShopName != nil {
		entity.ShopName = strings.TrimSpace(*req.ShopName)
	}
	if req.ShopCategoryID != nil {
		entity.ShopCategoryID = *req.ShopCategoryID
	}
	if req.ShopCategoryName != nil {
		entity.ShopCategoryName = strings.TrimSpace(*req.ShopCategoryName)
	}
	if req.InitNum != nil {
		entity.InitNum = *req.InitNum
	}
	if req.EndNum != nil {
		entity.EndNum = *req.EndNum
	}
	if req.OrderStatus != nil {
		entity.OrderStatus = strings.TrimSpace(*req.OrderStatus)
	}
	if req.OrderNum != nil {
		entity.OrderNum = *req.OrderNum
	}
	if req.OrderAmount != nil {
		entity.OrderAmount = defaultOrderDecimal(*req.OrderAmount)
	}
	if req.UserID != nil {
		entity.UserID = *req.UserID
	}
	if req.Price != nil {
		entity.Price = defaultOrderDecimal(*req.Price)
	}
	if req.Description != nil {
		entity.Description = strings.TrimSpace(*req.Description)
	}
	if req.BusinessID != nil {
		entity.BusinessID = strings.TrimSpace(*req.BusinessID)
	}
	if req.TenantName != nil {
		entity.TenantName = strings.TrimSpace(*req.TenantName)
	}
	if req.UserName != nil {
		entity.UserName = strings.TrimSpace(*req.UserName)
	}
	if req.TinyURL != nil {
		entity.TinyURL = strings.TrimSpace(*req.TinyURL)
	}
	if req.OrderHash != nil {
		entity.OrderHash = strings.TrimSpace(*req.OrderHash)
	}
	if req.Channel != nil {
		entity.Channel = strings.TrimSpace(*req.Channel)
	}
	if req.ExternalOrderRecordID != nil {
		entity.ExternalOrderRecordID = *req.ExternalOrderRecordID
	}
	if req.ExternalOrderID != nil {
		entity.ExternalOrderID = strings.TrimSpace(*req.ExternalOrderID)
	}
	if req.ExternalOrderPrice != nil {
		entity.ExternalOrderPrice = strings.TrimSpace(*req.ExternalOrderPrice)
	}
	if req.ExternalOrderAmount != nil {
		entity.ExternalOrderAmount = strings.TrimSpace(*req.ExternalOrderAmount)
	}
	if req.OrderAssignNum != nil {
		entity.OrderAssignNum = *req.OrderAssignNum
	}
	if req.OrderSubmitNum != nil {
		entity.OrderSubmitNum = *req.OrderSubmitNum
	}
	if req.BusinessKey != nil {
		entity.BusinessKey = strings.TrimSpace(*req.BusinessKey)
	}
	if req.AssignFinishTimes != nil {
		entity.AssignFinishTimes = *req.AssignFinishTimes
	}
	saved, err := s.orderRecordRepository.SaveOrUpdate(entity)
	if err != nil {
		return nil, err
	}
	return db.ToDTO[orderDTO.OrderRecordDTO](saved), nil
}
func (s *OrderService) DeleteOrderRecord(id uint) error {
	entity, err := s.orderRecordRepository.FindById(id)
	if err != nil {
		return err
	}
	if entity.Active == 0 {
		return gorm.ErrRecordNotFound
	}
	entity.Active = 0
	_, err = s.orderRecordRepository.SaveOrUpdate(entity)
	return err
}

func (s *OrderService) ListOrderRefundRecords(query orderDTO.OrderRefundRecordQueryDTO) (*baseDTO.PageDTO[orderDTO.OrderRefundRecordDTO], error) {
	if s.orderRefundRecordRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	pageIndex, pageSize := normalizeOrderPage(query.Page, query.PageIndex, query.PageSize)
	dbQuery := s.orderRefundRecordRepository.Db.Model(&orderRepository.OrderRefundRecord{}).Where("active = ?", 1)
	if query.TenantID > 0 {
		dbQuery = dbQuery.Where("tenant_id = ?", query.TenantID)
	}
	if query.OrderID > 0 {
		dbQuery = dbQuery.Where("order_id = ?", query.OrderID)
	}
	if value := strings.TrimSpace(query.OrderRefundStatus); value != "" {
		dbQuery = dbQuery.Where("order_refund_status = ?", value)
	}
	var total int64
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, err
	}
	var entities []*orderRepository.OrderRefundRecord
	if err := dbQuery.Order("id DESC").Offset((pageIndex - 1) * pageSize).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, err
	}
	return baseDTO.BuildPage(int(total), db.ToDTOs[orderDTO.OrderRefundRecordDTO](entities)), nil
}
func (s *OrderService) GetOrderRefundRecordByID(id uint) (*orderDTO.OrderRefundRecordDTO, error) {
	entity, err := s.orderRefundRecordRepository.FindById(id)
	if err != nil {
		return nil, err
	}
	if entity.Active == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return db.ToDTO[orderDTO.OrderRefundRecordDTO](entity), nil
}

func (s *OrderService) ListOrderRefundRecordsByStatus(status string, limit int) ([]*orderDTO.OrderRefundRecordDTO, error) {
	if s.orderRefundRecordRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	status = strings.TrimSpace(status)
	if status == "" {
		return nil, fmt.Errorf("status is required")
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	var entities []*orderRepository.OrderRefundRecord
	if err := s.orderRefundRecordRepository.Db.
		Where("active = ? AND order_refund_status = ?", 1, status).
		Order("id ASC").
		Limit(limit).
		Find(&entities).Error; err != nil {
		return nil, err
	}
	return db.ToDTOs[orderDTO.OrderRefundRecordDTO](entities), nil
}

func (s *OrderService) CreateOrderRefundRecord(req *orderDTO.CreateOrderRefundRecordDTO) (*orderDTO.OrderRefundRecordDTO, error) {
	if s.orderRefundRecordRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	created, err := s.orderRefundRecordRepository.Create(&orderRepository.OrderRefundRecord{
		TenantID: req.TenantID, OrderID: req.OrderID, RefundAmount: defaultOrderDecimal(req.RefundAmount), ShopCategoryID: req.ShopCategoryID,
		RefundNum: req.RefundNum, OrderRefundStatus: strings.TrimSpace(req.OrderRefundStatus),
	})
	if err != nil {
		return nil, err
	}
	return db.ToDTO[orderDTO.OrderRefundRecordDTO](created), nil
}
func (s *OrderService) UpdateOrderRefundRecord(id uint, req *orderDTO.UpdateOrderRefundRecordDTO) (*orderDTO.OrderRefundRecordDTO, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	entity, err := s.orderRefundRecordRepository.FindById(id)
	if err != nil {
		return nil, err
	}
	if entity.Active == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	if req.TenantID != nil {
		entity.TenantID = *req.TenantID
	}
	if req.OrderID != nil {
		entity.OrderID = *req.OrderID
	}
	if req.RefundAmount != nil {
		entity.RefundAmount = defaultOrderDecimal(*req.RefundAmount)
	}
	if req.ShopCategoryID != nil {
		entity.ShopCategoryID = *req.ShopCategoryID
	}
	if req.RefundNum != nil {
		entity.RefundNum = *req.RefundNum
	}
	if req.OrderRefundStatus != nil {
		entity.OrderRefundStatus = strings.TrimSpace(*req.OrderRefundStatus)
	}
	saved, err := s.orderRefundRecordRepository.SaveOrUpdate(entity)
	if err != nil {
		return nil, err
	}
	return db.ToDTO[orderDTO.OrderRefundRecordDTO](saved), nil
}
func (s *OrderService) DeleteOrderRefundRecord(id uint) error {
	entity, err := s.orderRefundRecordRepository.FindById(id)
	if err != nil {
		return err
	}
	if entity.Active == 0 {
		return gorm.ErrRecordNotFound
	}
	entity.Active = 0
	_, err = s.orderRefundRecordRepository.SaveOrUpdate(entity)
	return err
}

// RefundOrderRecord 管理端退单：校验订单状态并生成退单记录，同步将订单置为退款中。
// 仅 PENDING / INIT 状态允许退单，且不允许对同一订单重复退单。
func (s *OrderService) RefundOrderRecord(id uint, operator string) (*orderDTO.OrderRefundRecordDTO, error) {
	if s.orderRecordRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	entity, err := s.orderRecordRepository.FindById(id)
	if err != nil {
		return nil, err
	}
	if entity.Active == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	status := strings.TrimSpace(entity.OrderStatus)
	if status != OrderStatusPending && status != OrderStatusInit {
		return nil, fmt.Errorf("订单不允许退单")
	}
	var refundCount int64
	if err := s.orderRefundRecordRepository.Db.Model(&orderRepository.OrderRefundRecord{}).
		Where("active = ? AND order_id = ?", 1, uint64(entity.Id)).Count(&refundCount).Error; err != nil {
		return nil, err
	}
	if refundCount > 0 {
		return nil, fmt.Errorf("不允许重复退单")
	}
	created, err := s.orderRefundRecordRepository.Create(&orderRepository.OrderRefundRecord{
		TenantID:          entity.TenantID,
		OrderID:           uint64(entity.Id),
		RefundAmount:      defaultOrderDecimal(entity.OrderAmount),
		ShopCategoryID:    entity.ShopCategoryID,
		RefundNum:         0,
		OrderRefundStatus: OrderStatusRefundPending,
	})
	if err != nil {
		return nil, err
	}
	entity.OrderStatus = OrderStatusRefundPending
	if op := strings.TrimSpace(operator); op != "" {
		entity.UpdatedBy = op
	}
	if _, err := s.orderRecordRepository.SaveOrUpdate(entity); err != nil {
		return nil, err
	}
	return db.ToDTO[orderDTO.OrderRefundRecordDTO](created), nil
}

// BkOrderRecord 管理端补款：校验订单状态并生成补款记录与金额明细。
// 仅 REFUND / DONE 状态允许补款，补款数量需在订单总量范围内，且不允许重复补款。
func (s *OrderService) BkOrderRecord(id uint, num uint64, operator string) (*orderDTO.OrderBkRecordDTO, error) {
	if s.orderRecordRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	if num == 0 {
		return nil, fmt.Errorf("补款数量无效")
	}
	entity, err := s.orderRecordRepository.FindById(id)
	if err != nil {
		return nil, err
	}
	if entity.Active == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	status := strings.TrimSpace(entity.OrderStatus)
	if status != OrderStatusRefund && status != OrderStatusDone {
		return nil, fmt.Errorf("此订单不允许补款")
	}
	if entity.OrderNum > 0 && int64(num) > entity.OrderNum {
		return nil, fmt.Errorf("补款数量不能大于此订单的总数量")
	}
	var bkCount int64
	if err := s.orderBkRecordRepository.Db.Model(&orderRepository.OrderBkRecord{}).
		Where("active = ? AND order_id = ?", 1, uint64(entity.Id)).Count(&bkCount).Error; err != nil {
		return nil, err
	}
	if bkCount > 0 {
		return nil, fmt.Errorf("不能重复补款")
	}
	amount := multiplyOrderDecimal(entity.Price, num)
	created, err := s.orderBkRecordRepository.Create(&orderRepository.OrderBkRecord{
		TenantID:       entity.TenantID,
		OrderID:        uint64(entity.Id),
		Amount:         amount,
		Num:            num,
		ShopCategoryID: entity.ShopCategoryID,
		ShopID:         entity.ShopID,
	})
	if err != nil {
		return nil, err
	}
	if _, err := s.orderAmountDetailRepository.Create(&orderRepository.OrderAmountDetail{
		OrderID:             uint64(entity.Id),
		OrderConsumerAmount: amount,
		Description:         "补款:" + amount + "元",
	}); err != nil {
		return nil, err
	}
	return db.ToDTO[orderDTO.OrderBkRecordDTO](created), nil
}

func multiplyOrderDecimal(price string, num uint64) string {
	rat, ok := new(big.Rat).SetString(strings.TrimSpace(price))
	if !ok {
		return "0.00000000"
	}
	rat.Mul(rat, new(big.Rat).SetUint64(num))
	return rat.FloatString(8)
}
