import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { apiFetch } from '../../services/session';

const THREAT_LABEL = {
  MALWARE: 'Malware',
  SOCIAL_ENGINEERING: 'Phishing',
  UNWANTED_SOFTWARE: 'Unwanted software',
  POTENTIALLY_HARMFUL_APPLICATION: 'Harmful app',
};

// Saved weekly check: Safe Browsing, SSL Labs, and the headers the site actually sends.
const SecurityScanPanel = ({ siteId }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let polls = 0;
    const load = () => apiFetch(`${API_BASE_URL}/advanced/security-scan/${siteId}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'The security check could not be loaded.');
        if (cancelled) return;
        setReport(data);
        setLoading(false);
        const waiting = data.checking || data.running || data.ssl?.status === 'pending' || !data.checkedAt;
        if (waiting && polls < 12) {
          polls += 1;
          timer = window.setTimeout(load, 8000);
        }
      })
      .catch((err) => { if (!cancelled) { setError(err.message); setLoading(false); } });
    load();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [siteId]);

  const malware = report?.malware;
  const ssl = report?.ssl;
  const headers = report?.headers;
  const checked = report?.scannedAt || report?.checkedAt;
  const malwareText = !malware
    ? '—'
    : malware.status === 'clean'
      ? 'No listing'
      : malware.status === 'flagged'
        ? malware.threats.map((threat) => THREAT_LABEL[threat] || threat).join(', ')
        : 'Not checked';

  return (
    <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-brand-100 bg-linear-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest">Public security check</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              {checked ? `Scanned ${new Date(checked).toLocaleString()}. The next scan is about a week later.` : 'Scanned automatically once a week from public sources.'}
            </p>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {error && <p className="text-sm text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</p>}
        {loading && <p className="text-sm text-ink-muted">Loading the saved check…</p>}
        {!loading && !report?.malware && !report?.ssl && !report?.headers && (
          <p className="text-sm text-ink-muted">
            {report?.checking ? 'Checking this site now. Malware, the SSL grade and response headers appear here as each result comes back.' : 'No public security result is stored for this site yet.'}
          </p>
        )}
        {(malware || ssl || headers) && (
          <div className="grid md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-brand-100 px-4 py-3">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Malware</div>
              <div className={`mt-1 text-lg font-extrabold ${malware?.status === 'flagged' ? 'text-rose-600' : 'text-ink'}`}>{malwareText}</div>
              <p className="text-xs text-ink-muted mt-1">{malware?.message || 'Google Safe Browsing'}</p>
            </div>
            <div className="rounded-xl border border-brand-100 px-4 py-3">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">SSL grade</div>
              <div className="mt-1 text-lg font-extrabold text-ink">{ssl?.grade || (ssl?.status === 'pending' ? 'Grading…' : '—')}</div>
              <p className="text-xs text-ink-muted mt-1">{ssl?.message || 'SSL Labs'}</p>
            </div>
            <div className="rounded-xl border border-brand-100 px-4 py-3">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Response headers</div>
              <div className="mt-1 text-lg font-extrabold text-ink">
                {headers?.present != null ? `${headers.present} of ${headers.checked}` : '—'}
              </div>
              <p className="text-xs text-ink-muted mt-1">
                {headers?.error || (headers?.missing?.length ? `Missing ${headers.missing.join(', ')}` : 'The checked headers are present.')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityScanPanel;
