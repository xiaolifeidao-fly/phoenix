"use client";

import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Breadcrumb, Dropdown, Layout, Menu, Tooltip, Typography } from "antd";
import type { MenuProps } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import { clearAuthToken, getAuthUser, type AuthUser } from "@/utils/auth";
import { KeepAlive } from "./KeepAlive";
import { findNavTrail, findOpenKeys, findPageTitle, navTree } from "./navigation";

const { Content, Header, Sider } = Layout;
const { Text } = Typography;

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 72;
const COLLAPSE_STORAGE_KEY = "phoenix_manager_sidebar_collapsed";

interface ManagerShellProps extends PropsWithChildren {}

export function ManagerShell({ children }: ManagerShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const activePath = pathname ?? "/manager-dashboard";

  // 菜单展开态受控：折叠时清空，展开时恢复当前路径所属分组
  const [openKeys, setOpenKeys] = useState<string[]>(() => findOpenKeys(activePath));

  const menuItems = useMemo<MenuProps["items"]>(
    () =>
      navTree.map((node) => ({
        key: node.key,
        icon: node.icon,
        label: node.label,
        children: node.children?.map((child) => ({
          key: child.key,
          icon: child.icon,
          label: child.label,
        })),
      })),
    [],
  );

  const trail = useMemo(() => findNavTrail(activePath), [activePath]);
  const pageTitle = useMemo(() => findPageTitle(activePath), [activePath]);

  const userDisplayName = authUser?.displayName || authUser?.username || "管理员";
  const userRoleName = authUser?.roleName || "系统管理员";
  const avatarText = userDisplayName.trim().slice(0, 1).toUpperCase() || "管";

  const handleLogout = useCallback(() => {
    clearAuthToken();
    router.replace("/login");
  }, [router]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      // 展开时把当前分组重新打开，折叠时收起，避免展开后菜单是塌的
      setOpenKeys(next ? [] : findOpenKeys(activePath));
      return next;
    });
  }, [activePath]);

  useEffect(() => {
    setAuthUser(getAuthUser());
    setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
  }, []);

  // 路由变化时同步展开态（折叠状态下不展开）
  useEffect(() => {
    if (!collapsed) {
      setOpenKeys((previous) => {
        const next = findOpenKeys(activePath);
        return next.every((key) => previous.includes(key)) ? previous : [...previous, ...next];
      });
    }
  }, [activePath, collapsed]);

  const userMenu: MenuProps["items"] = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: (
        <div style={{ lineHeight: 1.4 }}>
          <div style={{ fontWeight: 600 }}>{userDisplayName}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {userRoleName}
          </Text>
        </div>
      ),
      disabled: true,
    },
    { type: "divider" },
    { key: "logout", icon: <LogoutOutlined />, label: "退出登录", danger: true },
  ];

  return (
    <Layout className="manager-shell" hasSider>
      <Sider
        className="manager-sider"
        width={SIDEBAR_WIDTH}
        collapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
        collapsed={collapsed}
        trigger={null}
        collapsible
      >
        <div className="manager-sider__brand">
          <div className="manager-sider__crest" aria-hidden="true">
            P
          </div>
          {!collapsed && (
            <div className="manager-sider__wordmark">
              <strong>PHOENIX</strong>
              <span>管理工作区</span>
            </div>
          )}
        </div>

        <div className="manager-sider__nav">
          <Menu
            className="manager-shell-menu"
            mode="inline"
            inlineIndent={16}
            selectedKeys={[activePath]}
            openKeys={openKeys}
            onOpenChange={(keys) => setOpenKeys(keys as string[])}
            items={menuItems}
            onClick={({ key }) => {
              if (key.startsWith("/")) {
                router.push(key);
              }
            }}
          />
        </div>

        <div className="manager-sider__footer">
          <span className="manager-sider__status-dot" aria-hidden="true" />
          {!collapsed && <span className="manager-sider__status-text">系统运行正常</span>}
        </div>
      </Sider>

      <Layout
        className="manager-shell__main"
        style={{ marginInlineStart: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
      >
        <Header className="manager-topbar">
          <Tooltip title={collapsed ? "展开侧边栏" : "收起侧边栏"} placement="bottomLeft">
            <button
              type="button"
              className="manager-topbar__toggle"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
              aria-expanded={!collapsed}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>
          </Tooltip>

          <div className="manager-topbar__heading">
            <Breadcrumb
              className="manager-topbar__crumb"
              items={trail.map((label) => ({ title: label }))}
            />
            <h1 className="manager-topbar__title">{pageTitle}</h1>
          </div>

          <Dropdown
            menu={{
              items: userMenu,
              onClick: ({ key }) => {
                if (key === "logout") {
                  handleLogout();
                }
              },
            }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <button type="button" className="manager-topbar__user">
              <Avatar className="manager-topbar__avatar" size={32}>
                {avatarText}
              </Avatar>
              <span className="manager-topbar__user-meta">
                <strong>{userDisplayName}</strong>
                <span>{userRoleName}</span>
              </span>
            </button>
          </Dropdown>
        </Header>

        <Content className="manager-content">
          <KeepAlive activeKey={activePath}>{children}</KeepAlive>
        </Content>
      </Layout>
    </Layout>
  );
}
