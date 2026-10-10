-- 对账工作台接口资源（人工维度、出入账、上游维度、账户状态、初始余额、人工记账），授权 role_id = 1。可重复执行。
-- 已经执行过旧版本的环境再执行一次即可，只会补上缺的资源和授权。
-- 鉴权按路由完整路径精确匹配，带 :id 的路由要单独登记。
INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id, resource_type,
  resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), t.name, t.code, 0, 'RESOURCE', t.url, '', '', '', '', '', 0
FROM (
  SELECT '对账工作台人工维度查询' AS name, 'barryReconManualDimension' AS code, '/barry/reconciliation/manual-dimension' AS url
  UNION ALL SELECT '对账出入账列表与新增', 'barryReconLedgers', '/barry/reconciliation/ledgers'
  UNION ALL SELECT '对账出入账汇总', 'barryReconLedgerSummary', '/barry/reconciliation/ledgers/summary'
  UNION ALL SELECT '对账出入账修改与删除', 'barryReconLedgerDetail', '/barry/reconciliation/ledgers/:id'
  UNION ALL SELECT '对账出入账同步提现', 'barryReconLedgerSyncWithdraw', '/barry/reconciliation/ledgers/sync-withdraw'
  UNION ALL SELECT '对账出入账修改快照', 'barryReconLedgerSnapshots', '/barry/reconciliation/ledgers/:id/snapshots'
  UNION ALL SELECT '对账工作台上游维度查询', 'reconUpstreamDimension', '/reconciliation/upstream-dimension'
  UNION ALL SELECT '对账工作台账户状态查询', 'reconAccountStatus', '/reconciliation/account-status'
  UNION ALL SELECT '对账人工录入欠款列表与新增', 'reconOpeningDebts', '/reconciliation/opening-debts'
  UNION ALL SELECT '对账人工录入欠款修改与撤销', 'reconOpeningDebtDetail', '/reconciliation/opening-debts/:id'
  UNION ALL SELECT '对账人工记账新增', 'reconManualBooks', '/reconciliation/manual-books'
  UNION ALL SELECT '对账人工记账修改与删除', 'reconManualBookItem', '/reconciliation/manual-books/:id'
  UNION ALL SELECT '对账人工记账按日查询', 'reconManualBookDetail', '/reconciliation/manual-books/detail'
  UNION ALL SELECT '对账人工记账利润对比', 'reconManualBookCompare', '/reconciliation/manual-books/compare'
  UNION ALL SELECT '对账人工记账修改记录', 'reconManualBookLogs', '/reconciliation/manual-books/logs'
  UNION ALL SELECT '对账欠款核对', 'reconDebtCompare', '/reconciliation/debt-compare'
  UNION ALL SELECT '对账初始余额查询、保存与清除', 'reconOpeningBalance', '/reconciliation/opening-balance'
) t
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new r WHERE r.resource_url = t.url AND r.active = 1
);

INSERT INTO role_resource_new (active, created_time, updated_time, role_id, resource_id)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.resource_url IN (
  '/barry/reconciliation/manual-dimension',
  '/barry/reconciliation/ledgers',
  '/barry/reconciliation/ledgers/summary',
  '/barry/reconciliation/ledgers/:id',
  '/barry/reconciliation/ledgers/sync-withdraw',
  '/barry/reconciliation/ledgers/:id/snapshots',
  '/reconciliation/upstream-dimension',
  '/reconciliation/account-status',
  '/reconciliation/opening-debts',
  '/reconciliation/opening-debts/:id',
  '/reconciliation/manual-books',
  '/reconciliation/manual-books/:id',
  '/reconciliation/manual-books/detail',
  '/reconciliation/manual-books/compare',
  '/reconciliation/manual-books/logs',
  '/reconciliation/debt-compare',
  '/reconciliation/opening-balance'
)
  AND r.active = 1
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
