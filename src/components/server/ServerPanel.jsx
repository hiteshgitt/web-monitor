import React, { useCallback, useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Server, Copy, Check, RefreshCw, ShieldAlert, Cpu, MemoryStick, HardDrive, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import { apiFetch } from '../../services/session';
import { timeAgo } from '../../utils/siteMetrics';

// Server agent (Pro): set-up (token + one install command) and what the agent reports: CPU, memory, top processes,
// filesystems with inodes, traffic per IP and attack attempts, and 24 hours of CPU / memory / requests.
const ATTACK = { sqli: 'SQL injection', xss: 'XSS', traversal: 'Path traversal', rce: 'Command injection', sensitive_probe: 'Secret-file probe', shell_probe: 'Web-shell probe', admin_bruteforce: 'Login brute force', scanner: 'Scanner' };
const mb = (b) => (b == null ? '—' : b >= 1073741824 ? `${(b / 1073741824).toFixed(1)} GB` : `${Math.round(b / 1048576)} MB`);
const pctTone = (p) => (p == null ? 'text-ink' : p >= 90 ? 'text-rose-600' : p >= 75 ? 'text-amber-600' : 'text-emerald-600');

const Card = ({ title, icon: Icon, children, aside }) => (
  <div className="bg-white rounded-2xl shadow-card border border-brand-100 overflow-hidden">
    <div className="px-6 py-4 border-b border-brand-100 flex items-center justify-between gap-3 bg-linear-to-r from-gray-50 to-white">
      <h3 className="text-[12px] font-extrabold text-ink uppercase tracking-widest flex items-center gap-2"><Icon size={16} className="text-brand-600" /> {title}</h3>
      {aside}
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const Setup = ({ siteId, onDone, rotate = false }) => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const create = async () => {
    setBusy(true); setError('');
    try {
      const r = await apiFetch(`${API_BASE_URL}/advanced/agent-token/${siteId}`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not create the token.');
      setResult(d);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const copy = () => { navigator.clipboard?.writeText(result.install); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="space-y-3 text-[14px] text-ink-soft">
      {!result ? (
        <>
          {!rotate && <p>Install a small read-only agent on your own server (VPS or dedicated, Linux with systemd and Python 3). Every minute it sends CPU, memory, the top processes, disks and inodes, and a summary of your nginx / Apache logs: requests per IP, floods and attack attempts. It never receives commands.</p>}
          <button type="button" onClick={create} disabled={busy} className="btn-primary !h-11">{busy ? 'Creating…' : rotate ? 'Create a new token (the old one stops working)' : 'Create agent token'}</button>
        </>
      ) : (
        <>
          <p className="font-semibold text-ink">Run this on the server as root. The token is shown only now.</p>
          <div className="relative">
            <pre className="rounded-xl bg-slate-900 text-slate-100 text-[12px] p-4 pr-24 overflow-x-auto whitespace-pre-wrap break-all">{result.install}</pre>
            <button type="button" onClick={copy} className="absolute top-2 right-2 h-8 px-3 rounded-lg bg-white/10 text-white text-[12px] font-bold flex items-center gap-1.5">{copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}</button>
          </div>
          <p className="text-[12px] text-ink-muted">The installer checks the agent's SHA-256, creates the unprivileged user webmonitor-agent (in the log group adm), and a hardened systemd service. Custom log paths: add <code>--access-logs "/path/*.log"</code>. Remove later with <code>… | sudo sh -s -- --uninstall</code>.</p>
          <button type="button" onClick={onDone} className="h-10 px-4 rounded-xl border border-brand-200 text-[13px] font-bold text-ink">I have run it</button>
        </>
      )}
      {error && <p className="text-sm font-semibold text-bad">{error}</p>}
    </div>
  );
};

const ServerPanel = ({ siteId }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [rotating, setRotating] = useState(false);

  const fetchView = useCallback(() => apiFetch(`${API_BASE_URL}/advanced/agent/${siteId}`)
    .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error || 'Could not load the server data.')))), [siteId]);
  useEffect(() => {
    let cancelled = false;
    const load = () => fetchView().then((d) => { if (!cancelled) { setData(d); setError(''); } }).catch((e) => { if (!cancelled) setError(e.message); });
    load();
    const t = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, [fetchView]);
  const reload = () => fetchView().then(setData).catch((e) => setError(e.message));
  const remove = async () => {
    if (!window.confirm('Remove the agent from this site? Its history is deleted; uninstall it on the server too.')) return;
    await apiFetch(`${API_BASE_URL}/advanced/agent-remove/${siteId}`, { method: 'POST' });
    reload();
  };

  if (error) return <p className="text-sm font-semibold text-bad">{error}</p>;
  if (!data) return <p className="text-sm text-ink-muted">Loading…</p>;
  if (!data.installed || rotating) {
    return <Card title="Server agent" icon={Server}><Setup siteId={siteId} rotate={rotating} onDone={() => { setRotating(false); reload(); }} /></Card>;
  }
  const s = data.snapshot;
  const series = (data.series || []).map((m) => ({ t: new Date(m.minute * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), cpu: m.cpu, mem: m.mem, requests: m.requests }));
  const status = data.online
    ? <span className="text-[12px] font-bold text-emerald-600">● Reporting · {timeAgo(data.lastSeen)}</span>
    : <span className="text-[12px] font-bold text-rose-600">● {data.lastSeen ? `Silent since ${timeAgo(data.lastSeen)}` : 'Waiting for the first snapshot'}</span>;

  return (
    <div className="space-y-5">
      <Card title={s?.hostname || 'Server agent'} icon={Server} aside={status}>
        {!s ? <p className="text-sm text-ink-soft">Token {data.tokenPrefix}… created {timeAgo(data.createdAt)}. Run the install command on the server; data appears within two minutes.</p> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[['CPU', s.cpu.percent != null ? `${s.cpu.percent}%` : '—', `${s.cpu.cores} cores · load ${s.cpu.load?.map((x) => x?.toFixed(2)).join(' ') || '—'}`, s.cpu.percent],
              ['Memory', s.memory.percent != null ? `${s.memory.percent}%` : '—', `${mb(s.memory.used)} of ${mb(s.memory.total)}${s.memory.swapPercent ? ` · swap ${s.memory.swapPercent}%` : ''}`, s.memory.percent],
              ['Requests / min', s.traffic.requests, `${s.traffic.status['5xx']} × 5xx · ${s.traffic.status['4xx']} × 4xx`, null],
              ['Uptime', s.uptimeSeconds ? `${Math.floor(s.uptimeSeconds / 86400)} d` : '—', `${s.processes.count} processes · agent ${s.agentVersion}`, null]].map(([label, value, sub, p]) => (
              <div key={label} className="rounded-2xl bg-brand-50/50 border border-brand-100 p-4">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-ink-muted">{label}</div>
                <div className={`text-xl font-extrabold ${pctTone(p)}`}>{value}</div>
                <div className="text-[11px] text-ink-muted mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {s && (
        <>
          {series.length > 1 && (
            <Card title="Last 24 hours" icon={Cpu}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8ebfb" />
                    <XAxis dataKey="t" tick={{ fontSize: 10 }} minTickGap={40} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip />
                    <Area type="monotone" dataKey="cpu" name="CPU %" stroke="#6c80e0" fill="#6c80e0" fillOpacity={0.15} />
                    <Area type="monotone" dataKey="mem" name="Memory %" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <div className="grid lg:grid-cols-2 gap-5">
            {[['Top processes by CPU', s.processes.topCpu, (p) => `${p.cpu ?? '—'}%`, Cpu], ['Top processes by memory', s.processes.topMemory, (p) => mb(p.rss), MemoryStick]].map(([title, list, val, Icon]) => (
              <Card key={title} title={title} icon={Icon}>
                <table className="w-full text-[13px]">
                  <thead><tr className="text-left text-[10px] uppercase tracking-widest text-ink-muted"><th className="pb-2">Process</th><th className="pb-2">User</th><th className="pb-2">PID</th><th className="pb-2 text-right">Use</th></tr></thead>
                  <tbody>{list.map((p) => <tr key={p.pid} className="border-t border-brand-50"><td className="py-1.5 font-semibold text-ink">{p.name}</td><td className="text-ink-muted">{p.user}</td><td className="text-ink-muted font-mono">{p.pid}</td><td className="text-right font-bold">{val(p)}</td></tr>)}</tbody>
                </table>
              </Card>
            ))}
          </div>

          <Card title="Disks and inodes" icon={HardDrive}>
            <div className="space-y-3">
              {s.filesystems.map((f) => (
                <div key={f.mount} className="flex flex-wrap items-center gap-3 text-[13px]">
                  <span className="font-mono font-semibold text-ink w-40 truncate">{f.mount}</span>
                  <div className="flex-1 min-w-[10rem] h-2 rounded-full bg-brand-50 overflow-hidden"><div className={`h-full ${f.percent >= 90 ? 'bg-rose-500' : f.percent >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${f.percent ?? 0}%` }} /></div>
                  <span className={`font-bold ${pctTone(f.percent)}`}>{f.percent}% of {mb(f.total)}</span>
                  <span className={`text-[12px] ${pctTone(f.inodesPercent)}`}>inodes {f.inodesPercent ?? '—'}%</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Traffic and attacks (last minute)" icon={ShieldAlert} aside={<span className="text-[11px] text-ink-muted">{s.traffic.logs.length ? s.traffic.logs.join(', ') : 'no access log found'}</span>}>
            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-widest text-ink-muted mb-2">Top IPs</div>
                {s.traffic.topIps.length === 0 ? <p className="text-sm text-ink-muted">No requests in the last minute.</p> : (
                  <table className="w-full text-[13px]"><tbody>{s.traffic.topIps.map((x) => (
                    <tr key={x.ip} className="border-t border-brand-50"><td className="py-1.5 font-mono">{x.ip}</td><td className="text-right">{x.requests} req</td><td className={`text-right font-bold ${x.peakRps >= 20 ? 'text-rose-600' : 'text-ink-muted'}`}>{x.peakRps}/s peak</td></tr>
                  ))}</tbody></table>
                )}
              </div>
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-widest text-ink-muted mb-2">Attack attempts</div>
                {s.traffic.attacks.length === 0 ? <p className="text-sm text-emerald-700">None in the last minute.</p> : (
                  <table className="w-full text-[13px]"><tbody>{s.traffic.attacks.map((a) => (
                    <tr key={`${a.ip}-${a.type}`} className="border-t border-brand-50"><td className="py-1.5 font-mono">{a.ip}</td><td className="font-semibold text-rose-700">{ATTACK[a.type] || a.type}</td><td className="text-right pr-3">{a.count}×</td><td className="text-ink-muted font-mono text-[11px] truncate max-w-[10rem]">{a.sample}</td></tr>
                  ))}</tbody></table>
                )}
              </div>
            </div>
            {s.errorLog.errors > 0 && <p className="mt-4 text-[13px] text-amber-800 bg-amber-50 rounded-xl px-4 py-2">{s.errorLog.errors} new error-log lines in the last minute.</p>}
          </Card>
        </>
      )}
      <div className="flex flex-wrap gap-2 justify-end">
        <button type="button" onClick={() => setRotating(true)} className="h-9 px-3 rounded-xl border border-brand-200 text-[12px] font-bold text-ink flex items-center gap-1.5"><RefreshCw size={13} /> New token</button>
        <button type="button" onClick={remove} className="h-9 px-3 rounded-xl border border-rose-200 text-[12px] font-bold text-rose-700 flex items-center gap-1.5"><Trash2 size={13} /> Remove agent</button>
      </div>
    </div>
  );
};

export default ServerPanel;
