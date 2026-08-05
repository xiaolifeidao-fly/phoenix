"use client";

import type { ReactNode } from "react";

const numberFormat = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

/** 千分位金额，负数保留负号 */
export function money(value: number | null | undefined): string {
  const numeric = Number(value) || 0;
  const text = numberFormat.format(Math.abs(numeric));
  return numeric < 0 ? `-${text}` : text;
}

/** 表格里的金额单元格：等宽数字、右对齐、负数标红 */
export function MoneyCell({ value }: { value: number | null | undefined }) {
  const numeric = Number(value) || 0;
  return (
    <span className={numeric < 0 ? "recon-amount recon-amount--negative" : "recon-amount"}>
      {money(numeric)}
    </span>
  );
}

/** 金额列的通用配置，避免每张表重复写 align / render */
export function moneyColumn<T>(title: string, dataIndex: keyof T & string, width = 120) {
  return {
    title,
    dataIndex,
    width,
    align: "right" as const,
    render: (value: number) => <MoneyCell value={value} />,
  };
}

interface SectionHeadProps {
  title: string;
  caption?: string;
  extra?: ReactNode;
}

/** 卡片标题：左侧色条 + 标题 + 说明，右侧放操作区 */
export function SectionHead({ title, caption, extra }: SectionHeadProps) {
  return (
    <div className="recon-section-head">
      <div className="recon-section-head-copy">
        <div className="recon-section-title">
          <span className="recon-section-mark" aria-hidden />
          {title}
        </div>
        {caption ? <div className="recon-section-caption">{caption}</div> : null}
      </div>
      {extra ? <div className="recon-section-actions">{extra}</div> : null}
    </div>
  );
}

/** 公式说明条，统一放在卡片底部 */
export function FormulaGrid({ items }: { items: { label: string; expression: string }[] }) {
  return (
    <div className="recon-formula-grid">
      {items.map((item) => (
        <div className="recon-formula" key={item.label}>
          <span className="recon-formula-label">{item.label}</span>
          <span className="recon-formula-expression">{item.expression}</span>
        </div>
      ))}
    </div>
  );
}
