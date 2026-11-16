import { API_BASE_URL } from '../config/api';
import { apiFetch } from './session';

async function call(path, options = {}) {
  const response = await apiFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'RuyaShield request failed.');
  return data;
}

export const fetchRuyaShieldStatus = () => call('/integrations/ruyashield');
export const connectRuyaShield = (token) => call('/integrations/ruyashield', { method: 'PUT', body: JSON.stringify({ token }) });
export const disconnectRuyaShield = () => call('/integrations/ruyashield', { method: 'DELETE' });
export const fetchRuyaShieldForSite = (siteId, refresh = false) => call(`/advanced/ruyashield/${siteId}${refresh ? '?refresh=1' : ''}`);
