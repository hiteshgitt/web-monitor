#!/bin/bash

echo "🚀 Starting Web Monitor Full Stack Application..."
echo ""

# Start backend in background
echo "📡 Starting backend server..."
cd backend
npm install
node setup.js
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Start frontend
echo "🎨 Starting frontend application..."
cd ..
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Web Monitor is now running!"
echo "🌐 Frontend: http://localhost:3000"
echo "📡 Backend API: http://localhost:5000"
echo "📚 API Documentation: http://localhost:5000/api"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup processes
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on exit
trap cleanup SIGINT SIGTERM

# Wait for processes
wait
