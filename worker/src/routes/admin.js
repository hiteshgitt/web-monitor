// Admin only: customers, their plans (manual Pro for now), suspension and deletion, and an overview
import { Hono } from 'hono';
import { notificationStatement } from '../lib/alerts.js';
import { serializeIncident, serializeUser, serializeWebsite } from '../lib/serialize.js';
import { liveStatsFor } from '../lib/stats.js';
import { ApiError, DOWN_STATUSES, daysAgo, nowIso } from '../lib/util.js';

const admin = new Hono();

const loadCustomer = async (c) => {
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(c.req.param('id')).first();
  if (!user) throw new ApiError(404, 'User not found');
  return user;
};

// Admins are managed through ADMIN_EMAILS, not from the dashboard
const assertNotAdmin = (user) => {
  if (user.role === 'admin') throw new ApiError(400, 'Admin accounts are managed with ADMIN_EMAILS');
};

admin.get('/stats', async (c) => {
  const db = c.env.DB;
  const down = DOWN_STATUSES.map((s) => `'${s}'`).join(', ');
  const [users, sites, incidents] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS total,
        SUM(plan = 'pro' AND role != 'admin') AS pro,
        SUM(upgrade_requested_at IS NOT NULL AND plan != 'pro' AND role != 'admin') AS pending,
        SUM(status = 'suspended') AS suspended,
        SUM(created_at >= ?1) AS new7d,
        SUM(last_login_at >= ?1) AS active7d
      FROM users`).bind(daysAgo(7).toISOString()),
    db.prepare(`SELECT COUNT(*) AS total, SUM(status IN (${down})) AS down FROM websites WHERE monitoring_enabled = 1`),
    db.prepare('SELECT COUNT(*) AS open FROM incidents WHERE ended_at IS NULL'),
  ]);
  const u = users.results[0];
  const s = sites.results[0];
  return c.json({
    customers: u.total || 0,
    pro: u.pro || 0,
    free: (u.total || 0) - (u.pro || 0),
    pendingPro: u.pending || 0,
    suspended: u.suspended || 0,
    newLast7Days: u.new7d || 0,
    activeLast7Days: u.active7d || 0,
    sites: s.total || 0,
    sitesDown: s.down || 0,
    openIncidents: incidents.results[0].open || 0,
  });
});

// Customers with their site counts; pending Pro requests first
admin.get('/users', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT u.*,
      (SELECT COUNT(*) FROM websites w WHERE w.owner_id = u.id) AS sites,
      (SELECT COUNT(*) FROM websites w WHERE w.owner_id = u.id AND w.status IN ('error', 'offline')) AS sites_down
    FROM users u
    ORDER BY (u.upgrade_requested_at IS NULL OR u.plan = 'pro'), u.upgrade_requested_at DESC, u.created_at DESC`).all();
  return c.json(results.map((row) => serializeUser(row, { sites: row.sites, sitesDown: row.sites_down })));
});

// One customer with their sites (live status) and open incidents, for support
admin.get('/users/:id', async (c) => {
  const user = await loadCustomer(c);
  const db = c.env.DB;
  const { results: siteRows } = await db.prepare('SELECT * FROM websites WHERE owner_id = ? ORDER BY created_at DESC')
    .bind(user.id).all();
  const live = await liveStatsFor(db, siteRows.map((s) => s.id));
  const { results: incidentRows } = await db.prepare(`SELECT i.* FROM incidents i JOIN websites w ON w.id = i.website_id
    WHERE w.owner_id = ? ORDER BY i.started_at DESC LIMIT 20`).bind(user.id).all();
  return c.json({
    user: serializeUser(user),
    sites: siteRows.map((row) => serializeWebsite(row, live.get(row.id))),
    incidents: incidentRows.map(serializeIncident),
  });
});

// { plan: 'free'|'pro' } | { declineRequest: true } | { status: 'active'|'suspended' }
admin.patch('/users/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const user = await loadCustomer(c);
  const db = c.env.DB;
  const now = nowIso();
  const statements = [];

  if (body.plan !== undefined) {
    if (!['free', 'pro'].includes(body.plan)) throw new ApiError(400, 'plan must be "free" or "pro"');
    assertNotAdmin(user);
    // Approving Pro also clears the pending request
    statements.push(db.prepare(`UPDATE users SET plan = ?1,
        upgrade_requested_at = CASE WHEN ?1 = 'pro' THEN NULL ELSE upgrade_requested_at END, updated_at = ?2
      WHERE id = ?3`).bind(body.plan, now, user.id));
    if (body.plan === 'pro' && user.plan !== 'pro') {
      statements.push(notificationStatement(db, {
        userId: user.id, type: 'pro_approved', title: 'Pro is active',
        body: 'Your Pro plan is on. The Advanced view is unlocked for all your sites.',
      }));
    }
  } else if (body.declineRequest) {
    assertNotAdmin(user);
    if (!user.upgrade_requested_at) throw new ApiError(400, 'This customer has no pending Pro request');
    statements.push(db.prepare('UPDATE users SET upgrade_requested_at = NULL, upgrade_declined_at = ?1, updated_at = ?1 WHERE id = ?2')
      .bind(now, user.id));
    statements.push(notificationStatement(db, {
      userId: user.id, type: 'pro_declined', title: 'Pro request not approved',
      body: String(body.reason || '').trim().slice(0, 300) || 'Your Pro request was not approved this time. Contact hiteshgml@gmail.com for details.',
    }));
  } else if (body.status !== undefined) {
    if (!['active', 'suspended'].includes(body.status)) throw new ApiError(400, 'status must be "active" or "suspended"');
    assertNotAdmin(user);
    statements.push(db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').bind(body.status, now, user.id));
    // Signed-out devices shouldn't keep getting this account's alerts
    if (body.status === 'suspended') statements.push(db.prepare('DELETE FROM push_devices WHERE user_id = ?').bind(user.id));
  } else {
    throw new ApiError(400, 'Nothing to change');
  }

  await db.batch(statements);
  const fresh = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  return c.json(serializeUser(fresh));
});

// Deletes the customer and everything they own (sites, history, alerts, devices)
admin.delete('/users/:id', async (c) => {
  const user = await loadCustomer(c);
  assertNotAdmin(user);
  const db = c.env.DB;
  const ownSites = 'SELECT id FROM websites WHERE owner_id = ?';
  await db.batch([
    db.prepare(`DELETE FROM check_hours WHERE website_id IN (${ownSites})`).bind(user.id),
    db.prepare(`DELETE FROM check_days WHERE website_id IN (${ownSites})`).bind(user.id),
    db.prepare(`DELETE FROM incidents WHERE website_id IN (${ownSites})`).bind(user.id),
    db.prepare('DELETE FROM websites WHERE owner_id = ?').bind(user.id),
    db.prepare('DELETE FROM notifications WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM push_devices WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);
  return c.json({ message: 'Customer deleted' });
});

export default admin;
