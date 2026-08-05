package order

import (
	baseDTO "common/base/dto"
	"common/middleware/db"
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"
	barryService "suffer/service/barry"
	kakrolotService "suffer/service/kakrolot"
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
	barryService                *barryService.BarryService
	kakrolotOrderService        *kakrolotService.OrderService
}

func NewOrderService() *OrderService {
	return &OrderService{
		orderAmountDetailRepository: db.GetRepository[orderRepository.OrderAmountDetailRepository](),
		orderBkRecordRepository:     db.GetRepository[orderRepository.OrderBkRecordRepository](),
		orderRecordRepository:       db.GetRepository[orderRepository.OrderRecordRepository](),
		orderRefundRecordRepository: db.GetRepository[orderRepository.OrderRefundRecordRepository](),
		barryService:                barryService.NewBarryService(),
		kakrolotOrderService:        kakrolotService.NewOrderService(kakrolotService.NewClient()),
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

// parseCategoryIDs 解析逗号分隔的类目 ID，忽略非法项；返回空表示不按类目过滤
func parseCategoryIDs(value string) []uint64 {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	ids := make([]uint64, 0, len(parts))
	seen := make(map[uint64]struct{}, len(parts))
	for _, part := range parts {
		id, err := strconv.ParseUint(strings.TrimSpace(part), 10, 64)
		if err != nil || id == 0 {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids
}

// parseOrderStatuses 解析逗号分隔的订单状态，去空去重
func parseOrderStatuses(value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	statuses := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		status := strings.TrimSpace(part)
		if status == "" {
			continue
		}
		if _, exists := seen[status]; exists {
			continue
		}
		seen[status] = struct{}{}
		statuses = append(statuses, status)
	}
	return statuses
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
	if query.AbnormalOnly {
		dbQuery = dbQuery.Where("exception_flag = ?", 1)
	}
	if query.OrderID > 0 {
		dbQuery = dbQuery.Where("id = ?", query.OrderID)
	}
	if query.TenantID > 0 {
		dbQuery = dbQuery.Where("tenant_id = ?", query.TenantID)
	}
	if query.ShopID > 0 {
		dbQuery = dbQuery.Where("shop_id = ?", query.ShopID)
	}
	if categoryIDs := parseCategoryIDs(query.ShopCategoryIDs); len(categoryIDs) > 0 {
		dbQuery = dbQuery.Where("shop_category_id IN ?", categoryIDs)
	} else if query.ShopCategoryID > 0 {
		dbQuery = dbQuery.Where("shop_category_id = ?", query.ShopCategoryID)
	}
	if query.UserID > 0 {
		dbQuery = dbQuery.Where("user_id = ?", query.UserID)
	}
	if statuses := parseOrderStatuses(query.OrderStatuses); len(statuses) > 0 {
		dbQuery = dbQuery.Where("order_status IN ?", statuses)
	} else if value := strings.TrimSpace(query.OrderStatus); value != "" {
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
	if query.SubmitRateMin != nil {
		dbQuery = dbQuery.Where(submitRateExpr+" >= ?", *query.SubmitRateMin)
	}
	if query.SubmitRateMax != nil {
		dbQuery = dbQuery.Where(submitRateExpr+" <= ?", *query.SubmitRateMax)
	}
	if query.GrowthRateMin != nil {
		dbQuery = dbQuery.Where(growthRateExpr+" >= ?", *query.GrowthRateMin)
	}
	if query.GrowthRateMax != nil {
		dbQuery = dbQuery.Where(growthRateExpr+" <= ?", *query.GrowthRateMax)
	}
	if query.AssignFinishTimesMin != nil {
		dbQuery = dbQuery.Where("assign_finish_times >= ?", *query.AssignFinishTimesMin)
	}
	if query.AssignFinishTimesMax != nil {
		dbQuery = dbQuery.Where("assign_finish_times <= ?", *query.AssignFinishTimesMax)
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

// 提交率 / 上量率的 SQL 表达式，分母为 0 时与前端展示保持一致按 0% 处理。
// end_num、init_num 为无符号列，先转成有符号再相减，避免 MySQL 下溢。
const (
	submitRateExpr = "(CASE WHEN order_assign_num > 0 THEN order_submit_num * 100.0 / order_assign_num ELSE 0 END)"
	growthRateExpr = "(CASE WHEN order_assign_num > 0 THEN GREATEST(CAST(end_num AS SIGNED) - CAST(init_num AS SIGNED), 0) * 100.0 / order_assign_num ELSE 0 END)"
)

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

// RefundOrderRecord 管理端退单：转调 kakrolot 的退单接口，由 kakrolot 落退单记录并通知 barry。
// 仅 PENDING / INIT 状态允许退单，重复退单由 kakrolot 判重。
func (s *OrderService) RefundOrderRecord(ctx context.Context, id uint, operator string, token string) error {
	if s.orderRecordRepository.Db == nil {
		return fmt.Errorf("database is not initialized")
	}
	entity, err := s.orderRecordRepository.FindById(id)
	if err != nil {
		return err
	}
	if entity.Active == 0 {
		return gorm.ErrRecordNotFound
	}
	status := strings.TrimSpace(entity.OrderStatus)
	if status != OrderStatusPending && status != OrderStatusInit {
		return fmt.Errorf("订单不允许退单")
	}
	if err := s.kakrolotOrderService.Refund(ctx, uint64(entity.Id), token); err != nil {
		return err
	}
	if op := strings.TrimSpace(operator); op != "" {
		s.orderRecordRepository.Db.Model(&orderRepository.OrderRecord{}).
			Where("id = ?", uint64(entity.Id)).Update("updated_by", op)
	}
	return nil
}

// RefundOrderRecordBatch 批量退单，逐单转调 kakrolot，返回每单的失败原因。
func (s *OrderService) RefundOrderRecordBatch(ctx context.Context, ids []uint, operator string, token string) *orderDTO.OrderActionBatchResultDTO {
	result := &orderDTO.OrderActionBatchResultDTO{Failures: []orderDTO.OrderActionFailureDTO{}}
	for _, id := range ids {
		if err := s.RefundOrderRecord(ctx, id, operator, token); err != nil {
			message := err.Error()
			if err == gorm.ErrRecordNotFound {
				message = "订单不存在"
			}
			result.Failed++
			result.Failures = append(result.Failures, orderDTO.OrderActionFailureDTO{
				OrderID: uint64(id),
				Message: message,
			})
			continue
		}
		result.Succeeded++
	}
	return result
}

// BkOrderRecord 管理端补款：转调 kakrolot 的补款接口，由 kakrolot 落补款记录与金额明细。
// 仅 REFUND / DONE 状态允许补款，重复补款与金额计算由 kakrolot 负责。
func (s *OrderService) BkOrderRecord(ctx context.Context, id uint, num uint64, operator string, token string) error {
	if s.orderRecordRepository.Db == nil {
		return fmt.Errorf("database is not initialized")
	}
	if num == 0 {
		return fmt.Errorf("补款数量无效")
	}
	entity, err := s.orderRecordRepository.FindById(id)
	if err != nil {
		return err
	}
	if entity.Active == 0 {
		return gorm.ErrRecordNotFound
	}
	status := strings.TrimSpace(entity.OrderStatus)
	if status != OrderStatusRefund && status != OrderStatusDone {
		return fmt.Errorf("此订单不允许补款")
	}
	if entity.OrderNum > 0 && int64(num) > entity.OrderNum {
		return fmt.Errorf("补款数量不能大于此订单的总数量")
	}
	if err := s.kakrolotOrderService.Bk(ctx, uint64(entity.Id), num, token); err != nil {
		return err
	}
	if op := strings.TrimSpace(operator); op != "" {
		s.orderRecordRepository.Db.Model(&orderRepository.OrderRecord{}).
			Where("id = ?", uint64(entity.Id)).Update("updated_by", op)
	}
	return nil
}

// MarkOrderException 管理端异常打标：先调异常打标接口，再调 barry 停止分发。
// 打标接口不鉴权，barry 走自己的网关凭证，因此这里不需要登录 token。
// 仅 PENDING(进行中) 且未被标记异常的订单允许打标。
// 若打标成功但停止分发失败，异常原因会补上未停止分发的说明，并返回错误提示人工重试。
func (s *OrderService) MarkOrderException(ctx context.Context, id uint, reason string, operator string) error {
	if s.orderRecordRepository.Db == nil {
		return fmt.Errorf("database is not initialized")
	}
	entity, err := s.orderRecordRepository.FindById(id)
	if err != nil {
		return err
	}
	if entity.Active == 0 {
		return gorm.ErrRecordNotFound
	}
	if strings.TrimSpace(entity.OrderStatus) != OrderStatusPending {
		return fmt.Errorf("仅进行中的订单允许标记异常")
	}
	if entity.IsAbnormal {
		return fmt.Errorf("订单已标记异常")
	}

	orderID := uint64(entity.Id)
	if err := s.kakrolotOrderService.MarkException(ctx, orderID, reason); err != nil {
		return fmt.Errorf("标记异常失败: %w", err)
	}

	if _, err := s.barryService.OrderAssign.StopAssign(ctx, orderID); err != nil {
		s.appendExceptionReason(orderID, stopAssignFailedReason(err), operator)
		return fmt.Errorf("已标记异常，但停止分发失败: %w", err)
	}
	if op := strings.TrimSpace(operator); op != "" {
		s.orderRecordRepository.Db.Model(&orderRepository.OrderRecord{}).
			Where("id = ?", orderID).Update("updated_by", op)
	}
	return nil
}

// MarkOrderExceptionBatch 批量异常打标，逐单执行，返回每单的失败原因。
func (s *OrderService) MarkOrderExceptionBatch(ctx context.Context, ids []uint, reason string, operator string) *orderDTO.OrderActionBatchResultDTO {
	result := &orderDTO.OrderActionBatchResultDTO{Failures: []orderDTO.OrderActionFailureDTO{}}
	for _, id := range ids {
		if err := s.MarkOrderException(ctx, id, reason, operator); err != nil {
			message := err.Error()
			if err == gorm.ErrRecordNotFound {
				message = "订单不存在"
			}
			result.Failed++
			result.Failures = append(result.Failures, orderDTO.OrderActionFailureDTO{
				OrderID: uint64(id),
				Message: message,
			})
			continue
		}
		result.Succeeded++
	}
	return result
}

// ForceFinishOrders 管理端强制完成：交给 barry 停止分发、将 assignment/shop 置为完成并通知 kak。
// 一次请求把所有订单打包给 barry，barry 逐单处理并返回逐单结果。
func (s *OrderService) ForceFinishOrders(ctx context.Context, ids []uint, operator string) (*orderDTO.OrderActionBatchResultDTO, error) {
	if s.orderRecordRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	if len(ids) == 0 {
		return nil, fmt.Errorf("请选择需要强制完成的订单")
	}
	result := &orderDTO.OrderActionBatchResultDTO{Failures: []orderDTO.OrderActionFailureDTO{}}
	orderIDs := make([]uint64, 0, len(ids))
	orders := make([]barryService.ForceFinishOrderDTO, 0, len(ids))
	for _, id := range ids {
		entity, err := s.orderRecordRepository.FindById(id)
		if err != nil || entity.Active == 0 {
			result.Failed++
			result.Failures = append(result.Failures, orderDTO.OrderActionFailureDTO{
				OrderID: uint64(id),
				Message: "订单不存在",
			})
			continue
		}
		status := strings.TrimSpace(entity.OrderStatus)
		if status != OrderStatusPending && status != OrderStatusInit {
			result.Failed++
			result.Failures = append(result.Failures, orderDTO.OrderActionFailureDTO{
				OrderID: uint64(id),
				Message: "当前状态不允许强制完成",
			})
			continue
		}
		orderIDs = append(orderIDs, uint64(entity.Id))
		// 带上总量与业务 ID，barry 查不到进件记录时靠这两个字段兜底通知 kak
		orders = append(orders, barryService.ForceFinishOrderDTO{
			OriShopID:  strconv.FormatUint(uint64(entity.Id), 10),
			TotalNum:   entity.OrderNum,
			BusinessID: strings.TrimSpace(entity.BusinessID),
		})
	}
	if len(orders) == 0 {
		return result, nil
	}

	// 逐单串行调用 barry，单笔失败不影响其他单
	for index, order := range orders {
		orderID := orderIDs[index]
		responses, err := s.barryService.OrderAssign.ForceFinish(ctx, []barryService.ForceFinishOrderDTO{order})
		if err != nil {
			result.Failed++
			result.Failures = append(result.Failures, orderDTO.OrderActionFailureDTO{
				OrderID: orderID,
				Message: err.Error(),
			})
			continue
		}
		// barry 未返回结果时按失败处理，避免误报成功
		var item *barryService.ForceFinishResultDTO
		for _, response := range responses {
			if response != nil && response.OriShopID == order.OriShopID {
				item = response
				break
			}
		}
		if item == nil {
			result.Failed++
			result.Failures = append(result.Failures, orderDTO.OrderActionFailureDTO{
				OrderID: orderID,
				Message: "barry 未返回处理结果",
			})
			continue
		}
		if !item.Success {
			message := strings.TrimSpace(item.Message)
			if message == "" {
				message = "强制完成失败"
			}
			result.Failed++
			result.Failures = append(result.Failures, orderDTO.OrderActionFailureDTO{
				OrderID: orderID,
				Message: message,
			})
			continue
		}
		result.Succeeded++
		if op := strings.TrimSpace(operator); op != "" {
			s.orderRecordRepository.Db.Model(&orderRepository.OrderRecord{}).
				Where("id = ?", orderID).Update("updated_by", op)
		}
	}
	return result, nil
}

// appendExceptionReason 在既有异常原因后补充说明，用于停止分发失败的场景。
func (s *OrderService) appendExceptionReason(orderID uint64, note string, operator string) {
	entity, err := s.orderRecordRepository.FindById(uint(orderID))
	if err != nil {
		return
	}
	reason := strings.TrimSpace(entity.ExceptionReason)
	if reason == "" {
		reason = note
	} else if !strings.Contains(reason, note) {
		reason = reason + "；" + note
	}
	if len([]rune(reason)) > 2000 {
		reason = string([]rune(reason)[:2000])
	}
	updates := map[string]any{"exception_reason": reason}
	if op := strings.TrimSpace(operator); op != "" {
		updates["updated_by"] = op
	}
	if err := s.orderRecordRepository.Db.Model(&orderRepository.OrderRecord{}).
		Where("id = ?", orderID).Updates(updates).Error; err != nil {
		log.Printf("append exception reason failed: orderId=%d err=%v", orderID, err)
	}
}

func stopAssignFailedReason(err error) string {
	message := strings.TrimSpace(err.Error())
	if message == "" {
		return "已标记异常，但未停止分发"
	}
	return "已标记异常，但未停止分发（" + message + "）"
}
