import { useCallback, useEffect, useState } from 'react';
import { fetchNotifications, markNotificationsRead } from '../services/alerts';

const REFRESH_MS = 60000; // the monitor runs once a minute

// The signed-in customer's alert history from the server (site down/up, plugin updates, plan changes...)
const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => fetchNotifications()
    .then((data) => { setNotifications(data.notifications); setUnread(data.unread); })
    .catch(() => {}), []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  const markAllRead = useCallback(() => {
    if (unread === 0) return;
    setUnread(0);
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
    markNotificationsRead().catch(() => {});
  }, [unread]);

  return { notifications, unread, refresh, markAllRead };
};

export default useNotifications;
