import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Download, ExternalLink, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import UpgradeModal from '../pro/UpgradeModal';
import ReportSharePanel from './ReportSharePanel';
import ReportEmailPanel from './ReportEmailPanel';
import Logo from '../Logo';
import { fetchSiteReport } from '../../services/report';
import { useAuth } from '../../contexts/AuthContext';

const PERIODS = [7, 30, 90];

const PART_LABELS = {
  uptime: 'Uptime',
  security: 'Security (RuyaShield)',
  speed: 'Speed (PageSpeed)',
  publicChecks: 'SSL, headers and Safe Browsing',
};

const SEVERITIES = [
  ['critical', 'Critical', 'text-rose-700 bg-rose-50'],
  ['high', 'High', 'text-orange-700 bg-orange-50'],
  ['medium', 'Medium', 'text-amber-700 bg-amber-50'],
  ['low', 'Low', 'text-sky-700 bg-sky-50'],
  ['info', 'Info', 'text-ink-muted bg-canvas'],
];

// Status words go with every color, so the state never depends on color alone.
const tone = (score) => (score == null ? ['text-ink-muted', 'Not measured']
  : score >= 90 ? ['text-good', 'Good'] : score >= 70 ? ['text-warn', 'Needs attention'] : ['text-bad', 'Poor']);

const barColor = (score) => (score >= 90 ? 'bg-good' : score >= 70 ? 'bg-warn' : 'bg-bad');

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtMinutes = (m) => (m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`);

const Section = ({ title, aside, children }) => (
  <section className="bg-white rounded-3xl border border-brand-100 p-6 sm:p-8 print:rounded-none print:border-0 print:border-t print:px-0">
    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      {aside && <span className="text-xs text-ink-muted">{aside}</span>}
    </div>
    {children}
  </section>
);

const Stat = ({ label, value, sub }) => (
  <div className="rounded-2xl bg-canvas px-4 py-3.5 print:bg-white print:border print:border-brand-100">
    <div className="text-[11px] font-extrabold uppercase tracking-widest text-ink-muted">{label}</div>
    <div className="text-2xl font-extrabold text-ink tabular-nums mt-1">{value}</div>
    {sub && <div className="text-xs text-ink-muted mt-0.5">{sub}</div>}
  </div>
);

// Hero gauge: one number, its status word, and the parts it was built from.
const ScoreRing = ({ score }) => {
  const [color, word] = tone(score);
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 128 128" className="w-36 h-36" role="img" aria-label={score == null ? 'Health score not measured' : `Health score ${score} of 100, ${word}`}>
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--color-brand-100)" strokeWidth="10" />
        {score != null && (
          <circle cx="64" cy="64" r={r} fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 64 64)" className={color} />
        )}
        <text x="64" y="76" textAnchor="middle" className="fill-ink" fontSize="34" fontWeight="800">{score ?? '—'}</text>
      </svg>
      <span className={`text-sm font-bold ${color}`}>{word}</span>
    </div>
  );
};

// Daily uptime: one cell per day. Each cell has a tooltip and the table view below lists the values.
const UptimeStrip = ({ daily }) => {
  if (!daily.length) return null;
  return (
    <div>
      <div className="flex gap-[2px] h-9" role="img" aria-label="Daily uptime">
        {daily.map((d) => {
          const cls = d.uptime == null ? 'bg-brand-100' : d.uptime >= 99.9 ? 'bg-good' : d.uptime >= 99 ? 'bg-warn' : 'bg-bad';
          return (
            <div key={d.day} title={`${d.day}: ${d.uptime == null ? 'no checks' : `${d.uptime}% up`}${d.avgResponseMs != null ? `, ${d.avgResponseMs} ms average` : ''}`}
              className={`flex-1 min-w-[3px] rounded-[3px] ${cls} hover:opacity-70`} />
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-ink-muted mt-1.5">
        <span>{daily[0].day}</span>
        <span>{daily[daily.length - 1].day}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted mt-1">
        <span className="flex gap-3 flex-wrap">
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-good inline-block" />99.9%+</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-warn inline-block" />99–99.9%</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-bad inline-block" />below 99%</span>
        </span>
      </div>
    </div>
  );
};

// Daily average response time: a single series, so no legend; the section title names it.
const ResponseBars = ({ daily }) => {
  const values = daily.map((d) => d.avgResponseMs).filter((v) => v != null);
  if (!values.length) return null;
  const max = Math.max(...values);
  return (
    <div>
      <div className="text-xs font-bold text-ink-soft mb-2">Average response time per day <span className="font-normal text-ink-muted">(highest {max} ms)</span></div>
      <div className="flex items-end gap-[2px] h-24 border-b border-brand-100" role="img" aria-label="Average response time per day">
        {daily.map((d) => (
          <div key={d.day} className="flex-1 min-w-[3px] h-full flex items-end group" title={`${d.day}: ${d.avgResponseMs == null ? 'no data' : `${d.avgResponseMs} ms`}`}>
            {d.avgResponseMs != null && (
              <div className="w-full rounded-t-[3px] bg-brand-500 group-hover:bg-brand-700" style={{ height: `${Math.max(3, (d.avgResponseMs / max) * 100)}%` }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const SecuritySection = ({ security, shared }) => {
  // A client never sees a prompt to connect the owner's account.
  if (!security.connected && shared) return null;
  if (!security.connected) {
    return (
      <Section title="Security findings (RuyaShield)">
        <p className="text-sm text-ink-soft">Connect RuyaShield to add open vulnerabilities and the latest security assessment to this report.</p>
        <Link to="/app?connect=ruyashield" className="print:hidden inline-flex mt-4 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700">Connect RuyaShield</Link>
      </Section>
    );
  }
  if (!security.tracked) {
    return (
      <Section title="Security findings (RuyaShield)">
        <p className="text-sm text-ink-soft">This site is not in your RuyaShield organisation yet, so it has no security assessment. Not measured.</p>
      </Section>
    );
  }
  const last = security.lastAssessment;
  return (
    <Section title="Security findings (RuyaShield)" aside={security.orgName ? `${security.orgName} · updated ${fmtDateTime(security.fetchedAt)}` : null}>
      {!security.verified && <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-3 mb-4">Ownership is not verified in RuyaShield, so this site is not being scanned.</p>}
      {security.open ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {SEVERITIES.map(([key, label, style]) => (
            <div key={key} className={`rounded-xl px-3 py-2.5 ${style}`}>
              <div className="text-[10px] font-extrabold uppercase tracking-widest opacity-80">{label}</div>
              <div className="text-xl font-extrabold tabular-nums">{security.open[key]}</div>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-ink-muted">The RuyaShield token cannot read findings.</p>}
      {security.top.length > 0 && (
        <ul className="mt-4 divide-y divide-brand-100 rounded-xl border border-brand-100">
          {security.top.map((f, i) => (
            <li key={`${f.title}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-canvas text-ink-soft">{f.severity}</span>
              <span className="text-ink">{f.title}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-muted">
        <span>{last ? `Last assessment: ${String(last.status).replace(/_/g, ' ')}, ${fmtDateTime(last.finishedAt)}${last.complete === false ? ' (some checks did not run)' : ''}` : 'No assessment has run yet, so findings are not measured.'}</span>
        {security.link && <a href={security.link} target="_blank" rel="noopener noreferrer" className="print:hidden inline-flex items-center gap-1 font-bold text-brand-700 hover:underline">Open in RuyaShield <ExternalLink size={13} /></a>}
      </div>
    </Section>
  );
};

const LOCKED_SECTIONS = [
  ['Uptime and response time', 'Daily uptime, downtime, response times and the longest incidents'],
  ['Speed', 'PageSpeed score, Largest Contentful Paint and the top fixes'],
  ['SSL and security headers', 'SSL Labs grade, Safe Browsing and missing headers'],
  ['Security findings (RuyaShield)', 'Open vulnerabilities by severity and the latest assessment'],
];

// Free plan: the headline from the server (it sends nothing more) and what Pro unlocks. No download.
const PreviewReport = ({ report, onUpgrade }) => {
  const measured = Object.entries(PART_LABELS).filter(([k]) => report.score.measured[k]);
  return (
    <>
      <Section title="Overall health" aside="Last 30 days">
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] items-center">
          <ScoreRing score={report.score.overall} />
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">
              Uptime <span className="font-bold text-ink">{report.uptime.percent == null ? '—' : `${report.uptime.percent}%`}</span>
              {' '}with {report.uptime.incidentCount} incident{report.uptime.incidentCount === 1 ? '' : 's'} in the last 30 days.
            </p>
            <p className="text-sm text-ink-soft">
              Score built from: {measured.length ? measured.map(([, label]) => label).join(', ') : 'nothing measured yet'}.
            </p>
          </div>
        </div>
      </Section>

      <section className="relative bg-white rounded-3xl border border-brand-100 p-6 sm:p-8 overflow-hidden">
        <ul className="grid gap-3 sm:grid-cols-2">
          {LOCKED_SECTIONS.map(([title, text]) => (
            <li key={title} className="rounded-2xl bg-canvas px-4 py-3.5 flex gap-3">
              <Lock size={16} className="text-ink-muted shrink-0 mt-0.5" />
              <span>
                <span className="block text-sm font-bold text-ink">{title}</span>
                <span className="block text-xs text-ink-muted mt-0.5">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-brand-50 px-5 py-4">
          <p className="text-sm text-ink-soft">
            <span className="font-bold text-ink">The full report is part of Pro.</span> See every section, switch between 7, 30 and 90 days, and download it as a PDF for your client.
          </p>
          <button type="button" onClick={onUpgrade} className="btn-primary shrink-0"><Sparkles size={15} /> Upgrade to Pro</button>
        </div>
      </section>
    </>
  );
};

// The full report (Pro owner, or a client opening a shared link).
export const FullReport = ({ report }) => {
  const parts = report.score.parts;
  const u = report.uptime;
  return (
    <>
      <Section title="Overall health" aside={`Weights: uptime ${report.score.weights.uptime}, security ${report.score.weights.security}, speed ${report.score.weights.speed}, SSL & headers ${report.score.weights.publicChecks}`}>
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] items-center">
          <ScoreRing score={report.score.overall} />
          <ul className="space-y-2.5">
            {Object.entries(PART_LABELS).map(([k, label]) => {
              const [color, word] = tone(parts[k]);
              return (
                <li key={k} className="grid grid-cols-[1fr_auto] sm:grid-cols-[12rem_1fr_9rem] items-center gap-x-3 gap-y-1 text-sm">
                  <span className="text-ink-soft">{label}</span>
                  <span className={`sm:order-last text-right font-bold tabular-nums whitespace-nowrap ${color}`}>{parts[k] ?? '—'} <span className="font-semibold text-xs">{word}</span></span>
                  <span className="col-span-2 sm:col-span-1 h-2 rounded-full bg-brand-100 overflow-hidden">
                    {parts[k] != null && <span className={`block h-full rounded-full ${barColor(parts[k])}`} style={{ width: `${parts[k]}%` }} />}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="text-xs text-ink-muted mt-5">Parts marked &quot;not measured&quot; have no data for this period and are left out of the score, never counted as a pass.</p>
      </Section>

      <Section title="Uptime and response time" aside={`${u.checks.toLocaleString()} checks, one a minute`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-3 mb-6 break-inside-avoid">
          <Stat label="Uptime" value={u.percent == null ? '—' : `${u.percent}%`} />
          <Stat label="Downtime" value={fmtMinutes(u.downtimeMinutes)} sub={`${u.incidentCount} incident${u.incidentCount === 1 ? '' : 's'}`} />
          <Stat label="Avg response" value={u.avgResponseMs == null ? '—' : `${u.avgResponseMs} ms`} />
          <Stat label="Monitored days" value={u.daily.length} sub={`of ${report.period.days}`} />
        </div>
        <div className="space-y-6 break-inside-avoid">
          <UptimeStrip daily={u.daily} />
          <ResponseBars daily={u.daily} />
        </div>
        {u.longestIncidents.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="text-left text-xs font-bold text-ink-soft mb-2">Longest incidents</caption>
              <thead><tr className="text-left text-[11px] uppercase tracking-widest text-ink-muted"><th className="py-2 pr-4">Started</th><th className="py-2 pr-4">Duration</th><th className="py-2">Cause</th></tr></thead>
              <tbody className="divide-y divide-brand-100">
                {u.longestIncidents.map((i) => (
                  <tr key={i.startedAt}><td className="py-2 pr-4 whitespace-nowrap">{fmtDateTime(i.startedAt)}</td><td className="py-2 pr-4 whitespace-nowrap">{fmtMinutes(i.minutes)}{!i.endedAt && ' (ongoing)'}</td><td className="py-2 text-ink-soft">{i.message || i.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-5 lg:grid-cols-2 print:grid-cols-2">
        <Section title="Speed" aside={report.speed ? `PageSpeed ${report.speed.strategy}, ${fmtDate(report.speed.checkedAt)}` : null}>
          {report.speed ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Performance" value={report.speed.score ?? '—'} sub="out of 100" />
                <Stat label="Largest paint" value={report.speed.lcp || '—'} />
              </div>
              {report.speed.opportunities.length > 0 && (
                <ul className="mt-4 text-sm text-ink-soft list-disc pl-5 space-y-1">
                  {report.speed.opportunities.map((o) => <li key={o.title}>{o.title}{o.display ? ` (${o.display})` : ''}</li>)}
                </ul>
              )}
            </>
          ) : <p className="text-sm text-ink-muted">No PageSpeed run yet. Not measured.</p>}
        </Section>
        <Section title="SSL and security headers" aside={report.publicChecks ? fmtDate(report.publicChecks.checkedAt) : null}>
          {report.publicChecks ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="SSL Labs grade" value={report.publicChecks.sslGrade || '—'} sub={report.publicChecks.sslMessage} />
                <Stat label="Safe Browsing" value={report.publicChecks.malware === 'flagged' ? 'Listed' : report.publicChecks.malware === 'clean' ? 'Clean' : '—'} />
              </div>
              <p className="mt-4 text-sm text-ink-soft">
                {report.publicChecks.missingHeaders.length ? `Missing headers: ${report.publicChecks.missingHeaders.join(', ')}.` : 'All checked security headers are present.'}
              </p>
            </>
          ) : <p className="text-sm text-ink-muted">No public security check yet. Not measured.</p>}
        </Section>
      </div>

      <SecuritySection security={report.security} shared={report.shared} />

      <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted px-1">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Web Monitor and RuyaShield by Ruyalab</span>
        <span>Generated {fmtDateTime(report.generatedAt)}</span>
      </footer>
    </>
  );
};

const SiteReport = () => {
  const { siteId } = useParams();
  const { isPro } = useAuth();
  const [days, setDays] = useState(30);
  const [result, setResult] = useState({ key: null, report: null, error: '' });
  const key = `${siteId}:${days}`;

  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    let live = true;
    fetchSiteReport(siteId, days)
      .then((report) => live && setResult({ key, report, error: '' }))
      .catch((err) => live && setResult({ key, report: null, error: err.message }));
    return () => { live = false; };
  }, [siteId, days, key]);

  const loading = result.key !== key;
  const { report, error } = result.key === key ? result : { report: null, error: '' };

  const preview = Boolean(report?.preview);

  return (
    <div className="min-h-screen bg-canvas print:bg-white print:min-h-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5 print:p-0 print:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link to={`/app?site=${siteId}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline"><ArrowLeft size={16} /> Back to site</Link>
          {isPro && <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-white border border-brand-100 p-1" role="group" aria-label="Report period">
              {PERIODS.map((p) => (
                <button key={p} type="button" onClick={() => setDays(p)} aria-pressed={days === p}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${days === p ? 'bg-brand-600 text-white' : 'text-ink-soft hover:bg-brand-50'}`}>{p} days</button>
              ))}
            </div>
            <button type="button" onClick={() => window.print()} disabled={!report} className="btn-primary"><Download size={15} /> <span className="whitespace-nowrap">Download PDF</span></button>
          </div>}
        </div>

        <header className="bg-white rounded-3xl border border-brand-100 p-6 sm:p-8 print:border-0 print:p-0">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-brand-600">
            <Logo variant="brand" className="h-4" /> Site health report
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink mt-3">{report?.site.name || 'Loading…'}</h1>
          {report && (
            <p className="text-sm text-ink-muted mt-1">
              <span className="font-mono">{report.site.url}</span> · {fmtDate(report.period.from)} – {fmtDate(report.period.to)} ({report.period.days} days)
            </p>
          )}
        </header>

        {error && <p className="text-sm text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</p>}
        {loading && <p className="text-sm text-ink-muted">Building the report…</p>}

        {report && !loading && !preview && (
          <div className="grid gap-5 lg:grid-cols-2 print:hidden">
            <ReportSharePanel siteId={siteId} days={days} />
            <ReportEmailPanel siteId={siteId} />
          </div>
        )}
        {report && !loading && preview && <PreviewReport report={report} onUpgrade={() => setShowUpgrade(true)} />}

        {report && !loading && !preview && <FullReport report={report} />}
      </div>
      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
};

export default SiteReport;
