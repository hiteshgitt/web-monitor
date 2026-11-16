import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Download } from 'lucide-react';
import { fetchSharedReport } from '../../services/report';
import { FullReport, ReportHeader } from './SiteReport';

// What a client sees from a shared link: the full report, read-only, no sign-in.
const SharedReport = () => {
  const { token } = useParams();
  const [state, setState] = useState({ report: null, error: '' });

  useEffect(() => {
    let live = true;
    fetchSharedReport(token)
      .then((report) => live && setState({ report, error: '' }))
      .catch((err) => live && setState({ report: null, error: err.message }));
    return () => { live = false; };
  }, [token]);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const { report, error } = state;
  return (
    <div className="min-h-screen bg-canvas print:bg-white print:min-h-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5 print:p-0 print:space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
          <button type="button" onClick={() => window.print()} disabled={!report} className="btn-primary"><Download size={15} /> <span className="whitespace-nowrap">Download PDF</span></button>
        </div>

        {error ? (
          <header className="bg-white rounded-3xl border border-brand-100 p-6 sm:p-8"><h1 className="text-2xl font-extrabold text-ink">Report unavailable</h1></header>
        ) : <ReportHeader report={report} />}

        {error && <p className="text-sm text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</p>}
        {!report && !error && <p className="text-sm text-ink-muted">Building the report…</p>}
        {report && <FullReport report={report} />}

        <p className="text-center text-xs text-ink-muted print:hidden">
          Monitored with <a href="/" className="font-bold text-brand-700 hover:underline">Web Monitor</a> by Ruyalab.
        </p>
      </div>
    </div>
  );
};

export default SharedReport;
