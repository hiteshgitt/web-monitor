import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config/api';
import { apiFetch, getToken, setToken, SESSION_EXPIRED_EVENT } from '../services/session';

const AuthContext = createContext(null);

const postJson = async (path, body) => {
  const response = await apiFetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // 'loading' until the stored token has been checked against the API
  const [status, setStatus] = useState(() => (getToken() ? 'loading' : 'signed-out'));

  useEffect(() => {
    if (!getToken()) return undefined;
    let cancelled = false;
    apiFetch(`${API_BASE_URL}/auth/me`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('signed out'))))
      .then((data) => { if (!cancelled) { setUser(data.user); setStatus('signed-in'); } })
      .catch(() => { if (!cancelled) { setUser(null); setStatus('signed-out'); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const expire = () => { setUser(null); setStatus('signed-out'); };
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, []);

  const startSession = useCallback(({ token, user: signedInUser }) => {
    setToken(token);
    setUser(signedInUser);
    setStatus('signed-in');
    return signedInUser;
  }, []);

  const value = useMemo(() => ({
    user,
    status,
    isPro: Boolean(user?.isPro),
    isAdmin: user?.role === 'admin',
    login: (email, password) => postJson('/auth/login', { email, password }).then(startSession),
    register: (name, email, password) => postJson('/auth/register', { name, email, password }).then(startSession),
    loginWithGoogle: (credential) => postJson('/auth/google', { credential }).then(startSession),
    requestUpgrade: () => postJson('/auth/upgrade-request').then((data) => setUser(data.user)),
    logout: () => { setToken(null); setUser(null); setStatus('signed-out'); },
  }), [user, status, startSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
