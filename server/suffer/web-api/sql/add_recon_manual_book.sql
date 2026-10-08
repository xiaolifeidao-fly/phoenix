-- 对账工作台 - 人工记账：每天一份剩余金额（默认 U）+ 各上游社区欠款（默认 RMB），在 surfer 库执行。
-- 人工利润 = 当天剩余金额（折算 RMB）− 上一份剩余金额，和出入账利润（入账 − 出账）对比。
-- 每天只有一份：book_date 唯一，删除只置 active = 0，同一天再记账复用这一行；欠款修改时旧的置无效再重新写入。
-- 每次新增 / 修改 / 删除都在同一事务里写一条修改记录（recon_manual_book_log），存改动前后的完整快照，只增不改。
-- 可重复执行（IF NOT EXISTS）。web-api 启动时也会 AutoMigrate 兜底，但以本脚本为准。
CREATE TABLE IF NOT EXISTS `recon_manual_book` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '逻辑删除标识',
  `created_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `created_by` varchar(32) DEFAULT NULL COMMENT '创建人',
  `updated_by` varchar(32) DEFAULT NULL COMMENT '更新人',
  `book_date` date NOT NULL COMMENT '记账日期',
  `currency` varchar(8) NOT NULL DEFAULT 'USDT' COMMENT '剩余金额币种 USDT / RMB',
  `balance` decimal(38,8) NOT NULL DEFAULT '0.00000000' COMMENT '剩余金额（按 currency）',
  `exchange_rate` decimal(20,8) DEFAULT NULL COMMENT '1U = ? RMB，有 U 金额时必填',
  `balance_rmb` decimal(38,8) NOT NULL DEFAULT '0.00000000' COMMENT '剩余金额折算 RMB',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_recon_manual_book_date` (`book_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对账人工记账（每天一份）';

CREATE TABLE IF NOT EXISTS `recon_manual_book_debt` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '逻辑删除标识',
  `created_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `created_by` varchar(32) DEFAULT NULL COMMENT '创建人',
  `updated_by` varchar(32) DEFAULT NULL COMMENT '更新人',
  `book_id` bigint NOT NULL COMMENT 'recon_manual_book.id',
  `upstream_user_id` bigint unsigned NOT NULL COMMENT '上游社区（user.id）',
  `upstream_user_name` varchar(128) DEFAULT NULL COMMENT '上游社区名称快照',
  `currency` varchar(8) NOT NULL DEFAULT 'RMB' COMMENT '币种 RMB / USDT',
  `amount` decimal(38,8) NOT NULL DEFAULT '0.00000000' COMMENT '欠款金额（按 currency），可为负',
  `amount_rmb` decimal(38,8) NOT NULL DEFAULT '0.00000000' COMMENT '欠款折算 RMB',
  PRIMARY KEY (`id`),
  KEY `idx_recon_manual_book_debt_book` (`book_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对账人工记账 - 各上游社区欠款';

CREATE TABLE IF NOT EXISTS `recon_manual_book_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '逻辑删除标识',
  `created_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  `updated_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `created_by` varchar(32) DEFAULT NULL COMMENT '操作人',
  `updated_by` varchar(32) DEFAULT NULL COMMENT '更新人',
  `book_id` bigint NOT NULL COMMENT 'recon_manual_book.id',
  `book_date` date NOT NULL COMMENT '记账日期',
  `action` varchar(16) NOT NULL COMMENT 'CREATE 新增 / UPDATE 修改 / DELETE 删除',
  `before_snapshot` text COMMENT '改动前快照（JSON：币种、剩余金额、汇率、备注、各社区欠款），新增时为空',
  `after_snapshot` text COMMENT '改动后快照（JSON），删除时为空',
  PRIMARY KEY (`id`),
  KEY `idx_recon_manual_book_log_date` (`book_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对账人工记账 - 修改记录';
