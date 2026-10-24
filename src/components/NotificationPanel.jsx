import React, { useEffect } from 'react';
import {
  Bell, X, AlertTriangle, CheckCircle2, Gauge, Puzzle, Lock, ShieldAlert, Sparkles, UserPlus, Settings, ChevronRight, Info,
} from 'lucide-react';
import { timeAgo } from '../utils/siteMetrics';

const LOOK = {
  site_down: { icon: AlertTriangle, tone: 'bg-bad-soft text-bad' },
  site_up: { icon: CheckCircle2, tone: 'bg-good-soft text-good' },
  slow: { icon: Gauge, tone: 'bg-warn-soft text-warn' },
  slow_ok: { icon: Gauge, tone: 'bg-good-soft text-good' },
  plugins: { icon: Puzzle, tone: 'bg-brand-50 text-brand-600' },
  ssl_off: { icon: Lock, tone: 'bg-bad-soft text-bad' },
  ssl_ok: { icon: Lock, tone: 'bg-good-soft text-good' },
  security_low: { icon: ShieldAlert, tone: 'bg-warn-soft text-warn' },
  pro_approved: { icon: Sparkles, tone: 'bg-brand-50 text-brand-600' },
  pro_declined: { icon: Info, tone: 'bg-canvas text-ink-muted' },
  pro_request: { icon: Sparkles, tone: 'bg-brand-50 text-brand-600' },
  signup: { icon: UserPlus, tone: 'bg-brand-50 text-brand-600' },
};
const fallback = { icon: Bell, tone: 'bg-brand-50 text-brand-600' };

/**
 * Alert history (newest first). Unread alerts stay highlighted while the panel is open
 * and are marked read when it closes.
 */
const NotificationPanel = ({ isOpen, onClose, notifications, onOpenItem, onOpenSettings, onMarkRead }) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      onMarkRead?.();
    };
  }, [isOpen, onMarkRead]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md max-h-[85vh] flex flex-col bg-white rounded-[2rem] shadow-2xl border border-brand-100 z-50 overflow-hidden animate-fade-in"
        role="dialog"
        aria-labelledby="notification-panel-title"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-5 bg-brand-600 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Bell size={22} />
            <h2 id="notification-panel-title" className="text-lg font-bold">Alerts</h2>
          </div>
          <div className="flex items-center gap-1 -mr-2">
            <button type="button" onClick={onOpenSettings} className="p-2 rounded-lg hover:bg-white/20 transition-colors" aria-label="Alert settings" title="Alert settings">
              <Settings size={19} />
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/20 transition-colors" aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-good-soft flex items-center justify-center mb-3">
                <CheckCircle2 size={28} className="text-good" />
              </div>
              <p className="font-semibold text-ink">No alerts yet</p>
              <p className="text-sm text-ink-muted mt-1 max-w-xs">You’ll see it here when a site goes down, slows down or has updates waiting.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {notifications.map((n) => {
                const { icon: Icon, tone } = LOOK[n.type] || fallback;
                const clickable = Boolean(n.websiteId);
                const Row = clickable ? 'button' : 'div';
                return (
                  <li key={n._id}>
                    <Row
                      {...(clickable ? { type: 'button', onClick: () => onOpenItem?.(n) } : {})}
                      className={`w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-colors ${n.read ? '' : 'bg-brand-50/70'} ${clickable ? 'hover:bg-brand-50' : ''}`}
                    >
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon size={17} /></span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={`text-sm text-ink truncate ${n.read ? 'font-semibold' : 'font-bold'}`}>{n.title}</span>
                          <span className="text-[11px] text-ink-muted shrink-0">{timeAgo(n.createdAt)}</span>
                        </span>
                        {n.body && <span className="block text-[13px] text-ink-muted mt-0.5 leading-snug">{n.body}</span>}
                      </span>
                      {clickable && <ChevronRight size={16} className="text-ink-muted shrink-0 mt-2.5" />}
                    </Row>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button type="button" onClick={onOpenSettings} className="px-4 py-3 border-t border-brand-100 bg-brand-50 text-center text-xs font-semibold text-brand-700 hover:bg-brand-100 shrink-0">
          Choose which alerts reach your phone and browser
        </button>
      </div>
    </>
  );
};

export default NotificationPanel;
