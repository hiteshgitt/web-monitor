import React, { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { fetchReportEmail, saveReportEmail, sendReportEmailNow } from '../../services/report';

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);

// Pro: email the 30-day report on the 1st of every month to up to 5 addresses.
const ReportEmailPanel = ({ siteId }) => {
  const [state, setState] = useState(null);
  const [recipients, setRecipients] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ tone: '', text: '' });

  useEffect(() => {
    let live = true;
    fetchReportEmail(siteId).then((data) => {
      if (!live) return;
      setState(data);
      setRecipients(data.recipients.join(', '));
      setEnabled(data.enabled);
    }).catch((err) => live && setMessage({ tone: 'bad', text: err.message }));
    return () => { live = false; };
  }, [siteId]);

  const run = async (kind, fn, ok) => {
    setBusy(kind);
    setMessage({ tone: '', text: '' });
    try {
      const data = await fn();
      if (data?.recipients) setState(data);
      setMessage({ tone: 'good', text: typeof ok === 'function' ? ok(data) : ok });
    } catch (err) {
      setMessage({ tone: 'bad', text: err.message });
    } finally {
      setBusy('');
    }
  };

  if (!state) return null;
  return (
    <section className="bg-white rounded-3xl border border-brand-100 p-5 shadow-card print:hidden">
      <div className="flex items-center gap-2">
        <Mail size={18} className="text-brand-600" />
        <h2 className="text-base font-extrabold text-ink">Monthly email</h2>
      </div>
      {!state.configured ? (
        <p className="text-sm text-ink-muted mt-2">Report emails are not turned on for Web Monitor yet. They will appear here once they are.</p>
      ) : (
        <>
          <p className="text-xs text-ink-soft mt-1.5 leading-relaxed">On the 1st of each month, the last 30 days&apos; report goes to up to 5 addresses. Each email has an unsubscribe link.</p>
          <form className="mt-4 space-y-3" onSubmit={(e) => {
            e.preventDefault();
            run('save', () => saveReportEmail(siteId, { enabled, recipients }), enabled ? 'Saved. The next email goes out on the 1st.' : 'Saved. Monthly emails are off.');
          }}>
            <input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="you@agency.com, client@example.com"
              className="w-full rounded-xl border border-brand-100 px-3 py-2.5 text-sm" aria-label="Recipients, up to 5, separated by commas" />
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4 accent-brand-600" />
              Send every month
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={!!busy || !state.recipients.length} className="justify-center inline-flex items-center rounded-xl border border-brand-200 text-brand-700 font-bold text-sm whitespace-nowrap hover:bg-brand-50 disabled:opacity-50"
                onClick={() => run('send', () => sendReportEmailNow(siteId), (r) => `Sent to ${r.sent} address${r.sent === 1 ? '' : 'es'}${r.failed ? `, ${r.failed} failed` : ''}.`)}>
                {busy === 'send' ? 'Sending…' : 'Send now'}
              </button>
              <button type="submit" disabled={!!busy} className="btn-primary justify-center">{busy === 'save' ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
          <p className="text-[11px] text-ink-muted mt-3">
            {state.lastSentAt ? `Last sent ${fmtDate(state.lastSentAt)}.` : 'Not sent yet.'}
            {state.lastError ? ` Last problem: ${state.lastError}` : ''}
          </p>
        </>
      )}
      {message.text && <p className={`mt-3 text-sm rounded-xl px-4 py-3 ${message.tone === 'bad' ? 'text-bad bg-bad-soft' : 'text-ink bg-good-soft'}`}>{message.text}</p>}
    </section>
  );
};

export default ReportEmailPanel;
