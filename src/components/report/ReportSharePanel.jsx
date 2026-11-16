import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Link2, Trash2 } from 'lucide-react';
import { createReportShare, listReportShares, revokeReportShare } from '../../services/report';

const EXPIRY = [7, 30, 90, 365];
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

// Pro: private links to this report for a client. The link is shown once; afterwards it can only be revoked.
const ReportSharePanel = ({ siteId, days }) => {
  const [shares, setShares] = useState([]);
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => listReportShares(siteId).then(setShares).catch((err) => setError(err.message)), [siteId]);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const share = await createReportShare(siteId, { days, expiresInDays, label });
      setCreated(share);
      setLabel('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id) => {
    setError('');
    try {
      await revokeReportShare(siteId, id);
      if (created?.id === id) setCreated(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link stays selectable.
    }
  };

  return (
    <section className="bg-white rounded-3xl border border-brand-100 p-6 sm:p-8 print:hidden">
      <div className="flex items-center gap-2">
        <Link2 size={18} className="text-brand-600" />
        <h2 className="text-lg font-extrabold text-ink">Share with a client</h2>
      </div>
      <p className="text-sm text-ink-soft mt-1">A private link to this {days}-day report. Your client opens it without an account and can download the PDF. Links stop working when they expire, when you revoke them, or if your Pro plan ends.</p>

      <form onSubmit={create} className="mt-4 flex flex-col sm:flex-row gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Who is it for? (optional)"
          className="flex-1 min-w-0 rounded-xl border border-brand-100 px-3 py-2.5 text-sm" aria-label="Link label" />
        <select value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value))} className="rounded-xl border border-brand-100 px-3 py-2.5 text-sm" aria-label="Link expires after">
          {EXPIRY.map((d) => <option key={d} value={d}>Expires in {d} days</option>)}
        </select>
        <button type="submit" disabled={busy} className="btn-primary shrink-0">{busy ? 'Creating…' : 'Create link'}</button>
      </form>

      {error && <p className="mt-3 text-sm text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</p>}

      {created && (
        <div className="mt-4 rounded-2xl bg-brand-50 p-4">
          <p className="text-xs font-bold text-ink-soft">Copy this link now. For security it is not shown again.</p>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <code className="flex-1 min-w-0 break-all rounded-xl bg-white border border-brand-100 px-3 py-2.5 text-xs select-all">{created.url}</code>
            <button type="button" onClick={copy} className="btn-primary shrink-0">{copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}</button>
          </div>
        </div>
      )}

      {shares.length > 0 && (
        <ul className="mt-5 divide-y divide-brand-100 rounded-2xl border border-brand-100">
          {shares.map((sh) => (
            <li key={sh.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
              <span className="font-bold text-ink">{sh.label || 'Untitled link'}</span>
              <span className="text-xs text-ink-muted">{sh.days}-day report · expires {fmtDate(sh.expiresAt)} · {sh.lastViewedAt ? `last opened ${fmtDate(sh.lastViewedAt)}` : 'not opened yet'}</span>
              <button type="button" onClick={() => revoke(sh.id)} className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-bad hover:underline"><Trash2 size={13} /> Revoke</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ReportSharePanel;
