-- 工作台待检测数量资源；沿用工作台统计的管理员授权方式。

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '工作台待检测数量', 'workbenchPendingDetectionCount', 0,
  'RESOURCE', '/barry/workbench-dashboard/pending-detection-count', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/workbench-dashboard/pending-detection-count' AND active = 1
);

INSERT INTO role_resource_new (
  active, created_time, updated_time, role_id, resource_id
)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.resource_url = '/barry/workbench-dashboard/pending-detection-count'
  AND r.active = 1
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
