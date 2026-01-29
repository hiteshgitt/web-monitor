const express = require('express');
const router = express.Router();
const Website = require('../models/Website');
const MonitoringData = require('../models/MonitoringData');
const AnalyticsData = require('../models/AnalyticsData');

// Get all websites
router.get('/', async (req, res) => {
  try {
    const websites = await Website.find({ monitoringEnabled: true })
      .sort({ createdAt: -1 });
    res.json(websites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single website
router.get('/:id', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }
    res.json(website);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new website
router.post('/', async (req, res) => {
  try {
    const website = new Website(req.body);
    await website.save();
    res.status(201).json(website);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update website
router.put('/:id', async (req, res) => {
  try {
    const website = await Website.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }
    res.json(website);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete website
router.delete('/:id', async (req, res) => {
  try {
    const website = await Website.findByIdAndDelete(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }
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
      websiteId: req.params.id,
      timestamp: { $gte: hoursAgo }
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit));
    
    res.json(monitoringData);
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
      websiteId: req.params.id,
      date: { $gte: daysAgo }
    })
    .sort({ date: -1 });
    
    res.json(analyticsData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test website connection
router.post('/:id/test', async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }
    
    // Simulate website health check
    const startTime = Date.now();
    
    // Here you would implement actual website health checking
    // For now, we'll simulate it
    const responseTime = Math.floor(Math.random() * 1000) + 100;
    const status = Math.random() > 0.1 ? 'healthy' : 'warning';
    
    // Save monitoring data
    const monitoringData = new MonitoringData({
      websiteId: website._id,
      status,
      responseTime,
      statusCode: 200,
      uptime: status === 'healthy' ? 100 : 95,
      metrics: {
        loadTime: responseTime,
        sslValid: true,
        sslExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    
    await monitoringData.save();
    
    // Update website status
    website.status = status;
    website.responseTime = responseTime;
    website.lastChecked = new Date();
    await website.save();
    
    res.json({
      status,
      responseTime,
      message: 'Website health check completed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
