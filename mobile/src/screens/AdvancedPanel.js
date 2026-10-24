import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { api } from '../api';
import { formatMs, formatPercent, timeAgo } from '../metrics';
import { colors } from '../theme';
import { Panel } from '../ui';

const SECTIONS = ['Overview', 'Plugins', 'Logs', 'Alerts', 'Reports', 'Zealot'];
const PROMPTS = ['Which plugins need an update?', 'What should I fix first?', 'How is uptime looking?'];

const inventoryOf = (data, platform) => {
  if (platform === 'nextjs') return { label: 'Libraries', data: data?.libraries || null };
  if (['laravel', 'codeigniter', 'php'].includes(platform)) return { label: 'Packages', data: data?.packages || null };
  return { label: 'Plugins', data: data?.plugins || null };
};

const alertsFor = (site) => {
  const list = [];
  if (site?.seo && site.seo.sslEnabled === false) {
    list.push({ id: 'ssl', priority: 'High', title: 'SSL is off', detail: 'This site is not serving HTTPS.' });
  }
  if (typeof site?.security?.securityScore === 'number' && site.security.securityScore < 70) {
    list.push({ id: 'security', priority: 'Medium', title: 'Security score is low', detail: `Score is ${site.security.securityScore} out of 100.` });
  }
  if (site?.security?.outdatedPlugins > 0) {
    list.push({ id: 'plugins', priority: 'Medium', title: 'Plugins need updates', detail: `${site.security.outdatedPlugins} of ${site.security.totalPlugins ?? 'the'} plugins have an update.` });
  }
  if (site?.seo?.metaTags === 'incomplete') {
    list.push({ id: 'meta', priority: 'Low', title: 'Meta tags are incomplete', detail: 'Pages are missing a title or description.' });
  }
  (site?.seo?.seoIssues || []).forEach((issue, index) => {
    list.push({ id: `seo-${index}`, priority: 'Medium', title: 'SEO issue', detail: issue });
  });
  return list;
};

export default function AdvancedPanel({ site, session, onExpired }) {
  const [section, setSection] = useState('Overview');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pluginView, setPluginView] = useState('All');
  const [report, setReport] = useState(null);
  const [reportDays, setReportDays] = useState(7);
  const [reportError, setReportError] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', text: `Ask about ${site.name}. I answer from this site’s monitoring data.` },
  ]);
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await api(`/advanced/comprehensive/${site._id}`, { token: session.token, timeoutMs: 30000 });
      setData(next);
      setError('');
    } catch (err) {
      if (err.status === 401) onExpired();
      else if (err.status === 403) setError('This account does not have Pro on the server.');
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [site._id, session.token, onExpired]);

  useEffect(() => { load(); }, [load]);

  const loadReport = async (days) => {
    setReportDays(days);
    setReportLoading(true);
    setReportError('');
    try {
      const next = await api(`/advanced/export/${site._id}?days=${days}&format=json`, { token: session.token, timeoutMs: 30000 });
      setReport(next);
    } catch (err) {
      if (err.status === 401) onExpired();
      else setReportError(err.message);
    } finally {
      setReportLoading(false);
    }
  };

  const ask = async (query) => {
    const text = query.trim();
    if (!text || asking) return;
    setDraft('');
    setMessages((current) => [...current, { role: 'user', text }]);
    setAsking(true);
    try {
      const result = await api(`/advanced/ai-insights/${site._id}/query`, {
        method: 'POST',
        token: session.token,
        body: { query: text },
        timeoutMs: 45000,
      });
      setMessages((current) => [...current, { role: 'ai', text: result.answer || 'No response generated.' }]);
    } catch (err) {
      if (err.status === 401) onExpired();
      else setMessages((current) => [...current, { role: 'ai', text: err.message }]);
    } finally {
      setAsking(false);
    }
  };

  if (loading && !data) return <ActivityIndicator color={colors.brand} style={styles.spinner} />;
  if (error && !data) return <Text style={styles.error}>{error}</Text>;

  const server = data?.serverInfo || {};
  const down = server.downtimeHours || {};
  const inventory = inventoryOf(data, site.platform);
  const pack = inventory.data || {};
  const allItems = pack.all_plugins || pack.all_packages || pack.all_libraries || pack.dependencies || [];
  const lists = {
    All: allItems,
    Active: pack.active_plugins || pack.dependencies || [],
    Inactive: pack.inactive_plugins || pack.devDependencies || [],
    Updates: pack.outdated_plugins || pack.outdated_packages || [],
  };
  const shown = lists[pluginView] || allItems;
  const recommendations = data?.recommendations?.recommendations || [];
  const log = data?.logs?.error_log;
  const access = data?.logs?.access_summary?.by_status;
  const analyticsError = data?.analytics?.error;
  const visitors = site.analytics?.totalVisitors;
  const pageViews = site.analytics?.totalPageViews;
  const bounce = site.analytics?.bounceRate;
  const sessions = data?.analytics?.googleAnalytics?.sessions;

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
        {SECTIONS.map((name) => {
          const on = section === name;
          return (
            <Pressable key={name} onPress={() => setSection(name)} style={[styles.pill, on && styles.pillOn]}>
              <Text style={[styles.pillText, on && styles.pillTextOn]}>{name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {section === 'Overview' ? (
        <>
          <View style={styles.stats}>
            <Stat label="Uptime 30d" value={formatPercent(server.uptimePercent ?? site.uptime)} />
            <Stat label="Response" value={formatMs(site.responseTime)} />
            <Stat label="Security" value={site.security?.securityScore ?? '--'} />
          </View>
          <Panel title="Server">
            <View style={styles.stats}>
              <Stat label="Down 24h" value={down.last24h != null ? `${down.last24h}h` : '--'} plain />
              <Stat label="Down 7d" value={down.last7d != null ? `${down.last7d}h` : '--'} plain />
              <Stat label="Down 30d" value={down.last30d != null ? `${down.last30d}h` : '--'} plain />
            </View>
            <Text style={styles.note}>{server.serverResourcesMessage || 'Disk and bandwidth are not connected.'}</Text>
          </Panel>
          <Panel title="Performance">
            <Row label="Round trip" value={formatMs(site.responseTime)} />
            <Row label="Server processing" value={site.performance?.serverResponseTime != null ? formatMs(site.performance.serverResponseTime) : '--'} />
            <Row label="DB query" value={site.performance?.databaseQueryTime != null ? formatMs(site.performance.databaseQueryTime) : '--'} />
          </Panel>
          <Panel title="Analytics">
            {analyticsError && visitors == null && pageViews == null ? (
              <Text style={styles.muted}>{analyticsError}</Text>
            ) : (
              <>
                <Row label="Sessions" value={sessions ?? '--'} />
                <Row label="Visitors" value={visitors ?? '--'} />
                <Row label="Page views" value={pageViews ?? '--'} />
                <Row label="Bounce rate" value={bounce != null ? `${bounce}%` : '--'} />
              </>
            )}
          </Panel>
          <Panel title="Recommended actions">
            {recommendations.length === 0 ? <Text style={styles.muted}>No actions from the site.</Text> : recommendations.slice(0, 8).map((item, index) => (
              <View key={`${item.source}-${index}`} style={styles.issue}>
                <Text style={styles.area}>{item.source || 'site'}</Text>
                <Text style={styles.issueText}>{typeof item.text === 'string' ? item.text : item.text?.text || ''}</Text>
              </View>
            ))}
          </Panel>
        </>
      ) : null}

      {section === 'Plugins' ? (
        <>
          <View style={styles.stats}>
            <Stat label="Total" value={pack.total_plugins ?? pack.total_packages ?? pack.total_libraries ?? allItems.length} />
            <Stat label="Active" value={pack.active_count ?? '--'} />
            <Stat label="Updates" value={pack.outdated_count ?? 0} warn={(pack.outdated_count || 0) > 0} />
          </View>
          {pack.error ? <Text style={styles.error}>{pack.error}</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
            {Object.keys(lists).map((name) => {
              const on = pluginView === name;
              return (
                <Pressable key={name} onPress={() => setPluginView(name)} style={[styles.pill, on && styles.pillOn]}>
                  <Text style={[styles.pillText, on && styles.pillTextOn]}>{name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Panel title={inventory.label}>
            {shown.length === 0 ? <Text style={styles.muted}>Nothing in this list.</Text> : shown.slice(0, 40).map((item, index) => (
              <View key={item.file || item.name || index} style={styles.plugin}>
                <Text style={styles.pluginName} numberOfLines={1}>{item.name || item.package || 'Package'}</Text>
                <Text style={styles.muted}>v{item.version || '—'}{item.new_version ? ` → v${item.new_version}` : ''}{item.is_active ? ' · Active' : ''}</Text>
              </View>
            ))}
          </Panel>
        </>
      ) : null}

      {section === 'Logs' ? (
        <Panel title="Error log">
          {!log ? <Text style={styles.muted}>No log data from this site.</Text> : null}
          {log && !log.enabled ? <Text style={styles.note}>{log.message || 'The error log is not enabled on this site.'}</Text> : null}
          {log?.log_file_path ? <Text style={styles.muted}>{log.log_file_path}</Text> : null}
          {(log?.lines || []).slice(0, 30).map((line, index) => (
            <Text key={index} style={styles.logLine}>{typeof line === 'string' ? line : line.raw || ''}</Text>
          ))}
          {access ? (
            <View style={styles.access}>
              {Object.entries(access).map(([code, count]) => (
                <Text key={code} style={styles.accessItem}>{code} · {count}</Text>
              ))}
            </View>
          ) : null}
        </Panel>
      ) : null}

      {section === 'Alerts' ? (
        <Panel title="Alerts">
          {alertsFor(site).length === 0 ? <Text style={styles.muted}>No alerts from the latest check.</Text> : alertsFor(site).map((alert) => (
            <View key={alert.id} style={styles.issue}>
              <Text style={styles.area}>{alert.priority}</Text>
              <Text style={styles.pluginName}>{alert.title}</Text>
              <Text style={styles.issueText}>{alert.detail}</Text>
            </View>
          ))}
        </Panel>
      ) : null}

      {section === 'Reports' ? (
        <Panel title="Check report">
          <View style={styles.pills}>
            {[7, 30].map((days) => (
              <Pressable key={days} onPress={() => loadReport(days)} style={[styles.pill, reportDays === days && report && styles.pillOn]}>
                <Text style={[styles.pillText, reportDays === days && report && styles.pillTextOn]}>{days} days</Text>
              </Pressable>
            ))}
          </View>
          {reportLoading ? <ActivityIndicator color={colors.brand} style={styles.spinner} /> : null}
          {reportError ? <Text style={styles.error}>{reportError}</Text> : null}
          {report ? (
            <>
              <Row label="Checks" value={report.summary?.totalChecks ?? '--'} />
              <Row label="Healthy" value={report.summary?.healthy ?? '--'} />
              <Text style={styles.muted}>{report.period} · {report.website?.name}</Text>
            </>
          ) : <Text style={styles.muted}>Choose a range to load the real check totals.</Text>}
        </Panel>
      ) : null}

      {section === 'Zealot' ? (
        <View style={styles.chat}>
          {messages.map((message, index) => (
            <View key={`${message.role}-${index}`} style={[styles.bubble, message.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
              <Text style={[styles.bubbleText, message.role === 'user' && styles.bubbleTextUser]}>{message.text}</Text>
            </View>
          ))}
          {messages.length === 1 && !asking ? (
            <View style={styles.prompts}>
              {PROMPTS.map((prompt) => (
                <Pressable key={prompt} onPress={() => ask(prompt)} style={styles.prompt}>
                  <Text style={styles.promptText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {asking ? <Text style={styles.muted}>Looking at this site…</Text> : null}
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask about this site"
              placeholderTextColor={colors.inkMuted}
              style={styles.input}
              multiline
            />
            <Pressable onPress={() => ask(draft)} disabled={asking || !draft.trim()} style={styles.send}>
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>
          <Text style={styles.ago}>Updated {timeAgo(server.lastChecked || site.lastChecked)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value, warn, plain }) {
  return (
    <View style={[styles.stat, plain && styles.statPlain]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, warn && styles.warn]}>{value}</Text>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  spinner: { marginVertical: 24 },
  error: { color: colors.bad, fontWeight: '700' },
  pills: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  pillOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { color: colors.inkSoft, fontSize: 12, fontWeight: '800' },
  pillTextOn: { color: colors.white },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.line },
  statPlain: { backgroundColor: colors.brandSoft, borderColor: 'transparent' },
  statLabel: { color: colors.inkMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  statValue: { marginTop: 6, color: colors.ink, fontSize: 18, fontWeight: '800' },
  warn: { color: colors.warn },
  note: { marginTop: 10, color: colors.inkSoft, fontSize: 13, lineHeight: 18 },
  muted: { color: colors.inkMuted, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  rowLabel: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  rowValue: { color: colors.inkSoft, fontWeight: '700', fontSize: 13 },
  issue: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  area: { color: colors.brand, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  issueText: { marginTop: 3, color: colors.inkSoft, fontSize: 13, lineHeight: 18 },
  plugin: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  pluginName: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  logLine: { marginTop: 6, color: colors.ink, fontSize: 12, lineHeight: 17 },
  access: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  accessItem: { backgroundColor: colors.brandSoft, color: colors.ink, overflow: 'hidden', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, fontWeight: '800', fontSize: 12 },
  chat: { gap: 8 },
  bubble: { maxWidth: '88%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  bubbleAi: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: colors.brand },
  bubbleText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: colors.white },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prompt: { backgroundColor: colors.white, borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 7 },
  promptText: { color: colors.inkSoft, fontSize: 12, fontWeight: '700' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 },
  input: { flex: 1, minHeight: 44, maxHeight: 100, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10, color: colors.ink, fontSize: 15 },
  send: { backgroundColor: colors.brand, borderRadius: 14, paddingHorizontal: 14, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.white, fontWeight: '800' },
  ago: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
});
