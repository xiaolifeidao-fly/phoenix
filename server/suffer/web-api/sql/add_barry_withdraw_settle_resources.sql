-- 人工 - 提现和结算管理（提现记录 / 提现汇总），授权 role_id = 1。可重复执行。
-- 鉴权按 resource_url 精确匹配（不区分 HTTP 方法），已存在的 URL 不会重复插入，只补绑定。
-- 提现记录页签复用的接口和渠道下拉接口也一并列出，线上若已存在则自动跳过。
INSERT INTO resource_new (
  active,
  created_time,
  updated_time,
  name,
  code,
  parent_id,
  resource_type,
  resource_url,
  page_url,
  component,
  redirect,
  menu_name,
  meta,
  sort_id
)
SELECT
  1,
  NOW(),
  NOW(),
  t.name,
  t.code,
  0,
  'RESOURCE',
  t.resource_url,
  '',
  '',
  '',
  '',
  '',
  0
FROM (
  SELECT '提现汇总查询' AS name, 'barryWithdrawSummaryList' AS code, '/barry/withdraw-summaries' AS resource_url
  UNION ALL SELECT '提现汇总批量发起结算', 'barryWithdrawSummaryAccount', '/barry/withdraw-summaries/account'
  UNION ALL SELECT '提现汇总批量发起核销', 'barryWithdrawSummaryFinish', '/barry/withdraw-summaries/finish'
  UNION ALL SELECT '提现记录查询', 'barryUserWithdrawRecordList', '/barry/user-withdraw-records'
  UNION ALL SELECT '提现记录发起结算', 'barryUserWithdrawAccount', '/barry/user-withdraws/account'
  UNION ALL SELECT '提现记录发起核销', 'barryUserWithdrawFinish', '/barry/user-withdraws/finish'
  UNION ALL SELECT '提现记录驳回', 'barryUserWithdrawCancel', '/barry/user-withdraws/cancel'
  UNION ALL SELECT '人工渠道列表', 'barryChannelDetailList', '/barry/channel-details'
) t
WHERE NOT EXISTS (
  SELECT 1
  FROM resource_new r
  WHERE r.resource_url = t.resource_url AND r.active = 1
);

INSERT INTO role_resource_new (
  active,
  created_time,
  updated_time,
  role_id,
  resource_id
)
SELECT
  1,
  NOW(),
  NOW(),
  1,
  r.id
FROM resource_new r
WHERE r.resource_url IN (
    '/barry/withdraw-summaries',
    '/barry/withdraw-summaries/account',
    '/barry/withdraw-summaries/finish',
    '/barry/user-withdraw-records',
    '/barry/user-withdraws/account',
    '/barry/user-withdraws/finish',
    '/barry/user-withdraws/cancel',
    '/barry/channel-details'
  )
  AND r.active = 1
  AND NOT EXISTS (
    SELECT 1
    FROM role_resource_new rr
    WHERE rr.role_id = 1
      AND rr.resource_id = r.id
      AND rr.active = 1
  );
