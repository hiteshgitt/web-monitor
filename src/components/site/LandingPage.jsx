import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight, Zap, BellRing, ShieldCheck, Search, Brain, Puzzle, Plug, KeyRound, Smartphone,
  CheckCircle2, Activity, Menu, X, Monitor, Sparkles, Download,
} from 'lucide-react';
import Logo from '../Logo';
import PlatformIcon from '../PlatformIcon';
import PlanComparison from '../pro/PlanComparison';
import { PLANS } from '../../config/plans';
import { EARLY_ACCESS_APK } from '../../config/mobile';
import { useAuth } from '../../contexts/AuthContext';
import useReveal from '../../hooks/useReveal';

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#plans', label: 'Plans' },
  { href: '#app', label: 'Mobile app' },
];

const PLATFORMS = [
  { id: 'wordpress', name: 'WordPress' },
  { id: 'laravel', name: 'Laravel' },
  { id: 'nextjs', name: 'Next.js' },
  { id: 'codeigniter', name: 'CodeIgniter' },
  { id: 'php', name: 'Core PHP' },
];

const FEATURES = [
  { icon: Zap, title: 'Real response times', text: 'Every site is checked each minute from our server. You see the true round trip, not an estimate.' },
  { icon: BellRing, title: 'Downtime incidents', text: 'An incident opens the moment a site stops answering and closes when it recovers — with the exact error.' },
  { icon: ShieldCheck, title: 'Security health', text: 'SSL status, outdated plugins and security tooling reported straight from your site’s integration.' },
  { icon: Search, title: 'SEO checks', text: 'Missing descriptions, heading structure, alt text and links — turned into a clear fix checklist.' },
  { icon: Brain, title: 'AI insights', text: 'Pro: an AI assistant reads your real site data and explains what to fix first.', pro: true },
  { icon: Puzzle, title: 'Plugin audits', text: 'Pro: every plugin and package, with outdated and inactive ones flagged.', pro: true },
];

const STEPS = [
  { icon: Plug, title: 'Install the integration', text: 'Add the Web Monitor plugin to WordPress, or the package to your Laravel, Next.js or PHP app.' },
  { icon: KeyRound, title: 'Connect with your API key', text: 'Paste the site URL and its API key. We verify the connection before saving.' },
  { icon: Activity, title: 'Watch it live', text: 'Checks start immediately. Follow uptime, speed and issues on the web or your phone.' },
];

// Section wrapper with a fade/slide-in when scrolled into view
const Reveal = ({ children, className = '', delay = 0, as: Tag = 'div', ...rest }) => {
  const [ref, visible] = useReveal();
  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
};

// Interactive hero preview of the dashboard. Uses sample data and says so.
const SAMPLE_SITES = [
  { name: 'Northwind Store', url: 'northwind.example', score: 92, ms: 412, status: 'healthy' },
  { name: 'Acme Blog', url: 'blog.acme.example', score: 74, ms: 1280, status: 'warning' },
  { name: 'Studio Portfolio', url: 'studio.example', score: 88, ms: 655, status: 'healthy' },
];

const ProductPreview = () => {
  const [active, setActive] = useState(0);
  const [bars, setBars] = useState(() => Array.from({ length: 18 }, (_, i) => 35 + ((i * 37) % 45)));
  const site = SAMPLE_SITES[active];

  // Gently animate the sample chart so the preview feels alive
  useEffect(() => {
    const id = setInterval(() => {
      setBars((prev) => [...prev.slice(1), 30 + Math.round(Math.random() * 55)]);
    }, 1200);
    return () => clearInterval(id);
  }, []);

  const tone = (s) => (s >= 80 ? 'text-good' : s >= 60 ? 'text-warn' : 'text-bad');

  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-white/20 blur-3xl rounded-[40px]" />
      <div className="relative bg-white rounded-3xl shadow-frame overflow-hidden flex text-left">
        <div className="hidden sm:flex w-14 bg-linear-to-b from-brand-400 to-brand-600 flex-col items-center py-4 gap-4">
          <Logo variant="white" className="h-3" />
          {[0, 1, 2].map((i) => <span key={i} className={`w-7 h-7 rounded-lg ${i === 0 ? 'bg-white' : 'bg-white/20'}`} />)}
        </div>
        <div className="w-36 sm:w-48 shrink-0 bg-canvas p-2 sm:p-3 space-y-2">
          {SAMPLE_SITES.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive(i)}
              className={`w-full text-left rounded-xl px-3 py-2 transition-all duration-300 ${i === active ? 'bg-white shadow-card scale-[1.03]' : 'bg-white/50 hover:bg-white'}`}
            >
              <div className="text-[9px] text-ink-muted truncate">{s.url}</div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-ink truncate">{s.name}</span>
                <span className={`text-sm font-extrabold ${tone(s.score)}`}>{s.score}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-ink truncate">{site.name}</span>
            <span className="px-2 py-0.5 rounded-md bg-brand-50 text-[10px] font-bold text-ink">{site.ms} ms</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${site.status === 'healthy' ? 'bg-good-soft text-good' : 'bg-warn-soft text-warn'}`}>{site.score}</span>
          </div>
          <div className="flex gap-3 mt-2 text-[9px] font-bold uppercase tracking-wider text-ink-muted">
            <span className="text-brand-600 border-b-2 border-brand-600 pb-1">Overview</span><span>Performance</span><span>SEO</span>
          </div>
          <div className={`mt-3 rounded-xl p-2.5 text-white bg-linear-to-br ${site.status === 'healthy' ? 'from-emerald-300 to-good' : 'from-amber-300 to-warn'} transition-colors duration-500`}>
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              <CheckCircle2 size={13} /> {site.status === 'healthy' ? 'All systems healthy' : 'Needs attention'}
            </div>
          </div>
          <div className="mt-3 h-20 flex items-end gap-1">
            {bars.map((h, i) => (
              <span key={i} className="flex-1 rounded-t bg-linear-to-t from-brand-300 to-brand-500 transition-all duration-700" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
      <p className="relative text-center text-[11px] font-semibold text-white/70 mt-3">Interactive preview · sample data</p>
    </div>
  );
};

const LandingPage = () => {
  const { status } = useAuth();
  const signedIn = status === 'signed-in';
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const primaryCta = signedIn
    ? <Link to="/app" className="btn-primary !h-12 !px-7 !text-[13px] !bg-none !bg-white !text-brand-700">Open dashboard <ArrowRight size={16} /></Link>
    : <Link to="/signup" className="btn-primary !h-12 !px-7 !text-[13px] !bg-none !bg-white !text-brand-700">Start free <ArrowRight size={16} /></Link>;

  return (
    <div className="bg-white text-ink overflow-x-hidden">
      {/* Nav */}
      <header className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-card' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-5 lg:px-8 h-18 py-4 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5">
            <Logo variant={scrolled ? 'brand' : 'white'} className="h-6" />
            <span className={`font-extrabold text-lg tracking-tight ${scrolled ? 'text-ink' : 'text-white'}`}>Web Monitor</span>
          </a>
          <nav className="hidden md:flex items-center gap-8">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className={`text-sm font-bold transition-colors ${scrolled ? 'text-ink-soft hover:text-brand-600' : 'text-white/85 hover:text-white'}`}>{item.label}</a>
            ))}
            <Link to="/integrations" className={`text-sm font-bold transition-colors ${scrolled ? 'text-ink-soft hover:text-brand-600' : 'text-white/85 hover:text-white'}`}>Integrations</Link>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            {signedIn ? (
              <Link to="/app" className="btn-primary">Dashboard <ArrowRight size={14} /></Link>
            ) : (
              <>
                <Link to="/login" className={`text-sm font-bold px-3 ${scrolled ? 'text-ink-soft hover:text-brand-600' : 'text-white hover:text-white/80'}`}>Sign in</Link>
                <Link to="/signup" className="btn-primary">Get started</Link>
              </>
            )}
          </div>
          <button type="button" className={`md:hidden w-10 h-10 rounded-xl flex items-center justify-center ${scrolled ? 'text-ink' : 'text-white'}`} onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-white shadow-card px-5 pb-5 pt-2 space-y-1 animate-fade-in">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="block py-2.5 font-bold text-ink-soft">{item.label}</a>
            ))}
            <Link to="/integrations" className="block py-2.5 font-bold text-ink-soft">Integrations</Link>
            <div className="flex gap-2 pt-3">
              {signedIn ? <Link to="/app" className="btn-primary flex-1">Open dashboard</Link> : (
                <>
                  <Link to="/login" className="flex-1 h-10 rounded-xl border border-brand-200 text-brand-700 font-bold text-[12px] uppercase tracking-wider flex items-center justify-center">Sign in</Link>
                  <Link to="/signup" className="btn-primary flex-1">Get started</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="top" className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 bg-linear-to-br from-brand-400 via-brand-500 to-brand-700 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-white/10 animate-float" />
        <div className="absolute -bottom-52 -left-32 w-[480px] h-[480px] rounded-full bg-white/5" />
        <div className="relative max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-[1.05fr_1fr] gap-14 items-center">
          <div className="text-white min-w-0">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-[12px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" /> Live checks every minute
            </span>
            <h1 className="mt-6 text-[34px] sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight">
              Know the moment your sites slow down or go dark.
            </h1>
            <p className="mt-6 text-lg text-white/80 max-w-xl">
              Web Monitor watches your WordPress, Laravel, Next.js and PHP websites around the clock — real response
              times, downtime incidents, security and SEO health — on the web and on your phone.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              {primaryCta}
              <a href="#plans" className="h-12 px-6 rounded-xl border border-white/40 text-white font-bold text-[13px] uppercase tracking-[0.08em] flex items-center hover:bg-white/10 transition-colors">Compare plans</a>
            </div>
            <div className="mt-10 flex items-center gap-5 text-white/80 text-sm font-semibold flex-wrap">
              {['Free Basic plan', 'No card required', 'Web + mobile'].map((t) => (
                <span key={t} className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-300" /> {t}</span>
              ))}
            </div>
          </div>
          <Reveal delay={150} className="min-w-0"><ProductPreview /></Reveal>
        </div>
      </section>

      {/* Platforms */}
      <section className="py-12 border-b border-brand-100">
        <div className="max-w-6xl mx-auto px-5 flex flex-col md:flex-row items-center gap-6 md:gap-10 justify-center">
          <span className="label-caps">Works with</span>
          <div className="flex flex-wrap justify-center gap-3">
            {PLATFORMS.map((p) => (
              <Link key={p.id} to={`/integrations#${p.id}`} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-canvas text-sm font-bold text-ink-soft hover:bg-brand-50 hover:text-brand-700 hover:-translate-y-0.5 transition-all">
                <PlatformIcon platform={p.id} className="w-5 h-5" /> {p.name}
              </Link>
            ))}
            <Link to="/integrations#custom" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-canvas text-sm font-bold text-ink-soft hover:bg-brand-50 hover:text-brand-700 hover:-translate-y-0.5 transition-all">
              + Any stack
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 lg:py-32 bg-[radial-gradient(circle_at_top,var(--color-brand-50),white_60%)]">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <Reveal className="text-center max-w-2xl mx-auto">
            <span className="label-caps !text-brand-600">Features</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">Everything you need to keep sites healthy</h2>
            <p className="mt-4 text-ink-muted text-lg">Every number comes from a real check of your site. If something can’t be measured, we say so instead of guessing.</p>
          </Reveal>
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, text, pro }, i) => (
              <Reveal key={title} delay={i * 80} className="group panel p-7 hover:-translate-y-1.5 hover:shadow-card-hover !transition-all">
                <div className="flex items-center justify-between">
                  <span className="w-12 h-12 rounded-2xl bg-linear-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-btn group-hover:scale-110 transition-transform duration-300">
                    <Icon size={22} />
                  </span>
                  {pro && <span className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-[10px] font-extrabold tracking-wider flex items-center gap-1"><Sparkles size={10} /> PRO</span>}
                </div>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-ink-muted leading-relaxed">{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 lg:py-32 bg-canvas">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <Reveal className="text-center max-w-2xl mx-auto">
            <span className="label-caps !text-brand-600">How it works</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">Monitoring in three steps</h2>
          </Reveal>
          <div className="mt-16 grid md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-0.5 bg-linear-to-r from-brand-200 via-brand-400 to-brand-200" />
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 120} className="relative text-center">
                <span className="relative mx-auto w-20 h-20 rounded-3xl bg-white shadow-card flex items-center justify-center text-brand-600">
                  <Icon size={30} />
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-brand-600 text-white text-[12px] font-extrabold flex items-center justify-center shadow-btn">{i + 1}</span>
                </span>
                <h3 className="mt-6 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-ink-muted max-w-xs mx-auto">{text}</p>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-12 text-center">
            <Link to="/integrations" className="btn-primary !h-12 !px-7">Setup guides & downloads <ArrowRight size={16} /></Link>
          </Reveal>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="py-24 lg:py-32">
        <div className="max-w-5xl mx-auto px-5 lg:px-8">
          <Reveal className="text-center max-w-2xl mx-auto">
            <span className="label-caps !text-brand-600">Plans</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">Start free. Go Pro when you need depth.</h2>
          </Reveal>
          <div className="mt-14 grid md:grid-cols-2 gap-6">
            {['basic', 'pro'].map((id, i) => {
              const plan = PLANS[id];
              const isPro = id === 'pro';
              return (
                <Reveal key={id} delay={i * 120} className={`rounded-3xl p-8 ${isPro ? 'bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-frame md:-translate-y-3' : 'panel'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-extrabold flex items-center gap-2">{isPro && <Sparkles size={18} />} {plan.name}</h3>
                    {isPro && <span className="px-3 py-1 rounded-full bg-white/20 text-[11px] font-bold uppercase tracking-wider">Advanced view</span>}
                  </div>
                  <div className={`mt-5 text-4xl font-extrabold tracking-tight ${isPro ? '' : 'text-ink'}`}>{plan.price}</div>
                  <p className={`mt-2 ${isPro ? 'text-white/80' : 'text-ink-muted'}`}>{plan.tagline}</p>
                  <Link
                    to={signedIn ? '/app' : '/signup'}
                    className={isPro
                      ? 'mt-8 h-12 rounded-xl bg-white text-brand-700 font-bold text-[13px] uppercase tracking-[0.08em] flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-transform'
                      : 'btn-primary w-full !h-12 mt-8'}
                  >
                    {isPro ? 'Request Pro' : 'Start free'} <ArrowRight size={16} />
                  </Link>
                  {isPro && <p className="mt-3 text-center text-[12px] text-white/70">Sign up, then request Pro from your dashboard — our team activates it.</p>}
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={150} className="mt-12">
            <PlanComparison />
          </Reveal>
        </div>
      </section>

      {/* Mobile app */}
      <section id="app" className="py-24 lg:py-32 bg-canvas overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-16 items-center">
          <Reveal>
            <span className="label-caps !text-brand-600">Mobile app</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">Your sites, in your pocket</h2>
            <p className="mt-4 text-ink-muted text-lg">The same live dashboard on Android and iPhone, with push alerts the moment a site goes down. Use the web dashboard on desktop whenever you prefer a big screen.</p>
            {EARLY_ACCESS_APK.enabled && (
              <div className="mt-8 rounded-3xl bg-white shadow-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 text-[11px] font-extrabold uppercase tracking-wider">
                    <Sparkles size={12} /> Android early access
                  </span>
                  <p className="mt-2 text-sm text-ink-muted">Install the app today while the Play Store release is on its way. Android may ask you to allow installs from your browser. The file is about {EARLY_ACCESS_APK.sizeMb} MB, so Wi-Fi is best.</p>
                </div>
                <a href={EARLY_ACCESS_APK.url} className="btn-primary !h-12 !px-6 shrink-0">
                  <Download size={16} /> Download APK <span className="opacity-70 normal-case tracking-normal">v{EARLY_ACCESS_APK.version}</span>
                </a>
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              {['Google Play', 'App Store'].map((store) => (
                <span key={store} className="h-14 px-5 rounded-2xl bg-ink text-white flex items-center gap-3 opacity-80 cursor-default">
                  <Smartphone size={22} />
                  <span className="leading-tight">
                    <span className="block text-[10px] uppercase tracking-wider text-white/60">Coming soon on</span>
                    <span className="block font-bold">{store}</span>
                  </span>
                </span>
              ))}
              <Link to={signedIn ? '/app' : '/signup'} className="h-14 px-5 rounded-2xl bg-white shadow-card text-brand-700 flex items-center gap-3 font-bold hover:-translate-y-0.5 transition-transform">
                <Monitor size={22} /> Use the web app now
              </Link>
            </div>
          </Reveal>
          <Reveal delay={150} className="flex justify-center">
            <div className="relative w-64 h-[520px] rounded-[44px] bg-ink p-3 shadow-frame rotate-3 hover:rotate-0 transition-transform duration-500">
              <div className="w-full h-full rounded-[34px] overflow-hidden bg-canvas">
                <div className="bg-linear-to-r from-brand-400 to-brand-600 px-4 pt-8 pb-5 rounded-b-3xl">
                  <Logo variant="white" className="h-5" />
                  <div className="text-white/80 text-[11px] font-semibold mt-2">Sample sites</div>
                </div>
                <div className="p-3 space-y-2.5">
                  {SAMPLE_SITES.map((s) => (
                    <div key={s.name} className="bg-white rounded-2xl px-3 py-2.5 shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-[12px] font-bold text-ink">{s.name}</span>
                        <span className={`text-sm font-extrabold ${s.score >= 80 ? 'text-good' : 'text-warn'}`}>{s.score}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-ink-muted mt-1.5 pt-1.5 border-t border-brand-100">
                        <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${s.status === 'healthy' ? 'bg-good' : 'bg-warn'}`} />{s.status}</span>
                        <span className="font-bold text-ink">{s.ms} ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-5">
        <Reveal className="relative max-w-5xl mx-auto rounded-[36px] bg-linear-to-br from-brand-400 via-brand-500 to-brand-700 text-white px-8 py-14 text-center overflow-hidden shadow-frame">
          <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-white/10" />
          <h2 className="relative text-3xl sm:text-4xl font-extrabold tracking-tight">Start monitoring in minutes</h2>
          <p className="relative mt-3 text-white/80 text-lg">Free Basic plan. Upgrade to Pro whenever you need the Advanced view.</p>
          <div className="relative mt-8 flex justify-center">{primaryCta}</div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-100">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <Logo variant="brand" className="h-5" />
            <span className="font-extrabold">Web Monitor</span>
            <span className="text-ink-muted text-sm">by Ruyalab</span>
          </div>
          <nav className="flex gap-6 text-sm font-semibold text-ink-muted">
            {NAV.map((item) => <a key={item.href} href={item.href} className="hover:text-brand-600">{item.label}</a>)}
            <Link to="/integrations" className="hover:text-brand-600">Integrations</Link>
            <Link to="/login" className="hover:text-brand-600">Sign in</Link>
            <Link to="/privacy" className="hover:text-brand-600">Privacy</Link>
            <Link to="/terms" className="hover:text-brand-600">Terms</Link>
          </nav>
          <p className="text-sm text-ink-muted">© {new Date().getFullYear()} Ruyalab</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
