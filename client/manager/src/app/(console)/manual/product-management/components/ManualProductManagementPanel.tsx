"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  activateManualProduct,
  createManualProduct,
  deleteManualProduct,
  expireManualProduct,
  fetchManualProducts,
  fetchManualProductTypes,
  updateManualProduct,
  type ManualProductPayload,
  type ManualProductRecord,
  type ManualProductTypeRecord,
} from "../../api/product.api";

const { Paragraph, Text, Title } = Typography;

interface ProductFormValues {
  name: string;
  code: string;
  score: number;
  shopGroupId: number;
  shopTypeCodes: string[];
}

export function ManualProductManagementPanel() {
  const [form] = Form.useForm<ProductFormValues>();
  const [products, setProducts] = useState<ManualProductRecord[]>([]);
  const [productTypes, setProductTypes] = useState<ManualProductTypeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ManualProductRecord | null>(null);
  const [filters, setFilters] = useState({
    keyword: "",
    status: "",
    shopTypeCode: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [productList, typeList] = await Promise.all([
        fetchManualProducts(),
        fetchManualProductTypes(),
      ]);
      setProducts(sortProducts(productList));
      setProductTypes(typeList);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载人工商品失败");
      setProducts([]);
      setProductTypes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    return products.filter((item) => {
      const matchKeyword =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.code.toLowerCase().includes(keyword);
      const matchStatus = !filters.status || resolveStatus(item.status) === filters.status;
      const matchType =
        !filters.shopTypeCode ||
        (item.shopTypeModelList ?? []).some((type) => type.code === filters.shopTypeCode);
      return matchKeyword && matchStatus && matchType;
    });
  }, [filters, products]);

  const stats = useMemo(
    () => [
      { label: "人工商品总数", value: products.length },
      { label: "启用商品", value: products.filter((item) => resolveStatus(item.status) === "ACTIVE").length },
      { label: "已失效商品", value: products.filter((item) => resolveStatus(item.status) === "EXPIRE").length },
      { label: "关联商品类型", value: productTypes.length },
    ],
    [productTypes.length, products],
  );

  const productTypeOptions = useMemo(
    () =>
      productTypes.map((item) => ({
        label: item.name?.trim() ? `${item.name.trim()} (${item.code.trim()})` : item.code.trim(),
        value: item.code,
      })),
    [productTypes],
  );

  const openCreateModal = () => {
    setEditingProduct(null);
    form.setFieldsValue({
      name: "",
      code: "",
      score: 0,
      shopGroupId: 0,
      shopTypeCodes: [],
    });
    setModalOpen(true);
  };

  const openEditModal = (record: ManualProductRecord) => {
    setEditingProduct(record);
    form.setFieldsValue({
      name: record.name,
      code: record.code,
      score: record.score,
      shopGroupId: record.shopGroupId,
      shopTypeCodes: (record.shopTypeModelList ?? []).map((item) => item.code).filter(Boolean),
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: ManualProductPayload = {
      name: values.name.trim(),
      code: values.code.trim(),
      score: Number(values.score || 0),
      shopGroupId: Number(values.shopGroupId || 0),
      shopTypeCodeList: values.shopTypeCodes ?? [],
      status: editingProduct ? resolveStatus(editingProduct.status) : "ACTIVE",
    };

    setSubmitting(true);
    try {
      if (editingProduct) {
        await updateManualProduct(editingProduct.id, payload);
      } else {
        await createManualProduct(payload);
      }
      message.success(editingProduct ? "人工商品已更新" : "人工商品已创建");
      setModalOpen(false);
      setEditingProduct(null);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存人工商品失败");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<ManualProductRecord> = [
    {
      title: "商品名称",
      dataIndex: "name",
      width: 220,
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>{value || "-"}</Text>
          <Text type="secondary">{record.code || "-"}</Text>
        </Space>
      ),
    },
    {
      title: "积分",
      dataIndex: "score",
      width: 110,
      render: (value: number) => value ?? 0,
    },
    {
      title: "商品组",
      dataIndex: "shopGroupId",
      width: 110,
      render: (value: number) => value || "-",
    },
    {
      title: "商品类型",
      dataIndex: "shopTypeModelList",
      width: 320,
      render: (value?: ManualProductTypeRecord[]) =>
        value && value.length > 0 ? (
          <Space size={[6, 6]} wrap>
            {value.map((item) => (
              <Tag key={`${item.code}-${item.id}`} color="blue">
                {item.name || item.code}
              </Tag>
            ))}
          </Space>
        ) : (
          "-"
        ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (value: string) => (
        <Tag color={resolveStatus(value) === "ACTIVE" ? "green" : "default"}>
          {resolveStatus(value) === "ACTIVE" ? "启用" : "失效"}
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
      width: 210,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          </Tooltip>
          {resolveStatus(record.status) === "ACTIVE" ? (
            <Tooltip title="失效">
              <Button
                type="text"
                icon={<ArrowDownOutlined />}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await expireManualProduct(record.id);
                    message.success("人工商品已失效");
                    await loadData();
                  } catch (error) {
                    message.error(error instanceof Error ? error.message : "人工商品失效失败");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              />
            </Tooltip>
          ) : (
            <Tooltip title="启用">
              <Button
                type="text"
                icon={<ArrowUpOutlined />}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await activateManualProduct(record.id);
                    message.success("人工商品已启用");
                    await loadData();
                  } catch (error) {
                    message.error(error instanceof Error ? error.message : "人工商品启用失败");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="确认删除这个人工商品吗？"
            okText="删除"
            cancelText="取消"
            onConfirm={async () => {
              setSubmitting(true);
              try {
                await deleteManualProduct(record.id);
                message.success("人工商品已删除");
                await loadData();
              } catch (error) {
                message.error(error instanceof Error ? error.message : "删除人工商品失败");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Tooltip title="删除">
              <Button danger type="text" icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="manager-page-stack">
      <section className="manager-shell-card manager-grid-bg" style={{ borderRadius: 30, padding: 28 }}>
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Tag
            bordered={false}
            style={{
              width: "fit-content",
              margin: 0,
              borderRadius: 999,
              paddingInline: 12,
              paddingBlock: 6,
              fontWeight: 700,
              color: "var(--manager-primary-strong)",
              background: "rgba(93, 125, 246, 0.12)",
            }}
          >
            Product Console
          </Tag>
          <div>
            <div className="manager-brand-kicker">Manual Goods</div>
            <Title level={2} className="manager-display-title" style={{ margin: "14px 0 10px" }}>
              人工商品管理
            </Title>
            <Paragraph style={{ maxWidth: 760, margin: 0, color: "var(--manager-text-soft)" }}>
              直接对接 Barry 的人工商品分类接口，支持列表查看、新增、编辑、删除，以及启用和失效状态切换。
            </Paragraph>
          </div>
        </Space>
      </section>

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

      <section className="manager-data-card">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <Space wrap size={12}>
            <Input
              className="manager-filter-input"
              placeholder="搜索名称或编码"
              prefix={<SearchOutlined />}
              value={filters.keyword}
              onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
              style={{ width: 260, maxWidth: "100%", height: 44 }}
            />
            <Select
              allowClear
              placeholder="筛选状态"
              value={filters.status || undefined}
              onChange={(value) => setFilters((current) => ({ ...current, status: value ?? "" }))}
              options={[
                { label: "启用", value: "ACTIVE" },
                { label: "失效", value: "EXPIRE" },
              ]}
              style={{ width: 160 }}
            />
            <Select
              allowClear
              showSearch
              placeholder="筛选商品类型"
              value={filters.shopTypeCode || undefined}
              onChange={(value) => setFilters((current) => ({ ...current, shopTypeCode: value ?? "" }))}
              options={productTypeOptions}
              style={{ width: 240 }}
              optionFilterProp="label"
            />
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadData()}>
              刷新
            </Button>
          </Space>

          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新建人工商品
          </Button>
        </div>
      </section>

      <section className="manager-data-card manager-table">
        <Table<ManualProductRecord>
          rowKey="id"
          loading={loading}
          dataSource={filteredProducts}
          columns={columns}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
          }}
          scroll={{ x: 1240 }}
          locale={{ emptyText: "暂无人工商品数据" }}
        />
      </section>

      <Modal
        title={editingProduct ? "编辑人工商品" : "新建人工商品"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingProduct(null);
        }}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form<ProductFormValues> form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label="商品名称" rules={[{ required: true, message: "请输入商品名称" }]}>
            <Input placeholder="例如：人工点赞" />
          </Form.Item>
          <Form.Item name="code" label="商品编码" rules={[{ required: true, message: "请输入商品编码" }]}>
            <Input placeholder="例如：MANUAL_LIKE" />
          </Form.Item>
          <Space style={{ width: "100%" }} size={12}>
            <Form.Item
              name="score"
              label="积分"
              rules={[{ required: true, message: "请输入积分" }]}
              style={{ flex: 1 }}
              initialValue={0}
            >
              <InputNumber min={0} precision={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              name="shopGroupId"
              label="商品组 ID"
              rules={[{ required: true, message: "请输入商品组 ID" }]}
              style={{ flex: 1 }}
              initialValue={0}
            >
              <InputNumber min={0} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          </Space>
          <Form.Item name="shopTypeCodes" label="商品类型">
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder="请选择关联商品类型"
              options={productTypeOptions}
              optionFilterProp="label"
              onChange={(value: string[]) => {
                if (!value.length) {
                  return;
                }
                const firstType = productTypes.find((item) => item.code === value[0]);
                if (!firstType || !firstType.shopGroupId) {
                  return;
                }
                const currentGroupId = form.getFieldValue("shopGroupId");
                if (!currentGroupId) {
                  form.setFieldValue("shopGroupId", firstType.shopGroupId);
                }
              }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function resolveStatus(value?: string) {
  return value?.trim().toUpperCase() === "EXPIRE" ? "EXPIRE" : "ACTIVE";
}

function sortProducts(products: ManualProductRecord[]) {
  return [...products].sort((left, right) => {
    const leftStatus = resolveStatus(left.status);
    const rightStatus = resolveStatus(right.status);
    if (leftStatus !== rightStatus) {
      return leftStatus === "ACTIVE" ? -1 : 1;
    }
    return right.id - left.id;
  });
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
