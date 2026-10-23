import React, { useState } from 'react';
import { Lock, Sparkles, Brain, Puzzle, Server, Gauge, ShieldCheck, FileBarChart, Clock, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const PRO_SECTIONS = [
  { icon: Brain, title: 'AI insights', text: 'Zealot reads this site’s real data and tells you what to fix first.' },
  { icon: Puzzle, title: 'Plugin audit', text: 'Every plugin and package, with outdated and inactive ones flagged.' },
  { icon: Server, title: 'Server infrastructure', text: 'Downtime hours for 24h, 7 and 30 days, plus resource usage.' },
  { icon: Gauge, title: 'PageSpeed & Web Vitals', text: 'Load performance scores and Core Web Vitals for the site.' },
  { icon: ShieldCheck, title: 'Deep security', text: 'SSL grade, malware and vulnerability scans, security headers.' },
  { icon: FileBarChart, title: 'Logs & reports', text: 'Request logs, a full alert center and CSV report exports.' },
];

// Shown on the Advanced tab for Basic (free) accounts
const LockedAdvanced = ({ siteName }) => {
  const { user, requestUpgrade } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requested = Boolean(user?.upgradeRequestedAt);

  const request = async () => {
    setBusy(true);
    setError('');
    try {
      await requestUpgrade();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-400 via-brand-500 to-brand-700 text-white p-7 sm:p-9 shadow-card-hover">
        <div className="absolute -top-20 -right-10 w-64 h-64 rounded-full bg-white/10 animate-float" />
        <div className="absolute -bottom-24 left-1/3 w-56 h-56 rounded-full bg-white/5" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6 justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-[11px] font-bold uppercase tracking-wider">
              <Lock size={12} /> Pro feature
            </span>
            <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight">Unlock the Advanced view for {siteName}</h2>
            <p className="mt-2 text-white/80">You’re on the Basic plan. Pro adds deep analytics, AI insights and audits for every site you monitor.</p>
          </div>
          <div className="shrink-0 w-full md:w-64">
            {requested ? (
              <div className="rounded-2xl bg-white/15 backdrop-blur-sm px-4 py-3.5">
                <div className="flex items-center gap-2 font-bold"><Clock size={16} /> Request received</div>
                <div className="text-[12px] text-white/80 mt-1">Our team will switch you to Pro. Requested {new Date(user.upgradeRequestedAt).toLocaleDateString()}.</div>
              </div>
            ) : (
              <>
                <button type="button" onClick={request} disabled={busy}
                  className="w-full h-12 rounded-xl bg-white text-brand-700 font-bold text-[13px] uppercase tracking-[0.08em] flex items-center justify-center gap-2 shadow-card hover:-translate-y-0.5 transition-transform disabled:opacity-70">
                  {busy ? 'Sending…' : <><Sparkles size={16} /> Request Pro access</>}
                </button>
                <p className="text-[11px] text-white/70 text-center mt-2">No payment now — our team activates it.</p>
              </>
            )}
            {error && <p className="text-[12px] font-semibold text-white mt-2">{error}</p>}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {PRO_SECTIONS.map(({ icon: Icon, title, text }, i) => (
          <div key={title} style={{ animationDelay: `${i * 70}ms` }}
            className="group relative panel p-5 overflow-hidden animate-slide-up hover:-translate-y-1 hover:shadow-card-hover transition-all">
            <div className="flex items-center justify-between">
              <span className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-colors">
                <Icon size={20} />
              </span>
              <Lock size={14} className="text-ink-faint" />
            </div>
            <h3 className="mt-4 font-bold text-ink">{title}</h3>
            <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">{text}</p>
            {/* Placeholder bars hint at the locked content without showing invented numbers */}
            <div className="mt-4 space-y-1.5 blur-[2px] opacity-60 select-none" aria-hidden>
              <div className="h-2 rounded-full bg-brand-100 w-11/12" />
              <div className="h-2 rounded-full bg-brand-100 w-3/4" />
            </div>
          </div>
        ))}
      </div>

      <p className="flex items-center justify-center gap-2 text-[13px] text-ink-muted">
        <Check size={14} className="text-good" /> Everything in Basic stays included — Overview, Performance, SEO, Security and History.
      </p>
    </div>
  );
};

export default LockedAdvanced;
