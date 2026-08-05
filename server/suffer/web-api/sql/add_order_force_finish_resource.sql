-- 订单强制完成接口权限资源：POST /order-record-force-finish（单笔与批量共用），绑定 role_id = 1。
-- 幂等执行：按 resource_url 判重。

INSERT INTO resource_new (
  name, code, parent_id, resource_type,
  resource_url, page_url, component, redirect, menu_name, meta, sort_id, active
)
SELECT '订单强制完成', 'order:force_finish', 0, 'api',
       '/order-record-force-finish', '', '', '', '', '', 104, 1
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/order-record-force-finish' AND active = 1
);

INSERT INTO role_resource_new (role_id, resource_id, active)
SELECT 1, r.id, 1
FROM resource_new r
WHERE r.active = 1
  AND r.resource_url = '/order-record-force-finish'
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
