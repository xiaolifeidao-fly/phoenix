import { Tooltip } from "antd";
import dayjs from "dayjs";

/**
 * 后端返回的是带时区的 ISO 串（如 2026-09-16T09:13:38.000+0000），
 * 直接铺到表格里既长又会换行，而且读的人还得自己换算时区。
 * 这里统一转成浏览器本地时间的 "YYYY-MM-DD HH:mm:ss"。
 */
export const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD HH:mm:ss") : value;
};

/** 只要时分秒，用在同一天内的密集时间列上 */
export const formatTime = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("HH:mm:ss") : value;
};

/**
 * 被省略号截断的列，鼠标悬浮时用 Tooltip 展示完整值。
 * 配合 `ellipsis: { showTitle: false }` 用 —— 关掉原生 title 是为了避免两个提示框叠在一起，
 * 而且原生 title 有约 1 秒延迟、样式也和页面其它地方不一致。
 */
export const ellipsisCell = (value?: string | null) =>
  value ? (
    <Tooltip placement="topLeft" title={value}>
      <span>{value}</span>
    </Tooltip>
  ) : (
    <span>—</span>
  );
