import React, { useEffect, useState } from 'react';
import { FileWarning, ShieldCheck, EyeOff, Eye } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { apiFetch } from '../../services/session';
import { timeAgo } from '../../utils/siteMetrics';
import { SeverityChip } from './VulnerabilitiesPanel';

// Suspicious-file scan (Pro): what the integration's read-only scanner found, with file, line and a snippet.
const SETUP = {
  wordpress: 'Update the Web Monitor plugin to 1.5.0 or later to turn the file scan on.',
  laravel: 'Update ruyalab/webmonitor-laravel to 1.4.0 or later to turn the file scan on.',
  codeigniter: 'Update ruyalab/webmonitor-codeigniter to 1.4.0 or later to turn the file scan on.',
  php: 'Download the Core PHP integration again (1.4.0 or later) to turn the file scan on.',
};

const SuspiciousFilesPanel = ({ siteId, platform }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`${API_BASE_URL}/advanced/filescan/${siteId}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error || 'Could not load the file scan.'))))
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [siteId]);

  const setIgnored = async (f, ignore) => {
    setBusy(true);
    try {
      const r = await apiFetch(`${API_BASE_URL}/advanced/filescan-ignore/${siteId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, ignore }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not update.');
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (data && !data.supported) return null; // Next.js and others: not covered by the file scan
  const findings = data?.findings || [];
  const open = findings.filter((f) => f.status === 'open');
  const st = data?.state;
  const progress = st?.unsupported ? null : st?.cycleComplete
    ? `Last full scan ${timeAgo(st.cycleCompleted)}: ${st.filesTotal ?? '?'} files`
    : st ? `Scanning: ${st.filesDone} files so far` : 'First scan starts within a few minutes';

  return (
    <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
      <div className="px-8 py-6 border-b border-brand-100 flex flex-wrap items-center justify-between gap-3 bg-linear-to-r from-gray-50 to-white">
        <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${open.length ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{open.length ? <FileWarning size={20} /> : <ShieldCheck size={20} />}</div>
          Suspicious files
        </h3>
        {progress && <span className="text-[12px] text-ink-muted">{progress}</span>}
      </div>
      <div className="p-8 space-y-3">
        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
        {!data && !error && <p className="text-sm text-ink-muted">Loading…</p>}
        {st?.unsupported && <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-3">{SETUP[platform] || 'Update the integration to turn the file scan on.'}</p>}
        {data && !st?.unsupported && findings.length === 0 && (
          <p className="text-sm text-ink-soft">{st?.cycleComplete ? 'Nothing suspicious: no code in uploads, no known backdoors or web shells, no injected code' : 'No findings yet'}{st?.coreIntegrity?.status === 'ok' ? ', and WordPress core matches the official release.' : '.'}</p>
        )}
        {findings.map((f) => (
          <div key={f.id} className={`rounded-2xl border px-5 py-4 ${f.status === 'open' ? 'border-rose-200 bg-rose-50/40' : 'border-brand-100 opacity-70'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {f.status === 'open' ? <SeverityChip severity={f.severity} /> : <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-brand-50 text-ink-muted">{f.status === 'ignored' ? 'marked safe' : 'cleared'}</span>}
                  <span className="font-bold text-ink">{f.title}</span>
                </div>
                <div className="mt-1 text-[12px] font-mono text-brand-700 break-all">{f.path}{f.line ? `:${f.line}` : ''}</div>
                {f.snippet && <pre className="mt-2 rounded-xl bg-slate-900 text-slate-100 text-[12px] p-3 overflow-x-auto whitespace-pre-wrap break-all">{f.snippet}</pre>}
                <div className="mt-1.5 text-[11px] text-ink-muted">Found {timeAgo(f.firstSeen)}{f.fileModified ? ` · file changed ${timeAgo(f.fileModified)}` : ''}{f.clearedAt ? ` · cleared ${timeAgo(f.clearedAt)}` : ''}</div>
              </div>
              {f.status !== 'cleared' && (
                <button type="button" disabled={busy} onClick={() => setIgnored(f, f.status !== 'ignored')} className="h-9 px-3 rounded-xl border border-brand-200 text-[12px] font-bold text-ink flex items-center gap-1.5">
                  {f.status === 'ignored' ? <><Eye size={13} /> Watch again</> : <><EyeOff size={13} /> Mark as safe</>}
                </button>
              )}
            </div>
          </div>
        ))}
        {open.length > 0 && <p className="text-[12px] text-ink-soft"><span className="font-bold">If a file is not yours:</span> take a backup, delete or restore the file, change admin, FTP and database passwords, update everything, then check the site again. A full scan confirms it is gone.</p>}
        <p className="text-[11px] text-ink-muted">Read-only scan inside your site: files are read, never executed, changed or deleted. It looks for code in upload folders, known backdoors and web shells, request input reaching eval or shell functions, obfuscated code and injected JavaScript{platform === 'wordpress' ? ', and compares WordPress core with the official release' : ''}.</p>
      </div>
    </div>
  );
};

export default SuspiciousFilesPanel;
