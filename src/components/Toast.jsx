import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const Toast = ({ id, message, type = 'info', duration = 4000, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const icons = {
    success: <CheckCircle size={20} className="text-emerald-600" />,
    error: <XCircle size={20} className="text-red-600" />,
    warning: <AlertTriangle size={20} className="text-amber-600" />,
    info: <Info size={20} className="text-brand-600" />,
  };

  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-brand-50 border-brand-200 text-brand-800',
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-slide-up min-w-[300px] max-w-[400px] ${styles[type]}`}
    >
      <div className="shrink-0 mt-0.5">{icons[type]}</div>
      <div className="flex-1 text-sm font-medium">{message}</div>
      <button
        onClick={() => onClose(id)}
        className="shrink-0 text-ink-muted hover:text-ink-soft transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
