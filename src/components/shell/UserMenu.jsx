import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { LogOut, Sparkles, Globe, BellRing } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const initials = (user) => (user?.name || user?.email || '?')
  .split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');

// Avatar button with account details, plan, alert settings and sign-out
const UserMenu = ({ onUpgrade, onAlertSettings, placement = 'right' }) => {
  const { user, isPro, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const position = placement === 'right' ? 'left-full bottom-0 ml-3' : 'right-0 top-full mt-2';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-11 h-11 rounded-2xl bg-white/20 hover:bg-white/30 ring-2 ring-white/40 text-white font-extrabold text-sm flex items-center justify-center overflow-hidden transition-all"
        aria-label="Account"
      >
        {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : initials(user)}
      </button>

      {open && (
        <div className={`absolute ${position} z-50 w-64 bg-white rounded-2xl shadow-frame border border-brand-100 p-2 animate-fade-in`}>
          <div className="px-3 py-2.5">
            <div className="font-bold text-ink truncate">{user?.name || 'Your account'}</div>
            <div className="text-[12px] text-ink-muted truncate">{user?.email}</div>
            <span className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${isPro ? 'bg-brand-50 text-brand-700' : 'bg-canvas text-ink-muted'}`}>
              {isPro && <Sparkles size={11} />} {isPro ? 'Pro plan' : 'Free plan'}
            </span>
          </div>
          <div className="h-px bg-brand-100 my-1" />
          <button type="button" onClick={() => { setOpen(false); onUpgrade(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-brand-700 hover:bg-brand-50">
            <Sparkles size={16} /> {isPro ? 'Your plan' : user?.upgradeRequestedAt ? 'Pro request pending' : 'Compare plans & upgrade'}
          </button>
          <button type="button" onClick={() => { setOpen(false); onAlertSettings?.(); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-ink-soft hover:bg-brand-50">
            <BellRing size={16} /> Alert settings
          </button>
          <button type="button" onClick={() => navigate('/')} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-ink-soft hover:bg-brand-50">
            <Globe size={16} /> Website
          </button>
          <button type="button" onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-ink-soft hover:bg-bad-soft hover:text-bad">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
