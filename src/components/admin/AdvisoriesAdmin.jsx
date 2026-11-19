import React, { useCallback, useEffect, useState } from 'react';
import { Radar, Plus, Send, CheckCircle2 } from 'lucide-react';
import { adminRequest as request } from '../../services/adminSession';
import { timeAgo } from '../../utils/siteMetrics';

// Release Radar (super admin): publish a security advisory for PHP, Node.js, WordPress or Next.js.
// "Announced" tells owners of affected Pro sites before the release (with the mitigation); "Released" adds the
// fixed version per branch and tells them the exact upgrade; patched sites are detected from the health check.
const EMPTY = { component: 'php', title: '', severity: 'critical', cves: '', branches: '*', fixed: '', summary: '', mitigation: '', url: '', releaseAt: '', exposure: '', status: 'draft' };
const SEV = { critical: 'bg-bad text-white', high: 'bg-bad-soft text-bad', moderate: 'bg-warn-soft text-warn', low: 'bg-brand-50 text-brand-700' };

const toForm = (a) => ({
  component: a.component, title: a.title, severity: a.severity, cves: (a.cves || []).join(', '), branches: (a.branches || ['*']).join(', '),
  fixed: Object.entries(a.fixed || {}).map(([b, v]) => `${b}:${v}`).join(' '), summary: a.summary || '', mitigation: a.mitigation || '',
  url: a.url || '', releaseAt: a.releaseAt ? a.releaseAt.slice(0, 16) : '', exposure: Object.keys(a.exposure || {}).length ? JSON.stringify(a.exposure) : '', status: a.status,
});

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-ink-muted mt-1">{hint}</span>}
  </label>
);
const input = 'mt-1 w-full rounded-xl border border-brand-100 bg-white px-3 py-2 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-brand-300';

const AdvisoriesAdmin = () => {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => request('/advisories').then(setList).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (status) => {
    setBusy(true); setError(''); setMsg('');
    try {
      let exposure = null;
      if (form.exposure.trim()) {
        try { exposure = JSON.parse(form.exposure); } catch { throw new Error('Exposure must be JSON, e.g. {"session.upload_progress.enabled": true}'); }
      }
      const body = { ...form, status, exposure, releaseAt: form.releaseAt ? new Date(`${form.releaseAt}Z`).toISOString() : null };
      const r = await request(editId ? `/advisories/${editId}` : '/advisories', { method: editId ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      setMsg(r.sync ? `Saved as ${r.status}. Matched ${r.sync.sites} Pro sites; ${r.sync.notices} notification(s) sent.` : `Saved as ${r.status}.`);
      setForm(null); setEditId(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-extrabold text-ink flex items-center gap-2"><Radar size={20} className="text-brand-600" /> Release Radar</h2>
          <p className="text-[13px] text-ink-soft">Security advisories for PHP, Node.js, WordPress and Next.js. Pro owners of affected sites are told before the release, at release, and when each site is patched.</p>
        </div>
        {!form && <button type="button" onClick={() => { setForm(EMPTY); setEditId(null); }} className="btn-primary !h-10"><Plus size={16} /> New advisory</button>}
      </div>
      {msg && <div className="text-sm font-semibold text-good bg-good-soft rounded-xl px-4 py-3 flex items-center gap-2"><CheckCircle2 size={16} /> {msg}</div>}
      {error && <div className="text-sm font-semibold text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</div>}

      {form && (
        <div className="panel p-5 space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Component">
              <select value={form.component} onChange={set('component')} className={input}>
                <option value="php">PHP</option><option value="node">Node.js</option><option value="wordpress">WordPress</option><option value="nextjs">Next.js</option>
              </select>
            </Field>
            <Field label="Severity">
              <select value={form.severity} onChange={set('severity')} className={input}>
                {['critical', 'high', 'moderate', 'low'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Release time (UTC)" hint="When the fix ships, if scheduled.">
              <input type="datetime-local" value={form.releaseAt} onChange={set('releaseAt')} className={input} />
            </Field>
          </div>
          <Field label="Title"><input value={form.title} onChange={set('title')} className={input} placeholder="PHP security releases (session upload progress RCE)" /></Field>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="CVEs" hint="Comma separated."><input value={form.cves} onChange={set('cves')} className={input} placeholder="CVE-2026-115560" /></Field>
            <Field label="Affected branches" hint="8.3, 8.4 (PHP / WordPress), 22 (Node.js / Next.js), or * for all."><input value={form.branches} onChange={set('branches')} className={input} /></Field>
            <Field label="Fixed versions" hint="Needed to release: 8.3:8.3.37 8.4:8.4.28"><input value={form.fixed} onChange={set('fixed')} className={input} /></Field>
          </div>
          <Field label="Summary"><textarea rows={2} value={form.summary} onChange={set('summary')} className={input} /></Field>
          <Field label="Mitigation before upgrading" hint="Sent to owners with the announcement."><textarea rows={3} value={form.mitigation} onChange={set('mitigation')} className={input} /></Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Advisory link"><input value={form.url} onChange={set('url')} className={input} placeholder="https://www.php.net/..." /></Field>
            <Field label="Exposure rule (optional JSON)" hint='Sites whose integration reports a different value are marked "not exposed".'>
              <input value={form.exposure} onChange={set('exposure')} className={input} placeholder='{"session.upload_progress.enabled": true}' />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button type="button" disabled={busy} onClick={() => { setForm(null); setEditId(null); }} className="h-10 px-4 rounded-xl text-[13px] font-bold text-ink-soft hover:bg-canvas">Cancel</button>
            <button type="button" disabled={busy} onClick={() => save('draft')} className="h-10 px-4 rounded-xl border border-brand-200 text-[13px] font-bold text-ink">Save draft</button>
            <button type="button" disabled={busy} onClick={() => save('announced')} className="h-10 px-4 rounded-xl bg-warn text-white text-[13px] font-bold flex items-center gap-2"><Send size={15} /> Announce</button>
            <button type="button" disabled={busy} onClick={() => save('released')} className="btn-primary !h-10"><Send size={15} /> Released (fix is out)</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {list.length === 0 && <p className="text-sm text-ink-muted">No advisories yet.</p>}
        {list.map((a) => (
          <div key={a.id} className="panel p-4 flex flex-wrap items-center gap-3 justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${SEV[a.severity]}`}>{a.severity}</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{a.componentLabel} · {a.status}</span>
                {a.cves.length > 0 && <span className="text-[11px] font-mono text-ink-muted">{a.cves.join(', ')}</span>}
              </div>
              <div className="font-bold text-ink mt-1">{a.title}</div>
              <div className="text-[12px] text-ink-muted">
                {a.counts.affected} affected · {a.counts.patched} patched · {a.counts.notExposed} not exposed
                {a.releaseAt && ` · release ${new Date(a.releaseAt).toUTCString().slice(5, 22)} UTC`}{a.publishedAt && ` · published ${timeAgo(a.publishedAt)}`}
              </div>
            </div>
            <button type="button" onClick={() => { setForm(toForm(a)); setEditId(a.id); setMsg(''); }} className="h-9 px-4 rounded-xl border border-brand-200 text-[12px] font-bold text-ink">Edit</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdvisoriesAdmin;
