-- Add resource permissions (role_id = 1) for the manual product assign-strategy dimension APIs.
-- resource_url mirrors the phoenix web-api routes (barry.pkg product_handler).

-- 1) 分配策略 - uid维度规则  (/barry/assign-uid-rules)
INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '分配策略-uid维度规则', 'assignUidRule', 0,
  'RESOURCE', '/barry/assign-uid-rules', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/barry/assign-uid-rules' AND active = 1
);

-- 2) 分配策略 - 视频维度规则  (/barry/assign-video-rules)
INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '分配策略-视频维度规则', 'assignVideoRule', 0,
  'RESOURCE', '/barry/assign-video-rules', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/barry/assign-video-rules' AND active = 1
);

-- 3) 分配策略 - 指定用户视频规则  (/barry/assign-video-user-rules)
INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '分配策略-指定用户视频规则', 'assignVideoUserRule', 0,
  'RESOURCE', '/barry/assign-video-user-rules', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/barry/assign-video-user-rules' AND active = 1
);

-- Bind all three resources to role_id = 1.
INSERT INTO role_resource_new (
  active, created_time, updated_time, role_id, resource_id
)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.resource_url IN (
    '/barry/assign-uid-rules',
    '/barry/assign-video-rules',
    '/barry/assign-video-user-rules'
  )
  AND r.active = 1
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
