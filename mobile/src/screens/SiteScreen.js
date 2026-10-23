import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import {
  STATUS_LABEL, UP_STATUSES, availability, clock, displayUrl, formatMs, formatPercent, formatRatio,
  healthScore, latencySeries, scoreTone, statusTone, timeAgo,
} from '../metrics';
import { colors, toneColor } from '../theme';
import { KeyValue, MetricCard, Panel, ScoreRing, Sparkline } from '../ui';

const TABS = ['Overview', 'Performance', 'SEO', 'Security', 'History', 'Advanced'];

const HERO = {
  good: { bg: '#1f9d68', title: 'All systems healthy' },
  warn: { bg: '#b8881d', title: 'Needs attention' },
  bad: { bg: '#c5364c', title: 'Check failing' },
  muted: { bg: '#5868cf', title: 'Waiting for first check' },
};

export default function SiteScreen({ siteId, session, onBack, onExpired }) {
  const [site, setSite] = useState(null);
  const [checks, setChecks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [plugins, setPlugins] = useState(null);
  const [pluginError, setPluginError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [tab, setTab] = useState('Overview');
  const scrollRef = useRef(null);

  const load = useCallback(async () => {
    const token = session.token;
    try {
      const [nextSite, nextChecks, nextIncidents] = await Promise.all([
        api(`/websites/${siteId}`, { token }),
        api(`/websites/${siteId}/monitoring?hours=24&limit=1440`, { token }),
        api(`/websites/${siteId}/incidents?days=30`, { token }),
      ]);
      let nextPlugins = null;
      let nextPluginError = '';
      if (session.user?.isPro) {
        try {
          nextPlugins = await api(`/advanced/plugins/${siteId}`, { token });
          if (nextPlugins?.error) {
            nextPluginError = nextPlugins.error;
            nextPlugins = null;
          }
        } catch (err) {
          if (err.status === 401) throw err;
          nextPluginError = err.message;
        }
      }
      setSite(nextSite);
      setChecks(Array.isArray(nextChecks) ? nextChecks : []);
      setIncidents(Array.isArray(nextIncidents) ? nextIncidents : []);
      setPlugins(nextPlugins);
      setPluginError(nextPluginError);
      setError('');
    } catch (err) {
      if (err.status === 401) onExpired();
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [siteId, session.token, session.user?.isPro, onExpired]);

  useEffect(() => { load(); }, [load]);

  const chooseTab = (name) => {
    setTab(name);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const runCheck = async () => {
    setChecking(true);
    try {
      await api(`/websites/${siteId}/test`, { method: 'POST', token: session.token });
      await load();
    } catch (err) {
      if (err.status === 401) onExpired();
      else setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  const passed = availability(checks);
  const series = useMemo(() => latencySeries(checks), [checks]);
  const down = site?.status === 'error' || site?.status === 'offline';
  const score = healthScore(site);
  const tone = toneColor[down ? 'bad' : scoreTone(score)];
  const status = toneColor[statusTone(site?.status)];
  const hero = HERO[site?.status === 'offline' ? 'bad' : statusTone(site?.status)] || HERO.muted;
  const seo = site?.seo || {};
  const sec = site?.security || {};
  const perf = site?.performance || {};
  const threshold = site?.settings?.alertThresholds?.responseTime || 5000;
  const isUp = UP_STATUSES.includes(site?.status);
  const speedProgress = isUp && site?.responseTime != null
    ? Math.max(4, 100 - (site.responseTime / threshold) * 100)
    : null;
  const speedTone = !isUp ? 'bad' : site?.responseTime == null ? 'muted' : site.responseTime < threshold * 0.4 ? 'good' : site.responseTime < threshold ? 'warn' : 'bad';
  const recommendations = useMemo(() => {
    const seen = new Set();
    return [
      ...(perf.recommendations || []).map((text) => ({ text, area: 'Performance' })),
      ...(seo.recommendations || []).map((text) => ({ text, area: 'SEO' })),
      ...(sec.recommendations || []).map((text) => ({ text, area: 'Security' })),
    ].filter(({ text }) => text && !seen.has(text) && seen.add(text));
  }, [perf.recommendations, seo.recommendations, sec.recommendations]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <View style={styles.titleText}>
            <Text style={styles.name} numberOfLines={1}>{site?.name || 'Site'}</Text>
            {site ? (
              <Pressable onPress={() => Linking.openURL(site.url)}>
                <Text style={styles.url} numberOfLines={1}>{displayUrl(site.url)}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={[styles.scoreChip, { backgroundColor: tone.bg }]}>
            <Text style={[styles.scoreChipText, { color: tone.text }]}>{down ? '!' : score ?? '--'}</Text>
          </View>
        </View>
        {site ? (
          <View style={styles.headerMeta}>
            <Text style={styles.meta}>{isUp ? formatMs(site.responseTime) : '--'}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.meta}>Checked {timeAgo(site.lastChecked)}</Text>
            <Text style={styles.dot}>·</Text>
            <View style={[styles.liveDot, { backgroundColor: status.text }]} />
            <Text style={styles.meta}>Live</Text>
            <View style={styles.flex} />
            <Pressable onPress={runCheck} disabled={checking} style={styles.checkBtn}>
              <Text style={styles.checkBtnText}>{checking ? 'Checking…' : 'Run check'}</Text>
            </Pressable>
          </View>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.tabBar}>
          {TABS.map((name) => {
            const active = tab === name;
            return (
              <Pressable key={name} onPress={() => chooseTab(name)} style={styles.tab}>
                <Text style={[styles.tabText, active && styles.tabTextOn]}>
                  {name}{name === 'Advanced' && !session.user?.isPro ? '  PRO' : ''}
                </Text>
                <View style={[styles.tabLine, active && styles.tabLineOn]} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!site && loading ? <ActivityIndicator color={colors.brand} style={styles.spinner} /> : null}
        {site && tab === 'Overview' ? (
          <>
            <View style={[styles.hero, { backgroundColor: hero.bg }]}>
              <View style={styles.heroOrb} />
              <View style={styles.heroOrbSmall} />
              <Text style={styles.heroTitle}>{site.status === 'offline' ? 'Site is offline' : hero.title}</Text>
              <Text style={styles.heroDetail}>
                {isUp
                  ? `Responded in ${formatMs(site.responseTime)} · ${formatPercent(passed)} of checks passed in 24h`
                  : statusTone(site.status) === 'muted'
                    ? 'Checks run every minute. The first result will appear here shortly.'
                    : 'The latest check did not get a valid response.'}
              </Text>
            </View>
            <MetricCard
              title="Availability"
              value={formatPercent(passed)}
              tone={passed == null ? 'muted' : passed >= 99 ? 'good' : passed >= 95 ? 'warn' : 'bad'}
              progress={passed}
              detail="Checks passed in the last 24 hours."
              footer={`${checks.length} checks  ·  30d ${formatPercent(site.uptime)}`}
            />
            <MetricCard
              title="Speed"
              value={isUp ? formatMs(site.responseTime) : '--'}
              tone={speedTone}
              progress={speedProgress}
              detail="Round trip to the site on the latest check."
              footer={`Alert at ${threshold.toLocaleString()} ms`}
            />
            <MetricCard
              title="Security"
              value={sec.securityScore ?? '--'}
              tone={scoreTone(sec.securityScore)}
              progress={sec.securityScore}
              detail="Based on SSL, plugins and security tooling."
              footer={`SSL ${sec.sslStatus || 'unknown'}${sec.outdatedPlugins != null ? `  ·  ${sec.outdatedPlugins} outdated` : ''}`}
            />
            <Panel title="Response time · 24h">
              <Sparkline series={series} />
            </Panel>
            <Panel title="Site">
              <KeyValue rows={[
                ['Platform', site.platform],
                ['Version', sec.wordpressVersion || null],
                ['Active plugins', perf.activePlugins ?? null],
                ['Content items', seo.totalContent ?? null],
              ]} />
            </Panel>
            <Panel title="Server">
              <KeyValue rows={[
                ['CPU load', formatRatio(perf.cpuUsage)],
                ['Memory', formatRatio(perf.memoryUsage)],
                ['DB query', perf.databaseQueryTime != null ? formatMs(perf.databaseQueryTime) : null],
                ['Processing', perf.serverResponseTime != null ? formatMs(perf.serverResponseTime) : null],
              ]} />
            </Panel>
            <Panel title={`Fix checklist · ${recommendations.length}`}>
              {recommendations.length === 0 ? <Text style={styles.muted}>Nothing to fix right now.</Text> : recommendations.slice(0, 6).map((item) => (
                <View key={`${item.area}-${item.text}`} style={styles.issue}>
                  <Text style={styles.issueText}>{item.text}</Text>
                  <Text style={styles.issueArea}>{item.area}</Text>
                </View>
              ))}
            </Panel>
            <CheckList checks={checks.slice(0, 6)} title="Recent checks" />
          </>
        ) : null}

        {site && tab === 'Performance' ? (
          <>
            <Panel title="Response time · last 24 hours">
              <Sparkline series={series} height={180} />
            </Panel>
            <View style={styles.scoreRow}>
              <ScoreRing value={perf.performanceScore ?? null} tone={scoreTone(perf.performanceScore)} label="Perf" />
              <View style={styles.scoreCopy}>
                <KeyValue rows={[
                  ['Round trip', formatMs(site.responseTime)],
                  ['Server', perf.serverResponseTime != null ? formatMs(perf.serverResponseTime) : null],
                  ['DB query', perf.databaseQueryTime != null ? formatMs(perf.databaseQueryTime) : null],
                  ['CPU', formatRatio(perf.cpuUsage)],
                  ['Memory', formatRatio(perf.memoryUsage)],
                  ['Plugins', perf.activePlugins ?? null],
                ]} />
              </View>
            </View>
          </>
        ) : null}

        {site && tab === 'SEO' ? (
          <ScoreBlock
            label="SEO"
            score={seo.score}
            rows={[
              ['Site title', seo.siteTitle || null],
              ['Description', seo.siteDescription || 'Missing'],
              ['Meta tags', seo.metaTags],
              ['Headings', seo.headingStructure?.replace(/_/g, ' ')],
              ['Internal links', seo.internalLinks],
              ['External links', seo.externalLinks],
              ['Images with alt', seo.altTags],
              ['SSL', seo.sslEnabled ? 'Enabled' : 'Disabled'],
            ]}
            itemsTitle={`Issues (${seo.seoIssues?.length || 0})`}
            items={seo.seoIssues || []}
            empty="No SEO issues reported."
          />
        ) : null}

        {site && tab === 'Security' ? (
          <ScoreBlock
            label="Security"
            score={sec.securityScore}
            rows={[
              ['SSL', sec.sslStatus],
              ['Firewall', sec.firewall],
              ['Vulnerability scan', sec.vulnerabilityScan?.replace(/_/g, ' ')],
              ['Malware scan', sec.malwareScan?.replace(/_/g, ' ')],
              ['Platform version', sec.wordpressVersion || null],
              ['Plugins', sec.totalPlugins],
              ['Outdated plugins', sec.outdatedPlugins],
              ['Security plugins', sec.securityPlugins],
            ]}
            itemsTitle="Recommendations"
            items={sec.recommendations || []}
            empty="No security recommendations."
          />
        ) : null}

        {site && tab === 'History' ? (
          <>
            <Panel title="Incidents · last 30 days">
              {incidents.length === 0 ? <Text style={styles.muted}>No downtime recorded.</Text> : incidents.slice(0, 12).map((item) => (
                <View key={item._id} style={styles.checkRow}>
                  <View style={styles.checkMain}>
                    <Text style={styles.checkTitle} numberOfLines={2}>{item.message || STATUS_LABEL[item.status] || 'Downtime'}</Text>
                    <Text style={[styles.checkMeta, !item.endedAt && styles.badText]}>{item.endedAt ? 'Resolved' : 'Ongoing'} · {timeAgo(item.startedAt)}</Text>
                  </View>
                </View>
              ))}
            </Panel>
            <CheckList checks={checks.slice(0, 40)} title="All checks · last 24 hours" />
          </>
        ) : null}

        {site && tab === 'Advanced' ? (
          session.user?.isPro ? (
            <ProPlugins plugins={plugins} error={pluginError} loading={loading} />
          ) : (
            <View style={styles.pro}>
              <Text style={styles.proKicker}>Pro</Text>
              <Text style={styles.proTitle}>The deeper view of {site.name}</Text>
              <Text style={styles.proLead}>Plugin audit, Zealot, server history and PageSpeed stay on Pro, the same as the website.</Text>
              {['Plugin audit', 'Zealot assistant', 'Server infrastructure', 'PageSpeed and Web Vitals', 'Deep security', 'Logs and reports'].map((item) => (
                <Text key={item} style={styles.proItem}>•  {item}</Text>
              ))}
            </View>
          )
        ) : null}
      </ScrollView>

      {site ? (
        <View style={styles.footer}>
          <Text style={styles.footerText}>{String(site.platform || '').toUpperCase()}</Text>
          <Text style={styles.footerText}>30d {formatPercent(site.uptime)}</Text>
          <Text style={styles.footerText}>SEO {seo.score ?? '--'}</Text>
          <Text style={[styles.footerStatus, { color: status.text, backgroundColor: status.bg }]}>
            {STATUS_LABEL[site.status] || 'Waiting'}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function ScoreBlock({ label, score, rows, itemsTitle, items, empty }) {
  return (
    <>
      <View style={styles.scoreRow}>
        <ScoreRing value={score ?? null} tone={scoreTone(score)} label={label} />
        <View style={styles.scoreCopy}>
          <KeyValue rows={rows} />
        </View>
      </View>
      <Panel title={itemsTitle}>
        {items.length === 0 ? <Text style={styles.muted}>{empty}</Text> : items.slice(0, 12).map((item) => (
          <View key={item} style={styles.issue}>
            <Text style={styles.issueText}>{item}</Text>
          </View>
        ))}
      </Panel>
    </>
  );
}

function CheckList({ checks, title }) {
  return (
    <Panel title={title}>
      {checks.length === 0 ? <Text style={styles.muted}>No checks recorded in the last 24 hours.</Text> : null}
      <View style={styles.tableHead}>
        <Text style={[styles.th, styles.colTime]}>Time</Text>
        <Text style={[styles.th, styles.colStatus]}>Status</Text>
        <Text style={[styles.th, styles.colNum]}>Response</Text>
      </View>
      {checks.map((check) => {
        const tone = toneColor[statusTone(check.status)];
        const up = UP_STATUSES.includes(check.status);
        return (
          <View key={check._id} style={styles.checkRow}>
            <Text style={[styles.checkTime, styles.colTime]}>{clock(check.timestamp)}</Text>
            <View style={[styles.colStatus, styles.statusCell]}>
              <View style={[styles.miniDot, { backgroundColor: tone.text }]} />
              <Text style={[styles.checkTitle, { color: tone.text }]} numberOfLines={1}>{STATUS_LABEL[check.status] || check.status}</Text>
            </View>
            <Text style={[styles.checkTime, styles.colNum]}>{up ? formatMs(check.responseTime) : '--'}</Text>
          </View>
        );
      })}
    </Panel>
  );
}

function ProPlugins({ plugins, error, loading }) {
  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!plugins && loading) return <ActivityIndicator color={colors.brand} style={styles.spinner} />;
  if (!plugins) return <Text style={styles.muted}>Plugin audit is not available for this site.</Text>;
  const outdated = plugins.outdated_plugins || [];
  return (
    <>
      <View style={styles.proStats}>
        <MiniStat label="Plugins" value={plugins.total_plugins ?? '--'} />
        <MiniStat label="Active" value={plugins.active_count ?? '--'} />
        <MiniStat label="Updates" value={plugins.outdated_count ?? 0} warn={(plugins.outdated_count || 0) > 0} />
      </View>
      <Panel title="Updates">
        {outdated.length === 0 ? <Text style={styles.muted}>No plugin updates.</Text> : outdated.slice(0, 12).map((plugin) => (
          <View key={plugin.file || plugin.name} style={styles.checkRow}>
            <View style={styles.checkMain}>
              <Text style={styles.checkTitle} numberOfLines={1}>{plugin.name}</Text>
              <Text style={styles.checkMeta}>v{plugin.version}{plugin.new_version ? ` → v${plugin.new_version}` : ''}</Text>
            </View>
          </View>
        ))}
      </Panel>
    </>
  );
}

function MiniStat({ label, value, warn }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.kicker}>{label}</Text>
      <Text style={[styles.miniValue, warn && styles.badText]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { backgroundColor: colors.canvas, paddingTop: 4 },
  headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  back: { fontSize: 28, lineHeight: 30, color: colors.ink, fontWeight: '500', marginTop: -2 },
  titleText: { flex: 1, paddingRight: 10 },
  name: { fontSize: 22, fontWeight: '800', color: colors.ink },
  url: { marginTop: 2, color: colors.brand, fontSize: 13, fontWeight: '700' },
  scoreChip: { minWidth: 48, height: 48, paddingHorizontal: 10, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  scoreChipText: { fontSize: 18, fontWeight: '800' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginTop: 10 },
  meta: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  dot: { color: colors.inkMuted, marginHorizontal: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  flex: { flex: 1 },
  checkBtn: { backgroundColor: colors.brand, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  checkBtnText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  tabBar: { borderBottomWidth: 1, borderBottomColor: colors.line, marginTop: 14 },
  tabs: { paddingHorizontal: 16, gap: 18 },
  tab: { paddingBottom: 10 },
  tabText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.inkMuted },
  tabTextOn: { color: colors.brand },
  tabLine: { height: 3, borderRadius: 99, marginTop: 8, backgroundColor: 'transparent' },
  tabLineOn: { backgroundColor: colors.brand },
  body: { padding: 16, gap: 12, paddingBottom: 28 },
  error: { color: colors.bad, fontWeight: '700' },
  spinner: { marginTop: 32 },
  hero: { borderRadius: 22, padding: 18, overflow: 'hidden' },
  heroOrb: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.14)', top: -50, right: -30 },
  heroOrbSmall: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.1)', bottom: -36, right: 48 },
  heroTitle: { color: colors.white, fontSize: 18, fontWeight: '800' },
  heroDetail: { marginTop: 6, color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.white, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.line },
  scoreCopy: { flex: 1 },
  muted: { color: colors.inkMuted, fontSize: 13, fontWeight: '600' },
  issue: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  issueText: { color: colors.inkSoft, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  issueArea: { marginTop: 3, color: colors.inkMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  tableHead: { flexDirection: 'row', marginBottom: 4 },
  th: { color: colors.inkMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.line },
  checkMain: { flex: 1 },
  checkTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  checkMeta: { marginTop: 2, color: colors.inkMuted, fontSize: 12, fontWeight: '600' },
  checkTime: { color: colors.inkSoft, fontSize: 12, fontWeight: '700' },
  colTime: { width: 72 },
  colStatus: { flex: 1 },
  colNum: { width: 78, textAlign: 'right' },
  statusCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniDot: { width: 7, height: 7, borderRadius: 4 },
  badText: { color: colors.bad },
  pro: { borderRadius: 24, padding: 22, backgroundColor: colors.brand, overflow: 'hidden' },
  proKicker: { alignSelf: 'flex-start', color: colors.white, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  proTitle: { marginTop: 14, color: colors.white, fontSize: 24, fontWeight: '800' },
  proLead: { marginTop: 8, color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 20 },
  proItem: { marginTop: 10, color: colors.white, fontSize: 14, fontWeight: '700' },
  proStats: { flexDirection: 'row', gap: 10 },
  miniStat: { flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.line },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.inkMuted },
  miniValue: { marginTop: 6, fontSize: 22, fontWeight: '800', color: colors.ink },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  footerText: { color: colors.inkSoft, fontSize: 11, fontWeight: '800' },
  footerStatus: { marginLeft: 'auto', overflow: 'hidden', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: '800' },
});
