# Testing the Connection

## What's Running

Both servers are now running:

1. **Backend**: http://localhost:5000
2. **Frontend**: http://localhost:5173

## Test Steps

### 1. Test Backend API
```bash
curl http://localhost:5000/api/health
```
Expected: `{"status":"healthy",...}`

### 2. Test Backend Websites Endpoint
```bash
curl http://localhost:5000/api/websites
```
Expected: Array of websites or empty array `[]`

### 3. Access the App
Open in browser: http://localhost:5173

## If You Get "Failed to Fetch"

### Check 1: Backend is Running
```bash
ps aux | grep "node.*server.js"
```

### Check 2: Backend is Responding
```bash
curl http://localhost:5000/api/health
```

### Check 3: MongoDB is Running
```bash
sudo systemctl status mongodb
# or
ps aux | grep mongod
```

### Check 4: Check Backend Logs
Look at the terminal where backend is running for any errors.

## Quick Fix Commands

### Restart Backend
```bash
cd backend
npm start
```

### Restart Frontend
```bash
npm run dev
```

### Check Ports
```bash
netstat -tulpn | grep -E "5000|5173"
```

## Common Issues

### Issue: "Connection refused"
**Solution**: Backend is not running. Start it with:
```bash
cd /var/www/html/SAP\ Analytics/backend
npm run dev
```

### Issue: "CORS error"
**Solution**: Backend CORS is configured. Check if the frontend URL matches:
- Frontend: http://localhost:5173
- Backend allows: http://localhost:5173 (already configured)

### Issue: "MongoDB connection error"
**Solution**: Start MongoDB:
```bash
sudo systemctl start mongodb
# or
mongod --dbpath=/var/lib/mongodb
```

## Status Check

Run this to check everything:
```bash
echo "=== Checking Backend ===" && \
curl -s http://localhost:5000/api/health && \
echo -e "\n\n=== Checking Frontend ===" && \
curl -s http://localhost:5173 | head -1 && \
echo -e "\n\n=== Running Processes ===" && \
ps aux | grep -E "vite|node.*server" | grep -v grep
```

## Next Steps

1. Backend is running ✅
2. Frontend is running ✅
3. Now try adding a website using the modal
4. The "Add New Website" button should work now


