# Next.js Integration Troubleshooting Guide

## Common Issues

### ❌ 404 Error: "This page could not be found"

**Problem:** The API route `/api/webmonitor/health` returns 404.

**Solutions:**

1. **Verify the file was installed correctly:**
   ```bash
   # For App Router (Next.js 13+)
   ls -la app/api/webmonitor/[...slug]/route.ts
   
   # For Pages Router (Next.js 12 or below)
   ls -la pages/api/webmonitor/[...slug].ts
   ```

2. **Restart your Next.js server:**
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart:
   npm run dev
   # or
   yarn dev
   ```
   ⚠️ **Important:** Next.js requires a server restart to pick up new API routes!

3. **Check the file location matches your Next.js version:**
   - **App Router**: Must be in `app/api/webmonitor/[...slug]/route.ts`
   - **Pages Router**: Must be in `pages/api/webmonitor/[...slug].ts`

4. **Verify the project structure:**
   ```bash
   # Check if you have app/ or pages/ folder
   ls -d app/ pages/ 2>/dev/null
   ```

5. **Check for TypeScript errors:**
   ```bash
   # If you see TypeScript errors, install types:
   npm install --save-dev @types/node
   ```

---

### ❌ 401 Unauthorized Error

**Problem:** API key authentication fails.

**Solutions:**

1. **Check `.env.local` file exists:**
   ```bash
   cat .env.local | grep WEBMONITOR_API_KEY
   ```

2. **Verify the API key matches:**
   - The key in `.env.local` should match the key you're using in Web Monitor Dashboard
   - Make sure there are no extra spaces or quotes

3. **Restart Next.js server after adding/changing `.env.local`**

---

### ❌ Connection Failed / Network Error

**Problem:** Can't connect to the Next.js server.

**Solutions:**

1. **Verify Next.js server is running:**
   ```bash
   # Check if port 3002 is listening
   netstat -tlnp | grep 3002
   # or
   ss -tlnp | grep 3002
   ```

2. **Test the endpoint directly:**
   ```bash
   curl http://192.168.2.66:3002/api/webmonitor/health \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

3. **Check CORS settings:**
   - Make sure your Web Monitor backend CORS allows your Next.js domain
   - Backend should allow: `http://192.168.2.66:3002`

4. **Check firewall/network:**
   - Ensure port 3002 is accessible from the Web Monitor backend server
   - Check if any firewall is blocking the connection

---

### ❌ File Not Found After Installation

**Problem:** Installation says it copied the file, but you can't find it.

**Solutions:**

1. **Check the installation output:**
   - Look for the path shown in "✅ Copied route file to: ..."

2. **Verify the installation was in the correct project:**
   ```bash
   # Make sure you ran install.js in the correct Next.js project
   pwd
   # Should show your Next.js project root, not the integration folder
   ```

3. **Manually check the file:**
   ```bash
   # For App Router
   find . -name "route.ts" -path "*/api/webmonitor/*"
   
   # For Pages Router
   find . -name "[...slug].ts" -path "*/api/webmonitor/*"
   ```

---

## Quick Verification Checklist

✅ **Installation:**
- [ ] Ran `node install.js` from integration folder
- [ ] File copied successfully (check the output)
- [ ] `.env.local` created with API key

✅ **Next.js Server:**
- [ ] Server is running on port 3002
- [ ] Server restarted after installation
- [ ] No TypeScript/compilation errors

✅ **API Route:**
- [ ] File exists in correct location
- [ ] Can access: `http://YOUR_IP:3002/api/webmonitor/health`
- [ ] Returns JSON (not 404 HTML page)

✅ **API Key:**
- [ ] Set in `.env.local`
- [ ] Matches the key in Web Monitor Dashboard
- [ ] Server restarted after setting key

---

## Step-by-Step Fix for 404 Error

1. **Verify installation:**
   ```bash
   cd /path/to/your-nextjs-project
   ls -la app/api/webmonitor/[...slug]/route.ts  # or pages/api/webmonitor/[...slug].ts
   ```

2. **If file doesn't exist, reinstall:**
   ```bash
   cd nextjs-integration
   node install.js
   ```

3. **Restart Next.js server:**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

4. **Test the endpoint:**
   ```bash
   curl http://localhost:3002/api/webmonitor/health \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

5. **If still 404, check Next.js version:**
   ```bash
   cat package.json | grep next
   # If version is 13+, use App Router
   # If version is 12 or below, use Pages Router
   ```

---

## Still Not Working?

1. Check browser console (F12) for detailed error messages
2. Check Next.js server logs for errors
3. Verify the API route file has no syntax errors
4. Make sure you're testing the correct URL (no trailing slash)

