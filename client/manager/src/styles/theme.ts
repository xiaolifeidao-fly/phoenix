import type { ThemeConfig } from "antd";

/**
 * 与 globals.css 中的设计令牌保持同源。改色请两边同步改，
 * 不要在业务组件里写死颜色。
 */
const palette = {
  primary: "#3b73e5",
  primaryHover: "#2a5fcc",
  primaryActive: "#1f4aa6",
  success: "#15a34a",
  warning: "#d97706",
  danger: "#dc2626",

  bg: "#f2f5f9",
  surface: "#ffffff",
  sunken: "#f7f9fc",
  hover: "#f7f9fc",

  border: "#e3e9f1",
  borderSoft: "#edf1f7",

  text: "#16213a",
  textSoft: "#5a6b83",
  textFaint: "#8896a9",
  textDisabled: "#aab5c4",

  sidebar: "#18212f",
} as const;

const radius = { xs: 6, sm: 8, md: 10, lg: 14 } as const;

const elevation = {
  low: "0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.04)",
  high: "0 4px 10px rgba(15, 23, 42, 0.08), 0 24px 48px rgba(15, 23, 42, 0.12)",
} as const;

/** 控件三档高度，全站统一，避免同一行里输入框和按钮不等高 */
const control = { sm: 32, md: 36, lg: 42 } as const;

export const modernTheme: ThemeConfig = {
  token: {
    colorPrimary: palette.primary,
    colorSuccess: palette.success,
    colorWarning: palette.warning,
    colorError: palette.danger,
    colorInfo: palette.primary,
    fontFamily: `"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI","SF Pro Text","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif`,
    fontSize: 14,
    lineHeight: 1.5715,
    borderRadius: radius.sm,
    borderRadiusLG: radius.md,
    borderRadiusSM: radius.xs,
    boxShadow: elevation.low,
    boxShadowSecondary: elevation.high,
    controlHeight: control.md,
    padding: 16,
    margin: 16,
    wireframe: false,
    colorBgContainer: palette.surface,
    colorBgElevated: palette.surface,
    colorBgLayout: palette.bg,
    colorFillAlter: palette.sunken,
    colorBorder: palette.border,
    colorBorderSecondary: palette.borderSoft,
    colorText: palette.text,
    colorTextSecondary: palette.textSoft,
    colorTextTertiary: palette.textFaint,
    colorTextQuaternary: palette.textDisabled,
    colorTextPlaceholder: palette.textFaint,
    colorLink: palette.primary,
    colorLinkHover: palette.primaryHover,
    colorLinkActive: palette.primaryActive,
    motionEaseInOut: "cubic-bezier(0.22, 1, 0.36, 1)",
    motionDurationMid: "0.18s",
  },
  components: {
    Button: {
      controlHeight: control.md,
      controlHeightLG: control.lg,
      controlHeightSM: control.sm,
      fontWeight: 500,
      borderRadius: radius.sm,
      // 主按钮不再挂大投影，靠色彩本身建立层级
      primaryShadow: "none",
      defaultShadow: "none",
      dangerShadow: "none",
      defaultBg: palette.surface,
      defaultBorderColor: palette.border,
      defaultColor: palette.text,
      defaultHoverBg: palette.hover,
      paddingInline: 14,
    },
    Input: {
      controlHeight: control.md,
      controlHeightLG: control.lg,
      controlHeightSM: control.sm,
      paddingBlock: 6,
      activeBorderColor: palette.primary,
      hoverBorderColor: palette.primary,
      activeShadow: "0 0 0 3px rgba(59, 115, 229, 0.14)",
      colorBgContainer: palette.surface,
    },
    InputNumber: { controlHeight: control.md, controlHeightLG: control.lg },
    Select: {
      controlHeight: control.md,
      controlHeightLG: control.lg,
      controlHeightSM: control.sm,
      colorBgContainer: palette.surface,
      optionSelectedBg: "#eef4ff",
      optionSelectedFontWeight: 600,
      borderRadiusSM: radius.xs,
    },
    DatePicker: { controlHeight: control.md, controlHeightLG: control.lg },
    Card: {
      borderRadiusLG: radius.lg,
      paddingLG: 20,
      headerFontSize: 15,
      headerHeight: 52,
      boxShadowTertiary: elevation.low,
    },
    Modal: {
      borderRadiusLG: radius.lg,
      titleFontSize: 17,
      headerBg: palette.surface,
      contentBg: palette.surface,
      paddingContentHorizontalLG: 24,
    },
    Drawer: { paddingLG: 24 },
    Message: {
      contentBg: palette.surface,
      contentPadding: "10px 16px",
      borderRadiusLG: radius.md,
    },
    Notification: { borderRadiusLG: radius.md },
    Tooltip: { borderRadius: radius.xs, colorBgSpotlight: "#1e293b" },
    Tag: {
      borderRadiusSM: 999,
      defaultBg: palette.sunken,
      defaultColor: palette.textSoft,
      fontSizeSM: 12,
      lineHeightSM: 1.6,
    },
    Segmented: {
      borderRadius: radius.sm,
      itemSelectedBg: palette.surface,
      itemSelectedColor: palette.text,
      trackBg: "#eef2f7",
      trackPadding: 3,
    },
    Layout: {
      headerBg: palette.bg,
      headerHeight: 64,
      headerPadding: "0",
      siderBg: palette.sidebar,
      bodyBg: palette.bg,
      triggerBg: palette.sidebar,
    },
    Menu: {
      itemBorderRadius: radius.sm,
      itemHeight: 40,
      itemMarginBlock: 2,
      itemMarginInline: 0,
      subMenuItemBg: "transparent",
      activeBarWidth: 0,
    },
    Table: {
      borderColor: palette.borderSoft,
      headerBg: palette.sunken,
      headerColor: palette.textSoft,
      headerSplitColor: "transparent",
      rowHoverBg: "#f6f9fe",
      rowSelectedBg: "#eef4ff",
      rowSelectedHoverBg: "#e4edff",
      cellPaddingBlock: 13,
      headerBorderRadius: 0,
    },
    Pagination: { itemActiveBg: "#eef4ff", borderRadius: radius.xs },
    Tabs: { horizontalItemPadding: "10px 0", titleFontSize: 14 },
    Descriptions: { labelBg: palette.sunken },
    Form: { labelColor: palette.textSoft, verticalLabelPadding: "0 0 6px" },
    Empty: { colorTextDescription: palette.textFaint },
    Statistic: { contentFontSize: 26 },
  },
};
export const whatsappTheme: ThemeConfig = {
  token: {
    colorPrimary: "#25D366",
    colorSuccess: "#25D366",
    colorBgContainer: "#FFFFFF",
    colorBgLayout: "#F0F2F5",
    borderRadius: 8,
    fontFamily: `"IBM Plex Sans","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif`,
  },
  components: {
    Layout: {
      headerBg: "#FFFFFF",
      siderBg: "#FFFFFF",
      bodyBg: "#F0F2F5",
    },
  },
};
