import React from 'react';
import { ShieldAlert, ShieldCheck, ExternalLink } from 'lucide-react';

// Known vulnerabilities (Pro): runtime problems (PHP / Node.js / WordPress) from the hourly check and vulnerable
// npm / Composer packages (live from OSV.dev when the Advanced view loads, else the last saved check).
const SEVERITY = {
  critical: 'bg-rose-600 text-white',
  high: 'bg-rose-50 text-rose-700 border border-rose-200',
  moderate: 'bg-amber-50 text-amber-700 border border-amber-200',
  low: 'bg-sky-50 text-sky-700 border border-sky-200',
  unknown: 'bg-brand-50 text-ink-muted border border-brand-100',
};

export const SeverityChip = ({ severity }) => (
  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest ${SEVERITY[severity] || SEVERITY.unknown}`}>
    {severity === 'unknown' ? 'severity n/a' : severity}
  </span>
);

// The fixed version for this site's own branch (PHP / WordPress by major.minor, Node.js / Next.js by major).
const siteTarget = (a) => {
  const parts = String(a.versionSeen || '').split('.');
  const branch = a.component === 'php' || a.component === 'wordpress' ? parts.slice(0, 2).join('.') : parts[0];
  return a.fixed?.[branch] || null;
};

const VulnerabilitiesPanel = ({ known, inventory, platform, advisories = [] }) => {
  const runtime = known?.runtime || [];
  const live = inventory?.vulnerability_check === 'ok';
  const open = advisories.filter((a) => a.siteState === 'affected');
  // A Next.js release on the Release Radar already covers the vulnerable "next" package: show it once.
  const packages = (live ? inventory.vulnerable || [] : known?.packages || []).filter((p) => !(p.name === 'next' && open.some((a) => a.component === 'nextjs')));
  const failed = inventory?.vulnerability_check === 'failed';
  const checksPackages = platform === 'nextjs' || ['laravel', 'php', 'codeigniter'].includes(platform);
  const total = runtime.length + packages.length + open.length;

  return (
    <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
      <div className="px-8 py-6 border-b border-brand-100 flex items-center justify-between bg-linear-to-r from-gray-50 to-white">
        <h3 className="text-sm font-extrabold text-ink uppercase tracking-widest flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${total ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {total ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
          </div>
          Known vulnerabilities
        </h3>
        {total > 0 && <span className="text-[11px] font-extrabold text-rose-600">{total} found</span>}
      </div>
      <div className="p-8 space-y-4">
        {total === 0 && (
          <p className="text-sm text-ink-soft">
            {failed
              ? 'The vulnerability database could not be reached just now, so packages were not checked. The hourly check will try again.'
              : `No known vulnerabilities in ${checksPackages ? 'the installed packages or ' : ''}the PHP, Node.js or WordPress version this site reports.`}
            {platform === 'wordpress' && ' WordPress plugins are not covered yet; WordPress itself and PHP are.'}
          </p>
        )}
        {open.map((a) => (
          <div key={a.id} className="rounded-2xl border border-rose-200 bg-rose-50/60 px-5 py-4">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityChip severity={a.severity} />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">Release Radar · {a.componentLabel} {a.versionSeen}</span>
              {a.cves.slice(0, 2).map((c) => <span key={c} className="text-[11px] font-mono text-ink-muted">{c}</span>)}
            </div>
            <div className="font-bold text-ink mt-1.5">{a.title}</div>
            <div className="text-[13px] text-ink-soft mt-1">
              <span className="font-bold text-brand-700">What to do: </span>
              {a.status === 'released' ? (siteTarget(a) ? `upgrade ${a.componentLabel} to ${siteTarget(a)}.` : 'this branch gets no fix: move to a supported version.') : `the fix is due${a.releaseAt ? ` ${new Date(a.releaseAt).toUTCString().slice(5, 22)} UTC` : ' soon'}.`}
              {a.mitigation && ` ${a.status === 'released' ? 'Until then' : 'Now'}: ${a.mitigation}`}
            </div>
            <a href="/app/radar" className="inline-block mt-1.5 text-[12px] font-bold text-brand-700 hover:underline">Open Release Radar</a>
          </div>
        ))}
        {runtime.map((r) => (
          <div key={r.key} className="rounded-2xl border border-rose-100 bg-rose-50/40 px-5 py-4">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityChip severity={r.severity} />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">{r.component} {r.version}</span>
            </div>
            <div className="font-bold text-ink mt-1.5">{r.title}</div>
            <div className="text-[13px] text-ink-soft mt-1"><span className="font-bold text-brand-700">What to do: </span>{r.fix}</div>
          </div>
        ))}
        {packages.map((p) => (
          <div key={`${p.name}@${p.version}`} className="rounded-2xl border border-brand-100 px-5 py-4">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityChip severity={p.severity} />
              <span className="font-extrabold text-ink">{p.name}</span>
              <span className="text-[11px] font-bold text-ink-muted">v{p.version}</span>
              {(p.aliases?.[0] || p.ids?.[0]) && <span className="text-[11px] font-mono text-ink-muted">{p.aliases?.[0] || p.ids[0]}{p.ids?.length > 1 ? ` +${p.ids.length - 1}` : ''}</span>}
            </div>
            {p.summary && <div className="text-[13px] text-ink-soft mt-1.5">{p.summary}</div>}
            <div className="text-[13px] mt-1.5 flex items-center gap-3 flex-wrap">
              <span><span className="font-bold text-brand-700">What to do: </span>{p.fixed ? `update to ${p.fixed} or later` : 'no fixed release yet: check the advisory for a workaround'}.</span>
              {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-brand-700 hover:underline">Advisory <ExternalLink size={12} /></a>}
            </div>
          </div>
        ))}
        <p className="text-[11px] text-ink-muted">
          Packages are checked against OSV.dev (GitHub advisories for npm and Packagist); PHP and Node.js against their end-of-life dates and security releases; WordPress against WordPress.org. You get a notification when something new appears.
        </p>
      </div>
    </div>
  );
};

export default VulnerabilitiesPanel;
