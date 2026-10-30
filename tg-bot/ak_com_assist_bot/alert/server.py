import hmac
import json
import logging
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs

from alert.cms_message import build_text

log = logging.getLogger(__name__)

# nginx 只把这个前缀反代进来；回调地址为 /cms-alert/<密钥>，健康检查不带密钥
ALERT_PATH_PREFIX = "/cms-alert/"
HEALTH_PATH = "/cms-alert/health"

# 云监控一次回调只有几百字节，超过这个大小直接拒绝
MAX_BODY_BYTES = 64 * 1024


def parse_body(content_type, body):
    """阈值报警回调是表单格式，联系人上配的 Webhook 是 JSON，两种都接；解析不出返回空 dict"""
    text = body.decode("utf-8", errors="replace")
    if "json" in content_type.lower() or text.lstrip().startswith("{"):
        try:
            data = json.loads(text)
        except ValueError:
            data = None
        if isinstance(data, dict):
            return {
                str(key): value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
                for key, value in data.items()
                if value is not None
            }
    return {key: values[0] for key, values in parse_qs(text, keep_blank_values=True).items()}


def build_handler(path_secret, sender):
    """按密钥和发送器生成请求处理类，ThreadingHTTPServer 每个请求实例化一次"""
    expected_path = (ALERT_PATH_PREFIX + path_secret).encode()

    class CmsAlertHandler(BaseHTTPRequestHandler):
        # 不在响应头里暴露 Python 版本
        server_version = "cms-alert"
        sys_version = ""

        def do_GET(self):
            if self.path == HEALTH_PATH:
                self._reply(200, "ok")
                return
            self._reply(404, "not found")

        def do_POST(self):
            path = self.path.split("?", 1)[0].encode()
            if not hmac.compare_digest(path, expected_path):
                self._reply(404, "not found")
                return

            try:
                length = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                length = 0
            if length <= 0:
                self._reply(400, "empty body")
                return
            if length > MAX_BODY_BYTES:
                self._reply(413, "body too large")
                return

            fields = parse_body(self.headers.get("Content-Type") or "", self.rfile.read(length))
            if not fields:
                self._reply(400, "unrecognized body")
                return

            log.info(
                "收到云监控回调, alertName=%s, alertState=%s, instanceName=%s, curValue=%s",
                fields.get("alertName"), fields.get("alertState"), fields.get("instanceName"), fields.get("curValue"),
            )
            # 发送失败回 502，让云监控按自己的策略重试（最多 3 次）
            if sender.send(build_text(fields)):
                self._reply(200, "ok")
            else:
                self._reply(502, "send failed")

        def _reply(self, status, text):
            body = text.encode()
            self.send_response(status)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format, *args):
            # 默认访问日志会打出完整请求路径，里面有密钥，打码后再记；经 nginx 进来时取真实来源 IP
            # 请求行就不合法时还没解析出 headers，这里不能直接取
            headers = getattr(self, "headers", None)
            client = headers.get("X-Real-IP") if headers else None
            log.info("%s - %s", client or self.address_string(), (format % args).replace(path_secret, "***"))

    return CmsAlertHandler
