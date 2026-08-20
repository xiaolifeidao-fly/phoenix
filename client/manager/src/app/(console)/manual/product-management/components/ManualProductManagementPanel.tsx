"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Button, Drawer, Form, Input, InputNumber, Modal, Pagination, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, TimePicker, Transfer, Tooltip, Typography } from "antd";
import { message } from "@/utils/notify";
import type { ColumnsType } from "antd/es/table";
import { WorkspaceDrawer } from "@/components/manager-shell/WorkspaceDrawer";
import {
  activateManualProduct,
  createManualProduct,
  deleteManualProduct,
  deleteVideoUserRule,
  expireManualProduct,
  fetchAssignConfigsByShopTypeId,
  fetchAssignApprovalRateRule,
  fetchAssignRefundRule,
  fetchAssignUidRule,
  fetchAssignUidSwitch,
  fetchAssignVideoRule,
  fetchAssignWhitelistSwitch,
  fetchAssignWhitelistApprovalRate,
  fetchJudgeConfigsByShopTypeId,
  fetchManualProducts,
  fetchManualProductTypes,
  fetchVideoUserRules,
  saveAssignConfig,
  saveAssignApprovalRateRule,
  saveAssignRefundRule,
  saveAssignUidRule,
  saveAssignUidSwitch,
  saveAssignVideoRule,
  saveAssignWhitelistSwitch,
  saveAssignWhitelistApprovalRate,
  saveJudgeConfig,
  saveVideoUserRule,
  type AssignConfigRecord,
  updateManualProduct,
  type AssignConfigPayload,
  type JudgeConfigPayload,
  type JudgeConfigRecord,
  type ManualProductPayload,
  type ManualProductRecord,
  type ManualProductTypeRecord,
} from "../../api/product.api";
import {
  createShopGroup,
  deleteShopGroup,
  fetchShopGroups,
  updateShopGroup,
  type ShopGroupPayload,
  type ShopGroupRecord,
} from "../../product-group-management/api/product-group.api";
import {
  fetchBarryAppUsers,
  fetchBarryUserWhitelists,
  saveBarryUserWhitelist,
  updateBarryUserWhitelistGroup,
  updateBarryUserWhitelistStatus,
  type BarryAppUserRecord,
} from "../../api/user.api";

const { Text, Title } = Typography;

interface ProductFormValues {
  name: string;
  code: string;
  score: number;
  shopGroupId: number;
  shopTypeCodes: string[];
}

interface ShopGroupFormValues {
  name: string;
  code: string;
}

interface AssignConfigPreviewRecord {
  id: number;
  shopTypeId: number;
  shopTypeName: string;
  shopTypeCode: string;
  queueCode: string;
  strategyName: string;
  assignModel: string;
  assignType: string;
  queueSize: number;
  assignScale: string;
  expireTimes: number;
  loopNum: number;
  speedByHour: number;
  assignNum: number;
  batchAssignNum: number;
  monitorOrder: boolean;
  checkNowNum: boolean;
  todayDistinct: boolean;
}

interface JudgeConfigPreviewRecord {
  id: number;
  shopTypeId: number;
  shopTypeName: string;
  shopTypeCode: string;
  judgeType: string;
  againJudgeType: string;
  againJudgeFlag: boolean;
  againJudgeDelayTimes: number;
  assignConfigId: number;
}

type AssignConfigModalMode = "view" | "edit";
type DimensionSwitchKey = "user" | "uid" | "approvalRate" | "video" | "refund";
type WhitelistStatusSortOrder = "ascend" | "descend" | null;
type WhitelistGroup = "BIG_CUSTOMER" | "SMALL_CUSTOMER" | "RETAILER";
type BatchWhitelistGroup = WhitelistGroup | "UNGROUPED";

const whitelistGroupOptions: { label: string; value: WhitelistGroup }[] = [
  { label: "大户", value: "BIG_CUSTOMER" },
  { label: "小户", value: "SMALL_CUSTOMER" },
  { label: "散户", value: "RETAILER" },
];

const batchWhitelistGroupOptions: { label: string; value: BatchWhitelistGroup }[] = [
  ...whitelistGroupOptions,
  { label: "未分组", value: "UNGROUPED" },
];

const whitelistGroupLabels: Record<string, string> = {
  BIG_CUSTOMER: "大户",
  SMALL_CUSTOMER: "小户",
  RETAILER: "散户",
  大户: "大户",
  小户: "小户",
  散户: "散户",
  UNGROUPED: "未分组",
};

const getWhitelistGroupLabel = (group?: string) => {
  const normalizedGroup = group?.trim();
  return normalizedGroup ? whitelistGroupLabels[normalizedGroup] || normalizedGroup : "未分组";
};

const parseTimeRanges = (value?: string) => (value || "").split(",").map((item) => item.trim()).filter((item) => /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(item));
const formatTimeRanges = (ranges: string[]) => ranges.join(",");
const toTimeValue = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  return dayjs().hour(hour).minute(minute).second(0).millisecond(0);
};

function TimeRangeEditor({ value, onChange }: { value: string[]; onChange: (ranges: string[]) => void }) {
  return <Space direction="vertical" style={{ width: "100%" }} size={8}>
    {value.map((range, index) => {
      const [start, end] = range.split("-");
      return <Space key={`${range}-${index}`} wrap>
        <TimePicker.RangePicker
          format="HH:mm"
          minuteStep={1}
          value={[toTimeValue(start), toTimeValue(end)] as [Dayjs, Dayjs]}
          onChange={(times) => {
            if (!times?.[0] || !times?.[1]) return;
            const next = [...value];
            next[index] = `${times[0].format("HH:mm")}-${times[1].format("HH:mm")}`;
            onChange(next);
          }}
        />
        <Button danger type="text" icon={<DeleteOutlined />} onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>删除</Button>
      </Space>;
    })}
    <Button type="dashed" icon={<PlusOutlined />} onClick={() => onChange([...value, "09:00-00:00"])}>添加时间段</Button>
  </Space>;
}

interface WhitelistUserRecord {
  id?: number;
  userId: string;
  username: string;
  name: string;
  channel: string;
  group: string;
  shopCategoryId: string;
  active: boolean;
  minRecentApprovalRate?: number;
  recentApprovalRateDays?: number;
  dailyAssignTimeRanges: string;
  fetchTaskLoopNum?: number;
}

interface VideoUserStrategyRecord {
  userId: string;
  username: string;
  name: string;
  urlFilterEnabled: boolean;
  urlKeywords: string;
  urlIncludeEnabled: boolean;
  urlIncludeKeywords: string;
  adFilterEnabled: boolean;
}

interface UidRuleState {
  id?: number;
  minFansNum: number;
  minItemNum: number;
  minInteractRate?: number;
}

interface VideoRuleState {
  id?: number;
  urlFilterEnabled: boolean;
  urlKeywords: string;
  urlIncludeEnabled: boolean;
  urlIncludeKeywords: string;
  adFilterEnabled: boolean;
}

interface RefundRuleState {
  id?: number;
  refundRoundThreshold: number;
  exceptionRoundThreshold: number;
}

interface ApprovalRateRuleState {
  id?: number;
  minFansNum: number;
  recentApprovalRateDays: number;
  minRecentApprovalRate: number;
  minDailySubmitNum: number;
  dailyAssignTimeRanges: string;
  whitelistShopCategoryIds: number[];
}

const defaultInteractRate = 0.02;
const SHOP_GROUP_PAGE_SIZE = 8;

const emptyUidRule: UidRuleState = {
  minFansNum: 0,
  minItemNum: 0,
};

const suggestedUidRule: UidRuleState = {
  minFansNum: 5000,
  minItemNum: 10,
};

const emptyVideoRule: VideoRuleState = {
  urlFilterEnabled: false,
  urlKeywords: "",
  urlIncludeEnabled: false,
  urlIncludeKeywords: "",
  adFilterEnabled: false,
};

const emptyRefundRule: RefundRuleState = {
  refundRoundThreshold: 0,
  exceptionRoundThreshold: 0,
};

const emptyApprovalRateRule: ApprovalRateRuleState = {
  minFansNum: 0,
  recentApprovalRateDays: 3,
  minRecentApprovalRate: 0,
  minDailySubmitNum: 10,
  dailyAssignTimeRanges: "",
  whitelistShopCategoryIds: [],
};

const videoUrlKeywordOptions = [
  {
    label: "图文",
    value: "note",
  },
  {
    label: "视频",
    value: "video",
  },
];

export function ManualProductManagementPanel() {
  const [form] = Form.useForm<ProductFormValues>();
  const [shopGroupForm] = Form.useForm<ShopGroupFormValues>();
  const [assignConfigForm] = Form.useForm<AssignConfigPreviewRecord>();
  const [judgeConfigForm] = Form.useForm<JudgeConfigPreviewRecord>();
  const [products, setProducts] = useState<ManualProductRecord[]>([]);
  const [productTypes, setProductTypes] = useState<ManualProductTypeRecord[]>([]);
  const [shopGroups, setShopGroups] = useState<ShopGroupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shopGroupSubmitting, setShopGroupSubmitting] = useState(false);
  const [selectedShopGroupId, setSelectedShopGroupId] = useState<number | null>(null);
  const [shopGroupPageIndex, setShopGroupPageIndex] = useState(1);
  const [shopGroupModalOpen, setShopGroupModalOpen] = useState(false);
  const [editingShopGroup, setEditingShopGroup] = useState<ShopGroupRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignConfigModalOpen, setAssignConfigModalOpen] = useState(false);
  const [assignConfigModalMode, setAssignConfigModalMode] = useState<AssignConfigModalMode>("edit");
  const [editingAssignConfig, setEditingAssignConfig] = useState<AssignConfigPreviewRecord | null>(null);
  const [assignConfigRows, setAssignConfigRows] = useState<AssignConfigPreviewRecord[]>([]);
  const [assignConfigLoading, setAssignConfigLoading] = useState(false);
  const [configTab, setConfigTab] = useState<"assign" | "judge">("assign");
  const [judgeConfigModalOpen, setJudgeConfigModalOpen] = useState(false);
  const [judgeConfigModalMode, setJudgeConfigModalMode] = useState<AssignConfigModalMode>("edit");
  const [judgeConfigRows, setJudgeConfigRows] = useState<JudgeConfigPreviewRecord[]>([]);
  const [judgeConfigLoading, setJudgeConfigLoading] = useState(false);
  const [editingJudgeConfig, setEditingJudgeConfig] = useState<JudgeConfigPreviewRecord | null>(null);
  const [strategyDrawerOpen, setStrategyDrawerOpen] = useState(false);
  const [strategyProduct, setStrategyProduct] = useState<ManualProductRecord | null>(null);
  const [strategyTab, setStrategyTab] = useState<"user" | "uid" | "approvalRate" | "video" | "refund">("user");
  const [strategyDirty, setStrategyDirty] = useState(false);
  const [userWhitelistEnabled, setUserWhitelistEnabled] = useState(false);
  const [whitelistGlobalApprovalRate, setWhitelistGlobalApprovalRate] = useState(0);
  const [whitelistGlobalApprovalRateDays, setWhitelistGlobalApprovalRateDays] = useState<number | null>(3);
  const [whitelistGlobalApprovalRateSaving, setWhitelistGlobalApprovalRateSaving] = useState(false);
  const [approvalRateRuleEnabled, setApprovalRateRuleEnabled] = useState(false);
  const [approvalRateRule, setApprovalRateRule] = useState<ApprovalRateRuleState>(emptyApprovalRateRule);
  const [approvalRateRuleSaving, setApprovalRateRuleSaving] = useState(false);
  const [approvalRateRuleDirty, setApprovalRateRuleDirty] = useState(false);
  const [userWhitelistLoading, setUserWhitelistLoading] = useState(false);
  const [whitelistSaving, setWhitelistSaving] = useState(false);
  const [updatingDimensionSwitches, setUpdatingDimensionSwitches] = useState<Set<DimensionSwitchKey>>(() => new Set());
  const [updatingWhitelistIds, setUpdatingWhitelistIds] = useState<Set<number>>(() => new Set());
  const [whitelistUsers, setWhitelistUsers] = useState<WhitelistUserRecord[]>([]);
  const [whitelistTotal, setWhitelistTotal] = useState(0);
  const [whitelistPageIndex, setWhitelistPageIndex] = useState(1);
  const [whitelistPageSize, setWhitelistPageSize] = useState(10);
  const [whitelistStatusFilter, setWhitelistStatusFilter] = useState("");
  const [whitelistGroupFilter, setWhitelistGroupFilter] = useState<BatchWhitelistGroup | "">("");
  const [whitelistUserSearchKeyword, setWhitelistUserSearchKeyword] = useState("");
  const [whitelistStatusSortOrder, setWhitelistStatusSortOrder] = useState<WhitelistStatusSortOrder>(null);
  const [whitelistGroupSortOrder, setWhitelistGroupSortOrder] = useState<WhitelistStatusSortOrder>(null);
  const [appUserOptions, setAppUserOptions] = useState<BarryAppUserRecord[]>([]);
  const [appUserSearching, setAppUserSearching] = useState(false);
  const [selectedAppUserId, setSelectedAppUserId] = useState<string>();
  const [addWhitelistModalOpen, setAddWhitelistModalOpen] = useState(false);
  const [editingWhitelistUser, setEditingWhitelistUser] = useState<WhitelistUserRecord | null>(null);
  const [whitelistPolicyRate, setWhitelistPolicyRate] = useState<number | null>(null);
  const [whitelistPolicyRateDays, setWhitelistPolicyRateDays] = useState<number | null>(null);
  const [whitelistPolicyLoopNum, setWhitelistPolicyLoopNum] = useState<number | null>(null);
  const [whitelistPolicyTimeRanges, setWhitelistPolicyTimeRanges] = useState<string[]>([]);
  const [selectedWhitelistGroup, setSelectedWhitelistGroup] = useState<WhitelistGroup>("BIG_CUSTOMER");
  const [batchWhitelistModalOpen, setBatchWhitelistModalOpen] = useState(false);
  const [batchWhitelistGroup, setBatchWhitelistGroup] = useState<WhitelistGroup>("BIG_CUSTOMER");
  const [batchWhitelistUsers, setBatchWhitelistUsers] = useState<BarryAppUserRecord[]>([]);
  const [batchWhitelistTargetKeys, setBatchWhitelistTargetKeys] = useState<string[]>([]);
  const [batchUnassignedPageIndex, setBatchUnassignedPageIndex] = useState(1);
  const [batchUnassignedTotal, setBatchUnassignedTotal] = useState(0);
  const [batchGroupedPageIndex, setBatchGroupedPageIndex] = useState(1);
  const [batchGroupedTotal, setBatchGroupedTotal] = useState(0);
  const [batchCurrentGroupActiveIds, setBatchCurrentGroupActiveIds] = useState<Set<string>>(() => new Set());
  const [batchGroupAddedIds, setBatchGroupAddedIds] = useState<Set<string>>(() => new Set());
  const [batchGroupRemovedIds, setBatchGroupRemovedIds] = useState<Set<string>>(() => new Set());
  const [batchWhitelistLoading, setBatchWhitelistLoading] = useState(false);
  const [batchWhitelistSaving, setBatchWhitelistSaving] = useState(false);
  const [uidRuleEnabled, setUidRuleEnabled] = useState(false);
  const [uidRule, setUidRule] = useState<UidRuleState>(emptyUidRule);
  const [uidRuleDirty, setUidRuleDirty] = useState(false);
  const [uidRuleSaving, setUidRuleSaving] = useState(false);
  const [videoRuleEnabled, setVideoRuleEnabled] = useState(false);
  const [videoRule, setVideoRule] = useState<VideoRuleState>(emptyVideoRule);
  const [videoRuleDirty, setVideoRuleDirty] = useState(false);
  const [videoRuleSaving, setVideoRuleSaving] = useState(false);
  const [videoUserStrategies, setVideoUserStrategies] = useState<VideoUserStrategyRecord[]>([]);
  const [selectedVideoAppUserId, setSelectedVideoAppUserId] = useState<string>();
  const [videoUserStrategyModalOpen, setVideoUserStrategyModalOpen] = useState(false);
  const [editingVideoUserStrategy, setEditingVideoUserStrategy] = useState<VideoUserStrategyRecord | null>(null);
  const [refundRuleEnabled, setRefundRuleEnabled] = useState(false);
  const [refundRule, setRefundRule] = useState<RefundRuleState>(emptyRefundRule);
  const [refundRuleDirty, setRefundRuleDirty] = useState(false);
  const [refundRuleSaving, setRefundRuleSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ManualProductRecord | null>(null);
  const [filters, setFilters] = useState({
    keyword: "",
    status: "",
    shopTypeCode: "",
  });

  const selectedFormShopGroupId = Form.useWatch("shopGroupId", form);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productList, typeList, groupList] = await Promise.all([
        fetchManualProducts(),
        fetchManualProductTypes(),
        fetchShopGroups(),
      ]);
      setProducts(sortProducts(productList));
      setProductTypes(typeList);
      setShopGroups(groupList);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载人工商品失败");
      setProducts([]);
      setProductTypes([]);
      setShopGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    return products.filter((item) => {
      const matchKeyword =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.code.toLowerCase().includes(keyword);
      const matchStatus = !filters.status || resolveStatus(item.status) === filters.status;
      const matchType =
        !filters.shopTypeCode ||
        (item.shopTypeModelList ?? []).some((type) => type.code === filters.shopTypeCode);
      const matchShopGroup = !selectedShopGroupId || item.shopGroupId === selectedShopGroupId;
      return matchKeyword && matchStatus && matchType && matchShopGroup;
    });
  }, [filters, products, selectedShopGroupId]);

  const sortedWhitelistUsers = useMemo(() => {
    if (!whitelistStatusSortOrder && !whitelistGroupSortOrder) {
      return whitelistUsers;
    }
    return [...whitelistUsers].sort((left, right) => {
      if (whitelistGroupSortOrder) {
        const groupResult = getWhitelistGroupLabel(left.group).localeCompare(getWhitelistGroupLabel(right.group), "zh-CN");
        if (groupResult !== 0) {
          return whitelistGroupSortOrder === "ascend" ? groupResult : -groupResult;
        }
      }
      if (whitelistStatusSortOrder) {
        const statusResult = Number(right.active) - Number(left.active);
        if (statusResult !== 0) {
          return whitelistStatusSortOrder === "ascend" ? statusResult : -statusResult;
        }
      }
      return 0;
    });
  }, [whitelistGroupSortOrder, whitelistStatusSortOrder, whitelistUsers]);

  const productTypeOptions = useMemo(
    () =>
      productTypes.map((item) => ({
        label: item.name?.trim() ? `${item.name.trim()} (${item.code.trim()})` : item.code.trim(),
        value: item.code,
      })),
    [productTypes],
  );

  const activeShopGroups = useMemo(
    () => shopGroups.filter((group) => group.active !== false && resolveStatus(group.status || "ACTIVE") === "ACTIVE"),
    [shopGroups],
  );

  const selectedShopGroup = useMemo(
    () => activeShopGroups.find((group) => group.id === selectedShopGroupId) ?? null,
    [activeShopGroups, selectedShopGroupId],
  );

  const pagedShopGroups = useMemo(() => {
    const offset = (shopGroupPageIndex - 1) * SHOP_GROUP_PAGE_SIZE;
    return activeShopGroups.slice(offset, offset + SHOP_GROUP_PAGE_SIZE);
  }, [activeShopGroups, shopGroupPageIndex]);

  const formProductTypeOptions = useMemo(
    () => productTypes
      .filter((item) => !selectedFormShopGroupId || item.shopGroupId === Number(selectedFormShopGroupId))
      .map((item) => ({
        label: item.name?.trim() ? `${item.name.trim()} (${item.code.trim()})` : item.code.trim(),
        value: item.code,
      })),
    [productTypes, selectedFormShopGroupId],
  );

  const shopGroupLabelMap = useMemo(
    () => new Map(shopGroups.map((group) => [group.id, formatShopGroupLabel(group)])),
    [shopGroups],
  );

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(activeShopGroups.length / SHOP_GROUP_PAGE_SIZE));
    if (shopGroupPageIndex > lastPage) {
      setShopGroupPageIndex(lastPage);
    }
    if (selectedShopGroupId && !activeShopGroups.some((group) => group.id === selectedShopGroupId)) {
      setSelectedShopGroupId(null);
    }
  }, [activeShopGroups, selectedShopGroupId, shopGroupPageIndex]);

  const appUserSelectOptions = useMemo(
    () =>
      (Array.isArray(appUserOptions) ? appUserOptions : []).map((user) => ({
        label: [
          user.username || "-",
          user.channel || "-",
          getWhitelistGroupLabel(user.group || user.groupName),
          user.shopCategoryId ? `品类 ${user.shopCategoryId}` : "",
        ]
          .filter(Boolean)
          .join(" / "),
        value: String(user.userId),
      })),
    [appUserOptions],
  );

  const batchWhitelistDataSource = useMemo(
    () => batchWhitelistUsers.map((user) => ({
      key: String(user.userId),
      title: user.username || user.name || `用户 ${user.userId}`,
      description: [user.userId, user.channel || "-", getWhitelistGroupLabel(user.group || user.groupName || batchWhitelistGroup)].join(" · "),
    })),
    [batchWhitelistGroup, batchWhitelistUsers],
  );

  const openCreateModal = () => {
    setEditingProduct(null);
    form.setFieldsValue({
      name: "",
      code: "",
      score: 0,
      shopGroupId: selectedShopGroupId ?? activeShopGroups[0]?.id,
      shopTypeCodes: [],
    });
    setModalOpen(true);
  };

  const openShopGroupModal = (record?: ShopGroupRecord) => {
    setEditingShopGroup(record ?? null);
    shopGroupForm.setFieldsValue({
      name: record?.name ?? "",
      code: record?.code ?? "",
    });
    setShopGroupModalOpen(true);
  };

  const handleShopGroupSubmit = async () => {
    const values = await shopGroupForm.validateFields();
    const payload: ShopGroupPayload = {
      name: values.name.trim(),
      code: values.code.trim(),
    };
    setShopGroupSubmitting(true);
    try {
      const saved = editingShopGroup
        ? await updateShopGroup(editingShopGroup.id, payload)
        : await createShopGroup(payload);
      message.success(editingShopGroup ? "商品分组已更新" : "商品分组已创建");
      setShopGroupModalOpen(false);
      setEditingShopGroup(null);
      setSelectedShopGroupId(saved.id || selectedShopGroupId);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存商品分组失败");
    } finally {
      setShopGroupSubmitting(false);
    }
  };

  const handleDeleteShopGroup = async (record: ShopGroupRecord) => {
    setShopGroupSubmitting(true);
    try {
      await deleteShopGroup(record.id);
      if (selectedShopGroupId === record.id) {
        setSelectedShopGroupId(null);
      }
      message.success("商品分组已删除");
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除商品分组失败");
    } finally {
      setShopGroupSubmitting(false);
    }
  };

  const openStrategyDrawer = (record: ManualProductRecord) => {
    setStrategyProduct(record);
    setAssignConfigRows([]);
    setJudgeConfigRows([]);
    setConfigTab("assign");
    setStrategyTab("user");
    setStrategyDirty(false);
    setUserWhitelistEnabled(false);
    setWhitelistUsers([]);
    setWhitelistTotal(0);
    setWhitelistPageIndex(1);
    setWhitelistPageSize(10);
    setWhitelistStatusFilter("");
    setWhitelistGroupFilter("");
    setWhitelistUserSearchKeyword("");
    setWhitelistStatusSortOrder(null);
    setWhitelistGroupSortOrder(null);
    setVideoUserStrategies([]);
    setAppUserOptions([]);
    setSelectedAppUserId(undefined);
    setSelectedVideoAppUserId(undefined);
    setUidRuleEnabled(false);
    setUidRule(emptyUidRule);
    setUidRuleDirty(false);
    setVideoRuleEnabled(false);
    setVideoRule(emptyVideoRule);
    setVideoRuleDirty(false);
    setRefundRuleEnabled(false);
    setRefundRule(emptyRefundRule);
    setRefundRuleDirty(false);
    setApprovalRateRuleEnabled(false);
    setApprovalRateRule(emptyApprovalRateRule);
    setApprovalRateRuleDirty(false);
    setUpdatingDimensionSwitches(new Set());
    setEditingJudgeConfig(null);
    judgeConfigForm.resetFields();
    setStrategyDrawerOpen(true);
    void loadAssignConfigs(record);
    void loadJudgeConfigs(record);
    void loadUserWhitelists(record, 1, 10, "", "", "");
    void loadAssignDimensionRules(record);
    void loadVideoUserStrategies(record);
  };

  const loadAssignDimensionRules = async (record: ManualProductRecord) => {
    const shopCategoryId = record.id;
    if (!shopCategoryId) {
      setUserWhitelistEnabled(false);
      setUidRuleEnabled(false);
      setUidRule(emptyUidRule);
      setUidRuleDirty(false);
      setVideoRuleEnabled(false);
      setVideoRule(emptyVideoRule);
      setVideoRuleDirty(false);
      setRefundRuleEnabled(false);
      setRefundRule(emptyRefundRule);
      setRefundRuleDirty(false);
      setApprovalRateRuleEnabled(false);
      setApprovalRateRule(emptyApprovalRateRule);
      setApprovalRateRuleDirty(false);
      return;
    }
    try {
      const [loadedUidRule, loadedVideoRule, loadedRefundRule, loadedApprovalRateRule, loadedWhitelistSwitch, loadedWhitelistApprovalRate, loadedUidSwitch] = await Promise.all([
        fetchAssignUidRule(shopCategoryId),
        fetchAssignVideoRule(shopCategoryId),
        fetchAssignRefundRule(shopCategoryId),
        fetchAssignApprovalRateRule(shopCategoryId),
        fetchAssignWhitelistSwitch(shopCategoryId),
        fetchAssignWhitelistApprovalRate(shopCategoryId),
        fetchAssignUidSwitch(shopCategoryId),
      ]);
      setUserWhitelistEnabled(loadedWhitelistSwitch);
      const globalApprovalRate = Number(loadedWhitelistApprovalRate?.minRecentApprovalRate);
      const globalApprovalRateDays = Number(loadedWhitelistApprovalRate?.recentApprovalRateDays);
      setWhitelistGlobalApprovalRate(Number.isFinite(globalApprovalRate) ? globalApprovalRate * 100 : 0);
      setWhitelistGlobalApprovalRateDays(Number.isFinite(globalApprovalRateDays) && globalApprovalRateDays > 0 ? globalApprovalRateDays : null);
      setUidRuleEnabled(loadedUidSwitch);
      if (loadedUidRule) {
        setUidRule({
          id: Number(loadedUidRule.id || 0) || undefined,
          minFansNum: Number(loadedUidRule.minFansNum || 0),
          minItemNum: Number(loadedUidRule.minItemNum || 0),
          minInteractRate: loadedUidRule.minInteractRate ?? undefined,
        });
      } else {
        setUidRule(emptyUidRule);
      }
      setUidRuleDirty(false);
      if (loadedVideoRule) {
        setVideoRuleEnabled(Boolean(loadedVideoRule.enabled));
        setVideoRule({
          id: Number(loadedVideoRule.id || 0) || undefined,
          urlFilterEnabled: Boolean(loadedVideoRule.urlFilterEnabled),
          urlKeywords: loadedVideoRule.urlKeywords || "",
          urlIncludeEnabled: Boolean(loadedVideoRule.urlIncludeEnabled),
          urlIncludeKeywords: loadedVideoRule.urlIncludeKeywords || "",
          adFilterEnabled: Boolean(loadedVideoRule.adFilterEnabled),
        });
      } else {
        setVideoRuleEnabled(false);
        setVideoRule(emptyVideoRule);
      }
      setVideoRuleDirty(false);
      if (loadedRefundRule) {
        setRefundRuleEnabled(Boolean(loadedRefundRule.enabled));
        setRefundRule({
          id: Number(loadedRefundRule.id || 0) || undefined,
          refundRoundThreshold: Number(loadedRefundRule.refundRoundThreshold || 0),
          exceptionRoundThreshold: Number(loadedRefundRule.exceptionRoundThreshold || 0),
        });
      } else {
        setRefundRuleEnabled(false);
        setRefundRule(emptyRefundRule);
      }
      setRefundRuleDirty(false);
      if (loadedApprovalRateRule) {
        setApprovalRateRuleEnabled(Boolean(loadedApprovalRateRule.enabled));
        setApprovalRateRule({
          id: Number(loadedApprovalRateRule.id || 0) || undefined,
          minFansNum: Number(loadedApprovalRateRule.minFansNum || 0),
          recentApprovalRateDays: Number(loadedApprovalRateRule.recentApprovalRateDays || 3),
          minRecentApprovalRate: Number(loadedApprovalRateRule.minRecentApprovalRate || 0),
          minDailySubmitNum: Number(loadedApprovalRateRule.minDailySubmitNum ?? 10),
          dailyAssignTimeRanges: loadedApprovalRateRule.dailyAssignTimeRanges || "",
          whitelistShopCategoryIds: (loadedApprovalRateRule.whitelistShopCategoryIds || "").split(",").map(Number).filter((id) => id > 0),
        });
      } else {
        setApprovalRateRuleEnabled(false);
        setApprovalRateRule(emptyApprovalRateRule);
      }
      setApprovalRateRuleDirty(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载维度策略失败");
      setUserWhitelistEnabled(false);
      setUidRuleEnabled(false);
      setUidRule(emptyUidRule);
      setUidRuleDirty(false);
      setVideoRuleEnabled(false);
      setVideoRule(emptyVideoRule);
      setVideoRuleDirty(false);
      setRefundRuleEnabled(false);
      setRefundRule(emptyRefundRule);
      setRefundRuleDirty(false);
      setApprovalRateRuleEnabled(false);
      setApprovalRateRule(emptyApprovalRateRule);
      setApprovalRateRuleDirty(false);
    }
  };

  const loadVideoUserStrategies = async (record: ManualProductRecord) => {
    const shopCategoryId = record.id;
    if (!shopCategoryId) {
      setVideoUserStrategies([]);
      return;
    }
    try {
      const rules = await fetchVideoUserRules(shopCategoryId);
      setVideoUserStrategies(
        (Array.isArray(rules) ? rules : []).map<VideoUserStrategyRecord>((rule) => ({
          userId: String(rule.userId),
          username: rule.username || "",
          name: rule.username || "",
          urlFilterEnabled: Boolean(rule.urlFilterEnabled),
          urlKeywords: rule.urlKeywords || "",
          urlIncludeEnabled: Boolean(rule.urlIncludeEnabled),
          urlIncludeKeywords: rule.urlIncludeKeywords || "",
          adFilterEnabled: Boolean(rule.adFilterEnabled),
        })),
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载用户视频策略失败");
      setVideoUserStrategies([]);
    }
  };

  const openAssignConfigModal = (mode: AssignConfigModalMode, record?: AssignConfigPreviewRecord) => {
    setAssignConfigModalMode(mode);
    setEditingAssignConfig(record ?? null);
    assignConfigForm.setFieldsValue(record ?? {});
    setAssignConfigModalOpen(true);
  };

  const loadAssignConfigs = async (record: ManualProductRecord) => {
    const shopTypes = record.shopTypeModelList ?? [];
    if (shopTypes.length === 0) {
      setAssignConfigRows([]);
      return;
    }
    setAssignConfigLoading(true);
    try {
      const rowsByShopType = await Promise.all(
        shopTypes.map(async (shopType) => {
          const shopTypeId = Number(shopType.id || 0);
          if (!shopTypeId) {
            return [buildEmptyAssignConfigRow(record, shopType)];
          }
          const configs = await fetchAssignConfigsByShopTypeId(shopTypeId);
          if (configs.length === 0) {
            return [buildEmptyAssignConfigRow(record, shopType)];
          }
          return configs.map((config) => buildAssignConfigRow(record, shopType, config));
        }),
      );
      setAssignConfigRows(rowsByShopType.flat());
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载分配配置失败");
      setAssignConfigRows(shopTypes.map((shopType) => buildEmptyAssignConfigRow(record, shopType)));
    } finally {
      setAssignConfigLoading(false);
    }
  };

  const loadJudgeConfigs = async (record: ManualProductRecord) => {
    const shopTypes = Array.from(
      new Map(
        (record.shopTypeModelList ?? [])
          .filter((shopType) => Number(shopType.id || 0) > 0)
          .map((shopType) => [Number(shopType.id), shopType]),
      ).values(),
    );
    if (shopTypes.length === 0) {
      setJudgeConfigRows([]);
      return;
    }
    setJudgeConfigLoading(true);
    const rowsByShopType = await Promise.all(
      shopTypes.map(async (shopType) => {
        try {
          const shopTypeId = Number(shopType.id || 0);
          const configs = await fetchJudgeConfigsByShopTypeId(shopTypeId);
          if (configs.length === 0) {
            return [buildEmptyJudgeConfigRow(record, shopType)];
          }
          return configs.map((config) => buildJudgeConfigRow(record, shopType, config));
        } catch (error) {
          message.error(error instanceof Error ? error.message : `加载商品类型 ${shopType.id} 的审核配置失败`);
          return [buildEmptyJudgeConfigRow(record, shopType)];
        }
      }),
    );
    setJudgeConfigRows(rowsByShopType.flat());
    setJudgeConfigLoading(false);
  };

  const openEditModal = (record: ManualProductRecord) => {
    setEditingProduct(record);
    form.setFieldsValue({
      name: record.name,
      code: record.code,
      score: record.score,
      shopGroupId: record.shopGroupId,
      shopTypeCodes: (record.shopTypeModelList ?? []).map((item) => item.code).filter(Boolean),
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const shopGroupId = Number(values.shopGroupId);
    const selectedProductTypes = productTypes.filter((item) => values.shopTypeCodes.includes(item.code));
    if (!shopGroupId || selectedProductTypes.length !== values.shopTypeCodes.length
      || selectedProductTypes.some((item) => item.shopGroupId !== shopGroupId)) {
      message.error("商品类型必须属于所选商品分组");
      return;
    }
    const payload: ManualProductPayload = {
      name: values.name.trim(),
      code: values.code.trim(),
      score: Number(values.score || 0),
      shopGroupId,
      shopTypeCodeList: values.shopTypeCodes ?? [],
      status: editingProduct ? resolveStatus(editingProduct.status) : "ACTIVE",
    };

    setSubmitting(true);
    try {
      if (editingProduct) {
        await updateManualProduct(editingProduct.id, payload);
      } else {
        await createManualProduct(payload);
      }
      message.success(editingProduct ? "人工商品已更新" : "人工商品已创建");
      setModalOpen(false);
      setEditingProduct(null);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存人工商品失败");
    } finally {
      setSubmitting(false);
    }
  };

  const updateUidRule = (patch: Partial<UidRuleState>) => {
    setUidRule((current) => ({ ...current, ...patch }));
    setUidRuleDirty(true);
    setStrategyDirty(true);
  };

  const updateVideoRule = (patch: Partial<VideoRuleState>) => {
    setVideoRule((current) => ({ ...current, ...patch }));
    setVideoRuleDirty(true);
    setStrategyDirty(true);
  };

  const updateRefundRule = (patch: Partial<RefundRuleState>) => {
    setRefundRule((current) => ({ ...current, ...patch }));
    setRefundRuleDirty(true);
    setStrategyDirty(true);
  };

  const updateApprovalRateRule = (patch: Partial<ApprovalRateRuleState>) => {
    setApprovalRateRule((current) => ({ ...current, ...patch }));
    setApprovalRateRuleDirty(true);
    setStrategyDirty(true);
  };

  const saveApprovalRateGlobalRule = async (enabled = approvalRateRuleEnabled) => {
    const shopCategoryId = strategyProduct?.id;
    if (!shopCategoryId) {
      message.error("缺少品类信息，无法保存");
      return;
    }
    setApprovalRateRuleSaving(true);
    try {
      const saved = await saveAssignApprovalRateRule({
        id: approvalRateRule.id,
        shopCategoryId: Number(shopCategoryId),
        enabled,
        minFansNum: Number(approvalRateRule.minFansNum || 0),
        recentApprovalRateDays: Number(approvalRateRule.recentApprovalRateDays || 3),
        minRecentApprovalRate: Number(approvalRateRule.minRecentApprovalRate || 0),
        minDailySubmitNum: Number(approvalRateRule.minDailySubmitNum || 0),
        dailyAssignTimeRanges: approvalRateRule.dailyAssignTimeRanges.trim(),
        whitelistShopCategoryIds: approvalRateRule.whitelistShopCategoryIds.join(","),
      });
      if (saved) {
        setApprovalRateRuleEnabled(Boolean(saved.enabled));
        setApprovalRateRule({
          id: Number(saved.id || 0) || approvalRateRule.id,
          minFansNum: Number(saved.minFansNum || 0),
          recentApprovalRateDays: Number(saved.recentApprovalRateDays || 3),
          minRecentApprovalRate: Number(saved.minRecentApprovalRate || 0),
          minDailySubmitNum: Number(saved.minDailySubmitNum || 0),
          dailyAssignTimeRanges: saved.dailyAssignTimeRanges || "",
          whitelistShopCategoryIds: (saved.whitelistShopCategoryIds || "").split(",").map(Number).filter((id) => id > 0),
        });
      }
      setApprovalRateRuleDirty(false);
      setStrategyDirty(uidRuleDirty || videoRuleDirty || refundRuleDirty);
      message.success("审核通过率策略已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存审核通过率策略失败");
    } finally {
      setApprovalRateRuleSaving(false);
    }
  };

  const saveWhitelistGlobalApprovalRate = async () => {
    if (!strategyProduct?.id) return;
    if (!userWhitelistEnabled) {
      message.warning("请先开启白名单，再保存全局审核通过率门槛");
      return;
    }
    if (whitelistGlobalApprovalRate === 0 && whitelistGlobalApprovalRateDays === null) {
      message.warning("审核通过率为 0% 时，统计天数不能为空");
      return;
    }
    setWhitelistGlobalApprovalRateSaving(true);
    try {
      await saveAssignWhitelistApprovalRate(Number(strategyProduct.id), whitelistGlobalApprovalRate / 100, whitelistGlobalApprovalRateDays);
      message.success("白名单全局审核通过率已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存白名单全局审核通过率失败");
    } finally {
      setWhitelistGlobalApprovalRateSaving(false);
    }
  };

  const saveUidGlobalRule = async () => {
    const shopCategoryId = strategyProduct?.id;
    if (!shopCategoryId) {
      message.error("缺少品类信息，无法保存");
      return;
    }
    setUidRuleSaving(true);
    try {
      const saved = await saveAssignUidRule({
        id: uidRule.id,
        shopCategoryId: Number(shopCategoryId),
        enabled: uidRuleEnabled,
        minFansNum: Number(uidRule.minFansNum || 0),
        minItemNum: Number(uidRule.minItemNum || 0),
        minInteractRate: uidRule.minInteractRate === undefined ? undefined : Number(uidRule.minInteractRate),
      });
      if (saved && typeof saved === "object") {
        setUidRule({
          id: Number(saved.id || 0) || uidRule.id,
          minFansNum: Number(saved.minFansNum || 0),
          minItemNum: Number(saved.minItemNum || 0),
          minInteractRate: saved.minInteractRate ?? undefined,
        });
        setUidRuleEnabled(saved.enabled ?? uidRuleEnabled);
      }
      setUidRuleDirty(false);
      setStrategyDirty(videoRuleDirty || refundRuleDirty);
      message.success("uid 全局配置已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存 uid 全局配置失败");
    } finally {
      setUidRuleSaving(false);
    }
  };

  const saveVideoGlobalRule = async () => {
    const shopCategoryId = strategyProduct?.id;
    if (!shopCategoryId) {
      message.error("缺少品类信息，无法保存");
      return;
    }
    setVideoRuleSaving(true);
    try {
      const saved = await saveAssignVideoRule({
        id: videoRule.id,
        shopCategoryId: Number(shopCategoryId),
        enabled: videoRuleEnabled,
        urlFilterEnabled: videoRule.urlFilterEnabled,
        urlKeywords: videoRule.urlKeywords,
        urlIncludeEnabled: videoRule.urlIncludeEnabled,
        urlIncludeKeywords: videoRule.urlIncludeKeywords,
        adFilterEnabled: videoRule.adFilterEnabled,
      });
      if (saved && typeof saved === "object") {
        setVideoRuleEnabled(saved.enabled ?? videoRuleEnabled);
        setVideoRule({
          id: Number(saved.id || 0) || videoRule.id,
          urlFilterEnabled: Boolean(saved.urlFilterEnabled),
          urlKeywords: saved.urlKeywords || "",
          urlIncludeEnabled: Boolean(saved.urlIncludeEnabled),
          urlIncludeKeywords: saved.urlIncludeKeywords || "",
          adFilterEnabled: Boolean(saved.adFilterEnabled),
        });
      }
      setVideoRuleDirty(false);
      setStrategyDirty(uidRuleDirty || refundRuleDirty);
      message.success("视频全局配置已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存视频全局配置失败");
    } finally {
      setVideoRuleSaving(false);
    }
  };

  const saveRefundGlobalRule = async () => {
    const shopCategoryId = strategyProduct?.id;
    if (!shopCategoryId) {
      message.error("缺少品类信息，无法保存");
      return;
    }
    const refundRoundThreshold = Number(refundRule.refundRoundThreshold || 0);
    const exceptionRoundThreshold = Number(refundRule.exceptionRoundThreshold || 0);
    if (exceptionRoundThreshold > refundRoundThreshold) {
      message.error("异常打标轮次阈值应小于等于退单轮次阈值");
      return;
    }
    setRefundRuleSaving(true);
    try {
      const saved = await saveAssignRefundRule({
        id: refundRule.id,
        shopCategoryId: Number(shopCategoryId),
        enabled: refundRuleEnabled,
        refundRoundThreshold,
        exceptionRoundThreshold,
      });
      if (saved && typeof saved === "object") {
        setRefundRuleEnabled(saved.enabled ?? refundRuleEnabled);
        setRefundRule({
          id: Number(saved.id || 0) || refundRule.id,
          refundRoundThreshold: Number(saved.refundRoundThreshold || 0),
          exceptionRoundThreshold: Number(saved.exceptionRoundThreshold || 0),
        });
      }
      setRefundRuleDirty(false);
      setStrategyDirty(uidRuleDirty || videoRuleDirty);
      message.success("退单全局配置已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存退单全局配置失败");
    } finally {
      setRefundRuleSaving(false);
    }
  };

  const loadUserWhitelists = async (
    record: ManualProductRecord,
    pageIndex = whitelistPageIndex,
    pageSize = whitelistPageSize,
    status = whitelistStatusFilter,
    keyword = whitelistUserSearchKeyword,
    group = whitelistGroupFilter,
  ) => {
    const shopCategoryId = record.id;
    if (!shopCategoryId) {
      setWhitelistUsers([]);
      setWhitelistTotal(0);
      return;
    }
    setUserWhitelistLoading(true);
    try {
      const page = await fetchBarryUserWhitelists({
        pageIndex,
        pageSize,
        shopCategoryId,
        status: status || undefined,
        username: keyword.trim() || undefined,
        group: group || undefined,
      });
      const rows = (Array.isArray(page.data) ? page.data : []).map<WhitelistUserRecord>((user) => ({
        id: Number(user.id || 0) || undefined,
        userId: String(user.userId),
        username: user.username,
        name: user.name,
        channel: user.channel || "-",
        group: user.group || user.groupName || "",
        shopCategoryId: String(user.shopCategoryId || shopCategoryId),
        active: user.active !== false && user.status !== "EXPIRE" && user.status !== "INACTIVE",
        minRecentApprovalRate: user.minRecentApprovalRate ?? undefined,
        recentApprovalRateDays: user.recentApprovalRateDays ?? undefined,
        dailyAssignTimeRanges: user.dailyAssignTimeRanges || "",
        fetchTaskLoopNum: user.fetchTaskLoopNum ?? undefined,
      }));
      setWhitelistUsers(rows);
      setWhitelistTotal(page.total ?? rows.length);
      setWhitelistPageIndex(pageIndex);
      setWhitelistPageSize(pageSize);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载已配置白名单失败");
      setWhitelistUsers([]);
      setWhitelistTotal(0);
    } finally {
      setUserWhitelistLoading(false);
    }
  };

  const changeWhitelistStatusFilter = (status: string) => {
    const next = status || "";
    setWhitelistStatusFilter(next);
    setWhitelistPageIndex(1);
    if (strategyProduct) {
      void loadUserWhitelists(strategyProduct, 1, whitelistPageSize, next);
    }
  };

  const searchWhitelistUsers = (keyword: string) => {
    const next = keyword.trim();
    setWhitelistUserSearchKeyword(next);
    setWhitelistPageIndex(1);
    if (strategyProduct) {
      void loadUserWhitelists(strategyProduct, 1, whitelistPageSize, whitelistStatusFilter, next);
    }
  };

  const changeWhitelistGroupFilter = (group: BatchWhitelistGroup | "") => {
    setWhitelistGroupFilter(group);
    setWhitelistPageIndex(1);
    if (strategyProduct) {
      void loadUserWhitelists(strategyProduct, 1, whitelistPageSize, whitelistStatusFilter, whitelistUserSearchKeyword, group);
    }
  };

  const toggleWhitelistStatusSort = () => {
    setWhitelistStatusSortOrder((current) => {
      if (current === null) {
        return "ascend";
      }
      if (current === "ascend") {
        return "descend";
      }
      return null;
    });
  };

  const toggleWhitelistGroupSort = () => {
    setWhitelistGroupSortOrder((current) => {
      if (current === null) {
        return "ascend";
      }
      if (current === "ascend") {
        return "descend";
      }
      return null;
    });
  };

  const setDimensionSwitchState = (dimension: DimensionSwitchKey, enabled: boolean) => {
    if (dimension === "user") {
      setUserWhitelistEnabled(enabled);
      return;
    }
    if (dimension === "uid") {
      setUidRuleEnabled(enabled);
      return;
    }
    if (dimension === "video") {
      setVideoRuleEnabled(enabled);
      return;
    }
    if (dimension === "approvalRate") {
      setApprovalRateRuleEnabled(enabled);
      return;
    }
    setRefundRuleEnabled(enabled);
  };

  const setDimensionSwitchLoading = (dimension: DimensionSwitchKey, loading: boolean) => {
    setUpdatingDimensionSwitches((current) => {
      const next = new Set(current);
      if (loading) {
        next.add(dimension);
      } else {
        next.delete(dimension);
      }
      return next;
    });
  };

  const updateDimensionSwitch = async (dimension: DimensionSwitchKey, enabled: boolean) => {
    const shopCategoryId = strategyProduct?.id;
    if (!shopCategoryId) {
      message.error("缺少品类信息，无法更新开关");
      return;
    }
    const previous =
      dimension === "user"
        ? userWhitelistEnabled
        : dimension === "uid"
          ? uidRuleEnabled
            : dimension === "approvalRate"
              ? approvalRateRuleEnabled
              : dimension === "video"
            ? videoRuleEnabled
            : refundRuleEnabled;

    setDimensionSwitchState(dimension, enabled);
    setDimensionSwitchLoading(dimension, true);
    try {
      if (dimension === "user") {
        await saveAssignWhitelistSwitch({ shopCategoryId: Number(shopCategoryId), enabled });
      } else if (dimension === "uid") {
        await saveAssignUidSwitch({ shopCategoryId: Number(shopCategoryId), enabled });
      } else if (dimension === "approvalRate") {
        const saved = await saveAssignApprovalRateRule({
          id: approvalRateRule.id,
          shopCategoryId: Number(shopCategoryId),
          enabled,
          minFansNum: Number(approvalRateRule.minFansNum || 0),
          recentApprovalRateDays: Number(approvalRateRule.recentApprovalRateDays || 3),
          minRecentApprovalRate: Number(approvalRateRule.minRecentApprovalRate || 0),
          minDailySubmitNum: Number(approvalRateRule.minDailySubmitNum || 0),
          dailyAssignTimeRanges: approvalRateRule.dailyAssignTimeRanges.trim(),
          whitelistShopCategoryIds: approvalRateRule.whitelistShopCategoryIds.join(","),
        });
        if (saved) {
          setApprovalRateRuleEnabled(Boolean(saved.enabled));
          setApprovalRateRule({
            id: Number(saved.id || 0) || approvalRateRule.id,
            minFansNum: Number(saved.minFansNum || 0),
            recentApprovalRateDays: Number(saved.recentApprovalRateDays || 3),
            minRecentApprovalRate: Number(saved.minRecentApprovalRate || 0),
            minDailySubmitNum: Number(saved.minDailySubmitNum || 0),
            dailyAssignTimeRanges: saved.dailyAssignTimeRanges || "",
            whitelistShopCategoryIds: (saved.whitelistShopCategoryIds || "").split(",").map(Number).filter((id) => id > 0),
          });
        }
        setApprovalRateRuleDirty(false);
        setStrategyDirty(uidRuleDirty || videoRuleDirty || refundRuleDirty);
      } else if (dimension === "video") {
        const saved = await saveAssignVideoRule({
          id: videoRule.id,
          shopCategoryId: Number(shopCategoryId),
          enabled,
          urlFilterEnabled: videoRule.urlFilterEnabled,
          urlKeywords: videoRule.urlKeywords,
          urlIncludeEnabled: videoRule.urlIncludeEnabled,
          urlIncludeKeywords: videoRule.urlIncludeKeywords,
          adFilterEnabled: videoRule.adFilterEnabled,
        });
        if (saved) {
          setVideoRuleEnabled(Boolean(saved.enabled));
          setVideoRule({
            id: Number(saved.id || 0) || videoRule.id,
            urlFilterEnabled: Boolean(saved.urlFilterEnabled),
            urlKeywords: saved.urlKeywords || "",
            urlIncludeEnabled: Boolean(saved.urlIncludeEnabled),
            urlIncludeKeywords: saved.urlIncludeKeywords || "",
            adFilterEnabled: Boolean(saved.adFilterEnabled),
          });
        }
      } else {
        const saved = await saveAssignRefundRule({
          id: refundRule.id,
          shopCategoryId: Number(shopCategoryId),
          enabled,
          refundRoundThreshold: Number(refundRule.refundRoundThreshold || 0),
          exceptionRoundThreshold: Number(refundRule.exceptionRoundThreshold || 0),
        });
        if (saved) {
          setRefundRuleEnabled(Boolean(saved.enabled));
          setRefundRule({
            id: Number(saved.id || 0) || refundRule.id,
            refundRoundThreshold: Number(saved.refundRoundThreshold || 0),
            exceptionRoundThreshold: Number(saved.exceptionRoundThreshold || 0),
          });
        }
      }
      message.success(enabled ? "开关已开启" : "开关已关闭");
    } catch (error) {
      setDimensionSwitchState(dimension, previous);
      message.error(error instanceof Error ? error.message : "更新维度开关失败");
    } finally {
      setDimensionSwitchLoading(dimension, false);
    }
  };

  const searchAppUsers = async (keyword: string) => {
    const searchText = keyword.trim();
    if (!searchText) {
      setAppUserOptions([]);
      return;
    }
    setAppUserSearching(true);
    try {
      const page = await fetchBarryAppUsers({
        pageIndex: 1,
        pageSize: 20,
        username: searchText,
        shopCategoryId: strategyProduct?.id || undefined,
      });
      // fetchBarryAppUsers uses the paginated /barry/users response shape.
      setAppUserOptions(Array.isArray(page.data) ? page.data : []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "搜索 app_user 用户失败");
    } finally {
      setAppUserSearching(false);
    }
  };

  const openAddWhitelistModal = () => {
    if (!selectedAppUserId) {
      message.warning("请先搜索并选择用户");
      return;
    }
    setSelectedWhitelistGroup("BIG_CUSTOMER");
    setAddWhitelistModalOpen(true);
  };

  const addSelectedAppUser = async () => {
    const selected = appUserOptions.find((item) => String(item.userId) === selectedAppUserId);
    if (!selected) {
      message.warning("请选择有效用户");
      return;
    }
    const shopCategoryId = strategyProduct?.id;
    if (!shopCategoryId) {
      message.error("缺少品类信息，无法添加白名单");
      return;
    }
    const userId = Number(selected.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      message.error("用户编号无效，无法添加白名单");
      return;
    }
    setWhitelistSaving(true);
    try {
      await saveBarryUserWhitelist({ userId, shopCategoryId: Number(shopCategoryId), group: selectedWhitelistGroup });
      await loadUserWhitelists(strategyProduct, 1, whitelistPageSize);
      setSelectedAppUserId(undefined);
      setAddWhitelistModalOpen(false);
      message.success("白名单用户已添加");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "添加白名单用户失败");
    } finally {
      setWhitelistSaving(false);
    }
  };

  const loadBatchWhitelistUsers = async (
    group: WhitelistGroup,
    unassignedPageIndex = batchUnassignedPageIndex,
    groupedPageIndex = batchGroupedPageIndex,
  ) => {
    if (!strategyProduct?.id) {
      return;
    }
    setBatchWhitelistLoading(true);
    try {
      const [unassigned, selected] = await Promise.all([
        fetchBarryUserWhitelists({ pageIndex: unassignedPageIndex, pageSize: 50, shopCategoryId: strategyProduct.id, group: "UNGROUPED" }),
        fetchBarryUserWhitelists({ pageIndex: groupedPageIndex, pageSize: 50, shopCategoryId: strategyProduct.id, group }),
      ]);
      const users = new Map<string, BarryAppUserRecord>();
      const unassignedUsers = Array.isArray(unassigned.data) ? unassigned.data : [];
      const selectedUsers = Array.isArray(selected.data) ? selected.data : [];
      const selectedActiveIds = new Set(selectedUsers.filter((user) => user.active !== false).map((user) => String(user.userId)));
      unassignedUsers.forEach((user) => {
        users.set(String(user.userId), {
          userId: String(user.userId),
          username: user.username,
          name: user.name,
          channel: user.channel,
          group: user.group,
          groupName: user.groupName,
          phone: "",
          status: user.status,
          shopCategoryId: String(user.shopCategoryId),
        });
      });
      selectedUsers.filter((user) => user.active !== false).forEach((user) => {
        const userId = String(user.userId);
        users.set(String(user.userId), {
          userId: String(user.userId),
          username: user.username,
          name: user.name,
          channel: user.channel,
          group: user.group,
          groupName: user.groupName,
          phone: "",
          status: user.status,
          shopCategoryId: String(user.shopCategoryId),
        });
        if (batchGroupRemovedIds.has(userId)) {
          users.set(userId, { ...users.get(userId)!, group: "", groupName: "" });
        }
      });
      setBatchWhitelistUsers(
        Array.from(users.values()),
      );
      setBatchUnassignedPageIndex(unassignedPageIndex);
      setBatchUnassignedTotal(unassigned.total ?? unassignedUsers.length);
      setBatchGroupedPageIndex(groupedPageIndex);
      setBatchGroupedTotal(selected.total ?? selectedUsers.length);
      setBatchCurrentGroupActiveIds(selectedActiveIds);
      setBatchWhitelistTargetKeys(
        Array.from(users.keys()).filter((userId) =>
          (selectedActiveIds.has(userId) && !batchGroupRemovedIds.has(userId)) || batchGroupAddedIds.has(userId),
        ),
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载分组用户失败");
      setBatchWhitelistUsers([]);
      setBatchWhitelistTargetKeys([]);
      setBatchUnassignedTotal(0);
      setBatchGroupedTotal(0);
    } finally {
      setBatchWhitelistLoading(false);
    }
  };

  const openBatchWhitelistModal = () => {
    setBatchWhitelistGroup("BIG_CUSTOMER");
    setBatchUnassignedPageIndex(1);
    setBatchGroupedPageIndex(1);
    setBatchGroupAddedIds(new Set());
    setBatchGroupRemovedIds(new Set());
    setBatchWhitelistModalOpen(true);
    void loadBatchWhitelistUsers("BIG_CUSTOMER");
  };

  const searchBatchUnassignedUsers = async (keyword: string) => {
    const searchText = keyword.trim();
    if (!searchText || !strategyProduct?.id) {
      return;
    }
    const normalizedKeyword = searchText.toLowerCase();
    const foundLocally = batchWhitelistUsers.some((user) => {
      const isUnassigned = !user.group?.trim() && !user.groupName?.trim();
      const searchableText = `${user.userId} ${user.username} ${user.name} ${user.channel}`.toLowerCase();
      return isUnassigned && searchableText.includes(normalizedKeyword);
    });
    if (foundLocally) {
      return;
    }
    setBatchWhitelistLoading(true);
    try {
      const page = await fetchBarryUserWhitelists({
        pageIndex: 1,
        pageSize: 50,
        shopCategoryId: strategyProduct.id,
        group: "UNGROUPED",
        username: searchText,
      });
      const remoteUsers = Array.isArray(page.data) ? page.data : [];
      setBatchWhitelistUsers((current) => {
        const users = new Map(current.map((user) => [String(user.userId), user]));
        remoteUsers.forEach((user) => {
          users.set(String(user.userId), {
            userId: String(user.userId),
            username: user.username,
            name: user.name,
            channel: user.channel,
            group: user.group,
            groupName: user.groupName,
            phone: "",
            status: user.status,
            shopCategoryId: String(user.shopCategoryId),
          });
        });
        return Array.from(users.values());
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "搜索未分组用户失败");
    } finally {
      setBatchWhitelistLoading(false);
    }
  };

  const changeBatchWhitelistSelection = (keys: Array<string | number | bigint>, direction: "left" | "right", moveKeys: Array<string | number | bigint>) => {
    setBatchWhitelistTargetKeys(keys.map(String));
    if (direction === "right") {
      setBatchGroupAddedIds((current) => {
        const next = new Set(current);
        moveKeys.forEach((userId) => next.add(String(userId)));
        return next;
      });
      setBatchGroupRemovedIds((current) => {
        const next = new Set(current);
        moveKeys.forEach((userId) => next.delete(String(userId)));
        return next;
      });
      setBatchWhitelistUsers((current) =>
        current.map((user) => (moveKeys.map(String).includes(String(user.userId)) ? { ...user, group: batchWhitelistGroup, groupName: batchWhitelistGroup } : user)),
      );
      return;
    }
    setBatchGroupAddedIds((current) => {
      const next = new Set(current);
      moveKeys.forEach((userId) => next.delete(String(userId)));
      return next;
    });
    setBatchGroupRemovedIds((current) => {
      const next = new Set(current);
      moveKeys.filter((userId) => batchCurrentGroupActiveIds.has(String(userId))).forEach((userId) => next.add(String(userId)));
      return next;
    });
    setBatchWhitelistUsers((current) =>
      current.map((user) => (moveKeys.map(String).includes(String(user.userId)) ? { ...user, group: "", groupName: "" } : user)),
    );
  };

  const saveBatchWhitelist = async () => {
    if (!strategyProduct?.id) {
      return;
    }
    setBatchWhitelistSaving(true);
    try {
      await Promise.all([
        ...Array.from(batchGroupRemovedIds).map((userId) =>
          saveBarryUserWhitelist({ userId: Number(userId), shopCategoryId: Number(strategyProduct.id), group: undefined }),
        ),
        ...Array.from(batchGroupAddedIds).map((userId) =>
          saveBarryUserWhitelist({ userId: Number(userId), shopCategoryId: Number(strategyProduct.id), group: batchWhitelistGroup }),
        ),
      ]);
      await loadUserWhitelists(strategyProduct, 1, whitelistPageSize);
      setBatchWhitelistModalOpen(false);
      message.success("分组白名单已更新");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "批量保存白名单失败");
    } finally {
      setBatchWhitelistSaving(false);
    }
  };

  const updateWhitelistUserActive = async (user: WhitelistUserRecord, active: boolean) => {
    if (!user.id) {
      setWhitelistUsers((current) =>
        current.map((item) => (item.userId === user.userId ? { ...item, active } : item)),
      );
      setStrategyDirty(true);
      return;
    }
    const rowId = user.id;
    setUpdatingWhitelistIds((current) => new Set(current).add(rowId));
    setWhitelistUsers((current) =>
      current.map((item) => (item.id === rowId ? { ...item, active } : item)),
    );
    try {
      const updated = await updateBarryUserWhitelistStatus(rowId, active);
      const updatedActive = updated?.active ?? active;
      setWhitelistUsers((current) =>
        current.map((item) => (item.id === rowId ? { ...item, active: updatedActive } : item)),
      );
      message.success(updatedActive ? "白名单用户已生效" : "白名单用户已失效");
    } catch (error) {
      setWhitelistUsers((current) =>
        current.map((item) => (item.id === rowId ? { ...item, active: user.active } : item)),
      );
      message.error(error instanceof Error ? error.message : "更新白名单状态失败");
    } finally {
      setUpdatingWhitelistIds((current) => {
        const next = new Set(current);
        next.delete(rowId);
        return next;
      });
    }
  };

  const updateWhitelistUserGroup = async (user: WhitelistUserRecord, group: WhitelistGroup) => {
    if (!user.id || user.group === group) {
      return;
    }
    const rowId = user.id;
    setUpdatingWhitelistIds((current) => new Set(current).add(rowId));
    try {
      const updated = await updateBarryUserWhitelistGroup(rowId, group);
      const nextGroup = updated?.group || group;
      setWhitelistUsers((current) => current.map((item) => (item.id === rowId ? { ...item, group: nextGroup } : item)));
      message.success("白名单分组已更新");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "更新白名单分组失败");
    } finally {
      setUpdatingWhitelistIds((current) => {
        const next = new Set(current);
        next.delete(rowId);
        return next;
      });
    }
  };

  const saveWhitelistUserPolicy = async () => {
    if (!editingWhitelistUser || !strategyProduct?.id) return;
    setWhitelistSaving(true);
    try {
      await saveBarryUserWhitelist({
        userId: Number(editingWhitelistUser.userId),
        shopCategoryId: Number(strategyProduct.id),
        group: editingWhitelistUser.group || undefined,
        updatePolicy: true,
        minRecentApprovalRate: whitelistPolicyRate === null ? undefined : whitelistPolicyRate / 100,
        recentApprovalRateDays: whitelistPolicyRateDays === null ? undefined : whitelistPolicyRateDays,
        dailyAssignTimeRanges: formatTimeRanges(whitelistPolicyTimeRanges) || undefined,
        fetchTaskLoopNum: whitelistPolicyLoopNum === null ? undefined : whitelistPolicyLoopNum,
      });
      message.success("白名单用户策略已保存");
      setEditingWhitelistUser(null);
      await loadUserWhitelists(strategyProduct, whitelistPageIndex, whitelistPageSize);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存白名单用户策略失败");
    } finally {
      setWhitelistSaving(false);
    }
  };

  const addSelectedVideoAppUser = async () => {
    if (!selectedVideoAppUserId) {
      message.warning("请先搜索并选择用户");
      return;
    }
    const selected = appUserOptions.find((item) => String(item.userId) === selectedVideoAppUserId);
    if (!selected) {
      message.warning("请选择有效用户");
      return;
    }
    if (videoUserStrategies.some((item) => item.userId === selectedVideoAppUserId)) {
      message.warning("该用户已配置视频策略");
      return;
    }
    const shopCategoryId = strategyProduct?.id;
    if (!shopCategoryId) {
      message.error("缺少品类信息，无法分配");
      return;
    }
    const record: VideoUserStrategyRecord = {
      userId: String(selected.userId),
      username: selected.username,
      name: selected.name,
      urlFilterEnabled: true,
      urlKeywords: "",
      urlIncludeEnabled: false,
      urlIncludeKeywords: "",
      adFilterEnabled: true,
    };
    try {
      await saveVideoUserRule({
        shopCategoryId: Number(shopCategoryId),
        userId: Number(selected.userId),
        urlFilterEnabled: record.urlFilterEnabled,
        urlKeywords: record.urlKeywords,
        urlIncludeEnabled: record.urlIncludeEnabled,
        urlIncludeKeywords: record.urlIncludeKeywords,
        adFilterEnabled: record.adFilterEnabled,
      });
      await loadVideoUserStrategies(strategyProduct);
      setSelectedVideoAppUserId(undefined);
      message.success("已为该用户分配视频策略");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "分配用户视频策略失败");
    }
  };

  const removeVideoUserStrategy = async (user: VideoUserStrategyRecord) => {
    const shopCategoryId = strategyProduct?.id;
    if (!shopCategoryId) {
      message.error("缺少品类信息，无法取消");
      return;
    }
    try {
      await deleteVideoUserRule(Number(shopCategoryId), Number(user.userId));
      setVideoUserStrategies((current) => current.filter((item) => item.userId !== user.userId));
      message.success("已取消该用户的视频策略");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "取消用户视频策略失败");
    }
  };

  const openVideoUserStrategyModal = (record: VideoUserStrategyRecord) => {
    setEditingVideoUserStrategy(record);
    setVideoUserStrategyModalOpen(true);
  };

  const updateEditingVideoUserStrategy = (patch: Partial<VideoUserStrategyRecord>) => {
    setEditingVideoUserStrategy((current) => (current ? { ...current, ...patch } : current));
    setStrategyDirty(true);
  };

  const saveVideoUserStrategy = async () => {
    if (!editingVideoUserStrategy) {
      setVideoUserStrategyModalOpen(false);
      return;
    }
    const shopCategoryId = strategyProduct?.id;
    if (!shopCategoryId) {
      message.error("缺少品类信息，无法保存");
      return;
    }
    const target = editingVideoUserStrategy;
    try {
      await saveVideoUserRule({
        shopCategoryId: Number(shopCategoryId),
        userId: Number(target.userId),
        urlFilterEnabled: target.urlFilterEnabled,
        urlKeywords: target.urlKeywords,
        urlIncludeEnabled: target.urlIncludeEnabled,
        urlIncludeKeywords: target.urlIncludeKeywords,
        adFilterEnabled: target.adFilterEnabled,
      });
      setVideoUserStrategies((current) =>
        current.map((item) => (item.userId === target.userId ? target : item)),
      );
      setVideoUserStrategyModalOpen(false);
      setEditingVideoUserStrategy(null);
      message.success("用户视频策略已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存用户视频策略失败");
    }
  };

  const handleAssignConfigSubmit = async () => {
    const values = await assignConfigForm.validateFields();
    const selectedShopType = strategyProduct?.shopTypeModelList?.find((item) => Number(item.id) === Number(values.shopTypeId));
    const nextRecord: AssignConfigPreviewRecord = {
      ...values,
      id: editingAssignConfig?.id ?? -Date.now(),
      shopTypeId: Number(values.shopTypeId || 0),
      shopTypeName: selectedShopType?.name || values.shopTypeName || selectedShopType?.code || "",
      shopTypeCode: selectedShopType?.code || values.shopTypeCode || "",
      queueSize: Number(values.queueSize || 0),
      expireTimes: Number(values.expireTimes || 0),
      loopNum: Number(values.loopNum || 0),
      speedByHour: Number(values.speedByHour || 0),
      assignNum: Number(values.assignNum || 0),
      batchAssignNum: Number(values.batchAssignNum || 0),
      assignScale: String(values.assignScale || "0"),
      monitorOrder: Boolean(values.monitorOrder),
      checkNowNum: Boolean(values.checkNowNum),
      todayDistinct: Boolean(values.todayDistinct),
    };
    const payload: AssignConfigPayload = {
      id: nextRecord.id > 0 ? nextRecord.id : undefined,
      shopTypeId: nextRecord.shopTypeId,
      queueCode: nextRecord.queueCode.trim(),
      strategyName: nextRecord.strategyName,
      assignModel: nextRecord.assignModel,
      assignType: nextRecord.assignType,
      queueSize: nextRecord.queueSize,
      assignScale: Number(nextRecord.assignScale || 0),
      expireTimes: nextRecord.expireTimes,
      loopNum: nextRecord.loopNum,
      speedByHour: nextRecord.speedByHour,
      assignNum: nextRecord.assignNum,
      batchAssignNum: nextRecord.batchAssignNum,
      monitorOrder: nextRecord.monitorOrder,
      checkNowNum: nextRecord.checkNowNum,
      todayDistinct: nextRecord.todayDistinct,
    };

    setSubmitting(true);
    try {
      const saved = await saveAssignConfig(payload);
      const savedRecord = saved
        ? buildAssignConfigRow(strategyProduct, selectedShopType, saved)
        : nextRecord;
      setAssignConfigRows((current) =>
        current.map((item) => (isSameAssignConfigRow(item, editingAssignConfig) ? savedRecord : item)),
      );
      setAssignConfigModalOpen(false);
      setEditingAssignConfig(null);
      setStrategyDirty(true);
      message.success(payload.id ? "分配配置已更新" : "分配配置已新增");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存分配配置失败");
    } finally {
      setSubmitting(false);
    }
  };

  const openJudgeConfigModal = (mode: AssignConfigModalMode, record: JudgeConfigPreviewRecord) => {
    setJudgeConfigModalMode(mode);
    setEditingJudgeConfig(record);
    judgeConfigForm.setFieldsValue(record);
    setJudgeConfigModalOpen(true);
  };

  const handleJudgeConfigSubmit = async () => {
    const values = await judgeConfigForm.validateFields();
    const selectedShopType = strategyProduct?.shopTypeModelList?.find((item) => Number(item.id) === Number(values.shopTypeId));
    const nextRecord: JudgeConfigPreviewRecord = {
      ...values,
      id: editingJudgeConfig?.id ?? 0,
      shopTypeId: Number(values.shopTypeId || 0),
      shopTypeName: selectedShopType?.name || values.shopTypeName || selectedShopType?.code || "",
      shopTypeCode: selectedShopType?.code || values.shopTypeCode || "",
      judgeType: values.judgeType,
      againJudgeType: values.againJudgeType || "",
      againJudgeFlag: Boolean(values.againJudgeFlag),
      againJudgeDelayTimes: Number(values.againJudgeDelayTimes || 0),
      assignConfigId: Number(values.assignConfigId || 0),
    };
    const payload: JudgeConfigPayload = {
      id: nextRecord.id > 0 ? nextRecord.id : undefined,
      shopTypeId: nextRecord.shopTypeId,
      judgeType: nextRecord.judgeType,
      againJudgeType: nextRecord.againJudgeType || undefined,
      againJudgeFlag: nextRecord.againJudgeFlag,
      againJudgeDelayTimes: nextRecord.againJudgeDelayTimes,
      assignConfigId: nextRecord.assignConfigId,
    };

    setSubmitting(true);
    try {
      const saved = await saveJudgeConfig(payload);
      const savedRecord = saved
        ? buildJudgeConfigRow(strategyProduct, selectedShopType, saved)
        : nextRecord;
      setJudgeConfigRows((current) =>
        current.map((item) => (isSameJudgeConfigRow(item, editingJudgeConfig) ? savedRecord : item)),
      );
      setJudgeConfigModalOpen(false);
      setEditingJudgeConfig(null);
      judgeConfigForm.resetFields();
      message.success(payload.id ? "审核配置已更新" : "审核配置已新增");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存审核配置失败");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<ManualProductRecord> = [
    {
      title: "商品ID",
      dataIndex: "id",
      width: 100,
      render: (value: number) => <Text code>{value || "-"}</Text>,
    },
    {
      title: "商品名称",
      dataIndex: "name",
      width: 220,
      render: (value: string, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ color: "var(--manager-text)", fontWeight: 600 }}>{value || "-"}</Text>
          <Text type="secondary">{record.code || "-"}</Text>
        </Space>
      ),
    },
    {
      title: "积分",
      dataIndex: "score",
      width: 110,
      render: (value: number) => value ?? 0,
    },
    {
      title: "商品分组",
      dataIndex: "shopGroupId",
      width: 210,
      render: (value: number) => shopGroupLabelMap.get(Number(value)) || `分组 #${value || "-"}`,
    },
    {
      title: "商品类型",
      dataIndex: "shopTypeModelList",
      width: 320,
      render: (value?: ManualProductTypeRecord[]) =>
        value && value.length > 0 ? (
          <Space size={[6, 6]} wrap>
            {value.map((item) => (
              <Tag key={`${item.code}-${item.id}`} color="blue">
                {item.name || item.code}
              </Tag>
            ))}
          </Space>
        ) : (
          "-"
        ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (value: string) => (
        <Tag color={resolveStatus(value) === "ACTIVE" ? "green" : "default"}>
          {resolveStatus(value) === "ACTIVE" ? "启用" : "失效"}
        </Tag>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updatedTime",
      width: 180,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 300,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="分配策略">
            <Button type="text" icon={<SettingOutlined />} onClick={() => openStrategyDrawer(record)}>
              分配策略
            </Button>
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          </Tooltip>
          {resolveStatus(record.status) === "ACTIVE" ? (
            <Tooltip title="失效">
              <Button
                type="text"
                icon={<ArrowDownOutlined />}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await expireManualProduct(record.id);
                    message.success("人工商品已失效");
                    await loadData();
                  } catch (error) {
                    message.error(error instanceof Error ? error.message : "人工商品失效失败");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              />
            </Tooltip>
          ) : (
            <Tooltip title="启用">
              <Button
                type="text"
                icon={<ArrowUpOutlined />}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await activateManualProduct(record.id);
                    message.success("人工商品已启用");
                    await loadData();
                  } catch (error) {
                    message.error(error instanceof Error ? error.message : "人工商品启用失败");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="确认删除这个人工商品吗？"
            okText="删除"
            cancelText="取消"
            onConfirm={async () => {
              setSubmitting(true);
              try {
                await deleteManualProduct(record.id);
                message.success("人工商品已删除");
                await loadData();
              } catch (error) {
                message.error(error instanceof Error ? error.message : "删除人工商品失败");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Tooltip title="删除">
              <Button danger type="text" icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="manager-page-stack">
      <section className="manual-product-workbench">
        <aside className="manager-data-card manual-product-group-panel">
          <div className="manual-product-group-panel__header">
            <div>
              <div className="manager-section-label">商品分组</div>
              <Text style={{ color: "var(--manager-text-soft)", fontSize: 12 }}>{activeShopGroups.length} 个分组</Text>
            </div>
            <Space size={2}>
              <Tooltip title="刷新商品分组">
                <Button type="text" icon={<ReloadOutlined />} loading={loading} onClick={() => void loadData()} />
              </Tooltip>
              <Tooltip title="新建商品分组">
                <Button type="text" icon={<PlusOutlined />} onClick={() => openShopGroupModal()} />
              </Tooltip>
            </Space>
          </div>

          <div className="manual-product-group-list">
            <div
              className={`manual-product-group-list__item${selectedShopGroupId === null ? " manual-product-group-list__item--selected" : ""}`}
              onClick={() => setSelectedShopGroupId(null)}
            >
              <span className="manual-product-group-list__code">全部</span>
              <span className="manual-product-group-list__name">人工商品</span>
            </div>
            {pagedShopGroups.map((group) => (
              <div
                key={group.id}
                className={`manual-product-group-list__item${selectedShopGroupId === group.id ? " manual-product-group-list__item--selected" : ""}`}
                onClick={() => setSelectedShopGroupId(group.id)}
              >
                <div className="manual-product-group-list__value">
                  <span className="manual-product-group-list__code">{group.code || "-"}</span>
                  <span className="manual-product-group-list__name">{group.name || "-"}</span>
                </div>
                <Space size={0} className="manual-product-group-list__actions" onClick={(event) => event.stopPropagation()}>
                  <Tooltip title="编辑商品分组">
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openShopGroupModal(group)} />
                  </Tooltip>
                  <Popconfirm
                    title="确认删除这个商品分组吗？"
                    description="删除后该分组不再用于人工商品筛选。"
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => handleDeleteShopGroup(group)}
                  >
                    <Tooltip title="删除商品分组">
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={shopGroupSubmitting} />
                    </Tooltip>
                  </Popconfirm>
                </Space>
              </div>
            ))}
          </div>

          <Pagination
            className="manual-product-group-panel__pagination"
            size="small"
            current={shopGroupPageIndex}
            pageSize={SHOP_GROUP_PAGE_SIZE}
            total={activeShopGroups.length}
            showSizeChanger={false}
            hideOnSinglePage
            onChange={setShopGroupPageIndex}
          />
        </aside>

        <main className="manual-product-content">
          <section className="manager-data-card manager-toolbar-panel">
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
              <Space wrap size={12}>
                <Input
                  className="manager-filter-input"
                  placeholder="搜索名称或编码"
                  prefix={<SearchOutlined />}
                  value={filters.keyword}
                  onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
                  style={{ width: 260, maxWidth: "100%", height: 44 }}
                />
                <Select
                  allowClear
                  placeholder="筛选状态"
                  value={filters.status || undefined}
                  onChange={(value) => setFilters((current) => ({ ...current, status: value ?? "" }))}
                  options={[
                    { label: "启用", value: "ACTIVE" },
                    { label: "失效", value: "EXPIRE" },
                  ]}
                  style={{ width: 160 }}
                />
                <Select
                  allowClear
                  showSearch
                  placeholder="筛选商品类型"
                  value={filters.shopTypeCode || undefined}
                  onChange={(value) => setFilters((current) => ({ ...current, shopTypeCode: value ?? "" }))}
                  options={productTypeOptions}
                  style={{ width: 240 }}
                  optionFilterProp="label"
                />
                {selectedShopGroup ? (
                  <Tag closable onClose={() => setSelectedShopGroupId(null)}>{formatShopGroupLabel(selectedShopGroup)}</Tag>
                ) : null}
                <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadData()}>
                  刷新
                </Button>
              </Space>

              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                新建人工商品
              </Button>
            </div>
          </section>

          <section className="manager-data-card manager-table">
            <Table<ManualProductRecord>
              rowKey="id"
              loading={loading}
              dataSource={filteredProducts}
              columns={columns}
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
              }}
              scroll={{ x: 1440 }}
              locale={{ emptyText: "暂无人工商品数据" }}
            />
          </section>
        </main>
      </section>

      <WorkspaceDrawer
        title={editingProduct ? "编辑人工商品" : "新建人工商品"}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingProduct(null);
        }}
        onSubmit={handleSubmit}
        okText={editingProduct ? "保存人工商品" : "创建人工商品"}
        submitting={submitting}
        width={620}
      >
        <Form<ProductFormValues> className="manager-form-skin" form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label="商品名称" rules={[{ required: true, message: "请输入商品名称" }]}>
            <Input placeholder="例如：人工点赞" />
          </Form.Item>
          <Form.Item name="code" label="商品编码" rules={[{ required: true, message: "请输入商品编码" }]}>
            <Input placeholder="例如：MANUAL_LIKE" />
          </Form.Item>
          <Form.Item name="score" label="积分" rules={[{ required: true, message: "请输入积分" }]} initialValue={0}>
            <InputNumber min={0} precision={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="shopGroupId" label="商品分组" rules={[{ required: true, message: "请选择商品分组" }]}>
            <Select
              allowClear
              showSearch
              placeholder="请选择商品分组"
              options={activeShopGroups.map((group) => ({ label: formatShopGroupLabel(group), value: group.id }))}
              optionFilterProp="label"
              onChange={() => form.setFieldValue("shopTypeCodes", [])}
            />
          </Form.Item>
          <Form.Item name="shopTypeCodes" label="商品类型" rules={[{ required: true, message: "请选择关联商品类型" }]}>
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder="请选择关联商品类型"
              options={formProductTypeOptions}
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </WorkspaceDrawer>

      <WorkspaceDrawer
        title={editingShopGroup ? "编辑商品分组" : "新建商品分组"}
        open={shopGroupModalOpen}
        onClose={() => {
          setShopGroupModalOpen(false);
          setEditingShopGroup(null);
        }}
        onSubmit={handleShopGroupSubmit}
        okText={editingShopGroup ? "保存分组" : "创建分组"}
        submitting={shopGroupSubmitting}
        width={460}
      >
        <Form<ShopGroupFormValues> className="manager-form-skin" form={shopGroupForm} layout="vertical" preserve={false}>
          <Form.Item name="code" label="分组编码" rules={[{ required: true, message: "请输入分组编码" }]}>
            <Input placeholder="例如：MANUAL_VIDEO" />
          </Form.Item>
          <Form.Item name="name" label="分组名称" rules={[{ required: true, message: "请输入分组名称" }]}>
            <Input placeholder="例如：人工视频商品" />
          </Form.Item>
        </Form>
      </WorkspaceDrawer>

      <Modal
        title={
          assignConfigModalMode === "view"
              ? "查看分配配置"
              : "编辑分配配置"
        }
        open={assignConfigModalOpen}
        onCancel={() => {
          setAssignConfigModalOpen(false);
          setEditingAssignConfig(null);
        }}
        onOk={() => void handleAssignConfigSubmit()}
        confirmLoading={submitting}
        okText={assignConfigModalMode === "view" ? "关闭" : "保存"}
        cancelText="取消"
        width={860}
        destroyOnClose
        footer={
          assignConfigModalMode === "view"
            ? [
                <Button
                  key="close"
                  type="primary"
                  onClick={() => {
                    setAssignConfigModalOpen(false);
                    setEditingAssignConfig(null);
                  }}
                >
                  关闭
                </Button>,
              ]
            : undefined
        }
      >
        <Form<AssignConfigPreviewRecord>
          form={assignConfigForm}
          layout="vertical"
          preserve={false}
          disabled={assignConfigModalMode === "view"}
        >
          <div style={strategyStyles.formGrid}>
            <Form.Item name="shopTypeId" label="商品类型" rules={[{ required: true, message: "请选择商品类型" }]}>
              <Select
                placeholder="请选择商品类型"
                options={(strategyProduct?.shopTypeModelList ?? []).map((item) => ({
                  label: `${item.name || item.code || item.id} (${item.code || item.id})`,
                  value: Number(item.id || 0),
                }))}
                onChange={(value) => {
                  const selected = strategyProduct?.shopTypeModelList?.find((item) => Number(item.id) === Number(value));
                  assignConfigForm.setFieldsValue({
                    shopTypeName: selected?.name || selected?.code || "",
                    shopTypeCode: selected?.code || "",
                  });
                }}
              />
            </Form.Item>
            <Form.Item name="queueCode" label="队列编码" rules={[{ required: true, message: "请输入队列编码" }]}>
              <Input placeholder="例如：MANUAL_LIKE_DY_QUEUE" />
            </Form.Item>
            <Form.Item name="strategyName" label="分配策略" rules={[{ required: true, message: "请选择分配策略" }]}>
              <Select
                options={[
                  { label: "单条分配", value: "SINGLE_ASSIGN" },
                  { label: "批量分配", value: "BATCH_ASSIGN" },
                ]}
              />
            </Form.Item>
            <Form.Item name="assignModel" label="分配模式" rules={[{ required: true, message: "请选择分配模式" }]}>
              <Select
                options={[
                  { label: "顺序分配", value: "顺序分配" },
                  { label: "按桶分配", value: "按桶分配" },
                  { label: "延迟分配", value: "延迟分配" },
                ]}
              />
            </Form.Item>
            <Form.Item name="assignType" label="分配类型">
              <Input placeholder="例如：普通 / 优先" />
            </Form.Item>
            <Form.Item name="queueSize" label="队列容量">
              <InputNumber min={0} precision={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="assignScale" label="分配比例">
              <InputNumber min={0} precision={2} stringMode style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="expireTimes" label="过期时间（秒）">
              <InputNumber min={0} precision={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="loopNum" label="重试次数">
              <InputNumber min={0} precision={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="speedByHour" label="每小时速度">
              <InputNumber min={0} precision={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="assignNum" label="单次分配数">
              <InputNumber min={0} precision={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="batchAssignNum" label="批量分配数">
              <InputNumber min={0} precision={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="monitorOrder" label="监控订单" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="checkNowNum" label="检查当前数量" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="todayDistinct" label="当天去重" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <Form.Item name="shopTypeName" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="shopTypeCode" hidden>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={judgeConfigModalMode === "view" ? "查看审核配置" : "修改审核配置"}
        open={judgeConfigModalOpen}
        onCancel={() => {
          setJudgeConfigModalOpen(false);
          setEditingJudgeConfig(null);
          judgeConfigForm.resetFields();
        }}
        onOk={() => void handleJudgeConfigSubmit()}
        confirmLoading={submitting}
        okText={judgeConfigModalMode === "view" ? "关闭" : "保存"}
        cancelText="取消"
        width={860}
        destroyOnClose
        footer={
          judgeConfigModalMode === "view"
            ? [
                <Button
                  key="close"
                  type="primary"
                  onClick={() => {
                    setJudgeConfigModalOpen(false);
                    setEditingJudgeConfig(null);
                    judgeConfigForm.resetFields();
                  }}
                >
                  关闭
                </Button>,
              ]
            : undefined
        }
      >
        <Form<JudgeConfigPreviewRecord>
          form={judgeConfigForm}
          layout="vertical"
          preserve={false}
          disabled={judgeConfigModalMode === "view"}
        >
          <div style={strategyStyles.formGrid}>
            <Form.Item name="shopTypeId" label="商品类型" rules={[{ required: true, message: "请选择商品类型" }]}>
              <Select
                placeholder="请选择商品类型"
                options={(strategyProduct?.shopTypeModelList ?? []).map((item) => ({
                  label: `${item.name || item.code || item.id} (${item.code || item.id})`,
                  value: Number(item.id || 0),
                }))}
                disabled
              />
            </Form.Item>
            <Form.Item name="judgeType" label="审核类型" rules={[{ required: true, message: "请选择审核类型" }]}>
              <Select
                options={[
                  { label: "按数量审核", value: "JUDGE_BY_NUM" },
                  { label: "按数量批量审核", value: "JUDGE_BATCH_BY_NUM" },
                  { label: "按数量并指定用户审核", value: "JUDGE_BY_NUM_WITH_USER" },
                  { label: "用户提交审核", value: "JUDGE_BY_USER_SUBMIT" },
                ]}
              />
            </Form.Item>
            <Form.Item name="againJudgeType" label="二次审核类型">
              <Select
                allowClear
                placeholder="不启用二次审核时可不选"
                options={[{ label: "时间戳审核", value: "TIME_STAMP_JUDGE_TYPE" }]}
              />
            </Form.Item>
            <Form.Item name="againJudgeFlag" label="开启二次审核" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="againJudgeDelayTimes" label="二次审核延迟时间（秒）">
              <InputNumber min={0} precision={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="assignConfigId" label="分配配置" rules={[{ required: true, message: "请选择分配配置" }]}>
              <Select
                placeholder="请选择商品类型对应的分配配置"
                options={assignConfigRows
                  .filter((item) => item.shopTypeId === judgeConfigForm.getFieldValue("shopTypeId") && item.id > 0)
                  .map((item) => ({
                    label: `${item.strategyName || item.queueCode || "未命名配置"}（ID ${item.id}）`,
                    value: item.id,
                  }))}
              />
            </Form.Item>
          </div>
          <Form.Item name="shopTypeName" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="shopTypeCode" hidden>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        placement="right"
        width="70vw"
        open={strategyDrawerOpen}
        onClose={() => setStrategyDrawerOpen(false)}
        destroyOnClose
        closable={false}
        styles={{
          header: { display: "none" },
          body: {
            padding: 0,
            background: "#eef1f6",
          },
        }}
      >
        {strategyProduct ? (
          <div style={strategyStyles.app}>
            <div style={strategyStyles.crumb}>
              分配管理 &nbsp;/&nbsp; <strong style={{ color: "#4f5967" }}>过滤策略</strong> &nbsp;/&nbsp;{" "}
              {strategyProduct.name || "-"}
            </div>

            <div style={strategyStyles.header}>
              <div style={strategyStyles.glyph}>{getProductGlyph(strategyProduct)}</div>
              <div style={{ minWidth: 0 }}>
                <Title level={2} style={strategyStyles.title}>
                  {strategyProduct.name || "-"}
                </Title>
                <div style={strategyStyles.metaLine}>
                  <span>
                    code <code style={strategyStyles.code}>{strategyProduct.code || "-"}</code>
                  </span>
                  <span>
                    shopCategoryId <code style={strategyStyles.code}>{strategyProduct.id || "-"}</code>
                  </span>
                </div>
              </div>
              <div style={strategyStyles.saveBar}>
                {strategyDirty ? (
                  <span style={strategyStyles.dirty}>
                    <i style={strategyStyles.dirtyDot} />
                    有未保存改动
                  </span>
                ) : null}
              </div>
            </div>

            <section style={{ ...strategyStyles.card, marginBottom: 22 }}>
              <div style={strategyStyles.cardBody}>
                <Tabs
                  activeKey={configTab}
                  onChange={(key) => setConfigTab(key as "assign" | "judge")}
                  items={[
                    {
                      key: "assign",
                      label: "分配配置",
                      children: (
                        <Table<AssignConfigPreviewRecord>
                          rowKey={(record) => `${record.shopTypeId}-${record.id || "empty"}`}
                          size="small"
                          loading={assignConfigLoading}
                          dataSource={assignConfigRows}
                          pagination={false}
                          scroll={{ x: 1320 }}
                          locale={{ emptyText: "当前商品暂无关联商品类型，暂不能匹配分配配置" }}
                          columns={[
                            {
                              title: "商品类型",
                              dataIndex: "shopTypeName",
                              width: 190,
                              fixed: "left",
                              render: (value: string, record) => (
                                <Space direction="vertical" size={0}>
                                  <Text strong>{value || "-"}</Text>
                                  <Text type="secondary">
                                    {record.shopTypeCode || "-"} · ID {record.shopTypeId || "-"}
                                  </Text>
                                  {record.id <= 0 ? <Tag color="gold">待配置</Tag> : null}
                                </Space>
                              ),
                            },
                            {
                              title: "队列编码",
                              dataIndex: "queueCode",
                              width: 180,
                              render: (value: string) => <code style={strategyStyles.inlineCode}>{value}</code>,
                            },
                            {
                              title: "分配策略",
                              dataIndex: "strategyName",
                              width: 110,
                              render: (value: string) => <Tag color="cyan">{formatAssignStrategyName(value)}</Tag>,
                            },
                            {
                              title: "分配模式",
                              dataIndex: "assignModel",
                              width: 120,
                            },
                            {
                              title: "分配类型",
                              dataIndex: "assignType",
                              width: 120,
                              render: (value: string) => formatAssignType(value),
                            },
                            {
                              title: "队列容量",
                              dataIndex: "queueSize",
                              width: 100,
                            },
                            {
                              title: "分配比例",
                              dataIndex: "assignScale",
                              width: 90,
                            },
                            {
                              title: "过期/重试",
                              key: "expireLoop",
                              width: 120,
                              render: (_, record) => `${record.expireTimes}s / ${record.loopNum}次`,
                            },
                            {
                              title: "每小时速度",
                              dataIndex: "speedByHour",
                              width: 100,
                              render: (value: number) => `${value}/h`,
                            },
                            {
                              title: "单次/批量",
                              key: "assignNum",
                              width: 110,
                              render: (_, record) => `${record.assignNum} / ${record.batchAssignNum}`,
                            },
                            {
                              title: "控制项",
                              key: "flags",
                              width: 210,
                              render: (_, record) => (
                                <Space size={[4, 4]} wrap>
                                  <Tag color={record.monitorOrder ? "green" : "default"}>监控订单</Tag>
                                  <Tag color={record.checkNowNum ? "green" : "default"}>检查当前数量</Tag>
                                  <Tag color={record.todayDistinct ? "blue" : "default"}>当天去重</Tag>
                                </Space>
                              ),
                            },
                            {
                              title: "操作",
                              key: "actions",
                              fixed: "right",
                              width: 120,
                              render: (_, record) => (
                                <Space size={4}>
                                  <Button type="link" size="small" onClick={() => openAssignConfigModal("view", record)}>
                                    查看
                                  </Button>
                                  <Button type="link" size="small" onClick={() => openAssignConfigModal("edit", record)}>
                                    编辑
                                  </Button>
                                </Space>
                              ),
                            },
                          ]}
                        />
                      ),
                    },
                    {
                      key: "judge",
                      label: "审核配置",
                      children: (
                        <Table<JudgeConfigPreviewRecord>
                          rowKey={(record) => `${record.shopTypeId}-${record.id || "empty"}`}
                          size="small"
                          loading={judgeConfigLoading}
                          dataSource={judgeConfigRows}
                          pagination={false}
                          scroll={{ x: 1120 }}
                          locale={{ emptyText: "当前商品暂无关联商品类型，暂不能匹配审核配置" }}
                          columns={[
                            {
                              title: "商品类型",
                              dataIndex: "shopTypeName",
                              width: 190,
                              fixed: "left",
                              render: (value: string, record) => (
                                <Space direction="vertical" size={0}>
                                  <Text strong>{value || "-"}</Text>
                                  <Text type="secondary">
                                    {record.shopTypeCode || "-"} · ID {record.shopTypeId || "-"}
                                  </Text>
                                  {record.id <= 0 ? <Tag color="gold">待配置</Tag> : null}
                                </Space>
                              ),
                            },
                            {
                              title: "审核类型",
                              dataIndex: "judgeType",
                              width: 180,
                              render: (value: string) => formatJudgeType(value),
                            },
                            {
                              title: "二次审核类型",
                              dataIndex: "againJudgeType",
                              width: 160,
                              render: (value: string) => formatAgainJudgeType(value),
                            },
                            {
                              title: "二次审核",
                              dataIndex: "againJudgeFlag",
                              width: 110,
                              render: (value: boolean) => <Tag color={value ? "green" : "default"}>{value ? "已开启" : "未开启"}</Tag>,
                            },
                            {
                              title: "延迟时间",
                              dataIndex: "againJudgeDelayTimes",
                              width: 120,
                              render: (value: number) => `${value || 0}s`,
                            },
                            {
                              title: "分配配置编码",
                              dataIndex: "assignConfigId",
                              width: 160,
                              render: (value: number) => {
                                const assignConfig = assignConfigRows.find((item) => item.id === value);
                                return <Text code>{assignConfig?.queueCode || "-"}</Text>;
                              },
                            },
                            {
                              title: "操作",
                              key: "actions",
                              fixed: "right",
                              width: 120,
                              render: (_, record) => (
                                <Space size={4}>
                                  <Button type="link" size="small" onClick={() => openJudgeConfigModal("view", record)}>
                                    查看
                                  </Button>
                                  <Button type="link" size="small" onClick={() => openJudgeConfigModal("edit", record)}>
                                    {record.id > 0 ? "修改" : "配置"}
                                  </Button>
                                </Space>
                              ),
                            },
                          ]}
                        />
                      ),
                    },
                  ]}
                />
              </div>
            </section>

            <div style={strategyStyles.tabs}>
              {[
                { key: "user" as const, index: 1, label: "用户ID维度", on: userWhitelistEnabled },
                { key: "uid" as const, index: 2, label: "uid 维度", on: uidRuleEnabled },
                { key: "approvalRate" as const, index: 3, label: "审核通过率维度", on: approvalRateRuleEnabled },
                { key: "video" as const, index: 4, label: "视频维度", on: videoRuleEnabled },
                { key: "refund" as const, index: 5, label: "退单维度", on: refundRuleEnabled },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  style={{
                    ...strategyStyles.tab,
                    ...(strategyTab === item.key ? strategyStyles.tabActive : null),
                  }}
                  onClick={() => setStrategyTab(item.key)}
                >
                  <span style={{ ...strategyStyles.tabNumber, ...(strategyTab === item.key ? strategyStyles.tabNumberActive : null) }}>
                    {item.index}
                  </span>
                  {item.label}
                  <span style={{ ...strategyStyles.statusDot, ...(item.on ? strategyStyles.statusDotOn : null) }} />
                </button>
              ))}
            </div>

            {strategyTab === "user" ? (
              <section style={strategyStyles.card}>
                <div style={strategyStyles.cardHead}>
                  <div style={{ flex: 1 }}>
                    <div style={strategyStyles.cardTitle}>用户ID维度 · 白名单</div>
                    <div style={strategyStyles.cardDesc}>
                      开启白名单：仅名单内且生效的用户能拿本品类的单；关闭则不限制，任意用户均可获取。
                    </div>
                  </div>
                  <span style={strategyStyles.phase}>前置 · 1分钟后生效</span>
                  <Switch
                    checked={userWhitelistEnabled}
                    loading={updatingDimensionSwitches.has("user")}
                    onChange={(checked) => void updateDimensionSwitch("user", checked)}
                  />
                </div>
                <div style={strategyStyles.cardBody}>
                  <div style={{ ...strategyStyles.criteriaRow, marginBottom: 20 }}>
                    <div style={{ flex: 1 }}>
                      <div style={strategyStyles.criteriaName}>近几日审核通过率 <code style={strategyStyles.operator}>通过率 ≥</code></div>
                      <div style={strategyStyles.criteriaDesc}>白名单用户的全局接单门槛；填 0% 表示不限制。通过率不为 0% 时统计天数可留空，留空按默认 3 日统计。</div>
                    </div>
                    <Space size={8}>
                      <InputNumber value={whitelistGlobalApprovalRateDays} min={1} precision={0} addonAfter="日" placeholder="可留空" style={{ width: 110 }} onChange={(value) => setWhitelistGlobalApprovalRateDays(value === null ? null : Number(value))} />
                      <InputNumber value={whitelistGlobalApprovalRate} min={0} max={100} precision={2} addonAfter="%" style={{ width: 150 }} onChange={(value) => setWhitelistGlobalApprovalRate(Number(value || 0))} />
                      <Button icon={<SaveOutlined />} loading={whitelistGlobalApprovalRateSaving} onClick={() => void saveWhitelistGlobalApprovalRate()}>保存</Button>
                    </Space>
                  </div>
                  <div style={{ ...strategyStyles.addRow, marginTop: 0, marginBottom: 28 }}>
                    <Select
                      size="large"
                      showSearch
                      allowClear
                      filterOption={false}
                      value={selectedAppUserId}
                      placeholder="搜索并选择用户后添加（app_user 表）"
                      loading={appUserSearching}
                      options={appUserSelectOptions}
                      notFoundContent={appUserSearching ? "搜索中..." : "请输入用户名搜索 app_user"}
                      onSearch={(value) => void searchAppUsers(value)}
                      onChange={(value) => setSelectedAppUserId(value)}
                    />
                    <Button size="large" loading={whitelistSaving} onClick={openAddWhitelistModal}>
                      添加
                    </Button>
                  </div>

                  <div style={{ ...strategyStyles.label, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <span>
                      白名单用户{" "}
                      <span style={strategyStyles.required}>
                        {userWhitelistLoading
                          ? "加载中..."
                          : `${whitelistTotal} 个用户，本页 ${whitelistUsers.filter((item) => item.active).length} 生效`}
                      </span>
                    </span>
                    <Space size={8} wrap>
                      <Select
                        size="small"
                        value={whitelistStatusFilter || "ALL"}
                        style={{ width: 120 }}
                        onChange={(value) => changeWhitelistStatusFilter(value === "ALL" ? "" : value)}
                        options={[
                          { label: "全部", value: "ALL" },
                          { label: "生效", value: "ACTIVE" },
                          { label: "失效", value: "INACTIVE" },
                        ]}
                      />
                      <Select<BatchWhitelistGroup | "ALL">
                        size="small"
                        value={whitelistGroupFilter || "ALL"}
                        style={{ width: 120 }}
                        onChange={(value) => changeWhitelistGroupFilter(value === "ALL" ? "" : value)}
                        options={[{ label: "全部分组", value: "ALL" }, ...batchWhitelistGroupOptions]}
                      />
                      <Input.Search
                        allowClear
                        enterButton="搜索"
                        placeholder="搜索白名单用户（昵称或用户名）"
                        value={whitelistUserSearchKeyword}
                        loading={userWhitelistLoading}
                        style={{ width: 280 }}
                        onChange={(event) => {
                          const value = event.target.value;
                          setWhitelistUserSearchKeyword(value);
                          if (!value) {
                            searchWhitelistUsers("");
                          }
                        }}
                        onSearch={searchWhitelistUsers}
                      />
                      <Button size="small" onClick={openBatchWhitelistModal}>
                        批量管理
                      </Button>
                    </Space>
                  </div>
                  <table style={strategyStyles.ruleTable}>
                    <thead>
                      <tr>
                        <th style={strategyStyles.th}>USERID</th>
                        <th style={strategyStyles.th}>用户名</th>
                        <th style={strategyStyles.th}>渠道</th>
                        <th style={strategyStyles.th}>
                          <Tooltip
                            title={
                              whitelistGroupSortOrder === "ascend"
                                ? "当前按分组升序，点击切换为降序"
                                : whitelistGroupSortOrder === "descend"
                                  ? "当前按分组降序，点击取消排序"
                                  : "按分组排序"
                            }
                          >
                            <button
                              type="button"
                              style={strategyStyles.sortButton}
                              aria-label="按分组排序"
                              onClick={toggleWhitelistGroupSort}
                            >
                              分组
                              {whitelistGroupSortOrder === "ascend" ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                            </button>
                          </Tooltip>
                        </th>
                        <th style={strategyStyles.th}>
                          <Tooltip
                            title={
                              whitelistStatusSortOrder === "ascend"
                                ? "当前生效优先，点击切换为失效优先"
                                : whitelistStatusSortOrder === "descend"
                                  ? "当前失效优先，点击取消排序"
                                  : "按状态排序"
                            }
                          >
                            <button
                              type="button"
                              style={strategyStyles.sortButton}
                              aria-label="按状态排序"
                              onClick={toggleWhitelistStatusSort}
                            >
                              状态
                              {whitelistStatusSortOrder === "ascend" ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                            </button>
                          </Tooltip>
                        </th>
                        <th style={strategyStyles.th}>近几日通过率</th>
                        <th style={strategyStyles.th}>允许接单时间段</th>
                        <th style={strategyStyles.th}>轮询次数</th>
                        <th style={strategyStyles.th}>策略</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedWhitelistUsers.length > 0 ? (
                        sortedWhitelistUsers.map((user) => (
                          <tr key={user.userId}>
                            <td style={strategyStyles.td}>{user.userId}</td>
                            <td style={strategyStyles.td}>{user.username || user.name || "-"}</td>
                            <td style={strategyStyles.td}>{user.channel}</td>
                            <td style={strategyStyles.td}>
                              <Select<WhitelistGroup>
                                size="small"
                                value={whitelistGroupOptions.some((option) => option.value === user.group) ? user.group as WhitelistGroup : undefined}
                                placeholder={getWhitelistGroupLabel(user.group)}
                                options={whitelistGroupOptions}
                                loading={user.id ? updatingWhitelistIds.has(user.id) : false}
                                disabled={!user.id}
                                style={{ width: 110 }}
                                onChange={(group) => void updateWhitelistUserGroup(user, group)}
                              />
                            </td>
                            <td style={strategyStyles.td}>
                              <Space size={8}>
                                <Switch
                                  size="small"
                                  checked={user.active}
                                  loading={user.id ? updatingWhitelistIds.has(user.id) : false}
                                  onChange={(checked) => void updateWhitelistUserActive(user, checked)}
                                />
                                <Tag color={user.active ? "green" : "default"}>{user.active ? "生效" : "失效"}</Tag>
                              </Space>
                            </td>
                            <td style={strategyStyles.td}>{user.minRecentApprovalRate == null ? "-" : `近${user.recentApprovalRateDays || whitelistGlobalApprovalRateDays || 3}日 ≥ ${(user.minRecentApprovalRate * 100).toFixed(2)}%`}</td>
                            <td style={{ ...strategyStyles.td, maxWidth: 180 }}>
                              {user.dailyAssignTimeRanges ? <Tooltip title={user.dailyAssignTimeRanges}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.dailyAssignTimeRanges}</span></Tooltip> : "-"}
                            </td>
                            <td style={strategyStyles.td}>{user.fetchTaskLoopNum ?? "默认"}</td>
                            <td style={strategyStyles.td}>
                              <Button
                                size="small"
                                onClick={() => {
                                  setEditingWhitelistUser(user);
                                  setWhitelistPolicyRate(user.minRecentApprovalRate == null ? null : user.minRecentApprovalRate * 100);
                                  setWhitelistPolicyRateDays(user.recentApprovalRateDays ?? null);
                                  setWhitelistPolicyTimeRanges(parseTimeRanges(user.dailyAssignTimeRanges));
                                  setWhitelistPolicyLoopNum(user.fetchTaskLoopNum ?? null);
                                }}
                              >
                                编辑
                              </Button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} style={strategyStyles.emptyCell}>
                            白名单为空，点上方「添加」加入。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div style={strategyStyles.paginationRow}>
                    <Pagination
                      size="small"
                      current={whitelistPageIndex}
                      pageSize={whitelistPageSize}
                      total={whitelistTotal}
                      showSizeChanger
                      pageSizeOptions={["10", "20", "50"]}
                      showTotal={(total) => `共 ${total} 条`}
                      onChange={(page, pageSize) => {
                        if (strategyProduct) {
                          void loadUserWhitelists(strategyProduct, page, pageSize);
                        }
                      }}
                    />
                  </div>
                </div>
              </section>
            ) : null}

            {strategyTab === "uid" ? (
              <section style={strategyStyles.card}>
                <div style={strategyStyles.cardHead}>
                  <div style={{ flex: 1 }}>
                    <div style={strategyStyles.cardTitle}>uid 维度过滤 · 账号质量</div>
                    <div style={strategyStyles.cardDesc}>按投稿 uid（extUserId）的粉丝量等指标，决定该 uid 能否被分配本品类任务。</div>
                  </div>
                  <span style={strategyStyles.phase}>前置 · 1分钟后生效</span>
                  <Switch
                    checked={uidRuleEnabled}
                    loading={updatingDimensionSwitches.has("uid")}
                    onChange={(checked) => void updateDimensionSwitch("uid", checked)}
                  />
	                </div>
	                <div style={strategyStyles.cardBody}>
                  <div style={strategyStyles.subhead}>
                    商品全局默认策略 <span style={strategyStyles.subTag}>对本品类所有任务生效</span>
                    <Button
                      type={uidRuleDirty ? "primary" : "default"}
                      icon={<SaveOutlined />}
                      loading={uidRuleSaving}
                      onClick={() => void saveUidGlobalRule()}
                      style={strategyStyles.subheadAction}
                    >
                      保存
                    </Button>
                  </div>
	                  {[
	                    {
	                      key: "minFansNum" as const,
	                      label: "最小粉丝数",
	                      operator: "minFansNum ≥",
	                      desc: "粉丝低于阈值的 uid 不予分配",
	                      value: uidRule.minFansNum,
	                      enabled: uidRule.minFansNum > 0,
	                      onToggle: (checked: boolean) => updateUidRule({ minFansNum: checked ? suggestedUidRule.minFansNum : 0 }),
	                      onValueChange: (value: number | null) => updateUidRule({ minFansNum: Number(value || 0) }),
	                    },
	                    {
	                      key: "minItemNum" as const,
	                      label: "最少作品数",
	                      operator: "itemNum ≥",
	                      desc: "主页作品数门槛，过滤空号 / 新号",
	                      value: uidRule.minItemNum,
	                      enabled: uidRule.minItemNum > 0,
	                      onToggle: (checked: boolean) => updateUidRule({ minItemNum: checked ? suggestedUidRule.minItemNum : 0 }),
	                      onValueChange: (value: number | null) => updateUidRule({ minItemNum: Number(value || 0) }),
	                    },
	                    {
	                      key: "minInteractRate" as const,
	                      label: "最低互动率",
	                      operator: "rate ≥",
	                      desc: "点赞/播放比，低质账号过滤（0~1）",
	                      value: uidRule.minInteractRate ?? 0,
	                      enabled: uidRule.minInteractRate !== undefined,
	                      onToggle: (checked: boolean) => updateUidRule({ minInteractRate: checked ? defaultInteractRate : undefined }),
	                      onValueChange: (value: number | null) => updateUidRule({ minInteractRate: value === null ? undefined : Number(value) }),
	                    },
	                  ].map((item) => (
	                    <div key={item.key} style={strategyStyles.criteriaRow}>
	                      <Switch checked={item.enabled} onChange={item.onToggle} />
	                      <div style={{ flex: 1 }}>
	                        <div style={strategyStyles.criteriaName}>
	                          {item.label} <code style={strategyStyles.operator}>{item.operator}</code>
	                        </div>
	                        <div style={strategyStyles.criteriaDesc}>{item.desc}</div>
	                      </div>
	                      <InputNumber
	                        value={item.value}
	                        disabled={!item.enabled}
	                        min={0}
	                        max={item.key === "minInteractRate" ? 1 : undefined}
	                        step={item.key === "minInteractRate" ? 0.01 : 1}
	                        style={{ width: 120 }}
	                        onChange={item.onValueChange}
	                      />
	                    </div>
	                  ))}
	                </div>
              </section>
            ) : null}

            {strategyTab === "approvalRate" ? (
              <section style={strategyStyles.card}>
                <div style={strategyStyles.cardHead}>
                  <div style={{ flex: 1 }}>
                    <div style={strategyStyles.cardTitle}>审核通过率维度 · 接单门槛</div>
                    <div style={strategyStyles.cardDesc}>
                      按用户近 N 日内的审核结果决定是否允许接单；未产生审核结果时通过率按 0% 计算。
                    </div>
                  </div>
                  <span style={strategyStyles.phase}>前置 · 最多 5 分钟后生效</span>
                  <Switch
                    checked={approvalRateRuleEnabled}
                    loading={updatingDimensionSwitches.has("approvalRate") || approvalRateRuleSaving}
                    onChange={(checked) => void updateDimensionSwitch("approvalRate", checked)}
                  />
                </div>
                <div style={strategyStyles.cardBody}>
                  <div style={strategyStyles.subhead}>
                    商品全局默认策略 <span style={strategyStyles.subTag}>对本品类所有接单用户生效</span>
                    <Button
                      type={approvalRateRuleDirty ? "primary" : "default"}
                      icon={<SaveOutlined />}
                      loading={approvalRateRuleSaving}
                      onClick={() => void saveApprovalRateGlobalRule()}
                      style={strategyStyles.subheadAction}
                    >
                      保存
                    </Button>
                  </div>
                  <div style={strategyStyles.criteriaRow}>
                    <div style={{ flex: 1 }}>
                      <div style={strategyStyles.criteriaName}>目标范围</div>
                      <div style={strategyStyles.criteriaDesc}>选择后，仅所选人工商品白名单中的用户可使用本审核维度配置；不选择则保持原有的全部用户规则。</div>
                    </div>
                    <Select
                      mode="multiple"
                      allowClear
                      maxTagCount="responsive"
                      placeholder="选择人工商品"
                      value={approvalRateRule.whitelistShopCategoryIds}
                      style={{ width: 330 }}
                      options={products.filter((product) => product.id !== strategyProduct?.id).map((product) => ({ value: product.id, label: product.code ? `${product.name} (${product.code})` : product.name }))}
                      onChange={(value) => updateApprovalRateRule({ whitelistShopCategoryIds: value.map(Number) })}
                    />
                  </div>
                  <div style={strategyStyles.criteriaRow}>
                    <div style={{ flex: 1 }}>
                      <div style={strategyStyles.criteriaName}>
                        近 N 日平均审核成功率 <code style={strategyStyles.operator}>成功率 ≥</code>
                      </div>
                      <div style={strategyStyles.criteriaDesc}>按最近配置天数（含当天）计算；成功率填 0% 或日提交量填 0 均表示不限制。</div>
                    </div>
                    <Space size={8}>
                      <InputNumber
                        value={approvalRateRule.recentApprovalRateDays}
                        min={1}
                        precision={0}
                        addonAfter="日"
                        style={{ width: 110 }}
                        onChange={(value) => updateApprovalRateRule({ recentApprovalRateDays: Number(value || 3) })}
                      />
                      <InputNumber
                        value={approvalRateRule.minRecentApprovalRate * 100}
                        min={0}
                        max={100}
                        precision={2}
                        addonAfter="%"
                        style={{ width: 150 }}
                        onChange={(value) => updateApprovalRateRule({ minRecentApprovalRate: Number(value || 0) / 100 })}
                      />
                      <InputNumber
                        value={approvalRateRule.minDailySubmitNum}
                        min={0}
                        precision={0}
                        addonBefore="日提交量 >"
                        style={{ width: 180 }}
                        onChange={(value) => updateApprovalRateRule({ minDailySubmitNum: Number(value || 0) })}
                      />
                    </Space>
                  </div>
                  <div style={strategyStyles.criteriaRow}>
                    <div style={{ flex: 1 }}>
                      <div style={strategyStyles.criteriaName}>
                        最低粉丝数量 <code style={strategyStyles.operator}>粉丝数 ≥</code>
                      </div>
                      <div style={strategyStyles.criteriaDesc}>用户当前投稿账号的粉丝数达到该门槛，才允许接本品类的单；填 0 表示不限制。</div>
                    </div>
                    <InputNumber
                      value={approvalRateRule.minFansNum}
                      min={0}
                      precision={0}
                      style={{ width: 150 }}
                      onChange={(value) => updateApprovalRateRule({ minFansNum: Number(value || 0) })}
                    />
                  </div>
                  <div style={strategyStyles.criteriaRow}>
                    <div style={{ flex: 1 }}>
                      <div style={strategyStyles.criteriaName}>允许每日接单时间段</div>
                      <div style={strategyStyles.criteriaDesc}>可填写多个时段，以英文逗号分隔；例如 09:00-12:00,14:00-18:00。留空表示全天允许。</div>
                    </div>
                    <div style={{ width: 330 }}>
                      <TimeRangeEditor value={parseTimeRanges(approvalRateRule.dailyAssignTimeRanges)} onChange={(ranges) => updateApprovalRateRule({ dailyAssignTimeRanges: formatTimeRanges(ranges) })} />
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {strategyTab === "video" ? (
              <section style={strategyStyles.card}>
                <div style={strategyStyles.cardHead}>
                  <div style={{ flex: 1 }}>
                    <div style={strategyStyles.cardTitle}>视频维度过滤 · 任务策略</div>
                    <div style={strategyStyles.cardDesc}>按候选任务（视频）自身属性逐条过滤。在 Init 建池阶段执行，不进热点请求。</div>
                  </div>
                  <span style={{ ...strategyStyles.phase, ...strategyStyles.phaseWarm }}>Init · 1分钟后生效</span>
                  <Switch
                    checked={videoRuleEnabled}
                    loading={updatingDimensionSwitches.has("video")}
                    onChange={(checked) => void updateDimensionSwitch("video", checked)}
                  />
                </div>
                <div style={strategyStyles.cardBody}>
                  <div style={strategyStyles.subhead}>
                    商品全局默认策略 <span style={strategyStyles.subTag}>对本品类所有用户生效</span>
                    <Button
                      type={videoRuleDirty ? "primary" : "default"}
                      icon={<SaveOutlined />}
                      loading={videoRuleSaving}
                      onClick={() => void saveVideoGlobalRule()}
                      style={strategyStyles.subheadAction}
                    >
                      保存
                    </Button>
	                  </div>
	                  <div style={strategyStyles.criteriaRow}>
	                    <Switch
	                      checked={videoRule.urlFilterEnabled}
	                      onChange={(checked) => updateVideoRule({ urlFilterEnabled: checked })}
	                    />
	                    <div style={{ flex: 1 }}>
	                      <div style={strategyStyles.criteriaName}>
	                        视频链接 url 过滤 <code style={strategyStyles.operator}>url contains</code>
	                      </div>
	                      <div style={strategyStyles.criteriaDesc}>视频链接命中以下任一关键词则拦截，可选择或输入多个关键词</div>
	                      <Select
	                        mode="tags"
	                        allowClear
	                        value={parseUrlKeywords(videoRule.urlKeywords)}
	                        disabled={!videoRule.urlFilterEnabled}
	                        style={{ marginTop: 8, width: "100%", maxWidth: 360 }}
	                        placeholder="选择图文/视频或输入关键词"
	                        options={videoUrlKeywordOptions}
	                        tokenSeparators={[",", "，"]}
	                        onChange={(values) => updateVideoRule({ urlKeywords: stringifyUrlKeywords(values) })}
	                      />
	                    </div>
	                  </div>
	                  <div style={strategyStyles.criteriaRow}>
	                    <Switch
	                      checked={videoRule.urlIncludeEnabled}
	                      onChange={(checked) => updateVideoRule({ urlIncludeEnabled: checked })}
	                    />
	                    <div style={{ flex: 1 }}>
	                      <div style={strategyStyles.criteriaName}>
	                        视频链接 url 只接 <code style={strategyStyles.operator}>url contains</code>
	                      </div>
	                      <div style={strategyStyles.criteriaDesc}>只接视频链接包含以下任一关键词的单子，不含则过滤掉，可选择或输入多个关键词</div>
	                      <Select
	                        mode="tags"
	                        allowClear
	                        value={parseUrlKeywords(videoRule.urlIncludeKeywords)}
	                        disabled={!videoRule.urlIncludeEnabled}
	                        style={{ marginTop: 8, width: "100%", maxWidth: 360 }}
	                        placeholder="选择图文/视频或输入关键词"
	                        options={videoUrlKeywordOptions}
	                        tokenSeparators={[",", "，"]}
	                        onChange={(values) => updateVideoRule({ urlIncludeKeywords: stringifyUrlKeywords(values) })}
	                      />
	                    </div>
	                  </div>
	                  <div style={strategyStyles.criteriaRow}>
	                    <Switch
	                      checked={videoRule.adFilterEnabled}
	                      onChange={(checked) => updateVideoRule({ adFilterEnabled: checked })}
	                    />
	                    <div style={{ flex: 1 }}>
	                      <div style={strategyStyles.criteriaName}>是否包含小广告</div>
                      <div style={strategyStyles.criteriaDesc}>检测到视频内含小广告（贴片 / 浮层 / 口播广告）则拦截</div>
                    </div>
                    <Tag color="red">命中拦截</Tag>
                  </div>

                  <div style={strategyStyles.divider} />

                  <div style={strategyStyles.subhead}>
                    指定用户策略 <span style={strategyStyles.subTag}>覆盖全局 · 仅对该用户生效</span>
                  </div>
                  <table style={{ ...strategyStyles.ruleTable, marginTop: 14 }}>
                    <thead>
                      <tr>
                        <th style={strategyStyles.th}>用户</th>
                        <th style={strategyStyles.th}>当前策略</th>
                        <th style={strategyStyles.th}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {videoUserStrategies.length > 0 ? (
                        videoUserStrategies.map((user) => (
                          <tr key={user.userId}>
                            <td style={strategyStyles.td}>
                              <Space direction="vertical" size={0}>
                                <Text strong>{user.username || user.name || "-"}</Text>
                                <Text type="secondary">{user.userId}</Text>
                              </Space>
                            </td>
                            <td style={strategyStyles.td}>{formatVideoUserStrategySummary(user)}</td>
                            <td style={strategyStyles.td}>
                              <Space size={4}>
                                <Button type="link" size="small" onClick={() => openVideoUserStrategyModal(user)}>
                                  策略
                                </Button>
                                <Button
                                  danger
                                  type="link"
                                  size="small"
                                  onClick={() => void removeVideoUserStrategy(user)}
                                >
                                  取消分配
                                </Button>
                              </Space>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} style={strategyStyles.emptyCell}>
                            暂无指定用户，下方搜索 app_user 点「分配」为其单独配置。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div style={strategyStyles.addRow}>
                    <Select
                      size="large"
                      showSearch
                      allowClear
                      filterOption={false}
                      value={selectedVideoAppUserId}
                      placeholder="搜索用户名分配（app_user 表）"
                      loading={appUserSearching}
                      options={appUserSelectOptions}
                      notFoundContent={appUserSearching ? "搜索中..." : "请输入用户名搜索 app_user"}
                      onSearch={(value) => void searchAppUsers(value)}
                      onChange={(value) => setSelectedVideoAppUserId(value)}
                    />
                    <Button type="primary" size="large" onClick={() => void addSelectedVideoAppUser()}>
                      分配
                    </Button>
                  </div>
                </div>
              </section>
            ) : null}

            {strategyTab === "refund" ? (
              <section style={strategyStyles.card}>
                <div style={strategyStyles.cardHead}>
                  <div style={{ flex: 1 }}>
                    <div style={strategyStyles.cardTitle}>退单维度过滤 · 分发轮次策略</div>
                    <div style={strategyStyles.cardDesc}>
                      按任务分发轮次判断是否触发退单或标记异常，在审核阶段执行。
                    </div>
                  </div>
                  <span style={strategyStyles.phase}>Judge · 审核阶段生效</span>
                  <Switch
                    checked={refundRuleEnabled}
                    loading={updatingDimensionSwitches.has("refund")}
                    onChange={(checked) => void updateDimensionSwitch("refund", checked)}
                  />
                </div>
                <div style={strategyStyles.cardBody}>
                  <div style={strategyStyles.subhead}>
                    商品全局默认策略 <span style={strategyStyles.subTag}>对本品类所有任务生效</span>
                    <Button
                      type={refundRuleDirty ? "primary" : "default"}
                      icon={<SaveOutlined />}
                      loading={refundRuleSaving}
                      onClick={() => void saveRefundGlobalRule()}
                      style={strategyStyles.subheadAction}
                    >
                      保存
                    </Button>
                  </div>
                  <div style={strategyStyles.criteriaRow}>
                    <div style={{ flex: 1 }}>
                      <div style={strategyStyles.criteriaName}>
                        退单轮次阈值 <code style={strategyStyles.operator}>分发轮次 ≥</code>
                      </div>
                      <div style={strategyStyles.criteriaDesc}>分发轮次大于等于该值时，触发退单</div>
                    </div>
                    <InputNumber
                      value={refundRule.refundRoundThreshold}
                      min={0}
                      style={{ width: 120 }}
                      onChange={(value) => updateRefundRule({ refundRoundThreshold: Number(value || 0) })}
                    />
                  </div>
                  <div style={strategyStyles.criteriaRow}>
                    <div style={{ flex: 1 }}>
                      <div style={strategyStyles.criteriaName}>
                        异常打标轮次阈值 <code style={strategyStyles.operator}>分发轮次 ≥</code>
                      </div>
                      <div style={strategyStyles.criteriaDesc}>分发轮次大于等于该值时，标记为异常</div>
                    </div>
                    <InputNumber
                      value={refundRule.exceptionRoundThreshold}
                      min={0}
                      style={{ width: 120 }}
                      onChange={(value) => updateRefundRule({ exceptionRoundThreshold: Number(value || 0) })}
                    />
                  </div>
                </div>
              </section>
            ) : null}

          </div>
        ) : null}
      </Drawer>

      <Modal
        title="添加白名单用户"
        open={addWhitelistModalOpen}
        okText="确认添加"
        cancelText="取消"
        confirmLoading={whitelistSaving}
        onCancel={() => setAddWhitelistModalOpen(false)}
        onOk={() => void addSelectedAppUser()}
      >
        <div style={{ marginBottom: 12, color: "#4f5967" }}>请选择要放入的分组：</div>
        <Select<WhitelistGroup>
          value={selectedWhitelistGroup}
          options={whitelistGroupOptions}
          style={{ width: "100%" }}
          onChange={setSelectedWhitelistGroup}
        />
      </Modal>

      <Modal
        title={`编辑白名单策略${editingWhitelistUser ? `：${editingWhitelistUser.username || editingWhitelistUser.userId}` : ""}`}
        open={Boolean(editingWhitelistUser)}
        zIndex={1200}
        okText="保存"
        cancelText="取消"
        confirmLoading={whitelistSaving}
        onCancel={() => setEditingWhitelistUser(null)}
        onOk={() => void saveWhitelistUserPolicy()}
      >
        <div style={{ marginBottom: 8 }}>近几日审核通过率 ≥（两项均留空则使用白名单全局配置）</div>
        <Space style={{ width: "100%", marginBottom: 18 }}>
          <InputNumber value={whitelistPolicyRateDays} min={1} precision={0} addonAfter="日" placeholder="全局天数" style={{ width: 150 }} onChange={(value) => setWhitelistPolicyRateDays(value === null ? null : Number(value))} />
          <InputNumber value={whitelistPolicyRate} min={0} max={100} precision={2} addonAfter="%" placeholder="全局通过率" style={{ width: 180 }} onChange={(value) => setWhitelistPolicyRate(value === null ? null : Number(value))} />
        </Space>
        <div style={{ marginBottom: 8 }}>允许每日接单时间段</div>
        <TimeRangeEditor value={whitelistPolicyTimeRanges} onChange={setWhitelistPolicyTimeRanges} />
        <div style={{ marginTop: 18, marginBottom: 8 }}>获取任务轮询次数（留空使用系统默认次数）</div>
        <InputNumber
          value={whitelistPolicyLoopNum}
          min={1}
          precision={0}
          addonAfter="次"
          placeholder="默认次数"
          style={{ width: 180 }}
          onChange={(value) => setWhitelistPolicyLoopNum(value === null ? null : Number(value))}
        />
      </Modal>

      <Modal
        title="批量管理白名单"
        open={batchWhitelistModalOpen}
        width={760}
        okText="保存"
        cancelText="取消"
        confirmLoading={batchWhitelistSaving}
        onCancel={() => setBatchWhitelistModalOpen(false)}
        onOk={() => void saveBatchWhitelist()}
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 18 }}>
          左侧显示服务端未分组用户；右侧按分组筛选已有白名单用户。
        </Text>
        <Transfer
          dataSource={batchWhitelistDataSource}
          targetKeys={batchWhitelistTargetKeys}
          onChange={changeBatchWhitelistSelection}
          render={(item) => <span title={item.description}>{item.title} <Text type="secondary">{item.description}</Text></span>}
          titles={[
            "未分组用户",
            <Space key="group-filter" size={8}>
              <span>已有分组</span>
              <Select<WhitelistGroup>
                value={batchWhitelistGroup}
                options={whitelistGroupOptions}
                style={{ width: 120 }}
                onChange={(group) => {
                  setBatchWhitelistGroup(group);
                  setBatchUnassignedPageIndex(1);
                  setBatchGroupedPageIndex(1);
                  setBatchGroupAddedIds(new Set());
                  setBatchGroupRemovedIds(new Set());
                  void loadBatchWhitelistUsers(group, 1, 1);
                }}
              />
            </Space>,
          ]}
          showSearch
          pagination={false}
          onSearch={(direction, value) => {
            if (direction === "left") {
              void searchBatchUnassignedUsers(value);
            }
          }}
          filterOption={(inputValue, item) =>
            item.title.toLowerCase().includes(inputValue.toLowerCase()) || item.description.toLowerCase().includes(inputValue.toLowerCase())
          }
          footer={(_, info) => {
            if (info?.direction === "left") {
              return (
              <Pagination
                size="small"
                current={batchUnassignedPageIndex}
                pageSize={50}
                total={batchUnassignedTotal}
                showSizeChanger={false}
                showTotal={(total) => `共 ${total} 人`}
                onChange={(page) => void loadBatchWhitelistUsers(batchWhitelistGroup, page)}
              />
              );
            }
            return (
              <Pagination
                size="small"
                current={batchGroupedPageIndex}
                pageSize={50}
                total={batchGroupedTotal}
                showSizeChanger={false}
                showTotal={(total) => `共 ${total} 人`}
                onChange={(page) => void loadBatchWhitelistUsers(batchWhitelistGroup, batchUnassignedPageIndex, page)}
              />
            );
          }}
          listStyle={{ width: 340, height: 360 }}
          disabled={batchWhitelistLoading}
          locale={{ itemUnit: "人", itemsUnit: "人", searchPlaceholder: "搜索用户" }}
        />
      </Modal>

      <WorkspaceDrawer
        title="用户视频策略"
        open={videoUserStrategyModalOpen}
        width={620}
        okText="保存"
        cancelText="取消"
        onClose={() => {
          setVideoUserStrategyModalOpen(false);
          setEditingVideoUserStrategy(null);
        }}
        onSubmit={saveVideoUserStrategy}
      >
        {editingVideoUserStrategy ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div style={strategyStyles.preview}>
              <Text strong>{editingVideoUserStrategy.username || editingVideoUserStrategy.name || "用户"}</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                {editingVideoUserStrategy.userId}
              </Text>
            </div>
            <div style={strategyStyles.criteriaRow}>
              <Switch
                checked={editingVideoUserStrategy.urlFilterEnabled}
                onChange={(checked) => updateEditingVideoUserStrategy({ urlFilterEnabled: checked })}
              />
              <div style={{ flex: 1 }}>
                <div style={strategyStyles.criteriaName}>
                  视频链接 url 过滤 <code style={strategyStyles.operator}>url contains</code>
                </div>
                <div style={strategyStyles.criteriaDesc}>命中以下任一关键词则拦截，可选择或输入多个关键词</div>
                <Select
                  mode="tags"
                  allowClear
                  value={parseUrlKeywords(editingVideoUserStrategy.urlKeywords)}
                  disabled={!editingVideoUserStrategy.urlFilterEnabled}
                  style={{ marginTop: 8, width: "100%" }}
                  placeholder="选择图文/视频或输入关键词"
                  options={videoUrlKeywordOptions}
                  tokenSeparators={[",", "，"]}
                  onChange={(values) => updateEditingVideoUserStrategy({ urlKeywords: stringifyUrlKeywords(values) })}
                />
              </div>
            </div>
            <div style={strategyStyles.criteriaRow}>
              <Switch
                checked={editingVideoUserStrategy.urlIncludeEnabled}
                onChange={(checked) => updateEditingVideoUserStrategy({ urlIncludeEnabled: checked })}
              />
              <div style={{ flex: 1 }}>
                <div style={strategyStyles.criteriaName}>
                  视频链接 url 只接 <code style={strategyStyles.operator}>url contains</code>
                </div>
                <div style={strategyStyles.criteriaDesc}>只接包含以下任一关键词的单子，不含则过滤掉，可选择或输入多个关键词</div>
                <Select
                  mode="tags"
                  allowClear
                  value={parseUrlKeywords(editingVideoUserStrategy.urlIncludeKeywords)}
                  disabled={!editingVideoUserStrategy.urlIncludeEnabled}
                  style={{ marginTop: 8, width: "100%" }}
                  placeholder="选择图文/视频或输入关键词"
                  options={videoUrlKeywordOptions}
                  tokenSeparators={[",", "，"]}
                  onChange={(values) => updateEditingVideoUserStrategy({ urlIncludeKeywords: stringifyUrlKeywords(values) })}
                />
              </div>
            </div>
            <div style={strategyStyles.criteriaRow}>
              <Switch
                checked={editingVideoUserStrategy.adFilterEnabled}
                onChange={(checked) => updateEditingVideoUserStrategy({ adFilterEnabled: checked })}
              />
              <div style={{ flex: 1 }}>
                <div style={strategyStyles.criteriaName}>是否包含小广告</div>
                <div style={strategyStyles.criteriaDesc}>检测到视频内含小广告（贴片 / 浮层 / 口播广告）则拦截</div>
              </div>
            </div>
          </Space>
        ) : null}
      </WorkspaceDrawer>
    </div>
  );
}

function resolveStatus(value?: string) {
  return value?.trim().toUpperCase() === "EXPIRE" ? "EXPIRE" : "ACTIVE";
}

function formatShopGroupLabel(group: Pick<ShopGroupRecord, "code" | "name">) {
  const code = group.code?.trim() || "-";
  const name = group.name?.trim() || "-";
  return `${code} · ${name}`;
}

function sortProducts(products: ManualProductRecord[]) {
  return [...products].sort((left, right) => {
    const leftStatus = resolveStatus(left.status);
    const rightStatus = resolveStatus(right.status);
    if (leftStatus !== rightStatus) {
      return leftStatus === "ACTIVE" ? -1 : 1;
    }
    return right.id - left.id;
  });
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("zh-CN", { hour12: false });
}

function getProductGlyph(product: ManualProductRecord) {
  const name = product.name?.trim();
  const code = product.code?.trim();
  return (name || code || "策").slice(0, 1).toUpperCase();
}

function formatAssignStrategyName(value?: string) {
  if (value === "SINGLE_ASSIGN") {
    return "单条分配";
  }
  if (value === "BATCH_ASSIGN") {
    return "批量分配";
  }
  return value || "-";
}

function formatAssignType(value?: string) {
  if (value === "NORMAL") {
    return "普通";
  }
  if (value === "PRIORITY") {
    return "优先";
  }
  return value || "-";
}

function formatJudgeType(value?: string) {
  if (value === "JUDGE_BY_NUM") {
    return "按数量审核";
  }
  if (value === "JUDGE_BATCH_BY_NUM") {
    return "按数量批量审核";
  }
  if (value === "JUDGE_BY_NUM_WITH_USER") {
    return "按数量并指定用户审核";
  }
  if (value === "JUDGE_BY_USER_SUBMIT") {
    return "用户提交审核";
  }
  return value || "-";
}

function formatAgainJudgeType(value?: string) {
  if (value === "TIME_STAMP_JUDGE_TYPE") {
    return "时间戳审核";
  }
  return value || "-";
}

function formatVideoUserStrategySummary(record: VideoUserStrategyRecord) {
  const items: string[] = [];
  if (record.urlFilterEnabled) {
    items.push(record.urlKeywords.trim() ? `url含 ${record.urlKeywords} 拦截` : "url过滤");
  }
  if (record.urlIncludeEnabled) {
    items.push(record.urlIncludeKeywords.trim() ? `只接url含 ${record.urlIncludeKeywords}` : "只接过滤");
  }
  if (record.adFilterEnabled) {
    items.push("小广告拦截");
  }
  return items.length > 0 ? items.join(" · ") : "无拦截项";
}

function parseUrlKeywords(value?: string) {
  return (value || "")
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyUrlKeywords(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).join(",");
}

function buildEmptyAssignConfigRow(
  product: ManualProductRecord | null,
  shopType?: ManualProductTypeRecord,
): AssignConfigPreviewRecord {
  const shopTypeCode = shopType?.code || `SHOP_TYPE_${shopType?.id || 0}`;
  return {
    id: 0,
    shopTypeId: Number(shopType?.id || 0),
    shopTypeName: shopType?.name || shopTypeCode,
    shopTypeCode,
    queueCode: "",
    strategyName: "",
    assignModel: "",
    assignType: "",
    queueSize: 0,
    assignScale: "0",
    expireTimes: 0,
    loopNum: 0,
    speedByHour: 0,
    assignNum: 0,
    batchAssignNum: 0,
    monitorOrder: false,
    checkNowNum: false,
    todayDistinct: false,
  };
}

function buildAssignConfigRow(
  product: ManualProductRecord | null,
  shopType: ManualProductTypeRecord | undefined,
  config: AssignConfigRecord,
): AssignConfigPreviewRecord {
  return {
    ...buildEmptyAssignConfigRow(product, shopType),
    id: Number(config.id || 0),
    shopTypeId: Number(config.shopTypeId || shopType?.id || 0),
    queueCode: config.queueCode || "",
    strategyName: config.strategyName || "",
    assignModel: config.assignModel || "",
    assignType: config.assignType || "",
    queueSize: Number(config.queueSize || 0),
    assignScale: String(config.assignScale ?? 0),
    expireTimes: Number(config.expireTimes || 0),
    loopNum: Number(config.loopNum || 0),
    speedByHour: Number(config.speedByHour || 0),
    assignNum: Number(config.assignNum || 0),
    batchAssignNum: Number(config.batchAssignNum || 0),
    monitorOrder: Boolean(config.monitorOrder),
    checkNowNum: Boolean(config.checkNowNum),
    todayDistinct: Boolean(config.todayDistinct),
  };
}

function isSameAssignConfigRow(record: AssignConfigPreviewRecord, editingRecord: AssignConfigPreviewRecord | null) {
  if (!editingRecord) {
    return false;
  }
  if (editingRecord.id > 0) {
    return record.id === editingRecord.id;
  }
  return record.shopTypeId === editingRecord.shopTypeId && record.id === editingRecord.id;
}

function buildEmptyJudgeConfigRow(
  _product: ManualProductRecord | null,
  shopType?: ManualProductTypeRecord,
): JudgeConfigPreviewRecord {
  const shopTypeCode = shopType?.code || `SHOP_TYPE_${shopType?.id || 0}`;
  const shopTypeName = shopType?.name || shopTypeCode;
  return {
    id: 0,
    shopTypeId: Number(shopType?.id || 0),
    shopTypeName,
    shopTypeCode,
    judgeType: "JUDGE_BY_NUM",
    againJudgeType: "TIME_STAMP_JUDGE_TYPE",
    againJudgeFlag: false,
    againJudgeDelayTimes: 0,
    assignConfigId: 0,
  };
}

function buildJudgeConfigRow(
  product: ManualProductRecord | null,
  shopType: ManualProductTypeRecord | undefined,
  config: JudgeConfigRecord,
): JudgeConfigPreviewRecord {
  return {
    ...buildEmptyJudgeConfigRow(product, shopType),
    id: Number(config.id || 0),
    shopTypeId: Number(config.shopTypeId || shopType?.id || 0),
    judgeType: config.judgeType || "JUDGE_BY_NUM",
    againJudgeType: config.againJudgeType || "",
    againJudgeFlag: Boolean(config.againJudgeFlag),
    againJudgeDelayTimes: Number(config.againJudgeDelayTimes || 0),
    assignConfigId: Number(config.assignConfigId || 0),
  };
}

function isSameJudgeConfigRow(record: JudgeConfigPreviewRecord, editingRecord: JudgeConfigPreviewRecord | null) {
  if (!editingRecord) {
    return false;
  }
  if (editingRecord.id > 0) {
    return record.id === editingRecord.id;
  }
  return record.shopTypeId === editingRecord.shopTypeId && record.id === editingRecord.id;
}

const strategyStyles = {
  app: {
    minHeight: "100vh",
    padding: "26px 30px 44px",
    color: "#161b24",
    background: "#eef1f6",
  },
  crumb: {
    marginBottom: 18,
    color: "#8992a1",
    fontSize: 13,
    fontWeight: 600,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: 18,
    marginBottom: 28,
  },
  glyph: {
    width: 76,
    height: 76,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    flex: "none",
    color: "#fff",
    background: "#0e7c8a",
    boxShadow: "0 16px 28px -18px rgba(14, 124, 138, 0.9)",
    fontSize: 32,
    fontWeight: 700,
  },
  title: {
    margin: "8px 0 8px",
    fontSize: 30,
    lineHeight: 1.15,
    color: "#161b24",
  },
  metaLine: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap" as const,
    color: "#8992a1",
    fontSize: 15,
    fontWeight: 600,
  },
  code: {
    marginLeft: 6,
    color: "#8992a1",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    background: "transparent",
  },
  saveBar: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap" as const,
    justifyContent: "flex-end",
  },
  dirty: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#a86710",
    fontSize: 14,
    fontWeight: 600,
  },
  dirtyDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#a86710",
  },
  tabs: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "8px 10px",
    border: "1px solid #dde2ec",
    borderRadius: 14,
    marginBottom: 28,
    background: "rgba(255,255,255,0.54)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
  },
  tab: {
    position: "relative" as const,
    flex: "0 1 220px",
    border: "none",
    borderRadius: 11,
    padding: "12px 18px 13px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
    color: "#4f5967",
    background: "transparent",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    transition: "background .18s ease, color .18s ease, box-shadow .18s ease, transform .18s ease",
  },
  tabActive: {
    color: "#161b24",
    background: "#ffffff",
    boxShadow: "0 10px 24px -18px rgba(20,30,50,.55), inset 0 -3px 0 #0e7c8a",
    transform: "translateY(-1px)",
  },
  tabNumber: {
    width: 28,
    height: 28,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    color: "#8992a1",
    background: "#e9edf4",
    fontSize: 14,
    fontWeight: 800,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.72)",
  },
  tabNumberActive: {
    color: "#fff",
    background: "#0e7c8a",
    boxShadow: "0 8px 18px -12px rgba(14, 124, 138, .95)",
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    background: "#cfd6e2",
    boxShadow: "0 0 0 4px rgba(207, 214, 226, .26)",
  },
  statusDotOn: {
    background: "#1c8a4e",
    boxShadow: "0 0 0 4px rgba(28, 138, 78, .14)",
  },
  card: {
    overflow: "hidden",
    borderRadius: 16,
    border: "1px solid #dde2ec",
    background: "#fff",
    boxShadow: "0 1px 2px rgba(20,30,50,.06), 0 8px 24px -12px rgba(20,30,50,.18)",
  },
  cardHead: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "22px 30px",
    borderBottom: "1px solid #dde2ec",
  },
  cardTitle: {
    color: "#161b24",
    fontSize: 19,
    fontWeight: 800,
  },
  cardDesc: {
    marginTop: 4,
    color: "#4f5967",
    fontSize: 14,
  },
  cardBody: {
    padding: 30,
  },
  phase: {
    padding: "6px 12px",
    borderRadius: 8,
    color: "#0e7c8a",
    background: "rgba(14, 124, 138, 0.1)",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  phaseWarm: {
    color: "#a86710",
    background: "rgba(168, 103, 16, 0.1)",
  },
  label: {
    marginBottom: 8,
    color: "#161b24",
    fontSize: 14,
    fontWeight: 800,
  },
  required: {
    marginLeft: 8,
    color: "#8992a1",
    fontWeight: 700,
  },
  ruleTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    tableLayout: "fixed" as const,
  },
  th: {
    padding: "0 10px 12px",
    borderBottom: "1px solid #dde2ec",
    color: "#8992a1",
    fontSize: 12,
    letterSpacing: "0.08em",
    textAlign: "left" as const,
  },
  sortButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: 0,
    border: 0,
    color: "inherit",
    background: "transparent",
    cursor: "pointer",
    font: "inherit",
  },
  td: {
    padding: "13px 10px",
    borderBottom: "1px solid #eef1f6",
    color: "#4f5967",
    fontSize: 13,
  },
  emptyCell: {
    padding: "26px 10px 30px",
    color: "#8992a1",
    fontSize: 14,
  },
  addRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 10,
    marginTop: 18,
  },
  paginationRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 14,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    columnGap: 16,
    rowGap: 2,
  },
  help: {
    marginTop: 12,
    color: "#8992a1",
    fontSize: 13,
    lineHeight: 1.7,
  },
  inlineCode: {
    padding: "1px 6px",
    borderRadius: 6,
    border: "1px solid #dde2ec",
    color: "#8992a1",
    background: "#f4f6fa",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  linkLike: {
    color: "#0e7c8a",
    borderBottom: "1px dashed rgba(14, 124, 138, 0.45)",
  },
  criteriaRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "16px 4px",
    borderBottom: "1px solid #dde2ec",
  },
  criteriaName: {
    color: "#161b24",
    fontSize: 14,
    fontWeight: 800,
  },
  criteriaDesc: {
    marginTop: 3,
    color: "#8992a1",
    fontSize: 13,
  },
  operator: {
    marginLeft: 6,
    color: "#8992a1",
    background: "transparent",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontWeight: 600,
  },
  preview: {
    marginTop: 20,
    padding: "15px 18px",
    borderRadius: 10,
    border: "1px dashed #cfd6e2",
    color: "#4f5967",
    background: "#f4f6fa",
    fontSize: 13,
    lineHeight: 1.7,
  },
  previewTitle: {
    marginBottom: 6,
    color: "#8992a1",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.08em",
  },
  subhead: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#161b24",
    fontSize: 15,
    fontWeight: 800,
  },
  subTag: {
    padding: "3px 9px",
    borderRadius: 7,
    color: "#8992a1",
    background: "#e9edf4",
    fontSize: 12,
    fontWeight: 700,
  },
  subheadAction: {
    marginLeft: "auto",
  },
  divider: {
    height: 1,
    margin: "24px 0",
    background: "#dde2ec",
  },
  foot: {
    marginTop: 28,
    color: "#8992a1",
    textAlign: "center" as const,
    fontSize: 13,
    lineHeight: 1.9,
  },
};
