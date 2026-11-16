import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ExternalLink, RefreshCw, ScanSearch } from 'lucide-react';
import { fetchRuyaShieldForSite, requestRuyaShieldScan } from '../../services/ruyashield';
import RuyaShieldModal from './RuyaShieldModal';

const SEVERITIES = [
  ['critical', 'Critical', 'text-rose-700 bg-rose-50'],
  ['high', 'High', 'text-orange-700 bg-orange-50'],
  ['medium', 'Medium', 'text-amber-700 bg-amber-50'],
  ['low', 'Low', 'text-sky-700 bg-sky-50'],
  ['info', 'Info', 'text-ink-muted bg-canvas'],
];
const SEVERITY_STYLE = Object.fromEntries(SEVERITIES.map(([key, , style]) => [key, style]));

const ASSESSMENT_LABEL = {
  completed: 'Completed',
  completed_with_errors: 'Completed with errors',
  queued: 'Queued',
  running: 'Running',
  failed: 'Failed',
  timed_out: 'Timed out',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

// RuyaShield findings for one site. Hidden when the integration is not turned on for this deployment.
const RuyaShieldPanel = ({ siteId }) => {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [scanning, setScanning] = useState(false);

  const fetchReport = useCallback((refresh) => fetchRuyaShieldForSite(siteId, refresh)
    .then((data) => { setReport(data); setError(''); })
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false)), [siteId]);

  useEffect(() => { fetchReport(false); }, [fetchReport]);

  const load = (refresh = false) => {
    setLoading(true);
    return fetchReport(refresh);
  };

  // Opens the tab during the click (popup blockers allow that), then points it at RuyaShield's review page.
  const requestScan = async () => {
    const tab = window.open('about:blank', '_blank');
    setScanning(true);
    setError('');
    try {
      const { link } = await requestRuyaShieldScan(siteId);
      if (tab) {
        tab.opener = null;
        tab.location.href = link;
      } else {
        window.location.assign(link);
      }
    } catch (err) {
      tab?.close();
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  if (report && !report.configured) return null;
  const scanButton = report?.connected && report.scanRequests ? (
    <button type="button" onClick={requestScan} disabled={scanning} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-50 shrink-0">
      <ScanSearch size={15} /> {scanning ? 'Opening RuyaShield…' : 'Scan in RuyaShield'}
    </button>
  ) : null;

  const site = report?.site;
  const findings = site?.tracked ? site.findings : null;
  const last = site?.tracked ? site.lastAssessment : null;

  return (
    <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-brand-100 bg-linear-to-r from-gray-50 to-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest">RuyaShield</h3>
            <p className="text-xs text-ink-muted mt-0.5 truncate">
              {report?.connected
                ? `${report.orgName}${report.fetchedAt ? ` · updated ${new Date(report.fetchedAt).toLocaleTimeString()}` : ''}`
                : 'Vulnerability findings from your RuyaShield account'}
            </p>
          </div>
        </div>
        {report?.connected && (
          <button type="button" onClick={() => load(true)} disabled={loading} className="btn-ghost shrink-0" aria-label="Refresh RuyaShield">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      <div className="p-6 space-y-4">
        {error && <p className="text-sm text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</p>}
        {report?.error && <p className="text-sm text-bad bg-bad-soft rounded-xl px-4 py-3">{report.error}</p>}
        {loading && !report && <p className="text-sm text-ink-muted">Loading RuyaShield…</p>}

        {report && !report.connected && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <p className="text-sm text-ink-soft">
              Connect your RuyaShield account to see open vulnerabilities, verified fixes and the latest assessment for this site.
            </p>
            <button type="button" onClick={() => setShowConnect(true)} className="px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 shrink-0">
              Connect RuyaShield
            </button>
          </div>
        )}

        {report?.connected && site && !site.tracked && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <p className="text-sm text-ink-soft">
              <span className="font-semibold text-ink">{site.host}</span> is not in your RuyaShield organisation yet. Add and verify it there to start scanning.
            </p>
            <div className="flex flex-wrap gap-2 shrink-0">
              {report.appUrl && (
                <a href={`${report.appUrl}/assets`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-brand-100 text-sm font-bold text-brand-700 hover:bg-brand-50 shrink-0">
                  Add in RuyaShield <ExternalLink size={14} />
                </a>
              )}
              {scanButton}
            </div>
          </div>
        )}

        {site?.tracked && (
          <>
            {site.asset.status !== 'verified' && (
              <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-3">
                Ownership of {site.host} is {String(site.asset.status).replace(/_/g, ' ')} in RuyaShield, so it is not being scanned. Verify it in RuyaShield.
              </p>
            )}

            {findings ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {SEVERITIES.map(([key, label, style]) => (
                  <div key={key} className={`rounded-xl px-3 py-2.5 ${style}`}>
                    <div className="text-[10px] font-extrabold uppercase tracking-widest opacity-80">{label}</div>
                    <div className="text-xl font-extrabold tabular-nums">{findings.open[key]}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">This token cannot read findings. Reconnect with a token that has the findings:read scope.</p>
            )}

            {findings && findings.openTotal === 0 && last && (
              <p className="text-sm text-ink-soft">No open findings from the latest RuyaShield assessment.</p>
            )}

            {findings?.top?.length > 0 && (
              <ul className="divide-y divide-brand-100 rounded-xl border border-brand-100">
                {findings.top.map((f, i) => (
                  <li key={`${f.title}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${SEVERITY_STYLE[f.severity]}`}>{f.severity}</span>
                    <span className="text-ink truncate">{f.title}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px] text-ink-muted">
              <span>
                {last
                  ? `Last assessment: ${ASSESSMENT_LABEL[last.status] || last.status}${last.finishedAt ? `, ${new Date(last.finishedAt).toLocaleString()}` : ''}${last.complete === false ? ' (some checks did not run)' : ''}`
                  : 'No assessment has run for this site yet.'}
              </span>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <a href={site.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-bold text-brand-700 hover:underline">
                  Open in RuyaShield <ExternalLink size={14} />
                </a>
                {scanButton}
              </div>
            </div>
          </>
        )}
      </div>

      {showConnect && <RuyaShieldModal onClose={() => setShowConnect(false)} onChanged={() => load(true)} />}
    </div>
  );
};

export default RuyaShieldPanel;
