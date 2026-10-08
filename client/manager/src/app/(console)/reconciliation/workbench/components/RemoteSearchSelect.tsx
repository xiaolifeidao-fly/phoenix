"use client";

import { useEffect, useRef, useState } from "react";
import { Select, Spin } from "antd";

export interface RemoteOption<V extends string | number> {
  value: V;
  label: string;
}

interface RemoteSearchSelectProps<V extends string | number> {
  value?: V | null;
  onChange?: (value: V | null) => void;
  /** 关键字为空时也会调用一次，用来展示默认的前一页 */
  fetchOptions: (keyword: string) => Promise<RemoteOption<V>[]>;
  /** 编辑时回显已选项，避免当前值不在搜索结果里只显示一个 ID */
  initialOption?: RemoteOption<V> | null;
  placeholder?: string;
}

/** 可搜索的远程下拉：输入停顿 300ms 后查询，只认最后一次请求的结果 */
export function RemoteSearchSelect<V extends string | number>({
  value,
  onChange,
  fetchOptions,
  initialOption,
  placeholder,
}: RemoteSearchSelectProps<V>) {
  const [options, setOptions] = useState<RemoteOption<V>[]>(initialOption ? [initialOption] : []);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const search = (keyword: string) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(async () => {
      const current = ++seq.current;
      setLoading(true);
      try {
        const result = await fetchOptions(keyword.trim());
        if (current === seq.current) {
          // 保留已选项，避免搜别的关键字时当前值变成裸 ID
          const selected = options.find((item) => item.value === value) ?? initialOption;
          const merged = selected && !result.some((item) => item.value === selected.value) ? [selected, ...result] : result;
          setOptions(merged);
        }
      } catch {
        if (current === seq.current) {
          setOptions(initialOption ? [initialOption] : []);
        }
      } finally {
        if (current === seq.current) {
          setLoading(false);
        }
      }
    }, 300);
  };

  useEffect(() => {
    search("");
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
    // 只在挂载时拉一次默认列表
  }, []);

  return (
    <Select<V>
      showSearch
      allowClear
      value={value ?? undefined}
      placeholder={placeholder}
      filterOption={false}
      onSearch={search}
      onChange={(next) => onChange?.(next ?? null)}
      onClear={() => search("")}
      notFoundContent={loading ? <Spin size="small" /> : "没有匹配的结果"}
      options={options}
    />
  );
}
