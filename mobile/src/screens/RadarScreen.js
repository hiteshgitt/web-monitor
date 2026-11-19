import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { colors } from '../theme';
import { Panel } from '../ui';
import { SeverityChip } from './SecurityCards';

// Release Radar (Pro): PHP / Node.js / WordPress / Next.js security releases matched to the versions each site runs,
// what to do before the fix, the upgrade, and which sites are patched.
const STATE = {
  affected: { label: 'Action needed', fg: colors.bad, bg: colors.badSoft },
  patched: { label: 'Patched', fg: colors.good, bg: colors.goodSoft },
  up_to_date: { label: 'Up to date', fg: colors.good, bg: colors.goodSoft },
  not_exposed: { label: 'Not exposed', fg: colors.inkMuted, bg: colors.brandSoft },
};
const utc = (iso) => `${new Date(iso).toUTCString().slice(5, 22)} UTC`;

export default function RadarScreen({ session, isPro, onBack, onOpenSite, onExpired }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api('/radar', { token: session.token })
    .then((d) => { setData(d.advisories || []); setError(''); })
    .catch((err) => { if (err.status === 401) onExpired(); else setError(err.message); })
    .finally(() => setRefreshing(false)), [session.token, onExpired]);
  useEffect(() => { if (isPro) load(); }, [isPro, load]);

  const all = data || [];
  const totals = all.reduce((t, a) => ({ affected: t.affected + a.counts.affected, patched: t.patched + a.counts.patched }), { affected: 0, patched: 0 });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back"><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.h1}>Release Radar</Text>
        <Text style={styles.lead}>Security releases for PHP, Node.js, WordPress and Next.js, matched to the exact versions your sites run.</Text>
        {data ? (
          <View style={styles.totals}>
            <View style={styles.total}><Text style={styles.totalValue}>{totals.affected}</Text><Text style={styles.totalLabel}>Need action</Text></View>
            <View style={styles.total}><Text style={styles.totalValue}>{totals.patched}</Text><Text style={styles.totalLabel}>Patched</Text></View>
          </View>
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={styles.wrap}
        refreshControl={isPro ? <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} /> : undefined}
      >
        {!isPro ? <Panel><Text style={styles.body}>Release Radar is part of Pro: you hear about PHP, Node.js, WordPress and Next.js security releases that affect your sites, with what to do and proof each site is patched.</Text></Panel> : null}
        {isPro && !data && !error ? <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {data && all.length === 0 ? (
          <Panel>
            <Text style={styles.title}>Nothing on the radar for your sites</Text>
            <Text style={styles.body}>When a security release affects a version one of your sites runs, it appears here and you get a notification.</Text>
          </Panel>
        ) : null}
        {all.map((a) => (
          <Panel key={a.id}>
            <View style={styles.meta}>
              <SeverityChip severity={a.severity} />
              <Text style={styles.kicker}>{a.componentLabel} · {a.status === 'announced' ? 'fix not out yet' : 'fix released'}</Text>
            </View>
            <Text style={styles.title}>{a.title}</Text>
            {a.cves?.length ? <Text style={styles.mono}>{a.cves.join('  ')}</Text> : null}
            {a.summary ? <Text style={styles.body}>{a.summary}</Text> : null}
            <Text style={styles.muted}>
              {a.status === 'announced' && a.releaseAt ? `Fix due ${utc(a.releaseAt)}` : a.releasedAt ? `Released ${utc(a.releasedAt)}` : ''}
              {Object.keys(a.fixed || {}).length ? ` · Fixed in ${Object.values(a.fixed).join(', ')}` : ''}
            </Text>
            {a.url ? <Pressable onPress={() => Linking.openURL(a.url)} hitSlop={6}><Text style={styles.link}>Advisory ›</Text></Pressable> : null}
            {a.mitigation && a.counts.affected > 0 ? (
              <Text style={styles.mitigation}><Text style={styles.strong}>{a.status === 'announced' ? 'Do this now: ' : 'Until you upgrade: '}</Text>{a.mitigation}</Text>
            ) : null}
            {a.sites.map((s) => {
              const st = s.state === 'patched' && !s.patchedAt ? STATE.up_to_date : STATE[s.state] || STATE.affected;
              return (
                <Pressable key={s.id} onPress={() => onOpenSite(s.id)} style={styles.site}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.siteName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.muted}>
                      {a.componentLabel} {s.version}
                      {s.state === 'affected' && s.target ? ` → upgrade to ${s.target}` : ''}
                      {s.state === 'affected' && !s.target && a.status === 'released' ? ' → no fix for this branch: move to a supported one' : ''}
                      {s.state === 'patched' && s.hoursToPatch != null ? ` · patched in ${s.hoursToPatch} h` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.state, { color: st.fg, backgroundColor: st.bg }]}>{st.label}</Text>
                </Pressable>
              );
            })}
          </Panel>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, backgroundColor: colors.brand },
  back: { color: colors.white, fontSize: 15, fontWeight: '800' },
  h1: { marginTop: 12, color: colors.white, fontSize: 26, fontWeight: '800' },
  lead: { marginTop: 4, color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19 },
  totals: { flexDirection: 'row', gap: 10, marginTop: 14 },
  total: { flex: 1, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center' },
  totalValue: { color: colors.white, fontSize: 22, fontWeight: '800' },
  totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.inkMuted },
  title: { marginTop: 8, fontSize: 16, fontWeight: '800', color: colors.ink, lineHeight: 21 },
  mono: { marginTop: 4, fontFamily: 'monospace', fontSize: 11, color: colors.inkMuted },
  body: { marginTop: 6, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  strong: { fontWeight: '800', color: colors.ink },
  muted: { marginTop: 4, fontSize: 12, lineHeight: 17, color: colors.inkMuted },
  link: { marginTop: 6, color: colors.brand, fontSize: 13, fontWeight: '800' },
  mitigation: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: colors.warnSoft, color: colors.ink, fontSize: 13, lineHeight: 19 },
  site: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  siteName: { fontSize: 14, fontWeight: '800', color: colors.ink },
  state: { overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, fontSize: 11, fontWeight: '800' },
  error: { color: colors.bad, fontSize: 13 },
});
