#!/bin/bash

echo "🚀 Starting Web Monitor with MongoDB..."

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "📦 Starting MongoDB..."
    mongod --dbpath ~/data/db --logpath ~/mongodb.log --fork
    sleep 2
    if pgrep -x "mongod" > /dev/null; then
        echo "✅ MongoDB started successfully"
    else
        echo "❌ Failed to start MongoDB"
        echo "Please start MongoDB manually:"
        echo "  mongod --dbpath ~/data/db --fork"
        exit 1
    fi
else
    echo "✅ MongoDB is already running"
fi

# Check if backend is running
if ! pgrep -f "node.*server.js" > /dev/null; then
    echo "🔧 Starting Backend Server..."
    cd "$(dirname "$0")/backend"
    node server.js > ../backend.log 2>&1 &
    echo "✅ Backend started (PID: $!)"
    sleep 3
else
    echo "✅ Backend is already running"
fi

echo ""
echo "========================================"
echo "✅ Web Monitor is ready!"
echo ""
echo "Backend:  http://localhost:5000"
echo "Frontend: http://localhost:3001"
echo ""
echo "Access your app at: http://localhost:3001"
echo "========================================"

