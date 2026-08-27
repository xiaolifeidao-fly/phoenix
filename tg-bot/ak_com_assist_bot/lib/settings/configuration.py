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
