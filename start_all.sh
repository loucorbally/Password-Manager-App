#!/bin/bash

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting backend..."
cd "$ROOT/backend"

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi
echo "Installing/updating backend dependencies..."
.venv/bin/pip install -q -r requirements.txt

.venv/bin/python main.py &
BACKEND_PID=$!
echo "Backend running (PID $BACKEND_PID)"

echo "Starting frontend..."
cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install
fi

npm run dev &
FRONTEND_PID=$!
echo "Frontend running (PID $FRONTEND_PID)"

echo ""
echo "App is running:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://127.0.0.1:5000"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
