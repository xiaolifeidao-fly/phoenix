-- 对账 - 人工录入欠款改为和上游社区一对一（2026-10-09），在 surfer 库执行。
-- 之后每个社区最多一条有效记录：录入时已有就直接改。
-- 新增 debt_date（欠款日期）：金额是这天结束时的欠款（和人工记账口径一样），从次日开始累计充值 / 入账 / 手续费。
-- 旧的 effective_date / settle_status / settle_date 列保留但不再读写（改为可空，否则新增会失败）。
-- 可重复执行。web-api 启动时 AutoMigrate 也会补 debt_date 列并从旧列回填、把 effective_date 改成可空，但以本脚本为准。

-- 1. 加欠款日期列（已存在则跳过）
SET @has_debt_date = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recon_account_opening_debt' AND COLUMN_NAME = 'debt_date'
);
SET @ddl = IF(@has_debt_date = 0,
  'ALTER TABLE `recon_account_opening_debt` ADD COLUMN `debt_date` date DEFAULT NULL COMMENT ''欠款日期：金额是这天结束时的欠款，从次日开始累计'' AFTER `amount`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 旧数据回填：旧生效日当天的流水算在欠款里、次日开始累计，和欠款日期同义，直接复制
UPDATE `recon_account_opening_debt`
SET debt_date = effective_date
WHERE debt_date IS NULL AND effective_date IS NOT NULL;

-- 3. 同一社区有多条有效记录时，只保留欠款日期最晚的一条（同日取 id 最大），其余逻辑删除
UPDATE `recon_account_opening_debt` d
JOIN (
  SELECT t.user_id, MAX(t.id) AS keep_id
  FROM `recon_account_opening_debt` t
  JOIN (
    SELECT user_id, MAX(debt_date) AS max_date
    FROM `recon_account_opening_debt`
    WHERE active = 1
    GROUP BY user_id
  ) latest ON latest.user_id = t.user_id AND latest.max_date <=> t.debt_date
  WHERE t.active = 1
  GROUP BY t.user_id
) k ON k.user_id = d.user_id
SET d.active = 0, d.updated_by = 'migrate-single', d.updated_time = CURRENT_TIMESTAMP
WHERE d.active = 1 AND d.id <> k.keep_id;

-- 4. 停用的列改为可空
ALTER TABLE `recon_account_opening_debt`
  MODIFY `effective_date` date DEFAULT NULL COMMENT '已停用（2026-10-09 起改用 debt_date）',
  MODIFY `settle_status` varchar(16) DEFAULT NULL COMMENT '已停用（2026-10-09 起不再使用）';
