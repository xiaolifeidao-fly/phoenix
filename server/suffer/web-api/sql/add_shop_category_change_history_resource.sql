-- 商品类目「调价历史」全量列表接口权限资源：GET /shop-category-changes，绑定 role_id = 1。
-- 商品类目页工具栏的「调价历史」抽屉走这个接口（倒序分页，可按 shopId / shopCategoryId 筛选），
-- 原来单行的 /shop-categories/:id/changes 不受影响。线上若已有该资源，下面两段都会跳过。
-- 幂等执行：按 resource_url 判重（鉴权按 gin 路由模板匹配），重复执行不会产生重复资源。

INSERT INTO resource_new (
  active, created_time, updated_time,
  name, code, parent_id, resource_type,
  resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT
  1, NOW(), NOW(),
  '商品类目调价历史', 'shopCategoryChanges', 0, 'api',
  '/shop-category-changes', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/shop-category-changes' AND active = 1
);

-- 绑定到 role_id = 1
INSERT INTO role_resource_new (
  active, created_time, updated_time,
  role_id, resource_id
)
SELECT
  1, NOW(), NOW(),
  1, r.id
FROM resource_new r
WHERE r.active = 1
  AND r.resource_url = '/shop-category-changes'
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
