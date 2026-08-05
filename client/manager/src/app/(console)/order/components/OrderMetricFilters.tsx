"use client";

import { InputNumber, Space, Typography } from "antd";
import type { OrderListQuery } from "../api/order.api";

const { Text } = Typography;

export interface OrderMetricFilters {
  submitRateMin: number | null;
  submitRateMax: number | null;
  growthRateMin: number | null;
  growthRateMax: number | null;
  assignFinishTimesMin: number | null;
  assignFinishTimesMax: number | null;
}

export const emptyMetricFilters: OrderMetricFilters = {
  submitRateMin: null,
  submitRateMax: null,
  growthRateMin: null,
  growthRateMax: null,
  assignFinishTimesMin: null,
  assignFinishTimesMax: null,
};

/** 转换为查询参数，空值不参与筛选 */
export function buildMetricQuery(filters: OrderMetricFilters): Partial<OrderListQuery> {
  return {
    submitRateMin: toQueryValue(filters.submitRateMin),
    submitRateMax: toQueryValue(filters.submitRateMax),
    growthRateMin: toQueryValue(filters.growthRateMin),
    growthRateMax: toQueryValue(filters.growthRateMax),
    assignFinishTimesMin: toQueryValue(filters.assignFinishTimesMin),
    assignFinishTimesMax: toQueryValue(filters.assignFinishTimesMax),
  };
}

/** 校验区间，返回错误提示；区间合法时返回 null */
export function validateMetricFilters(filters: OrderMetricFilters): string | null {
  if (isInverted(filters.submitRateMin, filters.submitRateMax)) {
    return "提交率区间的最小值不能大于最大值";
  }
  if (isInverted(filters.growthRateMin, filters.growthRateMax)) {
    return "上量率区间的最小值不能大于最大值";
  }
  if (isInverted(filters.assignFinishTimesMin, filters.assignFinishTimesMax)) {
    return "分发轮次区间的最小值不能大于最大值";
  }
  return null;
}

interface OrderMetricFiltersProps {
  value: OrderMetricFilters;
  onChange: (next: OrderMetricFilters) => void;
  onSubmit?: () => void;
}

export function OrderMetricFilterFields({ value, onChange, onSubmit }: OrderMetricFiltersProps) {
  const update = (patch: Partial<OrderMetricFilters>) => onChange({ ...value, ...patch });

  return (
    <>
      <RangeField label="提交率(%)">
        <InputNumber
          className="order-metric-range__input"
          placeholder="最小"
          min={0}
          max={100}
          value={value.submitRateMin}
          onChange={(next) => update({ submitRateMin: next })}
          onPressEnter={onSubmit}
        />
        <span className="order-metric-range__divider">~</span>
        <InputNumber
          className="order-metric-range__input"
          placeholder="最大"
          min={0}
          max={100}
          value={value.submitRateMax}
          onChange={(next) => update({ submitRateMax: next })}
          onPressEnter={onSubmit}
        />
      </RangeField>

      <RangeField label="上量率(%)">
        <InputNumber
          className="order-metric-range__input"
          placeholder="最小"
          min={0}
          max={100}
          value={value.growthRateMin}
          onChange={(next) => update({ growthRateMin: next })}
          onPressEnter={onSubmit}
        />
        <span className="order-metric-range__divider">~</span>
        <InputNumber
          className="order-metric-range__input"
          placeholder="最大"
          min={0}
          max={100}
          value={value.growthRateMax}
          onChange={(next) => update({ growthRateMax: next })}
          onPressEnter={onSubmit}
        />
      </RangeField>

      <RangeField label="分发轮次">
        <InputNumber
          className="order-metric-range__input"
          placeholder="最小"
          min={0}
          precision={0}
          value={value.assignFinishTimesMin}
          onChange={(next) => update({ assignFinishTimesMin: next })}
          onPressEnter={onSubmit}
        />
        <span className="order-metric-range__divider">~</span>
        <InputNumber
          className="order-metric-range__input"
          placeholder="最大"
          min={0}
          precision={0}
          value={value.assignFinishTimesMax}
          onChange={(next) => update({ assignFinishTimesMax: next })}
          onPressEnter={onSubmit}
        />
      </RangeField>
    </>
  );
}

function RangeField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Space direction="vertical" size={4} className="order-metric-range">
      <Text className="order-metric-range__label">{label}</Text>
      <div className="order-metric-range__body">{children}</div>
    </Space>
  );
}

function toQueryValue(value: number | null): number | undefined {
  return value === null || Number.isNaN(value) ? undefined : value;
}

function isInverted(min: number | null, max: number | null): boolean {
  return min !== null && max !== null && min > max;
}
