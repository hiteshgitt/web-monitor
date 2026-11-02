import React, { useEffect, useState } from 'react';
import { BarChart3, CheckCircle, Unlink } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { apiFetch } from '../../services/session';

const readHandoff = (siteId) => {
  try {
    if (sessionStorage.getItem('ga-site') !== siteId) return { pendingId: '', error: '' };
    return {
      pendingId: sessionStorage.getItem('ga-pending') || '',
      error: sessionStorage.getItem('ga-error') || '',
    };
  } catch {
    return { pendingId: '', error: '' };
  }
};

const clearHandoff = () => {
  try {
    sessionStorage.removeItem('ga-pending');
    sessionStorage.removeItem('ga-error');
    sessionStorage.removeItem('ga-site');
  } catch {
    // Private mode can block storage; the URL was already cleaned.
  }
};

const formatCount = (value) => (value == null ? '—' : Number(value).toLocaleString());

const formatDuration = (seconds) => {
  if (seconds == null) return '—';
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
};

// Connects one site to a Google Analytics 4 property the signed-in person can already open.
const GoogleAnalyticsPanel = ({ siteId, report, onConnected }) => {
  const handoff = readHandoff(siteId);
  const [pendingId, setPendingId] = useState(handoff.pendingId);
  const [properties, setProperties] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(handoff.error);
  const connected = Boolean(report?.googleAnalytics?.propertyId);

  useEffect(() => {
    if (!pendingId) return undefined;
    let cancelled = false;
    setBusy(true);
    apiFetch(`${API_BASE_URL}/websites/${siteId}/analytics/google/properties?pending=${encodeURIComponent(pendingId)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Google Analytics properties could not be loaded.');
        if (!cancelled) setProperties(data.properties || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setPendingId('');
          clearHandoff();
        }
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [pendingId, siteId]);

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${API_BASE_URL}/websites/${siteId}/analytics/google/connect`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Google Analytics could not be opened.');
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const choose = async (propertyId) => {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${API_BASE_URL}/websites/${siteId}/analytics/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingId, propertyId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'That property could not be connected.');
      clearHandoff();
      setPendingId('');
      setProperties([]);
      onConnected?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${API_BASE_URL}/websites/${siteId}/analytics/google`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Google Analytics could not be disconnected.');
      onConnected?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const ga = report?.googleAnalytics;

  return (
    <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-brand-100 flex items-center justify-between gap-4 bg-linear-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
            <BarChart3 size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest">Google Analytics</h3>
            <p className="text-xs text-ink-muted mt-0.5 truncate">
              {connected ? `${ga.propertyName || ga.propertyId} · ${ga.range || 'Last 28 days'}` : 'Uses the Google account that can open this property'}
            </p>
          </div>
        </div>
        {connected ? (
          <button type="button" onClick={disconnect} disabled={busy} className="btn-ghost h-9! px-3! text-ink-muted shrink-0">
            <Unlink size={14} /> Disconnect
          </button>
        ) : (
          <button type="button" onClick={connect} disabled={busy || Boolean(pendingId)} className="btn-primary h-9! px-4! shrink-0">
            Connect
          </button>
        )}
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <p className="text-sm text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</p>
        )}
        {report?.error && !pendingId && (
          <p className="text-sm text-ink-muted">{report.error}</p>
        )}
        {pendingId && (
          <div className="space-y-2">
            <p className="text-sm text-ink">Choose the Analytics property for this site.</p>
            {busy && properties.length === 0 && <p className="text-sm text-ink-muted">Loading properties…</p>}
            {!busy && properties.length === 0 && <p className="text-sm text-ink-muted">This Google account has no Analytics properties.</p>}
            {properties.map((property) => (
              <button
                key={property.id}
                type="button"
                disabled={busy}
                onClick={() => choose(property.id)}
                className="w-full text-left rounded-xl border border-brand-100 px-4 py-3 hover:bg-brand-50 transition-colors"
              >
                <div className="text-sm font-bold text-ink">{property.name}</div>
                <div className="text-xs text-ink-muted">{property.account}</div>
              </button>
            ))}
          </div>
        )}
        {connected && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Sessions', formatCount(ga.sessions)],
              ['Users', formatCount(ga.totalUsers)],
              ['Page views', formatCount(ga.pageViews)],
              ['Bounce rate', ga.bounceRate != null ? `${ga.bounceRate}%` : '—'],
              ['Avg session', formatDuration(ga.avgSessionDuration)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-brand-50/60 border border-brand-100 px-4 py-3">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">{label}</div>
                <div className="text-lg font-extrabold text-ink mt-1 flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-brand-600" /> {value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleAnalyticsPanel;
