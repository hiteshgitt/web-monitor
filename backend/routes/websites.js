const express = require('express');
const router = express.Router();
const Website = require('../models/Website');
const MonitoringData = require('../models/MonitoringData');
const AnalyticsData = require('../models/AnalyticsData');
const Incident = require('../models/Incident');
const monitoringService = require('../services/monitoringService');
const { loadOwnedWebsite } = require('../middleware/auth');

const normalizeUrl = (url) => String(url || '').trim().replace(/\/+$/, '').toLowerCase();

// A site's API key identifies its integration, so the same key or URL means the same site.
// Returns an error message if this customer already has it (excluding the site being edited).
async function findDuplicate(ownerId, { url, apiKey }, excludeId) {
  const others = { owner: ownerId, ...(excludeId ? { _id: { $ne: excludeId } } : {}) };
  if (url) {
    const escaped = normalizeUrl(url).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (await Website.exists({ ...others, url: new RegExp(`^${escaped}/*$`) })) {
      return 'You are already monitoring this website.';
    }
  }
  if (apiKey && await Website.exists({ ...others, apiKey })) {
    return 'This API key is already connected to one of your websites.';
  }
  return null;
}

// Every :id route only sees the signed-in customer's own site (sets req.website)
router.param('id', loadOwnedWebsite);

// Get all websites
router.get('/', async (req, res) => {
  try {
    const websites = await Website.find({ owner: req.user._id, monitoringEnabled: true })
      .sort({ createdAt: -1 });
    res.json(websites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single website
router.get('/:id', (req, res) => {
  res.json(req.website);
});

// Create new website
router.post('/', async (req, res) => {
  try {
    const url = normalizeUrl(req.body?.url);
    const duplicate = await findDuplicate(req.user._id, { url, apiKey: req.body?.apiKey });
    if (duplicate) {
      return res.status(409).json({ error: duplicate });
    }
    const website = new Website({ ...req.body, url, owner: req.user._id });
    await website.save();
    // First check right away so the dashboard has real data without waiting for the next cycle
    monitoringService.checkWebsite(website).catch(() => {});
    res.status(201).json(website);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Check a site's integration before saving it (runs server-side, so no browser CORS issues)
router.post('/verify', async (req, res) => {
  try {
    const { url, platform, apiKey, websiteId } = req.body || {};
    let key = apiKey;
    // Editing without re-entering the key: verify with the stored one
    if (!key && websiteId) {
      const existing = await Website.findOne({ _id: websiteId, owner: req.user._id }).catch(() => null);
      key = existing?.apiKey;
    }
    if (!url || !platform || !key) {
      return res.status(400).json({ ok: false, message: 'URL, platform and API key are required.' });
    }
    res.json(await monitoringService.verifyConnection({ url, platform, apiKey: key }));
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

// Update website
router.put('/:id', async (req, res) => {
  try {
    const update = { ...req.body };
    // A blank key means "keep the current one" (the browser never receives the real key)
    if (!update.apiKey) delete update.apiKey;
    delete update.apiKeyLast4;
    delete update.owner;
    if (update.url) update.url = normalizeUrl(update.url);
    const duplicate = await findDuplicate(req.user._id, { url: update.url, apiKey: update.apiKey }, req.website._id);
    if (duplicate) {
      return res.status(409).json({ error: duplicate });
    }
    const website = await Website.findByIdAndUpdate(
      req.website._id,
      update,
      { returnDocument: 'after', runValidators: true }
    );
    res.json(website);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete website
router.delete('/:id', async (req, res) => {
  try {
    // Remove the site's history too, so deleting really deletes (privacy policy relies on this)
    await Promise.all([
      MonitoringData.deleteMany({ websiteId: req.website._id }),
      Incident.deleteMany({ websiteId: req.website._id }),
      AnalyticsData.deleteMany({ websiteId: req.website._id }),
      Website.deleteOne({ _id: req.website._id })
    ]);
    res.json({ message: 'Website deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get website monitoring data
router.get('/:id/monitoring', async (req, res) => {
  try {
    const { limit = 100, hours = 24 } = req.query;
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);

    const monitoringData = await MonitoringData.find({
      websiteId: req.website._id,
      timestamp: { $gte: hoursAgo }
    })
    .sort({ timestamp: -1 })
    .limit(Math.min(parseInt(limit, 10) || 100, 5000))
    .select('timestamp status responseTime statusCode error')
    .lean();

    res.json(monitoringData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Downtime incidents (part of the Basic view)
router.get('/:id/incidents', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days, 10) || 30, 90);
    res.json(await monitoringService.getIncidents(req.website._id, days));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get website analytics data
router.get('/:id/analytics', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const analyticsData = await AnalyticsData.find({
      websiteId: req.website._id,
      date: { $gte: daysAgo }
    })
    .sort({ date: -1 });

    res.json(analyticsData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test website connection: runs a real monitoring check now and records it like a scheduled one
router.post('/:id/test', async (req, res) => {
  try {
    const website = req.website;
    await monitoringService.checkWebsite(website);
    res.json({
      status: website.status,
      responseTime: website.responseTime,
      uptime: website.uptime,
      lastChecked: website.lastChecked,
      message: 'Website health check completed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
