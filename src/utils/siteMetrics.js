// Shared formatting and scoring for the site list and detail views.
// Every value is derived from real monitoring data; missing data stays null.

export const UP_STATUSES = ['healthy', 'warning'];

// Average of the scores the site integration actually reported (performance, SEO, security)
export const healthScore = (site) => {
  const scores = [
    site?.performance?.performanceScore,
    site?.seo?.score,
    site?.security?.securityScore,
  ].filter((score) => typeof score === 'number');
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
};

// Colour tone for a 0-100 score
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

// Tailwind class sets per tone
export const TONE = {
  good: { text: 'text-good', bg: 'bg-good-soft', dot: 'bg-good', bar: 'from-emerald-300 to-good' },
  warn: { text: 'text-warn', bg: 'bg-warn-soft', dot: 'bg-warn', bar: 'from-amber-200 to-warn' },
  bad: { text: 'text-bad', bg: 'bg-bad-soft', dot: 'bg-bad', bar: 'from-rose-300 to-bad' },
  muted: { text: 'text-ink-muted', bg: 'bg-brand-50', dot: 'bg-ink-faint', bar: 'from-brand-200 to-brand-400' },
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
