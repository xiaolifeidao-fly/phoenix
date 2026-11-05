-- 做单用户「解封」「解除登录锁定」API 资源，以及新增用户时「上级」下拉框的查询资源，默认授权管理员角色（role_id = 1）。可重复执行。
-- 解封：封禁状态改回可用，沿用封禁时换的密码和秘钥；解锁：清掉输错密码太多次被锁的状态。

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '解封做单用户', 'unbanBarryUser', 0,
  'RESOURCE', '/barry/user-details/unban', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/barry/user-details/unban' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '解除做单用户登录锁定', 'unlockBarryUserLogin', 0,
  'RESOURCE', '/barry/user-details/unlock', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/barry/user-details/unlock' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '做单用户可选上级', 'barryUserParentOptions', 0,
  'RESOURCE', '/barry/user-details/parent-options', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/barry/user-details/parent-options' AND active = 1
);

INSERT INTO role_resource_new (active, created_time, updated_time, role_id, resource_id)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.active = 1
  AND r.resource_url IN (
    '/barry/user-details/unban',
    '/barry/user-details/unlock',
    '/barry/user-details/parent-options'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
