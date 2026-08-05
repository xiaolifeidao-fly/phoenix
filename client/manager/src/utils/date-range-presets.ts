import type { RangePickerProps } from "antd/es/date-picker";
import dayjs from "dayjs";

export const dateRangePresets: NonNullable<RangePickerProps["presets"]> = [
  { label: "本周", value: () => [dayjs().startOf("week"), dayjs().endOf("day")] },
  { label: "昨天", value: () => [dayjs().subtract(1, "day").startOf("day"), dayjs().subtract(1, "day").endOf("day")] },
  { label: "当天", value: () => [dayjs().startOf("day"), dayjs().endOf("day")] },
  { label: "本月", value: () => [dayjs().startOf("month"), dayjs().endOf("day")] },
];
