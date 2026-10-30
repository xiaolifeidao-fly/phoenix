import logging

from telegram import (
    BotCommand,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MessageEntity,
    Update,
)
from telegram.ext import (
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from service.online_count import build_online_account_count_reply

log = logging.getLogger(__name__)

# 功能面板文案与按钮的 callback_data，点击只触发 callback，不在群里产生用户消息
MENU_TEXT = "请选择功能："
CALLBACK_ONLINE_ACCOUNT_COUNT = "online_account_count"

# 弹面板的命令：/start 是各家机器人通用的入口，和 /menu 走同一个面板
MENU_COMMANDS = ["menu", "start"]

# 注册到 Telegram 的命令列表，客户端输入 / 时才会有命令提示
BOT_COMMANDS = [
    BotCommand("menu", "打开功能面板"),
    BotCommand("start", "开始使用"),
]


def build_menu_markup():
    """功能面板：当前只有「实时上号数量」一个按钮"""
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("实时上号数量", callback_data=CALLBACK_ONLINE_ACCOUNT_COUNT)]]
    )


async def menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/menu 与 /start 弹出内联功能面板"""
    await update.effective_message.reply_text(MENU_TEXT, reply_markup=build_menu_markup())


async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """内联按钮回调统一入口，按 callback_data 分发"""
    query = update.callback_query
    # 先应答，避免客户端按钮一直转圈
    await query.answer()

    if query.data == CALLBACK_ONLINE_ACCOUNT_COUNT:
        await on_online_account_count(update, context)
        return

    log.warning("未知的 callback_data: %s", query.data)


async def on_online_account_count(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """实时上号数量，走 service 请求公开接口，取数失败时由 service 返回兜底文案"""
    await update.effective_message.reply_text(await build_online_account_count_reply())


async def on_bare_mention(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """群里只 @机器人、不带任何其他内容时，默认当成查实时上号数量"""
    message = update.effective_message
    text = (message.text or "").strip()
    # 只认「纯 @机器人」，带了其他文字的按普通聊天处理，不抢话
    if text != f"@{context.bot.username}":
        return
    await on_online_account_count(update, context)


async def post_init(application):
    """启动后把命令列表同步给 Telegram，失败不影响机器人正常收发"""
    try:
        await application.bot.set_my_commands(BOT_COMMANDS)
    except Exception:
        log.exception("同步命令列表失败，不影响 /menu 与 /start 使用")


def register(application):
    """注册命令与回调 handler"""
    application.add_handler(CommandHandler(MENU_COMMANDS, menu))
    # 纯 @机器人 的消息：用户名在启动前拿不到，先按 MENTION 实体粗筛，精确比对放在 handler 里
    application.add_handler(
        MessageHandler(
            filters.TEXT & ~filters.COMMAND & filters.Entity(MessageEntity.MENTION),
            on_bare_mention,
        )
    )
    application.add_handler(CallbackQueryHandler(on_callback))
