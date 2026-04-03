# Web Monitor — API Integration Guide
> **Next.js · Laravel · PHP · Custom Stacks**

---

## 📖 How the System Works

```
┌───────────────────┐      HTTP/REST       ┌──────────────────┐
│   Your App        │ ◄──── API Key ──────► │  Web Monitor     │
│  (Next.js/Laravel)│                        │  Backend (:5000) │
│                   │  ──► /api/health       │                  │
│  Exposes REST API │  ──► /api/analytics    │  Polls your app  │
│  endpoints        │  ──► /api/performance  │  every N minutes │
│                   │  ──► /api/security     │                  │
└───────────────────┘                        └──────────────────┘
                                                      │
                                                      ▼
                                             ┌──────────────────┐
                                             │  Dashboard UI    │
                                             │  (React :3000)   │
                                             │  Displays data   │
                                             └──────────────────┘
```

**Key Concepts:**
1. Your app exposes a set of **read-only REST API endpoints**
2. You secure them with a **secret API key** (Bearer token)
3. You add your site to the dashboard with that same API key
4. The Web Monitor backend **automatically polls** your endpoints to collect metrics

---

## 🔑 Step 1 — Generate Your API Key

A secure key must be at least 32 characters. Generate one:

```bash
# Linux / macOS
openssl rand -hex 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# PHP
php -r "echo bin2hex(random_bytes(32));"
```

**Store this key safely** — you will use it in your app and in the dashboard.

---

## ⚡ Next.js Integration

### Required Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/webmonitor/health` | Site health & uptime |
| `GET /api/webmonitor/analytics` | Visitor & traffic stats |
| `GET /api/webmonitor/performance` | Core Web Vitals, load times |
| `GET /api/webmonitor/security` | SSL, headers, vulnerabilities |
| `GET /api/webmonitor/plugins` | npm packages / libraries |

### 1.1 — Create a Shared Auth Helper

```typescript
// lib/webmonitor-auth.ts
import { NextRequest, NextResponse } from 'next/server';

export function validateApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const key = authHeader.replace('Bearer ', '').trim();
  return key === process.env.WEB_MONITOR_API_KEY;
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'Unauthorized', message: 'Invalid or missing API key' },
    { status: 401 }
  );
}
```

### 1.2 — Health Endpoint

```typescript
// app/api/webmonitor/health/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse } from '@/lib/webmonitor-auth';

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();
  return NextResponse.json({
    status: 'healthy',        // 'healthy' | 'warning' | 'error' | 'offline'
    uptime: 99.9,             // percentage
    responseTime: 145,        // milliseconds
    platform: 'nextjs',
    version: process.env.APP_VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    serverInfo: {
      nodeVersion: process.version,
      memoryUsage: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    }
  });
}
```

### 1.3 — Analytics Endpoint

```typescript
// app/api/webmonitor/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse } from '@/lib/webmonitor-auth';

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  // Replace with your DB queries (Prisma, Drizzle, etc.)
  return NextResponse.json({
    totalVisitors: 0,           // unique visitors
    totalPageViews: 0,          // total page views
    bounceRate: 0.0,            // percentage e.g. 42.5
    avgSessionDuration: 0,      // seconds
    trafficSources: {
      organic: 0, direct: 0, social: 0, referral: 0
    },
    topPages: [
      { path: '/', views: 0, avgTime: 0 }
    ],
    period: '7d',
    timestamp: new Date().toISOString()
  });
}
```

### 1.4 — Performance Endpoint

```typescript
// app/api/webmonitor/performance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse } from '@/lib/webmonitor-auth';

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();
  return NextResponse.json({
    performanceScore: 85,
    loadTime: 1.2,                   // seconds
    firstContentfulPaint: 0.8,       // seconds
    largestContentfulPaint: 1.5,     // seconds
    timeToInteractive: 2.1,          // seconds
    totalBlockingTime: 120,          // ms
    cumulativeLayoutShift: 0.05,
    coreWebVitals: {
      lcp: { value: 1.5, status: 'good' },
      fid: { value: 12, status: 'good' },
      cls: { value: 0.05, status: 'good' }
    },
    timestamp: new Date().toISOString()
  });
}
```

### 1.5 — Security Endpoint

```typescript
// app/api/webmonitor/security/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse } from '@/lib/webmonitor-auth';

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();
  return NextResponse.json({
    securityScore: 92,
    sslEnabled: true,
    sslExpiry: '2025-12-01',
    malwareScan: 'Clean',           // 'Clean' | 'issues_found'
    vulnerabilityScan: 'Secure',    // 'Secure' | 'issues_found'
    headers: {
      'X-Frame-Options': true,
      'X-Content-Type-Options': true,
      'Content-Security-Policy': false,
      'Strict-Transport-Security': true,
      'Referrer-Policy': true
    },
    vulnerabilities: [],            // [{ title, severity }]
    timestamp: new Date().toISOString()
  });
}
```

### 1.6 — Packages/Libraries Endpoint

```typescript
// app/api/webmonitor/plugins/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse } from '@/lib/webmonitor-auth';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(request: NextRequest) {
  if (!validateApiKey(request)) return unauthorizedResponse();

  const packageJson = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
  );
  
  const mapDeps = (deps: Record<string, string>, isDev: boolean) =>
    Object.entries(deps || {}).map(([name, version]) => ({
      name,
      version: String(version).replace(/[\^~>=]/, ''),
      author: 'npm',
      type: isDev ? 'dev' : 'prod',
      isDev,
      is_active: !isDev,
      is_outdated: false,
      update_available: false
    }));

  const deps    = mapDeps(packageJson.dependencies, false);
  const devDeps = mapDeps(packageJson.devDependencies, true);

  return NextResponse.json({
    total_libraries: deps.length + devDeps.length,
    dependencies_count: deps.length,
    devDependencies_count: devDeps.length,
    all_libraries: [...deps, ...devDeps],
    dependencies: deps,
    devDependencies: devDeps,
    outdated_count: 0,
    security_status: 'Protected',
    framework: 'nextjs',
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
}
```

### 1.7 — Environment Variables

```env
# .env.local
WEB_MONITOR_API_KEY=your_generated_32_char_key_here
APP_VERSION=1.0.0
```

---

## 🐘 Laravel Integration

### 2.1 — Add API Key to `.env`

```env
WEB_MONITOR_API_KEY=your_generated_32_char_key_here
```

### 2.2 — Register Key in Config

```php
// config/services.php
'webmonitor' => [
    'api_key' => env('WEB_MONITOR_API_KEY'),
],
```

### 2.3 — Create Auth Middleware

```bash
php artisan make:middleware WebMonitorAuth
```

```php
<?php
// app/Http/Middleware/WebMonitorAuth.php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class WebMonitorAuth
{
    public function handle(Request $request, Closure $next)
    {
        $authHeader = $request->header('Authorization');

        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $key = trim(substr($authHeader, 7));

        if ($key !== config('services.webmonitor.api_key')) {
            return response()->json(['error' => 'Invalid API key'], 401);
        }

        return $next($request);
    }
}
```

Register it (Laravel 11+):
```php
// bootstrap/app.php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'webmonitor.auth' => \App\Http\Middleware\WebMonitorAuth::class,
    ]);
})
```

### 2.4 — Create Controller

```bash
php artisan make:controller WebMonitorController
```

```php
<?php
// app/Http/Controllers/WebMonitorController.php
namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;

class WebMonitorController extends Controller
{
    public function health()
    {
        return response()->json([
            'status'       => 'healthy',
            'uptime'       => 99.9,
            'responseTime' => 120,
            'platform'     => 'laravel',
            'version'      => app()->version(),
            'phpVersion'   => PHP_VERSION,
            'timestamp'    => now()->toISOString(),
            'serverInfo'   => [
                'php'         => PHP_VERSION,
                'laravel'     => app()->version(),
                'environment' => app()->environment(),
            ]
        ]);
    }

    public function analytics()
    {
        // Replace with your actual DB queries
        return response()->json([
            'totalVisitors'      => 0,
            'totalPageViews'     => 0,
            'bounceRate'         => 0.0,
            'avgSessionDuration' => 0,
            'trafficSources'     => [
                'organic' => 0, 'direct' => 0,
                'social'  => 0, 'referral' => 0
            ],
            'period'    => '7d',
            'timestamp' => now()->toISOString(),
        ]);
    }

    public function performance()
    {
        $dbMs = $this->measureDbResponseTime();
        return response()->json([
            'performanceScore'       => 80,
            'loadTime'               => 1.4,
            'firstContentfulPaint'   => 0.9,
            'largestContentfulPaint' => 1.8,
            'timeToInteractive'      => 2.3,
            'totalBlockingTime'      => 150,
            'cumulativeLayoutShift'  => 0.06,
            'coreWebVitals' => [
                'lcp' => ['value' => 1.8, 'status' => 'good'],
                'fid' => ['value' => 15,  'status' => 'good'],
                'cls' => ['value' => 0.06,'status' => 'good'],
            ],
            'database' => [
                'responseTime' => $dbMs,
                'connection'   => 'connected',
                'driver'       => DB::getDriverName(),
            ],
            'timestamp' => now()->toISOString(),
        ]);
    }

    public function security()
    {
        return response()->json([
            'securityScore'     => 88,
            'sslEnabled'        => request()->isSecure(),
            'malwareScan'       => 'Clean',
            'vulnerabilityScan' => 'Secure',
            'headers' => [
                'X-Frame-Options'           => true,
                'X-Content-Type-Options'    => true,
                'Content-Security-Policy'   => false,
                'Strict-Transport-Security' => request()->isSecure(),
                'Referrer-Policy'           => true,
            ],
            'vulnerabilities' => [],
            'timestamp'       => now()->toISOString(),
        ]);
    }

    public function packages()
    {
        $packages = [];
        $lockFile = base_path('composer.lock');

        if (file_exists($lockFile)) {
            $lock = json_decode(file_get_contents($lockFile), true);
            foreach ($lock['packages'] ?? [] as $pkg) {
                $packages[] = $this->mapPackage($pkg, 'prod');
            }
            foreach ($lock['packages-dev'] ?? [] as $pkg) {
                $packages[] = $this->mapPackage($pkg, 'dev');
            }
        }

        $deps    = array_values(array_filter($packages, fn($p) => $p['type'] === 'prod'));
        $devDeps = array_values(array_filter($packages, fn($p) => $p['type'] === 'dev'));

        return response()->json([
            'total_packages'        => count($packages),
            'dependencies_count'    => count($deps),
            'devDependencies_count' => count($devDeps),
            'all_packages'          => $packages,
            'dependencies'          => $deps,
            'devDependencies'       => $devDeps,
            'outdated_count'        => 0,
            'security_status'       => 'Protected',
            'framework'             => 'laravel',
            'timestamp'             => now()->toISOString(),
        ]);
    }

    private function mapPackage(array $pkg, string $type): array
    {
        return [
            'name'             => $pkg['name'],
            'version'          => ltrim($pkg['version'] ?? '', 'v'),
            'author'           => $pkg['authors'][0]['name'] ?? 'Packagist',
            'description'      => $pkg['description'] ?? '',
            'type'             => $type,
            'isDev'            => $type === 'dev',
            'is_active'        => $type === 'prod',
            'is_outdated'      => false,
            'update_available' => false,
        ];
    }

    private function measureDbResponseTime(): int
    {
        $start = microtime(true);
        try { DB::select('SELECT 1'); } catch (\Exception $e) { return -1; }
        return (int)((microtime(true) - $start) * 1000);
    }
}
```

### 2.5 — Register Routes

```php
// routes/api.php
use App\Http\Controllers\WebMonitorController;

Route::prefix('webmonitor')
    ->middleware(['webmonitor.auth', 'throttle:120,1'])
    ->group(function () {
        Route::get('/health',      [WebMonitorController::class, 'health']);
        Route::get('/analytics',   [WebMonitorController::class, 'analytics']);
        Route::get('/performance', [WebMonitorController::class, 'performance']);
        Route::get('/security',    [WebMonitorController::class, 'security']);
        Route::get('/plugins',     [WebMonitorController::class, 'packages']);
    });
```

---

## 🔌 Step 2 — Register in Dashboard

### Via cURL

```bash
# Next.js
curl -X POST http://localhost:5000/api/websites \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Next.js App",
    "url": "https://your-nextjs-app.com",
    "platform": "nextjs",
    "apiKey": "YOUR_API_KEY_HERE",
    "apiBasePath": "/api/webmonitor"
  }'

# Laravel
curl -X POST http://localhost:5000/api/websites \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Laravel App",
    "url": "https://your-laravel-app.com",
    "platform": "laravel",
    "apiKey": "YOUR_API_KEY_HERE",
    "apiBasePath": "/api/webmonitor"
  }'
```

### Test Your Endpoints First

```bash
# Next.js (local)
curl http://localhost:3000/api/webmonitor/health \
  -H "Authorization: Bearer YOUR_API_KEY"

# Laravel (local)
curl http://127.0.0.1:8000/api/webmonitor/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Expected response:
```json
{ "status": "healthy", "uptime": 99.9, "responseTime": 120, ... }
```

---

## 📡 Dashboard Backend API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/websites` | List all monitored sites |
| `GET` | `/api/websites/:id` | Get a single site |
| `POST` | `/api/websites` | Add a new site |
| `PUT` | `/api/websites/:id` | Update site config |
| `DELETE` | `/api/websites/:id` | Remove a site |
| `GET` | `/api/advanced/comprehensive/:id` | Full site report |
| `GET` | `/api/advanced/analytics/:id` | Analytics data |
| `GET` | `/api/advanced/performance/:id` | Performance data |
| `GET` | `/api/advanced/security/:id` | Security data |
| `GET` | `/api/advanced/plugins/:id` | Plugins/packages/libraries |
| `GET` | `/api/advanced/logs/:id` | Error logs |
| `GET` | `/api/advanced/export/:id?format=csv&days=30` | Export report |

---

## 🔒 Security Checklist

```
✅ Always use HTTPS for your app endpoints in production
✅ Store API key in .env only — never hardcode it
✅ Use different keys per environment (dev/staging/prod)
✅ Apply rate limiting to /api/webmonitor/* routes
✅ Do not log the Authorization header
✅ Rotate keys periodically
```

---

## 🐛 Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | Wrong key | Verify key matches exactly in both places |
| `404 Not Found` | Route missing | Check route registration |
| `NaN` in analytics | No null check | Always return `0` not `null` for numbers |
| `CORS error` | Origin blocked | Add `http://localhost:5000` to CORS allowed origins |
| Dashboard offline | Backend not running | Run `bash start-full-stack.sh` |

---

*For WordPress integration, see [AUTHENTICATION_SETUP.md](./AUTHENTICATION_SETUP.md)*
