-- Grant task-statistics APIs to role_id = 1.
INSERT INTO resource_new (
  active,
  created_time,
  updated_time,
  name,
  code,
  parent_id,
  resource_type,
  resource_url,
  page_url,
  component,
  redirect,
  menu_name,
  meta,
  sort_id
)
SELECT
  1,
  NOW(),
  NOW(),
  '人工任务统计查询',
  'barryManualTaskStatistics',
  0,
  'RESOURCE',
  '/barry/manual-task-statistics',
  '',
  '',
  '',
  '',
  '',
  0
WHERE NOT EXISTS (
  SELECT 1
  FROM resource_new
  WHERE resource_url = '/barry/manual-task-statistics' AND active = 1
);

INSERT INTO resource_new (
  active,
  created_time,
  updated_time,
  name,
  code,
  parent_id,
  resource_type,
  resource_url,
  page_url,
  component,
  redirect,
  menu_name,
  meta,
  sort_id
)
SELECT
  1,
  NOW(),
  NOW(),
  '人工任务统计用户查询',
  'barryManualTaskStatisticsUsers',
  0,
  'RESOURCE',
  '/barry/manual-task-statistics/users',
  '',
  '',
  '',
  '',
  '',
  0
WHERE NOT EXISTS (
  SELECT 1
  FROM resource_new
  WHERE resource_url = '/barry/manual-task-statistics/users' AND active = 1
);

INSERT INTO role_resource_new (
  active,
  created_time,
  updated_time,
  role_id,
  resource_id
)
SELECT
  1,
  NOW(),
  NOW(),
  1,
  r.id
FROM resource_new r
WHERE r.resource_url IN (
  '/barry/manual-task-statistics',
  '/barry/manual-task-statistics/users'
)
  AND r.active = 1
  AND NOT EXISTS (
    SELECT 1
    FROM role_resource_new rr
    WHERE rr.role_id = 1
      AND rr.resource_id = r.id
      AND rr.active = 1
  );
