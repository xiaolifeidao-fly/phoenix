-- 视频维度过滤规则新增"只接"(白名单)字段 (barry DB)
-- 语义: 与已有 url_keywords(命中即拦截, 黑名单)相反, 只接(url_include)为白名单:
--   开启后 url 不含任一关键词的候选任务将被过滤掉, 只接包含关键词(如 note/图文, video/视频)的单子.
-- 全局(assign_video_rule) 与 指定用户(assign_video_user_rule) 两个维度都新增.

-- assign_video_rule: 品类全局视频规则
ALTER TABLE assign_video_rule
  ADD COLUMN url_include_enabled  TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '只接(白名单)关键词过滤开关(urlIncludeEnabled)' AFTER url_keywords,
  ADD COLUMN url_include_keywords VARCHAR(1024) NULL              COMMENT '只接包含的关键词, 逗号分隔; url不含任一关键词则过滤(urlIncludeKeywords)' AFTER url_include_enabled;

-- assign_video_user_rule: 指定用户视频规则(覆盖全局)
ALTER TABLE assign_video_user_rule
  ADD COLUMN url_include_enabled  TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '只接(白名单)关键词过滤开关(urlIncludeEnabled)' AFTER url_keywords,
  ADD COLUMN url_include_keywords VARCHAR(1024) NULL              COMMENT '只接包含的关键词, 逗号分隔; url不含任一关键词则过滤(urlIncludeKeywords)' AFTER url_include_enabled;
