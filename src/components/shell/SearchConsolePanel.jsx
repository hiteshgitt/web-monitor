import React, { useEffect, useState } from 'react';
import { Search, Unlink } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { apiFetch } from '../../services/session';

const readHandoff = (siteId) => {
  try {
    if (sessionStorage.getItem('sc-site') !== siteId) return { pendingId: '', error: '' };
    return {
      pendingId: sessionStorage.getItem('sc-pending') || '',
      error: sessionStorage.getItem('sc-error') || '',
    };
  } catch {
    return { pendingId: '', error: '' };
  }
};

const clearHandoff = () => {
  try {
    sessionStorage.removeItem('sc-pending');
    sessionStorage.removeItem('sc-error');
    sessionStorage.removeItem('sc-site');
  } catch {
    // Private mode can block storage; the URL was already cleaned.
  }
};

const formatCount = (value) => (value == null ? '—' : Number(value).toLocaleString());
const formatCtr = (value) => (value == null ? '—' : `${(Number(value) * 100).toFixed(1)}%`);
const formatPosition = (value) => (value == null ? '—' : Number(value).toFixed(1));

// Connects one site to a Search Console property the signed-in person can already open.
const SearchConsolePanel = ({ siteId, report, onConnected }) => {
  const handoff = readHandoff(siteId);
  const [pendingId, setPendingId] = useState(handoff.pendingId);
  const [sites, setSites] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(handoff.error);
  const data = report?.searchConsole;
  const connected = Boolean(data?.siteUrl);

  useEffect(() => {
    if (!pendingId) return undefined;
    let cancelled = false;
    setBusy(true);
    apiFetch(`${API_BASE_URL}/websites/${siteId}/search-console/google/sites?pending=${encodeURIComponent(pendingId)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Search Console sites could not be loaded.');
        if (!cancelled) setSites(body.sites || []);
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
      const response = await apiFetch(`${API_BASE_URL}/websites/${siteId}/search-console/google/connect`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Search Console could not be opened.');
      window.location.assign(body.url);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const choose = async (siteUrl) => {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${API_BASE_URL}/websites/${siteId}/search-console/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingId, siteUrl }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'That property could not be connected.');
      clearHandoff();
      setPendingId('');
      setSites([]);
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
      const response = await apiFetch(`${API_BASE_URL}/websites/${siteId}/search-console/google`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Search Console could not be disconnected.');
      onConnected?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-brand-100 flex items-center justify-between gap-4 bg-linear-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <Search size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest">Search Console</h3>
            <p className="text-xs text-ink-muted mt-0.5 truncate">
              {connected ? `${data.siteUrl} · ${data.range || 'Last 28 days'}` : 'Uses the Google account that can open this property'}
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
        {error && <p className="text-sm text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</p>}
        {report?.searchConsoleError && !pendingId && (
          <p className="text-sm text-ink-muted">{report.searchConsoleError}</p>
        )}
        {pendingId && (
          <div className="space-y-2">
            <p className="text-sm text-ink">Choose the Search Console property for this site.</p>
            {busy && sites.length === 0 && <p className="text-sm text-ink-muted">Loading properties…</p>}
            {!busy && sites.length === 0 && <p className="text-sm text-ink-muted">This Google account has no Search Console properties.</p>}
            {sites.map((site) => (
              <button
                key={site.id}
                type="button"
                disabled={busy}
                onClick={() => choose(site.id)}
                className="w-full text-left rounded-xl border border-brand-100 px-4 py-3 hover:bg-brand-50 transition-colors"
              >
                <div className="text-sm font-bold text-ink">{site.name}</div>
                <div className="text-xs text-ink-muted">{site.permission}</div>
              </button>
            ))}
          </div>
        )}
        {connected && data.totalClicks == null && data.totalImpressions == null && (
          <p className="text-sm text-ink-muted">Search Console returned no clicks for this period.</p>
        )}
        {connected && (data.totalClicks != null || data.totalImpressions != null) && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                ['Clicks', formatCount(data.totalClicks)],
                ['Impressions', formatCount(data.totalImpressions)],
                ['CTR', formatCtr(data.averageCTR)],
                ['Position', formatPosition(data.averagePosition)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-brand-50/60 border border-brand-100 px-4 py-3">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">{label}</div>
                  <div className="text-lg font-extrabold text-ink mt-1">{value}</div>
                </div>
              ))}
            </div>
            {data.topQueries?.length > 0 && (
              <div className="divide-y divide-brand-100">
                {data.topQueries.map((item) => (
                  <div key={item.query} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink font-medium truncate">{item.query}</span>
                    <span className="text-ink-muted shrink-0">{formatCount(item.clicks)} clicks</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SearchConsolePanel;
