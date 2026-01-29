# Step-by-Step Installation Guide

## Quick Installation Steps

### Step 1: Check Your Next.js Version

First, check which version of Next.js you're using:

```bash
cd your-nextjs-project
cat package.json | grep "next"
```

**Or check your project structure:**
- If you have an `app/` folder → You're using **App Router** (Next.js 13+)
- If you only have a `pages/` folder → You're using **Pages Router** (Next.js 12 or below)

---

## For Next.js 13+ (App Router)

### Step 1: Copy the File

Copy the route file to your project:

```bash
# From the SAP Analytics folder
mkdir -p your-nextjs-project/app/api/webmonitor/[...slug]
cp nextjs-integration/app-router/webmonitor/[...slug]/route.ts \
   your-nextjs-project/app/api/webmonitor/[...slug]/route.ts
```

**Or manually:**
1. Create folder structure: `your-nextjs-project/app/api/webmonitor/[...slug]/`
2. Copy `nextjs-integration/app-router/webmonitor/[...slug]/route.ts` 
3. Paste it as `your-nextjs-project/app/api/webmonitor/[...slug]/route.ts`

**Note:** The `[...slug]` folder name is required for Next.js catch-all routes. This allows handling `/api/webmonitor/health`, `/api/webmonitor/analytics`, etc.

### Step 2: Set Environment Variable

Add to your `.env.local` file (create it if it doesn't exist):

```bash
# In your Next.js project root
nano .env.local
```

Add this line:
```
WEBMONITOR_API_KEY=your_secure_api_key_here
```

**Generate a secure API key:**
```bash
# Option 1: Use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Use OpenSSL
openssl rand -hex 32

# Option 3: Use online generator
# Visit: https://randomkeygen.com/
```

### Step 3: Install Dependencies (if needed)

The `os` module is built into Node.js, so no additional installation needed!

### Step 4: Test the Installation

Start your Next.js dev server:

```bash
npm run dev
# or
yarn dev
```

Test the health endpoint:

```bash
curl http://localhost:3000/api/webmonitor/health \
  -H "Authorization: Bearer your_secure_api_key_here"
```

You should see a JSON response with health status.

### Step 5: Add to Web Monitor Dashboard

1. Open your Web Monitor Dashboard (http://localhost:3001)
2. Click **"Add New Website"**
3. Fill in:
   - **Name**: Your Next.js site name
   - **URL**: `http://localhost:3000` (or your production URL)
   - **Platform**: Select **"Next.js"**
   - **API Key**: The same key you set in `.env.local`
4. Click **"Add Website"**

---

## For Next.js 12 and Below (Pages Router)

### Step 1: Copy the File

Copy the route file to your project:

```bash
# From the SAP Analytics folder
cp nextjs-integration/pages-router/api/webmonitor/[...slug].ts \
   your-nextjs-project/pages/api/webmonitor/[...slug].ts
```

**Or manually:**
1. Create folder: `your-nextjs-project/pages/api/webmonitor/`
2. Copy `nextjs-integration/pages-router/api/webmonitor/[...slug].ts`
3. Paste it as `your-nextjs-project/pages/api/webmonitor/[...slug].ts`

### Step 2: Set Environment Variable

Add to your `.env.local` file (create it if it doesn't exist):

```bash
# In your Next.js project root
nano .env.local
```

Add this line:
```
WEBMONITOR_API_KEY=your_secure_api_key_here
```

**Generate a secure API key:**
```bash
# Option 1: Use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Use OpenSSL
openssl rand -hex 32
```

### Step 3: Install Dependencies (if needed)

The `os` module is built into Node.js, so no additional installation needed!

### Step 4: Test the Installation

Start your Next.js dev server:

```bash
npm run dev
# or
yarn dev
```

Test the health endpoint:

```bash
curl http://localhost:3000/api/webmonitor/health \
  -H "Authorization: Bearer your_secure_api_key_here"
```

You should see a JSON response with health status.

### Step 5: Add to Web Monitor Dashboard

1. Open your Web Monitor Dashboard (http://localhost:3001)
2. Click **"Add New Website"**
3. Fill in:
   - **Name**: Your Next.js site name
   - **URL**: `http://localhost:3000` (or your production URL)
   - **Platform**: Select **"Next.js"**
   - **API Key**: The same key you set in `.env.local`
4. Click **"Add Website"**

---

## Available Endpoints

Once installed, these endpoints will be available:

- `GET /api/webmonitor/health` - Health check
- `GET /api/webmonitor/analytics` - Analytics data
- `GET /api/webmonitor/performance` - Performance metrics
- `GET /api/webmonitor/seo` - SEO data
- `GET /api/webmonitor/security` - Security status

All require authentication: `Authorization: Bearer YOUR_API_KEY`

---

## Troubleshooting

### "Cannot find module 'next/server'" Error

This means you're using the wrong version file. Check:
- App Router file → Should be in `app/api/webmonitor/[...slug]/route.ts`
- Pages Router file → Should be in `pages/api/webmonitor/[...slug].ts`

### "Invalid API key" Error

1. Make sure `.env.local` has `WEBMONITOR_API_KEY` set
2. Restart your Next.js dev server after adding the env variable
3. Use the same API key in both `.env.local` and Web Monitor Dashboard

### "404 Not Found" Error

1. Check the file is in the correct location
2. Make sure the folder structure matches exactly
3. Restart your Next.js dev server

### TypeScript Errors

If you see TypeScript errors about missing types:

```bash
# Install Node.js types
npm install --save-dev @types/node

# Make sure Next.js is installed
npm install next react react-dom

# Make sure TypeScript is installed
npm install --save-dev typescript @types/react @types/react-dom
```

---

## Production Deployment

### For Vercel:
1. Add `WEBMONITOR_API_KEY` to Vercel Environment Variables
2. Deploy your Next.js app
3. Update the URL in Web Monitor Dashboard to your production URL

### For Other Platforms:
1. Set `WEBMONITOR_API_KEY` as an environment variable
2. Deploy your Next.js app
3. Update the URL in Web Monitor Dashboard to your production URL

---

## Security Notes

⚠️ **Important:**
- Never commit `.env.local` to git (it should be in `.gitignore`)
- Use a strong, random API key (32+ characters)
- Use HTTPS in production
- Keep your API key secret

---

## Next Steps

After installation:
1. ✅ Test all endpoints
2. ✅ Add your site to Web Monitor Dashboard
3. ✅ View real-time monitoring data
4. ✅ Customize the data collection (optional)

For customization, edit the route file to integrate with your analytics provider (Google Analytics, Vercel Analytics, etc.).

