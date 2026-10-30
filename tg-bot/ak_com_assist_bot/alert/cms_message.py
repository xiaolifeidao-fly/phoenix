from datetime import datetime, timedelta, timezone

# 云监控 metricProject / namespace 到群里展示名的映射，没列到的原样展示
PRODUCT_NAMES = {
    "acs_kvstore": "Redis",
    "acs_rds_dashboard": "MySQL",
}

# alertState 到标题前缀；不在表里的状态（比如控制台的测试回调）走兜底格式
STATE_TITLES = {
    "ALERT": "🔴【告警】",
    "OK": "✅【恢复】",
    "INSUFFICIENT_DATA": "⚪【无数据】",
}

# 兜底格式里不展示的字段：签名没有意义，userId 是阿里云账号
HIDDEN_FIELDS = {"signature", "userId"}

# Telegram 单条消息上限 4096 字符，留出余量
MAX_TEXT_LENGTH = 3500

_BEIJING = timezone(timedelta(hours=8))


def parse_dimensions(raw):
    """dimensions 形如 {userId=123, instanceId=r-xxx, nodeId=r-xxx-db-0}，解析成 dict，解析不了返回空 dict"""
    text = (raw or "").strip()
    if text.startswith("{") and text.endswith("}"):
        text = text[1:-1]
    result = {}
    for part in text.split(","):
        key, sep, value = part.partition("=")
        if sep:
            result[key.strip()] = value.strip()
    return result


def format_timestamp(raw):
    """timestamp 有秒和毫秒两种写法，统一转成北京时间；解析不了就原样返回"""
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return raw or ""
    if value > 1e12:
        value /= 1000
    return datetime.fromtimestamp(value, _BEIJING).strftime("%Y-%m-%d %H:%M:%S")


def _product_name(fields):
    project = fields.get("metricProject") or fields.get("namespace") or ""
    return PRODUCT_NAMES.get(project, project)


def _instance_text(fields, dimensions):
    """实例名优先，没有就用维度里的 instanceId；集群版按节点告警时带上节点"""
    instance = fields.get("instanceName") or dimensions.get("instanceId") or ""
    node = dimensions.get("nodeId")
    if node and node != instance:
        return f"{instance}（节点 {node}）" if instance else node
    return instance


def _build_fallback_text(fields):
    """认不出的回调把字段原样贴出来，宁可难看也不能丢"""
    lines = ["⚠️【云监控回调】无法识别的格式，原始字段如下"]
    for key in sorted(fields):
        if key not in HIDDEN_FIELDS:
            lines.append(f"{key}: {fields[key]}")
    return "\n".join(lines)


def build_text(fields):
    """把一次云监控回调的字段拼成群消息，纯文本发送，不走 Markdown，免得字段里的特殊字符要转义"""
    title = STATE_TITLES.get(fields.get("alertState", ""))
    if title is None:
        text = _build_fallback_text(fields)
    else:
        dimensions = parse_dimensions(fields.get("dimensions"))
        name = " ".join(x for x in (_product_name(fields), fields.get("alertName", "")) if x)
        rows = [
            ("级别", fields.get("triggerLevel")),
            ("实例", _instance_text(fields, dimensions)),
            ("当前值", (fields.get("curValue") or "") + (fields.get("unit") or "") if fields.get("curValue") else ""),
            ("触发条件", fields.get("expression")),
            ("持续时间", fields.get("lastTime")),
            ("时间", format_timestamp(fields.get("timestamp"))),
        ]
        lines = [title + name]
        lines.extend(f"{label}：{value}" for label, value in rows if value)
        text = "\n".join(lines)
    if len(text) > MAX_TEXT_LENGTH:
        text = text[:MAX_TEXT_LENGTH] + "\n…（内容过长已截断）"
    return text
