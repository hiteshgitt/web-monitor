import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { api } from '../api';
import { timeAgo } from '../metrics';
import { colors } from '../theme';
import { Panel, ProgressBar } from '../ui';
import { styles } from './SecurityCards';

// Advanced → Server (Pro): the optional read-only agent on the customer's own server. Set-up (token + install
// command, shared to wherever they keep it) and what it reports: CPU, memory, processes, disks, traffic, attacks.
const ATTACK = { sqli: 'SQL injection', xss: 'XSS', traversal: 'Path traversal', rce: 'Command injection', sensitive_probe: 'Secret-file probe', shell_probe: 'Web-shell probe', admin_bruteforce: 'Login brute force', scanner: 'Scanner' };
const GB = (b) => (b == null ? '--' : b >= 1e12 ? `${(b / 1e12).toFixed(1)} TB` : b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);
const tone = (p) => (p == null ? 'muted' : p >= 90 ? 'bad' : p >= 75 ? 'warn' : 'good');
const toneText = { good: colors.good, warn: colors.warn, bad: colors.bad, muted: colors.inkMuted };
const uptime = (s) => (s == null ? '--' : s >= 86400 ? `${Math.floor(s / 86400)} d` : `${Math.floor(s / 3600)} h`);

function Lines({ series }) {
  const [width, setWidth] = useState(0);
  const h = 110;
  if (!series || series.length < 2) return <Text style={styles.muted}>The 24-hour chart fills in as minutes arrive.</Text>;
  const path = (key) => series.map((p, i) => `${i ? 'L' : 'M'}${((i / (series.length - 1)) * width).toFixed(1)},${(h - (Math.max(0, Math.min(100, p[key] ?? 0)) / 100) * h).toFixed(1)}`).join(' ');
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ marginTop: 8 }}>
      {width > 0 ? (
        <Svg width={width} height={h}>
          <Path d={path('mem')} stroke={colors.good} strokeWidth={2} fill="none" />
          <Path d={path('cpu')} stroke={colors.brand} strokeWidth={2} fill="none" />
        </Svg>
      ) : <View style={{ height: h }} />}
      <Text style={styles.muted}><Text style={{ color: colors.brand, fontWeight: '800' }}>CPU</Text> and <Text style={{ color: colors.good, fontWeight: '800' }}>memory</Text>, 0–100 %, last 24 hours</Text>
    </View>
  );
}

function Stat({ label, value, detail, color }) {
  return (
    <View style={{ flexGrow: 1, minWidth: '45%', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line }}>
      <Text style={styles.kicker}>{label}</Text>
      <Text style={{ marginTop: 4, fontSize: 20, fontWeight: '800', color: color || colors.ink }}>{value}</Text>
      {detail ? <Text style={styles.muted}>{detail}</Text> : null}
    </View>
  );
}

export default function ServerSection({ siteId, session, onExpired }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [setup, setSetup] = useState(null);
  const [busy, setBusy] = useState(false);

  const fail = useCallback((err) => { if (err.status === 401) onExpired(); else setError(err.message); }, [onExpired]);
  const load = useCallback(() => api(`/advanced/agent/${siteId}`, { token: session.token }).then(setData).catch(fail), [siteId, session.token, fail]);
  useEffect(() => { load(); }, [load]);

  const createToken = async () => {
    setBusy(true);
    setError('');
    try { setSetup(await api(`/advanced/agent-token/${siteId}`, { method: 'POST', token: session.token })); load(); } catch (err) { fail(err); } finally { setBusy(false); }
  };
  const remove = () => Alert.alert('Remove the agent?', 'Its history is deleted. Uninstall it on the server too.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => { try { setData(await api(`/advanced/agent-remove/${siteId}`, { method: 'POST', token: session.token })); setSetup(null); } catch (err) { fail(err); } } },
  ]);

  if (!data && !error) return <Panel title="Server"><ActivityIndicator color={colors.brand} style={styles.spinner} /></Panel>;
  const s = data?.snapshot;
  const t = s?.traffic;

  const setupBox = (
    <>
      {setup ? (
        <>
          <Text style={styles.body}>Run this on your server as root. The token is shown once.</Text>
          <Text style={styles.code} selectable>{setup.install}</Text>
          <Pressable onPress={() => Share.share({ message: setup.install })} style={{ marginTop: 10, height: 44, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.white, fontWeight: '800' }}>Share install command</Text>
          </Pressable>
          <Text style={styles.note}>The installer checks the agent’s SHA-256 and creates an unprivileged user and a hardened systemd service. Remove later with … | sudo sh -s -- --uninstall</Text>
        </>
      ) : (
        <Pressable onPress={createToken} disabled={busy} style={{ marginTop: 10, height: 44, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
          <Text style={{ color: colors.white, fontWeight: '800' }}>{busy ? 'Creating…' : data?.installed ? 'New token' : 'Set up the agent'}</Text>
        </Pressable>
      )}
    </>
  );

  if (!data?.installed) {
    return (
      <Panel title="Server">
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.body}>
          Optional, for your own server (VPS or dedicated, Linux with systemd and Python 3). A small read-only agent sends CPU, memory, the top processes, disks and inodes, and a summary of your nginx / Apache logs every minute: requests per IP, floods and attack attempts. It never receives commands.
        </Text>
        {setupBox}
      </Panel>
    );
  }

  return (
    <>
      <Panel title={s?.hostname || data.hostname || 'Server'}>
        <Text style={[styles.kicker, { position: 'absolute', top: 16, right: 16, color: data.online ? colors.good : colors.bad }]}>
          {data.online ? `Reporting · ${timeAgo(data.lastSeen)}` : data.lastSeen ? `Silent since ${timeAgo(data.lastSeen)}` : 'Waiting'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!s ? <Text style={styles.body}>Token {data.tokenPrefix}… created {timeAgo(data.createdAt)}. Run the install command on the server; data appears within two minutes.</Text> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            <Stat label="CPU" value={`${s.cpu?.percent ?? '--'}%`} color={toneText[tone(s.cpu?.percent)]} detail={`${s.cpu?.cores ?? '?'} cores · load ${(s.cpu?.load || []).map((l) => l.toFixed(2)).join(' ')}`} />
            <Stat label="Memory" value={`${s.memory?.percent ?? '--'}%`} color={toneText[tone(s.memory?.percent)]} detail={`${GB(s.memory?.used)} of ${GB(s.memory?.total)}`} />
            <Stat label="Requests / min" value={t?.requests ?? '--'} detail={t ? `${t.status?.['5xx'] ?? 0} × 5xx · ${t.status?.['4xx'] ?? 0} × 4xx` : 'No web logs found'} />
            <Stat label="Uptime" value={uptime(s.uptimeSeconds)} detail={`${s.processes?.count ?? '?'} processes · agent ${s.agentVersion || data.agentVersion || ''}`} />
          </View>
        )}
        {s ? <Lines series={data.series} /> : null}
      </Panel>

      {s ? (
        <Panel title="Top processes">
          {[['CPU', s.processes?.topCpu, (p) => `${p.cpu}%`], ['Memory', s.processes?.topMemory, (p) => GB(p.rss)]].map(([label, list, val]) => (
            <View key={label} style={{ marginTop: 6 }}>
              <Text style={styles.kicker}>By {label}</Text>
              {(list || []).map((p) => (
                <View key={`${label}-${p.pid}`} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line }}>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.ink }} numberOfLines={1}>{p.name} <Text style={styles.muted}>{p.user}</Text></Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>{val(p)}</Text>
                </View>
              ))}
            </View>
          ))}
        </Panel>
      ) : null}

      {s?.filesystems?.length ? (
        <Panel title="Disks and inodes">
          {s.filesystems.map((f) => (
            <View key={f.mount} style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[styles.mono, { marginTop: 0 }]}>{f.mount}</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: toneText[tone(f.percent)] }}>{f.percent}% of {GB(f.total)}</Text>
              </View>
              <ProgressBar value={f.percent} tone={tone(f.percent)} />
              {f.inodesPercent != null ? <Text style={[styles.muted, { color: toneText[tone(f.inodesPercent)] }]}>inodes {f.inodesPercent}%</Text> : null}
            </View>
          ))}
        </Panel>
      ) : null}

      {t ? (
        <Panel title="Traffic and attacks (last minute)">
          <Text style={styles.kicker}>Top IPs</Text>
          {(t.topIps || []).map((ip) => (
            <View key={ip.ip} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line }}>
              <Text style={[styles.mono, { marginTop: 0, flex: 1 }]} selectable>{ip.ip}</Text>
              <Text style={{ fontSize: 13, color: colors.inkSoft, marginRight: 12 }}>{ip.requests} req</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: ip.peakRps >= 20 ? colors.bad : colors.inkMuted }}>{ip.peakRps}/s peak</Text>
            </View>
          ))}
          <Text style={[styles.kicker, { marginTop: 12 }]}>Attack attempts</Text>
          {(t.attacks || []).length ? t.attacks.map((a, i) => (
            <View key={`${a.ip}-${a.type}-${i}`} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.bad }}>{ATTACK[a.type] || a.type}</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>{a.count}×</Text>
              </View>
              <Text style={styles.muted} selectable>{a.ip} · {a.sample}</Text>
            </View>
          )) : <Text style={styles.muted}>None in the last minute.</Text>}
          {s.errorLog?.errors ? <Text style={styles.warn}>{s.errorLog.errors} new error-log lines in the last minute.</Text> : null}
        </Panel>
      ) : null}

      <Panel>
        {setupBox}
        <Pressable onPress={remove} hitSlop={6} style={{ marginTop: 12, alignSelf: 'center' }}>
          <Text style={{ color: colors.bad, fontWeight: '800', fontSize: 13 }}>Remove agent</Text>
        </Pressable>
      </Panel>
    </>
  );
}
