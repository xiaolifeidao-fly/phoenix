/** 出入账方向 */
export type LedgerType = "入账" | "出款";

/** 人工维度一行：按大户 / 小户 / 其他用户聚合，RMB 与 U 分列 */
export interface ManualDimensionRow {
  name: string;
  bigRmb: number;
  bigU: number;
  smallRmb: number;
  smallU: number;
  otherRmb: number;
  otherU: number;
  /** 合计行，渲染时加重底色 */
  total?: boolean;
}

/** 上游维度一行：真人与其他社区拆分 */
export interface UpstreamDimensionRow {
  name: string;
  realRmb: number;
  realU: number;
  communityRmb: number;
  communityU: number;
  total?: boolean;
}

/** 出入账明细 */
export interface LedgerRecord {
  id: number;
  date: string;
  type: LedgerType;
  category: string;
  amountRmb: number;
  amountU: number;
  feeRmb: number;
  feeU: number;
  remark: string;
}

/** 账户状态（系统计算，只读） */
export interface AccountSystemRow {
  subject: string;
  kind: string;
  debtRmb: number;
  debtU: number;
  balanceRmb: number;
  balanceU: number;
}

/** 账户状态（人工录入，按日期维护） */
export interface AccountManualRow extends AccountSystemRow {
  id: number;
  date: string;
}

/** 账户状态里参与差异比对的四个金额字段 */
export const ACCOUNT_FIELDS = [
  { key: "debtRmb", label: "欠款金额 RMB" },
  { key: "debtU", label: "欠款金额 U" },
  { key: "balanceRmb", label: "账户余额 RMB" },
  { key: "balanceU", label: "账户余额 U" },
] as const;

export type AccountFieldKey = (typeof ACCOUNT_FIELDS)[number]["key"];

/** 出入账类目：新增与明细编辑共用 */
export const LEDGER_CATEGORIES: Record<LedgerType, string[]> = {
  入账: ["社区入账", "其他入账"],
  出款: ["大户出款", "小户出款", "其他用户出款", "服务器出款", "其他出款"],
};

/** 人工录入与系统计算的差异超过该百分比即触发预警 */
export const ACCOUNT_DIFF_ALERT_PERCENT = 5;
