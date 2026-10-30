import logging
import sys
from http.server import ThreadingHTTPServer

from alert.server import build_handler
from alert.telegram_sender import TelegramSender
from lib.settings.configuration import (
    get_alert_bot_token,
    get_alert_chat_id,
    get_alert_listen_host,
    get_alert_listen_port,
    get_alert_path_secret,
    get_alert_telegram_api_base,
    get_alert_timeout_seconds,
)

logging.basicConfig(format="%(asctime)s - %(levelname)s: %(message)s", level=logging.INFO)
# httpx 在 INFO 级别会把请求 URL 整条打出来，而 Telegram 的 URL 里带明文 token，压到 WARNING 避免泄漏
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("ak_alert_relay")

# 路径密钥太短容易被猜中，至少 16 位，且不能带 / 以免和路径前缀混淆
MIN_PATH_SECRET_LENGTH = 16


def main():
    """云监控告警转发：接收云监控报警回调，转发到 Telegram 告警群，和菜单机器人分开跑"""
    token = get_alert_bot_token()
    chat_id = get_alert_chat_id()
    path_secret = get_alert_path_secret()

    missing = [name for name, value in (
        ("ALERT_BOT_TOKEN", token),
        ("ALERT_CHAT_ID", chat_id),
        ("ALERT_PATH_SECRET", path_secret),
    ) if not value]
    if missing:
        log.error("缺少告警转发配置 %s，请写入 .env 后重启", ", ".join(missing))
        sys.exit(1)
    if len(path_secret) < MIN_PATH_SECRET_LENGTH or "/" in path_secret:
        log.error("ALERT_PATH_SECRET 至少 %s 位且不能包含 /", MIN_PATH_SECRET_LENGTH)
        sys.exit(1)

    sender = TelegramSender(get_alert_telegram_api_base(), token, chat_id, get_alert_timeout_seconds())
    host, port = get_alert_listen_host(), get_alert_listen_port()
    server = ThreadingHTTPServer((host, port), build_handler(path_secret, sender))
    server.daemon_threads = True

    log.info("start ak_alert_relay, listen %s:%s, chat_id=%s", host, port, chat_id)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
