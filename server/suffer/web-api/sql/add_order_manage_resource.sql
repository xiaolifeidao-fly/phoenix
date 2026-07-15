-- 订单明细接口权限资源（GET /order-records/:id/amount-details）。
-- 幂等执行，按 resource_url 判断是否已存在；默认绑定 role_id = 1。

INSERT INTO resource_new (
  active, created_time, updated_time,
  name, code, parent_id, resource_type,
  resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT
  1, NOW(), NOW(),
  '订单明细', 'listOrderAmountDetails', 0, 'RESOURCE',
  '/order-records/:id/amount-details', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/order-records/:id/amount-details' AND active = 1
);

-- 绑定到角色 role_id = 1
INSERT INTO role_resource_new (
  active, created_time, updated_time,
  role_id, resource_id
)
SELECT
  1, NOW(), NOW(),
  1, r.id
FROM resource_new r
WHERE r.active = 1
  AND r.code = 'listOrderAmountDetails'
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1
      AND rr.resource_id = r.id
      AND rr.active = 1
  );
