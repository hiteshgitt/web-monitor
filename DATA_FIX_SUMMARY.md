# Data Display Fix

## Issue
The dashboard is showing "N/A" for all metrics because the data structure from the backend doesn't match what the frontend expects.

## Backend Returns:
```json
{
  "analytics": {
    "googleAnalytics": {
      "sessions": 10526,
      "users": 7439,
      "pageviews": 28178,
      ...
    }
  }
}
```

## Frontend Expects:
```javascript
selectedWebsite?.analytics?.totalVisitors  // But gets nothing
selectedWebsite?.analytics?.totalPageViews  // But gets nothing
```

## Problem
The frontend is looking at `selectedWebsite.analytics.totalVisitors` but the backend returns:
- `analytics.googleAnalytics.users` (for visitors)
- `analytics.googleAnalytics.pageviews` (for page views)

## Solution

The comprehensive endpoint needs to transform data OR the frontend needs to be updated to handle both formats.

### Option 1: Update Dashboard Component
Modify AdvancedDashboard.jsx to check multiple sources:
```javascript
const visitors = selectedWebsite?.analytics?.totalVisitors || 
                 selectedWebsite?.analytics?.googleAnalytics?.users || 
                 advancedData?.analytics?.googleAnalytics?.sessions || 
                 0;
```

### Option 2: Update Backend to Return Consistent Structure
Modify monitoringService.js to always return:
```javascript
analytics: {
  totalVisitors: analyticsData.users || googleAnalyticsData.sessions,
  totalPageViews: analyticsData.pageviews || googleAnalyticsData.pageviews,
  ...
}
```

## Quick Test

Check what data is actually available:
```bash
curl "http://localhost:5000/api/advanced/comprehensive/69006be62411ca7e07815d9b" | jq '.analytics'
```

The backend is returning comprehensive data, but the frontend dashboard component needs to be updated to read from the correct paths.

