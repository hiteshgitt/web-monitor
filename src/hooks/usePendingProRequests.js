import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/api';
import { apiFetch } from '../services/session';

const REFRESH_MS = 60000;

// Admins only: how many customers are waiting for Pro (badge on the Customers button)
const usePendingProRequests = (isAdmin) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    const load = () => apiFetch(`${API_BASE_URL}/admin/users`)
      .then((r) => (r.ok ? r.json() : []))
      .then((users) => {
        if (!cancelled) setCount(users.filter((u) => u.upgradeRequestedAt && u.plan !== 'pro' && u.role !== 'admin').length);
      })
      .catch(() => {});
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isAdmin]);

  return count;
};

export default usePendingProRequests;
