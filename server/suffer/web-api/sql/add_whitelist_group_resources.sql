-- 白名单分组（挂在商品分组下）管理 API 资源，默认授权管理员角色（role_id = 1）。
-- 认证按 Gin 路由模板校验资源路径，因此动态参数保留为 :参数名。

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '白名单分组查询保存', 'barryWhitelistGroups', 0,
  'RESOURCE', '/barry/shop-groups/:shopGroupId/whitelist-groups', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/shop-groups/:shopGroupId/whitelist-groups' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '白名单分组编辑删除', 'barryWhitelistGroup', 0,
  'RESOURCE', '/barry/shop-groups/:shopGroupId/whitelist-groups/:whitelistGroupId', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/shop-groups/:shopGroupId/whitelist-groups/:whitelistGroupId' AND active = 1
);

INSERT INTO role_resource_new (active, created_time, updated_time, role_id, resource_id)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.active = 1
  AND r.resource_url IN (
    '/barry/shop-groups/:shopGroupId/whitelist-groups',
    '/barry/shop-groups/:shopGroupId/whitelist-groups/:whitelistGroupId'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
