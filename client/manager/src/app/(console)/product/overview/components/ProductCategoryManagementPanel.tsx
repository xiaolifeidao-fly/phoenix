"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Button, Drawer, Form, Input, InputNumber, Popconfirm, Segmented, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import { message } from "@/utils/notify";
import type { ColumnsType } from "antd/es/table";
import { WorkspaceDrawer } from "@/components/manager-shell/WorkspaceDrawer";
import {
  fetchBarryProductCategories,
  fetchProducts,
  type BarryProductCategoryRecord,
  type ShopCategoryChangeRecord,
  type ShopCategoryPayload,
  type ShopCategoryRecord,
  type ShopRecord,
} from "../../api/product.api";
import { useProductCategoryManagement } from "../../hooks/useProductCategoryManagement";
import { CategoryPriceHistoryDrawer } from "./CategoryPriceHistoryDrawer";
import { RATIO_MAX, RATIO_PATTERN, amountFromRatio, exactRatioOf, type CategoryAmountMode } from "./categoryAmount";

const { Text } = Typography;

interface CategoryFormValues {
  shopId: number;
  name: string;
  categoryCode?: string;
  secretKey?: string;
  lowerLimit: number;
  upperLimit: number;
  price: string;
  rebateAmount?: string;
  tipAmount?: string;
  /** 返点默认按价格比例，小费默认直接输入金额 */
  rebateMode: CategoryAmountMode;
  rebateRatio?: string;
  tipMode: CategoryAmountMode;
  tipRatio?: string;
}

type AmountKind = "rebate" | "tip";

const amountFieldMeta: Record<AmountKind, { label: string; amount: "rebateAmount" | "tipAmount"; mode: "rebateMode" | "tipMode"; ratio: "rebateRatio" | "tipRatio" }> = {
  rebate: { label: "返点金额", amount: "rebateAmount", mode: "rebateMode", ratio: "rebateRatio" },
  tip: { label: "小费金额", amount: "tipAmount", mode: "tipMode", ratio: "tipRatio" },
};

/** 编辑时：金额能精确换成不超过上限的比例才按比例回显，否则退回按金额，避免没改动也把金额改掉 */
function editableRatio(price: string, amount?: string) {
  const ratio = exactRatioOf(price, amount);
  return ratio !== null && Number(ratio) <= RATIO_MAX ? ratio : null;
}

/** 非负金额，最多 8 位小数，和后端 decimal(38,8) 一致；留空按 0 保存。 */
const AMOUNT_PATTERN = /^\d+(\.\d{1,8})?$/;

const categoryStatusFilterOptions = [
  { label: "上架", value: "ACTIVE" },
  { label: "下架", value: "EXPIRE" },
];

export function ProductCategoryManagementPanel() {
  const [form] = Form.useForm<CategoryFormValues>();
  const formPrice = Form.useWatch("price", form);
  const formValues = {
    rebateMode: Form.useWatch("rebateMode", form),
    rebateRatio: Form.useWatch("rebateRatio", form),
    tipMode: Form.useWatch("tipMode", form),
    tipRatio: Form.useWatch("tipRatio", form),
  };
  const {
    categories,
    changes,
    total,
    query,
    loading,
    submitting,
    historyLoading,
    refresh,
    saveCategory,
    removeCategory,
    toggleCategoryStatus,
    loadChanges,
    setChanges,
  } = useProductCategoryManagement();
  const [products, setProducts] = useState<ShopRecord[]>([]);
  const [manualProducts, setManualProducts] = useState<BarryProductCategoryRecord[]>([]);
  const [filters, setFilters] = useState({ shopId: 0, name: "", status: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [allHistoryOpen, setAllHistoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ShopCategoryRecord | null>(null);
  const [activeHistoryCategory, setActiveHistoryCategory] = useState<ShopCategoryRecord | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const result = await fetchProducts({ pageIndex: 1, pageSize: 200 });
        setProducts(result.data);
      } catch {
        setProducts([]);
      }
    };
    void loadProducts();
  }, []);

  useEffect(() => {
    const loadManualProducts = async () => {
      try {
        const result = await fetchBarryProductCategories();
        setManualProducts(result);
      } catch {
        setManualProducts([]);
      }
    };
    void loadManualProducts();
  }, []);

  const productNameMap = useMemo(
    () => new Map(products.map((item) => [item.id, item.name || item.code || `商品#${item.id}`])),
    [products],
  );

  const manualProductOptions = useMemo(
    () =>
      manualProducts
        .filter((item) => item.code?.trim())
        .map((item) => ({
          label: item.name?.trim() ? `${item.name.trim()} (${item.code.trim()})` : item.code.trim(),
          value: item.code.trim(),
        })),
    [manualProducts],
  );

  const stats = useMemo(
    () => [
      { label: "类目总数", value: total },
      { label: "激活类目", value: categories.filter((item) => resolveStatus(item.status) === "ACTIVE").length },
      { label: "已记录调价", value: changes.length },
    ],
    [categories, changes.length, total],
  );

  const openCreateModal = () => {
    setEditingCategory(null);
    form.setFieldsValue({
      shopId: products[0]?.id ?? 0,
      name: "",
      categoryCode: "",
      secretKey: "",
      lowerLimit: 0,
      upperLimit: 0,
      price: "",
      rebateAmount: "",
      tipAmount: "",
      rebateMode: "ratio",
      rebateRatio: "",
      tipMode: "amount",
      tipRatio: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (record: ShopCategoryRecord) => {
    setEditingCategory(record);
    const matchedManualProduct = manualProducts.find((item) => item.code === record.barryShopCategoryCode);
    const rebateRatio = editableRatio(record.price, record.rebateAmount);
    const tipRatio = editableRatio(record.price, record.tipAmount);
    form.setFieldsValue({
      shopId: record.shopId,
      name: record.name,
      categoryCode: matchedManualProduct?.code || record.barryShopCategoryCode,
      secretKey: record.secretKey,
      lowerLimit: record.lowerLimit,
      upperLimit: record.upperLimit,
      price: record.price,
      rebateAmount: trimAmount(record.rebateAmount),
      tipAmount: trimAmount(record.tipAmount),
      rebateMode: rebateRatio !== null ? "ratio" : "amount",
      rebateRatio: rebateRatio && rebateRatio !== "0" ? rebateRatio : "",
      tipMode: "amount",
      tipRatio: tipRatio && tipRatio !== "0" ? tipRatio : "",
    });
    setModalOpen(true);
  };

  const openHistoryModal = async (record: ShopCategoryRecord) => {
    setActiveHistoryCategory(record);
    setHistoryOpen(true);
    try {
      await loadChanges(record.id);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载价格历史失败");
    }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const resolveAmount = (kind: AmountKind) => {
      const meta = amountFieldMeta[kind];
      if (values[meta.mode] === "ratio") {
        return amountFromRatio(values.price, values[meta.ratio]) ?? "0";
      }
      return values[meta.amount]?.trim() || "0";
    };
    const payload: ShopCategoryPayload = {
      shopId: Number(values.shopId || 0),
      name: values.name.trim(),
      barryShopCategoryCode: values.categoryCode?.trim() || "",
      secretKey: values.secretKey?.trim() || "",
      lowerLimit: Number(values.lowerLimit || 0),
      upperLimit: Number(values.upperLimit || 0),
      price: values.price.trim(),
      rebateAmount: resolveAmount("rebate"),
      tipAmount: resolveAmount("tip"),
    };
    if (!editingCategory) {
      payload.status = "ACTIVE";
    }
    try {
      await saveCategory(editingCategory?.id ?? null, payload);
      message.success(editingCategory ? "类目已更新" : "类目已创建");
      setModalOpen(false);
      setEditingCategory(null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存类目失败");
    }
  };

  /** 切换输入方式时把当前值带过去：比例 → 金额带出换算结果；金额 → 比例在能精确换算时带出 */
  const switchAmountMode = (kind: AmountKind, mode: CategoryAmountMode) => {
    const meta = amountFieldMeta[kind];
    const price = form.getFieldValue("price") as string | undefined;
    if (mode === "amount") {
      const computed = amountFromRatio(price, form.getFieldValue(meta.ratio));
      if (computed !== null) {
        form.setFieldValue(meta.amount, computed === "0" ? "" : computed);
      }
    } else {
      const ratio = editableRatio(price ?? "", form.getFieldValue(meta.amount));
      if (ratio !== null) {
        form.setFieldValue(meta.ratio, ratio === "0" ? "" : ratio);
      }
    }
    form.setFieldValue(meta.mode, mode);
  };

  const renderAmountField = (kind: AmountKind) => {
    const meta = amountFieldMeta[kind];
    const mode = formValues[meta.mode] ?? (kind === "rebate" ? "ratio" : "amount");
    const computed = mode === "ratio" ? amountFromRatio(formPrice, formValues[meta.ratio]) : null;
    return (
      <Form.Item
        label={
          <Space size={8}>
            <span>{meta.label}</span>
            <Form.Item name={meta.mode} noStyle>
              <Segmented<CategoryAmountMode>
                size="small"
                options={[
                  { label: "按价格比例", value: "ratio" },
                  { label: "按金额", value: "amount" },
                ]}
                onChange={(value) => switchAmountMode(kind, value)}
              />
            </Form.Item>
          </Space>
        }
        required={false}
        style={{ marginBottom: 0 }}
      >
        {mode === "ratio" ? (
          <Form.Item
            name={meta.ratio}
            dependencies={["price"]}
            extra={
              computed !== null
                ? `${meta.label} = 价格 ￥${trimAmount(formPrice) || "0"} × ${formValues[meta.ratio]?.trim() || "0"}% = ￥${computed}，保存的是换算后的金额`
                : "先填写正确的价格，才能按比例换算金额"
            }
            rules={[
              { pattern: RATIO_PATTERN, message: "请输入不小于 0 的比例，最多 4 位小数" },
              {
                validator: (_, value?: string) =>
                  value && Number(value) > RATIO_MAX
                    ? Promise.reject(new Error(`比例不能超过 ${RATIO_MAX}%`))
                    : amountFromRatio(form.getFieldValue("price"), value) === null
                      ? Promise.reject(new Error("价格格式不正确，无法按比例换算"))
                      : Promise.resolve(),
              },
            ]}
          >
            <Input
              placeholder="留空为 0"
              suffix="%"
              addonAfter={
                <span style={{ display: "inline-block", minWidth: 120, textAlign: "left" }}>
                  {meta.label.replace("金额", "")}：
                  <span style={{ fontWeight: 600, color: "var(--manager-text)" }}>
                    {computed !== null ? `￥${computed}` : "—"}
                  </span>
                </span>
              }
            />
          </Form.Item>
        ) : (
          <Form.Item
            name={meta.amount}
            extra={kind === "rebate" ? "直接输入金额，不随价格变化" : undefined}
            rules={[{ pattern: AMOUNT_PATTERN, message: "请输入不小于 0 的金额，最多 8 位小数" }]}
          >
            <Input placeholder="留空为 0" prefix="￥" />
          </Form.Item>
        )}
      </Form.Item>
    );
  };

  const categoryColumns: ColumnsType<ShopCategoryRecord> = [
    { title: "ID", dataIndex: "id", width: 80 },
    {
      title: "商品",
      dataIndex: "shopId",
      width: 160,
      render: (value: number) => productNameMap.get(value) || `商品#${value}`,
    },
    {
      title: "类目名称",
      dataIndex: "name",
      width: 200,
      render: (value: string) => <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>{value || "-"}</Text>,
    },
    {
      title: "人工商品编码",
      dataIndex: "barryShopCategoryCode",
      width: 180,
      render: (value: string) => value || "-",
    },
    {
      title: "价格",
      dataIndex: "price",
      width: 120,
      render: (value: string) => <span style={{ fontWeight: 600 }}>￥{value || "0.00000000"}</span>,
    },
    {
      title: "返点金额",
      dataIndex: "rebateAmount",
      width: 140,
      render: (value: string | undefined, record) => <CategoryAmountCell amount={value} price={record.price} />,
    },
    {
      title: "小费金额",
      dataIndex: "tipAmount",
      width: 140,
      render: (value: string | undefined, record) => <CategoryAmountCell amount={value} price={record.price} />,
    },
    {
      title: "下限 / 上限",
      key: "limitRange",
      width: 160,
      render: (_, record) => `${record.lowerLimit} / ${record.upperLimit}`,
    },
    {
      title: "密钥",
      dataIndex: "secretKey",
      width: 220,
      render: (value: string) => wrapText(value),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (value: string) => (
        <Tag color={resolveStatus(value) === "ACTIVE" ? "green" : "default"}>
          {resolveStatus(value) === "ACTIVE" ? "激活" : "冻结"}
        </Tag>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updatedTime",
      width: 180,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 208,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="编辑类目">
            <Button type="text" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          </Tooltip>
          {resolveStatus(record.status) === "ACTIVE" ? (
            <Tooltip title="下架类目">
              <Button
                type="text"
                icon={<ArrowDownOutlined />}
                onClick={async () => {
                  try {
                    await toggleCategoryStatus(record.id, "EXPIRE");
                    message.success("类目已下架");
                  } catch (error) {
                    message.error(error instanceof Error ? error.message : "类目下架失败");
                  }
                }}
              />
            </Tooltip>
          ) : (
            <Tooltip title="上架类目">
              <Button
                type="text"
                icon={<ArrowUpOutlined />}
                onClick={async () => {
                  try {
                    await toggleCategoryStatus(record.id, "ACTIVE");
                    message.success("类目已上架");
                  } catch (error) {
                    message.error(error instanceof Error ? error.message : "类目上架失败");
                  }
                }}
              />
            </Tooltip>
          )}
          <Tooltip title="查看调价历史">
            <Button type="text" icon={<HistoryOutlined />} onClick={() => void openHistoryModal(record)} />
          </Tooltip>
          <Tooltip title="删除类目">
            <Popconfirm
              title="确认删除这个类目吗？"
              okText="删除"
              cancelText="取消"
              onConfirm={async () => {
                try {
                  await removeCategory(record.id);
                  message.success("类目已删除");
                } catch (error) {
                  message.error(error instanceof Error ? error.message : "删除类目失败");
                }
              }}
            >
              <Button danger type="text" icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const historyColumns: ColumnsType<ShopCategoryChangeRecord> = [
    {
      title: "时间",
      dataIndex: "createdTime",
      width: 180,
      render: (value?: string) => formatDateTime(value),
    },
    { title: "旧价格", dataIndex: "oldPrice", width: 120 },
    { title: "新价格", dataIndex: "newPrice", width: 120 },
    {
      title: "旧区间",
      key: "oldRange",
      width: 140,
      render: (_, record) => `${record.oldLowerLimit} / ${record.oldUpperLimit}`,
    },
    {
      title: "新区间",
      key: "newRange",
      width: 140,
      render: (_, record) => `${record.newLowerLimit} / ${record.newUpperLimit}`,
    },
  ];

  return (
    <div className="manager-page-stack">
      <section className="manager-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {stats.map((item) => (
          <div key={item.label} className="manager-data-card">
            <div className="manager-section-label">{item.label}</div>
            <div className="manager-display-title" style={{ fontSize: 32, marginTop: 12 }}>
              {item.value}
            </div>
          </div>
        ))}
      </section>

      <section className="manager-data-card manager-toolbar-panel">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <Space wrap size={12}>
            <Select
              allowClear
              placeholder="按商品筛选"
              value={filters.shopId || undefined}
              onChange={(value) => setFilters((current) => ({ ...current, shopId: Number(value ?? 0) }))}
              style={{ width: 220 }}
              options={products.map((item) => ({
                label: item.name || item.code,
                value: item.id,
              }))}
            />
            <Input
              placeholder="按类目名称筛选"
              value={filters.name}
              onChange={(event) => setFilters((current) => ({ ...current, name: event.target.value }))}
              style={{ width: 220, height: 44 }}
            />
            <Select
              allowClear
              placeholder="按状态筛选"
              value={filters.status || undefined}
              onChange={(value) => setFilters((current) => ({ ...current, status: String(value ?? "") }))}
              style={{ width: 160 }}
              options={categoryStatusFilterOptions}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => void refresh({ pageIndex: 1, shopId: filters.shopId, name: filters.name, status: filters.status })}
            >
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void refresh()}>
              刷新
            </Button>
          </Space>

          <Space wrap>
            <Tag style={{ color: "var(--manager-text-soft)", background: "rgba(170,192,238,0.16)", border: "none" }}>
              共 {total} 条
            </Tag>
            <Button icon={<HistoryOutlined />} onClick={() => setAllHistoryOpen(true)}>
              调价历史
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新建类目
            </Button>
          </Space>
        </div>
      </section>

      <section className="manager-data-card manager-table">
        <Table<ShopCategoryRecord>
          rowKey="id"
          loading={loading}
          dataSource={categories}
          columns={categoryColumns}
          scroll={{ x: 1880 }}
          pagination={{
            current: query.pageIndex,
            pageSize: query.pageSize,
            total,
            showSizeChanger: false,
            onChange: (page) =>
              void refresh({
                pageIndex: page,
                shopId: filters.shopId,
                name: filters.name,
                status: filters.status,
              }),
          }}
        />
      </section>

      <WorkspaceDrawer
        title={editingCategory ? "编辑商品类目" : "新建商品类目"}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingCategory(null);
        }}
        onSubmit={handleSubmit}
        okText={editingCategory ? "保存类目" : "创建类目"}
        submitting={submitting}
        width={600}
      >
        <Form<CategoryFormValues> className="manager-form-skin" form={form} layout="vertical" preserve={false}>
          <Form.Item name="shopId" label="所属商品" rules={[{ required: true, message: "请选择商品" }]}>
            <Select
              placeholder="请选择商品"
              options={products.map((item) => ({
                label: item.name || item.code,
                value: item.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="name" label="类目名称" rules={[{ required: true, message: "请输入类目名称" }]}>
            <Input placeholder="例如：快速点赞" />
          </Form.Item>
          <Form.Item name="categoryCode" label="人工商品列表">
            <Select
              allowClear
              showSearch
              placeholder="请选择人工商品"
              optionFilterProp="label"
              options={manualProductOptions}
              notFoundContent="接口暂无人工商品数据"
            />
          </Form.Item>
          <Form.Item name="secretKey" label="密钥">
            <Input placeholder="请输入密钥" />
          </Form.Item>
          <Form.Item name="price" label="价格" rules={[{ required: true, message: "请输入价格" }]}>
            <Input placeholder="例如：0.012" />
          </Form.Item>
          {renderAmountField("rebate")}
          {renderAmountField("tip")}
          <Space style={{ width: "100%" }} size={12}>
            <Form.Item name="lowerLimit" label="下限" style={{ flex: 1 }} initialValue={0}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="upperLimit" label="上限" style={{ flex: 1 }} initialValue={0}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </Space>
        </Form>
      </WorkspaceDrawer>

      <Drawer
        className="manager-workspace-drawer"
        title={`调价历史${activeHistoryCategory ? ` · ${activeHistoryCategory.name}` : ""}`}
        open={historyOpen}
        width={860}
        footer={null}
        onClose={() => {
          setHistoryOpen(false);
          setActiveHistoryCategory(null);
          setChanges([]);
        }}
      >
        <Table<ShopCategoryChangeRecord>
          rowKey="id"
          loading={historyLoading}
          dataSource={changes}
          columns={historyColumns}
          pagination={false}
          locale={{ emptyText: "当前类目还没有价格变更记录" }}
          scroll={{ x: 700 }}
        />
      </Drawer>

      <CategoryPriceHistoryDrawer open={allHistoryOpen} onClose={() => setAllHistoryOpen(false)} products={products} />
    </div>
  );
}

/** 金额 + 占价格的比例（能精确换算时显示） */
function CategoryAmountCell({ amount, price }: { amount?: string; price: string }) {
  const text = trimAmount(amount) || "0";
  const ratio = text === "0" ? null : exactRatioOf(price, text);
  return (
    <span>
      ￥{text}
      {ratio !== null ? <div style={{ fontSize: 12, color: "var(--manager-text-soft)" }}>价格的 {ratio}%</div> : null}
    </span>
  );
}

function resolveStatus(value?: string) {
  return value?.trim().toUpperCase() === "EXPIRE" ? "EXPIRE" : "ACTIVE";
}

/** "1.50000000" → "1.5"，去掉 decimal(38,8) 补的尾零。 */
function trimAmount(value?: string) {
  if (!value) {
    return "";
  }
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("zh-CN", { hour12: false });
}

function wrapText(value?: string) {
  if (!value) {
    return "-";
  }
  return (
    <div style={{ whiteSpace: "normal", wordBreak: "break-all", color: "var(--manager-text-soft)" }}>
      {value}
    </div>
  );
}
