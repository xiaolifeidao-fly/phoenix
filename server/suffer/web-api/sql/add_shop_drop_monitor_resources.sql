-- 已完成单掉量监控与补单数据的管理端接口权限, 默认授予管理员角色(role_id = 1).
-- 对应 doc/shop-finish-drop-monitor/方案设计.md 的管理端章节.
-- 八个接口: 人工商品上的监控配置读写 + 掉量监控的概览/明细/检测记录 + 补单数据的概览与明细.

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '掉量监控配置查询', 'barryDropMonitorRuleGet', 0,
  'RESOURCE', '/barry/drop-monitor-rules', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/drop-monitor-rules' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '掉量补单数据概览', 'barryDropRepairSummary', 0,
  'RESOURCE', '/barry/drop-repair-summary', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/drop-repair-summary' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '掉量补单数据明细', 'barryDropRepairDetails', 0,
  'RESOURCE', '/barry/drop-repair-details', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/drop-repair-details' AND active = 1
);


INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '掉量监控概览', 'barryDropMonitorSummary', 0,
  'RESOURCE', '/barry/drop-monitor-summary', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/drop-monitor-summary' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '掉量监控明细', 'barryDropMonitorDetails', 0,
  'RESOURCE', '/barry/drop-monitor-details', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/drop-monitor-details' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '掉量检测记录', 'barryDropMonitorRecords', 0,
  'RESOURCE', '/barry/drop-monitor-records', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/drop-monitor-records' AND active = 1
);


INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '掉量监控运行健康度', 'barryDropMonitorRuntime', 0,
  'RESOURCE', '/barry/drop-monitor-runtime', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/drop-monitor-runtime' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '掉量监控任务流水', 'barryDropMonitorJobRecords', 0,
  'RESOURCE', '/barry/drop-monitor-job-records', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/drop-monitor-job-records' AND active = 1
);

INSERT INTO role_resource_new (
  active, created_time, updated_time, role_id, resource_id
)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.resource_url IN (
  '/barry/drop-monitor-rules',
  '/barry/drop-repair-summary',
  '/barry/drop-repair-details',
  '/barry/drop-monitor-summary',
  '/barry/drop-monitor-details',
  '/barry/drop-monitor-records',
  '/barry/drop-monitor-runtime',
  '/barry/drop-monitor-job-records'
)
  AND r.active = 1
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
