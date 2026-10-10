-- 对账工作台 · 入账赠送接口权限资源：POST /barry/reconciliation/ledgers/:id/fee-given，绑定 role_id = 1。
-- 社区入账勾选「手续费赠送给该社区」后调用，把代收手续费加到上游社区的 Kakrolot 余额。
-- suffer 会带操作人 token 转发到 Kakrolot POST /accounts/incomeGiven，Kakrolot 那边也要执行
-- Kakrolot/sql/account_income_given_resource.sql，否则会被 Kakrolot 鉴权拦下。
-- 幂等执行：按 resource_url 判重（鉴权按 gin 路由模板匹配），重复执行不会产生重复资源。

INSERT INTO resource_new (
  active, created_time, updated_time,
  name, code, parent_id, resource_type,
  resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT
  1, NOW(), NOW(),
  '入账赠送', 'reconciliation:ledger-fee-given', 0, 'RESOURCE',
  '/barry/reconciliation/ledgers/:id/fee-given', '', '', '', '', '', 120
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/barry/reconciliation/ledgers/:id/fee-given' AND active = 1
);

INSERT INTO role_resource_new (
  active, created_time, updated_time,
  role_id, resource_id
)
SELECT
  1, NOW(), NOW(),
  1, r.id
FROM resource_new r
WHERE r.active = 1
  AND r.resource_url = '/barry/reconciliation/ledgers/:id/fee-given'
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
