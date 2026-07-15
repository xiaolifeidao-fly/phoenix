-- 分配策略 · uid维度 / 视频维度 规则表 (barry DB)
-- uid维度: user 域, 视频维度: shop 域. 均按品类(shop_category_id)维护, 一个品类一条规则.

-- uid(投稿账号)维度过滤规则 [barry-user-service: assign_uid_rule]
CREATE TABLE IF NOT EXISTS assign_uid_rule (
  id                BIGINT        NOT NULL AUTO_INCREMENT,
  shop_category_id  BIGINT        NOT NULL COMMENT '品类ID(ProductCategory), 作用域',
  enabled           TINYINT(1)    NOT NULL DEFAULT 1 COMMENT '规则是否开启(uidRuleEnabled)',
  min_fans_num      BIGINT        NOT NULL DEFAULT 0 COMMENT '最小粉丝数 minFansNum >=',
  min_item_num      BIGINT        NOT NULL DEFAULT 0 COMMENT '最少作品数 itemNum >=',
  min_interact_rate DECIMAL(6, 4) NOT NULL DEFAULT 0 COMMENT '最低互动率 rate >= (0~1)',
  active            TINYINT(1)    NOT NULL DEFAULT 1,
  created_by        VARCHAR(64)   NULL,
  updated_by        VARCHAR(64)   NULL,
  created_time      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_time      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_shop_category (shop_category_id)
) COMMENT = '分配策略-uid维度过滤规则';

-- 视频(候选任务)维度过滤规则 [barry-shop-service: assign_video_rule]
CREATE TABLE IF NOT EXISTS assign_video_rule (
  id                 BIGINT        NOT NULL AUTO_INCREMENT,
  shop_category_id   BIGINT        NOT NULL COMMENT '品类ID(ProductCategory), 作用域',
  enabled            TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '规则是否开启(videoRuleEnabled)',
  url_filter_enabled TINYINT(1)    NOT NULL DEFAULT 0 COMMENT 'url关键词过滤开关(urlFilterEnabled)',
  url_keywords       VARCHAR(1024) NULL COMMENT '命中即拦截的关键词, 逗号分隔(urlKeywords)',
  ad_filter_enabled  TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '广告过滤开关(adFilterEnabled)',
  active             TINYINT(1)    NOT NULL DEFAULT 1,
  created_by         VARCHAR(64)   NULL,
  updated_by         VARCHAR(64)   NULL,
  created_time       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_time       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_shop_category (shop_category_id)
) COMMENT = '分配策略-视频维度过滤规则';

-- 指定用户的视频维度过滤规则(覆盖品类全局视频规则, 仅对该 app_user 生效) [barry-user-service: assign_video_user_rule]
CREATE TABLE IF NOT EXISTS assign_video_user_rule (
  id                 BIGINT        NOT NULL AUTO_INCREMENT,
  shop_category_id   BIGINT        NOT NULL COMMENT '品类ID(ProductCategory), 作用域',
  user_id            BIGINT        NOT NULL COMMENT 'app_user 用户ID',
  url_filter_enabled TINYINT(1)    NOT NULL DEFAULT 0 COMMENT 'url关键词过滤开关(urlFilterEnabled)',
  url_keywords       VARCHAR(1024) NULL COMMENT '命中即拦截的关键词, 逗号分隔(urlKeywords)',
  ad_filter_enabled  TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '广告过滤开关(adFilterEnabled)',
  active             TINYINT(1)    NOT NULL DEFAULT 1,
  created_by         VARCHAR(64)   NULL,
  updated_by         VARCHAR(64)   NULL,
  created_time       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_time       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_shop_category_user (shop_category_id, user_id)
) COMMENT = '分配策略-指定用户的视频维度过滤规则';

-- 用户ID维度(白名单)总开关: 有记录即代表该商品(品类)启用白名单过滤; 无记录=不限制 [barry-user-service: assign_whitelist_switch]
CREATE TABLE IF NOT EXISTS assign_whitelist_switch (
  id               BIGINT      NOT NULL AUTO_INCREMENT,
  shop_category_id BIGINT      NOT NULL COMMENT '品类ID(商品), 有记录即启用白名单过滤',
  active           TINYINT(1)  NOT NULL DEFAULT 1,
  created_by       VARCHAR(64) NULL,
  updated_by       VARCHAR(64) NULL,
  created_time     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_time     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_shop_category (shop_category_id)
) COMMENT = '分配策略-用户ID维度(白名单)总开关(有记录即启用)';

-- uid维度总开关: 有记录即代表该商品(品类)启用 uid 过滤; 无记录=不过滤 [barry-user-service: assign_uid_switch]
CREATE TABLE IF NOT EXISTS assign_uid_switch (
  id               BIGINT      NOT NULL AUTO_INCREMENT,
  shop_category_id BIGINT      NOT NULL COMMENT '品类ID(商品), 有记录即启用 uid 过滤',
  active           TINYINT(1)  NOT NULL DEFAULT 1,
  created_by       VARCHAR(64) NULL,
  updated_by       VARCHAR(64) NULL,
  created_time     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_time     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_shop_category (shop_category_id)
) COMMENT = '分配策略-uid维度总开关(有记录即启用)';
