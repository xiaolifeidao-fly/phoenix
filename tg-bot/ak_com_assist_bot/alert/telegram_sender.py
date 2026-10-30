import logging

import httpx

log = logging.getLogger(__name__)


class TelegramSender:
    """用告警机器人往告警群发纯文本消息

    普通群升级成超级群后 chat_id 会变，Telegram 会在报错里带上新 id，这里按新 id 改发一次并记住，
    同时打日志提醒把 .env 里的 ALERT_CHAT_ID 改掉，否则重启后又会先发失败一次
    """

    def __init__(self, api_base, token, chat_id, timeout):
        self._url = f"{api_base}/bot{token}/sendMessage"
        self._token = token
        self._chat_id = chat_id
        self._timeout = timeout

    def send(self, text):
        """发送成功返回 True；失败只记日志不抛，由调用方决定回给云监控什么状态码"""
        chat_id = self._chat_id
        ok, migrate_to = self._post(chat_id, text)
        if not ok and migrate_to:
            log.warning("告警群已升级为超级群，chat_id %s -> %s，请把 .env 里的 ALERT_CHAT_ID 改成新值", chat_id, migrate_to)
            self._chat_id = migrate_to
            ok, _ = self._post(migrate_to, text)
        return ok

    def _post(self, chat_id, text):
        payload = {"chat_id": chat_id, "text": text, "disable_web_page_preview": True}
        try:
            response = httpx.post(self._url, json=payload, timeout=self._timeout)
        except httpx.HTTPError as e:
            # 请求 URL 里带明文 token，异常信息万一带上 URL 也要打码
            log.error(
                "发送 Telegram 消息失败, chat_id=%s, error=%s: %s",
                chat_id, type(e).__name__, str(e).replace(self._token, "***"),
            )
            return False, None

        try:
            body = response.json()
        except ValueError:
            body = {}
        if response.status_code == 200 and body.get("ok"):
            return True, None

        parameters = body.get("parameters") or {}
        log.error(
            "Telegram 返回失败, chat_id=%s, status=%s, description=%s",
            chat_id, response.status_code, body.get("description"),
        )
        return False, parameters.get("migrate_to_chat_id")
