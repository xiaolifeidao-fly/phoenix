"use client";

import type { ReactNode } from "react";

const numberFormat = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

/** 千分位金额，负数保留负号 */
export function money(value: number | null | undefined): string {
  const numeric = Number(value) || 0;
  const text = numberFormat.format(Math.abs(numeric));
  return numeric < 0 ? `-${text}` : text;
}

/**
 * 金额色调：income 收入（蓝）、cost 扣减（橙）、fee 手续费（红底）、settle 结算出款（紫底）、
 * profit 利润（正绿负红）；不传为默认色。敏感的 fee / settle 带底色。
 */
export type AmountTone = "income" | "cost" | "fee" | "settle" | "profit";

/** 表格里的金额单元格：等宽数字、右对齐、负数标红 */
export function MoneyCell({ value, tone }: { value: number | null | undefined; tone?: AmountTone }) {
  const numeric = Number(value) || 0;
  const classes = ["recon-amount"];
  if (tone) {
    classes.push(`recon-amount--${tone}`);
  }
  if (numeric < 0) {
    classes.push("recon-amount--negative");
  }
  return <span className={classes.join(" ")}>{money(numeric)}</span>;
}

/** 金额列的通用配置，避免每张表重复写 align / render */
export function moneyColumn<T>(title: string, dataIndex: keyof T & string, width = 120, tone?: AmountTone) {
  return {
    title,
    dataIndex,
    width,
    align: "right" as const,
    render: (value: number) => <MoneyCell value={value} tone={tone} />,
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
export function FormulaGrid({ items }: { items: { label: string; expression: ReactNode }[] }) {
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

/** 上游用户的下拉文案：名称（用户名）· 备注；名称和用户名相同时只写一次 */
export function upstreamUserLabel(name?: string, username?: string, remark?: string) {
  const title = name || username || "";
  const base = username && username !== title ? `${title}（${username}）` : title;
  return remark ? `${base} · ${remark}` : base;
}

/** 表格里的上游用户：名称加粗，下面一行是用户名和备注 */
export function UpstreamUserCell({ name, username, remark }: { name?: string; username?: string; remark?: string }) {
  const title = name || username || "-";
  const caption = [username && username !== title ? username : "", remark ?? ""].filter(Boolean).join(" · ");
  return (
    <span>
      <span className="recon-row-name">{title}</span>
      {caption ? <div className="recon-subcard-caption">{caption}</div> : null}
    </span>
  );
}
