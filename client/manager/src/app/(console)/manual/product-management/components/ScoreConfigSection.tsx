"use client";

import { useEffect, useRef, useState } from "react";
import { DeleteOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Checkbox, Empty, Input, InputNumber, Popconfirm, Space, Table, Tabs, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { message } from "@/utils/notify";
import {
  BASE_SCORE_OPTION_ID,
  saveScoreConfig,
  type ScoreConfig,
  type ScoreGroup,
  type ScoreOption,
} from "../../api/product.api";

const { Text } = Typography;

interface OptionRow {
  id: number;
  label: string;
  score: number;
}

/** 原价在前，其余档位按配置顺序；label 用于组内展示。 */
export const listScoreOptions = (options: ScoreOption[], baseScore: number): OptionRow[] => [
  { id: BASE_SCORE_OPTION_ID, label: "原价", score: baseScore },
  ...options.map((option, index) => ({ id: option.id, label: `档位${index + 1}`, score: option.score })),
];

/** 组内各档位的实际概率与期望积分；引用不到的档位不计入，和 barry 取价一致。 */
export const summarizeScoreGroup = (group: ScoreGroup, options: ScoreOption[], baseScore: number) => {
  const scores = new Map(listScoreOptions(options, baseScore).map((option) => [option.id, option.score]));
  const valid = group.items.filter((item) => scores.has(item.optionId) && item.weight > 0);
  const total = valid.reduce((sum, item) => sum + item.weight, 0);
  const parts = valid.map((item) => ({ score: scores.get(item.optionId) ?? 0, ratio: total ? item.weight / total : 0 }));
  const expected = parts.reduce((sum, part) => sum + part.score * part.ratio, 0);
  return {
    expected,
    text: parts.map((part) => `${part.score}（${(part.ratio * 100).toFixed(1)}%）`).join(" / ") || "无可用档位",
  };
};

interface ScoreConfigSectionProps {
  shopCategoryId: number;
  baseScore: number;
  config: ScoreConfig | null;
  loading: boolean;
  onSaved: (config: ScoreConfig | null) => void;
}

/**
 * 价格档位 + 策略组：原价固定在列，另外可加若干档位；每个组勾选档位并配权重，领任务时按权重随机。
 * 用户在下方用户列表里只绑组，组改了绑定的用户自动生效；没绑组走默认组，没有默认组用原价。
 */
export function ScoreConfigSection({ shopCategoryId, baseScore, config, loading, onSaved }: ScoreConfigSectionProps) {
  const [options, setOptions] = useState<ScoreOption[]>([]);
  const [groups, setGroups] = useState<ScoreGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const seqRef = useRef(0);

  useEffect(() => {
    setOptions(config?.options ?? []);
    setGroups(config?.groups ?? []);
    const ids = [...(config?.options ?? []), ...(config?.groups ?? [])].map((entry) => entry.id);
    seqRef.current = Math.max(config?.seq ?? 0, 0, ...ids);
  }, [config]);

  const nextId = () => {
    seqRef.current += 1;
    return seqRef.current;
  };

  const optionRows = listScoreOptions(options, baseScore);
  // 当前组被删或配置重新加载后，落到第一个组
  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];

  const updateGroup = (groupId: number, patch: (group: ScoreGroup) => ScoreGroup) =>
    setGroups((current) => current.map((group) => (group.id === groupId ? patch(group) : group)));

  const addGroup = () => {
    const id = nextId();
    setGroups((current) => [
      ...current,
      {
        id,
        name: current.length ? `策略组${current.length + 1}` : "标准",
        defaultGroup: current.length === 0,
        items: [{ optionId: BASE_SCORE_OPTION_ID, weight: 1 }],
      },
    ]);
    setActiveGroupId(id);
  };

  const removeGroup = (groupId: number) => {
    const index = groups.findIndex((group) => group.id === groupId);
    const rest = groups.filter((group) => group.id !== groupId);
    setGroups(rest);
    setActiveGroupId(rest[Math.min(index, rest.length - 1)]?.id ?? null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveScoreConfig(shopCategoryId, { seq: seqRef.current, options, groups });
      message.success("价格策略已保存");
      onSaved(saved?.scoreConfig ?? null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存价格策略失败");
    } finally {
      setSaving(false);
    }
  };

  const groupColumns = (group: ScoreGroup): ColumnsType<OptionRow> => [
    { title: "档位", dataIndex: "label", width: 90 },
    { title: "积分", dataIndex: "score", width: 90 },
    {
      title: "选用",
      key: "picked",
      width: 70,
      render: (_, row) => (
        <Checkbox
          checked={group.items.some((item) => item.optionId === row.id)}
          onChange={(event) =>
            updateGroup(group.id, (current) => ({
              ...current,
              items: event.target.checked
                ? [...current.items, { optionId: row.id, weight: 1 }]
                : current.items.filter((item) => item.optionId !== row.id),
            }))
          }
        />
      ),
    },
    {
      title: "权重",
      key: "weight",
      width: 130,
      render: (_, row) => {
        const item = group.items.find((entry) => entry.optionId === row.id);
        return (
          <InputNumber
            size="small"
            min={0.0001}
            precision={4}
            disabled={!item}
            value={item?.weight}
            style={{ width: 110 }}
            onChange={(value) =>
              updateGroup(group.id, (current) => ({
                ...current,
                items: current.items.map((entry) =>
                  entry.optionId === row.id ? { ...entry, weight: Number(value ?? 0) } : entry,
                ),
              }))
            }
          />
        );
      },
    },
    {
      title: "概率",
      key: "ratio",
      render: (_, row) => {
        const item = group.items.find((entry) => entry.optionId === row.id);
        const total = group.items.reduce((sum, entry) => sum + (entry.weight > 0 ? entry.weight : 0), 0);
        return item && total ? `${((item.weight / total) * 100).toFixed(1)}%` : "-";
      },
    },
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>价格策略</div>
      <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
        领任务时按用户绑定的策略组随机积分：没绑组走默认组，没有默认组用原价。原价和其他档位在商品「编辑」里改。
        <br />
        删除策略组后，绑定它的用户自动改走默认组。
      </Text>

      <Space wrap size={8} style={{ marginBottom: 12 }}>
        {optionRows.map((option) => (
          <Tag key={option.id} color={option.id === BASE_SCORE_OPTION_ID ? "blue" : undefined}>
            {option.label} {option.score}
          </Tag>
        ))}
      </Space>

      {groups.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有策略组，领任务全部按原价">
          <Button icon={<PlusOutlined />} onClick={addGroup}>
            添加策略组
          </Button>
        </Empty>
      ) : (
        <Tabs
          type="editable-card"
          size="small"
          activeKey={String(activeGroup?.id)}
          addIcon={<PlusOutlined aria-label="添加策略组" />}
          onChange={(key) => setActiveGroupId(Number(key))}
          onEdit={(_, action) => {
            if (action === "add") addGroup();
          }}
          items={groups.map((group) => ({
            key: String(group.id),
            closable: false,
            label: (
              <Space size={4}>
                {group.name || "未命名"}
                {group.defaultGroup && <Tag color="green" style={{ marginInlineEnd: 0 }}>默认</Tag>}
              </Space>
            ),
            children: (
              <>
                <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }}>
                  <Input
                    aria-label="策略组名称"
                    value={group.name}
                    maxLength={20}
                    style={{ width: 200 }}
                    onChange={(event) => updateGroup(group.id, (current) => ({ ...current, name: event.target.value }))}
                  />
                  <Space>
                    <Checkbox
                      checked={group.defaultGroup}
                      onChange={(event) =>
                        setGroups((current) =>
                          current.map((entry) => ({
                            ...entry,
                            defaultGroup: entry.id === group.id ? event.target.checked : event.target.checked ? false : entry.defaultGroup,
                          })),
                        )
                      }
                    >
                      默认组
                    </Checkbox>
                    <Popconfirm
                      title="删除策略组？"
                      description="保存后，绑定该组的用户改走默认组。"
                      onConfirm={() => removeGroup(group.id)}
                    >
                      <Button type="text" danger aria-label="删除策略组" icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </Space>
                <Table<OptionRow>
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={groupColumns(group)}
                  dataSource={optionRows}
                />
                <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                  期望积分：{summarizeScoreGroup(group, options, baseScore).expected.toFixed(2)}
                </Text>
              </>
            ),
          }))}
        />
      )}

      <Space size={8} style={{ marginTop: 12 }}>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={loading} onClick={() => void save()}>
          保存价格策略
        </Button>
      </Space>
    </div>
  );
}
