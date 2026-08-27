#!/bin/bash

# ak_com_assist_bot 项目部署脚本（参照 argus_single/script/deploy_1.sh）
# 服务器信息优先取 ak_bot_*，未设置时回落到 argus_single_*（与 argus_single 同机部署）
remote_host="${ak_bot_remote_server:-${argus_single_remote_server:-}}"
remote_password="${ak_bot_password:-${argus_single_password:-}}"
remote_port="${ak_bot_port:-${argus_single_port:-22}}"
remote_server="root@${remote_host}"

APP_NAME="ak_com_assist_bot"
REMOTE_PATH="/data/program/app/ak_com_assist_bot"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PACKAGE_NAME="${APP_NAME}.deploy.tar.gz"

# 检查环境变量是否设置
if [ -z "$remote_host" ] || [ -z "$remote_password" ]; then
    echo "❌ 错误: 请设置环境变量:"
    echo "   export ak_bot_remote_server=your_server_ip   # 未设置时回落 argus_single_remote_server"
    echo "   export ak_bot_password=your_password         # 未设置时回落 argus_single_password"
    echo "   export ak_bot_port=22                        # 可选，未设置时回落 argus_single_port，默认22"
    exit 1
fi

if ! command -v sshpass > /dev/null 2>&1; then
    echo "❌ 错误: 未安装 sshpass，请先安装（macOS: brew install hudochenkov/sshpass/sshpass）"
    exit 1
fi

echo "=========================================="
echo "开始部署 $APP_NAME"
echo "=========================================="
echo "远程服务器: $remote_server"
echo "远程端口: $remote_port"
echo "远程路径: $REMOTE_PATH"
echo "本地源码: $APP_ROOT"
echo ""

# 打包源码：排除虚拟环境、缓存、本地配置与 .env（token 由远端 .env 提供，不随代码上传）
echo "📦 步骤1: 打包源码..."
PACKAGE_PATH="$(mktemp -d)/$PACKAGE_NAME"
tar -czf "$PACKAGE_PATH" -C "$APP_ROOT" \
    --exclude='./.venv' \
    --exclude='./venv' \
    --exclude='./.git' \
    --exclude='./__pycache__' \
    --exclude='*/__pycache__' \
    --exclude='*.pyc' \
    --exclude='./config/config.ini' \
    --exclude='./.env' \
    --exclude='*.log' \
    --exclude='*.pid' \
    --exclude='./backup' \
    . || { echo "❌ 打包失败"; exit 1; }
echo "   包文件: $PACKAGE_PATH（$(du -h "$PACKAGE_PATH" | awk '{print $1}')）"

echo ""
echo "📤 步骤2: 创建远程目录并备份旧版本..."
sshpass -p "$remote_password" ssh -p $remote_port -o StrictHostKeyChecking=no -T "$remote_server" << EOF
  set -e
  mkdir -p $REMOTE_PATH
  cd $REMOTE_PATH
  # 备份旧版本（如果存在），备份包同样不含虚拟环境与缓存
  if [ -f main.py ]; then
    mkdir -p backup
    tar -czf backup/${APP_NAME}.backup.\$(date +%Y%m%d_%H%M%S).tar.gz \
      --exclude='./backup' --exclude='./.venv' --exclude='./venv' \
      --exclude='*/__pycache__' --exclude='*.pyc' --exclude='*.log' . || true
    echo "已备份旧版本到 $REMOTE_PATH/backup/"
  else
    echo "远端无旧版本，跳过备份"
  fi
EOF
if [ $? -ne 0 ]; then
    echo "❌ 创建远程目录或备份失败"
    rm -rf "$(dirname "$PACKAGE_PATH")"
    exit 1
fi

echo ""
echo "📤 步骤3: 上传源码包..."
sshpass -p "$remote_password" scp -P $remote_port "$PACKAGE_PATH" "$remote_server:$REMOTE_PATH/"
upload_status=$?
rm -rf "$(dirname "$PACKAGE_PATH")"
if [ $upload_status -ne 0 ]; then
    echo "❌ 上传源码包失败"
    exit 1
fi

echo ""
echo "🔄 步骤4: 远端解包 -> 停止旧进程 -> 安装依赖 -> 启动..."
sshpass -p "$remote_password" ssh -p $remote_port -o StrictHostKeyChecking=no -T "$remote_server" << EOF
  set -e
  cd $REMOTE_PATH

  echo "解包新版本..."
  tar -xzf $PACKAGE_NAME -C $REMOTE_PATH
  rm -f $PACKAGE_NAME
  chmod +x script/*.sh

  # 停止旧进程（首次部署时没有进程也不算失败）
  echo "停止旧进程..."
  bash script/stop.sh || true
  sleep 2

  # 准备虚拟环境并安装依赖
  if [ ! -x .venv/bin/python ]; then
    echo "创建虚拟环境..."
    python3 -m venv .venv
  fi
  echo "安装依赖..."
  .venv/bin/pip install --upgrade pip > /dev/null
  .venv/bin/pip install -r requirements.txt

  # token 由远端 .env 提供，不随代码上传
  if [ ! -f .env ]; then
    echo "⚠️  远端缺少 $REMOTE_PATH/.env，请写入 TELEGRAM_BOT_TOKEN=xxx 后重新部署"
  fi

  echo "启动新进程..."
  bash script/start.sh
EOF
if [ $? -ne 0 ]; then
    echo "❌ 远端解包 / 安装依赖 / 启动失败"
    exit 1
fi

echo ""
echo "🔍 步骤5: 校验进程与日志..."
sshpass -p "$remote_password" ssh -p $remote_port -o StrictHostKeyChecking=no -T "$remote_server" << EOF
  cd $REMOTE_PATH
  sleep 5
  new_pid=\$(ps -ef | grep "$REMOTE_PATH/.venv/bin/python main.py" | grep -v grep | awk '{print \$2}')
  if [ -n "\$new_pid" ]; then
      echo "✅ 应用启动成功，进程ID: \$new_pid"
      echo "---------- server.log 最后 20 行 ----------"
      tail -n 20 server.log 2>/dev/null || echo "(暂无日志)"
      echo "------------------------------------------"
      if tail -n 50 server.log 2>/dev/null | grep -q "Traceback"; then
          echo "⚠️  日志中出现异常堆栈，请人工确认: $REMOTE_PATH/server.log"
      fi
      echo "📊 查看日志: tail -f $REMOTE_PATH/server.log"
  else
      echo "❌ 应用启动失败，日志如下: $REMOTE_PATH/server.log"
      tail -n 50 server.log 2>/dev/null || echo "(暂无日志)"
      exit 1
  fi
EOF

deploy_status=$?
echo ""
if [ $deploy_status -ne 0 ]; then
    echo "=========================================="
    echo "❌ 部署失败，请检查上面的日志输出"
    echo "=========================================="
    exit $deploy_status
fi

echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
