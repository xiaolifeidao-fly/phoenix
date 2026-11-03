"use client";

import { useState } from "react";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Form, InputNumber, Space, Typography } from "antd";
import { BASE_SCORE_OPTION_ID, type ScoreConfig } from "../../api/product.api";

const { Text } = Typography;

/** barry 限制的档位数量上限。 */
const MAX_TIERS = 20;

export interface ScoreTierRow {
  id: number;
  /** 新加的行还没填时为 null，保存时忽略 */
  score: number | null;
}

export const toScoreTierRows = (config: ScoreConfig | null): ScoreTierRow[] =>
  (config?.options ?? []).map((option) => ({ id: option.id, score: option.score }));

/** 档位与组共用 seq 分配 ID，新 ID 要大于已用过的所有 ID。 */
const nextTierId = (config: ScoreConfig | null, tiers: ScoreTierRow[]) =>
  Math.max(
    config?.seq ?? 0,
    0,
    ...(config?.options ?? []).map((option) => option.id),
    ...(config?.groups ?? []).map((group) => group.id),
    ...tiers.map((tier) => tier.id),
  ) + 1;

/** 原价加已填档位的积分，从低到高去重；没有其他档位时不算区间。 */
const listTierScores = (baseScore: unknown, tiers: ScoreTierRow[]) => {
  const scores = tiers.flatMap((tier) => (tier.score === null ? [] : [tier.score]));
  if (!scores.length) return [];
  if (typeof baseScore === "number") scores.push(baseScore);
  return Array.from(new Set(scores)).sort((a, b) => a - b);
};

/**
 * 把编辑后的档位合回整份配置；没有变化时返回 null，不用保存。
 * 删掉的档位同时从各组移除，组里没有档位了就退回原价，否则 barry 校验不通过。
 */
export const applyScoreTiers = (config: ScoreConfig | null, tiers: ScoreTierRow[]): ScoreConfig | null => {
  const options = tiers.flatMap((tier) => (tier.score === null ? [] : [{ id: tier.id, score: tier.score }]));
  const before = (config?.options ?? []).map((option) => ({ id: option.id, score: option.score }));
  if (JSON.stringify(options) === JSON.stringify(before)) {
    return null;
  }
  const kept = new Set([BASE_SCORE_OPTION_ID, ...options.map((option) => option.id)]);
  return {
    seq: nextTierId(config, tiers) - 1,
    options,
    groups: (config?.groups ?? []).map((group) => {
      const items = group.items.filter((item) => kept.has(item.optionId));
      return { ...group, items: items.length ? items : [{ optionId: BASE_SCORE_OPTION_ID, weight: 1 }] };
    }),
  };
};

interface ScoreTierEditorProps {
  config: ScoreConfig | null;
  /** null 表示配置没加载成功，此时不允许编辑，避免保存时覆盖线上配置 */
  tiers: ScoreTierRow[] | null;
  loading: boolean;
  onChange: (tiers: ScoreTierRow[]) => void;
}

/** 商品的其他价格档位：原价就是商品积分，这里只维护原价以外的档位。按回车可连续添加，价格区间随输入实时变化。 */
export function ScoreTierEditor({ config, tiers, loading, onChange }: ScoreTierEditorProps) {
  const [focusId, setFocusId] = useState<number | null>(null);
  const form = Form.useFormInstance();
  const baseScore = Form.useWatch("score", form);

  if (loading) {
    return <Text type="secondary">正在加载其他档位…</Text>;
  }
  if (!tiers) {
    return <Text type="warning">其他档位加载失败，重新打开后再改；本次保存不影响已有档位。</Text>;
  }

  const addTier = () => {
    if (tiers.length >= MAX_TIERS) return;
    const id = nextTierId(config, tiers);
    setFocusId(id);
    onChange([...tiers, { id, score: null }]);
  };

  const remaining = new Set(tiers.map((tier) => tier.id));
  const removedInUse = (config?.options ?? []).filter(
    (option) =>
      !remaining.has(option.id) && config?.groups.some((group) => group.items.some((item) => item.optionId === option.id)),
  );

  const scores = listTierScores(baseScore, tiers);

  return (
    <div>
      <Space wrap size={8}>
        {tiers.map((tier, index) => (
          <Space.Compact key={tier.id}>
            <InputNumber
              addonBefore={`档位${index + 1}`}
              autoFocus={tier.id === focusId}
              min={0}
              precision={0}
              placeholder="积分"
              value={tier.score}
              style={{ width: 170 }}
              onChange={(value) =>
                onChange(tiers.map((entry) => (entry.id === tier.id ? { ...entry, score: value === null ? null : Number(value) } : entry)))
              }
              onPressEnter={(event) => {
                event.preventDefault();
                if (index === tiers.length - 1 && tier.score !== null) addTier();
              }}
            />
            <Button
              aria-label={`删除档位${index + 1}`}
              icon={<DeleteOutlined />}
              onClick={() => onChange(tiers.filter((entry) => entry.id !== tier.id))}
            />
          </Space.Compact>
        ))}
        <Button icon={<PlusOutlined />} disabled={tiers.length >= MAX_TIERS} onClick={addTier}>
          添加档位
        </Button>
      </Space>
      {scores.length > 0 && (
        <Text style={{ display: "block", marginTop: 8 }}>
          价格区间：
          <Text strong>
            {scores.length > 1 ? `${scores[0]} ~ ${scores[scores.length - 1]}` : scores[0]}
          </Text>
          <Text type="secondary">（共 {scores.length} 档：{scores.join("、")}）</Text>
        </Text>
      )}
      {removedInUse.length > 0 && (
        <Text type="warning" style={{ display: "block", marginTop: 8 }}>
          删除的档位（{removedInUse.map((option) => option.score).join("、")}）已被策略组使用，保存后会从这些组移除。
        </Text>
      )}
    </div>
  );
}
