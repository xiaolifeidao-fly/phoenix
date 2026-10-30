import configparser
import os

# 配置文件固定放在项目下的 config/config.ini，路径按本文件位置推算，避免受启动 cwd 影响
_CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "config",
    "config.ini",
)

config = configparser.ConfigParser()
config.read(_CONFIG_PATH)   # 读取config.ini

# 实时上号数量取数的默认配置，config/config.ini 的 [ONLINE_COUNT] 可逐项覆盖
# base_url 默认走 80 反代，若线上 80 未反代 suffer，改配置为 http://116.62.212.29:7091/suffer-web/api
DEFAULT_ONLINE_COUNT_BASE_URL = "http://116.62.212.29/suffer-web/api"
DEFAULT_ONLINE_COUNT_WINDOW_SECONDS = 120
DEFAULT_ONLINE_COUNT_OFFSET = 500
DEFAULT_ONLINE_COUNT_TIMEOUT_SECONDS = 5.0

# 告警转发的默认配置，config/config.ini 的 [ALERT] 可逐项覆盖；token、群 id、路径密钥放 .env
# 默认只监听本机，由同机 nginx 把 /cms-alert/ 反代进来
DEFAULT_ALERT_LISTEN_HOST = "127.0.0.1"
DEFAULT_ALERT_LISTEN_PORT = 18090
DEFAULT_ALERT_TELEGRAM_API_BASE = "https://api.telegram.org"
# 云监控回调超时是 5 秒，发 Telegram 要在这之前结束，否则云监控会当失败重试
DEFAULT_ALERT_TIMEOUT_SECONDS = 4.0


def get(section, option, default=None):
    """读配置项，分组或配置项缺失时回落到默认值"""
    try:
        return config.get(section, option)
    except (configparser.NoSectionError, configparser.NoOptionError):
        return default


def get_int(section, option, default):
    """读整数配置项，缺失、留空或写成非法值时回落到默认值"""
    value = get(section, option)
    if value is None or not str(value).strip():
        return default
    try:
        return int(str(value).strip())
    except ValueError:
        return default


def get_float(section, option, default):
    """读浮点配置项，缺失、留空或写成非法值时回落到默认值"""
    value = get(section, option)
    if value is None or not str(value).strip():
        return default
    try:
        return float(str(value).strip())
    except ValueError:
        return default


def get_bot_token():
    """bot token 优先取环境变量 TELEGRAM_BOT_TOKEN，其次取本地配置文件"""
    token = os.environ.get("TELEGRAM_BOT_TOKEN") or get("TELEGRAM", "bot_token") or ""
    return token.strip()


def get_online_count_base_url():
    """公开接口的服务前缀，去掉结尾多余的 /，便于和相对路径拼接"""
    base_url = get("ONLINE_COUNT", "base_url") or ""
    base_url = base_url.strip() or DEFAULT_ONLINE_COUNT_BASE_URL
    return base_url.rstrip("/")


def get_online_count_window_seconds():
    """公开接口的统计窗口，单位秒"""
    return get_int("ONLINE_COUNT", "window_seconds", DEFAULT_ONLINE_COUNT_WINDOW_SECONDS)


def get_online_count_offset():
    """对外展示时叠加在接口数值上的偏移量"""
    return get_int("ONLINE_COUNT", "offset", DEFAULT_ONLINE_COUNT_OFFSET)


def get_online_count_timeout_seconds():
    """请求公开接口的超时时间，单位秒"""
    return get_float("ONLINE_COUNT", "timeout_seconds", DEFAULT_ONLINE_COUNT_TIMEOUT_SECONDS)


def get_alert_bot_token():
    """告警机器人 token，只取环境变量 ALERT_BOT_TOKEN，和菜单机器人的 token 分开"""
    return (os.environ.get("ALERT_BOT_TOKEN") or "").strip()


def get_alert_chat_id():
    """告警群 chat_id，优先取环境变量 ALERT_CHAT_ID，其次取 [ALERT] chat_id"""
    return (os.environ.get("ALERT_CHAT_ID") or get("ALERT", "chat_id") or "").strip()


def get_alert_path_secret():
    """回调路径里的密钥，云监控回调没有可校验的签名，靠它挡住外部乱调；只取环境变量"""
    return (os.environ.get("ALERT_PATH_SECRET") or "").strip()


def get_alert_listen_host():
    """告警转发服务监听地址"""
    host = get("ALERT", "listen_host") or ""
    return host.strip() or DEFAULT_ALERT_LISTEN_HOST


def get_alert_listen_port():
    """告警转发服务监听端口"""
    return get_int("ALERT", "listen_port", DEFAULT_ALERT_LISTEN_PORT)


def get_alert_telegram_api_base():
    """Telegram Bot API 地址，去掉结尾多余的 /；本地联调时可指向假服务"""
    base = os.environ.get("ALERT_TELEGRAM_API_BASE") or get("ALERT", "telegram_api_base") or ""
    return (base.strip() or DEFAULT_ALERT_TELEGRAM_API_BASE).rstrip("/")


def get_alert_timeout_seconds():
    """发 Telegram 的超时时间，单位秒"""
    return get_float("ALERT", "timeout_seconds", DEFAULT_ALERT_TIMEOUT_SECONDS)
