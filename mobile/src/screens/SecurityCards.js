import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { timeAgo } from '../metrics';
import { colors } from '../theme';
import { Panel } from '../ui';

// Known vulnerabilities and suspicious files for the Advanced → Security section (Pro). Same data and wording as
// the web app's panels.

export const SEVERITY = {
  critical: { fg: '#ffffff', bg: '#c5364c' },
  high: { fg: '#c5364c', bg: '#fce7ea' },
  moderate: { fg: '#a67c12', bg: '#fbf3df' },
  medium: { fg: '#a67c12', bg: '#fbf3df' },
  low: { fg: '#2f74b5', bg: '#e6f0fb' },
  unknown: { fg: colors.inkMuted, bg: colors.brandSoft },
};

export function SeverityChip({ severity, muted }) {
  const s = muted ? SEVERITY.unknown : SEVERITY[severity] || SEVERITY.unknown;
  return <Text style={[styles.chip, { color: s.fg, backgroundColor: s.bg }]}>{severity === 'unknown' ? 'SEVERITY N/A' : String(severity).toUpperCase()}</Text>;
}

// The fixed version for this site's own branch (PHP / WordPress by major.minor, Node.js / Next.js by major).
const siteTarget = (a) => {
  const parts = String(a.versionSeen || '').split('.');
  const branch = a.component === 'php' || a.component === 'wordpress' ? parts.slice(0, 2).join('.') : parts[0];
  return a.fixed?.[branch] || null;
};
const utc = (iso) => `${new Date(iso).toUTCString().slice(5, 22)} UTC`;

export function VulnerabilitiesCard({ data, platform, onOpenRadar }) {
  const known = data?.knownVulnerabilities;
  const inventory = data?.libraries || data?.packages;
  const runtime = known?.runtime || [];
  const live = inventory?.vulnerability_check === 'ok';
  const open = (data?.advisories || []).filter((a) => a.siteState === 'affected');
  // A Next.js release on the Release Radar already covers the vulnerable "next" package: show it once.
  const packages = (live ? inventory.vulnerable || [] : known?.packages || []).filter((p) => !(p.name === 'next' && open.some((a) => a.component === 'nextjs')));
  const failed = inventory?.vulnerability_check === 'failed';
  const checksPackages = ['nextjs', 'laravel', 'php', 'codeigniter'].includes(platform);
  const total = runtime.length + packages.length + open.length;

  return (
    <Panel title="Known vulnerabilities">
      {total > 0 ? <Text style={styles.count}>{total} found</Text> : null}
      {total === 0 ? (
        <Text style={styles.body}>
          {failed
            ? 'The vulnerability database could not be reached just now, so packages were not checked. The hourly check will try again.'
            : `No known vulnerabilities in ${checksPackages ? 'the installed packages or ' : ''}the PHP, Node.js or WordPress version this site reports.`}
          {platform === 'wordpress' ? ' WordPress plugins are not covered yet; WordPress itself and PHP are.' : ''}
        </Text>
      ) : null}
      {open.map((a) => (
        <View key={a.id} style={[styles.item, styles.itemBad]}>
          <View style={styles.meta}>
            <SeverityChip severity={a.severity} />
            <Text style={styles.kicker}>Release Radar · {a.componentLabel} {a.versionSeen}</Text>
          </View>
          <Text style={styles.title}>{a.title}</Text>
          <Text style={styles.body}>
            <Text style={styles.todo}>What to do: </Text>
            {a.status === 'released'
              ? (siteTarget(a) ? `upgrade ${a.componentLabel} to ${siteTarget(a)}.` : 'this branch gets no fix: move to a supported version.')
              : `the fix is due ${a.releaseAt ? utc(a.releaseAt) : 'soon'}.`}
            {a.mitigation ? ` ${a.status === 'released' ? 'Until then' : 'Now'}: ${a.mitigation}` : ''}
          </Text>
          {onOpenRadar ? <Pressable onPress={onOpenRadar} hitSlop={6}><Text style={styles.link}>Open Release Radar ›</Text></Pressable> : null}
        </View>
      ))}
      {runtime.map((r) => (
        <View key={r.key} style={[styles.item, styles.itemBad]}>
          <View style={styles.meta}>
            <SeverityChip severity={r.severity} />
            <Text style={styles.kicker}>{r.component} {r.version}</Text>
          </View>
          <Text style={styles.title}>{r.title}</Text>
          <Text style={styles.body}><Text style={styles.todo}>What to do: </Text>{r.fix}</Text>
        </View>
      ))}
      {packages.map((p) => (
        <View key={`${p.name}@${p.version}`} style={styles.item}>
          <View style={styles.meta}>
            <SeverityChip severity={p.severity} />
            <Text style={styles.pkg}>{p.name}</Text>
            <Text style={styles.kicker}>v{p.version}</Text>
            {p.cvss?.score != null ? <Text style={styles.kicker}>CVSS {Number(p.cvss.score).toFixed(1)}</Text> : null}
          </View>
          {p.aliases?.[0] || p.ids?.[0] ? <Text style={styles.mono}>{p.aliases?.[0] || p.ids[0]}{p.ids?.length > 1 ? ` +${p.ids.length - 1}` : ''}</Text> : null}
          {p.summary ? <Text style={styles.body}>{p.summary}</Text> : null}
          <Text style={styles.body}>
            <Text style={styles.todo}>What to do: </Text>
            {p.fixed ? `update to ${p.fixed} or later.` : p.fixAbove ? `update to a version newer than ${p.fixAbove}.` : 'no fixed release yet: check the advisory for a workaround.'}
          </Text>
          {p.url ? <Pressable onPress={() => Linking.openURL(p.url)} hitSlop={6}><Text style={styles.link}>Advisory ›</Text></Pressable> : null}
        </View>
      ))}
      <Text style={styles.note}>
        Packages are checked against OSV.dev (GitHub advisories for npm and Packagist); PHP and Node.js against their end-of-life dates and security releases; WordPress against WordPress.org.
      </Text>
    </Panel>
  );
}

const SETUP = {
  wordpress: 'Update the Web Monitor plugin to 1.6.0 or later to turn the file scan on.',
  laravel: 'Update ruyalab/webmonitor-laravel to 1.5.0 or later to turn the file scan on.',
  codeigniter: 'Update ruyalab/webmonitor-codeigniter to 1.5.0 or later to turn the file scan on.',
  php: 'Download the Core PHP integration again (1.5.0 or later) to turn the file scan on.',
  nextjs: 'Update @ruyalab/webmonitor-nextjs to 1.5.0 or later and deploy to turn the file scan on.',
};
const RUNTIME_NOTE = 'This site runs on a serverless or edge runtime without a file system of its own (for example Cloudflare Workers), so there are no server files to scan.';

export function SuspiciousFilesCard({ siteId, platform, session, onExpired }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const fail = useCallback((err) => { if (err.status === 401) onExpired(); else setError(err.message); }, [onExpired]);
  useEffect(() => {
    api(`/advanced/filescan/${siteId}`, { token: session.token }).then(setData).catch(fail);
  }, [siteId, session.token, fail]);

  if (data && !data.supported) return null;
  const st = data?.state;
  const findings = data?.findings || [];
  const open = findings.filter((f) => f.status === 'open');
  const shown = findings.filter((f) => f.status !== 'cleared');
  const toggle = async (f) => {
    setBusy(f.id);
    try {
      setData(await api(`/advanced/filescan-ignore/${siteId}`, { method: 'POST', token: session.token, body: { id: f.id, ignore: f.status === 'open' } }));
    } catch (err) { fail(err); } finally { setBusy(''); }
  };
  const progress = st?.unsupported ? null : st?.cycleComplete
    ? `Last full scan ${timeAgo(st.cycleCompleted || data?.scannedAt)}: ${st.filesTotal ?? '?'} files`
    : st ? `Scanning: ${st.filesDone}${st.filesTotal ? ` of about ${st.filesTotal}` : ''} files` : 'The first scan starts within a few minutes.';

  return (
    <Panel title="Suspicious files">
      {!data && !error ? <ActivityIndicator color={colors.brand} style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {progress ? <Text style={styles.muted}>{progress}{open.length ? ` · ${open.length} open` : ''}</Text> : null}
      {st?.unsupported ? <Text style={styles.warn}>{st.unsupported === 'runtime' ? RUNTIME_NOTE : SETUP[platform] || 'Update the integration to turn the file scan on.'}</Text> : null}
      {data && !st?.unsupported && shown.length === 0 ? (
        <Text style={styles.body}>
          {st?.cycleComplete ? 'Nothing suspicious: no code in uploads, no known backdoors or web shells, no injected code' : 'No findings yet'}
          {st?.coreIntegrity?.status === 'ok' ? ', and WordPress core matches the official release.' : '.'}
        </Text>
      ) : null}
      {shown.map((f) => {
        const ignored = f.status === 'ignored';
        return (
          <View key={f.id} style={[styles.item, !ignored && styles.itemBad, ignored && styles.itemMuted]}>
            <View style={styles.meta}>
              {ignored ? <Text style={styles.ignored}>MARKED SAFE</Text> : <SeverityChip severity={f.severity} />}
            </View>
            <Text style={[styles.title, ignored && styles.dim]}>{f.title}</Text>
            <Text style={styles.mono} selectable>{f.path}{f.line ? `:${f.line}` : ''}</Text>
            {f.snippet ? <Text style={[styles.code, ignored && styles.codeDim]} selectable>{f.snippet}</Text> : null}
            <Text style={styles.muted}>Found {timeAgo(f.firstSeen)}{f.fileModified ? ` · file changed ${timeAgo(f.fileModified)}` : ''}</Text>
            <Pressable onPress={() => toggle(f)} disabled={busy === f.id} style={styles.action} hitSlop={6}>
              <Text style={styles.link}>{busy === f.id ? 'Saving…' : ignored ? 'Watch again' : 'Mark as safe'}</Text>
            </Pressable>
          </View>
        );
      })}
      {open.length ? (
        <Text style={styles.body}>
          <Text style={styles.strong}>If a file is not yours: </Text>
          take a backup, delete or restore the file, change admin, FTP and database passwords, update everything, then check the site again. A full scan confirms it is gone.
        </Text>
      ) : null}
      <Text style={styles.note}>Read-only scan inside your site: files are read, never executed, changed or deleted.</Text>
    </Panel>
  );
}

export const styles = StyleSheet.create({
  spinner: { marginVertical: 14 },
  count: { position: 'absolute', top: 16, right: 16, color: colors.bad, fontSize: 12, fontWeight: '800' },
  chip: { overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  ignored: { overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: colors.inkMuted, backgroundColor: colors.brandSoft },
  item: { marginTop: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  itemBad: { borderColor: '#f6cdd4', backgroundColor: '#fdf5f6' },
  itemMuted: { backgroundColor: colors.white },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.inkMuted, flexShrink: 1 },
  pkg: { fontSize: 14, fontWeight: '800', color: colors.ink },
  title: { marginTop: 6, fontSize: 14, fontWeight: '800', color: colors.ink, lineHeight: 19 },
  dim: { color: colors.inkSoft, fontWeight: '700' },
  body: { marginTop: 6, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  strong: { fontWeight: '800', color: colors.ink },
  todo: { fontWeight: '800', color: colors.brandDark },
  mono: { marginTop: 4, fontFamily: 'monospace', fontSize: 12, color: colors.brandDark },
  code: { marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: '#161b3d', color: '#e8ebfa', fontFamily: 'monospace', fontSize: 12 },
  codeDim: { backgroundColor: '#5b6080' },
  muted: { marginTop: 6, fontSize: 12, lineHeight: 17, color: colors.inkMuted },
  note: { marginTop: 12, fontSize: 11, lineHeight: 16, color: colors.inkMuted },
  link: { color: colors.brand, fontSize: 13, fontWeight: '800', marginTop: 8 },
  action: { alignSelf: 'flex-start' },
  error: { marginTop: 6, color: colors.bad, fontSize: 13, lineHeight: 19 },
  warn: { marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: colors.warnSoft, color: colors.warn, fontSize: 13, lineHeight: 19 },
});
