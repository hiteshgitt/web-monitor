# MongoDB Setup Guide for Web Monitor

## 🎯 Why MongoDB is Perfect for Web Monitor

MongoDB is an excellent choice for your Web Monitor application because:

- **Flexible Schema**: Perfect for storing different types of website data
- **Real-time Updates**: Built-in change streams for live monitoring
- **Easy Integration**: Great with Node.js/React stack
- **Scalable**: Handles growing website monitoring data well
- **JSON-like Structure**: Matches your current data format perfectly

## 🚀 Quick Setup Options

### Option 1: MongoDB Atlas (Cloud - Recommended)
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free account
3. Create a new cluster
4. Get your connection string
5. Update `backend/config.env` with your connection string

### Option 2: Local MongoDB
1. Install MongoDB locally
2. Start MongoDB service
3. Use default connection: `mongodb://localhost:27017/webmonitor`

## 📋 Complete Setup Instructions

### 1. Install MongoDB (Local Option)

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

**macOS:**
```bash
brew install mongodb-community
brew services start mongodb/brew/mongodb-community
```

**Windows:**
- Download from [MongoDB Download Center](https://www.mongodb.com/try/download/community)
- Install and start MongoDB service

### 2. Set Up Backend

```bash
cd backend
npm install
```

### 3. Configure Environment

Edit `backend/config.env`:
```bash
# For local MongoDB
MONGODB_URI=mongodb://localhost:27017/webmonitor

# For MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/webmonitor

# Server Configuration
PORT=5000
NODE_ENV=development
```

### 4. Initialize Database

```bash
cd backend
node setup.js
```

This will:
- Connect to MongoDB
- Create sample websites
- Set up the database schema

### 5. Start the Backend

```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## 🔧 Database Schema

### Websites Collection
```javascript
{
  _id: ObjectId,
  name: "Website Name",
  url: "https://example.com",
  platform: "wordpress|nextjs|laravel|codeigniter",
  apiKey: "your_api_key",
  status: "healthy|warning|error|offline",
  uptime: 99.9,
  responseTime: 245,
  monitoringEnabled: true,
  settings: {
    checkInterval: 60000,
    timeout: 10000,
    alertThresholds: {
      responseTime: 5000,
      uptime: 95
    }
  },
  analytics: {
    totalVisitors: 12450,
    totalPageViews: 45620,
    bounceRate: 42.3,
    avgSessionDuration: 225,
    seoScore: 85,
    securityScore: 92
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Monitoring Data Collection
```javascript
{
  _id: ObjectId,
  websiteId: ObjectId,
  timestamp: Date,
  status: "healthy|warning|error|offline",
  responseTime: 245,
  statusCode: 200,
  uptime: 100,
  error: {
    message: "Error message",
    code: "ERROR_CODE"
  },
  metrics: {
    loadTime: 245,
    pageSize: 1024,
    requests: 15,
    sslValid: true,
    sslExpiry: Date
  }
}
```

### Analytics Data Collection
```javascript
{
  _id: ObjectId,
  websiteId: ObjectId,
  date: Date,
  visitors: 1245,
  pageViews: 4562,
  bounceRate: 42.3,
  avgSessionDuration: 225,
  topPages: [
    { page: "/dashboard", views: 1250 },
    { page: "/products", views: 980 }
  ],
  trafficSources: [
    { source: "Google", visitors: 800 },
    { source: "Direct", visitors: 445 }
  ],
  deviceTypes: [
    { device: "Desktop", percentage: 60 },
    { device: "Mobile", percentage: 40 }
  ],
  seoMetrics: {
    score: 85,
    issues: [
      { type: "meta_description", severity: "warning", message: "Missing meta description" }
    ]
  },
  securityMetrics: {
    score: 92,
    alerts: [
      { severity: "low", message: "Minor security patch available", timestamp: Date }
    ]
  }
}
```

## 🔄 Real-time Monitoring

The backend includes a monitoring service that:

- **Automatically checks websites** every 60 seconds
- **Stores monitoring data** in MongoDB
- **Updates website status** in real-time
- **Handles errors gracefully**
- **Supports multiple platforms**

## 📊 API Endpoints

### Websites
- `GET /api/websites` - Get all websites
- `GET /api/websites/:id` - Get single website
- `POST /api/websites` - Create new website
- `PUT /api/websites/:id` - Update website
- `DELETE /api/websites/:id` - Delete website

### Monitoring
- `GET /api/websites/:id/monitoring` - Get monitoring data
- `GET /api/websites/:id/analytics` - Get analytics data
- `POST /api/websites/:id/test` - Test website connection

### Health
- `GET /api/health` - API health check
- `GET /api` - API documentation

## 🚀 Quick Start Commands

### Start Backend Only
```bash
./start-backend.sh
```

### Start Full Stack (Frontend + Backend)
```bash
./start-full-stack.sh
```

### Manual Setup
```bash
# Backend
cd backend
npm install
node setup.js
npm run dev

# Frontend (in another terminal)
npm run dev
```

## 🔍 Testing the Setup

1. **Check API Health:**
   ```bash
   curl http://localhost:5000/api/health
   ```

2. **Get All Websites:**
   ```bash
   curl http://localhost:5000/api/websites
   ```

3. **Test Website Connection:**
   ```bash
   curl -X POST http://localhost:5000/api/websites/WEBSITE_ID/test
   ```

## 🛠️ Troubleshooting

### Common Issues

1. **MongoDB Connection Error:**
   - Check if MongoDB is running
   - Verify connection string in config.env
   - Check network connectivity

2. **API Not Responding:**
   - Check if backend server is running
   - Verify port 5000 is available
   - Check console for error messages

3. **Database Setup Failed:**
   - Ensure MongoDB is running
   - Check connection string
   - Verify database permissions

### Debug Commands

```bash
# Check MongoDB status
sudo systemctl status mongodb

# Check MongoDB logs
sudo journalctl -u mongodb

# Test MongoDB connection
mongosh mongodb://localhost:27017/webmonitor

# Check backend logs
cd backend
npm run dev
```

## 📈 Production Deployment

### MongoDB Atlas (Recommended)
1. Create MongoDB Atlas account
2. Create cluster
3. Get connection string
4. Update environment variables
5. Deploy backend to cloud

### Local MongoDB
1. Set up MongoDB on server
2. Configure security
3. Set up backups
4. Monitor performance

## 🎉 You're Ready!

Your Web Monitor application now has:
- ✅ MongoDB database integration
- ✅ Real-time website monitoring
- ✅ RESTful API endpoints
- ✅ Automatic health checks
- ✅ Data persistence
- ✅ Scalable architecture

The application will automatically start monitoring your websites and storing data in MongoDB. You can add, edit, and delete websites through the API, and all monitoring data will be persisted for historical analysis.
