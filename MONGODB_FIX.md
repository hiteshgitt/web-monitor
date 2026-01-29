# 🔧 MongoDB Connection Fix

## Problem
Your app is showing "failed to fetch" because MongoDB is not running.

## Error Message
```
MongoDB connection error: connect ECONNREFUSED 127.0.0.1:27017
```

## Solution

### Option 1: Install and Start MongoDB (Recommended)

#### Check if MongoDB is installed:
```bash
mongod --version
```

If NOT installed, install it:

#### On Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

#### On CentOS/RHEL:
```bash
sudo yum install mongodb-server
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

#### Verify MongoDB is running:
```bash
sudo systemctl status mongodb
```

Expected output should show "active (running)"

### Option 2: Use Docker (If MongoDB is installed via Docker)
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### Option 3: Check MongoDB Data Directory
```bash
# Check if MongoDB directory exists
ls -la /var/lib/mongodb

# If it doesn't exist, create it
sudo mkdir -p /var/lib/mongodb
sudo chown mongodb:mongodb /var/lib/mongodb

# Start MongoDB manually
sudo mongod --dbpath /var/lib/mongodb --fork --logpath /var/log/mongodb.log
```

## After Starting MongoDB

### 1. Restart the Backend
```bash
cd /var/www/html/SAP\ Analytics/backend
# Kill the old process
pkill -f "node.*server.js"
# Start fresh
node server.js
```

You should see:
```
Connected to MongoDB
Web Monitor API server running on port 5000
```

### 2. Test the Connection
```bash
curl http://localhost:5000/api/websites
```

Expected: `[]` (empty array)

### 3. Access Your App
Your frontend is running on: **http://localhost:3001**

Open that URL and try adding a website again.

## Quick Commands

### Start MongoDB:
```bash
sudo systemctl start mongodb
```

### Check if running:
```bash
sudo systemctl status mongodb
ps aux | grep mongod
```

### Check MongoDB port:
```bash
netstat -tulpn | grep 27017
```

### Test MongoDB connection:
```bash
mongo --eval "db.version()"
```

## Alternative: Use MongoDB Atlas (Cloud)

If you can't install MongoDB locally, use MongoDB Atlas (free tier):

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a cluster
4. Get the connection string
5. Update `backend/config.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/webmonitor
   ```
6. Restart backend

## Current Status

✅ Frontend: Running on http://localhost:3001
✅ Backend: Running on http://localhost:5000
❌ MongoDB: NOT running (this is the problem!)
⚠️ Frontend URL: http://localhost:3001 (NOT 5173)

## Next Steps

1. **Start MongoDB** using one of the options above
2. **Restart the backend** (it should now connect to MongoDB)
3. **Open http://localhost:3001** in your browser
4. **Try adding a website** - it should work now!

## Test After Fixing

```bash
# Test 1: Check MongoDB is running
ps aux | grep mongod

# Test 2: Check backend can connect
curl http://localhost:5000/api/health

# Test 3: Check websites endpoint (should return empty array)
curl http://localhost:5000/api/websites
```

## Troubleshooting

### "Permission denied" when starting MongoDB
```bash
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo systemctl start mongodb
```

### "Port 27017 already in use"
MongoDB might already be running:
```bash
ps aux | grep mongod
```

### "Failed to fetch" still appears
1. Check backend is running: `ps aux | grep "node.*server.js"`
2. Check MongoDB is running: `ps aux | grep mongod`
3. Open browser console (F12) and check for errors
4. Make sure you're accessing: **http://localhost:3001**

