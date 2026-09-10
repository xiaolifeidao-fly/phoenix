-- 做单用户「调整积分」与「查看所有账号余额」API 资源，默认授权管理员角色（role_id = 1）。
-- 两个路径分开登记：调整积分是资金相关的写操作，只读岗位不应该顺带拿到。

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '人工调整用户积分', 'adjustBarryUserPoints', 0,
  'RESOURCE', '/barry/user-points/adjust', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/barry/user-points/adjust' AND active = 1
);

INSERT INTO resource_new (
  active, created_time, updated_time, name, code, parent_id,
  resource_type, resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT 1, NOW(), NOW(), '用户积分总额统计', 'barryUserPointsSummary', 0,
  'RESOURCE', '/barry/user-points/summary', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/barry/user-points/summary' AND active = 1
);

INSERT INTO role_resource_new (active, created_time, updated_time, role_id, resource_id)
SELECT 1, NOW(), NOW(), 1, r.id
FROM resource_new r
WHERE r.active = 1
  AND r.resource_url IN (
    '/barry/user-points/adjust',
    '/barry/user-points/summary'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
