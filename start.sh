#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
PID_DIR="$PROJECT_DIR/.pids"

mkdir -p "$PID_DIR"

read_backend_runtime() {
  BACKEND_HOST="0.0.0.0"
  BACKEND_PORT="8000"

  for env_file in "$PROJECT_DIR/.env"; do
    [ -f "$env_file" ] || continue
    local env_host env_port
    env_host=$(grep -E '^HOST=' "$env_file" | tail -n 1 | cut -d '=' -f 2- | tr -d '"' | tr -d "'")
    env_port=$(grep -E '^PORT=' "$env_file" | tail -n 1 | cut -d '=' -f 2- | tr -d '"' | tr -d "'")
    [ -n "${env_host:-}" ] && BACKEND_HOST="$env_host"
    [ -n "${env_port:-}" ] && BACKEND_PORT="$env_port"
  done
}

ensure_backend_venv() {
  local venv_python="$BACKEND_DIR/venv/bin/python"

  if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$BACKEND_DIR/venv"
  elif [ ! -x "$venv_python" ] || ! "$venv_python" -c "import sys" >/dev/null 2>&1; then
    echo "Existing virtual environment is not usable. Recreating..."
    rm -rf "$BACKEND_DIR/venv"
    python3 -m venv "$BACKEND_DIR/venv"
  fi

  "$venv_python" -m pip install -q -r "$BACKEND_DIR/requirements.txt"
}

wait_for_port() {
  local port="$1"
  local attempts="${2:-20}"
  local interval="${3:-0.5}"
  local i=0

  while [ "$i" -lt "$attempts" ]; do
    if lsof -ti tcp:"$port" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$interval"
    i=$((i+1))
  done

  return 1
}

ensure_pid_running() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

# Kill any process occupying a given port (handles stale processes not tracked by pid files)
kill_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  清理端口 $port 上的残留进程 (PID $pids)..."
    echo "$pids" | xargs kill 2>/dev/null || true
    # Wait up to 3s for port to free
    local i=0
    while lsof -ti tcp:"$port" >/dev/null 2>&1 && [ $i -lt 6 ]; do
      sleep 0.5; i=$((i+1))
    done
  fi
}

stop_all() {
  echo "正在停止服务..."
  for pidfile in "$PID_DIR"/*.pid; do
    [ -f "$pidfile" ] || continue
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && echo "  已停止 PID $pid"
    fi
    rm -f "$pidfile"
  done
  echo "全部已停止。"
}

status_all() {
  echo "服务状态："
  for pidfile in "$PID_DIR"/*.pid; do
    [ -f "$pidfile" ] || continue
    name=$(basename "$pidfile" .pid)
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      echo "  $name: 运行中 (PID $pid)"
    else
      echo "  $name: 已停止"
      rm -f "$pidfile"
    fi
  done
  [ ! "$(ls -A "$PID_DIR" 2>/dev/null)" ] && echo "  无运行中的服务"
}

start_all() {
  stop_all 2>/dev/null || true

  read_backend_runtime
  BACKEND_ACCESS_HOST="$BACKEND_HOST"
  if [ "$BACKEND_ACCESS_HOST" = "0.0.0.0" ]; then
    BACKEND_ACCESS_HOST="127.0.0.1"
  fi

  # Kill any stale processes on the ports (not tracked by pid files)
  kill_port "$BACKEND_PORT"
  kill_port "5173"

  echo "========== 启动后端 =========="
  if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "创建 Python 虚拟环境..."
    python3 -m venv "$BACKEND_DIR/venv"
  fi
  ensure_backend_venv

  nohup bash -c "cd '$BACKEND_DIR' && '$BACKEND_DIR/venv/bin/python' -m uvicorn main:app --host '$BACKEND_HOST' --port '$BACKEND_PORT'" \
    > "$PROJECT_DIR/backend.log" 2>&1 &
  echo $! > "$PID_DIR/backend.pid"
  if ! ensure_pid_running "$(cat "$PID_DIR/backend.pid")" || ! wait_for_port "$BACKEND_PORT"; then
    echo "Backend failed to start. Check log: $PROJECT_DIR/backend.log"
    tail -n 40 "$PROJECT_DIR/backend.log" || true
    rm -f "$PID_DIR/backend.pid"
    exit 1
  fi
  echo "  后端已启动 (PID $!) → http://$BACKEND_ACCESS_HOST:$BACKEND_PORT"
  echo "  日志: tail -f $PROJECT_DIR/backend.log"

  echo "========== 启动前端 =========="
  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "安装前端依赖..."
    (cd "$FRONTEND_DIR" && npm install --silent)
  fi

  nohup npm run dev --prefix "$FRONTEND_DIR" \
    > "$PROJECT_DIR/frontend.log" 2>&1 &
  echo $! > "$PID_DIR/frontend.pid"
  if ! ensure_pid_running "$(cat "$PID_DIR/frontend.pid")" || ! wait_for_port "5173"; then
    echo "Frontend failed to start. Check log: $PROJECT_DIR/frontend.log"
    tail -n 40 "$PROJECT_DIR/frontend.log" || true
    rm -f "$PID_DIR/frontend.pid"
    exit 1
  fi
  echo "  前端已启动 (PID $!) → http://localhost:5173"
  echo "  日志: tail -f $PROJECT_DIR/frontend.log"

  echo ""
  echo "✅ 全部启动完成。使用 '$0 stop' 停止，'$0 status' 查看状态。"
}

case "${1:-start}" in
  start)   start_all ;;
  stop)    stop_all ;;
  restart) stop_all; start_all ;;
  status)  status_all ;;
  *)
    echo "用法: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
