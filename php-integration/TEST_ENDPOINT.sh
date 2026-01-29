#!/bin/bash

# Test Web Monitor API Endpoint
# This script helps you find the correct URL for your Laravel app

echo "🔍 Testing Web Monitor API Endpoints"
echo "===================================="
echo ""

# Get API key from .env
if [ -f "/var/www/html/siu-dubai/.env" ]; then
    API_KEY=$(grep WEBMONITOR_API_KEY /var/www/html/siu-dubai/.env | cut -d '=' -f2 | tr -d ' ')
    echo "✅ Found API key: ${API_KEY:0:20}..."
else
    echo "❌ .env file not found"
    exit 1
fi

echo ""
echo "Testing different URLs:"
echo ""

# Test 1: Laravel serve (localhost:8000)
echo "1️⃣  Testing: http://127.0.0.1:8000/api/webmonitor/health"
echo "   (Start Laravel server: cd /var/www/html/siu-dubai && php artisan serve)"
response=$(curl -s -w "\n%{http_code}" "http://127.0.0.1:8000/api/webmonitor/health" \
  -H "Authorization: Bearer $API_KEY" 2>/dev/null)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" = "200" ]; then
    echo "   ✅ SUCCESS! Use URL: http://127.0.0.1:8000"
    echo "   Response: $(echo $body | head -c 100)..."
else
    echo "   ❌ Failed (HTTP $http_code)"
fi

echo ""

# Test 2: Direct IP (if accessible)
echo "2️⃣  Testing: http://127.0.0.1/api/webmonitor/health"
response=$(curl -s -w "\n%{http_code}" "http://127.0.0.1/api/webmonitor/health" \
  -H "Authorization: Bearer $API_KEY" 2>/dev/null)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" = "200" ]; then
    echo "   ✅ SUCCESS! Use URL: http://127.0.0.1"
    echo "   Response: $(echo $body | head -c 100)..."
elif [[ "$body" == *"html"* ]] || [[ "$body" == *"HTML"* ]]; then
    echo "   ❌ Got HTML (404 page) - Apache not routing to Laravel"
else
    echo "   ❌ Failed (HTTP $http_code)"
fi

echo ""

# Test 3: With public folder
echo "3️⃣  Testing: http://127.0.0.1/siu-dubai/public/api/webmonitor/health"
response=$(curl -s -w "\n%{http_code}" "http://127.0.0.1/siu-dubai/public/api/webmonitor/health" \
  -H "Authorization: Bearer $API_KEY" 2>/dev/null)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" = "200" ]; then
    echo "   ✅ SUCCESS! Use URL: http://127.0.0.1/siu-dubai/public"
    echo "   Response: $(echo $body | head -c 100)..."
else
    echo "   ❌ Failed (HTTP $http_code)"
fi

echo ""
echo "===================================="
echo "📝 Instructions:"
echo "   1. Find the URL that returned ✅ SUCCESS above"
echo "   2. Use that URL in your Web Monitor Dashboard"
echo "   3. If all failed, check Apache configuration"
echo ""

