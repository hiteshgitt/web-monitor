import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import Logo from '../Logo';
import { useAuth } from '../../contexts/AuthContext';

const CONTACT_EMAIL = 'hiteshgml@gmail.com';
const CONFIRM_WORD = 'DELETE';

const REMOVED = [
  'Your account, name, email address and password hash, or your Google sign-in link',
  'Your websites, their API keys, check history, incidents and saved scan results',
  'Your alerts, alert settings and the phones and browsers registered for push',
  'Your connected Google Analytics and Search Console access tokens',
];

const KEPT = [
  'Records of paid orders, kept for tax and accounting. They do not contain your email address.',
  'Our admin audit log and admin alerts. These record actions on accounts, Zealot reports and the deletion itself, and can include your email address.',
];

const List = ({ items }) => (
  <ul className="mt-3 space-y-2.5">
    {items.map((item) => (
      <li key={item} className="flex gap-3 text-ink-soft leading-relaxed">
        <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

// Public on purpose: Google Play requires a deletion link that works without the app installed
const DeleteAccountPage = () => {
  const { user, status, deleteAccount } = useAuth();
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    document.title = 'Delete your account · Web Monitor';
    window.scrollTo(0, 0);
    return () => { document.title = 'Web Monitor Dashboard'; };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await deleteAccount();
      setDeleted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const ready = confirm.trim().toUpperCase() === CONFIRM_WORD;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-linear-to-br from-brand-400 via-brand-500 to-brand-700 text-white">
        <div className="max-w-3xl mx-auto px-5 pt-8 pb-14">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <Logo variant="white" className="h-6" />
            <span className="font-extrabold text-lg tracking-tight">Web Monitor</span>
          </Link>
          <h1 className="mt-12 text-4xl font-extrabold tracking-tight">Delete your account</h1>
          <p className="mt-2 text-white/80 text-sm">Web Monitor by Ruyalab</p>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 -mt-8 pb-16">
        <article className="panel p-7 sm:p-10">
          {deleted ? (
            <>
              <h2 className="text-lg font-bold text-ink">Your account has been deleted</h2>
              <p className="mt-3 text-ink-soft leading-relaxed">Your sites are no longer monitored and your data has been removed. You can also remove Web Monitor’s access from your Google account settings if you connected Google.</p>
            </>
          ) : (
            <>
              <p className="text-ink-soft leading-relaxed">Deletion is immediate and permanent. Monitoring stops straight away and your data cannot be recovered.</p>

              <section className="mt-8">
                <h2 className="text-lg font-bold text-ink">What is deleted</h2>
                <List items={REMOVED} />
              </section>

              <section className="mt-8">
                <h2 className="text-lg font-bold text-ink">What is kept</h2>
                <List items={KEPT} />
              </section>

              <section className="mt-8">
                <h2 className="text-lg font-bold text-ink">In the mobile app</h2>
                <p className="mt-3 text-ink-soft leading-relaxed">Open the menu on your sites screen, tap Delete account and type {CONFIRM_WORD} to confirm.</p>
              </section>

              <section className="mt-8">
                <h2 className="text-lg font-bold text-ink">On this page</h2>
                {status === 'loading' && <p className="mt-3 text-ink-muted">Checking your session…</p>}
                {status === 'signed-out' && (
                  <>
                    <p className="mt-3 text-ink-soft leading-relaxed">Sign in to the account you want to delete, and you’ll come back here to confirm.</p>
                    <Link to="/login" state={{ from: '/delete-account' }} className="btn-primary mt-4">Sign in to continue</Link>
                  </>
                )}
                {status === 'signed-in' && (
                  <form onSubmit={submit} className="mt-3">
                    <p className="text-ink-soft leading-relaxed">You are signed in as <strong className="text-ink">{user?.email}</strong>.</p>
                    <label htmlFor="delete-confirm" className="block mt-4 text-sm font-bold text-ink-soft">Type {CONFIRM_WORD} to confirm</label>
                    <input
                      id="delete-confirm"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      disabled={busy}
                      autoComplete="off"
                      placeholder={CONFIRM_WORD}
                      className="mt-2 w-full max-w-xs px-4 py-2.5 rounded-xl border border-brand-100 bg-white text-ink outline-none focus:border-brand-400"
                    />
                    {error && <p className="mt-3 text-sm text-bad">{error}</p>}
                    <button
                      type="submit"
                      disabled={!ready || busy}
                      className="block mt-4 px-5 py-2.5 rounded-xl bg-bad text-white font-bold disabled:opacity-50"
                    >
                      {busy ? 'Deleting…' : 'Delete my account'}
                    </button>
                  </form>
                )}
              </section>

              <section className="mt-8">
                <h2 className="text-lg font-bold text-ink">Can’t sign in?</h2>
                <p className="mt-3 text-ink-soft leading-relaxed">
                  Email <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand-600 hover:text-brand-800">{CONTACT_EMAIL}</a> from the address on your account and we will delete it for you.
                </p>
              </section>
            </>
          )}
        </article>
        <div className="mt-8 flex flex-wrap gap-4 justify-between text-sm font-semibold">
          <Link to="/" className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-800"><ArrowLeft size={15} /> Back to website</Link>
          <span className="flex gap-4 text-ink-muted">
            <Link to="/privacy" className="hover:text-brand-600">Privacy</Link>
            <Link to="/terms" className="hover:text-brand-600">Terms</Link>
          </span>
        </div>
      </main>
    </div>
  );
};

export default DeleteAccountPage;
