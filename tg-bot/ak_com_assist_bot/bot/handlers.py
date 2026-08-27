import logging

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import CallbackQueryHandler, CommandHandler, ContextTypes

from service.online_count import build_online_account_count_reply

log = logging.getLogger(__name__)

# 功能面板文案与按钮的 callback_data，点击只触发 callback，不在群里产生用户消息
MENU_TEXT = "请选择功能："
CALLBACK_ONLINE_ACCOUNT_COUNT = "online_account_count"


def build_menu_markup():
    """功能面板：当前只有「实时上号数量」一个按钮"""
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("实时上号数量", callback_data=CALLBACK_ONLINE_ACCOUNT_COUNT)]]
    )


async def menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/menu 弹出内联功能面板"""
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


def register(application):
    """注册命令与回调 handler"""
    application.add_handler(CommandHandler("menu", menu))
    application.add_handler(CallbackQueryHandler(on_callback))
