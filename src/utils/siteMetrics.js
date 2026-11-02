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

// Length of a real outage. An open incident is measured up to now.
export const formatSpan = (startedAt, endedAt) => {
  const start = Date.parse(startedAt);
  const end = endedAt ? Date.parse(endedAt) : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const minutes = Math.max(1, Math.round((end - start) / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 48) return rest ? `${hours}h ${rest}m` : `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
};

export const tabForAlert = (type) => {
  if (['plugins', 'ssl_off', 'ssl_ok', 'security_low'].includes(type)) return 'Security';
  // Downtime and slow alerts open History so the matching incident / check is visible under the detail card.
  if (['site_down', 'site_up', 'slow', 'slow_ok'].includes(type)) return 'History';
  return 'Overview';
};

// The outage that was open when this down or recovery alert was sent.
export const incidentForAlert = (incidents, alert) => {
  const at = Date.parse(alert?.createdAt);
  if (!Number.isFinite(at)) return null;
  const list = incidents || [];
  if (alert.type === 'site_up') {
    const closed = list.filter((item) => item.endedAt && Math.abs(Date.parse(item.endedAt) - at) < 3 * 60 * 1000);
    if (closed.length) {
      return closed.sort((a, b) => Math.abs(Date.parse(a.endedAt) - at) - Math.abs(Date.parse(b.endedAt) - at))[0];
    }
  }
  const covering = list.filter((item) => {
    const start = Date.parse(item.startedAt);
    const end = item.endedAt ? Date.parse(item.endedAt) : Date.now();
    return at >= start - 2 * 60 * 1000 && at <= end + 2 * 60 * 1000;
  });
  if (!covering.length) return null;
  return covering.sort((a, b) => Math.abs(Date.parse(a.startedAt) - at) - Math.abs(Date.parse(b.startedAt) - at))[0];
};

// The check nearest this alert, and the run of slow checks around it.
export const slowStretch = (checks, alert, threshold) => {
  const at = Date.parse(alert?.createdAt);
  const sorted = [...(checks || [])].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (!Number.isFinite(at) || sorted.length === 0) return null;
  let index = 0;
  let nearest = Infinity;
  sorted.forEach((check, i) => {
    const distance = Math.abs(Date.parse(check.timestamp) - at);
    if (distance < nearest) {
      nearest = distance;
      index = i;
    }
  });
  if (nearest > 5 * 60 * 1000) return null;
  const check = sorted[index];
  const isSlow = (item) => UP_STATUSES.includes(item.status) && item.responseTime != null && item.responseTime > threshold;
  const span = (start, end) => {
    const from = sorted[start].timestamp;
    const to = sorted[end].timestamp;
    const minutes = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 60000) + 1);
    return { check, from, to, minutes };
  };
  if (!isSlow(check)) {
    const previous = index > 0 ? sorted[index - 1] : null;
    const followedSoon = previous && Date.parse(check.timestamp) - Date.parse(previous.timestamp) < 5 * 60 * 1000;
    if (!previous || !isSlow(previous) || !followedSoon) return { check, from: null, to: null, minutes: null };
    let start = index - 1;
    while (start > 0 && isSlow(sorted[start - 1])) start -= 1;
    return span(start, index - 1);
  }
  let start = index;
  let end = index;
  while (start > 0 && isSlow(sorted[start - 1])) start -= 1;
  while (end < sorted.length - 1 && isSlow(sorted[end + 1])) end += 1;
  return span(start, end);
};

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

const versionText = (value) => {
  const text = value == null ? '' : String(value).trim();
  return text || null;
};

// Runtime versions the integration actually reported. Missing values stay blank.
export function runtimeRows(site) {
  const security = site?.security || {};
  const platform = site?.platform;
  if (platform === 'wordpress') {
    return [
      ['WordPress', versionText(security.wordpressVersion)],
      ['PHP', versionText(security.phpVersion)],
      ['Plugin', versionText(security.pluginVersion)],
    ];
  }
  if (platform === 'nextjs') {
    return [
      ['Next.js', versionText(security.nextVersion)],
      ['Node', versionText(security.nodeVersion)],
    ];
  }
  if (platform === 'laravel' || platform === 'codeigniter' || platform === 'php') {
    const rows = [];
    if (platform !== 'php') rows.push([platformLabel(platform), versionText(security.frameworkVersion)]);
    rows.push(['PHP', versionText(security.phpVersion)]);
    return rows;
  }
  return [['Version', versionText(security.frameworkVersion || security.wordpressVersion)]];
}
