-- 做单用户「修改密码」API 资源，默认授权管理员角色（role_id = 1）。可重复执行。
-- 接口早已上线但资源从未登记，修改密码会被鉴权拦成 "user not resource"。

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '修改做单用户密码', 'changeBarryUserPassword', 0,
  'RESOURCE', '/barry/user-details/password', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/barry/user-details/password' AND active = 1
);

INSERT INTO role_resource_new (active, created_time, updated_time, role_id, resource_id)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.active = 1
  AND r.resource_url = '/barry/user-details/password'
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
