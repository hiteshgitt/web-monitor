// Super admin session (/ruyashield), stored apart from the customer session so neither can stand in for the other.
import { API_BASE_URL } from '../config/api';

const ADMIN_TOKEN_KEY = 'webmonitor_admin_token';
export const ADMIN_SESSION_EXPIRED_EVENT = 'webmonitor-admin-session-expired';

export const getAdminToken = () => {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAdminToken = (token) => {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // Storage blocked: the admin session lasts until the tab closes
  }
};

// fetch() with the admin token; an expired session (8 hours) returns the admin to the sign-in step
export const adminFetch = async (url, options = {}) => {
  const token = getAdminToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && token) {
    setAdminToken(null);
    window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EXPIRED_EVENT));
  }
  return response;
};

// JSON call to the admin API (/api/admin...)
export const adminRequest = async (path, options = {}) => {
  const response = await adminFetch(`${API_BASE_URL}/admin${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
};
