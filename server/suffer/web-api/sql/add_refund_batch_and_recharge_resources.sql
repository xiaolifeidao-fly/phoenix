-- 新管理端批量退单与充值接口权限资源，幂等绑定到管理员角色 role_id = 1。

INSERT INTO resource_new (active, created_time, updated_time, name, code, parent_id, resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id)
SELECT 1, NOW(), NOW(), '批量退单任务查询', 'refund_batch:tasks', 0, 'RESOURCE', '/refund-batch/tasks', '', '', '', '', '', 110
WHERE NOT EXISTS (SELECT 1 FROM resource_new WHERE resource_url = '/refund-batch/tasks' AND active = 1);

INSERT INTO resource_new (active, created_time, updated_time, name, code, parent_id, resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id)
SELECT 1, NOW(), NOW(), '批量退单导入', 'refund_batch:import', 0, 'RESOURCE', '/refund-batch/import', '', '', '', '', '', 111
WHERE NOT EXISTS (SELECT 1 FROM resource_new WHERE resource_url = '/refund-batch/import' AND active = 1);

INSERT INTO resource_new (active, created_time, updated_time, name, code, parent_id, resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id)
SELECT 1, NOW(), NOW(), '批量退单执行', 'refund_batch:execute', 0, 'RESOURCE', '/refund-batch/tasks/:id/execute', '', '', '', '', '', 112
WHERE NOT EXISTS (SELECT 1 FROM resource_new WHERE resource_url = '/refund-batch/tasks/:id/execute' AND active = 1);

INSERT INTO resource_new (active, created_time, updated_time, name, code, parent_id, resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id)
SELECT 1, NOW(), NOW(), '批量退单明细查询', 'refund_batch:details', 0, 'RESOURCE', '/refund-batch/details', '', '', '', '', '', 113
WHERE NOT EXISTS (SELECT 1 FROM resource_new WHERE resource_url = '/refund-batch/details' AND active = 1);

INSERT INTO resource_new (active, created_time, updated_time, name, code, parent_id, resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id)
SELECT 1, NOW(), NOW(), '用户充值', 'account:recharge', 0, 'RESOURCE', '/accounts/:id/recharge', '', '', '', '', '', 115
WHERE NOT EXISTS (SELECT 1 FROM resource_new WHERE resource_url = '/accounts/:id/recharge' AND active = 1);

INSERT INTO resource_new (active, created_time, updated_time, name, code, parent_id, resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id)
SELECT 1, NOW(), NOW(), '充值明细查询', 'account:recharge-details', 0, 'RESOURCE', '/account-details', '', '', '', '', '', 116
WHERE NOT EXISTS (SELECT 1 FROM resource_new WHERE resource_url = '/account-details' AND active = 1);

INSERT INTO resource_new (active, created_time, updated_time, name, code, parent_id, resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id)
SELECT 1, NOW(), NOW(), '用户角色绑定', 'user:role-bindings', 0, 'RESOURCE', '/users/:id/roles', '', '', '', '', '', 117
WHERE NOT EXISTS (SELECT 1 FROM resource_new WHERE resource_url = '/users/:id/roles' AND active = 1);

INSERT INTO resource_new (active, created_time, updated_time, name, code, parent_id, resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id)
SELECT 1, NOW(), NOW(), '用户租户绑定', 'user:tenant-bindings', 0, 'RESOURCE', '/users/:id/tenants', '', '', '', '', '', 118
WHERE NOT EXISTS (SELECT 1 FROM resource_new WHERE resource_url = '/users/:id/tenants' AND active = 1);

INSERT INTO resource_new (active, created_time, updated_time, name, code, parent_id, resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id)
SELECT 1, NOW(), NOW(), '角色选项查询', 'user:role-options', 0, 'RESOURCE', '/roles', '', '', '', '', '', 119
WHERE NOT EXISTS (SELECT 1 FROM resource_new WHERE resource_url = '/roles' AND active = 1);

INSERT INTO role_resource_new (active, created_time, updated_time, role_id, resource_id)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.active = 1
  AND r.resource_url IN (
    '/refund-batch/tasks', '/refund-batch/import', '/refund-batch/tasks/:id/execute',
    '/refund-batch/details', '/accounts/:id/recharge', '/account-details',
    '/users/:id/roles', '/users/:id/tenants', '/roles'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );

-- 旧版本已配置过的自动执行资源停用，避免继续出现在角色资源中。
UPDATE role_resource_new rr
JOIN resource_new r ON r.id = rr.resource_id
SET rr.active = 0, rr.updated_time = NOW()
WHERE r.resource_url = '/refund-batch/scheduler' AND rr.active = 1;

UPDATE resource_new
SET active = 0, updated_time = NOW()
WHERE resource_url = '/refund-batch/scheduler' AND active = 1;
