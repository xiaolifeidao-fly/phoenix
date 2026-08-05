-- 订单操作接口权限资源（退单 / 批量退单 / 异常打标 / 批量异常打标），绑定 role_id = 1。
-- 幂等执行：按 resource_url 判重（鉴权按 resource_url 匹配），重复执行不会产生重复资源。

INSERT INTO resource_new (
  name, code, parent_id, resource_type,
  resource_url, page_url, component, redirect, menu_name, meta, sort_id, active
)
SELECT '订单退单', 'order:refund', 0, 'api',
       '/order-records/:id/refund', '', '', '', '', '', 100, 1
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/order-records/:id/refund' AND active = 1
);

INSERT INTO resource_new (
  name, code, parent_id, resource_type,
  resource_url, page_url, component, redirect, menu_name, meta, sort_id, active
)
SELECT '订单批量退单', 'order:refund_batch', 0, 'api',
       '/order-record-refunds/batch', '', '', '', '', '', 101, 1
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/order-record-refunds/batch' AND active = 1
);

INSERT INTO resource_new (
  name, code, parent_id, resource_type,
  resource_url, page_url, component, redirect, menu_name, meta, sort_id, active
)
SELECT '订单异常打标', 'order:exception', 0, 'api',
       '/order-records/:id/exception', '', '', '', '', '', 102, 1
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/order-records/:id/exception' AND active = 1
);

INSERT INTO resource_new (
  name, code, parent_id, resource_type,
  resource_url, page_url, component, redirect, menu_name, meta, sort_id, active
)
SELECT '订单批量异常打标', 'order:exception_batch', 0, 'api',
       '/order-record-exceptions/batch', '', '', '', '', '', 103, 1
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/order-record-exceptions/batch' AND active = 1
);

-- 绑定到 role_id = 1
INSERT INTO role_resource_new (role_id, resource_id, active)
SELECT 1, r.id, 1
FROM resource_new r
WHERE r.active = 1
  AND r.resource_url IN (
    '/order-records/:id/refund',
    '/order-record-refunds/batch',
    '/order-records/:id/exception',
    '/order-record-exceptions/batch'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
