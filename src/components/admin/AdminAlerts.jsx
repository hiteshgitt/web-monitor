import React, { useCallback, useEffect, useState } from 'react';
import { X, Bell, Sparkles, UserPlus, Monitor } from 'lucide-react';
import { adminFetch } from '../../services/adminSession';
import {
  alertsApi, browserPushSupported, currentBrowserSubscription, disableBrowserPush, enableBrowserPush,
} from '../../services/alerts';
import { timeAgo } from '../../utils/siteMetrics';

const api = alertsApi(adminFetch, '/admin/notifications');
const REFRESH_MS = 60000;

const Switch = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative w-11 h-6 rounded-full shrink-0 transition-colors disabled:opacity-40 ${checked ? 'bg-brand-600' : 'bg-ink-faint'}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
  </button>
);

// The admin's own alerts (new sign-ups, Pro requests): list, browser push and which types to push
const AdminAlerts = ({ open, onClose, onUnread }) => {
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [browserOn, setBrowserOn] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => api.fetchNotifications()
    .then((data) => { setItems(data.notifications); onUnread(data.unread); })
    .catch(() => {}), [onUnread]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!open) return undefined;
    api.fetchAlertSettings().then(setSettings).catch((err) => setError(err.message));
    currentBrowserSubscription().then((sub) => setBrowserOn(Boolean(sub))).catch(() => {});
    // Read once the panel closes
    return () => { api.markNotificationsRead().then(refresh).catch(() => {}); };
  }, [open, refresh]);

  if (!open) return null;

  const setPref = async (key, value) => {
    setSettings((s) => ({ ...s, prefs: { ...s.prefs, [key]: value } }));
    try {
      const { prefs } = await api.saveAlertSettings({ [key]: value });
      setSettings((s) => ({ ...s, prefs }));
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleBrowser = async () => {
    setBusy(true);
    setError('');
    try {
      if (browserOn) await disableBrowserPush({ api });
      else await enableBrowserPush(settings.webPushPublicKey, api);
      setBrowserOn(!browserOn);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-[2px] animate-fade-in" onClick={onClose}>
      <aside className="w-full sm:max-w-sm h-full bg-white shadow-frame flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-100">
          <h2 className="font-bold text-ink flex items-center gap-2"><Bell size={18} className="text-brand-600" /> Admin alerts</h2>
          <button type="button" onClick={onClose} className="btn-ghost" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {error && <div className="text-sm font-semibold text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</div>}

          {settings && (
            <section className="rounded-2xl bg-canvas p-3 space-y-3">
              <div className="flex items-center gap-3">
                <Monitor size={16} className="text-brand-600 shrink-0" />
                <div className="flex-1 min-w-0 text-[13px]">
                  <div className="font-bold text-ink">Notifications in this browser</div>
                  <div className="text-ink-muted">{!browserPushSupported() || !settings.webPushPublicKey ? 'Not available here.' : browserOn ? 'On' : 'Off'}</div>
                </div>
                <Switch checked={browserOn} onChange={toggleBrowser} disabled={busy || !browserPushSupported() || !settings.webPushPublicKey} label="Notifications in this browser" />
              </div>
              {settings.types.map((type) => (
                <div key={type.key} className="flex items-center gap-3 text-[13px]">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink">{type.label}</div>
                    <div className="text-ink-muted">{type.description}</div>
                  </div>
                  <Switch checked={settings.prefs[type.key]} onChange={(v) => setPref(type.key, v)} label={type.label} />
                </div>
              ))}
            </section>
          )}

          {items.length === 0 ? (
            <p className="text-center text-sm text-ink-muted py-8">No sign-ups or Pro requests yet.</p>
          ) : (
            <ul className="space-y-1">
              {items.map((n) => {
                const Icon = n.type === 'signup' ? UserPlus : Sparkles;
                return (
                  <li key={n._id} className={`flex items-start gap-3 p-3 rounded-2xl ${n.read ? '' : 'bg-brand-50/70'}`}>
                    <span className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><Icon size={15} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-bold text-ink truncate">{n.title}</span>
                        <span className="text-[11px] text-ink-muted shrink-0">{timeAgo(n.createdAt)}</span>
                      </span>
                      <span className="block text-[13px] text-ink-muted">{n.body}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
};

export default AdminAlerts;
