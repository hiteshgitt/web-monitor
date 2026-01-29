# Web Monitor Backend API

A Node.js backend API for the Web Monitor Dashboard with MongoDB integration.

## Features

- **MongoDB Integration**: Store website configurations and monitoring data
- **Real-time Monitoring**: Automatic health checks for all websites
- **Multi-platform Support**: WordPress, Next.js, Laravel, CodeIgniter
- **RESTful API**: Complete CRUD operations for websites
- **Security**: Rate limiting, CORS, and input validation
- **Monitoring Service**: Automated website health checking

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **Axios** - HTTP client for monitoring
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing

## Prerequisites

- Node.js 16+
- MongoDB (local or Atlas)
- npm or yarn

## Installation

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp config.env .env
   # Edit .env with your MongoDB connection string and API keys
   ```

3. **Start MongoDB:**
   ```bash
   # Local MongoDB
   mongod
   
   # Or use MongoDB Atlas (cloud)
   # Update MONGODB_URI in .env file
   ```

4. **Set up database with sample data:**
   ```bash
   node setup.js
   ```

5. **Start the server:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Endpoints

### Websites

- `GET /api/websites` - Get all websites
- `GET /api/websites/:id` - Get single website
- `POST /api/websites` - Create new website
- `PUT /api/websites/:id` - Update website
- `DELETE /api/websites/:id` - Delete website
- `GET /api/websites/:id/monitoring` - Get monitoring data
- `GET /api/websites/:id/analytics` - Get analytics data
- `POST /api/websites/:id/test` - Test website connection

### Health

- `GET /api/health` - API health check
- `GET /api` - API documentation

## Database Schema

### Website Model
```javascript
{
  name: String,
  url: String,
  platform: String,
  apiKey: String,
  status: String,
  uptime: Number,
  responseTime: Number,
  monitoringEnabled: Boolean,
  settings: Object,
  analytics: Object,
  createdAt: Date,
  updatedAt: Date
}
```

### Monitoring Data Model
```javascript
{
  websiteId: ObjectId,
  timestamp: Date,
  status: String,
  responseTime: Number,
  statusCode: Number,
  uptime: Number,
  error: Object,
  metrics: Object
}
```

### Analytics Data Model
```javascript
{
  websiteId: ObjectId,
  date: Date,
  visitors: Number,
  pageViews: Number,
  bounceRate: Number,
  avgSessionDuration: Number,
  topPages: Array,
  trafficSources: Array,
  deviceTypes: Array,
  seoMetrics: Object,
  securityMetrics: Object
}
```

## Configuration

### Environment Variables

```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/webmonitor

# Server Configuration
PORT=5000
NODE_ENV=development

# API Keys
WORDPRESS_API_KEY=your_wordpress_api_key
NEXTJS_API_KEY=your_nextjs_api_key
LARAVEL_API_KEY=your_laravel_api_key
CODEIGNITER_API_KEY=your_codeigniter_api_key

# Monitoring Configuration
MONITORING_INTERVAL=60000
HEALTH_CHECK_TIMEOUT=10000
```

## Monitoring Service

The monitoring service automatically checks all enabled websites at regular intervals:

- **Default interval**: 60 seconds
- **Timeout**: 10 seconds
- **Platform-specific checks**: Different endpoints for each platform
- **Error handling**: Graceful failure handling
- **Data persistence**: All monitoring data is stored in MongoDB

## Adding New Websites

1. **Via API:**
   ```bash
   curl -X POST http://localhost:5000/api/websites \
     -H "Content-Type: application/json" \
     -d '{
       "name": "My Website",
       "url": "https://mywebsite.com",
       "platform": "wordpress",
       "apiKey": "your_api_key"
     }'
   ```

2. **Via Frontend:** Use the "Add New Website" button

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for frontend domain
- **Helmet**: Security headers
- **Input Validation**: Mongoose schema validation
- **Error Handling**: Secure error messages

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses nodemon for automatic restart on file changes.

### Testing the API

```bash
# Health check
curl http://localhost:5000/api/health

# Get all websites
curl http://localhost:5000/api/websites

# Test website connection
curl -X POST http://localhost:5000/api/websites/WEBSITE_ID/test
```

## Production Deployment

1. **Set NODE_ENV=production**
2. **Use MongoDB Atlas** for cloud database
3. **Configure proper CORS** origins
4. **Set up SSL/HTTPS**
5. **Use PM2** for process management
6. **Set up monitoring** and logging

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error:**
   - Check if MongoDB is running
   - Verify connection string in .env
   - Check network connectivity

2. **API Key Issues:**
   - Verify API keys are correct
   - Check website endpoints are accessible
   - Ensure proper authentication headers

3. **Monitoring Failures:**
   - Check website URLs are correct
   - Verify API endpoints exist
   - Check network connectivity

## Support

For issues and questions:
- Check the logs for error messages
- Verify MongoDB connection
- Test API endpoints manually
- Check website accessibility

## License

MIT License
