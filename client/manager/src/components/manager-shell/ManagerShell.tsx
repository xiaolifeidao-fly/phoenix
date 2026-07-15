"use client";

import {
  // AuditOutlined, // 暂时隐藏：提现审批
  ApartmentOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ControlOutlined,
  DashboardOutlined,
  // SafetyCertificateOutlined, // 暂时隐藏：系统设置
  MenuFoldOutlined,
  LogoutOutlined,
  ProfileOutlined,
  ShopOutlined,
  ShoppingOutlined,
  SolutionOutlined,
  // TeamOutlined, // 暂时隐藏：用户管理
} from "@ant-design/icons";
import { Avatar, Button, Layout, Menu, Space, Typography } from "antd";
import type { MenuProps } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useMemo, useState } from "react";
import { clearAuthToken, getAuthUser, type AuthUser } from "@/utils/auth";
import { KeepAlive } from "./KeepAlive";

const { Content, Header, Sider } = Layout;
const { Text } = Typography;

interface ManagerShellProps extends PropsWithChildren {}

type MenuItem = Required<MenuProps>["items"][number];

function getOpenKeys(pathname: string) {
  if (pathname.startsWith("/product")) {
    return ["product"];
  }
  if (pathname.startsWith("/tenant")) {
    return ["system"];
  }
  if (pathname.startsWith("/order")) {
    return ["order"];
  }
  if (pathname.startsWith("/manual")) {
    return ["manual"];
  }
  if (pathname.startsWith("/permission")) {
    return ["system"];
  }

  return [];
}

export function ManagerShell({ children }: ManagerShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const quickActions = useMemo(
    () => [
      {
        key: "/manager-dashboard",
        label: "工作台",
        icon: <DashboardOutlined />,
      },
      {
        key: "/product/overview",
        label: "商品类别",
        icon: <ShoppingOutlined />,
      },
      {
        key: "/manual/task-statistics",
        label: "任务统计",
        icon: <BarChartOutlined />,
      },
      {
        key: "/manual/product-management",
        label: "人工商品管理",
        icon: <ShopOutlined />,
      },
      {
        key: "/manual/user-management",
        label: "人工用户管理",
        icon: <SolutionOutlined />,
      },
      // 暂时隐藏：用户
      // {
      //   key: "/user",
      //   label: "用户",
      //   icon: <TeamOutlined />,
      // },
    ],
    [],
  );
  const items = useMemo<MenuItem[]>(
    () => [
      {
        key: "/manager-dashboard",
        icon: <DashboardOutlined />,
        label: "管理工作台",
      },
      {
        key: "product",
        icon: <ShoppingOutlined />,
        label: "商品",
        children: [
          {
            key: "/product/list",
            label: "商品管理",
          },
          {
            key: "/product/overview",
            label: "商品类目",
          },
        ],
      },
      {
        key: "order",
        icon: <ProfileOutlined />,
        label: "订单",
        children: [
          {
            key: "/order/list",
            label: "订单管理",
          },
          {
            key: "/order/records",
            label: "订单列表",
          },
        ],
      },
      // 暂时隐藏：用户管理
      // {
      //   key: "/user",
      //   icon: <TeamOutlined />,
      //   label: "用户管理",
      // },
      {
        key: "manual",
        icon: <ControlOutlined />,
        label: "人工",
        children: [
          {
            key: "/manual/user-management",
            icon: <SolutionOutlined />,
            label: "用户管理",
          },
          {
            key: "/manual/product-management",
            icon: <ShopOutlined />,
            label: "人工商品管理",
          },
          {
            key: "/manual/channel-management",
            icon: <ApartmentOutlined />,
            label: "渠道管理",
          },
          {
            key: "/manual/task-statistics",
            icon: <BarChartOutlined />,
            label: "任务统计",
          },
          // 暂时隐藏：提现审批
          // {
          //   key: "/manual/withdraw-approval",
          //   icon: <AuditOutlined />,
          //   label: "提现审批",
          // },
        ],
      },
      // 暂时隐藏：系统设置
      // {
      //   key: "system",
      //   icon: <SafetyCertificateOutlined />,
      //   label: "系统设置",
      //   children: [
      //     {
      //       key: "/tenant/list",
      //       label: "租户管理",
      //     },
      //     {
      //       key: "/permission",
      //       label: "角色资源",
      //     },
      //   ],
      // },
    ],
    [],
  );
  const activePath = pathname ?? "/manager-dashboard";
  const userDisplayName = authUser?.displayName || authUser?.username || "管理员";
  const userRoleName = authUser?.roleName || "系统管理员";
  const avatarText = userDisplayName.trim().slice(0, 1).toUpperCase() || "管";
  const pageTitle = useMemo(() => {
    const flatItems = [
      { key: "/manager-dashboard", label: "管理工作台" },
      { key: "/product/list", label: "商品管理" },
      { key: "/product/overview", label: "商品类目" },
      { key: "/order/list", label: "订单管理" },
      { key: "/order/records", label: "订单列表" },
      { key: "/tenant/list", label: "租户管理" },
      { key: "/user", label: "用户管理" },
      { key: "/manual/user-management", label: "人工用户管理" },
      { key: "/manual/product-management", label: "人工商品管理" },
      { key: "/manual/channel-management", label: "渠道管理" },
      { key: "/manual/task-statistics", label: "任务统计" },
      { key: "/manual/withdraw-approval", label: "提现审批" },
      { key: "/permission", label: "角色资源" },
    ];
    return flatItems.find((item) => item.key === activePath)?.label ?? "管理控制台";
  }, [activePath]);

  const handleLogout = () => {
    clearAuthToken();
    router.replace("/login");
  };

  useEffect(() => {
    setAuthUser(getAuthUser());
  }, []);

  return (
    <div className="manager-app-frame">
      <div className="manager-shell-surface">
        <Layout
          style={{
            minHeight: "calc(100vh - 32px)",
            background: "transparent",
            gap: 16,
          }}
        >
          <Sider
            width={248}
            style={{
              background: "transparent",
            }}
          >
            <div
              className="manager-shell-card manager-sidebar-card manager-stagger-1"
              style={{
                height: "100%",
                borderRadius: 12,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div>
                <div className="manager-brand-kicker">Operations Suite</div>
                <Space align="start" size={12} style={{ marginTop: 14 }}>
                  <div className="manager-crest" />
                  <div className="manager-wordmark">
                    <strong style={{ color: "#fff" }}>PHOENIX</strong>
                    <span>管理工作区</span>
                  </div>
                </Space>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Space size={8}>
                  <CheckCircleOutlined style={{ color: "#34d399" }} />
                  <Text style={{ color: "rgba(255,255,255,0.88)", fontWeight: 700 }}>运行正常</Text>
                </Space>
                <Text style={{ color: "rgba(226,232,240,0.62)", fontSize: 12 }}>
                  商品、租户、用户与人工运营统一编排。
                </Text>
              </div>

              <Menu
                className="manager-shell-menu"
                mode="inline"
                selectedKeys={[activePath]}
                defaultOpenKeys={getOpenKeys(activePath)}
                items={items}
                onClick={({ key }) => {
                  if (typeof key === "string" && key.startsWith("/")) {
                    router.push(key);
                  }
                }}
                style={{
                  fontSize: 14,
                  marginTop: 0,
                }}
              />
            </div>
          </Sider>

          <Layout style={{ background: "transparent" }}>
            <Header
              className="manager-stagger-2"
              style={{
                height: "auto",
                lineHeight: "normal",
                padding: 0,
                background: "transparent",
              }}
            >
              <div
                className="manager-shell-card"
                style={{
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "grid",
                  gridTemplateColumns: "minmax(230px, 0.8fr) minmax(260px, 1fr) auto",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      color: "var(--manager-text-soft)",
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    当前页面
                  </div>
                  <Space size={10}>
                    <Button
                      type="text"
                      icon={<MenuFoldOutlined />}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        color: "var(--manager-text-soft)",
                      }}
                    />
	                    <div>
	                      <div style={{ color: "var(--manager-text)", fontSize: 20, fontWeight: 800 }}>
	                        {pageTitle}
	                      </div>
	                    </div>
	                  </Space>
                </div>

                <div style={{ minWidth: 0 }}>
                  <Space size={8} wrap style={{ width: "100%" }}>
                    {quickActions.map((action) => {
                      const isActive = activePath === action.key;

                      return (
                        <Button
                          key={action.key}
                          type={isActive ? "primary" : "default"}
                          icon={action.icon}
                          className={isActive ? "manager-soft-button" : undefined}
                          onClick={() => router.push(action.key)}
                          style={{
                            height: 38,
                            paddingInline: 14,
                            borderRadius: 8,
                            fontWeight: 700,
                          }}
                        >
                          {action.label}
                        </Button>
                      );
                    })}
                  </Space>
                </div>

                <Space size={10} wrap>
                  <div
                    style={{
                      padding: "6px 10px 6px 6px",
                      borderRadius: 10,
                      border: "1px solid var(--manager-border)",
                      background: "#ffffff",
                    }}
                  >
                    <Space size={10}>
                      <Avatar
                        style={{
                          width: 34,
                          height: 34,
                          background: "#3b73e5",
                          color: "#fff",
                          fontWeight: 700,
                        }}
                      >
                        {avatarText}
                      </Avatar>
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--manager-text)" }}>{userDisplayName}</div>
                        <Text style={{ color: "var(--manager-text-soft)" }}>{userRoleName}</Text>
                      </div>
                      <Button
                        type="text"
                        onClick={handleLogout}
                        icon={<LogoutOutlined />}
                        style={{
                          color: "var(--manager-text-soft)",
                          fontWeight: 600,
                        }}
                      >
                        退出
                      </Button>
                    </Space>
                  </div>
                </Space>
              </div>
            </Header>

            <Content style={{ paddingTop: 16 }}>
              <div className="manager-stagger-3">
                <KeepAlive activeKey={activePath}>{children}</KeepAlive>
              </div>
            </Content>
          </Layout>
        </Layout>
      </div>
    </div>
  );
}
