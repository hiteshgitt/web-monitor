# Next.js Integration for Web Monitor

This folder contains API routes for integrating your Next.js application with the Web Monitor Dashboard.

## 📁 Files Included

### For Next.js 13+ (App Router)
- `app-router/webmonitor/[...slug]/route.ts` - Catch-all API route handler

### For Next.js 12 and below (Pages Router)
- `pages-router/api/webmonitor/[...slug].ts` - Catch-all API route handler

### Configuration
- `.env.example` - Environment variables template

## 🚀 Installation

### Step 1: Choose Your Next.js Version

**If you're using Next.js 13+ with App Router:**
1. Copy the `app-router/webmonitor/[...slug]` folder to your project:
   ```
   your-nextjs-project/app/api/webmonitor/[...slug]/route.ts
   ```
   
   This uses a catch-all route to handle `/api/webmonitor/health`, `/api/webmonitor/analytics`, etc.

**If you're using Next.js 12 or below (Pages Router):**
1. Copy `pages-router/api/webmonitor/[...slug].ts` to your project:
   ```
   your-nextjs-project/pages/api/webmonitor/[...slug].ts
   ```

### Step 2: Install Dependencies

**No dependencies needed!** The integration uses only Node.js built-in modules (`os`, `crypto`, `fs`, `path`). These come with Node.js, so no installation required.

### Step 3: Set Environment Variables

1. Copy `.env.example` to `.env.local` in your Next.js project
2. Generate an API key (you can use any secure random string generator)
3. Add the API key to `.env.local`:
   ```
   WEBMONITOR_API_KEY=your_secure_api_key_here
   ```

### Step 4: Test the Integration

1. Start your Next.js development server:
   ```bash
   npm run dev
   ```

2. Test the health endpoint:
   ```bash
   curl http://localhost:3000/api/webmonitor/health \
     -H "Authorization: Bearer your_secure_api_key_here"
   ```

3. You should see a JSON response with health status.

### Step 5: Add to Web Monitor Dashboard

1. Open your Web Monitor Dashboard
2. Click "Add New Website"
3. Select "Next.js" as platform
4. Enter your website URL (e.g., `https://yourdomain.com`)
5. Enter the API key you set in `.env.local`
6. Click "Add Website"

## 📡 Available Endpoints

All endpoints require authentication via Bearer token in the Authorization header.

### Health Check
```
GET /api/webmonitor/health
```

### Analytics
```
GET /api/webmonitor/analytics
```

### Performance
```
GET /api/webmonitor/performance
```

### SEO
```
GET /api/webmonitor/seo
```

### Security
```
GET /api/webmonitor/security
```

## 🔒 Security

- All endpoints require API key authentication
- Use environment variables for API keys (never commit to git)
- Consider adding rate limiting in production
- Use HTTPS in production

## 🔧 Customization

You can customize the data returned by modifying the route handlers. The structure should match the WordPress plugin format for consistency.

## 📝 Notes

- The API routes collect real-time system metrics
- Some metrics may be simulated if not available (e.g., visitor counts)
- You can integrate with your analytics provider (Google Analytics, etc.) for real data
- Performance metrics are calculated based on actual server response times

## 🐛 Troubleshooting

### 404 Error
- Make sure the file is in the correct location based on your Next.js version
- Check that your Next.js server is running

### 401 Unauthorized
- Verify the API key matches in both `.env.local` and the Web Monitor Dashboard
- Check the Authorization header format: `Bearer {api_key}`

### CORS Issues
- Make sure your Web Monitor backend CORS settings allow your Next.js domain

## 📞 Support

For issues or questions, check the main Web Monitor documentation or contact support.

