"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { findPageTitle } from "./navigation";

/**
 * 可被「多标签页缓存」接管的路由清单。
 *
 * App Router 每次导航都会重新挂载 page 子树，缓存 layout 的 children 无效，
 * 因此这里直接登记每个路由对应的页面组件：由 TabWorkspace 统一挂载并常驻，
 * 切换菜单时只切换显隐，页面状态与已加载数据得以保留。
 *
 * 新增页面：在此加一条，key 与 navigation.tsx 中的路由 key 保持一致。
 */
const lazyPanel = (loader: () => Promise<{ default: ComponentType<any> }>) =>
  dynamic(loader, { ssr: false });

export const routeRegistry: Record<string, ComponentType<any>> = {
  "/manager-dashboard": lazyPanel(() =>
    import("@/app/(console)/manager-dashboard/components/ManagerDashboardPanel").then((m) => ({
      default: m.ManagerDashboardPanel,
    })),
  ),
  "/product/list": lazyPanel(() =>
    import("@/app/(console)/product/list/components/ProductManagementPanel").then((m) => ({
      default: m.ProductManagementPanel,
    })),
  ),
  "/product/overview": lazyPanel(() =>
    import("@/app/(console)/product/overview/components/ProductCategoryManagementPanel").then(
      (m) => ({ default: m.ProductCategoryManagementPanel }),
    ),
  ),
  "/order/list": lazyPanel(() =>
    import("@/app/(console)/order/components/OrderManagementPanel").then((m) => ({
      default: m.OrderManagementPanel,
    })),
  ),
  "/order/records": lazyPanel(() =>
    import("@/app/(console)/order/components/OrderListPanel").then((m) => ({
      default: m.OrderListPanel,
    })),
  ),
  "/order/refund-batch": lazyPanel(() =>
    import("@/app/(console)/order/refund-batch/components/RefundBatchPanel").then((m) => ({
      default: m.RefundBatchPanel,
    })),
  ),
  "/manual/user-management": lazyPanel(() =>
    import("@/app/(console)/manual/user-management/components/ManualUserManagementPanel").then(
      (m) => ({ default: m.ManualUserManagementPanel }),
    ),
  ),
  "/manual/product-management": lazyPanel(() =>
    import(
      "@/app/(console)/manual/product-management/components/ManualProductManagementPanel"
    ).then((m) => ({ default: m.ManualProductManagementPanel })),
  ),
  "/manual/channel-management": lazyPanel(() =>
    import(
      "@/app/(console)/manual/channel-management/components/ManualChannelManagementPanel"
    ).then((m) => ({ default: m.ManualChannelManagementPanel })),
  ),
  "/manual/task-statistics": lazyPanel(() =>
    import("@/app/(console)/manual/task-statistics/components/ManualTaskStatisticsPanel").then(
      (m) => ({ default: m.ManualTaskStatisticsPanel }),
    ),
  ),
  "/manual/order-details": lazyPanel(() =>
    import("@/app/(console)/manual/order-details/components/ManualOrderDetailPanel").then((m) => ({
      default: m.ManualOrderDetailPanel,
    })),
  ),
  "/manual/withdraw-approval": lazyPanel(() =>
    import("@/app/(console)/manual/withdraw-approval/components/ManualWithdrawApprovalPanel").then(
      (m) => ({ default: m.ManualWithdrawApprovalPanel }),
    ),
  ),
  "/reconciliation/workbench": lazyPanel(() =>
    import(
      "@/app/(console)/reconciliation/workbench/components/ReconciliationWorkbenchPanel"
    ).then((m) => ({ default: m.ReconciliationWorkbenchPanel })),
  ),
  "/user": lazyPanel(() =>
    import("@/app/(console)/user/components/UserManagementDemo").then((m) => ({
      default: m.UserManagementDemo,
    })),
  ),
  "/tenant/list": lazyPanel(() =>
    import("@/app/(console)/tenant/components/TenantManagementPanel").then((m) => ({
      default: m.TenantManagementPanel,
    })),
  ),
  "/permission": lazyPanel(() =>
    import("@/app/(console)/permission/components/PermissionManagementPanel").then((m) => ({
      default: m.PermissionManagementPanel,
    })),
  ),
};

export const DEFAULT_TAB_PATH = "/manager-dashboard";

export function isCacheableRoute(pathname: string): boolean {
  return Boolean(routeRegistry[pathname]);
}

/** 标签页标题复用导航配置里的名称 */
export function getTabLabel(pathname: string): string {
  return findPageTitle(pathname);
}
