# Next.js Integration - Easy Installation

## 📦 Installation Method

### Option 1: Copy Integration Folder to Your Project (Recommended)

1. **Copy the entire `nextjs-integration` folder** to your Next.js project root:
   ```bash
   cp -r nextjs-integration /path/to/your-nextjs-project/
   ```

2. **Navigate to the integration folder**:
   ```bash
   cd your-nextjs-project/nextjs-integration
   ```

3. **Run the installation script**:
   ```bash
   node install.js
   ```

   This will:
   - ✅ Automatically detect your Next.js version (App Router or Pages Router)
   - ✅ Copy the correct route file to your project
   - ✅ Create/update `.env.local` with a generated API key
   - ✅ Show you the API key to use

4. **Restart your Next.js server**:
   ```bash
   npm run dev
   ```

5. **Test the endpoint**:
   ```bash
   curl http://localhost:3000/api/webmonitor/health \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

---

## 🔑 Generate API Key

If you need to generate a new API key:

```bash
cd nextjs-integration
node generate-api-key.js
```

Or use the npm script:
```bash
npm run generate-api-key
```

---

## 📋 Dependencies

**Good News: No additional dependencies needed!**

The integration uses only Node.js built-in modules:
- `os` - Built into Node.js (no installation needed)
- `crypto` - Built into Node.js (no installation needed)
- `fs` - Built into Node.js (no installation needed)
- `path` - Built into Node.js (no installation needed)

**The integration is completely self-contained** and doesn't require any npm packages beyond what Next.js already provides.

---

## 🎯 What Gets Installed

When you run `node install.js`, it will:

1. **Copy route file** to the correct location:
   - App Router: `app/api/webmonitor/[...slug]/route.ts`
   - Pages Router: `pages/api/webmonitor/[...slug].ts`

2. **Create/update `.env.local`** with:
   ```
   WEBMONITOR_API_KEY=your_generated_api_key_here
   ```

3. **Show you the API key** to use in Web Monitor Dashboard

---

## 🚀 Quick Start

```bash
# 1. Copy integration folder to your Next.js project
cp -r nextjs-integration /path/to/your-nextjs-project/

# 2. Install
cd your-nextjs-project/nextjs-integration
node install.js

# 3. Restart Next.js server
cd ..
npm run dev

# 4. Test
curl http://localhost:3000/api/webmonitor/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 📡 Available Endpoints

After installation, these endpoints are available:

- `GET /api/webmonitor/health` - Health check
- `GET /api/webmonitor/analytics` - Analytics data  
- `GET /api/webmonitor/performance` - Performance metrics
- `GET /api/webmonitor/seo` - SEO data
- `GET /api/webmonitor/security` - Security status

All require: `Authorization: Bearer YOUR_API_KEY`

---

## 🔧 Manual Installation (Alternative)

If you prefer to install manually:

1. Choose the correct file based on your Next.js version
2. Copy it to the correct location
3. Create `.env.local` with `WEBMONITOR_API_KEY`
4. Generate API key using: `node generate-api-key.js`

See `INSTALLATION.md` for detailed manual steps.

---

## ❓ FAQ

### Q: Do I need to install any npm packages?
**A: No!** The integration uses only Node.js built-in modules.

### Q: Can I delete the integration folder after installation?
**A: Yes!** After running `install.js`, the route file is copied to your project. You can delete the integration folder if you want.

### Q: Where is the API key stored?
**A: In `.env.local`** in your Next.js project root. This file should be in `.gitignore` and never committed.

### Q: Can I use this in production?
**A: Yes!** Just make sure to:
- Set `WEBMONITOR_API_KEY` as an environment variable in your hosting platform
- Use your production URL in Web Monitor Dashboard
- Enable HTTPS

---

## 📞 Support

For issues or questions, check the main Web Monitor documentation.

