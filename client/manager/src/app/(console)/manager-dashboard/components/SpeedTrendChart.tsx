"use client";

import { useMemo, useRef, useState } from "react";
import { Empty, Segmented, Space, Tag, Typography } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";

const { Text } = Typography;

export interface SpeedSeriesPoint {
  timestamp: number;
  manualPerSecond: number;
  actualPerSecond: number;
}

interface SpeedTrendChartProps {
  series: SpeedSeriesPoint[];
  /** Latest aggregate speed (per second) used for the headline stat tiles. */
  currentManualPerSecond: number;
  currentActualPerSecond: number;
}

type SpeedUnit = "second" | "minute" | "hour";

const UNIT_OPTIONS: Array<{ label: string; value: SpeedUnit }> = [
  { label: "每秒", value: "second" },
  { label: "每分钟", value: "minute" },
  { label: "每小时", value: "hour" },
];

const UNIT_MULTIPLIER: Record<SpeedUnit, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
};

const UNIT_SUFFIX: Record<SpeedUnit, string> = {
  second: "/秒",
  minute: "/分",
  hour: "/时",
};

const MANUAL_COLOR = "#0f766e";
const ACTUAL_COLOR = "#2563eb";

// A fixed internal coordinate system; the SVG scales to its container via width:100%.
const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 260;
const MARGIN = { top: 20, right: 24, bottom: 34, left: 56 };
const PLOT_WIDTH = VIEW_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = VIEW_HEIGHT - MARGIN.top - MARGIN.bottom;

/**
 * 速度概览 —— 展示最近 1 天（1 分钟一个点）的人工提交 / 实际完成速度曲线。
 * 数据来源于 dashboard 缓存在 localStorage 的速度快照，按分钟增量换算为每秒速度，
 * 并可在「每秒 / 每分钟 / 每小时」三种口径间切换查看。
 */
export function SpeedTrendChart({
  series,
  currentManualPerSecond,
  currentActualPerSecond,
}: SpeedTrendChartProps) {
  const [unit, setUnit] = useState<SpeedUnit>("minute");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const multiplier = UNIT_MULTIPLIER[unit];

  const geometry = useMemo(() => {
    if (series.length < 2) {
      return null;
    }

    const timestamps = series.map((point) => point.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeSpan = Math.max(maxTime - minTime, 1);

    const peakPerSecond = series.reduce(
      (max, point) => Math.max(max, point.manualPerSecond, point.actualPerSecond),
      0,
    );
    // Round the axis top up to a "nice" value so grid labels stay readable.
    const yMax = niceCeil((peakPerSecond || 1) * multiplier);

    const xFor = (timestamp: number) =>
      MARGIN.left + ((timestamp - minTime) / timeSpan) * PLOT_WIDTH;
    const yFor = (perSecond: number) =>
      MARGIN.top + PLOT_HEIGHT - (Math.min(perSecond * multiplier, yMax) / yMax) * PLOT_HEIGHT;

    const points = series.map((point, index) => ({
      index,
      timestamp: point.timestamp,
      manualPerSecond: point.manualPerSecond,
      actualPerSecond: point.actualPerSecond,
      x: xFor(point.timestamp),
      manualY: yFor(point.manualPerSecond),
      actualY: yFor(point.actualPerSecond),
    }));

    const manualLine = points.map((point) => `${point.x},${point.manualY}`).join(" ");
    const actualLine = points.map((point) => `${point.x},${point.actualY}`).join(" ");
    const baseY = MARGIN.top + PLOT_HEIGHT;
    const manualArea = `${MARGIN.left},${baseY} ${manualLine} ${points[points.length - 1].x},${baseY}`;
    const actualArea = `${MARGIN.left},${baseY} ${actualLine} ${points[points.length - 1].x},${baseY}`;

    const yTicks = Array.from({ length: 5 }, (_, i) => {
      const value = (yMax / 4) * i;
      return { value, y: yFor(value / multiplier) };
    });

    const xTickCount = Math.min(6, points.length);
    const xTicks = Array.from({ length: xTickCount }, (_, i) => {
      const ratio = xTickCount === 1 ? 0 : i / (xTickCount - 1);
      const timestamp = minTime + timeSpan * ratio;
      return { timestamp, x: MARGIN.left + ratio * PLOT_WIDTH };
    });

    return { points, manualLine, actualLine, manualArea, actualArea, yTicks, xTicks, baseY };
  }, [series, multiplier]);

  const hoverPoint =
    geometry && hoverIndex !== null ? geometry.points[hoverIndex] ?? null : null;

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!geometry || !svgRef.current) {
      return;
    }
    const rect = svgRef.current.getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
    // Find the point whose x is closest to the cursor.
    let nearest = 0;
    let nearestDistance = Infinity;
    for (const point of geometry.points) {
      const distance = Math.abs(point.x - viewX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = point.index;
      }
    }
    setHoverIndex(nearest);
  };

  return (
    <section className="manager-data-card manager-speed-chart">
      <div className="manager-speed-chart__header">
        <div className="manager-speed-chart__title">
          <span className="manager-speed-chart__title-icon">
            <ClockCircleOutlined />
          </span>
          <div>
            <div className="manager-display-title" style={{ fontSize: 20 }}>
              速度概览
            </div>
            <Text style={{ color: "var(--manager-text-soft)", fontSize: 13 }}>
              最近 1 天速度变化 · 每分钟采样一个点
            </Text>
          </div>
        </div>
        <Segmented
          options={UNIT_OPTIONS}
          value={unit}
          onChange={(value) => setUnit(value as SpeedUnit)}
        />
      </div>

      <div className="manager-speed-chart__stats">
        <SpeedStatTile
          label="人工提交速度"
          color={MANUAL_COLOR}
          perSecond={currentManualPerSecond}
        />
        <SpeedStatTile
          label="实际完成速度"
          color={ACTUAL_COLOR}
          perSecond={currentActualPerSecond}
        />
      </div>

      {geometry ? (
        <div className="manager-speed-chart__canvas">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            preserveAspectRatio="none"
            className="manager-speed-chart__svg"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="speed-manual-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={MANUAL_COLOR} stopOpacity={0.22} />
                <stop offset="100%" stopColor={MANUAL_COLOR} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="speed-actual-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACTUAL_COLOR} stopOpacity={0.2} />
                <stop offset="100%" stopColor={ACTUAL_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>

            {geometry.yTicks.map((tick) => (
              <g key={`y-${tick.value}`}>
                <line
                  x1={MARGIN.left}
                  y1={tick.y}
                  x2={VIEW_WIDTH - MARGIN.right}
                  y2={tick.y}
                  stroke="var(--manager-border)"
                  strokeWidth={1}
                  strokeDasharray={tick.value === 0 ? undefined : "4 4"}
                />
                <text
                  x={MARGIN.left - 10}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="manager-speed-chart__axis-text"
                >
                  {formatAxisValue(tick.value)}
                </text>
              </g>
            ))}

            {geometry.xTicks.map((tick, index) => (
              <text
                key={`x-${index}`}
                x={tick.x}
                y={VIEW_HEIGHT - MARGIN.bottom + 20}
                textAnchor={index === 0 ? "start" : index === geometry.xTicks.length - 1 ? "end" : "middle"}
                className="manager-speed-chart__axis-text"
              >
                {formatTimeLabel(tick.timestamp)}
              </text>
            ))}

            <polygon points={geometry.manualArea} fill="url(#speed-manual-fill)" />
            <polygon points={geometry.actualArea} fill="url(#speed-actual-fill)" />
            <polyline
              points={geometry.actualLine}
              fill="none"
              stroke={ACTUAL_COLOR}
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={geometry.manualLine}
              fill="none"
              stroke={MANUAL_COLOR}
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            {hoverPoint ? (
              <g>
                <line
                  x1={hoverPoint.x}
                  y1={MARGIN.top}
                  x2={hoverPoint.x}
                  y2={geometry.baseY}
                  stroke="var(--manager-border-strong)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={hoverPoint.x} cy={hoverPoint.actualY} r={4} fill={ACTUAL_COLOR} stroke="#fff" strokeWidth={1.5} />
                <circle cx={hoverPoint.x} cy={hoverPoint.manualY} r={4} fill={MANUAL_COLOR} stroke="#fff" strokeWidth={1.5} />
              </g>
            ) : null}
          </svg>

          {hoverPoint ? (
            <div
              className="manager-speed-chart__tooltip"
              style={{ left: `${(hoverPoint.x / VIEW_WIDTH) * 100}%` }}
            >
              <div className="manager-speed-chart__tooltip-time">
                {formatTooltipTime(hoverPoint.timestamp)}
              </div>
              <div className="manager-speed-chart__tooltip-row">
                <span className="manager-speed-chart__dot" style={{ background: MANUAL_COLOR }} />
                人工 {formatSpeed(hoverPoint.manualPerSecond * multiplier)}
                {UNIT_SUFFIX[unit]}
              </div>
              <div className="manager-speed-chart__tooltip-row">
                <span className="manager-speed-chart__dot" style={{ background: ACTUAL_COLOR }} />
                实际 {formatSpeed(hoverPoint.actualPerSecond * multiplier)}
                {UNIT_SUFFIX[unit]}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="manager-speed-chart__empty">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="正在采集速度数据，稍后即可看到曲线"
          />
        </div>
      )}

      <div className="manager-speed-chart__legend">
        <Tag className="manager-dashboard-tag" style={{ borderColor: MANUAL_COLOR, color: MANUAL_COLOR }}>
          人工提交
        </Tag>
        <Tag className="manager-dashboard-tag" style={{ borderColor: ACTUAL_COLOR, color: ACTUAL_COLOR }}>
          实际完成
        </Tag>
      </div>
    </section>
  );
}

function SpeedStatTile({
  label,
  color,
  perSecond,
}: {
  label: string;
  color: string;
  perSecond: number;
}) {
  return (
    <div className="manager-speed-chart__stat">
      <div className="manager-speed-chart__stat-label">
        <span className="manager-speed-chart__dot" style={{ background: color }} />
        {label}
      </div>
      <div className="manager-speed-chart__stat-values">
        <div>
          <strong style={{ color }}>{formatSpeed(perSecond)}</strong>
          <span>/秒</span>
        </div>
        <div>
          <strong>{formatSpeed(perSecond * 60)}</strong>
          <span>/分</span>
        </div>
        <div>
          <strong>{formatSpeed(perSecond * 3600)}</strong>
          <span>/时</span>
        </div>
      </div>
    </div>
  );
}

function niceCeil(value: number) {
  if (value <= 0) {
    return 1;
  }
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

function formatSpeed(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  if (safe >= 100) {
    return Math.round(safe).toLocaleString("zh-CN");
  }
  if (safe >= 10) {
    return safe.toFixed(1);
  }
  return safe.toFixed(2);
}

function formatAxisValue(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}w`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  }
  return value >= 10 || value === 0 ? String(Math.round(value)) : value.toFixed(1);
}

function formatTimeLabel(timestamp: number) {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTooltipTime(timestamp: number) {
  const date = new Date(timestamp);
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(value: number) {
  return value < 10 ? `0${value}` : String(value);
}
