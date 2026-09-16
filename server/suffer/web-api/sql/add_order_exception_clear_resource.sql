-- 订单清除异常标识接口权限资源（单笔 / 批量），绑定 role_id = 1。
-- 幂等执行：按 resource_url 判重（鉴权按 gin 路由模板匹配），重复执行不会产生重复资源。

INSERT INTO resource_new (
  name, code, parent_id, resource_type,
  resource_url, page_url, component, redirect, menu_name, meta, sort_id, active
)
SELECT '订单清除异常标识', 'order:exception_clear', 0, 'api',
       '/order-records/:id/exception/clear', '', '', '', '', '', 105, 1
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/order-records/:id/exception/clear' AND active = 1
);

INSERT INTO resource_new (
  name, code, parent_id, resource_type,
  resource_url, page_url, component, redirect, menu_name, meta, sort_id, active
)
SELECT '订单批量清除异常标识', 'order:exception_clear_batch', 0, 'api',
       '/order-record-exceptions/batch-clear', '', '', '', '', '', 106, 1
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/order-record-exceptions/batch-clear' AND active = 1
);

-- 绑定到 role_id = 1
INSERT INTO role_resource_new (role_id, resource_id, active)
SELECT 1, r.id, 1
FROM resource_new r
WHERE r.active = 1
  AND r.resource_url IN (
    '/order-records/:id/exception/clear',
    '/order-record-exceptions/batch-clear'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
