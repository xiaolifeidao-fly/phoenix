#!/usr/bin/env bash
set -euo pipefail

# ak_com_assist_bot 停止脚本：优先按 pid 文件停，pid 文件丢失或有残留进程时兜底 pkill -f
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
APP_NAME="ak_com_assist_bot"
PYTHON_BIN="$APP_ROOT/.venv/bin/python"
ENTRY="main.py"
PID_FILE="$APP_ROOT/$APP_NAME.pid"
# 兜底匹配串带上项目绝对路径，避免误杀同机其它 python main.py 进程
MATCH_PATTERN="$PYTHON_BIN $ENTRY"

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

# 先 SIGTERM 等 10 秒，仍在则 SIGKILL
stop_pid() {
    local pid="$1"
    echo "找到受控进程 ID: $pid"
    kill -TERM "$pid" 2>/dev/null || true
    for _ in $(seq 1 10); do
        if ! pid_is_target "$pid"; then
            return 0
        fi
        sleep 1
    done

    echo "⚠️  进程 $pid 在 10 秒内未退出，发送 SIGKILL" >&2
    kill -KILL "$pid" 2>/dev/null || true
    sleep 1
    pid_is_target "$pid" && return 1
    return 0
}

echo "🛑 停止 $APP_NAME..."
if pid="$(read_pid)"; then
    if ! stop_pid "$pid"; then
        echo "❌ 无法停止受控进程 $pid" >&2
        exit 1
    fi
    rm -f "$PID_FILE"
    echo "✅ $APP_NAME 受控进程已停止"
else
    echo "ℹ️  没有找到由 $PID_FILE 管理的 $APP_NAME 进程"
fi

# 兜底：清掉 pid 文件之外的残留进程（例如手工 nohup 起的、或 pid 文件被删过的）
if pgrep -f "$MATCH_PATTERN" > /dev/null 2>&1; then
    echo "⚠️  仍有匹配 '$MATCH_PATTERN' 的残留进程，执行 pkill 兜底"
    pkill -f "$MATCH_PATTERN" || true
    sleep 2
    if pgrep -f "$MATCH_PATTERN" > /dev/null 2>&1; then
        pkill -KILL -f "$MATCH_PATTERN" || true
        sleep 1
    fi
    if pgrep -f "$MATCH_PATTERN" > /dev/null 2>&1; then
        echo "❌ 残留进程仍未清理干净: $(pgrep -f "$MATCH_PATTERN" | tr '\n' ' ')" >&2
        exit 1
    fi
    echo "✅ 残留进程已清理"
fi

rm -f "$PID_FILE"
echo "✅ $APP_NAME 已停止"
