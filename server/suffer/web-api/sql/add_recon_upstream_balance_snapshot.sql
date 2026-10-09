-- 对账工作台 - 人工记账：上游社区每天的账户余额快照，在 surfer 库执行。
-- web-api 每天 00:00 给活跃社区（user.is_trading = 1，加上最近一份人工记账里记过欠款的社区）打前一天的余额快照，
-- 例如 10-09 00:00 打的是 10-08 的（snapshot_date = 2026-10-08）。人工记账按记账日期取快照，大家看到的都是那天的数。
-- (snapshot_date, user_id) 唯一，多个实例同时打时先写入的为准，打过的不再覆盖。
-- 可重复执行（IF NOT EXISTS）。web-api 启动时也会 AutoMigrate 兜底，但以本脚本为准。
CREATE TABLE IF NOT EXISTS `recon_upstream_balance_snapshot` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '逻辑删除标识',
  `created_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `created_by` varchar(32) DEFAULT NULL COMMENT '创建人',
  `updated_by` varchar(32) DEFAULT NULL COMMENT '更新人',
  `snapshot_date` date NOT NULL COMMENT '余额所属日期（截至这天结束）',
  `user_id` bigint unsigned NOT NULL COMMENT '上游社区（user.id）',
  `balance` decimal(38,8) NOT NULL DEFAULT '0.00000000' COMMENT '账户余额 RMB（该用户所有有效账户合计）',
  `captured_time` datetime NOT NULL COMMENT '实际打快照的时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_recon_upstream_balance_snapshot` (`snapshot_date`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对账人工记账 - 上游社区每日余额快照';
