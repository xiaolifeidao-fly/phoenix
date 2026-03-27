package order

import (
	commonQueue "common/middleware/queue"
	commonRedis "common/middleware/redis"
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"suffer/order-gateway/model"
	orderHandlerModel "suffer/order-handler/model"
	"time"

	"common/middleware/db"
	"github.com/go-redis/redis"
	"github.com/spf13/viper"
	"gorm.io/gorm"

	orderService "suffer/service/order"
	orderDTO "suffer/service/order/dto"
	orderRepository "suffer/service/order/repository"
	shopDTO "suffer/service/shop/dto"
	shopRepository "suffer/service/shop/repository"
	userDTO "suffer/service/user/dto"
	userRepository "suffer/service/user/repository"
)

const (
	orderStatusInit          = "INIT"
	orderStatusPending       = "PENDING"
	orderStatusDone          = "DONE"
	orderStatusRefundPending = "REFUND_PENDING"
	orderStatusRefundHanding = "REFUND_HANDING"
	orderStatusRefund        = "REFUND"
)

var unlockLua = `if redis.call("GET", KEYS[1]) == ARGV[1] then redis.call("DEL", KEYS[1]) return 1 else return 0 end`

type Business struct {
	orderService                *orderService.OrderService
	orderRecordRepository       *orderRepository.OrderRecordRepository
	orderRefundRecordRepository *orderRepository.OrderRefundRecordRepository
	shopCategoryRepository      *shopRepository.ShopCategoryRepository
	tenantShopCategoryRepo      *shopRepository.TenantShopCategoryRepository
	tenantUserRepository        *userRepository.TenantUserRepository
	userRepository              *userRepository.UserRepository
	queue                       commonQueue.Queue
}

func NewBusiness() *Business {
	messageQueue, _ := commonQueue.NewRedisQueueFromDefaultClient()
	return &Business{
		orderService:                orderService.NewOrderService(),
		orderRecordRepository:       db.GetRepository[orderRepository.OrderRecordRepository](),
		orderRefundRecordRepository: db.GetRepository[orderRepository.OrderRefundRecordRepository](),
		shopCategoryRepository:      db.GetRepository[shopRepository.ShopCategoryRepository](),
		tenantShopCategoryRepo:      db.GetRepository[shopRepository.TenantShopCategoryRepository](),
		tenantUserRepository:        db.GetRepository[userRepository.TenantUserRepository](),
		userRepository:              db.GetRepository[userRepository.UserRepository](),
		queue:                       messageQueue,
	}
}

func (b *Business) EnsureTable() error {
	return b.orderService.EnsureTable()
}

func (b *Business) Submit(req *model.OrderRequestModel, remoteIP string) (*model.OrderResponseModel, error) {
	if req == nil {
		return nil, fmt.Errorf("参数不合规")
	}
	if strings.TrimSpace(req.BusinessKey) == "" {
		return nil, fmt.Errorf("参数不合规")
	}

	user, shopCategory, tenantID, err := b.validateSubmitUserAndShop(req)
	if err != nil {
		return nil, err
	}

	unlock, err := b.tryLock("order-gateway:submit:"+fmt.Sprintf("%d:%s", user.Id, strings.TrimSpace(req.BusinessKey)), 10*time.Second)
	if err != nil {
		return nil, err
	}
	defer unlock()

	existing, err := b.findOrderByBusinessKey(uint64(user.Id), req.BusinessKey)
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}
	if existing != nil {
		return b.toOrderResponse(existing), nil
	}

	orderAmount := multiplyAmount(shopCategory.Price, req.TotalNum)
	created, err := b.orderService.CreateOrderRecord(&orderDTO.CreateOrderRecordDTO{
		TenantID:         tenantID,
		ShopID:           uint64(shopCategory.ShopID),
		ShopName:         shopCategory.Name,
		ShopCategoryID:   uint64(shopCategory.Id),
		ShopCategoryName: shopCategory.Name,
		InitNum:          uint64(maxInt64(req.StartNum, 0)),
		EndNum:           uint64(maxInt64(req.EndNum, 0)),
		OrderStatus:      orderStatusInit,
		OrderNum:         req.TotalNum,
		OrderAmount:      orderAmount,
		UserID:           uint64(user.Id),
		Price:            shopCategory.Price,
		BusinessID:       strings.TrimSpace(req.BusinessKey),
		UserName:         user.Username,
		BusinessKey:      strings.TrimSpace(req.BusinessKey),
	})
	if err != nil {
		return nil, err
	}

	if err = b.publishOrderEvent(orderHandlerModel.EventTopicOrderCreate, &orderHandlerModel.OrderEvent{
		OrderID:   uint64(created.Id),
		RemoteIP:  strings.TrimSpace(remoteIP),
		CreatedAt: time.Now(),
	}); err != nil {
		return nil, err
	}

	return b.toOrderResponse(created), nil
}

func (b *Business) Refund(req *model.OrderRequestModel) error {
	if req == nil {
		return fmt.Errorf("参数不合规")
	}
	user, err := b.validateUserSecret(req.UserName, req.EncryptionKey)
	if err != nil {
		return err
	}
	orderRecord, err := b.mustGetOwnedOrder(req.OrderNo, uint64(user.Id))
	if err != nil {
		return err
	}
	if orderRecord.OrderStatus != orderStatusPending && orderRecord.OrderStatus != orderStatusInit {
		return fmt.Errorf("订单不允许退单")
	}
	if _, err = b.findRefundByOrderID(uint64(orderRecord.Id)); err == nil {
		return fmt.Errorf("不允许重复退单")
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}

	unlock, err := b.tryLock("order-gateway:refund:"+req.OrderNo, 10*time.Second)
	if err != nil {
		return err
	}
	defer unlock()

	refundRecord, err := b.orderService.CreateOrderRefundRecord(&orderDTO.CreateOrderRefundRecordDTO{
		TenantID:          orderRecord.TenantID,
		OrderID:           uint64(orderRecord.Id),
		RefundAmount:      "0",
		ShopCategoryID:    orderRecord.ShopCategoryID,
		RefundNum:         0,
		OrderRefundStatus: orderStatusRefundHanding,
	})
	if err != nil {
		return err
	}

	return b.publishOrderEvent(orderHandlerModel.EventTopicOrderRefund, &orderHandlerModel.OrderEvent{
		OrderID:   uint64(orderRecord.Id),
		RefundID:  uint64(refundRecord.Id),
		CreatedAt: time.Now(),
	})
}

func (b *Business) Get(req *model.OrderRequestModel) (*model.OrderResponseModel, error) {
	user, err := b.validateUserSecret(req.UserName, req.EncryptionKey)
	if err != nil {
		return nil, err
	}
	orderRecord, err := b.mustGetOwnedOrder(req.OrderNo, uint64(user.Id))
	if err != nil {
		return nil, err
	}
	response := b.toOrderResponse(orderRecord)
	if orderRecord.OrderStatus == orderStatusRefund {
		refundRecord, refundErr := b.findRefundByOrderID(uint64(orderRecord.Id))
		if refundErr == nil && refundRecord != nil {
			response.RefundAmt = toJSONNumber(refundRecord.RefundAmount)
		}
	}
	return response, nil
}

func (b *Business) GetInitOrders(req *model.OrderRequestModel) ([]*model.OrderResponseModel, error) {
	shopCategory, err := b.getShopCategoryBySecretKey(req.ShopKey)
	if err != nil {
		return nil, fmt.Errorf("无效秘钥")
	}
	limit := viper.GetInt("order.fetch.size")
	if limit <= 0 {
		limit = 100
	}
	var entities []*orderRepository.OrderRecord
	err = b.orderRecordRepository.Db.
		Where("active = ? AND shop_category_id = ? AND order_status = ?", 1, shopCategory.Id, orderStatusInit).
		Order("id ASC").
		Limit(limit).
		Find(&entities).Error
	if err != nil {
		return nil, err
	}
	return b.toOrderResponses(entities), nil
}

func (b *Business) Update(req *model.OrderRequestModel) error {
	orderID, err := parseUintID(req.OrderNo)
	if err != nil {
		return fmt.Errorf("参数不合规")
	}
	orderRecord, err := b.orderService.GetOrderRecordByID(uint(orderID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("订单不存在")
		}
		return err
	}

	nextStatus := strings.TrimSpace(req.Status)
	if nextStatus == "" {
		nextStatus = orderStatusPending
		totalNum := req.TotalNum
		if totalNum <= 0 {
			totalNum = orderRecord.OrderNum
		}
		if totalNum > 0 && req.EndNum >= totalNum {
			nextStatus = orderStatusDone
		}
	}

	_, err = b.orderService.UpdateOrderRecord(uint(orderID), &orderDTO.UpdateOrderRecordDTO{
		InitNum:     toUint64Ptr(uint64(maxInt64(req.StartNum, 0))),
		EndNum:      toUint64Ptr(uint64(maxInt64(req.EndNum, 0))),
		OrderStatus: &nextStatus,
	})
	if err != nil {
		return err
	}

	return b.publishOrderEvent(orderHandlerModel.EventTopicOrderUpdate, &orderHandlerModel.OrderEvent{
		OrderID:   orderID,
		CreatedAt: time.Now(),
	})
}

func (b *Business) ListRefunds(req *model.OrderRequestModel) ([]*model.OrderRefundResponseModel, error) {
	shopCategory, err := b.getShopCategoryBySecretKey(req.ShopKey)
	if err != nil {
		return nil, fmt.Errorf("无效秘钥")
	}
	limit := viper.GetInt("order.fetch.size")
	if limit <= 0 {
		limit = 100
	}
	var entities []*orderRepository.OrderRefundRecord
	err = b.orderRefundRecordRepository.Db.
		Where("active = ? AND shop_category_id = ? AND order_refund_status = ?", 1, shopCategory.Id, orderStatusRefundPending).
		Order("id ASC").
		Limit(limit).
		Find(&entities).Error
	if err != nil {
		return nil, err
	}
	return b.toRefundResponses(entities), nil
}

func (b *Business) validateSubmitUserAndShop(req *model.OrderRequestModel) (*userDTO.UserDTO, *shopDTO.ShopCategoryDTO, uint64, error) {
	user, err := b.validateUserSecret(req.UserName, req.EncryptionKey)
	if err != nil {
		return nil, nil, 0, err
	}
	shopCategory, err := b.getShopCategoryBySecretKey(req.ShopKey)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("用户秘钥无效")
	}
	if !strings.EqualFold(shopCategory.Status, "ACTIVE") {
		return nil, nil, 0, fmt.Errorf("用户秘钥无效")
	}

	tenantIDs, err := b.listTenantIDsByUserID(uint64(user.Id))
	if err != nil {
		return nil, nil, 0, err
	}
	if len(tenantIDs) == 0 {
		return nil, nil, 0, fmt.Errorf("用户环境有问题,请联系管理员")
	}
	allowed, err := b.hasTenantShopCategoryAccess(tenantIDs, uint64(shopCategory.Id))
	if err != nil {
		return nil, nil, 0, err
	}
	if !allowed {
		return nil, nil, 0, fmt.Errorf("用户不能下单该商品")
	}
	return user, shopCategory, tenantIDs[0], nil
}

func (b *Business) validateUserSecret(username, secret string) (*userDTO.UserDTO, error) {
	entity, err := b.userRepository.FindByUsername(strings.TrimSpace(username))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("用户姓名不存在")
		}
		return nil, err
	}
	dto := db.ToDTO[userDTO.UserDTO](entity)
	if strings.TrimSpace(dto.SecretKey) != strings.TrimSpace(secret) {
		return nil, fmt.Errorf("用户秘钥无效")
	}
	return dto, nil
}

func (b *Business) getShopCategoryBySecretKey(secret string) (*shopDTO.ShopCategoryDTO, error) {
	if b.shopCategoryRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var entity shopRepository.ShopCategory
	err := b.shopCategoryRepository.Db.
		Where("secret_key = ? AND active = ?", strings.TrimSpace(secret), 1).
		First(&entity).Error
	if err != nil {
		return nil, err
	}
	return db.ToDTO[shopDTO.ShopCategoryDTO](&entity), nil
}

func (b *Business) listTenantIDsByUserID(userID uint64) ([]uint64, error) {
	if b.tenantUserRepository.Db == nil {
		return nil, fmt.Errorf("database is not initialized")
	}
	var tenantIDs []uint64
	err := b.tenantUserRepository.Db.
		Table("tenant_user").
		Where("active = ? AND user_id = ?", 1, userID).
		Order("id ASC").
		Pluck("tenant_id", &tenantIDs).Error
	return tenantIDs, err
}

func (b *Business) hasTenantShopCategoryAccess(tenantIDs []uint64, shopCategoryID uint64) (bool, error) {
	if b.tenantShopCategoryRepo.Db == nil {
		return false, fmt.Errorf("database is not initialized")
	}
	var count int64
	err := b.tenantShopCategoryRepo.Db.
		Table("tenant_shop_category").
		Where("active = ? AND tenant_id IN ? AND shop_category_id = ?", 1, tenantIDs, shopCategoryID).
		Count(&count).Error
	return count > 0, err
}

func (b *Business) findOrderByBusinessKey(userID uint64, businessKey string) (*orderDTO.OrderRecordDTO, error) {
	var entity orderRepository.OrderRecord
	err := b.orderRecordRepository.Db.
		Where("active = ? AND user_id = ? AND business_key = ?", 1, userID, strings.TrimSpace(businessKey)).
		Order("id DESC").
		First(&entity).Error
	if err != nil {
		return nil, err
	}
	return db.ToDTO[orderDTO.OrderRecordDTO](&entity), nil
}

func (b *Business) findRefundByOrderID(orderID uint64) (*orderDTO.OrderRefundRecordDTO, error) {
	var entity orderRepository.OrderRefundRecord
	err := b.orderRefundRecordRepository.Db.
		Where("active = ? AND order_id = ?", 1, orderID).
		Order("id DESC").
		First(&entity).Error
	if err != nil {
		return nil, err
	}
	return db.ToDTO[orderDTO.OrderRefundRecordDTO](&entity), nil
}

func (b *Business) mustGetOwnedOrder(orderNo string, userID uint64) (*orderDTO.OrderRecordDTO, error) {
	orderID, err := parseUintID(orderNo)
	if err != nil {
		return nil, fmt.Errorf("参数不合规")
	}
	orderRecord, err := b.orderService.GetOrderRecordByID(uint(orderID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("订单不存在")
		}
		return nil, err
	}
	if orderRecord.UserID != userID {
		return nil, fmt.Errorf("订单权限不足")
	}
	return orderRecord, nil
}

func (b *Business) tryLock(key string, duration time.Duration) (func(), error) {
	if commonRedis.Rdb == nil {
		return func() {}, nil
	}
	token := fmt.Sprintf("%d", time.Now().UnixNano())
	locked, err := commonRedis.Rdb.SetNX(key, token, duration).Result()
	if err != nil {
		return nil, err
	}
	if !locked {
		return nil, fmt.Errorf("请求处理中，请勿重复提交")
	}
	return func() {
		_, _ = commonRedis.Rdb.Eval(unlockLua, []string{key}, token).Result()
	}, nil
}

func (b *Business) toOrderResponses(entities []*orderRepository.OrderRecord) []*model.OrderResponseModel {
	items := make([]*model.OrderResponseModel, 0, len(entities))
	for _, entity := range entities {
		items = append(items, b.toOrderResponse(db.ToDTO[orderDTO.OrderRecordDTO](entity)))
	}
	return items
}

func (b *Business) toOrderResponse(dto *orderDTO.OrderRecordDTO) *model.OrderResponseModel {
	if dto == nil {
		return nil
	}
	return &model.OrderResponseModel{
		OrderNo:     fmt.Sprintf("%d", dto.Id),
		BusinessKey: dto.BusinessKey,
		TotalNum:    dto.OrderNum,
		StartNum:    int64(dto.InitNum),
		EndNum:      int64(dto.EndNum),
		OrderAmt:    toJSONNumber(dto.OrderAmount),
		Status:      dto.OrderStatus,
		StatusDesc:  orderStatusDesc(dto.OrderStatus),
	}
}

func (b *Business) toRefundResponses(entities []*orderRepository.OrderRefundRecord) []*model.OrderRefundResponseModel {
	items := make([]*model.OrderRefundResponseModel, 0, len(entities))
	for _, entity := range entities {
		items = append(items, &model.OrderRefundResponseModel{
			OrderNo:       fmt.Sprintf("%d", entity.OrderID),
			Status:        entity.OrderRefundStatus,
			RefundAmt:     toJSONNumber(entity.RefundAmount),
			OrderRefundNo: fmt.Sprintf("%d", entity.Id),
		})
	}
	return items
}

func multiplyAmount(price string, total int64) string {
	if total <= 0 {
		return "0"
	}
	base, ok := new(big.Rat).SetString(strings.TrimSpace(price))
	if !ok {
		return "0"
	}
	result := new(big.Rat).Mul(base, big.NewRat(total, 1))
	return result.FloatString(8)
}

func toJSONNumber(value string) json.Number {
	value = strings.TrimSpace(value)
	if value == "" {
		value = "0"
	}
	return json.Number(value)
}

func orderStatusDesc(status string) string {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "INIT_ING":
		return "初始化中"
	case orderStatusInit:
		return "未开始"
	case orderStatusPending:
		return "进行中"
	case orderStatusDone:
		return "已完成"
	case "ERROR":
		return "处理失败"
	case orderStatusRefundPending:
		return "退单中"
	case orderStatusRefundHanding:
		return "退单处理中"
	case orderStatusRefund:
		return "已退单"
	default:
		return status
	}
}

func parseUintID(value string) (uint64, error) {
	var id uint64
	_, err := fmt.Sscanf(strings.TrimSpace(value), "%d", &id)
	if err != nil || id == 0 {
		return 0, fmt.Errorf("invalid id")
	}
	return id, nil
}

func maxInt64(value, fallback int64) int64 {
	if value < 0 {
		return fallback
	}
	return value
}

func toUint64Ptr(value uint64) *uint64 {
	return &value
}

func (b *Business) publishOrderEvent(topic string, payload *orderHandlerModel.OrderEvent) error {
	if b.queue == nil {
		return nil
	}
	message, err := commonQueue.NewMessage(payload,
		commonQueue.WithTopic(topic),
		commonQueue.WithMaxRetry(3),
	)
	if err != nil {
		return err
	}
	return b.queue.Publish(context.Background(), orderHandlerModel.OrderEventQueueName, message)
}

var _ = redis.Nil
