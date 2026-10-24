// Sign-in token storage and an authenticated fetch for all API calls.
// Kept in localStorage so the session survives reloads (and works the same inside the mobile app).

const TOKEN_KEY = 'webmonitor_token';
export const SESSION_EXPIRED_EVENT = 'webmonitor-session-expired';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked (private mode): the session lasts until the tab closes
  }
};

// fetch() with the bearer token; a 401 (or a suspended account) clears the session and tells the app to show sign-in
export const apiFetch = async (url, options = {}) => {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...options, headers });
  const suspended = response.status === 403 && token
    && (await response.clone().json().catch(() => ({}))).code === 'ACCOUNT_SUSPENDED';
  if ((response.status === 401 || suspended) && token) {
    setToken(null);
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
  return response;
};
