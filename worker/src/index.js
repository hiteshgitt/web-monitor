// Web Monitor on Cloudflare Workers.
// - fetch:     /api/* (everything else is served from the website/dashboard build as static assets)
// - scheduled: the monitor, once per minute (cron trigger)
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { authRateLimit, requireAdmin, requireAuth, requirePro } from './lib/auth.js';
import { runMonitoringCycle } from './lib/monitor.js';
import { ApiError } from './lib/util.js';
import adminRoutes from './routes/admin.js';
import advancedRoutes from './routes/advanced.js';
import authRoutes from './routes/auth.js';
import notificationRoutes, { pushPull } from './routes/notifications.js';
import websiteRoutes from './routes/websites.js';

const app = new Hono().basePath('/api');

app.use('*', secureHeaders());
// Same-origin by default; extra origins (e.g. the mobile app) come from ALLOWED_ORIGINS
app.use('*', (c, next) => cors({
  origin: (c.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})(c, next));

app.get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }));

app.use('/auth/*', authRateLimit);
app.route('/auth', authRoutes);

app.use('/websites', requireAuth);
app.use('/websites/*', requireAuth);
app.route('/websites', websiteRoutes);

// Advanced view is the paid Pro tier
app.use('/advanced/*', requireAuth, requirePro);
app.route('/advanced', advancedRoutes);

app.use('/notifications', requireAuth);
app.use('/notifications/*', requireAuth);
app.route('/notifications', notificationRoutes);
// Browser service workers fetch alert text here after a Web Push wake-up (pull_key, no sign-in token)
app.route('/push', pushPull);

app.use('/admin/*', requireAuth, requireAdmin);
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
    ctx.waitUntil(runMonitoringCycle(env, controller.scheduledTime).then(
      (summary) => console.log('Monitoring cycle', summary),
      (error) => console.error('Monitoring cycle failed:', error),
    ));
  },
};
