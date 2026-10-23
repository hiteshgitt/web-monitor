// Small shared helpers

export const nowIso = () => new Date().toISOString();

export const newId = () => crypto.randomUUID().replace(/-/g, '');

// UTC bucket keys used by check_hours / check_days
export const hourKey = (date) => date.toISOString().slice(0, 13); // 'YYYY-MM-DDTHH'
export const dayKey = (date) => date.toISOString().slice(0, 10);  // 'YYYY-MM-DD'

export const hoursAgo = (n, from = new Date()) => new Date(from.getTime() - n * 60 * 60 * 1000);
export const daysAgo = (n, from = new Date()) => new Date(from.getTime() - n * 24 * 60 * 60 * 1000);

export const parseJson = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const normalizeUrl = (url) => String(url || '').trim().replace(/\/+$/, '').toLowerCase();

export const UP_STATUSES = ['healthy', 'warning'];
export const DOWN_STATUSES = ['error', 'offline'];
export const VALID_STATUSES = ['healthy', 'warning', 'error', 'offline'];
export const PLATFORMS = ['wordpress', 'nextjs', 'laravel', 'codeigniter', 'php', 'other'];

// Errors that carry an HTTP status for the API error handler
export class ApiError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// SQL "IN (?, ?, ...)" placeholder list
export const placeholders = (count) => Array.from({ length: count }, () => '?').join(', ');
