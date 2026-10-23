import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TONE } from '../../utils/siteMetrics';

// Thin gradient bar that animates to its value on mount/update
export const ProgressBar = ({ value, tone = 'muted', className = '' }) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(value == null ? 0 : Math.max(0, Math.min(100, value))));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className={`h-[3px] rounded-full bg-brand-100 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full bg-linear-to-r ${TONE[tone].bar} transition-[width] duration-1000 ease-out`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
};

// Circular score gauge (0-100)
export const ScoreRing = ({ value, tone = 'muted', size = 96, label }) => {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(value ?? 0));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const color = { good: '#3CC48C', warn: '#E3B23C', bad: '#E5536A', muted: '#AAB7F0' }[tone];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E6EAFB" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress / 100)}
          style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-ink tabular-nums">{value ?? '--'}</span>
        {label && <span className="label-caps text-[9px]!">{label}</span>}
      </div>
    </div>
  );
};

// Mini overview card: icon + caps title, progress line, description, footer chips
export const MetricCard = ({ icon: Icon, title, value, tone, progress, children, footer }) => (
  <div className="panel p-4 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
    <div>
      <span className="flex items-center gap-2 label-caps text-ink!">
        <Icon size={15} className="text-brand-600" /> {title}
      </span>
      <div className={`mt-2 text-[26px] leading-none font-extrabold tabular-nums ${TONE[tone].text}`}>{value}</div>
      <ProgressBar value={progress} tone={tone} className="mt-3" />
    </div>
    <p className="text-[13px] leading-relaxed text-ink-soft flex-1">{children}</p>
    {footer && <div className="flex items-center gap-1.5 flex-wrap">{footer}</div>}
  </div>
);

export const MiniChip = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-[11px] font-bold">
    {Icon && <Icon size={11} />} {children}
  </span>
);

// Two-column label/value rows like "Number   130942"
export const KeyValue = ({ rows }) => (
  <dl className="space-y-2.5">
    {rows.map(([label, value]) => (
      <div key={label} className="flex items-baseline justify-between gap-4 text-[13px]">
        <dt className="font-bold text-ink">{label}</dt>
        <dd className="text-ink-soft text-right truncate">{value ?? '--'}</dd>
      </div>
    ))}
  </dl>
);

// Collapsible right-column section with a count badge
export const Collapsible = ({ title, count, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-brand-100">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-4 group"
      >
        <span className="flex items-center gap-2 label-caps text-ink!">
          {title}
          <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[10px] flex items-center justify-center">{count}</span>
        </span>
        <ChevronDown size={16} className={`text-ink transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr] opacity-100 pb-4' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
};

export const SectionTitle = ({ children, action }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-[15px] font-semibold text-ink-soft">{children}</h3>
    {action}
  </div>
);
