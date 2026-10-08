-- 商品类目新增「返点金额」「小费金额」，与 price 同精度 decimal(38,8)，默认 0。
-- web-api 启动时 ShopService.EnsureTable 的 GORM AutoMigrate 也会补这两列，但它的错误被忽略了；
-- 线上账号没有 ALTER 权限时请手动执行本脚本（执行前确认列不存在，ALTER 不可重复执行）。

ALTER TABLE `shop_category`
  ADD COLUMN `rebate_amount` decimal(38,8) NOT NULL DEFAULT '0.00000000' COMMENT '返点金额',
  ADD COLUMN `tip_amount` decimal(38,8) NOT NULL DEFAULT '0.00000000' COMMENT '小费金额';
