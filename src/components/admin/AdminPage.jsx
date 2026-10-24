import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft, Search, Sparkles, Clock, Users, X, Globe, Ban, Trash2, CheckCircle2, AlertTriangle, UserPlus, Activity, ShieldOff,
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { apiFetch } from '../../services/session';
import PlatformIcon from '../PlatformIcon';
import {
  STATUS_LABEL, TONE, displayUrl, formatMs, formatPercent, platformLabel, statusTone, timeAgo,
} from '../../utils/siteMetrics';

const request = async (path, options = {}) => {
  const response = await apiFetch(`${API_BASE_URL}/admin${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
};

const isWaiting = (u) => Boolean(u.upgradeRequestedAt) && u.plan !== 'pro' && u.role !== 'admin';

const FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'requests', label: 'Pro requests', match: isWaiting },
  { id: 'pro', label: 'Pro', match: (u) => u.plan === 'pro' && u.role !== 'admin' },
  { id: 'free', label: 'Free', match: (u) => u.plan !== 'pro' && u.role !== 'admin' },
  { id: 'suspended', label: 'Suspended', match: (u) => u.status === 'suspended' },
];

const StatCard = ({ icon: Icon, label, value, sub, tone = 'bg-brand-50 text-brand-600', onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`panel p-4 text-left flex items-center gap-3 min-w-0 ${onClick ? 'hover:-translate-y-0.5 hover:shadow-card-hover transition-all' : ''}`}>
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon size={18} /></span>
      <span className="min-w-0">
        <span className="block text-2xl font-extrabold text-ink tabular-nums leading-none">{value ?? '–'}</span>
        <span className="block text-[12px] font-semibold text-ink-muted mt-1 truncate">{label}{sub ? ` · ${sub}` : ''}</span>
      </span>
    </Tag>
  );
};

const PlanChip = ({ user }) => {
  if (user.role === 'admin') return <span className="chip !text-[12px] bg-brand-600 text-white"><Sparkles size={12} /> Admin</span>;
  if (user.status === 'suspended') return <span className="chip !text-[12px] bg-bad-soft text-bad"><Ban size={12} /> Suspended</span>;
  if (user.plan === 'pro') return <span className="chip !text-[12px] bg-brand-50 text-brand-700"><Sparkles size={12} /> Pro</span>;
  if (isWaiting(user)) return <span className="chip !text-[12px] bg-warn-soft text-warn"><Clock size={12} /> Requested {timeAgo(user.upgradeRequestedAt)}</span>;
  return <span className="chip !text-[12px] bg-canvas text-ink-muted">Free</span>;
};

// Side panel: one customer, their sites and every admin action
const CustomerPanel = ({ userId, onClose, onChanged }) => {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => request(`/users/${userId}`).then(setDetail).catch((err) => setError(err.message)), [userId]);
  useEffect(() => { load(); }, [load]);

  const act = async (label, body) => {
    setBusy(label);
    setError('');
    try {
      await request(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(body) });
      setDeclining(false);
      setReason('');
      await load();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    setBusy('delete');
    try {
      await request(`/users/${userId}`, { method: 'DELETE' });
      onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  const user = detail?.user;
  const isAdminAccount = user?.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-[2px] animate-fade-in" onClick={onClose}>
      <aside className="w-full sm:max-w-md h-full bg-white shadow-frame flex flex-col animate-slide-up sm:animate-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-brand-100">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink truncate">{user ? user.name || user.email.split('@')[0] : 'Customer'}</h2>
            <p className="text-[13px] text-ink-muted truncate">{user?.email}</p>
            {user && <div className="mt-2 flex flex-wrap gap-1.5"><PlanChip user={user} /></div>}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost shrink-0" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {error && <div className="text-sm font-semibold text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</div>}
          {!detail && !error && <p className="text-sm text-ink-muted">Loading…</p>}

          {user && (
            <>
              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                {[
                  ['Joined', new Date(user.createdAt).toLocaleDateString()],
                  ['Last sign-in', timeAgo(user.lastLoginAt)],
                  ['Sign-in method', user.hasPassword ? 'Email & password' : 'Google'],
                  ['Pro request', isWaiting(user) ? timeAgo(user.upgradeRequestedAt) : user.upgradeDeclinedAt ? `Declined ${timeAgo(user.upgradeDeclinedAt)}` : '–'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-canvas px-3 py-2.5">
                    <dt className="label-caps !text-[10px]">{k}</dt>
                    <dd className="font-semibold text-ink mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>

              {!isAdminAccount && (
                <section className="space-y-2">
                  <h3 className="label-caps">Plan</h3>
                  {isWaiting(user) && !declining && (
                    <div className="flex gap-2">
                      <button type="button" disabled={!!busy} onClick={() => act('approve', { plan: 'pro' })} className="btn-primary flex-1 !h-10">
                        <CheckCircle2 size={15} /> {busy === 'approve' ? 'Approving…' : 'Approve Pro'}
                      </button>
                      <button type="button" disabled={!!busy} onClick={() => setDeclining(true)} className="flex-1 h-10 rounded-xl border border-brand-200 text-ink-soft font-bold text-[12px] uppercase tracking-wider hover:bg-bad-soft hover:text-bad hover:border-bad-soft transition-colors">
                        Decline
                      </button>
                    </div>
                  )}
                  {declining && (
                    <div className="rounded-2xl border border-brand-100 p-3 space-y-2">
                      <label htmlFor="decline-reason" className="text-[13px] font-semibold text-ink">Message to the customer (optional)</label>
                      <textarea id="decline-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} placeholder="e.g. Please send your billing details to hiteshgml@gmail.com first." className="w-full rounded-xl bg-canvas p-3 text-sm text-ink focus:outline-hidden focus:ring-2 focus:ring-brand-300" />
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setDeclining(false)} className="h-9 px-4 rounded-lg text-[12px] font-bold uppercase tracking-wider text-ink-soft hover:bg-canvas">Cancel</button>
                        <button type="button" disabled={!!busy} onClick={() => act('decline', { declineRequest: true, reason })} className="h-9 px-4 rounded-lg bg-bad text-white text-[12px] font-bold uppercase tracking-wider">
                          {busy === 'decline' ? 'Declining…' : 'Decline request'}
                        </button>
                      </div>
                    </div>
                  )}
                  {!isWaiting(user) && (
                    <button type="button" disabled={!!busy} onClick={() => act('plan', { plan: user.plan === 'pro' ? 'free' : 'pro' })} className={user.plan === 'pro' ? 'w-full h-10 rounded-xl border border-brand-200 text-ink-soft font-bold text-[12px] uppercase tracking-wider hover:bg-canvas' : 'btn-primary w-full !h-10'}>
                      {busy === 'plan' ? 'Saving…' : user.plan === 'pro' ? 'Move to Free plan' : 'Make Pro'}
                    </button>
                  )}
                </section>
              )}

              <section>
                <h3 className="label-caps">Sites ({detail.sites.length})</h3>
                {detail.sites.length === 0 ? <p className="mt-2 text-[13px] text-ink-muted">No sites added yet.</p> : (
                  <ul className="mt-2 space-y-1.5">
                    {detail.sites.map((site) => {
                      const tone = TONE[statusTone(site.status)];
                      return (
                        <li key={site._id} className="rounded-xl bg-canvas px-3 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <PlatformIcon platform={site.platform} className="w-4 h-4 shrink-0" />
                            <span className="font-bold text-ink text-sm truncate flex-1">{site.name}</span>
                            <span className={`chip !text-[11px] ${tone.bg} ${tone.text}`}>{STATUS_LABEL[site.status] || 'Not checked'}</span>
                          </div>
                          <a href={site.url} target="_blank" rel="noreferrer" className="block text-[12px] text-brand-600 truncate mt-0.5 hover:underline">{displayUrl(site.url)}</a>
                          <div className="flex gap-3 text-[11px] text-ink-muted mt-1">
                            <span>{platformLabel(site.platform)}</span>
                            <span>{formatMs(site.responseTime)}</span>
                            <span>Uptime {formatPercent(site.uptime)}</span>
                            <span>Checked {timeAgo(site.lastChecked)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {detail.incidents.length > 0 && (
                <section>
                  <h3 className="label-caps">Recent downtime</h3>
                  <ul className="mt-2 space-y-1">
                    {detail.incidents.slice(0, 8).map((incident) => {
                      const site = detail.sites.find((s) => s._id === incident.websiteId);
                      return (
                        <li key={incident._id} className="flex items-start gap-2 text-[12px]">
                          <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${incident.endedAt ? 'bg-ink-faint' : 'bg-bad'}`} />
                          <span className="min-w-0">
                            <span className="font-semibold text-ink">{site?.name || 'Site'}</span>
                            <span className="text-ink-muted"> · {timeAgo(incident.startedAt)}{incident.endedAt ? '' : ' · still down'}</span>
                            {incident.message && <span className="block text-ink-muted truncate">{incident.message}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {!isAdminAccount && (
                <section className="space-y-2 pt-2 border-t border-brand-100">
                  <h3 className="label-caps pt-3">Account</h3>
                  <button type="button" disabled={!!busy} onClick={() => act('status', { status: user.status === 'suspended' ? 'active' : 'suspended' })} className="w-full h-10 rounded-xl border border-brand-200 text-ink-soft font-bold text-[12px] uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-canvas">
                    {user.status === 'suspended' ? <><CheckCircle2 size={15} /> Reactivate account</> : <><Ban size={15} /> Suspend account</>}
                  </button>
                  <p className="text-[12px] text-ink-muted">
                    {user.status === 'suspended' ? 'The customer can’t sign in and their sites aren’t checked.' : 'Suspending signs the customer out, blocks sign-in and pauses checks on their sites.'}
                  </p>
                  {!confirmDelete ? (
                    <button type="button" onClick={() => setConfirmDelete(true)} className="w-full h-10 rounded-xl text-bad font-bold text-[12px] uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-bad-soft">
                      <Trash2 size={15} /> Delete customer
                    </button>
                  ) : (
                    <div className="rounded-2xl bg-bad-soft p-3 space-y-2">
                      <p className="text-[13px] text-bad font-semibold">Delete {user.email}, their {detail.sites.length} site{detail.sites.length === 1 ? '' : 's'} and all history? This can’t be undone.</p>
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setConfirmDelete(false)} className="h-9 px-4 rounded-lg text-[12px] font-bold uppercase tracking-wider text-ink-soft hover:bg-white">Cancel</button>
                        <button type="button" disabled={busy === 'delete'} onClick={remove} className="h-9 px-4 rounded-lg bg-bad text-white text-[12px] font-bold uppercase tracking-wider">
                          {busy === 'delete' ? 'Deleting…' : 'Delete permanently'}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
};

// Admin: overview, customers, Pro requests and account controls
const AdminPage = () => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(() => Promise.all([request('/users'), request('/stats')])
    .then(([list, overview]) => { setUsers(list); setStats(overview); setError(''); })
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false)), []);

  useEffect(() => { load(); }, [load]);

  const approve = async (user) => {
    setSavingId(user._id);
    try {
      await request(`/users/${user._id}`, { method: 'PATCH', body: JSON.stringify({ plan: 'pro' }) });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const term = search.trim().toLowerCase();
  const { match } = FILTERS.find((f) => f.id === filter);
  const visible = users.filter((u) => match(u) && (!term || u.email.includes(term) || (u.name || '').toLowerCase().includes(term)));
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, users.filter(f.match).length]));

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-white border-b border-brand-100 px-4 sm:px-6 lg:px-10 py-5 flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app" className="btn-ghost" aria-label="Back to dashboard"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="text-2xl font-semibold text-ink">Customers</h1>
            <p className="text-sm text-ink-muted">Super admin · plans, Pro requests and accounts</p>
          </div>
        </div>
        <label className="flex items-center gap-2 bg-canvas rounded-xl px-4 h-11 w-full sm:w-72 focus-within:ring-2 focus-within:ring-brand-300">
          <Search size={16} className="text-brand-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-ink focus:outline-hidden" />
        </label>
      </header>

      <main className="p-4 sm:p-6 lg:p-10 space-y-6">
        {error && <div className="text-sm font-semibold text-bad bg-bad-soft rounded-xl px-4 py-3">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard icon={Users} label="Customers" value={stats?.customers} sub={stats && `${stats.activeLast7Days} active this week`} />
          <StatCard icon={Clock} label="Pro requests" value={stats?.pendingPro} tone="bg-warn-soft text-warn" onClick={() => setFilter('requests')} />
          <StatCard icon={Sparkles} label="Pro customers" value={stats?.pro} sub={stats && `${stats.free} free`} onClick={() => setFilter('pro')} />
          <StatCard icon={UserPlus} label="New in 7 days" value={stats?.newLast7Days} />
          <StatCard icon={Globe} label="Sites monitored" value={stats?.sites} sub={stats && `${stats.openIncidents} open incidents`} />
          <StatCard icon={stats?.sitesDown ? AlertTriangle : Activity} label="Sites down now" value={stats?.sitesDown} tone={stats?.sitesDown ? 'bg-bad-soft text-bad' : 'bg-good-soft text-good'} />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`h-9 px-4 rounded-xl text-[13px] font-bold whitespace-nowrap transition-colors ${filter === f.id ? 'bg-brand-600 text-white shadow-btn' : 'bg-white text-ink-soft hover:bg-brand-50'}`}
            >
              {f.label} <span className={filter === f.id ? 'text-white/70' : 'text-ink-muted'}>{counts[f.id]}</span>
            </button>
          ))}
        </div>

        <div className="panel overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="label-caps !text-[10px] text-left">
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Sites</th>
                <th className="px-5 py-3 whitespace-nowrap">Joined</th>
                <th className="px-5 py-3 whitespace-nowrap">Last sign-in</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-5 py-8 text-center text-ink-muted">Loading…</td></tr>}
              {!loading && visible.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-ink-muted"><Users className="mx-auto mb-2 text-brand-300" />{users.length === 0 ? 'No customers yet' : 'No customers match'}</td></tr>
              )}
              {visible.map((user) => (
                <tr key={user._id} onClick={() => setOpenId(user._id)} className="border-t border-brand-100 hover:bg-brand-50/50 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5">
                    <div className="font-bold text-ink">{user.name || user.email.split('@')[0]}</div>
                    <div className="text-[12px] text-ink-muted">{user.email}</div>
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft tabular-nums whitespace-nowrap">
                    {user.sites}
                    {user.sitesDown > 0 && <span className="ml-2 chip !text-[11px] bg-bad-soft text-bad">{user.sitesDown} down</span>}
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft whitespace-nowrap">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5 text-ink-soft whitespace-nowrap">{timeAgo(user.lastLoginAt)}</td>
                  <td className="px-5 py-3.5 whitespace-nowrap"><PlanChip user={user} /></td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {isWaiting(user) && user.status !== 'suspended' ? (
                      <div className="inline-flex gap-1.5">
                        <button type="button" disabled={savingId === user._id} onClick={() => approve(user)} className="btn-primary !h-9 !px-4">{savingId === user._id ? 'Saving…' : 'Approve'}</button>
                        <button type="button" onClick={() => setOpenId(user._id)} className="px-3 h-9 rounded-lg text-[12px] font-bold uppercase tracking-wider text-ink-soft hover:bg-bad-soft hover:text-bad transition-colors">Decline</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setOpenId(user._id)} className="px-4 h-9 rounded-lg text-[12px] font-bold uppercase tracking-wider text-brand-700 hover:bg-brand-50 transition-colors">
                        {user.status === 'suspended' ? <span className="inline-flex items-center gap-1.5"><ShieldOff size={13} /> Manage</span> : 'Manage'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {openId && <CustomerPanel userId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
};

export default AdminPage;
