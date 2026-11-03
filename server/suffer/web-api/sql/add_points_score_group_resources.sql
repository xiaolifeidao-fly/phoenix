-- 人工商品积分配置 - 价格档位/策略组保存接口的管理端 API 资源，默认授权管理员角色（role_id = 1）。
-- 认证按 Gin 路由模板校验资源路径（不区分请求方法）。可重复执行：已存在的资源与授权会跳过。
--   /barry/points-rules/score-config    PUT 保存（商品全局价格档位与策略组）
-- 查询复用 GET /barry/points-rules；用户绑定策略组复用 PUT /barry/user-whitelists/:id/points-rule，无需新增资源。

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '人工商品价格策略组', 'barryPointsRuleScoreConfig', 0,
  'RESOURCE', '/barry/points-rules/score-config', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new
  WHERE resource_url = '/barry/points-rules/score-config' AND active = 1
);

INSERT INTO role_resource_new (active, created_time, updated_time, role_id, resource_id)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.active = 1
  AND r.resource_url = '/barry/points-rules/score-config'
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
