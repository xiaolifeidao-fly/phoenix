"use client";

import {
  ApartmentOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  ControlOutlined,
  DashboardOutlined,
  FileDoneOutlined,
  ProfileOutlined,
  ShopOutlined,
  ShoppingOutlined,
  SolutionOutlined,
  TagsOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";

export interface NavNode {
  /** 分组用短 key，叶子节点用路由路径 */
  key: string;
  label: string;
  icon?: ReactNode;
  children?: NavNode[];
}

/**
 * 导航单一配置源：侧边栏菜单、面包屑、页面标题都由它派生，
 * 新增页面只需在这里加一条。
 */
export const navTree: NavNode[] = [
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
      { key: "/product/list", icon: <AppstoreOutlined />, label: "商品管理" },
      { key: "/product/overview", icon: <TagsOutlined />, label: "商品类目" },
    ],
  },
  {
    key: "order",
    icon: <ProfileOutlined />,
    label: "订单",
    children: [
      { key: "/order/list", icon: <FileDoneOutlined />, label: "订单管理" },
      { key: "/order/records", icon: <UnorderedListOutlined />, label: "订单列表" },
    ],
  },
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
      {
        key: "/manual/order-details",
        icon: <UnorderedListOutlined />,
        label: "做单明细",
      },
      // 暂时隐藏：提现审批
      // { key: "/manual/withdraw-approval", icon: <AuditOutlined />, label: "提现审批" },
    ],
  },
  // 暂时隐藏：系统设置（租户管理 / 角色资源）
  // {
  //   key: "system",
  //   icon: <SafetyCertificateOutlined />,
  //   label: "系统设置",
  //   children: [
  //     { key: "/tenant/list", label: "租户管理" },
  //     { key: "/permission", label: "角色资源" },
  //   ],
  // },
];

/**
 * 未在侧边栏展示、但仍需要正确面包屑与标题的页面。
 */
const hiddenRoutes: Record<string, string[]> = {
  "/user": ["用户管理"],
  "/tenant/list": ["系统设置", "租户管理"],
  "/permission": ["系统设置", "角色资源"],
  "/manual/withdraw-approval": ["人工", "提现审批"],
};

/** 找出当前路径在导航树中的祖先链，用于面包屑与展开态 */
export function findNavTrail(pathname: string): string[] {
  for (const node of navTree) {
    if (node.key === pathname) {
      return [node.label];
    }
    const child = node.children?.find((item) => item.key === pathname);
    if (child) {
      return [node.label, child.label];
    }
  }
  return hiddenRoutes[pathname] ?? [];
}

/** 当前路径所属的父级分组 key，供菜单默认展开使用 */
export function findOpenKeys(pathname: string): string[] {
  const parent = navTree.find((node) =>
    node.children?.some((child) => child.key === pathname),
  );
  return parent ? [parent.key] : [];
}

/** 页面标题 = 面包屑末级 */
export function findPageTitle(pathname: string): string {
  const trail = findNavTrail(pathname);
  return trail.at(-1) ?? "管理控制台";
}
