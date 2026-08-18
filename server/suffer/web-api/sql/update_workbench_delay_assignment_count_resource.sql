-- 保留分配延迟消费速度接口，并更新已部署环境中的资源文案和授权。
UPDATE resource_new
SET active = 1,
    name = '工作台分配延迟消费速度',
    code = 'workbenchDelayAssignmentMetrics',
    updated_time = NOW()
WHERE resource_url = '/barry/workbench-dashboard/delay-assignment-count';

UPDATE role_resource_new rr
JOIN resource_new r ON r.id = rr.resource_id
SET rr.active = 1,
    rr.updated_time = NOW()
WHERE r.resource_url = '/barry/workbench-dashboard/delay-assignment-count'
  AND rr.role_id = 1;

INSERT INTO role_resource_new (
  active, created_time, updated_time, role_id, resource_id
)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.resource_url = '/barry/workbench-dashboard/delay-assignment-count'
  AND r.active = 1
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
