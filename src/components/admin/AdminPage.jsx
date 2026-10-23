import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Search, Sparkles, Clock, Users } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { apiFetch } from '../../services/session';
import { timeAgo } from '../../utils/siteMetrics';

const fetchCustomers = async () => {
  const response = await apiFetch(`${API_BASE_URL}/admin/users`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to load customers');
  return data;
};

// Admin: see customers and switch them between Free and Pro (manual billing for now)
const AdminPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState(null);

  const load = () => fetchCustomers()
    .then((data) => { setUsers(data); setError(''); })
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false));

  useEffect(() => {
    fetchCustomers()
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const setPlan = async (user, plan) => {
    setSavingId(user._id);
    try {
      const response = await apiFetch(`${API_BASE_URL}/admin/users/${user._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Update failed');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const term = search.trim().toLowerCase();
  const visible = users.filter((u) => !term || u.email.includes(term) || (u.name || '').toLowerCase().includes(term));
  const pending = users.filter((u) => u.upgradeRequestedAt && u.plan !== 'pro').length;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-white border-b border-brand-100 px-6 lg:px-10 py-5 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app" className="btn-ghost" aria-label="Back to dashboard"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="text-2xl font-semibold text-ink">Customers</h1>
            <p className="text-sm text-ink-muted">{users.length} accounts · {pending} waiting for Pro</p>
          </div>
        </div>
        <label className="flex items-center gap-2 bg-canvas rounded-xl px-4 h-11 w-full sm:w-72 focus-within:ring-2 focus-within:ring-brand-300">
          <Search size={16} className="text-brand-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="flex-1 bg-transparent text-sm font-semibold text-ink focus:outline-hidden" />
        </label>
      </header>

      <main className="p-6 lg:p-10">
        {error && <div className="mb-4 text-sm font-semibold text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</div>}
        <div className="panel overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="label-caps !text-[10px] text-left">
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Sites</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3">Last sign-in</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-5 py-8 text-center text-ink-muted">Loading…</td></tr>}
              {!loading && visible.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-ink-muted"><Users className="mx-auto mb-2 text-brand-300" />No customers yet</td></tr>
              )}
              {visible.map((user) => {
                const isPro = user.plan === 'pro';
                const waiting = user.upgradeRequestedAt && !isPro;
                return (
                  <tr key={user._id} className="border-t border-brand-100 hover:bg-brand-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-ink">{user.name || user.email.split('@')[0]}</div>
                      <div className="text-[12px] text-ink-muted">{user.email}{user.role === 'admin' && ' · admin'}</div>
                    </td>
                    <td className="px-5 py-3.5 text-ink-soft tabular-nums">{user.sites}</td>
                    <td className="px-5 py-3.5 text-ink-soft">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-ink-soft">{timeAgo(user.lastLoginAt)}</td>
                    <td className="px-5 py-3.5">
                      {user.role === 'admin' ? (
                        <span className="chip !text-[12px] bg-brand-600 text-white"><Sparkles size={12} /> Admin · Pro access</span>
                      ) : isPro ? (
                        <span className="chip !text-[12px] bg-brand-50 text-brand-700"><Sparkles size={12} /> Pro</span>
                      ) : waiting ? (
                        <span className="chip !text-[12px] bg-warn-soft text-warn"><Clock size={12} /> Requested {timeAgo(user.upgradeRequestedAt)}</span>
                      ) : (
                        <span className="chip !text-[12px] bg-canvas text-ink-muted">Free</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {user.role !== 'admin' && <button
                        type="button"
                        disabled={savingId === user._id}
                        onClick={() => setPlan(user, isPro ? 'free' : 'pro')}
                        className={isPro
                          ? 'px-4 h-9 rounded-lg text-[12px] font-bold uppercase tracking-wider text-ink-soft hover:bg-bad-soft hover:text-bad transition-colors'
                          : 'btn-primary !h-9 !px-4'}
                      >
                        {savingId === user._id ? 'Saving…' : isPro ? 'Set to Free' : 'Make Pro'}
                      </button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
