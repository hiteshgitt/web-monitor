import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { colors } from '../theme';
import { Panel } from '../ui';
import RuyaShieldModal from './RuyaShieldModal';

const SEVERITIES = [
  ['critical', 'Critical', '#c5364c', '#fce7ea'],
  ['high', 'High', '#c2601a', '#fdeedf'],
  ['medium', 'Medium', '#a67c12', '#fbf3df'],
  ['low', 'Low', '#2f74b5', '#e6f0fb'],
  ['info', 'Info', '#8a90b2', '#eef1fb'],
];
const STYLE = Object.fromEntries(SEVERITIES.map(([key, , fg, bg]) => [key, { fg, bg }]));
const ASSESSMENT = {
  completed: 'Completed', completed_with_errors: 'Completed with errors', queued: 'Queued', running: 'Running',
  failed: 'Failed', timed_out: 'Timed out', cancelled: 'Cancelled', rejected: 'Rejected',
};

// RuyaShield findings for one site (Pro). Hidden when the integration is off for this deployment.
export default function RuyaShieldPanel({ siteId, session, onExpired }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback((refresh) => api(`/advanced/ruyashield/${siteId}${refresh ? '?refresh=1' : ''}`, { token: session.token, timeoutMs: 20000 })
    .then((next) => { setReport(next); setError(''); })
    .catch((err) => { if (err.status === 401) onExpired(); else setError(err.message); })
    .finally(() => setLoading(false)), [siteId, session.token, onExpired]);

  useEffect(() => { load(false); }, [load]);

  if (report && !report.configured) return null;
  const site = report?.site;
  const findings = site?.tracked ? site.findings : null;
  const last = site?.tracked ? site.lastAssessment : null;
  const refresh = () => { setLoading(true); load(true); };

  return (
    <Panel title="RuyaShield">
      {report?.connected ? (
        <View style={styles.head}>
          <Text style={styles.muted}>
            {report.orgName}{report.fetchedAt ? ` · updated ${new Date(report.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          </Text>
          <Pressable onPress={refresh} disabled={loading} hitSlop={8}>
            <Text style={styles.link}>{loading ? 'Refreshing…' : 'Refresh'}</Text>
          </Pressable>
        </View>
      ) : null}
      {loading && !report ? <ActivityIndicator color={colors.brand} style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {report?.error ? <Text style={styles.error}>{report.error}</Text> : null}

      {report && !report.connected ? (
        <>
          <Text style={styles.body}>Connect your RuyaShield account to see open vulnerabilities and the latest assessment for this site.</Text>
          <Pressable onPress={() => setConnecting(true)} style={styles.primary}>
            <Text style={styles.primaryText}>Connect RuyaShield</Text>
          </Pressable>
        </>
      ) : null}

      {report?.connected && site && !site.tracked ? (
        <>
          <Text style={styles.body}>
            <Text style={styles.strong}>{site.host}</Text> is not in your RuyaShield organisation yet. Add and verify it there to start scanning.
          </Text>
          {report.appUrl ? (
            <Pressable onPress={() => Linking.openURL(`${report.appUrl}/assets`)}>
              <Text style={styles.link}>Add in RuyaShield ›</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {site?.tracked ? (
        <>
          {site.asset.status !== 'verified' ? (
            <Text style={styles.warn}>Ownership of {site.host} is {String(site.asset.status).replace(/_/g, ' ')} in RuyaShield, so it is not being scanned.</Text>
          ) : null}
          {findings ? (
            <View style={styles.grid}>
              {SEVERITIES.map(([key, label, fg, bg]) => (
                <View key={key} style={[styles.tile, { backgroundColor: bg }]}>
                  <Text style={[styles.tileLabel, { color: fg }]}>{label}</Text>
                  <Text style={[styles.tileValue, { color: fg }]}>{findings.open[key]}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.body}>This token cannot read findings. Reconnect with a token that has the findings:read scope.</Text>
          )}
          {findings && findings.openTotal === 0 && last ? <Text style={styles.body}>No open findings from the latest assessment.</Text> : null}
          {(findings?.top || []).map((f, i) => (
            <View key={`${f.title}-${i}`} style={styles.finding}>
              <Text style={[styles.badge, { color: STYLE[f.severity]?.fg, backgroundColor: STYLE[f.severity]?.bg }]}>{f.severity.toUpperCase()}</Text>
              <Text style={styles.findingTitle} numberOfLines={2}>{f.title}</Text>
            </View>
          ))}
          <Text style={styles.muted}>
            {last
              ? `Last assessment: ${ASSESSMENT[last.status] || last.status}${last.finishedAt ? `, ${new Date(last.finishedAt).toLocaleString()}` : ''}${last.complete === false ? ' (some checks did not run)' : ''}`
              : 'No assessment has run for this site yet.'}
          </Text>
          <Pressable onPress={() => Linking.openURL(site.link)} style={styles.open}>
            <Text style={styles.link}>Open in RuyaShield ›</Text>
          </Pressable>
        </>
      ) : null}

      <RuyaShieldModal
        visible={connecting}
        session={session}
        onClose={() => setConnecting(false)}
        onChanged={() => { setConnecting(false); setLoading(true); load(true); }}
        onExpired={onExpired}
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  spinner: { marginVertical: 14 },
  body: { marginBottom: 10, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  strong: { fontWeight: '800', color: colors.ink },
  muted: { fontSize: 12, lineHeight: 17, color: colors.inkMuted, flexShrink: 1 },
  error: { marginBottom: 10, color: colors.bad, fontSize: 13, lineHeight: 19 },
  warn: { marginBottom: 10, padding: 10, borderRadius: 12, backgroundColor: colors.warnSoft, color: colors.warn, fontSize: 13, lineHeight: 19 },
  link: { color: colors.brand, fontSize: 14, fontWeight: '800' },
  primary: { height: 46, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  tile: { flexGrow: 1, minWidth: 84, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  tileLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  tileValue: { marginTop: 2, fontSize: 20, fontWeight: '800' },
  finding: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  badge: { overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontSize: 10, fontWeight: '800' },
  findingTitle: { flex: 1, fontSize: 14, color: colors.ink },
  open: { marginTop: 10 },
});
