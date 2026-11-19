import React, { useCallback, useEffect, useState } from 'react';
import { Bug, CheckCircle2, RotateCcw, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { apiFetch } from '../../services/session';
import { timeAgo } from '../../utils/siteMetrics';

// Error tracking (Pro): fatal errors and uncaught exceptions reported by the site's integration, grouped with the
// file and line they come from, where they happened, how often, and the top of the stack trace.
const SETUP = {
  nextjs: "Add instrumentation.ts in your project root with: export { register, onRequestError } from '@ruyalab/webmonitor-nextjs/instrumentation';",
  php: "Add require_once __DIR__ . '/api/webmonitor-track.php'; as the first line of index.php (or use auto_prepend_file).",
  wordpress: 'Update the Web Monitor plugin to 1.4.0 or later: it records errors on its own.',
  laravel: 'Update ruyalab/webmonitor-laravel to 1.3.0 or later: it records reported exceptions on its own.',
  codeigniter: 'Update ruyalab/webmonitor-codeigniter to 1.3.0 or later: it records errors on its own.',
};

const ErrorGroup = ({ g, onToggle, busy }) => {
  const [open, setOpen] = useState(false);
  const resolved = g.status === 'resolved';
  return (
    <div className={`rounded-2xl border ${resolved ? 'border-brand-100 opacity-70' : 'border-rose-100'} bg-white`}>
      <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3">
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            {open ? <ChevronDown size={14} className="text-ink-muted" /> : <ChevronRight size={14} className="text-ink-muted" />}
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${resolved ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>{resolved ? 'Resolved' : g.type}</span>
            {resolved && <span className="text-[11px] font-bold text-ink-muted">{g.type}</span>}
            <span className="text-[11px] text-ink-muted">{g.count.toLocaleString()} × · last {timeAgo(g.lastSeen)} · first {timeAgo(g.firstSeen)}</span>
          </div>
          <div className="mt-1.5 font-bold text-ink break-words">{g.message || '(no message)'}</div>
          <div className="mt-1 text-[12px] font-mono text-brand-700 break-all">
            {g.file ? `${g.file}${g.line ? `:${g.line}` : ''}` : 'file not reported'}{g.location ? <span className="text-ink-muted font-sans"> · {g.location}</span> : null}
            {g.digest ? <span className="text-ink-muted font-sans"> · digest {g.digest}</span> : null}
          </div>
        </button>
        <button type="button" disabled={busy} onClick={() => onToggle(g)} className="h-9 px-3 rounded-xl border border-brand-200 text-[12px] font-bold text-ink flex items-center gap-1.5">
          {resolved ? <><RotateCcw size={13} /> Reopen</> : <><CheckCircle2 size={13} /> Resolve</>}
        </button>
      </div>
      {open && (
        <div className="px-5 pb-4">
          {g.stack.length ? (
            <pre className="rounded-xl bg-slate-900 text-slate-100 text-[12px] leading-relaxed p-4 overflow-x-auto">{g.stack.map((f, i) => `#${i} ${f}`).join('\n')}</pre>
          ) : <p className="text-[12px] text-ink-muted">No stack trace was reported for this error.</p>}
          <p className="mt-2 text-[11px] text-ink-muted">Resolving hides it from the open list. If it happens again you get a notification and it reopens.</p>
        </div>
      )}
    </div>
  );
};

const ErrorsPanel = ({ siteId, platform }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchErrors = useCallback(() => apiFetch(`${API_BASE_URL}/advanced/errors/${siteId}`)
    .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error || 'Could not load errors.')))), [siteId]);
  const apply = (p) => p.then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)).finally(() => setBusy(false));
  useEffect(() => {
    let cancelled = false;
    fetchErrors().then((d) => { if (!cancelled) { setData(d); setError(''); } }).catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [fetchErrors]);
  const load = () => { setBusy(true); apply(fetchErrors()); };

  const toggle = async (g) => {
    setBusy(true);
    try {
      const r = await apiFetch(`${API_BASE_URL}/advanced/errors-resolve/${siteId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fp: g.fp, reopen: g.status === 'resolved' }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not update.');
      setData((prev) => ({ ...prev, groups: d.groups }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const groups = data?.groups || [];
  const open = groups.filter((g) => g.status === 'open');
  const s = data?.summary;
  return (
    <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
      <div className="px-8 py-6 border-b border-brand-100 flex flex-wrap items-center justify-between gap-3 bg-linear-to-r from-gray-50 to-white">
        <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${open.length ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}><Bug size={20} /></div>
          Errors
        </h3>
        <div className="flex items-center gap-3 text-[12px] text-ink-muted">
          {s && <span>{s.last_5m ?? 0} in 5 min · {s.last_hour ?? 0} in the last hour</span>}
          <button type="button" onClick={load} disabled={busy} className="h-9 px-3 rounded-xl border border-brand-200 font-bold text-ink flex items-center gap-1.5"><RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Refresh</button>
        </div>
      </div>
      <div className="p-8 space-y-3">
        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
        {data?.note && <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-3">{data.note}</p>}
        {!data && !error && <p className="text-sm text-ink-muted">Reading errors from the site…</p>}
        {data && groups.length === 0 && (
          <div className="text-sm text-ink-soft">
            <p className="font-semibold text-ink">No errors recorded.</p>
            {data.tracked === false || data.note ? <p className="mt-1">To turn error tracking on: {SETUP[platform] || 'update the integration to the latest version.'}</p>
              : <p className="mt-1">Fatal errors and uncaught exceptions will appear here with the file, line and stack trace, and you get a notification for each new one.</p>}
          </div>
        )}
        {groups.map((g) => <ErrorGroup key={g.fp} g={g} onToggle={toggle} busy={busy} />)}
        {groups.length > 0 && <p className="text-[11px] text-ink-muted">Messages are cleaned on the site before they are sent: emails, tokens and passwords are replaced. Error spikes are alerted on every plan; new errors and stack traces are part of Pro.</p>}
      </div>
    </div>
  );
};

export default ErrorsPanel;
