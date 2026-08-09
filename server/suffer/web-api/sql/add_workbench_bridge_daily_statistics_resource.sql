-- 为已部署的新管理工作台补充商品桥接器情况、商品分组和 BridgeType 接口权限；授权给 role_id = 1。

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '工作台商品桥接器情况', 'workbenchBridgeDailyStatistics', 0,
  'RESOURCE', '/barry/workbench-dashboard/bridge-daily-statistics', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/workbench-dashboard/bridge-daily-statistics' AND active = 1
);

-- 已执行过旧版脚本的环境同步更新资源名称。
UPDATE resource_new
SET name = '工作台商品桥接器情况',
    code = 'workbenchBridgeDailyStatistics',
    updated_time = NOW()
WHERE resource_url = '/barry/workbench-dashboard/bridge-daily-statistics'
  AND active = 1;

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '工作台桥接器类型', 'workbenchBridgeTypes', 0,
  'RESOURCE', '/barry/workbench-dashboard/bridge-types', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/workbench-dashboard/bridge-types' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '工作台商品分组', 'workbenchBridgeShopGroups', 0,
  'RESOURCE', '/barry/shop-groups', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/shop-groups' AND active = 1
);

INSERT INTO role_resource_new (
  active, created_time, updated_time, role_id, resource_id
)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.resource_url IN (
  '/barry/workbench-dashboard/bridge-daily-statistics',
  '/barry/workbench-dashboard/bridge-types',
  '/barry/shop-groups'
)
  AND r.active = 1
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
