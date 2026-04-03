import React, { useEffect } from 'react';
import { Bell, ChevronRight, X, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * In-app notification panel – replaces the browser alert() when user clicks the bell.
 * Shows alerts grouped by website; click a site to open its Advanced Dashboard → Alerts tab.
 * One-time behavior: opening the panel marks alerts as seen so the badge clears until new alerts arrive.
 */
const NotificationPanel = ({ isOpen, onClose, alertsByWebsite, onSelectWebsiteId, onMarkSeen }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      onMarkSeen?.();
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, onMarkSeen]);

  const handleSelectWebsite = (websiteId) => {
    onSelectWebsiteId?.(websiteId);
    onClose();
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('switch-to-alerts', { detail: {} }));
    }, 150);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md max-h-[85vh] flex flex-col bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 z-50 overflow-hidden animate-fade-in"
        role="dialog"
        aria-labelledby="notification-panel-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-[#2D1BFF] text-white shrink-0">
          <div className="flex items-center gap-2">
            <Bell size={22} className="text-white" />
            <h2 id="notification-panel-title" className="text-lg font-bold">
              Alerts by Website
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {alertsByWebsite.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <p className="font-semibold text-gray-800">No active alerts</p>
              <p className="text-sm text-gray-500 mt-1">Your sites are running smoothly</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {alertsByWebsite.map((group) => {
                const count = group.alerts?.length ?? 0;
                const priority = group.alerts?.some(a => a.priority === 'high') ? 'high' : 'medium';
                return (
                  <li key={group.websiteId}>
                    <button
                      type="button"
                      onClick={() => handleSelectWebsite(group.websiteId)}
                      className="w-full flex items-center justify-between gap-3 p-5 rounded-[1.5rem] bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-100 transition-all active:scale-[0.98] text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          priority === 'high' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                        }`}>
                          <AlertCircle size={20} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{group.websiteName}</p>
                          <p className="text-sm text-gray-500">
                            {count} alert{count !== 1 ? 's' : ''} · Tap to view details
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-gray-400 shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-center text-xs text-gray-500 shrink-0">
          Push notifications when the app is closed require permission in your browser.
        </div>
      </div>
    </>
  );
};

export default NotificationPanel;
