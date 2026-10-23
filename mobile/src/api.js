const API_BASE = 'https://webmonitor.ruyalab.com/api';

export async function api(path, { method = 'GET', body, token, timeoutMs = 15000 } = {}) {
  const headers = { Accept: 'application/json' };
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

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = new Error(data.error || data.message || `Request failed (${response.status})`);
    failure.status = response.status;
    throw failure;
  }
  return data;
}
