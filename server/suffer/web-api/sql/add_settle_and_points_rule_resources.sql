-- 人工结算（结算通道 + 做单用户结算配置）与人工商品积分配置的管理端 API 资源，默认授权管理员角色（role_id = 1）。
-- 认证按 Gin 路由模板校验资源路径（不区分请求方法），动态参数保留为 :参数名；同一路径的 GET/POST/PUT 共用一条资源。
-- 可重复执行：已存在的资源与授权会跳过。
--   /barry/settle-channels                    GET 列表、POST 新增
--   /barry/settle-channels/:id                PUT 编辑
--   /barry/user-details/:userId/settle        GET 查询、PUT 保存
--   /barry/points-rules                       GET 查询、POST 保存（商品全局）
--   /barry/user-whitelists/:id/points-rule    PUT 保存（白名单用户维度）
-- 商品类目返点金额、小费金额复用 /shop-categories 原有路由，无需新增资源。

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '结算通道查询新增', 'barrySettleChannels', 0,
  'RESOURCE', '/barry/settle-channels', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/settle-channels' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '结算通道编辑', 'barrySettleChannel', 0,
  'RESOURCE', '/barry/settle-channels/:id', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/settle-channels/:id' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '做单用户结算配置', 'barryUserDetailSettle', 0,
  'RESOURCE', '/barry/user-details/:userId/settle', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/user-details/:userId/settle' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '人工商品积分配置', 'barryPointsRules', 0,
  'RESOURCE', '/barry/points-rules', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/points-rules' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '白名单用户积分配置', 'barryUserWhitelistPointsRule', 0,
  'RESOURCE', '/barry/user-whitelists/:id/points-rule', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/user-whitelists/:id/points-rule' AND active = 1
);

INSERT INTO role_resource_new (active, created_time, updated_time, role_id, resource_id)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.active = 1
  AND r.resource_url IN (
    '/barry/settle-channels',
    '/barry/settle-channels/:id',
    '/barry/user-details/:userId/settle',
    '/barry/points-rules',
    '/barry/user-whitelists/:id/points-rule'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
