import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Copy, Check, ExternalLink } from 'lucide-react';
import { fetchAttestation, issueAttestation, revokeAttestation } from '../../services/report';

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

// Pro: issue a Ruya Lab Security Assessment Attestation when no critical or high finding is open.
const AttestationPanel = ({ siteId }) => {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const load = useCallback(() => fetchAttestation(siteId).then(setState).catch((e) => setError(e.message)), [siteId]);
  useEffect(() => { load(); }, [load]);

  const issue = async () => {
    setBusy(true); setError('');
    try { await issueAttestation(siteId); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const revoke = async () => {
    setBusy(true); setError('');
    try { await revokeAttestation(siteId, state.latest.id); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const copy = async () => { await navigator.clipboard.writeText(state.latest.url).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const latest = state?.latest;
  const valid = latest?.status === 'valid';

  return (
    <section className="bg-white rounded-3xl border border-brand-100 p-5 shadow-card">
      <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-ink-muted flex items-center gap-1.5"><BadgeCheck size={14} /> Security attestation</h2>
      <p className="text-xs text-ink-soft mt-1.5 leading-relaxed">A Ruya Lab certificate of this automated assessment, valid 90 days, that anyone can verify online. Not a CERT-In VAPT certificate.</p>
      {!state && !error && <p className="text-xs text-ink-muted mt-3 animate-pulse">Checking…</p>}
      {latest && (
        <div className={`mt-3 rounded-xl px-3 py-2.5 text-xs ${valid ? 'bg-emerald-50 text-emerald-800' : 'bg-canvas text-ink-soft'}`}>
          <div className="font-bold">{valid ? `Valid until ${fmtDate(latest.validUntil)}` : latest.status === 'revoked' ? 'Revoked' : 'Expired'}</div>
          <div>Issued {fmtDate(latest.issuedAt)}</div>
          {valid && (
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={latest.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-brand-700 hover:underline">Open certificate <ExternalLink size={12} /></a>
              <button type="button" onClick={copy} className="inline-flex items-center gap-1 font-bold text-brand-700 hover:underline">{copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy link'}</button>
              <button type="button" onClick={revoke} disabled={busy} className="font-bold text-bad hover:underline">Revoke</button>
            </div>
          )}
        </div>
      )}
      {state && (state.eligible ? (
        <button type="button" onClick={issue} disabled={busy} className="btn-primary w-full justify-center mt-3">{busy ? 'Issuing…' : valid ? 'Issue a new one' : 'Issue attestation'}</button>
      ) : (
        <div className="mt-3 text-xs text-ink-soft">
          <div className="font-bold text-ink">Not yet: fix these first</div>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">{state.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      ))}
      {error && <p className="text-xs text-bad mt-2">{error}</p>}
    </section>
  );
};

export default AttestationPanel;
