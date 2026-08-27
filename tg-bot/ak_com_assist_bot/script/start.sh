#!/usr/bin/env bash
set -euo pipefail

# ak_com_assist_bot 启动脚本：venv 里的 python 跑 main.py，nohup 后台常驻并写 pid 文件
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
APP_NAME="ak_com_assist_bot"
PYTHON_BIN="$APP_ROOT/.venv/bin/python"
ENTRY="main.py"
PID_FILE="$APP_ROOT/$APP_NAME.pid"
LOG_FILE="$APP_ROOT/server.log"

# 判断 pid 是否确实是本项目的机器人进程，避免 pid 复用后误判
pid_is_target() {
    local pid="$1"
    [[ "$pid" =~ ^[0-9]+$ ]] || return 1
    kill -0 "$pid" 2>/dev/null || return 1

    local command
    command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    case "$command" in
        "$PYTHON_BIN $ENTRY"|"$PYTHON_BIN $ENTRY "*) return 0 ;;
        *) return 1 ;;
    esac
}

# 读 pid 文件，进程已经不在或不是本项目进程时清理掉过期 pid 文件
read_pid() {
    [ -f "$PID_FILE" ] || return 1
    local pid
    pid="$(tr -d '[:space:]' < "$PID_FILE")"
    if pid_is_target "$pid"; then
        printf '%s\n' "$pid"
        return 0
    fi
    rm -f "$PID_FILE"
    return 1
}

if [ ! -x "$PYTHON_BIN" ]; then
    echo "❌ 找不到虚拟环境解释器: $PYTHON_BIN" >&2
    echo "   请先执行: cd $APP_ROOT && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
    exit 1
fi

if [ ! -f "$APP_ROOT/$ENTRY" ]; then
    echo "❌ 找不到启动入口: $APP_ROOT/$ENTRY" >&2
    exit 1
fi

if pid="$(read_pid)"; then
    echo "⚠️  $APP_NAME 已在运行，进程 ID: $pid" >&2
    exit 1
fi

# bot token 等敏感配置放在 .env，不随代码上传；存在时导出给子进程
if [ -f "$APP_ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$APP_ROOT/.env"
    set +a
else
    echo "⚠️  未找到 $APP_ROOT/.env，TELEGRAM_BOT_TOKEN 需另行提供，否则进程会启动失败" >&2
fi

echo "🚀 启动 $APP_NAME..."
cd "$APP_ROOT"
nohup "$PYTHON_BIN" "$ENTRY" > "$LOG_FILE" 2>&1 &
pid=$!
printf '%s\n' "$pid" > "$PID_FILE"

for _ in $(seq 1 5); do
    if pid_is_target "$pid"; then
        echo "✅ $APP_NAME 启动成功，进程 ID: $pid"
        echo "📊 日志文件: $LOG_FILE"
        exit 0
    fi
    sleep 1
done

rm -f "$PID_FILE"
echo "❌ $APP_NAME 启动失败，请查看日志: $LOG_FILE" >&2
exit 1
