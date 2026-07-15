"use client";

import { useRef, type ReactNode } from "react";

interface KeepAliveProps {
  /** 当前激活的缓存 key，通常为路由 pathname */
  activeKey: string;
  children: ReactNode;
}

interface CacheEntry {
  key: string;
  node: ReactNode;
}

/**
 * 路由内容缓存容器。
 *
 * 每个访问过的 key 对应的页面子树会被保留挂载，通过 display 切换显隐，
 * 从而实现类似「多标签页缓存」的效果：在快捷入口 / 菜单之间切换时，
 * 已打开页面的组件状态、滚动位置与已加载数据都不会丢失，也不会重新请求。
 */
export function KeepAlive({ activeKey, children }: KeepAliveProps) {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  // 仅在首次访问某个 key 时捕获其子树，之后不再覆盖。
  // 这样再次切回该页面时渲染的仍是同一个 React 元素引用，
  // React 会保留原有挂载与状态，页面内的 useEffect（如数据加载）不会重新触发。
  if (!cacheRef.current.has(activeKey)) {
    cacheRef.current.set(activeKey, { key: activeKey, node: children });
  }

  return (
    <>
      {Array.from(cacheRef.current.values()).map(({ key, node }) => (
        <div
          key={key}
          data-keepalive-key={key}
          style={{
            display: key === activeKey ? "block" : "none",
            height: "100%",
          }}
        >
          {node}
        </div>
      ))}
    </>
  );
}
