-- 商品分组管理 API 资源，默认授权管理员角色（role_id = 1）。
-- 认证按 Gin 路由模板校验资源路径，因此动态参数保留为 :参数名。

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '商品分组查询', 'barryProductGroupList', 0,
  'RESOURCE', '/barry/shop-groups', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/barry/shop-groups' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '商品分组桥接器配置查询保存', 'barryShopGroupBridgeConfigs', 0,
  'RESOURCE', '/barry/shop-groups/:shopGroupId/bridge-configs', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/shop-groups/:shopGroupId/bridge-configs' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '商品分组桥接器配置编辑删除', 'barryShopGroupBridgeConfig', 0,
  'RESOURCE', '/barry/shop-groups/:shopGroupId/bridge-configs/:bridgeConfigId', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/shop-groups/:shopGroupId/bridge-configs/:bridgeConfigId' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '商品分组桥接器配置上线', 'barryShopGroupBridgeConfigActive', 0,
  'RESOURCE', '/barry/shop-groups/:shopGroupId/bridge-configs/:bridgeConfigId/active', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/shop-groups/:shopGroupId/bridge-configs/:bridgeConfigId/active' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '商品分组桥接器配置下线', 'barryShopGroupBridgeConfigDisable', 0,
  'RESOURCE', '/barry/shop-groups/:shopGroupId/bridge-configs/:bridgeConfigId/disable', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/shop-groups/:shopGroupId/bridge-configs/:bridgeConfigId/disable' AND active = 1
);

INSERT INTO role_resource_new (active, created_time, updated_time, role_id, resource_id)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.active = 1
  AND r.resource_url IN (
    '/barry/shop-groups',
    '/barry/shop-groups/:shopGroupId/bridge-configs',
    '/barry/shop-groups/:shopGroupId/bridge-configs/:bridgeConfigId',
    '/barry/shop-groups/:shopGroupId/bridge-configs/:bridgeConfigId/active',
    '/barry/shop-groups/:shopGroupId/bridge-configs/:bridgeConfigId/disable'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
