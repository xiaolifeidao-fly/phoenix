"use client";

import { useState } from "react";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import {
  Button,
  Input,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { type TenantPayload, type TenantRecord } from "../api/tenant.api";
import { TenantBindingModal } from "./TenantBindingModal";
import { TenantFormModal } from "./TenantFormModal";
import { useTenantManagement } from "../hooks/useTenantManagement";

const { Text } = Typography;

export function TenantManagementPanel() {
  const { tenants, total, query, loading, submitting, refresh, saveTenant, removeTenant } =
    useTenantManagement();
  const [filters, setFilters] = useState({ name: "", code: "" });
  const [formOpen, setFormOpen] = useState(false);
  const [bindingOpen, setBindingOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantRecord | null>(null);
  const [bindingTenant, setBindingTenant] = useState<TenantRecord | null>(null);

  const columns: ColumnsType<TenantRecord> = [
    {
      title: "租户名称",
      dataIndex: "name",
      width: 200,
      render: (value: string) => (
        <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>{value || "-"}</Text>
      ),
    },
    {
      title: "租户编码",
      dataIndex: "code",
      width: 180,
      render: (value: string) => <span className="manager-value">{value || "-"}</span>,
    },
    {
      title: "当前类目",
      key: "currentCategories",
      render: (_, record) => {
        if (!record.currentCategories?.length) {
          return <Text style={{ color: "var(--manager-text-faint)" }}>未绑定</Text>;
        }
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {record.currentCategories.map((item) => (
              <Tag key={item.id || item.shopCategoryId} color="blue">
                {item.shopCategoryName || `类目#${item.shopCategoryId}`}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: "操作",
      key: "actions",
      width: 160,
      render: (_, record) => (
        <Space size={8}>
          <Tooltip title="Categories">
            <Button
              type="text"
              aria-label="Edit categories"
              icon={<TagsOutlined style={{ fontSize: 14 }} />}
              onClick={() => {
                setBindingTenant(record);
                setBindingOpen(true);
              }}
              style={{
                color: "#5d7df6",
              }}
            />
          </Tooltip>
          <Tooltip title="修改租户">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingTenant(record);
                setFormOpen(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除这个租户吗？"
            okText="删除"
            cancelText="取消"
            onConfirm={async () => {
              try {
                await removeTenant(record.id);
                message.success("租户已删除");
              } catch (error) {
                message.error(error instanceof Error ? error.message : "删除租户失败");
              }
            }}
          >
            <Button danger type="text" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleSubmit = async (payload: TenantPayload) => {
    try {
      await saveTenant(editingTenant?.id ?? null, payload);
      message.success(editingTenant ? "租户修改成功" : "租户添加成功");
      setFormOpen(false);
      setEditingTenant(null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存租户失败");
    }
  };

  return (
    <div className="manager-page-stack">
      <section className="manager-data-card manager-toolbar-panel">
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <Space wrap size={12}>
            <Input
              className="manager-filter-input"
              prefix={<SearchOutlined style={{ color: "var(--manager-text-faint)" }} />}
              placeholder="租户名称"
              value={filters.name}
              onChange={(event) =>
                setFilters((current) => ({ ...current, name: event.target.value }))
              }
              onPressEnter={() => void refresh({ pageIndex: 1, ...filters })}
              style={{ width: 260, maxWidth: "100%" }}
            />
            <Input
              className="manager-filter-input"
              placeholder="租户编码"
              value={filters.code}
              onChange={(event) =>
                setFilters((current) => ({ ...current, code: event.target.value }))
              }
              onPressEnter={() => void refresh({ pageIndex: 1, ...filters })}
              style={{ width: 220, maxWidth: "100%" }}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => void refresh({ pageIndex: 1, ...filters })}
            >
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void refresh()}>
              刷新
            </Button>
          </Space>

          <Space wrap>
            <Tag
              style={{
                color: "var(--manager-text-soft)",
                background: "rgba(170,192,238,0.16)",
                border: "none",
              }}
            >
              共 {total} 条
            </Tag>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingTenant(null);
                setFormOpen(true);
              }}
              style={{
                color: "#ffffff",
                border: "none",
                background: "linear-gradient(135deg, #5d7df6 0%, #6d8cff 100%)",
              }}
            >
              新增租户
            </Button>
          </Space>
        </div>
      </section>

      <section className="manager-data-card manager-table">
        <Table<TenantRecord>
          rowKey="id"
          loading={loading}
          dataSource={tenants}
          columns={columns}
          scroll={{ x: 1180 }}
          pagination={{
            current: query.pageIndex,
            pageSize: query.pageSize,
            total,
            showSizeChanger: false,
            onChange: (page) => void refresh({ pageIndex: page, ...filters }),
          }}
        />
      </section>

      <TenantFormModal
        open={formOpen}
        submitting={submitting}
        tenant={editingTenant}
        onCancel={() => {
          setFormOpen(false);
          setEditingTenant(null);
        }}
        onSubmit={handleSubmit}
      />

      <TenantBindingModal
        open={bindingOpen}
        tenant={bindingTenant}
        onCancel={() => {
          setBindingOpen(false);
          setBindingTenant(null);
        }}
        onSaved={async () => {
          await refresh();
        }}
      />
    </div>
  );
}
