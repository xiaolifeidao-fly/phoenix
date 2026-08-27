import logging

import httpx

from lib.settings.configuration import (
    get_online_count_base_url,
    get_online_count_offset,
    get_online_count_timeout_seconds,
    get_online_count_window_seconds,
)

log = logging.getLogger(__name__)

# suffer 免鉴权只读接口，返回体为 {"success": true, "code": 0, "data": {...}}
ONLINE_COUNT_PATH = "/barry/public/workbench-dashboard/user-online-overview"
ONLINE_COUNT_FIELD = "onlineAccountCount"

REPLY_TEMPLATE = "当前实时上号数量：{count}"
FALLBACK_TEXT = "暂时查不到实时上号数量，请稍后再试"


async def fetch_online_account_count():
    """请求公开接口取 onlineAccountCount，任何异常都吞掉并返回 None，不向上抛"""
    url = get_online_count_base_url() + ONLINE_COUNT_PATH
    params = {"windowSeconds": get_online_count_window_seconds()}
    timeout = get_online_count_timeout_seconds()

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url, params=params)
    except httpx.HTTPError as e:
        # 超时、连接失败、DNS 失败等都归到这里；超时异常的 str 为空，带上类型名才看得出原因
        log.error(
            "请求实时上号数量接口失败, url=%s, params=%s, timeout=%s, error=%s: %s",
            url, params, timeout, type(e).__name__, e,
        )
        return None

    if response.status_code != 200:
        log.error("实时上号数量接口返回非 200, url=%s, status=%s", url, response.status_code)
        return None

    try:
        payload = response.json()
    except ValueError as e:
        log.error("实时上号数量接口返回体不是 JSON, url=%s, error=%s", url, e)
        return None

    if not isinstance(payload, dict) or not payload.get("success"):
        log.error("实时上号数量接口 success 不为真, url=%s, payload=%s", url, payload)
        return None

    data = payload.get("data")
    if not isinstance(data, dict) or data.get(ONLINE_COUNT_FIELD) is None:
        log.error("实时上号数量接口缺少 %s 字段, url=%s, payload=%s", ONLINE_COUNT_FIELD, url, payload)
        return None

    try:
        return int(data[ONLINE_COUNT_FIELD])
    except (TypeError, ValueError):
        log.error(
            "实时上号数量接口 %s 不是数字, url=%s, value=%s",
            ONLINE_COUNT_FIELD, url, data[ONLINE_COUNT_FIELD],
        )
        return None


async def build_online_account_count_reply():
    """按钮回复文案：接口 onlineAccountCount 加偏移量，取数失败回兜底文案"""
    count = await fetch_online_account_count()
    if count is None:
        return FALLBACK_TEXT
    return REPLY_TEMPLATE.format(count=count + get_online_count_offset())
