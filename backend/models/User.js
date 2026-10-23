const crypto = require('crypto');
const { promisify } = require('util');
const mongoose = require('mongoose');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    trim: true,
    default: ''
  },
  avatarUrl: String,
  // "salt:hash" from scrypt; absent for Google-only accounts
  passwordHash: String,
  googleId: {
    type: String,
    index: true,
    sparse: true
  },
  // Basic view is free; the Advanced view needs Pro (switched manually by an admin for now)
  plan: {
    type: String,
    enum: ['free', 'pro'],
    default: 'free'
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  upgradeRequestedAt: Date,
  lastLoginAt: Date
}, { timestamps: true });

userSchema.methods.setPassword = async function(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, KEY_LENGTH);
  this.passwordHash = `${salt}:${hash.toString('hex')}`;
};

userSchema.methods.checkPassword = async function(password) {
  if (!this.passwordHash) return false;
  const [salt, stored] = this.passwordHash.split(':');
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return crypto.timingSafeEqual(Buffer.from(stored, 'hex'), hash);
};

// Admins always get Pro features
userSchema.virtual('isPro').get(function() {
  return this.plan === 'pro' || this.role === 'admin';
});

userSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    delete ret.passwordHash;
    delete ret.googleId;
    delete ret.id;
    ret.hasPassword = Boolean(doc.passwordHash);
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
