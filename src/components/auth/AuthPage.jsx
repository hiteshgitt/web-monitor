import React, { useCallback, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Mail, Lock, User, ArrowRight, Zap, ShieldCheck, BellRing, LineChart } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import GoogleButton from './GoogleButton';
import Logo from '../Logo';
import { googleSignInEnabled } from '../../config/google';

const FEATURES = [
  { icon: Zap, title: 'Real response times', text: 'Every site checked each minute from the server, not estimated.' },
  { icon: BellRing, title: 'Downtime alerts', text: 'Incidents open the moment a site stops answering.' },
  { icon: ShieldCheck, title: 'Security & SEO health', text: 'SSL, outdated plugins and SEO issues straight from your site.' },
  { icon: LineChart, title: 'Pro analytics', text: 'AI insights, plugin audits and reports on the Pro plan.' },
];

const Field = ({ icon: Icon, ...props }) => (
  <label className="flex items-center gap-3 bg-canvas rounded-xl px-4 h-12 focus-within:ring-2 focus-within:ring-brand-300 transition-all">
    <Icon size={17} className="text-brand-500 shrink-0" />
    <input {...props} className="flex-1 min-w-0 bg-transparent text-[15px] font-semibold text-ink placeholder:text-ink-muted placeholder:font-normal focus:outline-hidden" />
  </label>
);

const AuthPage = ({ mode }) => {
  const isSignup = mode === 'signup';
  const { status, login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const destination = location.state?.from || '/app';

  const finish = useCallback(() => navigate(destination, { replace: true }), [navigate, destination]);

  const handleGoogle = useCallback(async (credential) => {
    setError('');
    try {
      await loginWithGoogle(credential);
      finish();
    } catch (err) {
      setError(err.message);
    }
  }, [loginWithGoogle, finish]);

  if (status === 'signed-in') return <Navigate to={destination} replace />;

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isSignup) await register(form.name, form.email, form.password);
      else await login(form.email, form.password);
      finish();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white">
      {/* Brand panel */}
      <aside className="hidden lg:flex relative w-[46%] overflow-hidden bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-white p-12 flex-col">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 animate-float" />
        <div className="absolute bottom-[-120px] left-[-80px] w-[420px] h-[420px] rounded-full bg-white/5" />
        <Link to="/" className="relative flex items-center gap-3">
          <Logo variant="white" className="h-8" />
          <span className="text-xl font-extrabold tracking-tight">Web Monitor</span>
        </Link>
        <div className="relative mt-auto mb-auto max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">Know the moment your sites slow down or go dark.</h1>
          <p className="mt-4 text-white/80 text-lg">Live monitoring for WordPress, Laravel, Next.js and PHP sites — on the web and on your phone.</p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex gap-4 animate-slide-up" style={{ animationDelay: `${i * 90}ms` }}>
                <span className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0"><Icon size={18} /></span>
                <span>
                  <span className="block font-bold">{title}</span>
                  <span className="block text-sm text-white/75">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form */}
      <main className="flex-1 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,var(--color-brand-50),white_55%)]">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <Logo variant="brand" className="h-7" />
            <span className="text-lg font-extrabold text-ink">Web Monitor</span>
          </div>

          <h2 className="text-3xl font-extrabold text-ink tracking-tight">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <p className="text-ink-muted mt-1.5">{isSignup ? 'Start monitoring your sites in minutes.' : 'Sign in to your monitoring dashboard.'}</p>

          {googleSignInEnabled && (
            <>
              <div className="mt-8"><GoogleButton onCredential={handleGoogle} text={isSignup ? 'signup_with' : 'signin_with'} /></div>
              <div className="flex items-center gap-3 my-6 label-caps"><span className="h-px flex-1 bg-brand-100" />or with email<span className="h-px flex-1 bg-brand-100" /></div>
            </>
          )}

          <form onSubmit={submit} className={`space-y-3 ${googleSignInEnabled ? '' : 'mt-8'}`}>
            {isSignup && <Field icon={User} name="name" value={form.name} onChange={update} placeholder="Your name" autoComplete="name" />}
            <Field icon={Mail} name="email" type="email" required value={form.email} onChange={update} placeholder="Email address" autoComplete="email" />
            <Field icon={Lock} name="password" type="password" required minLength={isSignup ? 8 : undefined} value={form.password} onChange={update}
              placeholder={isSignup ? 'Password (8+ characters)' : 'Password'} autoComplete={isSignup ? 'new-password' : 'current-password'} />

            {error && <div className="text-sm font-semibold text-bad bg-bad-soft rounded-xl px-4 py-3 animate-fade-in">{error}</div>}

            <button type="submit" disabled={busy} className="btn-primary w-full !h-12 !text-[13px] mt-2">
              {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'} {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="text-sm text-ink-muted mt-8 text-center">
            {isSignup ? 'Already have an account?' : 'New to Web Monitor?'}{' '}
            <Link to={isSignup ? '/login' : '/signup'} state={location.state} className="font-bold text-brand-600 hover:text-brand-800">
              {isSignup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default AuthPage;
