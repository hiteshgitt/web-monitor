import React from 'react';
import { Check, Minus, Sparkles } from 'lucide-react';
import { PLANS, PLAN_COMPARISON } from '../../config/plans';

const Cell = ({ value, highlight }) => {
  if (value === true) {
    return <Check size={16} strokeWidth={3} className={`mx-auto ${highlight ? 'text-brand-600' : 'text-good'}`} />;
  }
  if (value === false) return <Minus size={16} className="mx-auto text-ink-faint" />;
  return <span className={`text-[12px] font-bold ${highlight ? 'text-brand-700' : 'text-ink-soft'}`}>{value}</span>;
};

// Basic vs Pro feature table
const PlanComparison = ({ currentPlan, compact = false }) => (
  <div className="overflow-hidden rounded-2xl border border-brand-100">
    <table className="w-full text-left">
      <thead>
        <tr className="bg-canvas">
          <th className="px-4 py-3 label-caps">Feature</th>
          {['basic', 'pro'].map((id) => (
            <th key={id} className={`px-3 py-3 text-center w-[26%] ${id === 'pro' ? 'bg-brand-50' : ''}`}>
              <div className={`text-[13px] font-extrabold ${id === 'pro' ? 'text-brand-700' : 'text-ink'} flex items-center justify-center gap-1`}>
                {id === 'pro' && <Sparkles size={12} />} {PLANS[id].name}
              </div>
              {!compact && <div className="text-[11px] font-semibold text-ink-muted">{PLANS[id].price}</div>}
              {currentPlan === id && <div className="text-[10px] font-bold uppercase tracking-wider text-good mt-0.5">Your plan</div>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {PLAN_COMPARISON.map((row) => (row.group ? (
          <tr key={row.group}>
            <td colSpan={3} className="px-4 pt-4 pb-1.5 label-caps !text-brand-600">{row.group}</td>
          </tr>
        ) : (
          <tr key={row.feature} className="border-t border-brand-100/70">
            <td className={`px-4 ${compact ? 'py-2' : 'py-2.5'} text-[13px] text-ink-soft`}>{row.feature}</td>
            <td className="px-3 text-center"><Cell value={row.basic} /></td>
            <td className="px-3 text-center bg-brand-50/60"><Cell value={row.pro} highlight /></td>
          </tr>
        )))}
      </tbody>
    </table>
  </div>
);

export default PlanComparison;
