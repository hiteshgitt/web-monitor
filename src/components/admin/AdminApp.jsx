import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { API_BASE_URL } from '../../config/api';
import { ADMIN_SESSION_EXPIRED_EVENT, adminFetch, getAdminToken, setAdminToken } from '../../services/adminSession';
import AdminSignIn from './AdminSignIn';
import AdminPage from './AdminPage';

const Loader = () => (
  <div className="min-h-screen bg-canvas flex items-center justify-center">
    <div className="w-12 h-12 rounded-full border-4 border-brand-100 border-t-brand-600 animate-spin" />
  </div>
);

// /ruyashield: super admin area with its own accounts and sessions (not linked from the website)
const AdminApp = () => {
  const location = useLocation();
  const setupToken = location.pathname.startsWith('/ruyashield/setup') ? new URLSearchParams(location.search).get('token') : null;
  const [admin, setAdmin] = useState(null);
  const [status, setStatus] = useState(() => (getAdminToken() && !setupToken ? 'loading' : 'signed-out'));

  useEffect(() => {
    if (status !== 'loading') return undefined;
    let cancelled = false;
    adminFetch(`${API_BASE_URL}/admin-auth/me`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('signed out'))))
      .then((data) => { if (!cancelled) { setAdmin(data.admin); setStatus('signed-in'); } })
      .catch(() => { if (!cancelled) setStatus('signed-out'); });
    return () => { cancelled = true; };
  }, [status]);

  useEffect(() => {
    const expire = () => { setAdmin(null); setStatus('signed-out'); };
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, expire);
  }, []);

  const signedIn = useCallback(({ token, admin: who }) => {
    setAdminToken(token);
    setAdmin(who);
    setStatus('signed-in');
  }, []);

  const signOut = useCallback(() => {
    setAdminToken(null);
    setAdmin(null);
    setStatus('signed-out');
  }, []);

  if (status === 'loading') return <Loader />;
  if (status !== 'signed-in') return <AdminSignIn setupToken={setupToken} onSignedIn={signedIn} />;
  return <AdminPage admin={admin} onSignOut={signOut} />;
};

export default AdminApp;
