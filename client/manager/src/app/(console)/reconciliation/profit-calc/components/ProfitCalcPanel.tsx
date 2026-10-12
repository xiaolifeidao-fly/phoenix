"use client";

import { useEffect, useMemo, useState } from "react";
import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Descriptions, InputNumber, Radio, Select, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { fetchProductCategories, type ShopCategoryRecord } from "@/app/(console)/product/api/product.api";
import { fetchManualProducts, type ManualProductRecord } from "@/app/(console)/manual/api/product.api";
import {
  fetchSettleChannels,
  type SettleChannelRecord,
  type SettleCurrency,
} from "@/app/(console)/manual/api/settle.api";
import { FormulaGrid, SectionHead } from "../../workbench/components/shared";

const { Text } = Typography;

/** 10000 积分 = 1 元，下游价格按人工商品积分折算 */
const POINTS_PER_RMB = 10000;
/** 默认小费（RMB）；上游类目配了小费就用类目的 */
const DEFAULT_TIP = 0.0005;
/** 上游商品类目接口单页最多 200 条 */
const CATEGORY_PAGE_SIZE = 200;

/** 单价常常是几分几厘，最多保留 6 位小数 */
const priceFormat = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 6 });

function price(value: number) {
  // 0 × 负号会显示成 "-0"，统一按 0 展示
  return Number.isFinite(value) ? priceFormat.format(value === 0 ? 0 : value) : "-";
}

function percent(rate?: number | null) {
  return `${Number(((rate || 0) * 100).toFixed(4))}%`;
}

function PriceCell({ value }: { value: number }) {
  return (
    <span className={value < 0 ? "recon-amount recon-amount--negative" : "recon-amount"}>{price(value)}</span>
  );
}

/** 浮点相减会留尾差，小于这个值当作没变 */
const EPSILON = 1e-9;

function signedPrice(value: number) {
  return value > EPSILON ? `+${price(value)}` : price(Math.abs(value) < EPSILON ? 0 : value);
}

function signedPoints(value: number) {
  const text = (value * 100).toFixed(2);
  return value > 0 ? `+${text}` : text;
}

/** 变化量：按对利润的影响着色，正数（利润变多）绿、负数红 */
function DeltaCell({ value }: { value: number }) {
  if (Math.abs(value) < EPSILON) {
    return <span className="recon-amount" style={{ color: "var(--manager-text-faint)" }}>0</span>;
  }
  return (
    <span className={value > 0 ? "recon-amount recon-amount--profit" : "recon-amount recon-amount--negative"}>
      {signedPrice(value)}
    </span>
  );
}

/** 价格输入框下方提示：手动改过价格时显示 原价 → 现价（变化） */
function PriceChangeHint({ base, current }: { base: number | null; current: number | null }) {
  if (base == null || current == null || Math.abs(current - base) < EPSILON) {
    return null;
  }
  const delta = current - base;
  return (
    <div className="recon-subcard-caption" style={{ marginTop: 6 }}>
      原价 {price(base)} → {price(current)}（{signedPrice(delta)}
      {base ? `，${signedPoints(delta / base)}%` : ""}）
    </div>
  );
}

/**
 * 金额一律 RMB；社区入账、人工出账各自选的 U / RMB 只决定用哪套代收 / 代付费率。
 * 入账手续费基数 = 上游价格（不扣小费）；代出手续费基数 = 下游价格；上游赠送基数 = 上游价格。
 */
function computeProfit(up: number, tipValue: number, down: number, collectRate: number, payoutRate: number, giftRate: number) {
  const upstreamNet = up - tipValue;
  const collectFee = up * collectRate;
  const collectNet = upstreamNet - collectFee;
  const payoutFee = down * payoutRate;
  const gift = up * giftRate;
  const profit = collectNet - down - payoutFee - gift;
  return { up, tipValue, upstreamNet, collectFee, collectNet, down, payoutFee, gift, profit };
}

async function fetchAllUpstreamCategories() {
  const rows: ShopCategoryRecord[] = [];
  for (let pageIndex = 1; ; pageIndex += 1) {
    const page = await fetchProductCategories({ pageIndex, pageSize: CATEGORY_PAGE_SIZE });
    rows.push(...page.data);
    if (page.data.length < CATEGORY_PAGE_SIZE || rows.length >= page.total) {
      return rows;
    }
  }
}

const feeCurrencyOptions: Array<{ label: string; value: SettleCurrency }> = [
  { label: "U", value: "USDT" },
  { label: "RMB", value: "RMB" },
];

interface CalcRow {
  key: string;
  label: string;
  /** 单件金额（现价），按所选币种 */
  unit: number;
  /** 单件金额（原价：选商品时带出的价格） */
  base: number;
  note?: string;
  /** 小计 / 利润行加粗 */
  total?: boolean;
}

/**
 * 对账 - 利润试算：选结算通道带出代收 / 代付费率，选上下游商品带出价格，按单件和数量估算利润。
 * 纯前端计算，不落库；价格、小费、赠送比例都可以手动改。
 */
export function ProfitCalcPanel() {
  const [channels, setChannels] = useState<SettleChannelRecord[]>([]);
  const [categories, setCategories] = useState<ShopCategoryRecord[]>([]);
  const [products, setProducts] = useState<ManualProductRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [channelId, setChannelId] = useState<number>();
  // 社区入账、人工出账各自选 U / RMB，只决定用哪套费率
  const [collectCurrency, setCollectCurrency] = useState<SettleCurrency>("USDT");
  const [payoutCurrency, setPayoutCurrency] = useState<SettleCurrency>("RMB");
  const [categoryId, setCategoryId] = useState<number>();
  const [productId, setProductId] = useState<number>();
  // 下面几个金额一律 RMB，选商品时带出，可手动改
  const [upstreamPrice, setUpstreamPrice] = useState<number | null>(null);
  const [tip, setTip] = useState<number | null>(DEFAULT_TIP);
  const [downstreamPrice, setDownstreamPrice] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number | null>(1);
  /** 上游赠送比例（%），充值赠送的部分没有真实入账，从利润里扣掉 */
  const [giftPercent, setGiftPercent] = useState<number | null>(10);
  // 选商品时带出的原价，用来和手动改过的现价对比；没选商品时为 null。小费不对比，原价、现价都按最新填写的算
  const [baseUpstreamPrice, setBaseUpstreamPrice] = useState<number | null>(null);
  const [baseDownstreamPrice, setBaseDownstreamPrice] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [channelRows, categoryRows, productRows] = await Promise.all([
        fetchSettleChannels(),
        fetchAllUpstreamCategories(),
        fetchManualProducts(),
      ]);
      setChannels(channelRows);
      setCategories(categoryRows);
      setProducts(productRows);
      // 首次加载默认选中默认通道，没有就选第一个启用的；刷新时保留当前选择
      if (!channelId || !channelRows.some((item) => item.id === channelId)) {
        const fallback =
          channelRows.find((item) => item.enabled && item.defaultChannel) ?? channelRows.find((item) => item.enabled);
        setChannelId(fallback?.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const channel = channels.find((item) => item.id === channelId);
  const collectU = collectCurrency === "USDT";
  const payoutU = payoutCurrency === "USDT";
  const collectRate = (collectU ? channel?.collectFeeRateU : channel?.collectFeeRate) || 0;
  const payoutRate = (payoutU ? channel?.payoutFeeRateU : channel?.payoutFeeRate) || 0;

  const handleCategoryChange = (id?: number) => {
    setCategoryId(id);
    const next = categories.find((item) => item.id === id);
    const nextPrice = next ? Number(next.price) || 0 : null;
    setUpstreamPrice(nextPrice);
    setTip(Number(next?.tipAmount) || DEFAULT_TIP);
    setBaseUpstreamPrice(nextPrice);
  };

  const handleProductChange = (id?: number) => {
    setProductId(id);
    const next = products.find((item) => item.id === id);
    const nextPrice = next ? (next.score || 0) / POINTS_PER_RMB : null;
    setDownstreamPrice(nextPrice);
    setBaseDownstreamPrice(nextPrice);
  };

  const giftRate = (giftPercent || 0) / 100;
  const ready = !!channel && upstreamPrice != null && downstreamPrice != null;

  /** 现价算一遍、原价算一遍；没选商品的一侧原价按现价算，变化只反映手动改价 */
  const calc = useMemo(() => {
    if (!ready) {
      return null;
    }
    const up = upstreamPrice ?? 0;
    const tipValue = tip ?? 0;
    const down = downstreamPrice ?? 0;
    return {
      current: computeProfit(up, tipValue, down, collectRate, payoutRate, giftRate),
      base: computeProfit(
        baseUpstreamPrice ?? up,
        tipValue,
        baseDownstreamPrice ?? down,
        collectRate,
        payoutRate,
        giftRate,
      ),
    };
  }, [ready, upstreamPrice, tip, downstreamPrice, baseUpstreamPrice, baseDownstreamPrice, collectRate, payoutRate, giftRate]);
  const hasBase = baseUpstreamPrice != null || baseDownstreamPrice != null;

  const unitLabel = "RMB";
  const qty = quantity || 0;

  const rows: CalcRow[] = calc
    ? (() => {
        const { current: c, base: b } = calc;
        return [
          { key: "up", label: "上游价格", unit: c.up, base: b.up },
          { key: "tip", label: "− 小费", unit: -c.tipValue, base: -b.tipValue },
          { key: "collect", label: "− 入账手续费", unit: -c.collectFee, base: -b.collectFee, note: `上游价格 × ${percent(collectRate)}` },
          { key: "collect-net", label: "实际入账", unit: c.collectNet, base: b.collectNet, total: true, note: "上游价格 − 小费 − 入账手续费" },
          { key: "down", label: "− 下游价格", unit: -c.down, base: -b.down },
          { key: "payout", label: "− 代出手续费", unit: -c.payoutFee, base: -b.payoutFee, note: `下游价格 × ${percent(payoutRate)}` },
          { key: "gift", label: "− 上游赠送", unit: -c.gift, base: -b.gift, note: `上游价格 × ${percent(giftRate)}` },
          { key: "profit", label: "利润", unit: c.profit, base: b.profit, total: true },
        ];
      })()
    : [];

  const columns: ColumnsType<CalcRow> = [
    {
      title: "项目",
      dataIndex: "label",
      width: 160,
      render: (value: string, row) => (
        <span className="recon-row-name">
          {value}
          {row.note ? <div className="recon-subcard-caption">{row.note}</div> : null}
        </span>
      ),
    },
    {
      title: `原价 ${unitLabel}`,
      dataIndex: "base",
      width: 120,
      align: "right",
      render: (value: number) => <PriceCell value={value} />,
    },
    {
      title: `现价 ${unitLabel}`,
      dataIndex: "unit",
      width: 120,
      align: "right",
      render: (value: number) => <PriceCell value={value} />,
    },
    {
      title: "变化",
      key: "delta",
      width: 120,
      align: "right",
      render: (_, row) => <DeltaCell value={row.unit - row.base} />,
    },
  ];

  const profitRate = calc && calc.current.up ? calc.current.profit / calc.current.up : null;
  const baseProfitRate = calc && calc.base.up ? calc.base.profit / calc.base.up : null;
  const profitDelta = calc ? calc.current.profit - calc.base.profit : 0;

  const formulas = [
    { label: "入账手续费", expression: "上游价格 × 代收手续费率" },
    { label: "实际入账", expression: "上游价格 − 小费 − 入账手续费" },
    { label: "代出手续费", expression: "下游价格 × 代付手续费率" },
    { label: "上游赠送", expression: "上游价格 × 上游赠送比例" },
    { label: "利润", expression: "实际入账 − 下游价格 − 代出手续费 − 上游赠送" },
    { label: "下游价格", expression: `人工商品积分 ÷ ${POINTS_PER_RMB}（RMB）` },
    { label: "结算方式", expression: "社区入账选 U / RMB 决定代收费率，人工出账选 U / RMB 决定代付费率；金额都按 RMB 算" },
  ];

  return (
    <div className="manager-page-stack recon-page">
      <section className="manager-data-card recon-card">
        <SectionHead
          title="利润试算"
          caption="选结算通道带出代收 / 代付费率，选上下游商品带出价格；价格可手动改，只做试算不保存"
          extra={
            <Tooltip title="重新加载结算通道和商品">
              <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
                刷新
              </Button>
            </Tooltip>
          }
        />

        {error ? (
          <Alert
            type="error"
            showIcon
            message={error}
            action={
              <Button size="small" onClick={() => void load()}>
                重试
              </Button>
            }
          />
        ) : null}

        <div className="recon-dimension-grid">
          <div className="recon-subcard">
            <div className="recon-subcard-head">
              <span className="recon-subcard-title">试算参数</span>
              <span className="recon-subcard-caption">金额均按 RMB 填写</span>
            </div>
            <div className="recon-stack" style={{ padding: 14 }}>
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="结算通道">
                  <Select
                    style={{ width: "100%" }}
                    placeholder="选择结算通道"
                    loading={loading}
                    value={channelId}
                    onChange={setChannelId}
                    showSearch
                    optionFilterProp="label"
                    options={channels.map((item) => ({
                      value: item.id,
                      label: `${item.name}${item.defaultChannel ? "（默认）" : ""}${item.enabled ? "" : "（已停用）"}`,
                    }))}
                  />
                  {channel ? (
                    <div className="recon-subcard-caption" style={{ marginTop: 6 }}>
                      RMB 代收 {percent(channel.collectFeeRate)} · 代付 {percent(channel.payoutFeeRate)}
                      <br />U 代收 {percent(channel.collectFeeRateU)} · 代付 {percent(channel.payoutFeeRateU)}
                    </div>
                  ) : null}
                </Descriptions.Item>
                <Descriptions.Item label="社区入账">
                  <Radio.Group
                    optionType="button"
                    value={collectCurrency}
                    onChange={(event) => setCollectCurrency(event.target.value)}
                    options={feeCurrencyOptions}
                  />
                  {channel ? (
                    <div className="recon-subcard-caption" style={{ marginTop: 6 }}>
                      代收手续费率 {percent(collectRate)}
                    </div>
                  ) : null}
                </Descriptions.Item>
                <Descriptions.Item label="人工出账">
                  <Radio.Group
                    optionType="button"
                    value={payoutCurrency}
                    onChange={(event) => setPayoutCurrency(event.target.value)}
                    options={feeCurrencyOptions}
                  />
                  {channel ? (
                    <div className="recon-subcard-caption" style={{ marginTop: 6 }}>
                      代付手续费率 {percent(payoutRate)}
                    </div>
                  ) : null}
                </Descriptions.Item>
                <Descriptions.Item label="上游商品">
                  <Select
                    style={{ width: "100%" }}
                    placeholder="选择上游商品类目，带出价格 / 小费"
                    allowClear
                    loading={loading}
                    value={categoryId}
                    onChange={handleCategoryChange}
                    showSearch
                    optionFilterProp="label"
                    options={categories.map((item) => ({
                      value: item.id,
                      label: `${item.name} · ￥${price(Number(item.price) || 0)}`,
                    }))}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="上游价格">
                  <InputNumber style={{ width: "100%" }} min={0} addonAfter="RMB" value={upstreamPrice} onChange={setUpstreamPrice} />
                  <PriceChangeHint base={baseUpstreamPrice} current={upstreamPrice} />
                </Descriptions.Item>
                <Descriptions.Item label="小费">
                  <InputNumber style={{ width: "100%" }} min={0} addonAfter="RMB" value={tip} onChange={setTip} />
                </Descriptions.Item>
                <Descriptions.Item label="上游赠送比例">
                  <InputNumber
                    style={{ width: "100%" }}
                    min={0}
                    max={100}
                    addonAfter="%"
                    value={giftPercent}
                    onChange={setGiftPercent}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="下游商品">
                  <Select
                    style={{ width: "100%" }}
                    placeholder="选择人工商品，按积分带出价格"
                    allowClear
                    loading={loading}
                    value={productId}
                    onChange={handleProductChange}
                    showSearch
                    optionFilterProp="label"
                    options={products.map((item) => ({
                      value: item.id,
                      label: `${item.name} · ${item.score} 积分`,
                    }))}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="下游价格">
                  <InputNumber
                    style={{ width: "100%" }}
                    min={0}
                    addonAfter="RMB"
                    value={downstreamPrice}
                    onChange={setDownstreamPrice}
                  />
                  <PriceChangeHint base={baseDownstreamPrice} current={downstreamPrice} />
                </Descriptions.Item>
                <Descriptions.Item label="数量">
                  <InputNumber style={{ width: "100%" }} min={0} precision={0} value={quantity} onChange={setQuantity} />
                </Descriptions.Item>
              </Descriptions>
            </div>
          </div>

          <div className="recon-subcard">
            <div className="recon-subcard-head">
              <span className="recon-subcard-title">试算结果</span>
              <span className="recon-subcard-caption">
                {channel
                  ? `${channel.name} · 入账按 ${collectU ? "U" : "RMB"} · 出账按 ${payoutU ? "U" : "RMB"} · 金额 RMB${hasBase ? " · 原价 = 所选商品价格" : " · 未选商品，原价同现价"}`
                  : "先选结算通道"}
              </span>
            </div>
            {!ready ? (
              <div style={{ padding: 14 }}>
                <Text type="secondary">
                  选择结算通道、上游商品和下游商品（或直接填写价格）后显示利润
                </Text>
              </div>
            ) : (
              <>
                <Table<CalcRow>
                  className="recon-table"
                  rowKey="key"
                  size="small"
                  columns={columns}
                  dataSource={rows}
                  pagination={false}
                  scroll={{ x: 460 }}
                  rowClassName={(row) => (row.total ? "recon-row-total" : "")}
                />
                <div className="recon-calc-strip" style={{ margin: 14 }}>
                  <div className="recon-calc-strip-title">单件利润</div>
                  <div className="recon-calc-grid">
                    <div className="recon-calc-item">
                      <span className="recon-calc-label">
                        <span className="recon-calc-label-title">实际入账（扣入账手续费后）</span>
                        <span className="recon-calc-label-sub">原价 {price(calc?.base.collectNet ?? 0)}</span>
                      </span>
                      <span className="recon-calc-value">
                        <PriceCell value={calc?.current.collectNet ?? 0} />
                        <em className="recon-calc-unit">{unitLabel}</em>
                      </span>
                    </div>
                    <div className="recon-calc-item recon-calc-item--highlight">
                      <span className="recon-calc-label">
                        <span className="recon-calc-label-title">利润</span>
                        <span className="recon-calc-label-sub">
                          原价 {price(calc?.base.profit ?? 0)} → 现价 {price(calc?.current.profit ?? 0)}，变化{" "}
                          <DeltaCell value={profitDelta} />
                        </span>
                      </span>
                      <span className="recon-calc-value">
                        <PriceCell value={calc?.current.profit ?? 0} />
                        <em className="recon-calc-unit">{unitLabel}</em>
                      </span>
                    </div>
                    <div className="recon-calc-item">
                      <span className="recon-calc-label">
                        <span className="recon-calc-label-title">利润率（÷ 上游价格）</span>
                        {profitRate != null && baseProfitRate != null ? (
                          <span className="recon-calc-label-sub">
                            原价 {(baseProfitRate * 100).toFixed(2)}% → 现价 {(profitRate * 100).toFixed(2)}%，变化{" "}
                            <span
                              className={
                                Math.abs(profitRate - baseProfitRate) < EPSILON
                                  ? "recon-amount"
                                  : profitRate > baseProfitRate
                                    ? "recon-amount recon-amount--profit"
                                    : "recon-amount recon-amount--negative"
                              }
                            >
                              {signedPoints(profitRate - baseProfitRate)} 个百分点
                            </span>
                          </span>
                        ) : null}
                      </span>
                      <span className="recon-calc-value">
                        {profitRate == null ? (
                          "-"
                        ) : (
                          <Tag color={profitRate < 0 ? "red" : "green"}>{`${(profitRate * 100).toFixed(2)}%`}</Tag>
                        )}
                      </span>
                    </div>
                    <div className="recon-calc-item">
                      <span className="recon-calc-label">
                        <span className="recon-calc-label-title">合计利润（× {qty}）</span>
                        <span className="recon-calc-label-sub">
                          原价 {price((calc?.base.profit ?? 0) * qty)}，变化 <DeltaCell value={profitDelta * qty} />
                        </span>
                      </span>
                      <span className="recon-calc-value">
                        <PriceCell value={(calc?.current.profit ?? 0) * qty} />
                        <em className="recon-calc-unit">{unitLabel}</em>
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <FormulaGrid items={formulas} />
      </section>
    </div>
  );
}
