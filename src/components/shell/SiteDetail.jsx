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
  healthScore, scoreTone, statusTone, TONE, STATUS_LABEL, UP_STATUSES, formatMs, formatPercent, formatSpan, timeAgo, displayUrl, platformLabel,
  incidentForAlert, slowStretch, runtimeRows,
} from '../../utils/siteMetrics';

const TABS = ['Overview', 'Performance', 'SEO', 'Security', 'History', 'Advanced'];
const INCIDENT_REFRESH_MS = 60000;

const percentOrNull = (value) => (typeof value === 'number' && value >= 0 && value <= 100 ? `${Math.round(value * 10) / 10}%` : null);

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
                  <span className={incident.endedAt ? '' : 'text-bad'}>
                    {incident.endedAt ? 'Resolved' : 'Ongoing'} · down for {formatSpan(incident.startedAt, incident.endedAt)}
                  </span>
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
const when = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

const ALERT_KIND = {
  site_down: 'Site down',
  site_up: 'Site recovered',
  slow: 'Slow response',
  slow_ok: 'Speed recovered',
  plugins: 'Plugin / package updates',
  ssl_off: 'SSL problem',
  ssl_ok: 'SSL recovered',
  security_low: 'Security score',
};

const AlertContext = ({ focus, incidents, incidentsLoaded, checks, checksLoaded, threshold, onDismiss }) => {
  if (!focus) return null;
  const downtime = focus.type === 'site_down' || focus.type === 'site_up';
  const speed = focus.type === 'slow' || focus.type === 'slow_ok';
  const incident = downtime ? incidentForAlert(incidents, focus) : null;
  const stretch = speed ? slowStretch(checks, focus, threshold) : null;
  const reason = incident?.message || focus.body || 'No extra detail was stored with this alert.';

  return (
    <section id="alert-context" className="panel p-5 border-brand-200 bg-linear-to-br from-brand-50 to-white shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label-caps mb-1 text-brand-700!">Alert detail</div>
          <h3 className="text-[17px] font-extrabold text-ink tracking-tight">{focus.title || ALERT_KIND[focus.type] || 'Alert'}</h3>
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="btn-ghost shrink-0 text-ink-muted" aria-label="Dismiss alert detail">
            <XCircle size={18} />
          </button>
        )}
      </div>

      <dl className="mt-4 grid sm:grid-cols-3 gap-x-6 gap-y-3 text-[13px]">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">What</dt>
          <dd className="text-ink font-semibold mt-0.5">{ALERT_KIND[focus.type] || focus.type || 'Alert'}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">When</dt>
          <dd className="text-ink font-semibold mt-0.5">{focus.createdAt ? when(focus.createdAt) : '—'}</dd>
        </div>
        <div className="sm:col-span-1">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Why</dt>
          <dd className="text-ink font-semibold mt-0.5 break-words">{reason}</dd>
        </div>
      </dl>

      {downtime && !incidentsLoaded && <p className="text-[13px] text-ink-muted mt-3">Loading this outage…</p>}
      {downtime && incidentsLoaded && incident && (
        <dl className="mt-4 pt-4 border-t border-brand-100 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Down for</dt>
            <dd className="text-ink font-semibold mt-0.5">
              {formatSpan(incident.startedAt, incident.endedAt)}{incident.endedAt ? '' : ' so far'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Started</dt>
            <dd className="text-ink mt-0.5">{when(incident.startedAt)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{incident.endedAt ? 'Recovered' : 'Status'}</dt>
            <dd className={`mt-0.5 font-semibold ${incident.endedAt ? 'text-ink' : 'text-bad'}`}>
              {incident.endedAt ? when(incident.endedAt) : 'Still down'}
            </dd>
          </div>
        </dl>
      )}
      {downtime && incidentsLoaded && !incident && (
        <p className="text-[13px] text-ink-muted mt-3">This outage is not in the last 30 days of incident history.</p>
      )}
      {speed && !checksLoaded && <p className="text-[13px] text-ink-muted mt-3">Loading this check…</p>}
      {speed && checksLoaded && stretch?.check && (
        <dl className="mt-4 pt-4 border-t border-brand-100 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Response</dt>
            <dd className="text-ink font-semibold mt-0.5">{formatMs(stretch.check.responseTime)} · alert threshold {threshold.toLocaleString()} ms</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{focus.type === 'slow_ok' ? 'Was slow for' : 'Slow for'}</dt>
            <dd className="text-ink font-semibold mt-0.5">{stretch.minutes ? `${stretch.minutes} minute${stretch.minutes === 1 ? '' : 's'}` : 'This check was back under the threshold.'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Checked</dt>
            <dd className="text-ink mt-0.5">{when(stretch.check.timestamp)}{stretch.check.statusCode ? ` · HTTP ${stretch.check.statusCode}` : ''}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">From / to</dt>
            <dd className="text-ink mt-0.5">{stretch.from ? `${when(stretch.from)} → ${when(stretch.to)}` : '—'}</dd>
          </div>
        </dl>
      )}
      {speed && checksLoaded && !stretch && (
        <p className="text-[13px] text-ink-muted mt-3">This check is outside the last 24 hours, so the minute-by-minute times are no longer stored.</p>
      )}
    </section>
  );
};

const ChecksTable = ({ checks, limit, highlightId }) => (
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
            <tr key={check._id} className={`border-t border-brand-100 hover:bg-brand-50/60 transition-colors ${check._id === highlightId ? 'bg-brand-50' : ''}`}>
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
              ['Platform', platformLabel(site.platform)],
              ...runtimeRows(site),
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

      <InventorySection site={site} />

      <section>
        <SectionTitle>Recent checks</SectionTitle>
        <ChecksTable checks={checks} limit={6} />
      </section>
    </div>
  );
};

const INVENTORY_TITLE = { wordpress: 'Plugins', nextjs: 'Libraries', laravel: 'Packages', codeigniter: 'Packages', php: 'Packages' };

const InventorySection = ({ site }) => {
  const title = INVENTORY_TITLE[site.platform];
  if (!title) return null;
  const items = Array.isArray(site.security?.inventory) ? site.security.inventory : [];
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      {items.length === 0 ? (
        <p className="text-[13px] font-semibold text-ink-muted">Not reported yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-x-10">
          <KeyValue rows={items.map((item) => [item.dev ? `${item.name} · dev` : item.name, item.version || '--'])} />
        </div>
      )}
    </section>
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

const HistoryTab = ({ checks, incidents, focusId, highlightCheckId }) => (
  <div className="space-y-7">
    <section>
      <SectionTitle>Incidents · last 30 days</SectionTitle>
      {incidents.length === 0 ? <p className="text-[13px] text-ink-muted">No downtime recorded.</p> : (
        <div className="space-y-2">
          {incidents.map((incident) => (
            <div key={incident._id} className={`panel px-4 py-3 flex items-center justify-between gap-4 text-[13px] ${incident._id === focusId ? 'ring-2 ring-brand-500' : ''}`}>
              <span className="min-w-0">
                <span className="block font-semibold text-ink truncate">{incident.message || STATUS_LABEL[incident.status]}</span>
                <span className={`text-[11px] font-semibold ${incident.endedAt ? 'text-ink-muted' : 'text-bad'}`}>
                  Down for {formatSpan(incident.startedAt, incident.endedAt)}{incident.endedAt ? '' : ' so far'}
                </span>
              </span>
              <span className="text-ink-muted whitespace-nowrap text-right">
                {new Date(incident.startedAt).toLocaleString()}
                <span className="block">{incident.endedAt ? new Date(incident.endedAt).toLocaleString() : <span className="text-bad font-bold">ongoing</span>}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
    <section>
      <SectionTitle>All checks · last 24 hours</SectionTitle>
      <ChecksTable checks={checks} limit={60} highlightId={highlightCheckId} />
    </section>
  </div>
);

// ---------- Main ----------
const SiteDetail = ({ site, tab = 'Overview', onTabChange, onBack, onEdit, onDelete, onChanged, alertFocus = null, onDismissAlert }) => {
  const setTab = onTabChange;
  const [checking, setChecking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [incidentsLoaded, setIncidentsLoaded] = useState(false);
  const { checks, latencySeries, availability, loaded: checksLoaded } = useMonitoringHistory(site._id, 24);
  const { isPro } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const load = () => ApiService.getIncidents(site._id, 30)
      .then((data) => { if (!cancelled) setIncidents(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIncidentsLoaded(true); });
    load();
    const interval = setInterval(load, INCIDENT_REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [site._id]);

  const threshold = site.settings?.alertThresholds?.responseTime || 5000;
  const focusedIncident = alertFocus ? incidentForAlert(incidents, alertFocus) : null;
  const focusedSlow = alertFocus ? slowStretch(checks, alertFocus, threshold) : null;

  useEffect(() => {
    if (!alertFocus) return;
    document.getElementById('alert-context')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [alertFocus, tab, incidentsLoaded, checks.length]);

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
          <div className="min-w-0 space-y-7">
            <AlertContext focus={alertFocus} incidents={incidents} incidentsLoaded={incidentsLoaded} checks={checks} checksLoaded={checksLoaded} threshold={threshold} onDismiss={onDismissAlert} />
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
                  ['Malware scan', sec.malwareScan?.replace(/_/g, ' ')],
                  ...runtimeRows(site),
                  ['Plugins', sec.totalPlugins], ['Outdated plugins', sec.outdatedPlugins], ['Security plugins', sec.securityPlugins],
                ]}
                itemsTitle="Recommendations" items={sec.recommendations || []} emptyText="No security recommendations."
              />
            )}
            {tab === 'History' && (
              <HistoryTab
                checks={checks}
                incidents={incidents}
                focusId={focusedIncident?._id}
                highlightCheckId={focusedSlow?.check?._id}
              />
            )}
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
