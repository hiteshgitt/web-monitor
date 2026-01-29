# Updating API Key in Next.js Project

## What Happens When You Change the API Key?

If you change the `WEBMONITOR_API_KEY` in your Next.js project's `.env.local` file, you **must** also update it in the Web Monitor Dashboard. Otherwise, authentication will fail.

## Step-by-Step Guide

### Scenario: You Changed the API Key in `.env.local`

#### Step 1: Update `.env.local` in Your Next.js Project

```bash
# In your Next.js project root
nano .env.local
```

Change the API key:
```
WEBMONITOR_API_KEY=new_api_key_here
```

#### Step 2: Restart Your Next.js Server

**Important:** Next.js requires a restart to load new environment variables.

```bash
# Stop your current server (Ctrl+C)
# Then restart:
npm run dev
# or
yarn dev
```

#### Step 3: Update API Key in Web Monitor Dashboard

You have two options:

**Option A: Edit Existing Website (Recommended)**
1. Open Web Monitor Dashboard
2. Find your website in the list
3. Click "Edit" or the settings icon
4. Update the API Key field with the new key
5. Click "Save" or "Update"

**Option B: Remove and Re-add Website**
1. Delete the website from the dashboard
2. Add it again with the new API key

### Step 4: Verify the Connection

After updating, test the connection:

```bash
curl http://your-nextjs-site.com/api/webmonitor/health \
  -H "Authorization: Bearer YOUR_NEW_API_KEY"
```

You should see a JSON response with health status.

## Common Issues

### Issue: "Invalid API key" Error

**Cause:** The API key in the dashboard doesn't match the one in `.env.local`.

**Solution:**
1. Verify the API key in `.env.local` matches what you entered in the dashboard
2. Make sure there are no extra spaces or characters
3. Restart your Next.js server after changing `.env.local`

### Issue: "Connection failed" Error

**Cause:** The Next.js server wasn't restarted after changing `.env.local`.

**Solution:**
1. Stop the Next.js server (Ctrl+C)
2. Start it again: `npm run dev`
3. Try the connection again

### Issue: Dashboard Shows Website as "Offline"

**Cause:** API key mismatch or server not running.

**Solution:**
1. Check if Next.js server is running
2. Verify API key in both places:
   - `.env.local` in your Next.js project
   - Web Monitor Dashboard (website settings)
3. Test the endpoint manually with curl

## Best Practices

### 1. Generate a Secure API Key

Use a strong, random API key:

```bash
# Option 1: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: OpenSSL
openssl rand -hex 32
```

### 2. Keep API Keys Synchronized

- ✅ Always update both places when changing API key
- ✅ Use the same key in `.env.local` and Dashboard
- ✅ Document your API keys securely (password manager)

### 3. Rotate API Keys Regularly

For security, rotate your API keys periodically:

1. Generate a new API key
2. Update `.env.local`
3. Restart Next.js server
4. Update Dashboard
5. Test connection
6. Delete old API key from your records

### 4. Use Environment Variables in Production

In production, set `WEBMONITOR_API_KEY` as an environment variable in your hosting platform:

- **Vercel:** Settings → Environment Variables
- **Netlify:** Site settings → Environment variables
- **Docker:** `docker run -e WEBMONITOR_API_KEY=...`
- **Kubernetes:** ConfigMap or Secret

## Quick Reference

### Files to Update
- `.env.local` in your Next.js project root
- Web Monitor Dashboard (website settings)

### Commands
```bash
# Restart Next.js server
npm run dev

# Test endpoint
curl http://localhost:3000/api/webmonitor/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Checklist
- [ ] Updated `.env.local` with new API key
- [ ] Restarted Next.js server
- [ ] Updated API key in Web Monitor Dashboard
- [ ] Tested connection with curl
- [ ] Verified website shows as "Online" in dashboard

## Troubleshooting

If you're still having issues:

1. **Check `.env.local` syntax:**
   ```
   WEBMONITOR_API_KEY=your_key_here
   ```
   (No quotes, no spaces around `=`)

2. **Verify file location:**
   - `.env.local` should be in the Next.js project root
   - Not in `app/` or `pages/` directories

3. **Check for typos:**
   - Copy-paste the API key to avoid typos
   - Compare both places character-by-character if needed

4. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   npm run dev
   ```

## Security Notes

- 🔒 Never commit `.env.local` to git (it should be in `.gitignore`)
- 🔒 Use different API keys for different environments (dev, staging, production)
- 🔒 Rotate API keys if you suspect they've been compromised
- 🔒 Use strong, randomly generated keys (32+ characters)
