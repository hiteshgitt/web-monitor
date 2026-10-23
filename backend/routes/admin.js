const express = require('express');
const User = require('../models/User');
const Website = require('../models/Website');

const router = express.Router();

// Customers with their site counts; pending Pro requests first
router.get('/users', async (req, res) => {
  const [users, counts] = await Promise.all([
    User.find().sort({ upgradeRequestedAt: -1, createdAt: -1 }),
    Website.aggregate([{ $group: { _id: '$owner', sites: { $sum: 1 } } }])
  ]);
  const sitesByOwner = new Map(counts.map((c) => [String(c._id), c.sites]));
  res.json(users.map((user) => ({ ...user.toJSON(), sites: sitesByOwner.get(String(user._id)) || 0 })));
});

router.patch('/users/:id', async (req, res) => {
  const { plan } = req.body || {};
  if (!['free', 'pro'].includes(plan)) {
    return res.status(400).json({ error: 'plan must be "free" or "pro"' });
  }
  const update = { plan };
  if (plan === 'pro') update.$unset = { upgradeRequestedAt: 1 };
  const user = await User.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
