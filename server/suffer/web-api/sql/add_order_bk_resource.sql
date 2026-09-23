-- 订单补款接口权限资源：POST /order-records/:id/bk，绑定 role_id = 1。
-- 补款弹窗查实时数据的 /barry/order-real-detail 已在 add_order_real_detail_resource.sql 里，
-- 但提交补款这一步一直没资源点，点「确认补款」会被鉴权拦成 user not resource。
-- 幂等执行：按 resource_url 判重（鉴权按 gin 路由模板匹配），重复执行不会产生重复资源。

INSERT INTO resource_new (
  active, created_time, updated_time,
  name, code, parent_id, resource_type,
  resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT
  1, NOW(), NOW(),
  '订单补款', 'order:bk', 0, 'api',
  '/order-records/:id/bk', '', '', '', '', '', 107
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/order-records/:id/bk' AND active = 1
);

-- 绑定到 role_id = 1
INSERT INTO role_resource_new (
  active, created_time, updated_time,
  role_id, resource_id
)
SELECT
  1, NOW(), NOW(),
  1, r.id
FROM resource_new r
WHERE r.active = 1
  AND r.resource_url = '/order-records/:id/bk'
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
