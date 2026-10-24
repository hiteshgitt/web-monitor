import React, { useEffect, useState } from 'react';
import { ShieldCheck, Mail, Lock, KeyRound, Smartphone, User } from 'lucide-react';
import QRCode from 'qrcode';
import { API_BASE_URL } from '../../config/api';
import Logo from '../Logo';

const post = async (path, body) => {
  const response = await fetch(`${API_BASE_URL}/admin-auth${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong. Please try again.');
    error.code = data.code;
    throw error;
  }
  return data;
};

const Field = ({ icon: Icon, ...props }) => (
  <label className="flex items-center gap-3 bg-canvas rounded-xl px-4 h-12 focus-within:ring-2 focus-within:ring-brand-300 transition-all">
    <Icon size={18} className="text-brand-500 shrink-0" />
    <input {...props} className="flex-1 min-w-0 bg-transparent text-[15px] font-semibold text-ink placeholder:text-ink-muted placeholder:font-normal focus:outline-hidden" />
  </label>
);

const SetupQr = ({ url }) => {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 200, color: { dark: '#1f2557', light: '#ffffff' } }).then(setSrc).catch(() => {});
  }, [url]);
  return src ? <img src={src} alt="QR code for your authenticator app" className="w-44 h-44 rounded-xl border border-brand-100" /> : <div className="w-44 h-44 rounded-xl bg-canvas" />;
};

/**
 * Super admin sign-in. Steps: password (or the one-time setup link's new password) -> authenticator code.
 * First sign-in links the authenticator with a QR code. onSignedIn receives { token, admin }.
 */
const AdminSignIn = ({ setupToken, onSignedIn }) => {
  const [step, setStep] = useState(setupToken ? 'choose-password' : 'password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Keep the admin area out of search results
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const title = document.title;
    document.title = 'Admin · Web Monitor';
    return () => { meta.remove(); document.title = title; };
  }, []);

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      if (err.code === 'CHALLENGE_EXPIRED') { setStep('password'); setChallenge(null); setCode(''); }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const nextStep = (data) => {
    setChallenge(data);
    setCode('');
    setStep(data.step);
  };

  const submit = (e) => {
    e.preventDefault();
    if (step === 'password') run(async () => nextStep(await post('/login', { email, password })));
    if (step === 'choose-password') {
      if (password !== confirm) { setError('The two passwords don’t match.'); return; }
      run(async () => {
        nextStep(await post('/setup', { token: setupToken, password, name }));
        window.history.replaceState(null, '', '/ruyashield');
      });
    }
    if (step === 'code' || step === 'setup') {
      run(async () => onSignedIn(await post('/verify', { challenge: challenge.challenge, code })));
    }
  };

  const heading = {
    password: ['Admin sign-in', 'Restricted area. Every action here is logged.'],
    'choose-password': ['Set up your admin account', 'Choose a strong password (12 characters or more).'],
    setup: ['Turn on 2-step verification', 'Scan the code with Google Authenticator, Authy or 1Password, then enter the 6-digit code it shows.'],
    code: ['Enter your code', 'Open your authenticator app and enter the 6-digit code for Web Monitor Admin.'],
  }[step];

  return (
    <div className="min-h-screen w-full bg-linear-to-br from-brand-700 via-brand-800 to-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-frame p-7 sm:p-9 animate-fade-in">
        <div className="flex items-center gap-2.5">
          <Logo variant="brand" className="h-6" />
          <span className="font-extrabold text-ink">Web Monitor</span>
          <span className="ml-auto chip !text-[11px] bg-brand-50 text-brand-700"><ShieldCheck size={12} /> Super admin</span>
        </div>
        <h1 className="mt-7 text-2xl font-extrabold text-ink tracking-tight">{heading[0]}</h1>
        <p className="mt-1.5 text-sm text-ink-muted">{heading[1]}</p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {step === 'password' && (
            <>
              <Field icon={Mail} type="email" autoComplete="username" placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Field icon={Lock} type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </>
          )}
          {step === 'choose-password' && (
            <>
              <Field icon={User} type="text" autoComplete="name" placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
              <Field icon={Lock} type="password" autoComplete="new-password" placeholder="New password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Field icon={Lock} type="password" autoComplete="new-password" placeholder="Repeat password" minLength={12} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </>
          )}
          {step === 'setup' && challenge && (
            <div className="flex flex-col items-center gap-3 pb-2">
              <SetupQr url={challenge.otpauthUrl} />
              <a href={challenge.otpauthUrl} className="text-[13px] font-bold text-brand-600 flex items-center gap-1.5"><Smartphone size={14} /> On this phone? Open the authenticator app</a>
              <details className="w-full text-[12px] text-ink-muted">
                <summary className="cursor-pointer font-semibold">Can’t scan? Enter the key by hand</summary>
                <code className="mt-2 block break-all rounded-lg bg-canvas px-3 py-2 font-mono text-ink tracking-wider">{challenge.secret.match(/.{1,4}/g).join(' ')}</code>
              </details>
            </div>
          )}
          {(step === 'code' || step === 'setup') && (
            <Field
              icon={KeyRound}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              required
            />
          )}

          {error && <div className="text-sm font-semibold text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</div>}

          <button type="submit" disabled={busy} className="btn-primary w-full !h-12">
            {busy ? 'Please wait…' : step === 'password' ? 'Continue' : step === 'choose-password' ? 'Save password' : step === 'setup' ? 'Turn on and sign in' : 'Sign in'}
          </button>
          {(step === 'code' || step === 'setup') && (
            <button type="button" onClick={() => { setStep('password'); setChallenge(null); setError(''); }} className="w-full text-[13px] font-semibold text-ink-muted hover:text-brand-600">
              Start again
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default AdminSignIn;
