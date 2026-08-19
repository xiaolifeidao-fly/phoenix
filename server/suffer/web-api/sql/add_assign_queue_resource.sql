-- 人工做单明细「任务队列详情」查询接口权限，默认授予管理员角色(role_id = 1)。
INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '人工做单任务队列详情查询', 'barryAssignQueueUID', 0,
  'RESOURCE', '/barry/assign-queue/uid', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/assign-queue/uid' AND active = 1
);

INSERT INTO role_resource_new (
  active, created_time, updated_time, role_id, resource_id
)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.resource_url = '/barry/assign-queue/uid'
  AND r.active = 1
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
