-- Add resource permission (role_id = 1) for the manual product assign-strategy refund dimension API.
-- resource_url mirrors the phoenix web-api route (barry.pkg product_handler).

-- 分配策略 - 退单维度规则  (/barry/assign-refund-rules)
INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '分配策略-退单维度规则', 'assignRefundRule', 0,
  'RESOURCE', '/barry/assign-refund-rules', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/barry/assign-refund-rules' AND active = 1
);

-- Bind the resource to role_id = 1.
INSERT INTO role_resource_new (
  active, created_time, updated_time, role_id, resource_id
)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.resource_url = '/barry/assign-refund-rules'
  AND r.active = 1
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
