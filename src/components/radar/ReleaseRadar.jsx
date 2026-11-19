import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Radar, ShieldCheck, ShieldAlert, Clock, ExternalLink, Sparkles, Download } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { apiFetch } from '../../services/session';
import { useAuth } from '../../contexts/AuthContext';
import UpgradeModal from '../pro/UpgradeModal';
import Logo from '../Logo';

// Release Radar (Pro): every live security advisory for PHP, Node.js, WordPress and Next.js, with the state of each
// of the customer's sites (affected / not exposed / patched), the exact upgrade target and the time it took to patch.
const SEV = { critical: 'bg-bad text-white', high: 'bg-bad-soft text-bad', moderate: 'bg-warn-soft text-warn', low: 'bg-brand-50 text-brand-700' };
const STATE = {
  affected: { label: 'Action needed', tone: 'bg-bad-soft text-bad', Icon: ShieldAlert },
  not_exposed: { label: 'Not exposed', tone: 'bg-brand-50 text-brand-700', Icon: ShieldCheck },
  patched: { label: 'Patched', tone: 'bg-good-soft text-good', Icon: ShieldCheck },
  up_to_date: { label: 'Up to date', tone: 'bg-good-soft text-good', Icon: ShieldCheck },
};
const utc = (iso) => `${new Date(iso).toUTCString().slice(5, 22)} UTC`;

const RADAR_UPGRADE = {
  title: 'Release Radar is part of Pro',
  text: 'Know before a PHP, Node.js or WordPress security release which of your sites it affects and what to do now, get the exact upgrade for each site the moment the fix ships, and see every site confirmed patched.',
};

const ReleaseRadar = () => {
  const { isPro } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [upgrade, setUpgrade] = useState(!isPro);

  useEffect(() => {
    if (!isPro) return;
    apiFetch(`${API_BASE_URL}/radar`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error || 'Could not load the Release Radar.'))))
      .then((d) => setData(d.advisories || []))
      .catch((e) => setError(e.message));
  }, [isPro]);

  const all = data || [];
  const totals = all.reduce((t, a) => ({ affected: t.affected + a.counts.affected, patched: t.patched + a.counts.patched }), { affected: 0, patched: 0 });

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-linear-to-r from-brand-600 to-brand-800 text-white px-4 sm:px-6 lg:px-10 py-6">
        <div className="flex items-center gap-3">
          <Link to="/app" className="print:hidden w-10 h-10 rounded-xl hover:bg-white/15 flex items-center justify-center" aria-label="Back to dashboard"><ArrowLeft size={18} /></Link>
          <Logo variant="white" className="h-7" />
          {data && all.length > 0 && (
            <button type="button" onClick={() => window.print()} className="print:hidden ml-auto h-10 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-[13px] font-bold flex items-center gap-2">
              <Download size={16} /> Download PDF
            </button>
          )}
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3"><Radar size={28} /> Release Radar</h1>
            <p className="text-white/80 mt-1 max-w-2xl text-[14px]">Security releases for PHP, Node.js, WordPress and Next.js, matched to the exact versions your sites run: what to do before the fix, the upgrade when it ships, and proof each site is patched.</p>
            <p className="hidden print:block text-white/80 mt-1 text-[12px]">Patch report generated {new Date().toUTCString().slice(5, 22)} UTC</p>
          </div>
          {data && (
            <div className="flex gap-3">
              {(() => {
                const hrs = all.flatMap((a) => a.sites.map((s) => s.hoursToPatch)).filter((h) => h != null).sort((x, y) => x - y);
                return hrs.length ? <div className="rounded-2xl bg-white/15 px-4 py-3 text-center"><div className="text-2xl font-extrabold">{hrs[Math.floor((hrs.length - 1) / 2)]} h</div><div className="text-[11px] uppercase tracking-wider text-white/75">median to patch</div></div> : null;
              })()}
              <div className="rounded-2xl bg-white/15 px-4 py-3 text-center"><div className="text-2xl font-extrabold">{totals.affected}</div><div className="text-[11px] uppercase tracking-wider text-white/75">need action</div></div>
              <div className="rounded-2xl bg-white/15 px-4 py-3 text-center"><div className="text-2xl font-extrabold">{totals.patched}</div><div className="text-[11px] uppercase tracking-wider text-white/75">patched</div></div>
            </div>
          )}
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-10 space-y-5 max-w-6xl">
        {!isPro && (
          <div className="panel p-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-ink-soft max-w-xl">{RADAR_UPGRADE.text}</p>
            <button type="button" onClick={() => setUpgrade(true)} className="btn-primary !h-11"><Sparkles size={16} /> See Pro</button>
          </div>
        )}
        {error && <div className="text-sm font-semibold text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</div>}
        {isPro && !data && !error && <p className="text-ink-muted">Loading…</p>}
        {data && all.length === 0 && (
          <div className="panel p-8 text-center">
            <ShieldCheck size={36} className="mx-auto text-good" />
            <h2 className="mt-3 font-extrabold text-ink text-lg">Nothing on the radar for your sites</h2>
            <p className="text-ink-soft text-sm mt-1">When a PHP, Node.js, WordPress or Next.js security release affects a version one of your sites runs, it appears here and you get a notification.</p>
          </div>
        )}

        {all.map((a) => (
          <section key={a.id} className="panel overflow-hidden break-inside-avoid">
            <div className="p-5 border-b border-brand-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${SEV[a.severity]}`}>{a.severity}</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{a.componentLabel} · {a.status === 'announced' ? 'fix not out yet' : 'fix released'}</span>
                {a.cves.map((c) => <span key={c} className="text-[11px] font-mono text-ink-muted">{c}</span>)}
              </div>
              <h2 className="mt-1.5 text-lg font-extrabold text-ink">{a.title}</h2>
              {a.summary && <p className="text-[13px] text-ink-soft mt-1">{a.summary}</p>}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-muted">
                {a.status === 'announced' && a.releaseAt && <span className="flex items-center gap-1"><Clock size={13} /> Fix due {utc(a.releaseAt)}</span>}
                {a.releasedAt && <span>Released {utc(a.releasedAt)}</span>}
                {Object.keys(a.fixed).length > 0 && <span>Fixed in {Object.values(a.fixed).join(', ')}</span>}
                {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-brand-700">Advisory <ExternalLink size={12} /></a>}
              </div>
              {a.mitigation && a.counts.affected > 0 && (
                <div className="mt-3 rounded-xl bg-warn-soft px-4 py-3 text-[13px] text-ink"><span className="font-bold">{a.status === 'announced' ? 'Do this now: ' : 'Until you upgrade: '}</span>{a.mitigation}</div>
              )}
            </div>
            <div className="divide-y divide-brand-50">
              {a.sites.map((s) => {
                const st = s.state === 'patched' && !s.patchedAt ? STATE.up_to_date : STATE[s.state] || STATE.affected;
                return (
                  <div key={s.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-ink truncate">{s.name}</div>
                      <div className="text-[12px] text-ink-muted">{a.componentLabel} {s.version}{s.state === 'affected' && s.target ? ` → upgrade to ${s.target}` : ''}{s.state === 'affected' && !s.target && a.status === 'released' ? ' → no fix for this branch: move to a supported one' : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.state === 'patched' && s.hoursToPatch != null && <span className="text-[12px] text-ink-muted">in {s.hoursToPatch} h</span>}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${st.tone}`}><st.Icon size={13} /> {st.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>
      <UpgradeModal isOpen={upgrade && !isPro} onClose={() => setUpgrade(false)} feature={RADAR_UPGRADE} />
    </div>
  );
};

export default ReleaseRadar;
