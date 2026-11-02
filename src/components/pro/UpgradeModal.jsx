import React, { useEffect, useState } from 'react';
import { X, Sparkles, Check, Clock, PartyPopper, CreditCard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL } from '../../config/api';
import { apiFetch } from '../../services/session';
import PlanComparison from './PlanComparison';

const formatInr = (paise) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(paise / 100);

const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('The payment window could not be loaded.'));
    document.body.appendChild(script);
  });
};

// Plans dialog. Online payment stays hidden until Razorpay keys and a price are configured.
// Until then a free customer still asks, and an admin turns Pro on by hand.
const UpgradeModal = ({ isOpen, onClose }) => {
  const { user, isPro, requestUpgrade, applyUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [billing, setBilling] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    apiFetch(`${API_BASE_URL}/billing/status`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (!cancelled) setBilling(data); })
      .catch(() => { if (!cancelled) setBilling({ enabled: false }); });
    return () => { cancelled = true; };
  }, [isOpen]);

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

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      await loadRazorpay();
      const response = await apiFetch(`${API_BASE_URL}/billing/order`, { method: 'POST' });
      const order = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(order.error || 'The payment could not be started.');
      await new Promise((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: 'Web Monitor',
          description: 'Pro plan',
          prefill: { email: user?.email || '', name: user?.name || '' },
          handler: async (payment) => {
            try {
              const confirmed = await apiFetch(`${API_BASE_URL}/billing/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payment),
              });
              const data = await confirmed.json().catch(() => ({}));
              if (!confirmed.ok) throw new Error(data.error || 'The payment could not be confirmed.');
              applyUser(data.user);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: { ondismiss: () => resolve() },
        });
        checkout.on('payment.failed', (failure) => {
          reject(new Error(failure?.error?.description || 'The payment did not go through.'));
        });
        checkout.open();
      });
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
          ) : (
            <>
              {billing?.enabled ? (
                <button type="button" onClick={pay} disabled={busy} className="btn-primary w-full !h-12 mt-6">
                  {busy ? 'Opening payment…' : <><CreditCard size={16} /> Pay {formatInr(billing.amount)} for Pro</>}
                </button>
              ) : (
                <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm text-ink-soft">
                  <div className="font-bold text-ink flex items-center gap-2"><CreditCard size={16} /> Online checkout</div>
                  <p className="mt-1">Card payment is built and stays off until the Razorpay keys and price are added. Until then, request Pro and we activate it by hand.</p>
                </div>
              )}

              {requested ? (
                <div className="mt-4 rounded-2xl bg-good-soft px-4 py-3 flex gap-3 items-start">
                  <Clock size={18} className="mt-0.5 shrink-0 text-good" />
                  <div className="text-sm">
                    <div className="font-bold text-good">Request received</div>
                    <div className="text-ink-soft">Our team will switch your account to Pro. Requested {new Date(user.upgradeRequestedAt).toLocaleString()}.</div>
                  </div>
                </div>
              ) : (
                <>
                  <button type="button" onClick={request} disabled={busy} className={billing?.enabled ? 'w-full h-11 mt-3 rounded-xl border border-brand-200 text-ink font-bold text-sm' : 'btn-primary w-full !h-12 mt-4'}>
                    {busy ? 'Sending…' : <><Check size={16} /> Request Pro access</>}
                  </button>
                  {!billing?.enabled && <p className="text-[12px] text-ink-muted text-center mt-3">No payment is taken. Our team activates Pro for you.</p>}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
