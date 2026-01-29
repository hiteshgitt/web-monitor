#!/bin/bash

echo "🚀 Starting Web Monitor Backend..."
echo "📦 Installing backend dependencies..."

cd backend
npm install

echo "🔧 Setting up MongoDB database..."
node setup.js

echo "🌐 Starting backend server..."
echo "📡 API will be available at: http://localhost:5000"
echo "📚 API Documentation: http://localhost:5000/api"
echo ""
echo "Press Ctrl+C to stop the server"

npm run dev
