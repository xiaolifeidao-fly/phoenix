-- 对账工作台 - 账户状态：上游用户账户的人工录入欠款（初始欠款），在 surfer 库执行。
-- 2026-10-09 起改为和社区一对一，用 debt_date（欠款日期）代替生效日期，已有表再执行 alter_recon_account_opening_debt_single.sql；下面的时间线规则已停用。
-- 时间线规则：同一用户同一时刻只有一条未结清；录入新的一条时上一条自动结清，结清日期 = 新记录的生效日期；
-- 已结清的不能改、不能删，只能撤销当前未结清的那条（撤销后上一条恢复未结清）。
-- 系统计算欠款（截至 D 日）= 生效日期 <= D 的最近一条金额 + 生效日之后到 D 日的（充值 − 社区入账 − 代收手续费）。
-- 可重复执行（IF NOT EXISTS）。web-api 启动时也会 AutoMigrate 兜底，但以本脚本为准。
CREATE TABLE IF NOT EXISTS `recon_account_opening_debt` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '逻辑删除标识（撤销时置 0）',
  `created_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `created_by` varchar(32) DEFAULT NULL COMMENT '创建人',
  `updated_by` varchar(32) DEFAULT NULL COMMENT '更新人',
  `user_id` bigint unsigned NOT NULL COMMENT '上游用户（user.id）',
  `account_id` bigint unsigned DEFAULT NULL COMMENT '账户（account.id），录入时快照',
  `amount` decimal(38,8) NOT NULL DEFAULT '0.00000000' COMMENT '欠款金额 RMB，可为负（多付）',
  `debt_date` date DEFAULT NULL COMMENT '欠款日期：金额是这天结束时的欠款，从次日开始累计',
  `effective_date` date DEFAULT NULL COMMENT '已停用（2026-10-09 起不再使用）',
  `settle_status` varchar(16) DEFAULT NULL COMMENT '已停用（2026-10-09 起不再使用）',
  `settle_date` date DEFAULT NULL COMMENT '已停用（2026-10-09 起不再使用）',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`),
  KEY `idx_opening_debt_user_date` (`user_id`, `effective_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对账账户人工录入欠款（初始欠款）';
