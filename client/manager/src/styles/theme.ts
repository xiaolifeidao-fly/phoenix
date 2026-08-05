import type { ThemeConfig } from "antd";

/**
 * 与 globals.css 中的设计令牌保持同源。改色请两边同步改，
 * 不要在业务组件里写死颜色。
 */
const palette = {
  primary: "#12a150",
  primaryHover: "#0e8544",
  primaryActive: "#0b6b37",
  info: "#0e8ba8",
  success: "#12a150",
  warning: "#c07600",
  danger: "#dc2626",

  bg: "#eef1f6",
  surface: "#ffffff",
  sunken: "#f2f5f9",
  hover: "rgba(16, 24, 40, 0.035)",

  border: "rgba(16, 24, 40, 0.14)",
  borderSoft: "rgba(16, 24, 40, 0.09)",

  text: "#101828",
  textSoft: "#3d4757",
  textFaint: "#667085",
  textDisabled: "rgba(16, 24, 40, 0.3)",

  sidebar: "#ffffff",
} as const;

const radius = { xs: 8, sm: 8, md: 12, lg: 16 } as const;

const elevation = {
  low: "0 1px 2px rgba(16, 24, 40, 0.05), 0 4px 12px -4px rgba(16, 24, 40, 0.1)",
  high: "0 24px 60px -20px rgba(16, 24, 40, 0.28)",
} as const;

/** 控件三档高度，全站统一，避免同一行里输入框和按钮不等高 */
const control = { sm: 28, md: 34, lg: 40 } as const;

export const modernTheme: ThemeConfig = {
  token: {
    colorPrimary: palette.primary,
    colorSuccess: palette.success,
    colorWarning: palette.warning,
    colorError: palette.danger,
    colorInfo: palette.info,
    fontFamily: `"Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif`,
    fontSize: 13,
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
    colorLink: palette.info,
    colorLinkHover: palette.primaryHover,
    colorLinkActive: palette.primaryActive,
    motionEaseInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
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
      activeShadow: "0 0 0 3px rgba(18, 161, 80, 0.16)",
      colorBgContainer: palette.surface,
    },
    InputNumber: { controlHeight: control.md, controlHeightLG: control.lg },
    Select: {
      controlHeight: control.md,
      controlHeightLG: control.lg,
      controlHeightSM: control.sm,
      colorBgContainer: palette.surface,
      optionSelectedBg: "rgba(18, 161, 80, 0.1)",
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
    Tooltip: { borderRadius: radius.xs, colorBgSpotlight: "#101828" },
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
      itemSelectedColor: palette.primary,
      trackBg: palette.sunken,
      trackPadding: 3,
    },
    Layout: {
      headerBg: "rgba(255, 255, 255, 0.72)",
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
      rowHoverBg: "rgba(18, 161, 80, 0.035)",
      rowSelectedBg: "rgba(18, 161, 80, 0.08)",
      rowSelectedHoverBg: "rgba(18, 161, 80, 0.12)",
      cellPaddingBlock: 13,
      headerBorderRadius: 0,
    },
    Pagination: { itemActiveBg: "rgba(18, 161, 80, 0.1)", borderRadius: radius.xs },
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
