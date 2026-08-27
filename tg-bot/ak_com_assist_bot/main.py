import logging
import sys

from telegram.ext import ApplicationBuilder

from bot import handlers
from lib.settings.configuration import get_bot_token

logging.basicConfig(format="%(asctime)s - %(levelname)s: %(message)s", level=logging.INFO)
log = logging.getLogger("ak_com_assist_bot")


def main():
    token = get_bot_token()
    if not token:
        log.error(
            "缺少 bot token，请设置环境变量 TELEGRAM_BOT_TOKEN，"
            "或在 config/config.ini 的 [TELEGRAM] bot_token 中配置"
        )
        sys.exit(1)

    application = ApplicationBuilder().token(token).build()
    handlers.register(application)

    log.info("start ak_com_assist_bot")
    application.run_polling()


if __name__ == "__main__":
    main()
