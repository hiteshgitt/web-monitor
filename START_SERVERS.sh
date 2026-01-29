#!/bin/bash
# Start Script for Web Monitor

echo "🚀 Starting Web Monitor..."

# Check if backend is running
if ! pgrep -f "node.*server.js" > /dev/null; then
    echo "📦 Starting Backend Server..."
    cd "$(dirname "$0")/backend"
    npm start > ../backend.log 2>&1 &
    echo "✅ Backend started in background (PID: $!)"
    sleep 3
else
    echo "✅ Backend is already running"
fi

# Check if frontend is running
if ! pgrep -f "vite" > /dev/null; then
    echo "🌐 Starting Frontend Server..."
    cd "$(dirname "$0")"
    npm run dev > frontend.log 2>&1 &
    echo "✅ Frontend started in background (PID: $!)"
    sleep 3
else
    echo "✅ Frontend is already running"
fi

echo ""
echo "========================================"
echo "✅ Web Monitor is ready!"
echo ""
echo "Backend:  http://localhost:5000"
echo "Frontend: http://localhost:5173"
echo ""
echo "To view logs:"
echo "  Backend:  tail -f backend.log"
echo "  Frontend: tail -f frontend.log"
echo "========================================"


