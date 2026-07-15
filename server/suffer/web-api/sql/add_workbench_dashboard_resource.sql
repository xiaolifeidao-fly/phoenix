-- 新版管理工作台统计资源；全部授权给 role_id = 1。
-- Barry 人工指标通过 Phoenix Web API 代理暴露；资金和实际完成量由 Web API 直接提供。

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), source.name, source.code, 0,
  'RESOURCE', source.resource_url, '', '', '', '', '', 0
FROM (
  SELECT '工作台人工用户概览' AS name, 'workbenchUserOverview' AS code,
         '/barry/workbench-dashboard/user-overview' AS resource_url
  UNION ALL SELECT '工作台任务余量', 'workbenchTaskRemaining',
         '/barry/workbench-dashboard/task-remaining'
  UNION ALL SELECT '工作台人工提交数量', 'workbenchManualSubmitted',
         '/barry/workbench-dashboard/manual-submitted'
  UNION ALL SELECT '工作台实际完成数量', 'workbenchActualCompleted',
         '/dashboard/actual-completed'
  UNION ALL SELECT '工作台今日消费', 'workbenchTodayConsume',
         '/dashboard/today-consume'
  UNION ALL SELECT '工作台今日充值', 'workbenchTodayRecharge',
         '/dashboard/today-recharge'
  UNION ALL SELECT '工作台系统余额', 'workbenchSystemBalance',
         '/dashboard/system-balance'
) source
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new r
  WHERE r.resource_url = source.resource_url AND r.active = 1
);

INSERT INTO role_resource_new (
  active, created_time, updated_time, role_id, resource_id
)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.resource_url IN (
  '/barry/workbench-dashboard/user-overview',
  '/barry/workbench-dashboard/task-remaining',
  '/barry/workbench-dashboard/manual-submitted',
  '/dashboard/actual-completed',
  '/dashboard/today-consume',
  '/dashboard/today-recharge',
  '/dashboard/system-balance'
)
  AND r.active = 1
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
