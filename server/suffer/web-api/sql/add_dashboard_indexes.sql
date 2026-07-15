-- 管理端「工作台」仪表盘查询的支撑索引。
-- 现象：/api/dashboard/today-consume、today-recharge、system-balance、actual-completed
--       都在大表上做「日期范围 + 类型」过滤，缺少索引导致全表扫描 → 接口超时。
--
-- 说明：
--   1. 下列 ALTER 均为幂等风格 —— 若索引已存在，MySQL 会报错，可先执行对应的
--      DROP INDEX，或用 information_schema 判断后再建（见文件末尾示例）。
--   2. account_detail 上原有 idx_account_id 保留不动，本次仅新增按查询定制的索引。
--   3. 建议在业务低峰期执行；大表加索引会锁写一段时间（MySQL 8 支持 ALGORITHM=INPLACE）。

-- ── account_detail ──────────────────────────────────────────────
-- today-consume / today-recharge：WHERE type IN (...) AND created_time >= ? AND created_time < ?
-- 采用 (type, created_time, account_id, amount) 覆盖索引：
--   · type 等值 + created_time 范围 → 精确定位到「今天某几类流水」，不再全表扫；
--   · 再带上 account_id、amount，聚合(GROUP BY account_id + SUM(amount))可「索引覆盖」，
--     无需回表，today-consume 单次扫描即可算完。
ALTER TABLE account_detail
    ADD INDEX idx_type_ctime_acc_amt (type, created_time, account_id, amount);

-- 若不希望索引过宽（amount 为 decimal(38,8)，写入放大较明显），
-- 可改用下面这条最小索引（仍能解决超时，只是明细聚合需回表）：
-- ALTER TABLE account_detail ADD INDEX idx_type_ctime (type, created_time);

-- ── account ─────────────────────────────────────────────────────
-- system-balance：WHERE account_status = 'ACTIVE' ORDER BY balance_amount DESC
-- (account_status, balance_amount) 让过滤 + 排序都走索引，避免 filesort。
ALTER TABLE account
    ADD INDEX idx_status_balance (account_status, balance_amount);

-- ── order_record ────────────────────────────────────────────────
-- actual-completed：WHERE created_time >= ? AND created_time < ?，并按 shop_category_id 聚合。
-- 覆盖时间范围、类目分组和状态计算，避免类目明细回表扫描。
ALTER TABLE order_record
    ADD INDEX idx_ctime_category_status (created_time, shop_category_id, order_status);

-- ── order_record_snapshot_daily ─────────────────────────────────
-- actual-completed 的昨日快照：WHERE sum_date = ?，并按 shop_category_id 聚合。
ALTER TABLE order_record_snapshot_daily
    ADD INDEX idx_sum_date_category (sum_date, shop_category_id);

-- ── 幂等判断示例（可选，逐条替换上面的 ALTER）───────────────────
-- SET @idx := (SELECT COUNT(1) FROM information_schema.statistics
--   WHERE table_schema = DATABASE() AND table_name = 'account_detail'
--     AND index_name = 'idx_type_ctime_acc_amt');
-- SET @sql := IF(@idx = 0,
--   'ALTER TABLE account_detail ADD INDEX idx_type_ctime_acc_amt (type, created_time, account_id, amount)',
--   'SELECT 1');
-- PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
