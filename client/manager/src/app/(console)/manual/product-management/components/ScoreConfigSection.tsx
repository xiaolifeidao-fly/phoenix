"use client";

import { useEffect, useRef, useState } from "react";
import { DeleteOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Card, Checkbox, Input, InputNumber, Popconfirm, Space, Table, Tag, Typography } from "antd";
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

  const updateGroup = (groupId: number, patch: (group: ScoreGroup) => ScoreGroup) =>
    setGroups((current) => current.map((group) => (group.id === groupId ? patch(group) : group)));

  const removeOption = (optionId: number) => {
    setOptions((current) => current.filter((option) => option.id !== optionId));
    setGroups((current) =>
      current.map((group) => ({ ...group, items: group.items.filter((item) => item.optionId !== optionId) })),
    );
  };

  const addGroup = () =>
    setGroups((current) => [
      ...current,
      {
        id: nextId(),
        name: current.length ? `策略组${current.length + 1}` : "标准",
        defaultGroup: current.length === 0,
        items: [{ optionId: BASE_SCORE_OPTION_ID, weight: 1 }],
      },
    ]);

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
        领任务时按用户绑定的策略组随机积分：没绑组走默认组，没有默认组用原价。原价跟随商品积分，改商品积分不用改这里。
        <br />
        删除策略组后，绑定它的用户自动改走默认组。
      </Text>

      <Space wrap size={8} style={{ marginBottom: 12 }}>
        <Tag color="blue">原价 {baseScore}</Tag>
        {options.map((option, index) => (
          <Space.Compact key={option.id}>
            <InputNumber
              addonBefore={`档位${index + 1}`}
              min={0}
              precision={0}
              value={option.score}
              style={{ width: 150 }}
              onChange={(value) =>
                setOptions((current) =>
                  current.map((entry) => (entry.id === option.id ? { ...entry, score: Number(value ?? 0) } : entry)),
                )
              }
            />
            <Button icon={<DeleteOutlined />} onClick={() => removeOption(option.id)} />
          </Space.Compact>
        ))}
        <Button icon={<PlusOutlined />} onClick={() => setOptions((current) => [...current, { id: nextId(), score: baseScore }])}>
          添加档位
        </Button>
      </Space>

      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {groups.map((group) => (
          <Card
            key={group.id}
            size="small"
            title={
              <Input
                value={group.name}
                maxLength={20}
                style={{ width: 200 }}
                onChange={(event) => updateGroup(group.id, (current) => ({ ...current, name: event.target.value }))}
              />
            }
            extra={
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
                  onConfirm={() => setGroups((current) => current.filter((entry) => entry.id !== group.id))}
                >
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            }
          >
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
          </Card>
        ))}
      </Space>

      <Space size={8} style={{ marginTop: 12 }}>
        <Button icon={<PlusOutlined />} onClick={addGroup}>
          添加策略组
        </Button>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={loading} onClick={() => void save()}>
          保存价格策略
        </Button>
      </Space>
    </div>
  );
}
