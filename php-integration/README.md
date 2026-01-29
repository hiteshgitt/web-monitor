# PHP Integration for Web Monitor

A unified integration for PHP-based projects including Laravel, CodeIgniter, and Core PHP.

## Supported Frameworks

- ✅ **Laravel** (5.x, 6.x, 7.x, 8.x, 9.x, 10.x, 11.x)
- ✅ **CodeIgniter** (3.x, 4.x)
- ✅ **Core PHP** (PHP 7.4+)

## Quick Start

### Installation

Run the install script from your PHP project root:

```bash
cd /path/to/your/php-project
node /path/to/SAP\ Analytics/php-integration/install.js
```

The script will:
1. Auto-detect your framework (Laravel, CodeIgniter, or Core PHP)
2. Install the appropriate API endpoints
3. Generate an API key
4. Configure environment variables

### Manual Installation

Choose the appropriate installation method based on your framework:

- **Laravel**: See `laravel/README.md`
- **CodeIgniter**: See `codeigniter/README.md`
- **Core PHP**: See `core-php/README.md`

## API Endpoints

All frameworks provide the same endpoints:

- `GET /api/webmonitor/health` - Health check
- `GET /api/webmonitor/analytics` - Analytics data
- `GET /api/webmonitor/performance` - Performance metrics
- `GET /api/webmonitor/seo` - SEO information
- `GET /api/webmonitor/security` - Security status
- `GET /api/webmonitor/packages` - Composer packages (Laravel/CodeIgniter)

## Authentication

All endpoints require API key authentication:

```bash
curl http://your-site.com/api/webmonitor/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Configuration

Set your API key in `.env`:

```env
WEBMONITOR_API_KEY=your_generated_api_key_here
```

## Features

- Real-time system metrics (CPU, memory, uptime)
- Composer package detection (for Laravel/CodeIgniter)
- Performance monitoring
- SEO analysis
- Security checks
- Framework version detection

