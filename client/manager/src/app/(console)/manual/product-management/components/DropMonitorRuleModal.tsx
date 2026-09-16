"use client";

import { useEffect, useState } from "react";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Divider, Form, InputNumber, Input, Modal, Row, Space, Switch, Typography } from "antd";
import { message } from "@/utils/notify";
import {
  fetchDropMonitorRule,
  saveDropMonitorRule,
  type DropMonitorRulePayload,
  type ManualProductRecord,
} from "../../api/product.api";

const { Text } = Typography;

/** 未配置时的默认初始值, 与后端 seed 保持一致. */
const defaults: DropMonitorRulePayload = {
  shopCategoryId: 0,
  enabled: true,
  validMinute: 4320,
  intervalMinute: 360,
  intervalSteps: "",
  firstCheckDelayMinute: 1080,
  stableEndTimes: undefined,
  dropThresholdNum: 10,
  dropThresholdRatio: 0.01,
  repairEnabled: false,
  repairMaxTimes: 1,
  repairMinNum: 10,
  repairMaxDropRatio: 0.5,
  repairSkipBelowStart: true,
  minTotalNum: 50,
  maxStartNum: 5000,
  remark: "",
};

const MAX_INTERVAL_MINUTE = 7 * 24 * 60;

interface IntervalStep {
  hour?: number;
  minute?: number;
}

/** 去掉多余的小数尾巴: 72.00 -> 72, 1.50 -> 1.5 */
const trimNumber = (value: number) => Number(value.toFixed(2));

/** 配置单位是分钟, 但分钟数一大就看不出是多久, 所以顺手把小时(必要时再加天)标出来 */
const toHourText = (minute?: number | null) => {
  const value = Number(minute);
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }
  if (value < 60) {
    return `${trimNumber(value)} 分钟`;
  }
  const hours = trimNumber(value / 60);
  if (value < 1440) {
    return `${hours} 小时`;
  }
  return `${hours} 小时 (${trimNumber(value / 1440)} 天)`;
};

const toPercentText = (ratio?: number | null) => {
  const value = Number(ratio);
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }
  return `${trimNumber(value * 100)}%`;
};

/** "24:360,72:1440" -> [{hour:24,minute:360},{hour:72,minute:1440}] */
const parseSteps = (text?: string): IntervalStep[] => {
  if (!text || !text.trim()) {
    return [];
  }
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [hour, minute] = item.split(":");
      return { hour: Number(hour) || undefined, minute: Number(minute) || undefined };
    })
    .filter((item) => item.hour && item.minute);
};

const serializeSteps = (steps: IntervalStep[]) =>
  steps
    .filter((item) => item.hour && item.minute)
    .map((item) => `${item.hour}:${item.minute}`)
    .join(",");

interface Props {
  product: ManualProductRecord | null;
  open: boolean;
  onClose: () => void;
}

export function DropMonitorRuleModal({ product, open, onClose }: Props) {
  const [form] = Form.useForm<DropMonitorRulePayload>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<DropMonitorRulePayload>(defaults);
  const [stepsEnabled, setStepsEnabled] = useState(false);
  const [steps, setSteps] = useState<IntervalStep[]>([]);

  useEffect(() => {
    if (!open || !product) {
      return;
    }
    setLoading(true);
    fetchDropMonitorRule(product.id)
      .then((rule) => {
        const next: DropMonitorRulePayload = rule
          ? {
              id: Number(rule.id) || undefined,
              shopCategoryId: product.id,
              enabled: Boolean(rule.enabled),
              validMinute: Number(rule.validMinute) || defaults.validMinute,
              intervalMinute: Number(rule.intervalMinute) || defaults.intervalMinute,
              intervalSteps: rule.intervalSteps ?? "",
              firstCheckDelayMinute: Number(rule.firstCheckDelayMinute) || defaults.firstCheckDelayMinute,
              stableEndTimes: rule.stableEndTimes ?? undefined,
              dropThresholdNum: rule.dropThresholdNum ?? undefined,
              dropThresholdRatio: rule.dropThresholdRatio ?? undefined,
              repairEnabled: Boolean(rule.repairEnabled),
              repairMaxTimes: Number(rule.repairMaxTimes) || 1,
              repairMinNum: rule.repairMinNum ?? undefined,
              repairMaxDropRatio: rule.repairMaxDropRatio ?? undefined,
              repairSkipBelowStart: rule.repairSkipBelowStart !== false,
              minTotalNum: rule.minTotalNum ?? undefined,
              maxStartNum: rule.maxStartNum ?? undefined,
              remark: rule.remark ?? "",
            }
          : { ...defaults, shopCategoryId: product.id };
        const parsed = parseSteps(next.intervalSteps);
        form.setFieldsValue(next);
        setValues(next);
        setSteps(parsed);
        setStepsEnabled(parsed.length > 0);
      })
      .catch((error) => {
        message.error(error instanceof Error ? error.message : "加载监控配置失败");
      })
      .finally(() => setLoading(false));
  }, [open, product, form]);

  const submit = async () => {
    if (!product) {
      return;
    }
    const payload = await form.validateFields();
    if (payload.enabled && payload.firstCheckDelayMinute >= payload.validMinute) {
      message.error("首检延迟必须小于有效期, 否则一次都检测不到");
      return;
    }
    if (payload.enabled && payload.intervalMinute > MAX_INTERVAL_MINUTE) {
      message.error("等待期不能超过 7 天");
      return;
    }
    let intervalSteps = "";
    if (stepsEnabled) {
      const valid = steps.filter((item) => item.hour && item.minute);
      if (valid.length === 0) {
        message.error("启用阶梯等待期后至少要配置一段");
        return;
      }
      for (let index = 1; index < valid.length; index += 1) {
        if (Number(valid[index].hour) <= Number(valid[index - 1].hour)) {
          message.error("阶梯的小时数必须递增");
          return;
        }
      }
      if (valid.some((item) => Number(item.minute) > MAX_INTERVAL_MINUTE)) {
        message.error("阶梯的等待期不能超过 7 天");
        return;
      }
      intervalSteps = serializeSteps(valid);
    }
    setSaving(true);
    try {
      await saveDropMonitorRule({ ...payload, intervalSteps, shopCategoryId: product.id, id: values.id });
      message.success("监控配置已保存");
      onClose();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存监控配置失败");
    } finally {
      setSaving(false);
    }
  };

  /** 预计检测次数, 实时算给运营看, 避免配出天价采集量 */
  const checkTimes = (() => {
    const valid = Number(values.validMinute) || 0;
    const delay = Number(values.firstCheckDelayMinute) || 0;
    const interval = Number(values.intervalMinute) || 0;
    if (valid <= 0 || interval <= 0 || delay >= valid) {
      return 0;
    }
    return 1 + Math.floor((valid - delay) / interval);
  })();

  const suffix = (text: string) => (
    <Text type="secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
      {text}
    </Text>
  );

  const updateStep = (index: number, patch: IntervalStep) => {
    setSteps((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <Modal
      title={`掉量监控配置 - ${product?.name || product?.code || ""}`}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="保存"
      confirmLoading={saving}
      width={800}
      style={{ top: 48 }}
      // 弹窗总高固定 800: 头和底(保存按钮)不动, 只有中间的表单区滚动.
      // 小屏时按视口收缩, 免得整个弹窗被挤出屏幕.
      styles={{ body: { height: "min(690px, calc(100vh - 180px))", overflowY: "auto", paddingRight: 12 } }}
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={
          values.enabled ? (
            <Text>
              有效期 {toHourText(values.validMinute)} ，首检延迟 {toHourText(values.firstCheckDelayMinute)} ，之后每{" "}
              {stepsEnabled ? "按阶梯" : toHourText(values.intervalMinute)} 复采一次
              {stepsEnabled ? "" : ` ⇒ 每单约检测 ${checkTimes} 次`}
            </Text>
          ) : (
            <Text>
              单子完成后在有效期内周期性复采真实值，低于完成时的结束值即判定掉量。当前未开启，不会产生任何采集。
              建议先只开监控、不开补单，观察 1~2 天掉量率与首次掉量时间分布后，再决定补单与提前收档的取值。
            </Text>
          )
        }
      />
      <Form
        form={form}
        layout="vertical"
        disabled={loading}
        onValuesChange={(_, all) => setValues({ ...values, ...all })}
      >
        <Divider orientation="left" plain style={{ margin: "4px 0 12px" }}>
          监控范围
        </Divider>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item label="开启监控" name="enabled" valuePropName="checked" style={{ marginBottom: 12 }}>
              <Switch />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="连续无掉量收档次数"
              name="stableEndTimes"
              tooltip="连续这么多次采集成功且无掉量即判定这单不会掉、提前结束省配额。留空=测到有效期结束。采集失败不计入"
              style={{ marginBottom: 12 }}
            >
              <InputNumber min={1} style={{ width: "100%" }} placeholder="留空=不启用" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="最小监控单量"
              name="minTotalNum"
              tooltip="单量低于该值的单不监控, 把采集配额让给大单"
              style={{ marginBottom: 12 }}
            >
              <InputNumber min={0} style={{ width: "100%" }} placeholder="选填" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="起始值上限"
              name="maxStartNum"
              tooltip="进单时起始值高于该值的单不监控。大号自然波动本来就大, 掉量归因不可靠"
              style={{ marginBottom: 12 }}
            >
              <InputNumber min={0} style={{ width: "100%" }} placeholder="选填, 超过则不监控" />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain style={{ margin: "4px 0 12px" }}>
          检测节奏
        </Divider>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              label="有效期(分钟)"
              name="validMinute"
              tooltip="从完成时刻起算, 过期不再检测"
              style={{ marginBottom: 12 }}
            >
              <InputNumber min={1} style={{ width: "100%" }} addonAfter={suffix(toHourText(values.validMinute))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="首检延迟(分钟)"
              name="firstCheckDelayMinute"
              tooltip="完成后隔多久做第一次检测。掉量不是完成瞬间发生的, 这段静默期内的检测纯属浪费配额"
              style={{ marginBottom: 12 }}
            >
              <InputNumber
                min={1}
                style={{ width: "100%" }}
                addonAfter={suffix(toHourText(values.firstCheckDelayMinute))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="等待期(分钟)"
              name="intervalMinute"
              tooltip="每检测一次后等多久再测下一次, 最长 7 天。启用阶梯后它作为兜底"
              style={{ marginBottom: 12 }}
            >
              <InputNumber
                min={1}
                max={MAX_INTERVAL_MINUTE}
                style={{ width: "100%" }}
                addonAfter={suffix(toHourText(values.intervalMinute))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="启用阶梯等待期"
              tooltip="掉量集中在完成后不久, 越往后越稀疏。前密后疏能在不降低早期灵敏度的前提下省配额"
              style={{ marginBottom: 12 }}
            >
              <Switch
                checked={stepsEnabled}
                onChange={(checked) => {
                  setStepsEnabled(checked);
                  if (checked && steps.length === 0) {
                    setSteps([{ hour: 24, minute: 360 }, { hour: 72, minute: 1440 }]);
                  }
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        {stepsEnabled ? (
          <div style={{ background: "#f7f9fc", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              {steps.map((step, index) => (
                <Space key={index} size={8} wrap>
                  <Text>完成后</Text>
                  <InputNumber
                    min={1}
                    style={{ width: 90 }}
                    value={step.hour}
                    onChange={(value) => updateStep(index, { hour: value ?? undefined })}
                  />
                  <Text>小时内，每</Text>
                  <InputNumber
                    min={1}
                    max={MAX_INTERVAL_MINUTE}
                    style={{ width: 110 }}
                    value={step.minute}
                    onChange={(value) => updateStep(index, { minute: value ?? undefined })}
                  />
                  <Text>分钟检测一次</Text>
                  {suffix(`(${toHourText(step.minute)})`)}
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => setSteps(steps.filter((_, i) => i !== index))}
                  />
                </Space>
              ))}
              <Space size={12}>
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    const lastHour = Number(steps[steps.length - 1]?.hour) || 0;
                    setSteps([...steps, { hour: lastHour + 24, minute: 1440 }]);
                  }}
                >
                  添加阶梯
                </Button>
                {suffix(`最终存为 ${serializeSteps(steps) || "—"}；小时数需递增，超出最后一段后沿用最后一行的等待期`)}
              </Space>
            </Space>
          </div>
        ) : null}

        <Divider orientation="left" plain style={{ margin: "4px 0 12px" }}>
          掉量判定
        </Divider>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              label="掉量阈值-按单量"
              name="dropThresholdNum"
              tooltip="选填, 与比例阈值取较大者; 两个都不填则掉 1 就算"
              style={{ marginBottom: 12 }}
            >
              <InputNumber min={0} style={{ width: "100%" }} placeholder="选填" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="掉量阈值-按比例"
              name="dropThresholdRatio"
              tooltip="选填, 乘本单总量; 与单量阈值取较大者"
              style={{ marginBottom: 12 }}
            >
              <InputNumber
                min={0}
                max={1}
                step={0.01}
                style={{ width: "100%" }}
                placeholder="如 0.01 表示 1%"
                addonAfter={suffix(toPercentText(values.dropThresholdRatio))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain style={{ margin: "4px 0 12px" }}>
          自动补单（以下守卫只拦补单，掉量明细照常留痕）
        </Divider>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              label="自动补单"
              name="repairEnabled"
              valuePropName="checked"
              tooltip="开启后掉量会自动下发补单单据, 直接产生积分成本"
              style={{ marginBottom: 12 }}
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="补单次数上限"
              name="repairMaxTimes"
              tooltip="单个单子最多补几次, 防止反复掉量反复花钱"
              style={{ marginBottom: 12 }}
            >
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="最小补单量"
              name="repairMinNum"
              tooltip="选填, 掉量小于该值不补, 碎量补单不经济"
              style={{ marginBottom: 12 }}
            >
              <InputNumber min={0} style={{ width: "100%" }} placeholder="选填" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="掉量比例上限-超过不补"
              name="repairMaxDropRatio"
              tooltip="选填, 乘本单总量。掉得比这还多说明不是本单的问题, 补也补不回来"
              style={{ marginBottom: 12 }}
            >
              <InputNumber
                min={0}
                max={1}
                step={0.1}
                style={{ width: "100%" }}
                placeholder="如 0.5 表示掉超过一半不补"
                addonAfter={suffix(toPercentText(values.repairMaxDropRatio))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="跌破进单起始值不补"
              name="repairSkipBelowStart"
              valuePropName="checked"
              tooltip="当前值已经低于进单时的起始值, 说明链接自身在大幅掉量, 不是本单造成的"
              style={{ marginBottom: 12 }}
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="备注" name="remark" style={{ marginBottom: 0 }}>
          <Input.TextArea rows={2} maxLength={200} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
