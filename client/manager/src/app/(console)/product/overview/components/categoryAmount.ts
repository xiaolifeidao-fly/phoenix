/**
 * 商品类目返点 / 小费：按价格比例换算金额。
 *
 * 用 BigInt 做定点运算，避免浮点误差：金额和价格按 8 位小数（与后端 decimal(38,8) 一致），
 * 比例是百分数，最多 4 位小数。
 */

/** 输入方式：按价格比例，或直接输入金额 */
export type CategoryAmountMode = "ratio" | "amount";

const AMOUNT_SCALE = 8;
const RATIO_SCALE = 4;

/** 非负百分比，最多 4 位小数 */
export const RATIO_PATTERN = /^\d+(\.\d{1,4})?$/;

/** 比例上限（%） */
export const RATIO_MAX = 100;

function toScaled(value: string, scale: number): bigint | null {
  const text = value.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  const [integer, fraction = ""] = text.split(".");
  if (fraction.length > scale) {
    return null;
  }
  return BigInt(integer + fraction.padEnd(scale, "0"));
}

function fromScaled(value: bigint, scale: number): string {
  const text = value.toString().padStart(scale + 1, "0");
  const integer = text.slice(0, text.length - scale);
  const fraction = text.slice(text.length - scale).replace(/0+$/, "");
  return fraction ? `${integer}.${fraction}` : integer;
}

/** 金额 = 价格 × 比例%，四舍五入到 8 位小数；价格或比例不合法时返回 null */
export function amountFromRatio(price: string | undefined, ratio: string | undefined): string | null {
  const priceScaled = toScaled(price ?? "", AMOUNT_SCALE);
  const ratioScaled = toScaled(ratio?.trim() ? ratio : "0", RATIO_SCALE);
  if (priceScaled === null || ratioScaled === null) {
    return null;
  }
  // price(1e8) × ratio(1e4) / 100 → 1e14，除以 1e6 回到 1e8
  const divisor = BigInt(1_000_000);
  const product = priceScaled * ratioScaled;
  const rounded = (product + divisor / BigInt(2)) / divisor;
  return fromScaled(rounded, AMOUNT_SCALE);
}

/**
 * 金额能否精确表示成价格的比例（最多 4 位小数）：能则返回比例，否则 null。
 * 编辑时用它决定按比例回显，还是退回按金额，避免打开再保存时金额被悄悄改掉。
 */
export function exactRatioOf(price: string | undefined, amount: string | undefined): string | null {
  const priceScaled = toScaled(price ?? "", AMOUNT_SCALE);
  const amountScaled = toScaled(amount?.trim() ? amount : "0", AMOUNT_SCALE);
  if (priceScaled === null || amountScaled === null || priceScaled === BigInt(0)) {
    return null;
  }
  // ratio(1e4) = amount(1e8) × 1e6 / price(1e8)
  const numerator = amountScaled * BigInt(1_000_000);
  if (numerator % priceScaled !== BigInt(0)) {
    return null;
  }
  return fromScaled(numerator / priceScaled, RATIO_SCALE);
}
