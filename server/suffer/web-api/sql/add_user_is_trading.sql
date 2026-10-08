-- surfer.user 增加「是否活跃」（上游用户），列名 is_trading（不用 is_active，避免和逻辑删除的 active 混淆）。
-- 对账工作台「账户状态」只展示活跃用户。默认 0（不活跃），在「用户管理」列表里逐个打开。
-- 必须在发布 suffer-web-api 之前执行：新代码读写用户都会带上这一列，列不存在会直接报错。
-- web-api 启动时 EnsureTable 也会尝试 AutoMigrate，但它忽略错误，线上账号没有 ALTER 权限时会静默失败，所以以本脚本为准。
-- Kakrolot 也读写 user 表，加列（带默认值）不影响它。下面两种情况二选一执行，都不可重复执行。

-- 情况一：还没加过列
ALTER TABLE `user`
  ADD COLUMN `is_trading` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否活跃（上游用户），对账账户状态只展示活跃用户';

-- 情况二：已经按旧脚本加过 is_active，改名即可（已设置的活跃标记保留）
-- ALTER TABLE `user`
--   CHANGE COLUMN `is_active` `is_trading` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否活跃（上游用户），对账账户状态只展示活跃用户';
