-- 人工做单明细「任务队列详情」按商品分组代取任务接口权限，默认授予管理员角色(role_id = 1)。
INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '人工做单按商品分组代取任务', 'barryAssignQueueFetchTask', 0,
  'RESOURCE', '/barry/assign-queue/fetch-task', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/assign-queue/fetch-task' AND active = 1
);

INSERT INTO role_resource_new (
  active, created_time, updated_time, role_id, resource_id
)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.resource_url = '/barry/assign-queue/fetch-task'
  AND r.active = 1
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
