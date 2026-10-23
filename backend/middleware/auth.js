const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Website = require('../models/Website');

// Bearer tokens work the same for the web dashboard and the mobile app
function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
}

async function requireAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Please sign in', code: 'AUTH_REQUIRED' });
  }
  try {
    const { sub } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(sub);
    if (!user) {
      return res.status(401).json({ error: 'Account not found', code: 'AUTH_REQUIRED' });
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired, please sign in again', code: 'AUTH_REQUIRED' });
  }
}

function requirePro(req, res, next) {
  if (req.user?.isPro) return next();
  res.status(402).json({ error: 'The Advanced view is part of the Pro plan', code: 'PRO_REQUIRED' });
}

function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ error: 'Admins only' });
}

// router.param handler: 404 unless the :id website belongs to the signed-in user
async function loadOwnedWebsite(req, res, next, id) {
  try {
    const website = await Website.findOne({ _id: id, owner: req.user._id });
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }
    req.website = website;
    next();
  } catch {
    res.status(404).json({ error: 'Website not found' });
  }
}

module.exports = { signToken, requireAuth, requirePro, requireAdmin, loadOwnedWebsite };
