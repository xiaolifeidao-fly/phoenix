import type {
  AccountManualRow,
  AccountSystemRow,
  LedgerRecord,
  ManualDimensionRow,
  UpstreamDimensionRow,
} from "../types";

/**
 * 对账工作台目前只做界面层，数据全部走本地样例。
 * 接入服务端时把这里替换成 api/reconciliation.api.ts 的返回即可，组件无需改动。
 */

export const manualDimensionRows: ManualDimensionRow[] = [
  { name: "任务数量", bigRmb: 128, bigU: 0, smallRmb: 86, smallU: 0, otherRmb: 41, otherU: 0 },
  { name: "需出账金额", bigRmb: 182000, bigU: 25634, smallRmb: 74600, smallU: 10507, otherRmb: 22800, otherU: 3211 },
  { name: "代付金额", bigRmb: 135000, bigU: 19014, smallRmb: 54000, smallU: 7606, otherRmb: 15200, otherU: 2141 },
  { name: "总出款", bigRmb: 47000, bigU: 6620, smallRmb: 20600, smallU: 2901, otherRmb: 7600, otherU: 1070 },
  { name: "当前余额", bigRmb: 32000, bigU: 4507, smallRmb: 12800, smallU: 1803, otherRmb: 6400, otherU: 901 },
  { name: "人工总出款", bigRmb: 75200, bigU: 10592, smallRmb: 0, smallU: 0, otherRmb: 0, otherU: 0, total: true },
];

export const upstreamDimensionRows: UpstreamDimensionRow[] = [
  { name: "充值金额", realRmb: 168000, realU: 23662, communityRmb: 126000, communityU: 17746 },
  { name: "返点金额", realRmb: 8400, realU: 1183, communityRmb: 5200, communityU: 732 },
  { name: "消费金额", realRmb: 370000, realU: 52113, communityRmb: 215000, communityU: 30282 },
  { name: "小费金额", realRmb: 7400, realU: 1042, communityRmb: 4300, communityU: 606 },
  { name: "应收金额", realRmb: 159600, realU: 22479, communityRmb: 120800, communityU: 17014, total: true },
];

export const accountSystemRows: AccountSystemRow[] = [
  { subject: "AK", kind: "平台", debtRmb: -12800, debtU: -1803, balanceRmb: 32000, balanceU: 4507 },
  { subject: "社区1", kind: "社区", debtRmb: 24600, debtU: 3465, balanceRmb: 52800, balanceU: 7437 },
  { subject: "社区2", kind: "社区", debtRmb: 18400, debtU: 2592, balanceRmb: 38600, balanceU: 5437 },
  { subject: "社区3", kind: "社区", debtRmb: 9200, debtU: 1296, balanceRmb: 21400, balanceU: 3014 },
  { subject: "代收方", kind: "代收方", debtRmb: 16600, debtU: 2338, balanceRmb: 17600, balanceU: 2479 },
];

export const accountManualRows: AccountManualRow[] = [
  { id: 1, date: "2026-06-01", subject: "AK", kind: "平台", debtRmb: -13000, debtU: -1810, balanceRmb: 32080, balanceU: 4520 },
  { id: 2, date: "2026-06-01", subject: "社区1", kind: "社区", debtRmb: 24800, debtU: 3470, balanceRmb: 49700, balanceU: 7040 },
  { id: 3, date: "2026-06-01", subject: "社区2", kind: "社区", debtRmb: 18100, debtU: 2570, balanceRmb: 38800, balanceU: 5450 },
  { id: 4, date: "2026-06-01", subject: "社区3", kind: "社区", debtRmb: 9400, debtU: 1301, balanceRmb: 21300, balanceU: 3000 },
  { id: 5, date: "2026-06-01", subject: "代收方", kind: "代收方", debtRmb: 16720, debtU: 2350, balanceRmb: 17650, balanceU: 2480 },
];

export const ledgerRecords: LedgerRecord[] = [
  { id: 1, date: "2026-05-03", type: "出款", category: "大户出款", amountRmb: 47000, amountU: 6620, feeRmb: 470, feeU: 66, remark: "人工大户" },
  { id: 2, date: "2026-05-06", type: "出款", category: "小户出款", amountRmb: 20600, amountU: 2901, feeRmb: 206, feeU: 29, remark: "人工小户" },
  { id: 3, date: "2026-05-09", type: "出款", category: "其他用户出款", amountRmb: 7600, amountU: 1070, feeRmb: 76, feeU: 10, remark: "补单" },
  { id: 4, date: "2026-05-13", type: "出款", category: "服务器出款", amountRmb: 9200, amountU: 1296, feeRmb: 92, feeU: 13, remark: "服务器成本" },
  { id: 5, date: "2026-05-18", type: "入账", category: "社区入账", amountRmb: 136000, amountU: 19155, feeRmb: 680, feeU: 96, remark: "社区回款" },
  { id: 6, date: "2026-05-24", type: "入账", category: "其他入账", amountRmb: 35800, amountU: 5042, feeRmb: 179, feeU: 25, remark: "其他来源" },
];

export const DEFAULT_RANGE_START = "2026-05-01";
export const DEFAULT_RANGE_END = "2026-06-01";
