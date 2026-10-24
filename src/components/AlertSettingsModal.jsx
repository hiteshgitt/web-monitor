import React, { useEffect, useState } from 'react';
import { X, BellRing, Smartphone, Monitor, Trash2 } from 'lucide-react';
import {
  browserPushSupported, currentBrowserSubscription, disableBrowserPush, enableBrowserPush,
  fetchAlertSettings, removePushDevice, saveAlertSettings,
} from '../services/alerts';
import { timeAgo } from '../utils/siteMetrics';

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

// Which alerts are pushed to the customer's phone and browsers. Every alert stays in the bell history.
// Mounted only while open, so each opening loads fresh settings.
const AlertSettingsModal = ({ onClose }) => {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [browserOn, setBrowserOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAlertSettings().then(setSettings).catch((err) => setError(err.message));
    currentBrowserSubscription().then((sub) => setBrowserOn(Boolean(sub))).catch(() => {});
  }, []);

  const setPref = async (key, value) => {
    const previous = settings.prefs;
    setSettings((s) => ({ ...s, prefs: { ...s.prefs, [key]: value } }));
    try {
      const { prefs } = await saveAlertSettings({ [key]: value });
      setSettings((s) => ({ ...s, prefs }));
    } catch (err) {
      setSettings((s) => ({ ...s, prefs: previous }));
      setError(err.message);
    }
  };

  const toggleBrowser = async () => {
    setBusy(true);
    setError('');
    try {
      if (browserOn) await disableBrowserPush();
      else await enableBrowserPush(settings.webPushPublicKey);
      setBrowserOn(!browserOn);
      setSettings({ ...settings, ...(await fetchAlertSettings()) });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeDevice = async (device) => {
    try {
      await removePushDevice(device._id);
      setSettings((s) => ({ ...s, devices: s.devices.filter((d) => d._id !== device._id) }));
    } catch (err) {
      setError(err.message);
    }
  };

  const prefs = settings?.prefs;
  const canUseBrowser = browserPushSupported() && settings?.webPushPublicKey;

  return (
    <div className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in" onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-frame overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-brand-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center"><BellRing size={18} /></span>
            <div>
              <h2 className="text-lg font-bold text-ink leading-tight">Alert settings</h2>
              <p className="text-[12px] text-ink-muted">Choose what reaches your phone and browser</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {error && <div className="text-sm font-semibold text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</div>}
          {!settings && !error && <p className="text-sm text-ink-muted">Loading…</p>}

          {settings && (
            <>
              <section className="rounded-2xl bg-canvas p-4 flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-white text-brand-600 flex items-center justify-center shrink-0"><Monitor size={18} /></span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-ink text-sm">Notifications in this browser</div>
                  <div className="text-[12px] text-ink-muted">
                    {!browserPushSupported() ? 'This browser can’t show notifications.'
                      : !settings.webPushPublicKey ? 'Browser notifications are not available yet.'
                        : browserOn ? 'On, even when the dashboard is closed.' : 'Off. Turn on to get alerts while the dashboard is closed.'}
                  </div>
                </div>
                <Switch checked={browserOn} onChange={toggleBrowser} disabled={!canUseBrowser || busy} label="Notifications in this browser" />
              </section>

              <section>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-ink">Push notifications</div>
                    <div className="text-[12px] text-ink-muted">Master switch for all your devices</div>
                  </div>
                  <Switch checked={prefs.push} onChange={(v) => setPref('push', v)} label="Push notifications" />
                </div>
                <ul className={`mt-4 divide-y divide-brand-100 rounded-2xl border border-brand-100 ${prefs.push ? '' : 'opacity-50'}`}>
                  {settings.types.map((type) => (
                    <li key={type.key} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink">{type.label}</div>
                        <div className="text-[12px] text-ink-muted">{type.description}</div>
                      </div>
                      <Switch checked={prefs[type.key]} onChange={(v) => setPref(type.key, v)} disabled={!prefs.push} label={type.label} />
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px] text-ink-muted">Every alert is still listed under the bell, whatever you switch off here.</p>
              </section>

              <section>
                <div className="font-bold text-ink">Your devices</div>
                {settings.devices.length === 0 ? (
                  <p className="mt-1 text-[13px] text-ink-muted">No devices yet. Sign in to the Web Monitor phone app, or turn on notifications in this browser.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {settings.devices.map((device) => (
                      <li key={device._id} className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-2.5">
                        {device.kind === 'expo' ? <Smartphone size={16} className="text-brand-600" /> : <Monitor size={16} className="text-brand-600" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-ink truncate">{device.label || (device.kind === 'expo' ? 'Phone app' : 'Browser')}</div>
                          <div className="text-[11px] text-ink-muted">Added {timeAgo(device.createdAt)}</div>
                        </div>
                        <button type="button" onClick={() => removeDevice(device)} className="btn-ghost hover:text-bad!" aria-label="Remove device" title="Stop sending alerts to this device">
                          <Trash2 size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertSettingsModal;
