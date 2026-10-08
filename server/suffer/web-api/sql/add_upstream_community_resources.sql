-- 新管理端「上游 / 上游社区」接口资源（转发 kakrolot-web /externalOrderConfig），授权 role_id = 1。可重复执行。
-- 鉴权按路由完整路径精确匹配，带 :id 的路由要单独登记。
INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id, resource_type,
  resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), t.name, t.code, 0, 'RESOURCE', t.url, '', '', '', '', '', 0
FROM (
  SELECT '上游社区配置查询' AS name, 'upstream:communities' AS code, '/upstream/communities' AS url
  UNION ALL SELECT '上游社区修改前缀地址', 'upstream:community-update', '/upstream/communities/:id/update'
  UNION ALL SELECT '上游社区禁用', 'upstream:community-disable', '/upstream/communities/:id/disable'
  UNION ALL SELECT '上游社区启用', 'upstream:community-enable', '/upstream/communities/:id/enable'
) t
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new r WHERE r.resource_url = t.url AND r.active = 1
);

INSERT INTO role_resource_new (active, created_time, updated_time, role_id, resource_id)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.resource_url IN (
  '/upstream/communities',
  '/upstream/communities/:id/update',
  '/upstream/communities/:id/disable',
  '/upstream/communities/:id/enable'
)
  AND r.active = 1
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
