import React, { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  Activity, Gauge, Shield, Clock, RefreshCw, Settings, Trash2, BarChart3, ExternalLink, ArrowLeft,
  CheckCircle2, AlertTriangle, XCircle, CheckSquare, Search, Server, Lock, Zap, Sparkles,
} from 'lucide-react';
import AdvancedDashboard from '../AdvancedDashboard';
import LockedAdvanced from '../pro/LockedAdvanced';
import ApiService from '../../services/api';
import useMonitoringHistory from '../../hooks/useMonitoringHistory';
import { useAuth } from '../../contexts/AuthContext';
import PlatformIcon from '../PlatformIcon';
import { ScoreRing, MetricCard, MiniChip, KeyValue, Collapsible, SectionTitle } from './ui';
import {
  healthScore, scoreTone, statusTone, TONE, STATUS_LABEL, UP_STATUSES, formatMs, formatPercent, timeAgo, displayUrl, platformLabel,
} from '../../utils/siteMetrics';

const TABS = ['Overview', 'Performance', 'SEO', 'Security', 'History', 'Advanced'];
const INCIDENT_REFRESH_MS = 60000;

const percentOrNull = (value) => (typeof value === 'number' ? `${Math.round(value * 10) / 10}%` : null);

// ---------- Charts ----------
const LatencyChart = ({ data, height = 180 }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-[13px] text-ink-muted font-semibold" style={{ height }}>
        Collecting response-time history…
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="latencyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6C80E0" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#6C80E0" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E6EAFB" vertical={false} />
        <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: '#8A90B2', fontSize: 10, fontWeight: 700 }} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: '#8A90B2', fontSize: 10, fontWeight: 700 }} width={48} />
        <Tooltip
          formatter={(value) => [`${value.toLocaleString()} ms`, 'Avg response']}
          contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 12px 30px -12px rgba(70,83,174,.45)', fontWeight: 700, fontSize: 12 }}
        />
        <Area type="monotone" dataKey="response" stroke="#5868CF" strokeWidth={2.5} fill="url(#latencyFill)" dot={data.length < 3} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

// ---------- Right column ----------
const StatusCard = ({ site, availability }) => {
  const tone = statusTone(site.status);
  const styles = {
    good: { bg: 'from-emerald-300 to-good', shadow: 'shadow-good', Icon: CheckCircle2, title: 'All systems healthy' },
    warn: { bg: 'from-amber-300 to-warn', shadow: 'shadow-card', Icon: AlertTriangle, title: 'Needs attention' },
    bad: { bg: 'from-rose-400 to-bad', shadow: 'shadow-card', Icon: XCircle, title: site.status === 'offline' ? 'Site is offline' : 'Check failing' },
    muted: { bg: 'from-brand-300 to-brand-500', shadow: 'shadow-card', Icon: Clock, title: 'Waiting for first check' },
  }[tone];
  const detail = UP_STATUSES.includes(site.status)
    ? `Responded in ${formatMs(site.responseTime)} · ${formatPercent(availability)} of checks passed in 24h`
    : tone === 'muted'
      ? 'Checks run every minute; the first result will appear here shortly.'
      : (site.lastError || 'The latest check did not get a valid response from the site integration.');

  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 text-white bg-linear-to-br ${styles.bg} ${styles.shadow}`}>
      <div className="absolute -top-10 -right-8 w-32 h-32 rounded-full bg-white/15" />
      <div className="absolute -bottom-12 right-10 w-24 h-24 rounded-full bg-white/10" />
      <div className="relative flex gap-3">
        <styles.Icon size={30} strokeWidth={1.75} className="shrink-0" />
        <div>
          <div className="font-bold text-[15px]">{styles.title}</div>
          <div className="text-[12px] leading-snug text-white/85 mt-0.5">{detail}</div>
        </div>
      </div>
    </div>
  );
};

const ReviewColumn = ({ site, availability, recommendations, incidents }) => (
  <aside className="lg:pl-6 lg:border-l border-brand-100">
    <SectionTitle>Review</SectionTitle>
    <StatusCard site={site} availability={availability} />
    <div className="mt-5">
      <Collapsible title="Fix checklist" count={recommendations.length} defaultOpen>
        {recommendations.length === 0 ? (
          <p className="text-[13px] text-ink-muted">Nothing to fix right now.</p>
        ) : (
          <ul className="space-y-2">
            {recommendations.map(({ text, area }) => (
              <li key={`${area}-${text}`} className="flex gap-2.5 items-start text-[13px] text-ink-soft">
                <CheckSquare size={15} className="text-brand-500 mt-0.5 shrink-0" />
                <span>{text} <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">{area}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Collapsible>
      <Collapsible title="Incidents (30d)" count={incidents.length} defaultOpen={incidents.length > 0}>
        {incidents.length === 0 ? (
          <p className="text-[13px] text-ink-muted">No downtime recorded in the last 30 days.</p>
        ) : (
          <div className="space-y-2.5">
            {incidents.slice(0, 5).map((incident) => (
              <div key={incident._id} className="panel p-3 hover:shadow-card-hover transition-shadow">
                <div className="text-[13px] font-semibold text-ink line-clamp-2">{incident.message || STATUS_LABEL[incident.status]}</div>
                <div className="flex justify-between mt-2 text-[11px] font-semibold text-ink-muted">
                  <span className={incident.endedAt ? '' : 'text-bad'}>{incident.endedAt ? 'Resolved' : 'Ongoing'}</span>
                  <span>{new Date(incident.startedAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Collapsible>
    </div>
  </aside>
);

// ---------- Tabs ----------
const ChecksTable = ({ checks, limit }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-[13px]">
      <thead>
        <tr className="label-caps text-[10px]! text-left">
          <th className="py-2 font-bold">Time</th>
          <th className="py-2 font-bold">Status</th>
          <th className="py-2 font-bold text-right">Response</th>
          <th className="py-2 font-bold text-right">Code</th>
        </tr>
      </thead>
      <tbody>
        {checks.slice(0, limit).map((check) => {
          const tone = TONE[statusTone(check.status)];
          return (
            <tr key={check._id} className="border-t border-brand-100 hover:bg-brand-50/60 transition-colors">
              <td className="py-2.5 text-brand-700 font-semibold whitespace-nowrap">{new Date(check.timestamp).toLocaleTimeString()}</td>
              <td className="py-2.5">
                <span className={`inline-flex items-center gap-1.5 font-semibold ${tone.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                  {STATUS_LABEL[check.status]}
                </span>
                {check.error?.message && <div className="text-[11px] text-ink-muted truncate max-w-[260px]">{check.error.message}</div>}
              </td>
              <td className="py-2.5 text-right font-semibold text-ink tabular-nums">{UP_STATUSES.includes(check.status) ? formatMs(check.responseTime) : '--'}</td>
              <td className="py-2.5 text-right text-ink-soft tabular-nums">{check.statusCode || '--'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    {checks.length === 0 && <p className="text-[13px] text-ink-muted py-4">No checks recorded in the last 24 hours.</p>}
  </div>
);

const OverviewTab = ({ site, availability, checks, latencySeries }) => {
  const threshold = site.settings?.alertThresholds?.responseTime || 5000;
  const isUp = UP_STATUSES.includes(site.status);
  const speedProgress = isUp && site.responseTime != null ? Math.max(4, 100 - (site.responseTime / threshold) * 100) : null;
  const speedTone = !isUp ? 'bad' : site.responseTime == null ? 'muted' : site.responseTime < threshold * 0.4 ? 'good' : site.responseTime < threshold ? 'warn' : 'bad';
  const securityScore = site.security?.securityScore ?? null;

  return (
    <div className="space-y-7">
      <section>
        <SectionTitle>Overview</SectionTitle>
        <div className="grid sm:grid-cols-3 gap-4">
          <MetricCard
            icon={Activity} title="Availability" value={formatPercent(availability)} tone={availability == null ? 'muted' : availability >= 99 ? 'good' : availability >= 95 ? 'warn' : 'bad'}
            progress={availability}
            footer={<><MiniChip icon={CheckSquare}>{checks.length} checks</MiniChip><MiniChip>30d {formatPercent(site.uptime)}</MiniChip></>}
          >
            Checks passed in the last 24 hours.
          </MetricCard>
          <MetricCard
            icon={Zap} title="Speed" value={isUp ? formatMs(site.responseTime) : '--'} tone={speedTone} progress={speedProgress}
            footer={<MiniChip icon={Clock}>Alert at {threshold.toLocaleString()} ms</MiniChip>}
          >
            Round trip to the site on the latest check.
          </MetricCard>
          <MetricCard
            icon={Shield} title="Security" value={securityScore ?? '--'} tone={scoreTone(securityScore)} progress={securityScore}
            footer={<><MiniChip icon={Lock}>SSL {site.security?.sslStatus || 'unknown'}</MiniChip>{site.security?.outdatedPlugins != null && <MiniChip>{site.security.outdatedPlugins} outdated</MiniChip>}</>}
          >
            Based on SSL, plugins and security tooling.
          </MetricCard>
        </div>
      </section>

      <section>
        <SectionTitle>Site summary</SectionTitle>
        <div className="grid md:grid-cols-[1fr_1fr_1.2fr] gap-6 items-start">
          <div>
            <div className="label-caps mb-3">Site</div>
            <KeyValue rows={[
              ['Platform', site.platform],
              ['Version', site.security?.wordpressVersion || null],
              ['Active plugins', site.performance?.activePlugins ?? null],
              ['Content items', site.seo?.totalContent ?? null],
            ]} />
          </div>
          <div>
            <div className="label-caps mb-3">Server</div>
            <KeyValue rows={[
              ['CPU load', percentOrNull(site.performance?.cpuUsage)],
              ['Memory', percentOrNull(site.performance?.memoryUsage)],
              ['DB query', site.performance?.databaseQueryTime != null ? formatMs(site.performance.databaseQueryTime) : null],
              ['Processing', site.performance?.serverResponseTime != null ? formatMs(site.performance.serverResponseTime) : null],
            ]} />
          </div>
          <div className="panel p-3">
            <div className="label-caps mb-1 px-1">Response time · 24h</div>
            <LatencyChart data={latencySeries} height={130} />
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>Recent checks</SectionTitle>
        <ChecksTable checks={checks} limit={6} />
      </section>
    </div>
  );
};

const PerformanceTab = ({ site, latencySeries }) => {
  const perf = site.performance || {};
  return (
    <div className="space-y-7">
      <section>
        <SectionTitle>Response time · last 24 hours</SectionTitle>
        <div className="panel p-4"><LatencyChart data={latencySeries} height={260} /></div>
      </section>
      <section className="grid md:grid-cols-[auto_1fr] gap-8 items-center">
        <ScoreRing value={perf.performanceScore ?? null} tone={scoreTone(perf.performanceScore)} size={120} label="Perf score" />
        <div className="grid sm:grid-cols-2 gap-x-10">
          <KeyValue rows={[
            ['Round-trip response', formatMs(site.responseTime)],
            ['Server processing', perf.serverResponseTime != null ? formatMs(perf.serverResponseTime) : null],
            ['DB query time', perf.databaseQueryTime != null ? formatMs(perf.databaseQueryTime) : null],
          ]} />
          <KeyValue rows={[
            ['CPU load', percentOrNull(perf.cpuUsage)],
            ['Memory', percentOrNull(perf.memoryUsage)],
            ['Active plugins', perf.activePlugins ?? null],
          ]} />
        </div>
      </section>
    </div>
  );
};

const ScoreSection = ({ title, score, rows, items, itemsTitle, emptyText }) => (
  <div className="space-y-7">
    <section className="grid md:grid-cols-[auto_1fr] gap-8 items-center">
      <ScoreRing value={score ?? null} tone={scoreTone(score)} size={120} label={title} />
      <div className="grid sm:grid-cols-2 gap-x-10 gap-y-2.5">
        <KeyValue rows={rows.slice(0, Math.ceil(rows.length / 2))} />
        <KeyValue rows={rows.slice(Math.ceil(rows.length / 2))} />
      </div>
    </section>
    <section>
      <SectionTitle>{itemsTitle}</SectionTitle>
      {items.length === 0 ? <p className="text-[13px] text-ink-muted">{emptyText}</p> : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item} className="panel px-4 py-3 text-[13px] text-ink-soft flex gap-3 items-start hover:shadow-card-hover transition-shadow">
              <AlertTriangle size={15} className="text-warn mt-0.5 shrink-0" /> {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  </div>
);

const HistoryTab = ({ checks, incidents }) => (
  <div className="space-y-7">
    <section>
      <SectionTitle>Incidents · last 30 days</SectionTitle>
      {incidents.length === 0 ? <p className="text-[13px] text-ink-muted">No downtime recorded.</p> : (
        <div className="space-y-2">
          {incidents.map((incident) => (
            <div key={incident._id} className="panel px-4 py-3 flex items-center justify-between gap-4 text-[13px]">
              <span className="font-semibold text-ink truncate">{incident.message || STATUS_LABEL[incident.status]}</span>
              <span className="text-ink-muted whitespace-nowrap">
                {new Date(incident.startedAt).toLocaleString()} → {incident.endedAt ? new Date(incident.endedAt).toLocaleTimeString() : <span className="text-bad font-bold">ongoing</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
    <section>
      <SectionTitle>All checks · last 24 hours</SectionTitle>
      <ChecksTable checks={checks} limit={60} />
    </section>
  </div>
);

// ---------- Main ----------
const SiteDetail = ({ site, tab = 'Overview', onTabChange, onBack, onEdit, onDelete, onChanged }) => {
  const setTab = onTabChange;
  const [checking, setChecking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const { checks, latencySeries, availability } = useMonitoringHistory(site._id, 24);
  const { isPro } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const load = () => ApiService.getIncidents(site._id, 30)
      .then((data) => { if (!cancelled) setIncidents(Array.isArray(data) ? data : []); })
      .catch(() => {});
    load();
    const interval = setInterval(load, INCIDENT_REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [site._id]);

  const recommendations = useMemo(() => {
    const seen = new Set();
    return [
      ...(site.performance?.recommendations || []).map((text) => ({ text, area: 'performance' })),
      ...(site.seo?.recommendations || []).map((text) => ({ text, area: 'seo' })),
      ...(site.security?.recommendations || []).map((text) => ({ text, area: 'security' })),
    ].filter(({ text }) => !seen.has(text) && seen.add(text));
  }, [site]);

  const latestError = checks.find((c) => c.error?.message)?.error?.message;
  const score = healthScore(site);
  const isDown = site.status === 'error' || site.status === 'offline';

  const runCheck = async () => {
    setChecking(true);
    try {
      await ApiService.testWebsiteConnection(site._id);
      await onChanged?.();
    } finally {
      setChecking(false);
    }
  };

  const seo = site.seo || {};
  const sec = site.security || {};

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="px-6 lg:px-8 pt-6 lg:pt-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {onBack && (
              <button type="button" onClick={onBack} className="btn-ghost lg:hidden -ml-2" aria-label="Back to sites">
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl lg:text-[28px] font-semibold text-ink tracking-tight truncate">{site.name}</h1>
                <span className="chip bg-brand-50 text-ink tabular-nums">{isDown ? '--' : formatMs(site.responseTime)}</span>
                <span className={`chip ${TONE[isDown ? 'bad' : scoreTone(score)].bg} ${TONE[isDown ? 'bad' : scoreTone(score)].text} tabular-nums`}>
                  {isDown ? STATUS_LABEL[site.status] : score ?? '--'}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[12px] font-semibold text-ink-muted flex-wrap">
                <a href={site.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-brand-600 transition-colors">
                  {displayUrl(site.url)} <ExternalLink size={11} />
                </a>
                <span className="flex items-center gap-1"><Clock size={12} /> Checked {timeAgo(site.lastChecked)}</span>
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${TONE[statusTone(site.status)].dot} animate-pulse`} /> Live · every 60s
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button type="button" onClick={runCheck} disabled={checking} className="btn-primary mr-2">
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} /> {checking ? 'Checking…' : 'Run check'}
            </button>
            <span className="hidden sm:block w-px h-7 bg-brand-100 mx-1" />
            <button type="button" onClick={() => setTab('Advanced')} className="btn-ghost relative" title="Advanced analytics (Pro)">
              <BarChart3 size={18} />
              {!isPro && <span className="absolute -top-1 -right-1 px-1 rounded bg-brand-600 text-white text-[8px] font-extrabold tracking-wider">PRO</span>}
            </button>
            <button type="button" onClick={() => onEdit(site)} className="btn-ghost" title="Edit settings"><Settings size={18} /></button>
            {confirmDelete ? (
              <span className="flex items-center gap-1 animate-fade-in">
                <button type="button" onClick={() => onDelete(site)} className="px-3 h-9 rounded-lg bg-bad text-white text-[11px] font-bold uppercase tracking-wider">Delete</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="px-3 h-9 rounded-lg text-ink-soft text-[11px] font-bold uppercase tracking-wider hover:bg-brand-50">Cancel</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="btn-ghost hover:text-bad! hover:bg-bad-soft!" title="Remove site"><Trash2 size={18} /></button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex gap-7 mt-6 border-b border-brand-100 overflow-x-auto scrollbar-hide">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              className={`relative pb-3 text-[12px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors flex items-center gap-1.5
                ${tab === name ? 'text-brand-600' : 'text-ink-muted hover:text-ink'}`}
            >
              {name === 'Advanced' && <Sparkles size={13} className="text-brand-500" />}
              {name}
              {name === 'Advanced' && !isPro && (
                <span className="relative ml-0.5 px-1.5 py-px rounded-md bg-linear-to-r from-brand-500 to-brand-700 text-white text-[9px] font-extrabold tracking-wider">
                  PRO
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-warn animate-ping" />
                </span>
              )}
              <span className={`absolute left-0 right-0 -bottom-px h-[3px] rounded-full bg-brand-600 transition-transform duration-300 origin-center ${tab === name ? 'scale-x-100' : 'scale-x-0'}`} />
            </button>
          ))}
        </nav>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto soft-scroll">
        {tab === 'Advanced' ? (
          <div key={tab} className="px-6 lg:px-8 py-6 animate-fade-in">
            {isPro ? <AdvancedDashboard selectedWebsite={site} /> : <LockedAdvanced siteName={site.name} />}
          </div>
        ) : (
        <div key={tab} className="px-6 lg:px-8 py-6 grid lg:grid-cols-[1fr_290px] gap-8 animate-fade-in">
          <div className="min-w-0">
            {tab === 'Overview' && <OverviewTab site={site} availability={availability} checks={checks} latencySeries={latencySeries} />}
            {tab === 'Performance' && <PerformanceTab site={site} latencySeries={latencySeries} />}
            {tab === 'SEO' && (
              <ScoreSection
                title="SEO score" score={seo.score}
                rows={[
                  ['Site title', seo.siteTitle || null], ['Description', seo.siteDescription || 'Missing'],
                  ['Meta tags', seo.metaTags], ['Headings', seo.headingStructure?.replace(/_/g, ' ')],
                  ['Internal links', seo.internalLinks], ['External links', seo.externalLinks],
                  ['Images with alt', seo.altTags], ['SSL', seo.sslEnabled ? 'Enabled' : 'Disabled'],
                ]}
                itemsTitle={`Issues (${seo.seoIssues?.length || 0})`} items={seo.seoIssues || []} emptyText="No SEO issues reported."
              />
            )}
            {tab === 'Security' && (
              <ScoreSection
                title="Security" score={sec.securityScore}
                rows={[
                  ['SSL', sec.sslStatus], ['Firewall', sec.firewall], ['Vulnerability scan', sec.vulnerabilityScan?.replace(/_/g, ' ')],
                  ['Malware scan', sec.malwareScan?.replace(/_/g, ' ')], ['Platform version', sec.wordpressVersion || null],
                  ['Plugins', sec.totalPlugins], ['Outdated plugins', sec.outdatedPlugins], ['Security plugins', sec.securityPlugins],
                ]}
                itemsTitle="Recommendations" items={sec.recommendations || []} emptyText="No security recommendations."
              />
            )}
            {tab === 'History' && <HistoryTab checks={checks} incidents={incidents} />}
          </div>
          <ReviewColumn site={{ ...site, lastError: latestError }} availability={availability} recommendations={recommendations} incidents={incidents} />
        </div>
        )}
      </div>

      {/* Footer */}
      <footer className="px-6 lg:px-8 py-3.5 border-t border-brand-100 flex items-center justify-between gap-4 text-[12px] bg-white/80">
        <div className="flex items-center gap-6 min-w-0">
          <span className="flex items-center gap-2 min-w-0">
            <span className="label-caps text-ink!">Platform</span>
            <PlatformIcon platform={site.platform} className="w-4 h-4" />
            <span className="text-ink-soft">{platformLabel(site.platform)}</span>
          </span>
          <span className="hidden md:flex items-center gap-2">
            <span className="label-caps text-ink!">Uptime 30d</span>
            <span className="text-ink-soft">{formatPercent(site.uptime)}</span>
          </span>
          <span className="hidden md:flex items-center gap-2">
            <Search size={12} className="text-ink-muted" /><span className="label-caps text-ink!">SEO</span>
            <span className="text-ink-soft">{seo.score ?? '--'}</span>
          </span>
          <span className="hidden xl:flex items-center gap-2">
            <Server size={12} className="text-ink-muted" /><span className="label-caps text-ink!">Checks 24h</span>
            <span className="text-ink-soft">{checks.length}</span>
          </span>
        </div>
        <span className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${TONE[statusTone(site.status)].bg} ${TONE[statusTone(site.status)].text}`}>
          ● {STATUS_LABEL[site.status] || 'Unknown'}
        </span>
      </footer>
    </div>
  );
};

export default SiteDetail;
