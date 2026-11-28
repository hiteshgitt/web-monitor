import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import QRCode from 'qrcode';
import { BadgeCheck, Download, ShieldAlert } from 'lucide-react';
import Logo from '../Logo';
import { fetchPublicAttestation } from '../../services/report';

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—');
const SEV = [['critical', 'Critical'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];

// Public, printable certificate at /verify/:id. Shows the snapshot exactly as issued and whether it is still valid.
const AttestationPage = () => {
  const { id } = useParams();
  const [a, setA] = useState(null);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  useEffect(() => { fetchPublicAttestation(id).then(setA).catch((e) => setError(e.message)); }, [id]);
  useEffect(() => { if (a?.url) QRCode.toDataURL(a.url, { margin: 1, width: 180, color: { dark: '#1f2557', light: '#ffffff' } }).then(setQr).catch(() => {}); }, [a?.url]);

  if (error) return <div className="min-h-screen bg-canvas flex items-center justify-center p-6"><p className="bg-white rounded-2xl p-6 text-sm text-bad shadow-card">{error}</p></div>;
  if (!a) return <div className="min-h-screen bg-canvas flex items-center justify-center text-sm text-ink-muted">Loading…</div>;
  const valid = a.status === 'valid';
  const host = (() => { try { return new URL(a.site.url).host; } catch { return a.site.url; } })();

  return (
    <div className="min-h-screen bg-canvas py-8 px-4 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${valid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
            {valid ? <BadgeCheck size={16} /> : <ShieldAlert size={16} />} {valid ? 'Valid attestation' : a.status === 'revoked' ? 'Revoked by the issuer' : 'Expired'}
          </span>
          <button type="button" onClick={() => window.print()} className="btn-primary"><Download size={15} /> Download PDF</button>
        </div>

        <article className="bg-white rounded-3xl shadow-frame border-[6px] border-double border-brand-200 p-8 sm:p-12 print:shadow-none print:rounded-none">
          <header className="flex items-start justify-between gap-6">
            <div>
              <Logo variant="brand" className="h-7" />
              <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.25em] text-brand-600">Ruya Lab</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight mt-1">Security Assessment Attestation</h1>
            </div>
            {qr && <img src={qr} alt="Verify this attestation" className="w-24 h-24 sm:w-28 sm:h-28" />}
          </header>

          <p className="mt-8 text-ink-soft leading-relaxed">
            This attests that <strong className="text-ink">{a.site.name}</strong> (<span className="font-mono">{host}</span>) completed an automated
            security assessment by Ruya Lab on <strong className="text-ink">{fmtDate(a.issuedAt)}</strong>, with
            <strong className="text-ink"> no critical or high-severity findings open</strong> at that date.
          </p>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SEV.map(([k, label]) => (
              <div key={k} className="rounded-xl bg-canvas px-3 py-2.5 print:border print:border-brand-100">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">{label} open</div>
                <div className="text-xl font-extrabold text-ink tabular-nums">{a.result.openBySeverity[k] ?? 0}</div>
              </div>
            ))}
          </div>
          <dl className="mt-6 grid sm:grid-cols-3 gap-4 text-sm">
            <div><dt className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Highest open CVSS</dt><dd className="font-bold text-ink mt-1">{a.result.highestCvss != null ? a.result.highestCvss.toFixed(1) : 'None'}</dd></div>
            <div><dt className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Uptime (30 days)</dt><dd className="font-bold text-ink mt-1">{a.uptimePercent != null ? `${a.uptimePercent}%` : '—'}</dd></div>
            <div><dt className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">SSL Labs grade</dt><dd className="font-bold text-ink mt-1">{a.sslGrade || '—'}</dd></div>
          </dl>

          <h2 className="mt-8 text-[11px] font-extrabold uppercase tracking-widest text-ink-muted">Scope of the assessment</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {a.scope.map((s) => (
              <li key={s.area} className="flex gap-2"><span className={`font-bold ${s.assessed ? 'text-emerald-700' : 'text-ink-muted'}`}>{s.assessed ? '✓' : '–'}</span><span className={s.assessed ? 'text-ink' : 'text-ink-muted'}>{s.area}{s.assessed ? '' : ' (not assessed)'}</span></li>
            ))}
          </ul>

          {a.result.remaining.length > 0 && (
            <>
              <h2 className="mt-6 text-[11px] font-extrabold uppercase tracking-widest text-ink-muted">Open lower-severity findings at issue</h2>
              <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                {a.result.remaining.map((f, i) => <li key={`${f.title}-${i}`}><span className="capitalize">{f.severity}</span>{f.cvss != null ? ` · CVSS ${f.cvss.toFixed(1)}${f.cvssSource === 'rated' ? '*' : ''}` : ''} · {f.title}</li>)}
              </ul>
            </>
          )}

          <footer className="mt-10 pt-6 border-t border-brand-100 grid sm:grid-cols-2 gap-4 text-xs text-ink-muted">
            <div>
              <div>Issued {fmtDate(a.issuedAt)} · valid until {fmtDate(a.validUntil)}</div>
              <div className="mt-1">Verification ID <span className="font-mono text-ink">{a.id}</span></div>
              <div className="mt-1 break-all">Verify at <span className="font-mono">{a.url}</span></div>
              <div className="mt-1 break-all">Snapshot SHA-256 <span className="font-mono">{a.sha256}</span></div>
            </div>
            <p className="leading-relaxed">{a.disclaimer} * CVSS rated by Ruya Lab for the finding type.</p>
          </footer>
        </article>
      </div>
    </div>
  );
};

export default AttestationPage;
