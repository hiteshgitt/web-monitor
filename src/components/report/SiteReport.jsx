import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Download, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';
import UpgradeModal from '../pro/UpgradeModal';
import ReportSharePanel from './ReportSharePanel';
import ReportEmailPanel from './ReportEmailPanel';
import { REPORT_UPGRADE } from './reportUpgrade';
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

// `page`: in the PDF this section starts on a new page.
const Section = ({ title, aside, children, page = false, id }) => (
  <section id={id} className={`bg-white rounded-3xl border border-brand-100 p-6 sm:p-8 print:rounded-none print:border-0 print:px-0 ${page ? 'print:break-before-page' : 'print:border-t'}`}>
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

// Release Radar for this site: security releases in the period with their status and time to patch, and what is
// still vulnerable now (runtime and packages). Shown only when there is something to say.
const STATE_LABEL = { affected: 'Action needed', patched: 'Patched', not_exposed: 'Not exposed' };
const STATE_STYLE = { affected: 'bg-rose-50 text-rose-700', patched: 'bg-emerald-50 text-emerald-700', not_exposed: 'bg-brand-50 text-brand-700' };
const PatchingSection = ({ patching }) => {
  if (!patching || (!patching.advisories.length && !patching.runtime.length && !patching.packages.length)) return null;
  return (
    <Section title="Security releases and patching" aside={patching.medianHoursToPatch != null ? `Median time to patch: ${patching.medianHoursToPatch} h` : null}>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Patched in period" value={patching.patchedCount} />
        <Stat label="Still open" value={patching.openCount + patching.runtime.length} />
        <Stat label="Vulnerable packages" value={patching.packages.length} sub={patching.packagesCheckedAt ? `checked ${fmtDate(patching.packagesCheckedAt)}` : null} />
      </div>
      {patching.advisories.length > 0 && (
        <ul className="mt-4 divide-y divide-brand-100 rounded-xl border border-brand-100">
          {patching.advisories.map((a, i) => (
            <li key={`${a.title}-${i}`} className="px-4 py-2.5 text-sm flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="font-semibold text-ink">{a.title}</span>
                <span className="block text-[12px] text-ink-muted">{a.component} {a.version}{a.state === 'affected' && a.target ? ` → ${a.target}` : ''}{a.cves.length ? ` · ${a.cves.join(', ')}` : ''} · flagged {fmtDate(a.flaggedAt)}</span>
              </span>
              <span className="flex items-center gap-2 text-[12px]">
                {a.hoursToPatch != null && <span className="text-ink-muted">patched in {a.hoursToPatch} h</span>}
                <span className={`px-2 py-0.5 rounded-md font-bold ${STATE_STYLE[a.state] || ''}`}>{a.state === 'patched' && !a.patchedAt ? 'Up to date' : STATE_LABEL[a.state] || a.state}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {(patching.runtime.length > 0 || patching.packages.length > 0) && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {patching.runtime.map((r) => <li key={r.key} className="text-ink"><span className="font-semibold">{r.component} {r.version}:</span> {r.title}. {r.fix}</li>)}
          {patching.packages.map((p) => <li key={`${p.name}@${p.version}`} className="text-ink"><span className="font-semibold">{p.name} {p.version}</span> ({p.severity}{p.cve ? `, ${p.cve}` : ''}){p.fixed ? ` → update to ${p.fixed}` : ''}</li>)}
        </ul>
      )}
    </Section>
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


const PRIORITY_STYLE = {
  critical: 'bg-rose-50 text-rose-700',
  high: 'bg-orange-50 text-orange-700',
  medium: 'bg-amber-50 text-amber-800',
  low: 'bg-sky-50 text-sky-700',
};
const VITAL_LABEL = { lcp: 'Largest Contentful Paint', fcp: 'First Contentful Paint', cls: 'Cumulative Layout Shift', tbt: 'Total Blocking Time', inp: 'Interaction to Next Paint', speedIndex: 'Speed Index' };
const VITAL_STATUS = { good: ['text-good', 'Good'], 'needs-improvement': ['text-warn', 'Needs improvement'], poor: ['text-bad', 'Poor'] };
const fmtBytes = (b) => (b == null ? '—' : b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);
const fmtP75 = (key, v) => (key === 'cls' ? v.toFixed(2) : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);

const Table = ({ head, rows, caption }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      {caption && <caption className="text-left text-xs font-bold text-ink-soft mb-2">{caption}</caption>}
      <thead><tr className="text-left text-[11px] uppercase tracking-widest text-ink-muted">{head.map((h) => <th key={h} className="py-2 pr-4 font-bold">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-brand-100">
        {rows.map((r, i) => <tr key={i} className="break-inside-avoid">{r.map((c, j) => <td key={j} className="py-2 pr-4 align-top">{c}</td>)}</tr>)}
      </tbody>
    </table>
  </div>
);

const NotMeasured = ({ children }) => <p className="text-sm text-ink-muted">{children} Not measured.</p>;

const ActionPlan = ({ items }) => (
  items.length === 0
    ? <p className="text-sm text-ink-soft">No problems found in the measured areas for this period.</p>
    : (
      <ol className="space-y-2">
        {items.map((a, i) => (
          <li key={i} className="flex gap-3 items-start text-sm break-inside-avoid">
            <span className="w-6 shrink-0 text-right font-extrabold text-ink-muted tabular-nums">{i + 1}.</span>
            <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${PRIORITY_STYLE[a.priority]}`}>{a.priority}</span>
            <span><span className="font-bold text-ink">{a.area}:</span> <span className="text-ink-soft">{a.text}</span></span>
          </li>
        ))}
      </ol>
    )
);

const LabCard = ({ lab, label }) => (
  <div className="rounded-2xl border border-brand-100 p-4 break-inside-avoid">
    <div className="flex items-baseline justify-between">
      <h3 className="text-sm font-extrabold text-ink">{label}</h3>
      <span className="text-2xl font-extrabold tabular-nums text-ink">{lab.score ?? '—'}<span className="text-xs text-ink-muted font-semibold"> / 100</span></span>
    </div>
    <ul className="mt-3 space-y-1.5 text-sm">
      {lab.metrics.map((m) => {
        const [color, word] = VITAL_STATUS[m.status] || ['text-ink-muted', ''];
        return (
          <li key={m.key} className="flex justify-between gap-3">
            <span className="text-ink-soft">{VITAL_LABEL[m.key] || m.key}</span>
            <span className="font-bold tabular-nums text-ink whitespace-nowrap">{m.display || '—'} {word && <span className={`text-xs font-semibold ${color}`}>{word}</span>}</span>
          </li>
        );
      })}
    </ul>
    {lab.opportunities.length > 0 && (
      <ul className="mt-3 pt-3 border-t border-brand-100 text-xs text-ink-soft list-disc pl-4 space-y-1">
        {lab.opportunities.map((o) => <li key={o.title}>{o.title}{o.display ? ` (${o.display})` : ''}</li>)}
      </ul>
    )}
  </div>
);

const FieldCard = ({ field, label }) => (
  <div className="rounded-2xl bg-canvas p-4 break-inside-avoid print:bg-white print:border print:border-brand-100">
    <h3 className="text-sm font-extrabold text-ink">{label}</h3>
    {field.period && <p className="text-[11px] text-ink-muted">{field.period}</p>}
    <ul className="mt-2 space-y-1.5 text-sm">
      {field.metrics.map((m) => {
        const [color, word] = VITAL_STATUS[m.status] || ['text-ink-muted', ''];
        return (
          <li key={m.key} className="flex justify-between gap-3">
            <span className="text-ink-soft">{VITAL_LABEL[m.key]}</span>
            <span className="font-bold tabular-nums text-ink whitespace-nowrap">{fmtP75(m.key, m.p75)} <span className={`text-xs font-semibold ${color}`}>{word}</span></span>
          </li>
        );
      })}
    </ul>
  </div>
);

// The detailed report (Pro owner, or a client opening a shared link). In the PDF each part starts on its own page.
export const FullReport = ({ report }) => {
  const parts = report.score.parts;
  const u = report.uptime;
  const sp = report.speed;
  const pc = report.publicChecks;
  const sh = report.siteHealth;
  const seo = report.seo;
  const sec = report.security;
  return (
    <>
      <Section title="Overall health" aside={`Weights: uptime ${report.score.weights.uptime}, security ${report.score.weights.security}, speed ${report.score.weights.speed}, SSL & headers ${report.score.weights.publicChecks}`}>
        <div className="grid gap-6 print:grid-cols-[auto_1fr] items-center">
          {/* On screen the hero shows the score; the PDF shows it here. */}
          <div className="hidden print:block"><ScoreRing score={report.score.overall} /></div>
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
        <div className="grid grid-cols-2 lg:grid-cols-3 print:grid-cols-3 gap-3 mt-6">
          <Stat label="Uptime" value={u.percent == null ? '—' : `${u.percent}%`} sub={`${u.incidentCount} incident${u.incidentCount === 1 ? '' : 's'}`} />
          <Stat label="Downtime" value={fmtMinutes(u.downtimeMinutes)} />
          <Stat label="Avg response" value={u.avgResponseMs == null ? '—' : `${u.avgResponseMs} ms`} />
          <Stat label="Mobile speed" value={sp?.lab?.mobile?.score ?? '—'} sub="PageSpeed, out of 100" />
          <Stat label="SSL grade" value={pc?.sslGrade || '—'} sub={pc?.malware === 'flagged' ? 'Listed by Safe Browsing' : pc?.malware === 'clean' ? 'Safe Browsing: clean' : null} />
          <Stat label="Open findings" value={sec.open && sec.lastAssessment ? sec.openTotal : '—'} sub={sec.open && sec.lastAssessment ? `${sec.open.critical} critical · ${sec.open.high} high` : 'RuyaShield'} />
        </div>
        <p className="text-xs text-ink-muted mt-5">Parts marked &quot;not measured&quot; have no data for this period and are left out of the score, never counted as a pass.</p>
      </Section>

      <Section title="What to fix first" aside={`${report.actionPlan.length} item${report.actionPlan.length === 1 ? '' : 's'}`}>
        <ActionPlan items={report.actionPlan} />
      </Section>

      <Section page title="Uptime and response time" aside={`${u.checks.toLocaleString()} checks, one a minute`}>
        <div className="space-y-6 break-inside-avoid">
          <UptimeStrip daily={u.daily} />
          <ResponseBars daily={u.daily} />
        </div>
        {u.incidents.length > 0 ? (
          <div className="mt-6">
            <Table caption={`Incidents (${u.incidentCount}${u.incidentCount > u.incidents.length ? `, latest ${u.incidents.length} shown` : ''})`} head={['Started', 'Ended', 'Duration', 'Cause']}
              rows={u.incidents.map((i) => [fmtDateTime(i.startedAt), i.endedAt ? fmtDateTime(i.endedAt) : 'Ongoing', fmtMinutes(i.minutes), (
                <span className="text-ink-soft">
                  {i.component && <span className="block text-[10px] font-extrabold uppercase tracking-wider text-bad">{i.component}</span>}
                  {i.cause ? (i.message || '').split(': ')[0] : (i.message || i.status)}
                </span>
              )])} />
          </div>
        ) : <p className="mt-6 text-sm text-ink-soft">No downtime incidents in this period.</p>}
        {u.daily.length > 0 && (
          <div className="mt-6">
            <Table caption="Day by day" head={['Day', 'Uptime', 'Avg response']}
              rows={[...u.daily].reverse().map((d) => [d.day, d.uptime == null ? '—' : `${d.uptime}%`, d.avgResponseMs == null ? '—' : `${d.avgResponseMs} ms`])} />
          </div>
        )}
      </Section>

      <Section page title="Speed" aside={sp ? `PageSpeed Insights, ${fmtDate(sp.checkedAt)}` : null}>
        {sp ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
              {sp.lab.mobile && <LabCard lab={sp.lab.mobile} label="Mobile (lab test)" />}
              {sp.lab.desktop && <LabCard lab={sp.lab.desktop} label="Desktop (lab test)" />}
            </div>
            <h3 className="text-sm font-extrabold text-ink mt-6">Real visitors (Chrome UX Report, 75th percentile)</h3>
            {sp.field.phone || sp.field.desktop ? (
              <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2 mt-3">
                {sp.field.phone && <FieldCard field={sp.field.phone} label="Phones" />}
                {sp.field.desktop && <FieldCard field={sp.field.desktop} label="Desktops" />}
              </div>
            ) : <p className="text-sm text-ink-muted mt-2">{sp.field.message || 'No real-visitor data for this site yet.'}</p>}
          </>
        ) : <NotMeasured>No PageSpeed run yet.</NotMeasured>}
      </Section>

      <Section title="Security" aside={pc ? `Public checks, ${fmtDate(pc.checkedAt)}` : null}>
        {pc ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 print:grid-cols-3 gap-3">
              <Stat label="SSL Labs grade" value={pc.sslGrade || '—'} sub={pc.sslMessage} />
              <Stat label="Safe Browsing" value={pc.malware === 'flagged' ? 'Listed' : pc.malware === 'clean' ? 'Clean' : '—'} sub={pc.threats.length ? pc.threats.join(', ') : null} />
              <Stat label="Security headers" value={pc.headersChecked == null ? '—' : `${pc.headersChecked - pc.missingHeaders.length} / ${pc.headersChecked}`} sub="present" />
            </div>
            <p className="mt-4 text-sm text-ink-soft">
              {pc.missingHeaders.length ? <>Missing: <span className="font-semibold text-ink">{pc.missingHeaders.join(', ')}</span>.</> : 'All checked security headers are present.'}
            </p>
          </>
        ) : <NotMeasured>No public security check yet.</NotMeasured>}
      </Section>

      <SecuritySection security={sec} shared={report.shared} />

      <PatchingSection patching={report.patching} />

      <Section page title="Site health" aside={sh?.checkedAt ? `Reported by the site, ${fmtDateTime(sh.checkedAt)}` : null}>
        {sh ? (
          <div className="grid gap-5 md:grid-cols-2 print:grid-cols-2">
            <div className="break-inside-avoid">
              <h3 className="text-sm font-extrabold text-ink mb-2">Platform</h3>
              <Table head={['Component', 'Version']} rows={[['Platform', sh.platform], ...sh.versions.map((v) => [v.name, v.version])]} />
              {sh.plugins && (
                <p className="text-sm text-ink-soft mt-3">
                  {sh.plugins.total ?? '—'} plugins or packages, <span className={sh.plugins.outdated ? 'font-bold text-bad' : ''}>{sh.plugins.outdated ?? 0} outdated</span>, {sh.plugins.security ?? 0} security plugin{sh.plugins.security === 1 ? '' : 's'}{sh.firewall && sh.firewall !== 'none' ? `, firewall: ${sh.firewall}` : ''}.
                </p>
              )}
            </div>
            {sh.server && (
              <div className="break-inside-avoid">
                <h3 className="text-sm font-extrabold text-ink mb-2">Server</h3>
                <Table head={['Measure', 'Value']} rows={[
                  ['Performance score', sh.server.performanceScore ?? '—'],
                  ['Page load (server side)', sh.server.loadTime == null ? '—' : `${sh.server.loadTime} ms`],
                  ['Server response', sh.server.serverResponseTime == null ? '—' : `${sh.server.serverResponseTime} ms`],
                  ['Database queries', sh.server.databaseQueryTime == null ? '—' : `${sh.server.databaseQueryTime} ms`],
                  ['CPU load', sh.server.cpuUsage ?? '—'],
                  ['Memory', sh.server.memoryUsage ?? '—'],
                  ['Disk free', sh.server.diskTotalBytes ? `${fmtBytes(sh.server.diskFreeBytes)} of ${fmtBytes(sh.server.diskTotalBytes)}` : '—'],
                ]} />
              </div>
            )}
          </div>
        ) : <NotMeasured>The site&apos;s integration has not reported health details yet.</NotMeasured>}
      </Section>

      <Section title="SEO" aside={seo?.score != null ? `Score ${seo.score} / 100` : null}>
        {seo ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-3">
              <Stat label="Meta tags" value={seo.metaTags || '—'} />
              <Stat label="Headings" value={seo.headingStructure || '—'} />
              <Stat label="Images without alt" value={seo.missingAltTags ?? '—'} />
              <Stat label="Content items" value={seo.totalContent ?? '—'} sub={seo.internalLinks != null ? `${seo.internalLinks} internal · ${seo.externalLinks ?? 0} external links` : null} />
            </div>
            {seo.siteTitle && <p className="mt-4 text-sm text-ink-soft"><span className="font-bold text-ink">Title:</span> {seo.siteTitle}</p>}
            {seo.siteDescription && <p className="mt-1 text-sm text-ink-soft"><span className="font-bold text-ink">Description:</span> {seo.siteDescription}</p>}
            {seo.issues.length > 0 && (
              <ul className="mt-4 text-sm text-ink-soft list-disc pl-5 space-y-1">{seo.issues.map((t) => <li key={t}>{t}</li>)}</ul>
            )}
          </>
        ) : <NotMeasured>The site&apos;s integration has not reported SEO details yet.</NotMeasured>}
      </Section>

      {report.recommendations.length > 0 && (
        <Section title="Recommendations from the site">
          <Table head={['Area', 'Recommendation']} rows={report.recommendations.map((r) => [<span className="font-bold text-ink whitespace-nowrap">{r.area}</span>, <span className="text-ink-soft">{r.text}</span>])} />
        </Section>
      )}

      <Section title="How this report is measured">
        <ul className="text-xs text-ink-soft list-disc pl-5 space-y-1">
          <li>Uptime and response time come from Web Monitor checking the site once a minute from its own servers.</li>
          <li>Speed comes from Google PageSpeed Insights (lab test) and the Chrome UX Report (real visitors), refreshed weekly.</li>
          <li>SSL grade from Qualys SSL Labs, blocklist status from Google Safe Browsing, headers from a request to the home page.</li>
          <li>Security findings come from RuyaShield assessments of verified sites. Only counts and titles are included, never evidence.</li>
          <li>Site health and SEO are reported by the Web Monitor integration installed on the site.</li>
          <li>Anything without data is shown as &quot;not measured&quot;. This report is not a certification.</li>
        </ul>
      </Section>

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
  const [showUpgrade, setShowUpgrade] = useState(!isPro);
  // Desktop: actions in a sticky sidebar. Phones: period and PDF first, sharing and email after the report.
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const key = `${siteId}:${days}`;

  useEffect(() => {
    if (!isPro) return undefined;
    let live = true;
    fetchSiteReport(siteId, days)
      .then((report) => live && setResult({ key, report, error: '' }))
      .catch((err) => live && setResult({ key, report: null, error: err.message }));
    return () => { live = false; };
  }, [siteId, days, key, isPro]);

  if (!isPro) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-brand-100 p-8 max-w-md text-center">
          <h1 className="text-xl font-extrabold text-ink">{REPORT_UPGRADE.title}</h1>
          <p className="text-sm text-ink-soft mt-2">{REPORT_UPGRADE.text}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => setShowUpgrade(true)} className="btn-primary"><Sparkles size={15} /> Upgrade to Pro</button>
            <Link to={`/app?site=${siteId}`} className="btn-ghost">Back to site</Link>
          </div>
        </div>
        <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} feature={REPORT_UPGRADE} />
      </div>
    );
  }

  const loading = result.key !== key;
  const { report, error } = result.key === key ? result : { report: null, error: '' };

  const periodCard = (
    <section className="bg-white rounded-3xl border border-brand-100 p-5 shadow-card">
      <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-ink-muted">Report period</h2>
      <div className="mt-3 grid grid-cols-3 rounded-xl bg-canvas p-1" role="group" aria-label="Report period">
        {PERIODS.map((p) => (
          <button key={p} type="button" onClick={() => setDays(p)} aria-pressed={days === p}
            className={`py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${days === p ? 'bg-white text-brand-700 shadow-card' : 'text-ink-soft hover:text-ink'}`}>{p} days</button>
        ))}
      </div>
      <button type="button" onClick={() => window.print()} disabled={!report || loading} className="btn-primary w-full justify-center mt-4"><Download size={15} /> <span className="whitespace-nowrap">Download PDF</span></button>
      <p className="text-[11px] text-ink-muted mt-2 text-center">Choose &quot;Save as PDF&quot; in the print window.</p>
    </section>
  );

  return (
    <div className="min-h-screen bg-canvas print:bg-white print:min-h-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5 print:p-0 print:space-y-4">
        <Link to={`/app?site=${siteId}`} className="print:hidden inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline"><ArrowLeft size={16} /> Back to site</Link>

        <ReportHeader report={report} />

        {error && <p className="text-sm text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</p>}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] items-start">
          {isDesktop ? (
            <aside className="space-y-4 sticky top-6 order-last print:hidden">
              {periodCard}
              <ReportSharePanel siteId={siteId} days={days} />
              <ReportEmailPanel siteId={siteId} />
            </aside>
          ) : <div className="print:hidden">{periodCard}</div>}

          <main className="space-y-5 min-w-0 print:space-y-4">
            {loading && (
              <div className="bg-white rounded-3xl border border-brand-100 p-8 text-sm text-ink-muted animate-pulse">Building the report…</div>
            )}
            {report && !loading && <FullReport report={report} />}
          </main>

          {!isDesktop && (
            <div className="space-y-4 print:hidden">
              <ReportSharePanel siteId={siteId} days={days} />
              <ReportEmailPanel siteId={siteId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Cover: a brand hero with the score on screen; a plain title block in the PDF.
export const ReportHeader = ({ report }) => {
  const score = report?.score.overall ?? null;
  const [, word] = tone(score);
  const ring = score == null ? '#b9bdd4' : score >= 90 ? '#3cc48c' : score >= 70 ? '#e3b23c' : '#e5536a';
  const r = 46;
  const c = 2 * Math.PI * r;
  const u = report?.uptime;
  return (
    <>
      <header className="print:hidden relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-900 via-brand-700 to-brand-400 text-white px-6 sm:px-10 py-8 sm:py-10 shadow-frame">
        <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="absolute -bottom-28 left-1/3 w-96 h-60 rounded-full bg-brand-300/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/75">
              <Logo variant="white" className="h-4" /> Site health report
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold mt-4 tracking-tight truncate">{report?.site.name || 'Loading…'}</h1>
            {report && (
              <>
                <p className="text-sm text-white/75 mt-2 font-mono truncate">{report.site.url}</p>
                <div className="flex flex-wrap gap-2 mt-5">
                  <span className="px-3 py-1.5 rounded-full bg-white/15 text-xs font-bold">{fmtDate(report.period.from)} – {fmtDate(report.period.to)}</span>
                  <span className="px-3 py-1.5 rounded-full bg-white/15 text-xs font-bold">Uptime {u.percent == null ? '—' : `${u.percent}%`}</span>
                  <span className="px-3 py-1.5 rounded-full bg-white/15 text-xs font-bold">{u.incidentCount} incident{u.incidentCount === 1 ? '' : 's'}</span>
                  <span className="px-3 py-1.5 rounded-full bg-white/15 text-xs font-bold">{report.actionPlan.length} to fix</span>
                </div>
              </>
            )}
          </div>
          {report && (
            <div className="shrink-0 self-start sm:self-center flex flex-col items-center">
              <div className="relative w-32 h-32 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
                <svg viewBox="0 0 108 108" className="absolute inset-0 w-full h-full" aria-hidden="true">
                  <circle cx="54" cy="54" r={r} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="8" />
                  {score != null && <circle cx="54" cy="54" r={r} fill="none" stroke={ring} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 54 54)" />}
                </svg>
                <div className="text-center" role="img" aria-label={score == null ? 'Health score not measured' : `Health score ${score} of 100, ${word}`}>
                  <div className="text-4xl font-extrabold tabular-nums leading-none">{score ?? '—'}</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/70 mt-1">of 100</div>
                </div>
              </div>
              <span className="mt-2 text-xs font-bold text-white/85">{word}</span>
            </div>
          )}
        </div>
      </header>

      <header className="hidden print:block pb-4 border-b-2 border-brand-600">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-brand-600">
          <Logo variant="brand" className="h-4" /> Site health report
        </div>
        <h1 className="text-3xl font-extrabold text-ink mt-3">{report?.site.name}</h1>
        {report && (
          <p className="text-sm text-ink-muted mt-1">
            <span className="font-mono">{report.site.url}</span> · {fmtDate(report.period.from)} – {fmtDate(report.period.to)} ({report.period.days} days) · prepared {fmtDate(report.generatedAt)}
          </p>
        )}
      </header>
    </>
  );
};

export default SiteReport;
