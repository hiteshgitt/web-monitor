// Web Monitor on Cloudflare Workers.
// - fetch:     /api/* (everything else is served from the website/dashboard build as static assets)
// - scheduled: the monitor, once per minute (cron trigger)
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { requireAdmin } from './lib/adminAuth.js';
import { authRateLimit, requireAuth, requirePro } from './lib/auth.js';
import { runMonitoringCycle } from './lib/monitor.js';
import { scanDueSecurity } from './lib/securityScan.js';
import { scanDueVitals } from './lib/webVitals.js';
import { ApiError } from './lib/util.js';
import adminRoutes from './routes/admin.js';
import adminAuthRoutes from './routes/adminAuth.js';
import advancedRoutes from './routes/advanced.js';
import authRoutes from './routes/auth.js';
import { adminNotifications, customerNotifications, pushPull } from './routes/notifications.js';
import billingRoutes, { razorpayWebhook } from './routes/billing.js';
import statusRoutes from './routes/status.js';
import websiteRoutes from './routes/websites.js';
import { handleCallback as googleAnalyticsCallback } from './lib/googleAnalytics.js';
import { handleCallback as searchConsoleCallback } from './lib/searchConsole.js';

const app = new Hono().basePath('/api');

app.use('*', secureHeaders());
// Same-origin by default; extra origins (e.g. the mobile app) come from ALLOWED_ORIGINS
app.use('*', (c, next) => cors({
  origin: (c.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})(c, next));

app.get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }));
app.route('/status', statusRoutes);
// Google redirects the browser here. The signed state identifies the user; there is no bearer token on a redirect.
app.get('/analytics/google/callback', googleAnalyticsCallback);
app.get('/search-console/google/callback', searchConsoleCallback);

app.use('/auth/*', authRateLimit);
app.route('/auth', authRoutes);

app.use('/websites', requireAuth);
app.use('/websites/*', requireAuth);
app.route('/websites', websiteRoutes);

// Advanced view is the paid Pro tier
app.use('/advanced/*', requireAuth, requirePro);
app.route('/advanced', advancedRoutes);

// Razorpay posts here with its own signature. There is no customer session on that call.
app.post('/billing/razorpay', razorpayWebhook);
app.use('/billing/*', requireAuth);
app.route('/billing', billingRoutes);

app.use('/notifications', requireAuth);
app.use('/notifications/*', requireAuth);
app.route('/notifications', customerNotifications);
// Browser service workers fetch alert text here after a Web Push wake-up (pull_key, no sign-in token)
app.route('/push', pushPull);

// Super admin (/ruyashield): own accounts, password + authenticator code, 8-hour sessions
app.use('/admin-auth/*', authRateLimit);
app.route('/admin-auth', adminAuthRoutes);
app.use('/admin/*', requireAdmin);
app.route('/admin/notifications', adminNotifications);
app.route('/admin', adminRoutes);

app.notFound((c) => c.json({ error: 'Route not found' }, 404));

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json({ error: error.message, ...error.extra }, error.status);
  }
  console.error('Unhandled API error:', error);
  return c.json({ error: 'Internal server error' }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    // PageSpeed is its own run so it does not use the health-check request budget.
    if (controller.cron === '*/15 * * * *') {
      ctx.waitUntil((async () => {
        const security = await scanDueSecurity(env).catch((error) => {
          console.error('Security scan failed:', error);
          return { skipped: 'error' };
        });
        console.log('Security scan', security);
        if (security.skipped === 'none-due') {
          const vitals = await scanDueVitals(env).catch((error) => {
            console.error('Vitals scan failed:', error);
            return { skipped: 'error' };
          });
          console.log('Vitals scan', vitals);
        }
      })());
      return;
    }
    ctx.waitUntil(runMonitoringCycle(env, controller.scheduledTime).then(
      (summary) => console.log('Monitoring cycle', summary),
      (error) => console.error('Monitoring cycle failed:', error),
    ));
  },
};
