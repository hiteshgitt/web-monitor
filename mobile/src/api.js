const API_BASE = 'https://webmonitor.ruyalab.com/api';

async function request(path, { method = 'GET', body, token, timeoutMs = 15000, accept = 'application/json' } = {}) {
  const headers = { Accept: accept };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    const failure = new Error('Could not reach Web Monitor. Check your connection and try again.');
    failure.cause = error;
    throw failure;
  } finally {
    clearTimeout(timer);
  }
  return response;
}

export async function api(path, options = {}) {
  const response = await request(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = new Error(data.error || data.message || `Request failed (${response.status})`);
    failure.status = response.status;
    throw failure;
  }
  return data;
}

// Raw text (CSV export). Do not force JSON — the Pro export endpoint returns text/csv.
export async function apiText(path, options = {}) {
  const response = await request(path, { ...options, accept: 'text/csv, application/json' });
  const text = await response.text();
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      message = JSON.parse(text).error || message;
    } catch {
      // keep status message
    }
    const failure = new Error(message);
    failure.status = response.status;
    throw failure;
  }
  return text;
}

export { API_BASE };
