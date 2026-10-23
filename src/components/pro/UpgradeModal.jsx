import React, { useState } from 'react';
import { X, Sparkles, Check, Clock, PartyPopper } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import PlanComparison from './PlanComparison';

// Plans dialog: shows exactly what Pro adds, and lets a free customer request it
const UpgradeModal = ({ isOpen, onClose }) => {
  const { user, isPro, requestUpgrade } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in" onClick={onClose}>
      <div className="w-full sm:max-w-xl max-h-[92vh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-frame overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-linear-to-br from-brand-400 via-brand-500 to-brand-700 text-white px-7 pt-7 pb-7 overflow-hidden shrink-0">
          <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-white/10" />
          <button type="button" onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-xl hover:bg-white/15 flex items-center justify-center" aria-label="Close">
            <X size={18} />
          </button>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-[11px] font-bold uppercase tracking-wider">
            <Sparkles size={12} /> {isPro ? 'You are on Pro' : 'Pro plan'}
          </span>
          <h2 className="text-2xl font-extrabold mt-4 tracking-tight">{isPro ? 'Everything is unlocked' : 'What you get with Pro'}</h2>
          <p className="text-white/80 text-sm mt-1">
            {isPro ? 'Your account includes the full Advanced view for every site.' : 'Everything in Basic, plus the Advanced view for every site you monitor.'}
          </p>
        </div>

        <div className="px-6 sm:px-7 py-6 overflow-y-auto soft-scroll">
          <PlanComparison currentPlan={isPro ? 'pro' : 'basic'} compact />

          {error && <p className="mt-4 text-sm font-semibold text-bad">{error}</p>}

          {isPro ? (
            <div className="mt-6 rounded-2xl bg-brand-50 text-brand-700 px-4 py-3 flex gap-3 items-center text-sm font-semibold">
              <PartyPopper size={18} /> Open any site and use the chart icon to see its Advanced view.
            </div>
          ) : requested ? (
            <div className="mt-6 rounded-2xl bg-good-soft px-4 py-3 flex gap-3 items-start">
              <Clock size={18} className="mt-0.5 shrink-0 text-good" />
              <div className="text-sm">
                <div className="font-bold text-good">Request received</div>
                <div className="text-ink-soft">Our team will switch your account to Pro. Requested {new Date(user.upgradeRequestedAt).toLocaleString()}.</div>
              </div>
            </div>
          ) : (
            <>
              <button type="button" onClick={request} disabled={busy} className="btn-primary w-full !h-12 mt-6">
                {busy ? 'Sending…' : <><Check size={16} /> Request Pro access</>}
              </button>
              <p className="text-[12px] text-ink-muted text-center mt-3">No payment needed now — our team activates Pro for you.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
