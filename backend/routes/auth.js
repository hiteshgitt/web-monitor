const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Website = require('../models/Website');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const adminEmails = () => (process.env.ADMIN_EMAILS || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

// Shared post-sign-in steps: admin role from ADMIN_EMAILS, last login, and for admins,
// adopt sites created before accounts existed so they don't disappear
async function finishSignIn(user) {
  if (adminEmails().includes(user.email) && user.role !== 'admin') {
    user.role = 'admin';
  }
  user.lastLoginAt = new Date();
  await user.save();
  if (user.role === 'admin') {
    await Website.updateMany({ owner: { $exists: false } }, { $set: { owner: user._id } });
  }
  return { token: signToken(user), user };
}

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }
  if (await User.exists({ email: normalizedEmail })) {
    return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
  }
  const user = new User({ email: normalizedEmail, name: String(name || '').trim() });
  await user.setPassword(String(password));
  res.status(201).json(await finishSignIn(user));
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: String(email || '').trim().toLowerCase() });
  // Same message for unknown email and wrong password, so accounts can't be probed
  if (!user || !(await user.checkPassword(String(password || '')))) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  res.json(await finishSignIn(user));
});

router.post('/google', async (req, res) => {
  const clientIds = (process.env.GOOGLE_CLIENT_ID || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (clientIds.length === 0) {
    return res.status(503).json({ error: 'Google sign-in is not configured' });
  }
  let payload;
  try {
    const ticket = await new OAuth2Client().verifyIdToken({ idToken: req.body?.credential, audience: clientIds });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'Google sign-in failed, please try again' });
  }
  if (!payload?.email || !payload.email_verified) {
    return res.status(401).json({ error: 'Your Google account email is not verified' });
  }
  const email = payload.email.toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });
  if (!user) {
    user = new User({ email, name: payload.name || '' });
  }
  user.googleId = payload.sub;
  if (payload.picture) user.avatarUrl = payload.picture;
  if (!user.name && payload.name) user.name = payload.name;
  res.json(await finishSignIn(user));
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Manual Pro for now: the customer asks, an admin switches the plan
router.post('/upgrade-request', requireAuth, async (req, res) => {
  if (!req.user.isPro && !req.user.upgradeRequestedAt) {
    req.user.upgradeRequestedAt = new Date();
    await req.user.save();
  }
  res.json({ user: req.user });
});

module.exports = router;
