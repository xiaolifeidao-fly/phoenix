"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, DatePicker, Empty, Input, InputNumber, Select, Space, Table, Tag, Typography } from "antd";
import type { TableProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd/es/table/interface";
import { message } from "@/utils/notify";
import { fetchManualTaskStatisticUsers, type ManualUserOption } from "../../api/task-statistics.api";
import { fetchManualOrderDetailSecUid, fetchManualOrderDetails, type ManualOrderDetail, type ManualOrderDetailPage } from "../../api/order-details.api";

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;
const defaultDateRange: [Dayjs, Dayjs] = [dayjs().startOf("day"), dayjs().startOf("day")];

export function ManualOrderDetailPanel() {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<ManualOrderDetailPage | null>(null);
  const [approvalRateOrder, setApprovalRateOrder] = useState<"ascend" | "descend" | null>(null);
  const [userOptions, setUserOptions] = useState<ManualUserOption[]>([]);
  const userOptionCacheRef = useRef(new Map<number, ManualUserOption>());
  const [selectingStartDate, setSelectingStartDate] = useState<Dayjs | null>(null);
  const [filters, setFilters] = useState({
    dateRange: defaultDateRange,
    userId: undefined as number | undefined,
    uid: "",
    fansNumOrder: undefined as "ASC" | "DESC" | undefined,
    fansNumMin: undefined as number | undefined,
    fansNumMax: undefined as number | undefined,
    approvalRateMin: undefined as number | undefined,
    approvalRateMax: undefined as number | undefined,
    page: 1,
    pageSize: 20,
  });

  const loadDetails = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const [startDate, endDate] = nextFilters.dateRange;
      setDetails(await fetchManualOrderDetails({
        startDate: startDate.format("YYYY-MM-DD"),
        endDate: endDate.format("YYYY-MM-DD"),
        userId: nextFilters.userId,
        uid: nextFilters.uid.trim() || undefined,
        fansNumOrder: nextFilters.fansNumOrder,
        fansNumMin: nextFilters.fansNumMin,
        fansNumMax: nextFilters.fansNumMax,
        approvalRateMin: nextFilters.approvalRateMin === undefined ? undefined : nextFilters.approvalRateMin / 100,
        approvalRateMax: nextFilters.approvalRateMax === undefined ? undefined : nextFilters.approvalRateMax / 100,
        page: nextFilters.page,
        pageSize: nextFilters.pageSize,
      }));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载人工做单明细失败");
      setDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (keyword?: string) => {
    const normalizedKeyword = keyword?.trim().toLowerCase() ?? "";
    const cachedOptions = Array.from(userOptionCacheRef.current.values()).filter((user) =>
      !normalizedKeyword || user.username.toLowerCase().includes(normalizedKeyword) || user.nickname?.toLowerCase().includes(normalizedKeyword),
    );
    if (cachedOptions.length > 0) {
      setUserOptions(cachedOptions);
      return;
    }
    try {
      const fetchedOptions = await fetchManualTaskStatisticUsers(keyword);
      fetchedOptions.forEach((user) => userOptionCacheRef.current.set(user.id, user));
      setUserOptions(fetchedOptions);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载人工用户列表失败");
    }
  };

  useEffect(() => {
    void loadDetails();
    void searchUsers();
  }, []);

  const selectedUser = filters.userId ? userOptionCacheRef.current.get(filters.userId) : undefined;
  const resolvedUserOptions = selectedUser && !userOptions.some((user) => user.id === selectedUser.id) ? [selectedUser, ...userOptions] : userOptions;
  const displayedRecords = useMemo(() => {
    const records = details?.records ?? [];
    if (!approvalRateOrder) return records;
    const direction = approvalRateOrder === "ascend" ? 1 : -1;
    return [...records].sort((left, right) => direction * (Number(left.approvalRate || 0) - Number(right.approvalRate || 0)));
  }, [details, approvalRateOrder]);

  const openDouyinProfile = async (record: ManualOrderDetail) => {
    const profileWindow = window.open("", "_blank");
    try {
      const secUid = await fetchManualOrderDetailSecUid(record.userId, record.uid);
      if (!secUid) {
        profileWindow?.close();
        message.warning("未找到该 UID 的抖音主页信息");
        return;
      }
      if (profileWindow) {
        profileWindow.opener = null;
        profileWindow.location.href = `https://www.douyin.com/user/${encodeURIComponent(secUid)}`;
      }
    } catch (error) {
      profileWindow?.close();
      message.error(error instanceof Error ? error.message : "获取抖音主页信息失败");
    }
  };

  const columns: ColumnsType<ManualOrderDetail> = [
    { title: "用户名", dataIndex: "username", width: 150, render: (value) => <Text strong>{value || "-"}</Text> },
    { title: "渠道", dataIndex: "channel", width: 130, render: (value) => value || "-" },
    {
      title: "UID",
      dataIndex: "uid",
      width: 190,
      render: (uid, record) => uid
        ? <a href="#" onClick={(event) => { event.preventDefault(); void openDouyinProfile(record); }}>{uid}</a>
        : <Text>-</Text>,
    },
    {
      title: "粉丝数",
      dataIndex: "fansNum",
      key: "fansNum",
      width: 110,
      sorter: true,
      sortDirections: ["descend", "ascend"],
      sortOrder: approvalRateOrder ? null : filters.fansNumOrder === "ASC" ? "ascend" : filters.fansNumOrder === "DESC" ? "descend" : null,
      render: formatCount,
    },
    { title: "总提交数量", dataIndex: "totalSubmitNum", width: 120, render: formatCount },
    { title: "未提交数量", dataIndex: "unSubmitNum", width: 120, render: (value) => <Tag color="gold">{formatCount(value)}</Tag> },
    { title: "审核成功数量", dataIndex: "checkedNum", width: 130, render: (value) => <Tag color="success">{formatCount(value)}</Tag> },
    { title: "审核失败数量", dataIndex: "checkErrorNum", width: 130, render: (value) => <Tag color="error">{formatCount(value)}</Tag> },
    {
      title: "审核成功率",
      dataIndex: "approvalRate",
      key: "approvalRate",
      width: 120,
      sorter: true,
      sortDirections: ["descend", "ascend"],
      sortOrder: approvalRateOrder,
      render: formatPercent,
    },
  ];

  const pagination: TablePaginationConfig = {
    current: details?.page ?? filters.page,
    pageSize: details?.pageSize ?? filters.pageSize,
    total: details?.total ?? 0,
    showSizeChanger: true,
    showTotal: (total) => `共 ${total} 条`,
  };

  const handleTableChange: TableProps<ManualOrderDetail>["onChange"] = (pagination, _, sorter, extra) => {
    if (extra.action === "sort") {
      if (Array.isArray(sorter)) return;
      if (sorter.field === "approvalRate") {
        setApprovalRateOrder(sorter.order === "ascend" || sorter.order === "descend" ? sorter.order : null);
        return;
      }
      if (sorter.field !== "fansNum") return;
    }
    const fansNumOrder = !Array.isArray(sorter) && sorter.field === "fansNum"
      ? sorter.order === "ascend" ? "ASC" : sorter.order === "descend" ? "DESC" : undefined
      : filters.fansNumOrder;
    const page = extra.action === "sort" ? 1 : pagination.current ?? filters.page;
    const pageSize = pagination.pageSize ?? filters.pageSize;
    const next = { ...filters, fansNumOrder, page, pageSize };
    setApprovalRateOrder(null);
    setFilters(next);
    void loadDetails(next);
  };

  return (
    <div className="manager-page-stack">
      <section className="manager-shell-card" style={{ borderRadius: 28, padding: 24 }}>
        <Space direction="vertical" size={18} style={{ width: "100%" }}>
          <div><div className="manager-section-label">筛选条件</div><Title level={4} style={{ margin: "10px 0 0" }}>查看人工用户做单明细</Title></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, alignItems: "end" }}>
            <div>
              <Text type="secondary">做单日期区间</Text>
              <RangePicker
                allowClear={false}
                style={{ width: "100%", marginTop: 8 }}
                value={filters.dateRange}
                disabledDate={(current) => Boolean(selectingStartDate && Math.abs(current.diff(selectingStartDate, "day")) > 6)}
                onCalendarChange={(dates) => setSelectingStartDate(dates?.[0] ?? null)}
                onChange={(value) => {
                  setSelectingStartDate(null);
                  if (!value?.[0] || !value?.[1]) return;
                  const nextRange: [Dayjs, Dayjs] = [value[0].startOf("day"), value[1].startOf("day")];
                  if (nextRange[1].diff(nextRange[0], "day") > 6) {
                    message.warning("做单日期区间最多选择 7 天");
                    return;
                  }
                  setFilters((current) => ({ ...current, dateRange: nextRange }));
                }}
              />
            </div>
            <div>
              <Text type="secondary">用户名</Text>
              <Select
                allowClear
                showSearch
                filterOption={false}
                placeholder="输入用户名或昵称搜索"
                style={{ width: "100%", marginTop: 8 }}
                options={resolvedUserOptions.map((user) => ({ value: user.id, label: user.nickname ? `${user.username} (${user.nickname})` : user.username }))}
                value={filters.userId}
                onSearch={(value) => void searchUsers(value)}
                onChange={(value) => setFilters((current) => ({ ...current, userId: value }))}
              />
            </div>
            <div><Text type="secondary">UID</Text><Input allowClear placeholder="输入 UID" value={filters.uid} onChange={(event) => setFilters((current) => ({ ...current, uid: event.target.value }))} onPressEnter={() => { const next = { ...filters, page: 1 }; setFilters(next); void loadDetails(next); }} style={{ marginTop: 8 }} /></div>
            <div>
              <Text type="secondary">粉丝量区间</Text>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginTop: 8 }}>
                <InputNumber min={0} precision={0} placeholder="最小值" style={{ width: "100%" }} value={filters.fansNumMin} onChange={(value) => setFilters((current) => ({ ...current, fansNumMin: typeof value === "number" ? value : undefined }))} />
                <Text type="secondary">至</Text>
                <InputNumber min={0} precision={0} placeholder="最大值" style={{ width: "100%" }} value={filters.fansNumMax} onChange={(value) => setFilters((current) => ({ ...current, fansNumMax: typeof value === "number" ? value : undefined }))} />
              </div>
            </div>
            <div>
              <Text type="secondary">审核通过率区间</Text>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginTop: 8 }}>
                <InputNumber min={0} max={100} precision={2} placeholder="最小值" addonAfter="%" style={{ width: "100%" }} value={filters.approvalRateMin} onChange={(value) => setFilters((current) => ({ ...current, approvalRateMin: typeof value === "number" ? value : undefined }))} />
                <Text type="secondary">至</Text>
                <InputNumber min={0} max={100} precision={2} placeholder="最大值" addonAfter="%" style={{ width: "100%" }} value={filters.approvalRateMax} onChange={(value) => setFilters((current) => ({ ...current, approvalRateMax: typeof value === "number" ? value : undefined }))} />
              </div>
            </div>
            <Space><Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={() => { const next = { ...filters, page: 1 }; setFilters(next); void loadDetails(next); }}>查询</Button><Button icon={<ReloadOutlined />} onClick={() => { const reset = { dateRange: defaultDateRange, userId: undefined, uid: "", fansNumOrder: undefined, fansNumMin: undefined, fansNumMax: undefined, approvalRateMin: undefined, approvalRateMax: undefined, page: 1, pageSize: 20 }; setFilters(reset); void loadDetails(reset); }}>重置</Button></Space>
          </div>
        </Space>
      </section>

      <section className="manager-shell-card" style={{ borderRadius: 28, padding: 24 }}>
        <Space direction="vertical" size={18} style={{ width: "100%" }}>
          <div><div className="manager-section-label">做单数据</div><Title level={4} style={{ margin: "10px 0 4px" }}>按用户与 UID 汇总</Title><Text type="secondary">UID 可打开最新做单记录对应的抖音主页</Text></div>
          <Table<ManualOrderDetail> rowKey={(record) => `${record.userId}-${record.uid}`} loading={loading} columns={columns} dataSource={displayedRecords} pagination={pagination} onChange={handleTableChange} scroll={{ x: 1240 }} locale={{ emptyText: <Empty description="当前筛选条件下暂无做单数据" /> }} />
        </Space>
      </section>
    </div>
  );
}

function formatCount(value?: number) { return Number(value || 0).toLocaleString("zh-CN"); }
function formatPercent(value?: number) { return `${(Number(value || 0) * 100).toFixed(2)}%`; }
