import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, ExternalLink, Unplug } from 'lucide-react';
import { connectRuyaShield, disconnectRuyaShield, fetchRuyaShieldStatus } from '../../services/ruyashield';

// Account-level RuyaShield connection: paste a read-only API token, or disconnect.
// Mounted only while open, so each opening loads the current status.
const RuyaShieldModal = ({ onClose, onChanged }) => {
  const [status, setStatus] = useState(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchRuyaShieldStatus().then(setStatus).catch((err) => setError(err.message));
  }, []);

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      const next = await action();
      setStatus(next);
      setToken('');
      onChanged?.(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const tokensUrl = status?.appUrl ? `${status.appUrl}/settings/webmonitor` : null;

  return (
    <div className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in" onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-frame overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-brand-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center"><ShieldCheck size={18} /></span>
            <div>
              <h2 className="text-lg font-bold text-ink leading-tight">RuyaShield</h2>
              <p className="text-[12px] text-ink-muted">See security findings next to uptime</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <div className="text-sm font-semibold text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</div>}
          {!status && !error && <p className="text-sm text-ink-muted">Loading…</p>}

          {status && !status.configured && (
            <p className="text-sm text-ink-muted">The RuyaShield connection is not available yet.</p>
          )}

          {status?.configured && status.connected && (
            <section className="rounded-2xl bg-canvas p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-ink text-sm truncate">Connected to {status.orgName}</div>
                  <div className="text-[12px] text-ink-muted">
                    Token {status.tokenPrefix}… · since {new Date(status.connectedAt).toLocaleDateString()}
                  </div>
                </div>
                <button type="button" disabled={busy} onClick={() => run(disconnectRuyaShield)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-ink-soft hover:bg-bad-soft hover:text-bad disabled:opacity-50">
                  <Unplug size={15} /> Disconnect
                </button>
              </div>
              {status.error && <p className="text-[12px] font-semibold text-bad">{status.error}</p>}
              <p className="text-[12px] text-ink-muted">Open a site’s Security tab to see its RuyaShield findings. Paste a new token below to replace this one.</p>
            </section>
          )}

          {status?.configured && (
            <section className="space-y-3">
              {!status.connected && (
                <ol className="text-[13px] text-ink-soft space-y-1.5 list-decimal pl-5">
                  <li>
                    Sign in to RuyaShield and open <span className="font-semibold text-ink">Settings → WebMonitor</span>
                    {tokensUrl && (
                      <a href={tokensUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 ml-1 text-brand-700 font-semibold hover:underline">
                        open <ExternalLink size={12} />
                      </a>
                    )}.
                  </li>
                  <li>Click <span className="font-semibold text-ink">Create token for WebMonitor</span> and copy it. It has only the <code className="text-[12px] bg-canvas px-1 rounded">assets:read</code> and <code className="text-[12px] bg-canvas px-1 rounded">findings:read</code> scopes.</li>
                  <li>Paste it here. It is stored encrypted and can only read. It cannot start scans or change anything.</li>
                </ol>
              )}
              <form
                className="flex flex-col sm:flex-row gap-2"
                onSubmit={(e) => { e.preventDefault(); if (token.trim()) run(() => connectRuyaShield(token)); }}
              >
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="rs_…"
                  aria-label="RuyaShield API token"
                  className="flex-1 min-w-0 rounded-xl border border-brand-100 px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
                <button type="submit" disabled={busy || !token.trim()} className="px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-50">
                  {busy ? 'Checking…' : status.connected ? 'Replace token' : 'Connect'}
                </button>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default RuyaShieldModal;
