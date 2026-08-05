"use client";

import { CloseOutlined, ReloadOutlined } from "@ant-design/icons";
import { Dropdown, Tabs } from "antd";
import type { MenuProps } from "antd";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_TAB_PATH, getTabLabel, routeRegistry } from "./route-registry";

const TABS_STORAGE_KEY = "phoenix_manager_open_tabs";

interface TabWorkspaceProps {
  /** 当前路由 pathname，同时作为激活标签的 key */
  activePath: string;
}

function readStoredTabs(): string[] {
  try {
    const raw = window.sessionStorage.getItem(TABS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && !!routeRegistry[item]);
  } catch {
    return [];
  }
}

/**
 * 多标签页工作区。
 *
 * 打开过的页面会一直挂载在 DOM 中，仅通过 display 切换显隐，
 * 因此在菜单之间来回切换时不会重新请求数据、不会丢失筛选条件与滚动位置。
 * 需要拿最新数据时，可通过标签右键菜单里的「刷新」强制重挂载该页面。
 */
export function TabWorkspace({ activePath }: TabWorkspaceProps) {
  const router = useRouter();
  const [tabs, setTabs] = useState<string[]>([activePath]);
  // 已经真正挂载过的页面：标签恢复后不会立刻全部加载，首次点开时才挂载
  const [mountedKeys, setMountedKeys] = useState<string[]>([activePath]);
  // 用于「刷新」：递增后组件 key 改变，页面重新挂载并重新拉取数据
  const [revisions, setRevisions] = useState<Record<string, number>>({});

  // 恢复上次会话打开的标签（仅标签本身，内容按需挂载）
  useEffect(() => {
    const stored = readStoredTabs();
    if (stored.length) {
      setTabs((previous) => Array.from(new Set([...stored, ...previous])));
    }
  }, []);

  // 路由变化：把当前页加入标签并标记为已挂载
  useEffect(() => {
    if (!routeRegistry[activePath]) return;
    setTabs((previous) => (previous.includes(activePath) ? previous : [...previous, activePath]));
    setMountedKeys((previous) =>
      previous.includes(activePath) ? previous : [...previous, activePath],
    );
  }, [activePath]);

  useEffect(() => {
    window.sessionStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
  }, [tabs]);

  const goto = useCallback(
    (path: string) => {
      if (path !== activePath) {
        router.push(path);
      }
    },
    [activePath, router],
  );

  const closeTabs = useCallback(
    (keep: string[]) => {
      const next = keep.length ? keep : [DEFAULT_TAB_PATH];
      setTabs(next);
      setMountedKeys((previous) => previous.filter((key) => next.includes(key)));
      if (!next.includes(activePath)) {
        goto(next[next.length - 1]);
      }
    },
    [activePath, goto],
  );

  const closeTab = useCallback(
    (path: string) => {
      const index = tabs.indexOf(path);
      const rest = tabs.filter((key) => key !== path);
      setTabs(rest.length ? rest : [DEFAULT_TAB_PATH]);
      setMountedKeys((previous) => previous.filter((key) => key !== path));
      if (path === activePath) {
        goto(rest[index] ?? rest[index - 1] ?? DEFAULT_TAB_PATH);
      }
    },
    [activePath, goto, tabs],
  );

  const refreshTab = useCallback((path: string) => {
    setRevisions((previous) => ({ ...previous, [path]: (previous[path] ?? 0) + 1 }));
  }, []);

  const buildContextMenu = useCallback(
    (path: string): MenuProps["items"] => [
      { key: "refresh", icon: <ReloadOutlined />, label: "刷新" },
      { type: "divider" },
      { key: "close", icon: <CloseOutlined />, label: "关闭", disabled: tabs.length <= 1 },
      { key: "close-others", label: "关闭其他", disabled: tabs.length <= 1 },
      { key: "close-all", label: "关闭全部", disabled: tabs.length <= 1 },
    ],
    [tabs.length],
  );

  const handleContextAction = useCallback(
    (path: string, action: string) => {
      switch (action) {
        case "refresh":
          goto(path);
          refreshTab(path);
          break;
        case "close":
          closeTab(path);
          break;
        case "close-others":
          closeTabs([path]);
          break;
        case "close-all":
          closeTabs([]);
          break;
        default:
          break;
      }
    },
    [closeTab, closeTabs, goto, refreshTab],
  );

  const items = useMemo(
    () =>
      tabs.map((path) => ({
        key: path,
        closable: tabs.length > 1,
        label: (
          <Dropdown
            trigger={["contextMenu"]}
            menu={{
              items: buildContextMenu(path),
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                handleContextAction(path, key);
              },
            }}
          >
            <span className="manager-tabs__label">{getTabLabel(path)}</span>
          </Dropdown>
        ),
      })),
    [buildContextMenu, handleContextAction, tabs],
  );

  return (
    <div className="manager-tabs">
      <Tabs
        className="manager-tabs__bar"
        type="editable-card"
        hideAdd
        size="small"
        activeKey={activePath}
        items={items}
        onChange={goto}
        onEdit={(targetKey, action) => {
          if (action === "remove" && typeof targetKey === "string") {
            closeTab(targetKey);
          }
        }}
      />

      <div className="manager-tabs__content">
        {mountedKeys.map((path) => {
          const Panel = routeRegistry[path];
          if (!Panel) return null;
          return (
            <div
              key={path}
              className="manager-tabs__pane"
              style={{ display: path === activePath ? "block" : "none" }}
            >
              <Panel key={`${path}#${revisions[path] ?? 0}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
