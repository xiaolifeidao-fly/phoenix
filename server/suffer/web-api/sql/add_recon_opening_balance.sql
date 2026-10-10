-- 对账工作台 - 账户状态：全局初始余额（带日期），在 surfer 库执行。
-- 金额是 balance_date 这天结束时账上的余额（和人工记账的口径一样），全局只有一条（scope 固定 GLOBAL）。
-- 人工记账对比以它为基准：系统应有余额 = 初始余额 + 初始余额日期次日到当天的（入账 − 出账），不再拿上一份人工记账的余额当起点。
-- 清除只置 active = 0，再录入复用这一行。
-- 可重复执行（IF NOT EXISTS）。web-api 启动时也会 AutoMigrate 兜底，但以本脚本为准。
CREATE TABLE IF NOT EXISTS `recon_opening_balance` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '逻辑删除标识',
  `created_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `created_by` varchar(32) DEFAULT NULL COMMENT '创建人',
  `updated_by` varchar(32) DEFAULT NULL COMMENT '更新人',
  `scope` varchar(16) NOT NULL DEFAULT 'GLOBAL' COMMENT '固定 GLOBAL，保证全局只有一条',
  `balance_date` date NOT NULL COMMENT '初始余额日期',
  `currency` varchar(8) NOT NULL DEFAULT 'USDT' COMMENT '币种 USDT / RMB',
  `balance` decimal(38,8) NOT NULL DEFAULT '0.00000000' COMMENT '初始余额（按 currency）',
  `exchange_rate` decimal(20,8) DEFAULT NULL COMMENT '1U = ? RMB，按 U 时必填',
  `balance_rmb` decimal(38,8) NOT NULL DEFAULT '0.00000000' COMMENT '初始余额折算 RMB',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_recon_opening_balance_scope` (`scope`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对账初始余额（全局一条）';
