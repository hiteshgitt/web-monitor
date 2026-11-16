import { API_BASE_URL } from '../config/api';
import { apiFetch } from './session';

export async function fetchSiteReport(siteId, days) {
  const response = await apiFetch(`${API_BASE_URL}/websites/${siteId}/report?days=${days}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The report could not be loaded.');
  return data;
}

async function call(path, options = {}) {
  const response = await apiFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request failed.');
  return data;
}

export const listReportShares = (siteId) => call(`/websites/${siteId}/report/shares`);
export const createReportShare = (siteId, body) => call(`/websites/${siteId}/report/shares`, { method: 'POST', body: JSON.stringify(body) });
export const revokeReportShare = (siteId, shareId) => call(`/websites/${siteId}/report/shares/${shareId}`, { method: 'DELETE' });

// A client opening a shared link: no session.
export async function fetchSharedReport(token) {
  const response = await fetch(`${API_BASE_URL}/shared-report/${encodeURIComponent(token)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'This report could not be loaded.');
  return data;
}

export const fetchReportEmail = (siteId) => call(`/websites/${siteId}/report/email`);
export const saveReportEmail = (siteId, body) => call(`/websites/${siteId}/report/email`, { method: 'PUT', body: JSON.stringify(body) });
export const sendReportEmailNow = (siteId) => call(`/websites/${siteId}/report/email/send`, { method: 'POST' });
