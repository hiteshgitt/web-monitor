import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import Logo from '../Logo';
import { API_BASE_URL } from '../../config/api';

const LOOK = {
  up: { label: 'Up', icon: CheckCircle2, className: 'text-good bg-good-soft' },
  slow: { label: 'Slow', icon: AlertTriangle, className: 'text-warn bg-warn-soft' },
  down: { label: 'Down', icon: XCircle, className: 'text-bad bg-bad-soft' },
  unknown: { label: 'Waiting', icon: HelpCircle, className: 'text-ink-muted bg-canvas' },
};

const when = (iso) => (iso ? new Date(iso).toLocaleString() : 'Not checked yet');

// A page a client can open without a Web Monitor login. It shows up, down or slow only.
const StatusPage = () => {
  const { slug } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = () => fetch(`${API_BASE_URL}/status/${slug}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'This status page does not exist.');
        if (!cancelled) { setReport(data); setError(''); }
      })
      .catch((err) => { if (!cancelled) setError(err.message); });
    load();
    const timer = window.setInterval(load, 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [slug]);

  const sites = report?.sites || [];
  const down = sites.filter((site) => site.status === 'down').length;
  const slow = sites.filter((site) => site.status === 'slow').length;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-white border-b border-brand-100">
        <div className="max-w-3xl mx-auto px-5 py-5 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo variant="brand" className="h-6" />
            <span className="font-extrabold text-ink">Web Monitor</span>
          </Link>
          <span className="text-[12px] font-semibold text-ink-muted">Public status</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-8">
        {error && <p className="text-sm font-semibold text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</p>}
        {!error && !report && <p className="text-sm text-ink-muted">Loading status…</p>}
        {report && (
          <>
            <h1 className="text-3xl font-extrabold text-ink tracking-tight">{report.name}</h1>
            <p className="mt-2 text-ink-muted">
              {down > 0 ? `${down} site${down === 1 ? '' : 's'} down` : slow > 0 ? `${slow} site${slow === 1 ? '' : 's'} slow` : sites.length ? 'All monitored sites are answering' : 'No sites are on this page yet'}.
              <span className="block text-[12px] mt-1">Checked about once a minute. This page does not show scores, analytics or security details.</span>
            </p>
            <ul className="mt-6 space-y-3">
              {sites.map((site) => {
                const look = LOOK[site.status] || LOOK.unknown;
                const Icon = look.icon;
                return (
                  <li key={site.url} className="bg-white rounded-2xl border border-brand-100 px-4 py-4 flex items-center gap-4">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${look.className}`}><Icon size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-ink truncate">{site.name}</span>
                      <a href={site.url} className="block text-[13px] text-brand-700 truncate hover:underline" target="_blank" rel="noreferrer">{site.url.replace(/^https?:\/\//, '')}</a>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-sm font-extrabold text-ink">{look.label}</span>
                      <span className="block text-[11px] text-ink-muted">{site.uptime == null ? 'No 30-day uptime yet' : `${site.uptime}% up · 30 days`}</span>
                      <span className="block text-[11px] text-ink-muted">{when(site.lastChecked)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </div>
  );
};

export default StatusPage;
