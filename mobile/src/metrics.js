// Same scoring as the website, so a site shows the same number in both places.

export const UP_STATUSES = ['healthy', 'warning'];

export const healthScore = (site) => {
  const scores = [
    site?.performance?.performanceScore,
    site?.seo?.score,
    site?.security?.securityScore,
  ].filter((score) => typeof score === 'number');
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
};

export const scoreTone = (score) => {
  if (score == null) return 'muted';
  if (score >= 80) return 'good';
  if (score >= 60) return 'warn';
  return 'bad';
};

export const statusTone = (status) => {
  if (status === 'healthy') return 'good';
  if (status === 'warning') return 'warn';
  if (status === 'error' || status === 'offline') return 'bad';
  return 'muted';
};

export const STATUS_LABEL = {
  healthy: 'Healthy',
  warning: 'Warning',
  error: 'Error',
  offline: 'Offline',
};

export const formatMs = (ms) => {
  if (ms == null) return '--';
  if (ms < 10) return `${ms.toFixed(2)} ms`;
  return `${Math.round(ms).toLocaleString()} ms`;
};

export const formatPercent = (value) => (value == null ? '--' : `${value}%`);

export const timeAgo = (date) => {
  if (!date) return 'never';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(date).toLocaleDateString();
};

export const displayUrl = (url = '') => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

export const PLATFORM_LABEL = {
  wordpress: 'WordPress',
  nextjs: 'Next.js',
  laravel: 'Laravel',
  codeigniter: 'CodeIgniter',
  php: 'PHP',
};

export const platformLabel = (platform) => PLATFORM_LABEL[platform] || platform || 'Site';

export const formatRatio = (value) => (typeof value === 'number' ? `${Math.round(value * 10) / 10}%` : null);

export const availability = (checks) => {
  if (!checks.length) return null;
  const up = checks.filter((check) => UP_STATUSES.includes(check.status)).length;
  return Math.round((up / checks.length) * 1000) / 10;
};

export const latencySeries = (checks, bucketMinutes = 15) => {
  const bucketMs = bucketMinutes * 60 * 1000;
  const buckets = new Map();
  checks.forEach((check) => {
    if (!UP_STATUSES.includes(check.status) || check.responseTime == null) return;
    const key = Math.floor(new Date(check.timestamp).getTime() / bucketMs) * bucketMs;
    const bucket = buckets.get(key) || { total: 0, count: 0 };
    bucket.total += check.responseTime;
    bucket.count += 1;
    buckets.set(key, bucket);
  });
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([key, { total, count }]) => ({
      time: new Date(key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      response: Math.round(total / count),
    }));
};

export const clock = (date) => (
  date ? new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'
);
