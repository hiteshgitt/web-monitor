import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { api, apiText } from '../api';
import { formatMs, formatPercent, timeAgo } from '../metrics';
import { colors } from '../theme';
import { Panel } from '../ui';

WebBrowser.maybeCompleteAuthSession();
const ZEALOT_ICON = require('../../assets/zealot-icon.png');
const REPORT_PRESETS = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
];
const EXPORT_CATEGORIES = [
  { id: 'checks', label: 'Check history', desc: 'Uptime & response times', icon: '⏱' },
  { id: 'performance', label: 'Performance', desc: 'PageSpeed & server timings', icon: '⚡' },
  { id: 'security', label: 'Security', desc: 'Public scan & architecture', icon: '🛡' },
  { id: 'seo', label: 'SEO', desc: 'Scores, meta & issues', icon: '🔍' },
  { id: 'traffic', label: 'Traffic', desc: 'Analytics & Search Console', icon: '📊' },
];
// Match web SecurityScanPanel: done when we have a finished checkedAt and SSL is not still grading.
const scanIsComplete = (next) => Boolean(
  next
  && next.checkedAt
  && !next.checking
  && !next.running
  && next.ssl?.status !== 'pending',
);
const PROMPTS = ['Which plugins need an update?', 'What should I fix first?', 'How is uptime looking?'];
const THREAT_LABEL = {
  MALWARE: 'Malware',
  SOCIAL_ENGINEERING: 'Phishing',
  UNWANTED_SOFTWARE: 'Unwanted software',
  POTENTIALLY_HARMFUL_APPLICATION: 'Harmful app',
};
const VITAL_STATUS = { good: 'Good', 'needs-improvement': 'Needs work', poor: 'Poor' };

const inventoryOf = (data, platform) => {
  if (platform === 'nextjs') return { label: 'Libraries', tab: 'Libraries', data: data?.libraries || null };
  if (['laravel', 'codeigniter', 'php'].includes(platform)) return { label: 'Packages', tab: 'Packages', data: data?.packages || null };
  return { label: 'Plugins', tab: 'Plugins', data: data?.plugins || null };
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

const formatCls = (value) => (value == null || Number.isNaN(Number(value)) ? '--' : Number(value).toFixed(2));
const formatCount = (value) => (value == null ? '--' : Number(value).toLocaleString());
const safeName = (name) => String(name || 'report').replace(/[^a-z0-9_-]/gi, '_');

const REPORT_LABELS = {
  idle: 'Report this answer',
  sending: 'Sending…',
  sent: 'Reported. Thank you.',
  failed: 'Could not send. Tap to retry.',
};

export default function AdvancedPanel({
  site, session, onExpired, refreshKey = 0, initialSection = 'Overview',
  zealotPrompt = '', zealotOpenKey = 0,
}) {
  const insets = useSafeAreaInsets();
  const inventoryMeta = inventoryOf(null, site.platform);
  const sections = useMemo(
    () => ['Overview', 'Analytics', 'Performance', 'SEO', 'Security', 'Reports', 'Alerts', 'Logs', inventoryMeta.tab],
    [inventoryMeta.tab],
  );
  const [section, setSection] = useState(initialSection);
  const [showZealot, setShowZealot] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pluginView, setPluginView] = useState('All');
  const [reportDays, setReportDays] = useState(30);
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState('');
  const [reportBusy, setReportBusy] = useState('');
  const [exportCats, setExportCats] = useState(() => Object.fromEntries(EXPORT_CATEGORIES.map((c) => [c.id, true])));
  const [vitals, setVitals] = useState(null);
  const [vitalsError, setVitalsError] = useState('');
  const [vitalsLoading, setVitalsLoading] = useState(false);
  const [vitalsDevice, setVitalsDevice] = useState('mobile');
  const [scan, setScan] = useState(null);
  const [scanError, setScanError] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', text: `Ask about ${site.name}. I answer from this site’s monitoring data.` },
  ]);
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [oauthBusy, setOauthBusy] = useState('');
  const [oauthError, setOauthError] = useState('');
  const [gaPending, setGaPending] = useState('');
  const [gaProperties, setGaProperties] = useState([]);
  const [scPending, setScPending] = useState('');
  const [scSites, setScSites] = useState([]);

  const load = useCallback(async () => {
    try {
      const next = await api(`/advanced/comprehensive/${site._id}`, { token: session.token, timeoutMs: 45000 });
      setData(next);
      // Saved weekly scans — same payload the website already shows.
      if (next.vitals) {
        setVitals(next.vitals);
        setVitalsLoading(false);
        setVitalsError('');
      }
      if (next.securityScan) {
        setScan(next.securityScan);
        setScanLoading(!scanIsComplete(next.securityScan));
        setScanError('');
      }
      setError('');
    } catch (err) {
      if (err.status === 401) onExpired();
      else if (err.status === 403) setError('This account does not have Pro on the server.');
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [site._id, session.token, onExpired]);

  useEffect(() => {
    if (initialSection && sections.includes(initialSection)) setSection(initialSection);
  }, [initialSection, sections]);

  // Run check bumps refreshKey — clear tab caches so every Advanced section reloads live data.
  useEffect(() => {
    setVitals(null);
    setVitalsError('');
    setScan(null);
    setScanError('');
    setLoading(true);
    load();
  }, [load, refreshKey]);

  // Always refresh PageSpeed when opening Performance or after Run check (refreshKey).
  // Do not key off `vitals` — that caused an infinite spinner loop.
  useEffect(() => {
    if (section !== 'Performance') return undefined;
    let cancelled = false;
    setVitalsLoading(true);
    api(`/advanced/vitals/${site._id}`, { token: session.token, timeoutMs: 30000 })
      .then((next) => {
        if (cancelled) return;
        setVitals(next);
        setVitalsError('');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) onExpired();
        else setVitalsError(err.message);
      })
      .finally(() => { if (!cancelled) setVitalsLoading(false); });
    return () => { cancelled = true; };
  }, [section, site._id, session.token, onExpired, refreshKey]);

  useEffect(() => {
    if (section !== 'Security') return undefined;
    let cancelled = false;
    let timer = 0;
    let polls = 0;
    const loadScan = () => api(`/advanced/security-scan/${site._id}`, { token: session.token, timeoutMs: 30000 })
      .then((next) => {
        if (cancelled) return;
        setScan(next);
        setScanError('');
        const waiting = !scanIsComplete(next);
        setScanLoading(waiting);
        if (waiting && polls < 12) {
          polls += 1;
          timer = setTimeout(loadScan, 8000);
        } else if (waiting) {
          // Stop spinner after polls so the panel can show a “not ready” state instead of hanging.
          setScanLoading(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) onExpired();
        else setScanError(err.message);
        setScanLoading(false);
      });
    // Always refresh when opening Security (or after Run check) so desktop/mobile stay in sync.
    setScanLoading(true);
    loadScan();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [section, site._id, session.token, onExpired, refreshKey]);

  const loadReportPreview = async (days) => {
    setReportDays(days);
    setReportBusy('preview');
    setReportError('');
    try {
      const next = await api(`/advanced/export/${site._id}?days=${days}&format=json`, { token: session.token, timeoutMs: 30000 });
      setReport(next);
    } catch (err) {
      if (err.status === 401) onExpired();
      else setReportError(err.message);
    } finally {
      setReportBusy('');
    }
  };

  const shareExport = async (filename, body, mimeType) => {
    const cache = FileSystem.cacheDirectory;
    if (cache && await Sharing.isAvailableAsync()) {
      const uri = `${cache}${filename}`;
      await FileSystem.writeAsStringAsync(uri, body);
      await Sharing.shareAsync(uri, { mimeType, dialogTitle: filename });
      return;
    }
    await Share.share({ message: body, title: filename });
  };

  const selectedExportIds = EXPORT_CATEGORIES.filter((c) => exportCats[c.id]).map((c) => c.id);

  const toggleExportCat = (id) => {
    setExportCats((current) => {
      const next = { ...current, [id]: !current[id] };
      if (!Object.values(next).some(Boolean)) return current;
      return next;
    });
  };

  const setAllExportCats = (value) => {
    setExportCats(Object.fromEntries(EXPORT_CATEGORIES.map((c) => [c.id, value])));
  };

  const buildSelectedPayload = async () => {
    const payload = {
      website: { name: site.name, url: site.url, platform: site.platform },
      exportedAt: new Date().toISOString(),
      periodDays: reportDays,
      categories: selectedExportIds,
    };
    if (exportCats.checks) {
      const history = await api(`/advanced/export/${site._id}?days=${reportDays}&format=json`, {
        token: session.token,
        timeoutMs: 30000,
      });
      setReport(history);
      payload.checks = history;
    }
    if (exportCats.performance) {
      payload.performance = {
        responseTime: site.responseTime,
        serverResponseTime: site.performance?.serverResponseTime ?? null,
        databaseQueryTime: site.performance?.databaseQueryTime ?? null,
        vitals: vitals || data?.vitals || null,
      };
    }
    if (exportCats.security) {
      payload.security = {
        architecture: site.security || null,
        publicScan: scan || data?.securityScan || null,
      };
    }
    if (exportCats.seo) payload.seo = site.seo || null;
    if (exportCats.traffic) {
      payload.traffic = {
        googleAnalytics: data?.analytics?.googleAnalytics || null,
        searchConsole: data?.analytics?.searchConsole || null,
        analyticsError: data?.analytics?.error || null,
        searchConsoleError: data?.analytics?.searchConsoleError || null,
      };
    }
    return payload;
  };

  const exportReport = async (format) => {
    if (selectedExportIds.length === 0) {
      setReportError('Select at least one data category to export.');
      return;
    }
    setReportBusy(format);
    setReportError('');
    try {
      const filename = `${safeName(site.name)}-${reportDays}days.${format}`;
      // CSV is check-history only (same as the website). Multi-category packs use JSON.
      if (format === 'csv') {
        if (!exportCats.checks || selectedExportIds.length > 1) {
          setReportError('CSV exports check history only. Turn on Check history alone, or use JSON for selected tabs.');
          return;
        }
        const csv = await apiText(`/advanced/export/${site._id}?days=${reportDays}&format=csv`, {
          token: session.token,
          timeoutMs: 30000,
        });
        await shareExport(filename, csv, 'text/csv');
        return;
      }
      const payload = await buildSelectedPayload();
      await shareExport(filename, JSON.stringify(payload, null, 2), 'application/json');
    } catch (err) {
      if (err.status === 401) onExpired();
      else setReportError(err.message);
    } finally {
      setReportBusy('');
    }
  };

  const disconnectGoogle = async (kind) => {
    try {
      const path = kind === 'ga'
        ? `/websites/${site._id}/analytics/google`
        : `/websites/${site._id}/search-console/google`;
      await api(path, { method: 'DELETE', token: session.token });
      if (kind === 'ga') { setGaPending(''); setGaProperties([]); }
      else { setScPending(''); setScSites([]); }
      await load();
    } catch (err) {
      if (err.status === 401) onExpired();
      else setOauthError(err.message);
    }
  };

  const parseOAuthReturn = (url) => {
    try {
      const parsed = new URL(url);
      return {
        gaPending: parsed.searchParams.get('gaPending') || '',
        scPending: parsed.searchParams.get('scPending') || '',
        gaError: parsed.searchParams.get('gaError') || '',
        scError: parsed.searchParams.get('scError') || '',
      };
    } catch {
      return {};
    }
  };

  const loadGaProperties = async (pendingId) => {
    const next = await api(
      `/websites/${site._id}/analytics/google/properties?pending=${encodeURIComponent(pendingId)}`,
      { token: session.token, timeoutMs: 30000 },
    );
    setGaPending(pendingId);
    setGaProperties(next.properties || []);
  };

  const loadScSites = async (pendingId) => {
    const next = await api(
      `/websites/${site._id}/search-console/google/sites?pending=${encodeURIComponent(pendingId)}`,
      { token: session.token, timeoutMs: 30000 },
    );
    setScPending(pendingId);
    setScSites(next.sites || []);
  };

  const startGoogleConnect = async (kind) => {
    setOauthBusy(kind);
    setOauthError('');
    try {
      const path = kind === 'ga'
        ? `/websites/${site._id}/analytics/google/connect?return=app`
        : `/websites/${site._id}/search-console/google/connect?return=app`;
      const { url } = await api(path, { token: session.token });
      const returnUrl = kind === 'ga' ? 'webmonitor://oauth/ga' : 'webmonitor://oauth/sc';
      const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
      if (result.type !== 'success' || !result.url) {
        if (result.type === 'cancel' || result.type === 'dismiss') setOauthError('Google sign-in was cancelled.');
        return;
      }
      const handoff = parseOAuthReturn(result.url);
      if (kind === 'ga') {
        if (handoff.gaError) throw new Error(handoff.gaError);
        if (!handoff.gaPending) throw new Error('Google returned to the app without a connection. Try again.');
        await loadGaProperties(handoff.gaPending);
      } else {
        if (handoff.scError) throw new Error(handoff.scError);
        if (!handoff.scPending) throw new Error('Google returned to the app without a connection. Try again.');
        await loadScSites(handoff.scPending);
      }
    } catch (err) {
      if (err.status === 401) onExpired();
      else setOauthError(err.message);
    } finally {
      setOauthBusy('');
    }
  };

  const chooseGaProperty = async (propertyId) => {
    setOauthBusy('ga-choose');
    setOauthError('');
    try {
      await api(`/websites/${site._id}/analytics/google`, {
        method: 'POST',
        token: session.token,
        body: { pendingId: gaPending, propertyId },
      });
      setGaPending('');
      setGaProperties([]);
      await load();
    } catch (err) {
      if (err.status === 401) onExpired();
      else setOauthError(err.message);
    } finally {
      setOauthBusy('');
    }
  };

  const chooseScSite = async (siteUrl) => {
    setOauthBusy('sc-choose');
    setOauthError('');
    try {
      await api(`/websites/${site._id}/search-console/google`, {
        method: 'POST',
        token: session.token,
        body: { pendingId: scPending, siteUrl },
      });
      setScPending('');
      setScSites([]);
      await load();
    } catch (err) {
      if (err.status === 401) onExpired();
      else setOauthError(err.message);
    } finally {
      setOauthBusy('');
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
      setMessages((current) => [...current, {
        role: 'ai', text: result.answer || 'No response generated.', question: text, reportable: Boolean(result.answer),
      }]);
    } catch (err) {
      if (err.status === 401) onExpired();
      else setMessages((current) => [...current, { role: 'ai', text: err.message }]);
    } finally {
      setAsking(false);
    }
  };

  const reportAnswer = async (index) => {
    const mark = (report) => setMessages((current) => current.map((item, i) => (i === index ? { ...item, report } : item)));
    const message = messages[index];
    mark('sending');
    try {
      await api(`/advanced/ai-insights/${site._id}/report`, {
        method: 'POST',
        token: session.token,
        body: { question: message.question, answer: message.text },
      });
      mark('sent');
    } catch (err) {
      if (err.status === 401) onExpired();
      else mark('failed');
    }
  };

  // Open Zealot from Overview/Security “Ask Zealot” shortcuts and send the prepared prompt.
  useEffect(() => {
    if (!zealotOpenKey) return undefined;
    setShowZealot(true);
    if (!zealotPrompt?.trim()) return undefined;
    const timer = setTimeout(() => { ask(zealotPrompt); }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire only when parent bumps zealotOpenKey
  }, [zealotOpenKey]);

  if (loading && !data) {
    return (
      <View style={styles.shell}>
        <ActivityIndicator color={colors.brand} style={styles.spinner} />
      </View>
    );
  }
  if (error && !data) {
    return (
      <View style={styles.shell}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

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
  const ga = data?.analytics?.googleAnalytics;
  const sc = data?.analytics?.searchConsole;
  const scError = data?.analytics?.searchConsoleError;
  const visitors = ga?.totalUsers ?? site.analytics?.totalVisitors;
  const pageViews = ga?.pageViews ?? site.analytics?.totalPageViews;
  const bounce = ga?.bounceRate ?? site.analytics?.bounceRate;
  const sessions = ga?.sessions;
  const seo = site.seo || {};
  const sec = site.security || {};
  const lab = vitalsDevice === 'desktop' ? vitals?.lab?.desktop : vitals?.lab?.mobile;
  const field = vitalsDevice === 'desktop' ? vitals?.field?.desktop : vitals?.field?.phone;
  const malware = scan?.malware;
  const ssl = scan?.ssl;
  const headers = scan?.headers;
  const malwareText = !malware
    ? '--'
    : malware.status === 'clean'
      ? 'No listing'
      : malware.status === 'flagged'
        ? (malware.threats || []).map((threat) => THREAT_LABEL[threat] || threat).join(', ') || 'Flagged'
        : 'Not checked';

  return (
    <View style={styles.shell}>
      <View style={styles.proBanner}>
        <Text style={styles.proBannerKicker}>Pro</Text>
        <Text style={styles.proBannerText}>Advanced analytics for {site.name}</Text>
      </View>

      <View style={styles.sectionBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}
          style={styles.sectionScroll}
        >
          {sections.map((name) => {
            const on = section === name;
            return (
              <Pressable key={name} onPress={() => setSection(name)} style={[styles.pill, on && styles.pillOn]}>
                <Text style={[styles.pillText, on && styles.pillTextOn]} numberOfLines={1}>{name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
      {section === 'Overview' ? (
        <>
          <View style={styles.stats}>
            <Stat label="Uptime 30d" value={formatPercent(server.uptimePercent ?? site.uptime)} />
            <Stat label="Response" value={formatMs(site.responseTime)} />
            <Stat label="Security" value={site.security?.securityScore ?? '--'} />
          </View>
          <Panel title="Server infrastructure">
            <View style={styles.stats}>
              <Stat label="Down 24h" value={down.last24h != null ? `${down.last24h}h` : '--'} plain />
              <Stat label="Down 7d" value={down.last7d != null ? `${down.last7d}h` : '--'} plain />
              <Stat label="Down 30d" value={down.last30d != null ? `${down.last30d}h` : '--'} plain />
            </View>
            <Row label="Disk" value={server.diskSpace ? `${server.diskSpace.used} / ${server.diskSpace.total} ${server.diskSpace.unit || 'GB'}` : 'Not connected'} />
            <Row label="Data transfer" value={server.bandwidth?.used != null ? `${server.bandwidth.used} ${server.bandwidth.unit || 'GB'} sent since restart` : 'Not connected'} />
            <Text style={styles.note}>{server.serverResourcesMessage || 'Bandwidth is not available from the site.'}</Text>
          </Panel>
          <Panel title="Performance">
            <Row label="Round trip" value={formatMs(site.responseTime)} />
            <Row label="Server processing" value={site.performance?.serverResponseTime != null ? formatMs(site.performance.serverResponseTime) : '--'} />
            <Row label="DB query" value={site.performance?.databaseQueryTime != null ? formatMs(site.performance.databaseQueryTime) : '--'} />
          </Panel>
          <Panel title="Traffic snapshot">
            {!ga && analyticsError && visitors == null && pageViews == null ? (
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

      {section === 'Analytics' ? (
        <>
          {oauthError ? <Text style={styles.error}>{oauthError}</Text> : null}
          <Panel title="Google Analytics">
            {ga?.propertyId ? (
              <>
                <Row label="Property" value={ga.propertyName || ga.propertyId} />
                <Row label="Sessions" value={formatCount(ga.sessions)} />
                <Row label="Users" value={formatCount(ga.totalUsers)} />
                <Row label="Page views" value={formatCount(ga.pageViews)} />
                <Row label="Bounce rate" value={ga.bounceRate != null ? `${ga.bounceRate}%` : '--'} />
                <Row label="Avg session" value={ga.avgSessionDuration != null ? `${ga.avgSessionDuration}s` : '--'} />
                {Object.keys(ga.channelBreakdown || {}).length > 0 ? (
                  <View style={styles.block}>
                    <Text style={styles.area}>Channels</Text>
                    {Object.entries(ga.channelBreakdown).map(([key, value]) => (
                      <Row key={key} label={key} value={formatCount(value)} />
                    ))}
                  </View>
                ) : null}
                {Object.keys(ga.deviceBreakdown || {}).length > 0 ? (
                  <View style={styles.block}>
                    <Text style={styles.area}>Devices</Text>
                    {Object.entries(ga.deviceBreakdown).map(([key, value]) => (
                      <Row key={key} label={key} value={formatCount(value)} />
                    ))}
                  </View>
                ) : null}
                <Pressable onPress={() => disconnectGoogle('ga')} style={styles.ghostBtn}>
                  <Text style={styles.ghostBtnText}>Disconnect Google Analytics</Text>
                </Pressable>
              </>
            ) : gaPending ? (
              <>
                <Text style={styles.muted}>Choose the GA4 property for this site.</Text>
                {oauthBusy === 'ga-choose' ? <ActivityIndicator color={colors.brand} style={styles.spinner} /> : null}
                {gaProperties.length === 0 ? <Text style={styles.muted}>This Google account has no Analytics properties.</Text> : null}
                {gaProperties.map((item) => (
                  <Pressable key={item.id} onPress={() => chooseGaProperty(item.id)} style={styles.choice}>
                    <Text style={styles.pluginName}>{item.name || item.id}</Text>
                    <Text style={styles.muted}>{item.id}</Text>
                  </Pressable>
                ))}
              </>
            ) : (
              <>
                <Text style={styles.muted}>{analyticsError || 'Connect a GA4 property to see live traffic here.'}</Text>
                <Pressable onPress={() => startGoogleConnect('ga')} disabled={Boolean(oauthBusy)} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>{oauthBusy === 'ga' ? 'Opening Google…' : 'Connect Google Analytics'}</Text>
                </Pressable>
                <Text style={styles.note}>Google opens once for permission, then you pick the property back in the app.</Text>
              </>
            )}
          </Panel>
          <Panel title="Search Console">
            {sc?.siteUrl ? (
              <>
                <Row label="Property" value={sc.siteUrl} />
                <Row label="Clicks" value={formatCount(sc.totalClicks)} />
                <Row label="Impressions" value={formatCount(sc.totalImpressions)} />
                <Row label="CTR" value={sc.averageCTR != null ? `${(Number(sc.averageCTR) * (sc.averageCTR <= 1 ? 100 : 1)).toFixed(1)}%` : '--'} />
                <Row label="Position" value={sc.averagePosition != null ? Number(sc.averagePosition).toFixed(1) : '--'} />
                {(sc.topQueries || []).slice(0, 8).map((item) => (
                  <Row key={item.query} label={item.query} value={`${formatCount(item.clicks)} clicks`} />
                ))}
                <Pressable onPress={() => disconnectGoogle('sc')} style={styles.ghostBtn}>
                  <Text style={styles.ghostBtnText}>Disconnect Search Console</Text>
                </Pressable>
              </>
            ) : scPending ? (
              <>
                <Text style={styles.muted}>Choose the Search Console property for this site.</Text>
                {oauthBusy === 'sc-choose' ? <ActivityIndicator color={colors.brand} style={styles.spinner} /> : null}
                {scSites.length === 0 ? <Text style={styles.muted}>This Google account has no Search Console properties.</Text> : null}
                {scSites.map((item) => (
                  <Pressable key={item.id} onPress={() => chooseScSite(item.id)} style={styles.choice}>
                    <Text style={styles.pluginName}>{item.name || item.id}</Text>
                    <Text style={styles.muted}>{item.permission || item.id}</Text>
                  </Pressable>
                ))}
              </>
            ) : (
              <>
                <Text style={styles.muted}>{scError || 'Connect Search Console to see clicks and queries.'}</Text>
                <Pressable onPress={() => startGoogleConnect('sc')} disabled={Boolean(oauthBusy)} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>{oauthBusy === 'sc' ? 'Opening Google…' : 'Connect Search Console'}</Text>
                </Pressable>
                <Text style={styles.note}>Google opens once for permission, then you pick the property back in the app.</Text>
              </>
            )}
          </Panel>
        </>
      ) : null}

      {section === 'Performance' ? (
        <>
          <Panel title="PageSpeed & Core Web Vitals">
            <View style={styles.pills}>
              {['mobile', 'desktop'].map((device) => (
                <Pressable key={device} onPress={() => setVitalsDevice(device)} style={[styles.pill, vitalsDevice === device && styles.pillOn]}>
                  <Text style={[styles.pillText, vitalsDevice === device && styles.pillTextOn]}>{device}</Text>
                </Pressable>
              ))}
            </View>
            {vitals?.checkedAt || vitals?.scannedAt ? (
              <Text style={styles.note}>
                Last scan {timeAgo(vitals.scannedAt || vitals.checkedAt)}. Next weekly refresh keeps this until then.
              </Text>
            ) : null}
            {vitalsLoading && !lab ? <ActivityIndicator color={colors.brand} style={styles.spinner} /> : null}
            {vitalsError ? <Text style={styles.error}>{vitalsError}</Text> : null}
            {!vitalsLoading && vitals?.configured === false ? <Text style={styles.muted}>PageSpeed is not turned on for this server yet.</Text> : null}
            {!vitalsLoading && vitals?.configured !== false && !vitals?.lab ? (
              <Text style={styles.muted}>The weekly scan has not reached this site yet.</Text>
            ) : null}
            {lab?.error && !lab.score && !lab.lcp ? <Text style={styles.muted}>{lab.error}</Text> : null}
            {lab && (lab.score != null || lab.lcp) ? (
              <>
                <View style={styles.stats}>
                  <Stat label="Lab score" value={lab.score ?? '--'} />
                  <Stat label="LCP" value={lab.lcp?.display || formatMs(lab.lcp?.value)} />
                  <Stat label="CLS" value={lab.cls?.display || formatCls(lab.cls?.value)} />
                </View>
                <Row label="INP" value={`${lab.inp?.display || formatMs(lab.inp?.value)} · ${VITAL_STATUS[lab.inp?.status] || '—'}`.trim()} />
                <Row label="FCP" value={lab.fcp?.display || formatMs(lab.fcp?.value)} />
                <Row label="Speed index" value={lab.speedIndex?.display || formatMs(lab.speedIndex?.value)} />
                {(lab.opportunities || []).slice(0, 5).map((item) => (
                  <Row key={item.title} label={item.title} value={item.display || ''} />
                ))}
              </>
            ) : null}
            {field ? (
              <View style={styles.block}>
                <Text style={styles.area}>Field · Chrome visitors</Text>
                <Row label="LCP" value={`${formatMs(field.lcp?.p75)} · ${VITAL_STATUS[field.lcp?.status] || ''}`} />
                <Row label="INP" value={`${formatMs(field.inp?.p75)} · ${VITAL_STATUS[field.inp?.status] || ''}`} />
                <Row label="CLS" value={`${formatCls(field.cls?.p75)} · ${VITAL_STATUS[field.cls?.status] || ''}`} />
              </View>
            ) : vitals?.field?.message ? <Text style={styles.muted}>{vitals.field.message}</Text> : null}
          </Panel>
          <Panel title="Server timings">
            <Row label="Round trip" value={formatMs(site.responseTime)} />
            <Row label="Server" value={site.performance?.serverResponseTime != null ? formatMs(site.performance.serverResponseTime) : '--'} />
            <Row label="DB query" value={site.performance?.databaseQueryTime != null ? formatMs(site.performance.databaseQueryTime) : '--'} />
          </Panel>
        </>
      ) : null}

      {section === 'SEO' ? (
        <>
          <Panel title="Search engine analysis">
            <View style={styles.stats}>
              <Stat label="SEO score" value={seo.score ?? '--'} />
              <Stat label="Meta" value={seo.metaTags || '--'} />
              <Stat label="SSL" value={seo.sslEnabled ? 'On' : 'Off'} warn={seo.sslEnabled === false} />
            </View>
            <Row label="Site title" value={seo.siteTitle || '--'} />
            <Row label="Description" value={seo.siteDescription || 'Missing'} />
            <Row label="Headings" value={seo.headingStructure?.replace(/_/g, ' ') || '--'} />
            <Row label="Internal links" value={seo.internalLinks ?? '--'} />
            <Row label="External links" value={seo.externalLinks ?? '--'} />
            <Row label="Images with alt" value={seo.altTags ?? '--'} />
          </Panel>
          <Panel title={`Issues (${(seo.seoIssues || []).length})`}>
            {(seo.seoIssues || []).length === 0 ? <Text style={styles.muted}>No SEO issues reported.</Text> : (seo.seoIssues || []).map((item) => (
              <Text key={item} style={styles.issueText}>•  {item}</Text>
            ))}
          </Panel>
          {sc?.siteUrl ? (
            <Panel title="Search Console">
              <Row label="Clicks" value={formatCount(sc.totalClicks)} />
              <Row label="Impressions" value={formatCount(sc.totalImpressions)} />
              <Row label="Avg position" value={sc.averagePosition != null ? Number(sc.averagePosition).toFixed(1) : '--'} />
            </Panel>
          ) : null}
        </>
      ) : null}

      {section === 'Security' ? (
        <>
          <Panel title="Public security check">
            {scanLoading && !(malware || ssl || headers) ? (
              <ActivityIndicator color={colors.brand} style={styles.spinner} />
            ) : null}
            {scanLoading && (malware || ssl || headers) ? (
              <Text style={styles.note}>Refreshing public scan… partial results below.</Text>
            ) : null}
            {scanError ? <Text style={styles.error}>{scanError}</Text> : null}
            {!scanLoading && !malware && !ssl && !headers ? (
              <Text style={styles.muted}>{scan?.checking || scan?.running ? 'Checking this site now…' : 'No public security result is stored yet.'}</Text>
            ) : null}
            {malware || ssl || headers ? (
              <>
                <Row label="Malware" value={malwareText} />
                <Text style={styles.note}>{malware?.message || 'Google Safe Browsing'}</Text>
                <Row label="SSL grade" value={ssl?.grade || (ssl?.status === 'pending' ? 'Grading…' : '--')} />
                <Text style={styles.note}>{ssl?.message || 'SSL Labs'}</Text>
                <Row label="Headers" value={headers?.present != null ? `${headers.present} of ${headers.checked}` : '--'} />
                <Text style={styles.note}>
                  {headers?.error || (headers?.missing?.length ? `Missing ${headers.missing.join(', ')}` : 'Checked headers are present.')}
                </Text>
              </>
            ) : null}
          </Panel>
          <Panel title="Security architecture">
            <View style={styles.stats}>
              <Stat label="Score" value={sec.securityScore ?? '--'} />
              <Stat label="SSL" value={sec.sslStatus || (seo.sslEnabled ? 'ok' : 'off')} />
              <Stat label="Outdated" value={sec.outdatedPlugins ?? 0} warn={(sec.outdatedPlugins || 0) > 0} />
            </View>
            <Row label="Firewall" value={sec.firewall || '--'} />
            <Row label="Vulnerability scan" value={sec.vulnerabilityScan?.replace(/_/g, ' ') || '--'} />
            <Row label="Malware scan" value={sec.malwareScan?.replace(/_/g, ' ') || '--'} />
            <Row label="Security plugins" value={sec.securityPlugins ?? '--'} />
          </Panel>
        </>
      ) : null}

      {section === 'Reports' ? (
        <>
          <Panel title="Data export center">
            <Text style={styles.note}>Export live monitoring data for this site. Choose a range, pick categories, then download CSV (checks) or JSON (selected tabs).</Text>
            <Text style={styles.area}>Date range</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
              {REPORT_PRESETS.map(({ label, days }) => (
                <Pressable key={days} onPress={() => loadReportPreview(days)} style={[styles.pill, reportDays === days && styles.pillOn]}>
                  <Text style={[styles.pillText, reportDays === days && styles.pillTextOn]}>{label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.note}>Exporting last {reportDays} day{reportDays === 1 ? '' : 's'} of data</Text>
            {reportBusy === 'preview' ? <ActivityIndicator color={colors.brand} style={styles.spinner} /> : null}
            {report ? (
              <>
                <Row label="Checks" value={report.summary?.totalChecks ?? '--'} />
                <Row label="Healthy" value={report.summary?.healthy ?? '--'} />
              </>
            ) : null}
          </Panel>
          <Panel title="Categories">
            <View style={styles.exportActions}>
              <Pressable onPress={() => setAllExportCats(true)} style={styles.miniLink}><Text style={styles.miniLinkText}>Select all</Text></Pressable>
              <Pressable
                onPress={() => setExportCats({ checks: true, performance: false, security: false, seo: false, traffic: false })}
                style={styles.miniLink}
              >
                <Text style={styles.miniLinkText}>Checks only</Text>
              </Pressable>
            </View>
            <View style={styles.exportList}>
              {EXPORT_CATEGORIES.map((item) => {
                const on = exportCats[item.id];
                return (
                  <Pressable key={item.id} onPress={() => toggleExportCat(item.id)} style={[styles.exportCard, on && styles.exportCardOn]}>
                    <Text style={styles.exportIcon}>{item.icon}</Text>
                    <View style={styles.exportCopy}>
                      <Text style={styles.pluginName}>{item.label}</Text>
                      <Text style={styles.muted}>{item.desc}</Text>
                    </View>
                    <View style={[styles.exportCheck, on && styles.exportCheckOn]}>
                      <Text style={[styles.exportCheckMark, on && styles.exportCheckMarkOn]}>{on ? '✓' : ''}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Panel>
          {reportError ? <Text style={styles.error}>{reportError}</Text> : null}
          <Pressable onPress={() => exportReport('csv')} disabled={Boolean(reportBusy)} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{reportBusy === 'csv' ? 'Preparing CSV…' : 'Generate CSV report'}</Text>
          </Pressable>
          <Pressable onPress={() => exportReport('json')} disabled={Boolean(reportBusy)} style={styles.ghostBtn}>
            <Text style={styles.ghostBtnText}>{reportBusy === 'json' ? 'Preparing JSON…' : 'Export JSON'}</Text>
          </Pressable>
        </>
      ) : null}

      {section === 'Alerts' ? (
        <Panel title="Active alerts">
          {alertsFor(site).length === 0 ? <Text style={styles.muted}>No alerts from the latest check.</Text> : alertsFor(site).map((alert) => (
            <View key={alert.id} style={styles.issue}>
              <Text style={styles.area}>{alert.priority}</Text>
              <Text style={styles.pluginName}>{alert.title}</Text>
              <Text style={styles.issueText}>{alert.detail}</Text>
            </View>
          ))}
        </Panel>
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

      {section === inventory.tab ? (
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
                  <Text style={[styles.pillText, on && styles.pillTextOn]} numberOfLines={1}>{name}</Text>
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
      </ScrollView>

      <Pressable
        onPress={() => setShowZealot(true)}
        style={[styles.fab, { bottom: Math.max(18, insets.bottom + 12) }]}
        accessibilityLabel="Open Zealot assistant"
      >
        <Image source={ZEALOT_ICON} style={styles.fabImage} />
      </Pressable>

      <Modal visible={showZealot} animationType="slide" transparent onRequestClose={() => setShowZealot(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(12, insets.bottom) }]}>
            <View style={styles.modalHeader}>
              <Image source={ZEALOT_ICON} style={styles.modalAvatar} />
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalKicker}>AI assistant</Text>
                <Text style={styles.modalTitle}>Zealot</Text>
                <Text style={styles.modalSub} numberOfLines={1}>{site.name}</Text>
              </View>
              <Pressable onPress={() => setShowZealot(false)} hitSlop={8} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.chat}>
              {messages.map((message, index) => (
                <View key={`${message.role}-${index}`} style={[styles.bubble, message.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
                  <Text style={[styles.bubbleText, message.role === 'user' && styles.bubbleTextUser]}>{message.text}</Text>
                  {message.reportable ? (
                    <Pressable
                      onPress={() => reportAnswer(index)}
                      disabled={message.report === 'sending' || message.report === 'sent'}
                      hitSlop={6}
                      style={styles.reportButton}
                    >
                      <Text style={styles.reportText}>{REPORT_LABELS[message.report] || REPORT_LABELS.idle}</Text>
                    </Pressable>
                  ) : null}
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
            </ScrollView>
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
            <Text style={styles.ago}>Zealot is AI and can make mistakes. Updated {timeAgo(server.lastChecked || site.lastChecked)}</Text>
          </View>
        </View>
      </Modal>
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
      <Text style={styles.rowLabel} numberOfLines={2}>{label}</Text>
      <Text style={styles.rowValue}>{String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, minHeight: 0 },
  wrap: { gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 },
  spinner: { marginVertical: 24 },
  error: { color: colors.bad, fontWeight: '700', paddingHorizontal: 16 },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: colors.brand,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  proBannerKicker: {
    color: colors.white,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  proBannerText: { flex: 1, color: colors.white, fontSize: 13, fontWeight: '700' },
  sectionBar: {
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.canvas,
  },
  sectionScroll: { flexGrow: 0 },
  pills: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexShrink: 0,
  },
  pillOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { color: colors.inkSoft, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  pillTextOn: { color: colors.white },
  fab: {
    position: 'absolute',
    right: 16,
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#0b1028',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(120,140,255,0.55)',
    shadowColor: '#5868cf',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    zIndex: 20,
  },
  fabImage: { width: 64, height: 64 },
  exportActions: { flexDirection: 'row', gap: 14, marginBottom: 10 },
  miniLink: { paddingVertical: 4 },
  miniLinkText: { color: colors.brand, fontSize: 12, fontWeight: '800' },
  exportList: { gap: 10, marginTop: 4 },
  exportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  exportCardOn: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  exportIcon: { fontSize: 18, width: 28, textAlign: 'center' },
  exportCopy: { flex: 1 },
  exportCheck: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  exportCheckOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  exportCheckMark: { color: 'transparent', fontWeight: '800', fontSize: 13 },
  exportCheckMarkOn: { color: colors.white },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(31,37,87,0.35)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingTop: 14,
    paddingHorizontal: 16,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 12 },
  modalAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#0b1028',
    borderWidth: 1,
    borderColor: 'rgba(120,140,255,0.45)',
  },
  modalTitleWrap: { flex: 1, paddingRight: 8 },
  modalKicker: { color: colors.brand, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  modalTitle: { color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: 2 },
  modalSub: { color: colors.inkSoft, fontSize: 13, fontWeight: '600', marginTop: 2 },
  modalClose: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 8 },
  modalCloseText: { color: colors.inkSoft, fontWeight: '800', fontSize: 12 },
  modalBody: { maxHeight: 360 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.line },
  statPlain: { backgroundColor: colors.brandSoft, borderColor: 'transparent' },
  statLabel: { color: colors.inkMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  statValue: { marginTop: 6, color: colors.ink, fontSize: 18, fontWeight: '800' },
  warn: { color: colors.warn },
  note: { marginTop: 10, color: colors.inkSoft, fontSize: 13, lineHeight: 18 },
  muted: { color: colors.inkMuted, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  rowLabel: { flex: 1, color: colors.ink, fontWeight: '800', fontSize: 13 },
  rowValue: { maxWidth: '48%', color: colors.inkSoft, fontWeight: '700', fontSize: 13, textAlign: 'right' },
  issue: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  area: { color: colors.brand, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8 },
  issueText: { marginTop: 3, color: colors.inkSoft, fontSize: 13, lineHeight: 18 },
  plugin: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  pluginName: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  logLine: { marginTop: 6, color: colors.ink, fontSize: 12, lineHeight: 17 },
  access: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  accessItem: { backgroundColor: colors.brandSoft, color: colors.ink, overflow: 'hidden', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, fontWeight: '800', fontSize: 12 },
  block: { marginTop: 8 },
  primaryBtn: { marginTop: 12, backgroundColor: colors.brand, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontWeight: '800', fontSize: 13, letterSpacing: 0.4, textTransform: 'uppercase' },
  ghostBtn: { marginTop: 10, borderWidth: 1.5, borderColor: colors.brand, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.white },
  ghostBtnText: { color: colors.brand, fontWeight: '800', fontSize: 13 },
  choice: {
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.brandSoft,
  },
  chat: { gap: 8 },
  bubble: { maxWidth: '88%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  bubbleAi: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: colors.brand },
  bubbleText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: colors.white },
  reportButton: { marginTop: 6, alignSelf: 'flex-start' },
  reportText: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prompt: { backgroundColor: colors.white, borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 7 },
  promptText: { color: colors.inkSoft, fontSize: 12, fontWeight: '700' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 },
  input: { flex: 1, minHeight: 44, maxHeight: 100, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10, color: colors.ink, fontSize: 15 },
  send: { backgroundColor: colors.brand, borderRadius: 14, paddingHorizontal: 14, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.white, fontWeight: '800' },
  ago: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
});
