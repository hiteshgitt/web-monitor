import React, { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { apiFetch } from '../../services/session';

const STATUS_LABEL = { good: 'Good', 'needs-improvement': 'Needs improvement', poor: 'Poor' };
const STATUS_CLASS = {
  good: 'bg-emerald-50 text-emerald-700',
  'needs-improvement': 'bg-amber-50 text-amber-700',
  poor: 'bg-rose-50 text-rose-700',
};

const formatMs = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  return number >= 1000 ? `${(number / 1000).toFixed(1)}s` : `${Math.round(number)}ms`;
};

const formatCls = (value) => (value == null || Number.isNaN(Number(value)) ? '—' : Number(value).toFixed(2));

const Vital = ({ label, display, status }) => (
  <div className="rounded-xl border border-brand-100 px-4 py-3">
    <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">{label}</div>
    <div className="mt-1 flex items-center justify-between gap-2">
      <span className="text-lg font-extrabold text-ink">{display}</span>
      {status && (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${STATUS_CLASS[status] || 'bg-brand-50 text-ink-muted'}`}>
          {STATUS_LABEL[status] || status}
        </span>
      )}
    </div>
  </div>
);

const scoreTone = (score) => {
  if (score == null) return 'text-ink-muted';
  if (score >= 90) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-rose-600';
};

// Lab (PageSpeed) and field (Chrome visitors) for one site. The two numbers are never merged.
const WebVitalsPanel = ({ siteId }) => {
  const [report, setReport] = useState(null);
  const [strategy, setStrategy] = useState('mobile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${API_BASE_URL}/advanced/vitals/${siteId}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'PageSpeed could not be loaded.');
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [siteId]);

  const lab = strategy === 'desktop' ? report?.lab?.desktop : report?.lab?.mobile;
  const field = strategy === 'desktop' ? report?.field?.desktop : report?.field?.phone;
  const scannedAt = report?.scannedAt || report?.checkedAt || null;
  const checked = scannedAt ? new Date(scannedAt).toLocaleString() : null;
  const hasLab = Boolean(lab && (lab.score != null || lab.lcp));

  return (
    <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-brand-100 flex flex-wrap items-center justify-between gap-3 bg-linear-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
            <Gauge size={20} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest">PageSpeed & Core Web Vitals</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              {checked ? `Scanned ${checked}. The next scan is about a week later.` : 'Scanned automatically once a week. No Google connection.'}
            </p>
          </div>
        </div>
        <div className="flex rounded-xl bg-brand-50 p-1">
          {['mobile', 'desktop'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStrategy(item)}
              className={`px-3 h-8 rounded-lg text-xs font-bold capitalize ${strategy === item ? 'bg-white text-brand-700 shadow-card' : 'text-ink-muted'}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {error && <p className="text-sm text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</p>}
        {report?.configured === false && (
          <p className="text-sm text-ink-muted">PageSpeed is not turned on for this server yet.</p>
        )}
        {loading && !hasLab && <p className="text-sm text-ink-muted">Loading the saved scan…</p>}
        {!loading && report?.configured !== false && !report?.lab && (
          <p className="text-sm text-ink-muted">The weekly scan has not reached this site yet. The result shows up here on its own.</p>
        )}
        {checked && hasLab && (
          <p className="text-xs text-ink-muted -mt-1">Showing the saved scan until the next weekly refresh.</p>
        )}

        {hasLab && (
          <div className="grid lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-brand-100 p-4 space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Lab · PageSpeed</div>
                  <p className="text-xs text-ink-muted mt-1">A test visit from Google. This is not your visitors’ experience.</p>
                </div>
                <div className={`text-4xl font-extrabold tracking-tight ${scoreTone(lab?.score)}`}>
                  {lab?.score != null ? lab.score : '—'}
                </div>
              </div>
              {!lab && <p className="text-sm text-ink-muted">{report.lab.error || 'No lab result for this device.'}</p>}
              {lab && (
                <div className="grid grid-cols-2 gap-2">
                  <Vital label="LCP" display={lab.lcp?.display || formatMs(lab.lcp?.value)} status={lab.lcp?.status} />
                  <Vital label="INP" display={lab.inp?.display || formatMs(lab.inp?.value)} status={lab.inp?.status} />
                  <Vital label="CLS" display={lab.cls?.display || formatCls(lab.cls?.value)} status={lab.cls?.status} />
                  <Vital label="FCP" display={lab.fcp?.display || formatMs(lab.fcp?.value)} status={lab.fcp?.status} />
                  <Vital label="Total blocking" display={lab.tbt?.display || formatMs(lab.tbt?.value)} status={lab.tbt?.status} />
                  <Vital label="Speed index" display={lab.speedIndex?.display || formatMs(lab.speedIndex?.value)} />
                </div>
              )}
              {lab?.opportunities?.length > 0 && (
                <ul className="text-sm text-ink space-y-1">
                  {lab.opportunities.map((item) => (
                    <li key={item.title} className="flex justify-between gap-3">
                      <span>{item.title}</span>
                      {item.display && <span className="text-ink-muted shrink-0">{item.display}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-brand-100 p-4 space-y-3">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Field · real Chrome visitors</div>
                <p className="text-xs text-ink-muted mt-1">
                  {field?.period ? `75th percentile, ${field.period}` : '75th percentile from the Chrome UX Report'}
                </p>
              </div>
              {report.field?.message && !field && <p className="text-sm text-ink-muted">{report.field.message}</p>}
              {!field && !report.field?.message && <p className="text-sm text-ink-muted">{report.field?.error || 'No field data for this device.'}</p>}
              {field && (
                <div className="grid grid-cols-1 gap-2">
                  <Vital label="LCP" display={formatMs(field.lcp?.p75)} status={field.lcp?.status} />
                  <Vital label="INP" display={formatMs(field.inp?.p75)} status={field.inp?.status} />
                  <Vital label="CLS" display={formatCls(field.cls?.p75)} status={field.cls?.status} />
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebVitalsPanel;
