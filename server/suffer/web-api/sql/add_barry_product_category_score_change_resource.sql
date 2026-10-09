-- 人工商品「调价历史」接口权限资源：GET /barry/product-category-score-changes，绑定 role_id = 1。
-- 人工商品管理页工具栏的「调价历史」抽屉走这个接口，转发 barry /shops/shopCategory/scoreChanges（倒序分页）。
-- 依赖 barry 先执行 barry/sql/add_shop_category_score_change.sql 建表。
-- 幂等执行：按 resource_url 判重（鉴权按 gin 路由模板匹配），重复执行不会产生重复资源。

INSERT INTO resource_new (
  active, created_time, updated_time,
  name, code, parent_id, resource_type,
  resource_url, page_url, component, redirect, menu_name, meta, sort_id
)
SELECT
  1, NOW(), NOW(),
  '人工商品调价历史', 'barryProductCategoryScoreChanges', 0, 'api',
  '/barry/product-category-score-changes', '', '', '', '', '', 0
WHERE NOT EXISTS (
  SELECT 1 FROM resource_new WHERE resource_url = '/barry/product-category-score-changes' AND active = 1
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
  AND r.resource_url = '/barry/product-category-score-changes'
  AND NOT EXISTS (
    SELECT 1 FROM role_resource_new rr
    WHERE rr.role_id = 1 AND rr.resource_id = r.id AND rr.active = 1
  );
