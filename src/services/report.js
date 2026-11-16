import { API_BASE_URL } from '../config/api';
import { apiFetch } from './session';

export async function fetchSiteReport(siteId, days) {
  const response = await apiFetch(`${API_BASE_URL}/advanced/report/${siteId}?days=${days}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The report could not be loaded.');
  return data;
}
