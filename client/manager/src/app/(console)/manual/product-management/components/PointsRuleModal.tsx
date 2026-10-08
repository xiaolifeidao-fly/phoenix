"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SaveOutlined } from "@ant-design/icons";
import { Button, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { message } from "@/utils/notify";
import { fetchPointsRule, savePointsRule, type EatMode, type ManualProductRecord } from "../../api/product.api";
import {
  fetchBarryUserWhitelists,
  updateBarryUserWhitelistPointsRule,
  type BarryUserWhitelistRecord,
} from "../../api/user.api";

const { Text } = Typography;

const eatModeOptions: { label: string; value: EatMode }[] = [
  { label: "按提交量", value: "SUBMIT_COUNT" },
  { label: "按审核", value: "APPROVE" },
];

/** 未配置审核加积分方式时，barry 按「按审核」处理。 */
const DEFAULT_EAT_MODE: EatMode = "APPROVE";

const eatModeLabel = (mode?: string | null) => eatModeOptions.find((option) => option.value === mode)?.label;

const toPercent = (ratio?: number | null) => (ratio == null ? null : Number((Number(ratio) * 100).toFixed(2)));

const statusFilterOptions = [
  { label: "全部", value: "" },
  { label: "生效", value: "ACTIVE" },
  { label: "已剔除", value: "INACTIVE" },
];

interface PointsRuleModalProps {
  product: ManualProductRecord | null;
  open: boolean;
  onClose: () => void;
}

/**
 * 人工商品 - 积分配置：审核加积分方式（按提交量 / 按审核）+ 吃量比例，两项互不相关。
 * 吃量只在提交任务时按比例执行；加积分方式只决定二次审核失败的单是否加积分。
 *
 * <p>上方是商品全局配置；下方是加过白名单的用户（剔除白名单只改状态，失效用户也在列表里），
 * 可逐个覆盖，两项各自留空取全局值。
 */
export function PointsRuleModal({ product, open, onClose }: PointsRuleModalProps) {
  const shopCategoryId = product?.id ? Number(product.id) : 0;

  const [globalRatio, setGlobalRatio] = useState<number | null>(null);
  const [globalMode, setGlobalMode] = useState<EatMode>(DEFAULT_EAT_MODE);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalSaving, setGlobalSaving] = useState(false);

  const [users, setUsers] = useState<BarryUserWhitelistRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const usersRequestRef = useRef(0);

  const [editing, setEditing] = useState<BarryUserWhitelistRecord | null>(null);
  const [userRatio, setUserRatio] = useState<number | null>(null);
  const [userMode, setUserMode] = useState<EatMode | null>(null);
  const [userSaving, setUserSaving] = useState(false);

  const loadUsers = useCallback(
    async (nextPageIndex: number, nextPageSize: number, nextKeyword: string, nextStatus: string) => {
      if (!shopCategoryId) return;
      const requestId = ++usersRequestRef.current;
      setUsersLoading(true);
      try {
        const page = await fetchBarryUserWhitelists({
          shopCategoryId,
          pageIndex: nextPageIndex,
          pageSize: nextPageSize,
          username: nextKeyword || undefined,
          status: nextStatus || undefined,
        });
        if (requestId !== usersRequestRef.current) return;
        setUsers(Array.isArray(page.data) ? page.data : []);
        setTotal(page.total ?? 0);
        setPageIndex(nextPageIndex);
        setPageSize(nextPageSize);
      } catch (error) {
        if (requestId !== usersRequestRef.current) return;
        message.error(error instanceof Error ? error.message : "加载白名单用户失败");
        setUsers([]);
        setTotal(0);
      } finally {
        if (requestId === usersRequestRef.current) setUsersLoading(false);
      }
    },
    [shopCategoryId],
  );

  useEffect(() => {
    if (!open || !shopCategoryId) return;
    setKeyword("");
    setStatus("");
    setEditing(null);
    setGlobalLoading(true);
    fetchPointsRule(shopCategoryId)
      .then((rule) => {
        setGlobalRatio(toPercent(rule.eatRatio));
        setGlobalMode(rule.eatMode ?? DEFAULT_EAT_MODE);
      })
      .catch((error) => {
        message.error(error instanceof Error ? error.message : "加载积分配置失败");
        setGlobalRatio(null);
        setGlobalMode(DEFAULT_EAT_MODE);
      })
      .finally(() => setGlobalLoading(false));
    void loadUsers(1, 10, "", "");
  }, [open, shopCategoryId, loadUsers]);

  const saveGlobal = async () => {
    setGlobalSaving(true);
    try {
      await savePointsRule(shopCategoryId, {
        eatRatio: globalRatio === null ? null : globalRatio / 100,
        eatMode: globalMode,
      });
      message.success("全局积分配置已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存全局积分配置失败");
    } finally {
      setGlobalSaving(false);
    }
  };

  const openUserEditor = (record: BarryUserWhitelistRecord) => {
    setEditing(record);
    setUserRatio(toPercent(record.eatRatio));
    setUserMode(record.eatMode ?? null);
  };

  const saveUser = async () => {
    if (!editing?.id) return;
    setUserSaving(true);
    try {
      await updateBarryUserWhitelistPointsRule(Number(editing.id), {
        eatRatio: userRatio === null ? null : userRatio / 100,
        eatMode: userMode,
      });
      message.success("用户积分配置已保存");
      setEditing(null);
      await loadUsers(pageIndex, pageSize, keyword.trim(), status);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存用户积分配置失败");
    } finally {
      setUserSaving(false);
    }
  };

  const globalText = `${eatModeLabel(globalMode)} · ${globalRatio === null ? "吃量按系统默认比例" : `吃量 ${globalRatio}%`}`;

  const columns: ColumnsType<BarryUserWhitelistRecord> = [
    { title: "用户ID", dataIndex: "userId", width: 110 },
    { title: "用户名", dataIndex: "username", render: (value: string, record) => value || record.name || "-" },
    { title: "渠道", dataIndex: "channel", width: 100, render: (value: string) => value || "-" },
    {
      title: "白名单状态",
      key: "status",
      width: 110,
      render: (_, record) => {
        const active = record.active !== false && record.status !== "INACTIVE" && record.status !== "EXPIRE";
        return <Tag color={active ? "green" : "default"}>{active ? "生效" : "已剔除"}</Tag>;
      },
    },
    {
      title: "加积分方式",
      key: "eatMode",
      width: 120,
      render: (_, record) => eatModeLabel(record.eatMode) ?? <Text type="secondary">全局</Text>,
    },
    {
      title: "吃量比例",
      key: "eatRatio",
      width: 110,
      render: (_, record) => (record.eatRatio == null ? <Text type="secondary">全局</Text> : `${toPercent(record.eatRatio)}%`),
    },
    {
      title: "操作",
      key: "actions",
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small" disabled={!record.id} onClick={() => openUserEditor(record)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={`积分配置${product ? `：${product.name || product.id}` : ""}`}
        open={open}
        width={880}
        footer={null}
        destroyOnClose
        onCancel={onClose}
      >
        <div style={{ marginBottom: 8, fontWeight: 600 }}>全局配置</div>
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          审核加积分方式：按提交量 = 审核成功和失败都加积分；按审核 = 只有审核成功才加积分。
          <br />
          吃量比例：提交任务时按比例吃量，填 0 表示不吃量，留空按系统默认比例。两项可分别保存。
        </Text>
        <Space size={8} style={{ marginBottom: 24 }}>
          <Select<EatMode>
            loading={globalLoading}
            value={globalMode}
            options={eatModeOptions}
            style={{ width: 140 }}
            onChange={(value) => setGlobalMode(value)}
          />
          <InputNumber
            value={globalRatio}
            min={0}
            max={100}
            precision={2}
            addonAfter="%"
            placeholder="吃量比例"
            style={{ width: 150 }}
            onChange={(value) => setGlobalRatio(value === null ? null : Number(value))}
          />
          <Button type="primary" icon={<SaveOutlined />} loading={globalSaving} disabled={globalLoading} onClick={() => void saveGlobal()}>
            保存
          </Button>
        </Space>

        <div style={{ marginBottom: 8, fontWeight: 600 }}>按用户配置</div>
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          列表为本商品加过白名单的用户（含已剔除）。加积分方式、吃量比例各自留空即取全局值。
        </Text>
        <Space size={8} style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder="按用户名搜索"
            value={keyword}
            style={{ width: 220 }}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={(value) => void loadUsers(1, pageSize, value.trim(), status)}
          />
          <Select
            value={status}
            options={statusFilterOptions}
            style={{ width: 110 }}
            onChange={(value) => {
              setStatus(value);
              void loadUsers(1, pageSize, keyword.trim(), value);
            }}
          />
        </Space>
        <Table<BarryUserWhitelistRecord>
          rowKey={(record) => String(record.id || record.userId)}
          size="small"
          loading={usersLoading}
          columns={columns}
          dataSource={users}
          pagination={{
            current: pageIndex,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (nextPage, nextSize) => void loadUsers(nextPage, nextSize, keyword.trim(), status),
          }}
          locale={{ emptyText: "本商品还没有加过白名单的用户" }}
        />
      </Modal>

      <Modal
        title={`用户积分配置${editing ? `：${editing.username || editing.userId}` : ""}`}
        open={Boolean(editing)}
        zIndex={1200}
        okText="保存"
        cancelText="取消"
        confirmLoading={userSaving}
        onCancel={() => setEditing(null)}
        onOk={() => void saveUser()}
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          每项留空则使用全局配置（当前全局：{globalText}）。
        </Text>
        <Space>
          <Select<EatMode>
            allowClear
            value={userMode ?? undefined}
            options={eatModeOptions}
            placeholder={`全局：${eatModeLabel(globalMode)}`}
            style={{ width: 160 }}
            onChange={(value) => setUserMode(value ?? null)}
          />
          <InputNumber
            value={userRatio}
            min={0}
            max={100}
            precision={2}
            addonAfter="%"
            placeholder={globalRatio === null ? "全局：系统默认" : `全局：${globalRatio}`}
            style={{ width: 170 }}
            onChange={(value) => setUserRatio(value === null ? null : Number(value))}
          />
        </Space>
      </Modal>
    </>
  );
}
