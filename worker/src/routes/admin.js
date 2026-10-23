// Admin only: customers and their plans (manual Pro for now)
import { Hono } from 'hono';
import { serializeUser } from '../lib/serialize.js';
import { ApiError, nowIso } from '../lib/util.js';

const admin = new Hono();

// Customers with their site counts; pending Pro requests first
admin.get('/users', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT u.*, (SELECT COUNT(*) FROM websites w WHERE w.owner_id = u.id) AS sites
    FROM users u ORDER BY (u.upgrade_requested_at IS NULL), u.upgrade_requested_at DESC, u.created_at DESC`).all();
  return c.json(results.map((row) => serializeUser(row, { sites: row.sites })));
});

admin.patch('/users/:id', async (c) => {
  const { plan } = await c.req.json().catch(() => ({}));
  if (!['free', 'pro'].includes(plan)) throw new ApiError(400, 'plan must be "free" or "pro"');
  const now = nowIso();
  // Approving Pro also clears the pending request
  const result = await c.env.DB.prepare(`UPDATE users SET plan = ?1,
      upgrade_requested_at = CASE WHEN ?1 = 'pro' THEN NULL ELSE upgrade_requested_at END, updated_at = ?2
    WHERE id = ?3`).bind(plan, now, c.req.param('id')).run();
  if (!result.meta.changes) throw new ApiError(404, 'User not found');
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(c.req.param('id')).first();
  return c.json(serializeUser(user));
});

export default admin;
