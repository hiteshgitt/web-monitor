import React, { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { adminRequest } from '../../services/adminSession';
import { timeAgo } from '../../utils/siteMetrics';

const ACTION_LABEL = {
  sign_in: 'Signed in',
  password_set: 'Set the admin password',
  two_step_enabled: 'Turned on 2-step verification',
  viewed: 'Viewed customer',
  pro_approved: 'Approved Pro for',
  plan_pro: 'Moved to Pro',
  plan_free: 'Moved to Free',
  pro_declined: 'Declined Pro for',
  suspended: 'Suspended',
  reactivated: 'Reactivated',
  deleted: 'Deleted customer',
};

// Who did what in the admin area, newest first
const AuditLog = () => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminRequest('/audit?limit=200').then(setRows).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="panel overflow-x-auto">
      {error && <div className="m-4 text-sm font-semibold text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</div>}
      <table className="w-full text-[14px]">
        <thead>
          <tr className="label-caps !text-[10px] text-left">
            <th className="px-5 py-3">When</th>
            <th className="px-5 py-3">Admin</th>
            <th className="px-5 py-3">Action</th>
            <th className="px-5 py-3">Details</th>
          </tr>
        </thead>
        <tbody>
          {!rows && !error && <tr><td colSpan={4} className="px-5 py-8 text-center text-ink-muted">Loading…</td></tr>}
          {rows?.length === 0 && (
            <tr><td colSpan={4} className="px-5 py-10 text-center text-ink-muted"><ScrollText className="mx-auto mb-2 text-brand-300" />Nothing logged yet</td></tr>
          )}
          {rows?.map((row) => (
            <tr key={row._id} className="border-t border-brand-100">
              <td className="px-5 py-3 text-ink-soft whitespace-nowrap" title={new Date(row.createdAt).toLocaleString()}>{timeAgo(row.createdAt)}</td>
              <td className="px-5 py-3 text-ink-soft whitespace-nowrap">{row.adminEmail}</td>
              <td className="px-5 py-3 text-ink whitespace-nowrap">
                <span className="font-semibold">{ACTION_LABEL[row.action] || row.action}</span>
                {row.targetEmail && <span className="text-ink-soft"> {row.targetEmail}</span>}
              </td>
              <td className="px-5 py-3 text-ink-muted">{row.detail || '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AuditLog;
