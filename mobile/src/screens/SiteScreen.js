import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, BackHandler, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { userIsPro } from '../session';
import { platformIcon } from '../platforms';
import AdvancedPanel from './AdvancedPanel';
import EditSiteScreen from './EditSiteScreen';
import {
  ALERT_KIND, STATUS_LABEL, UP_STATUSES, availability, clock, displayUrl, formatMs, formatPercent, formatRatio,
  formatWhen, healthScore, latencySeries, platformLabel, runtimeRows, scoreTone, statusTone, tabForAlert, timeAgo,
} from '../metrics';
import { colors, toneColor } from '../theme';
import { KeyValue, MetricCard, Panel, ScoreRing, Sparkline } from '../ui';

// Basic site tabs only — Advanced opens from the header action (Pro) or Pro upsell (Free).
const TABS = ['Overview', 'Performance', 'SEO', 'Security', 'History'];

const HERO = {
  good: { bg: '#1f9d68', title: 'All systems healthy' },
  warn: { bg: '#b8881d', title: 'Needs attention' },
  bad: { bg: '#c5364c', title: 'Check failing' },
  muted: { bg: '#5868cf', title: 'Waiting for first check' },
};

export default function SiteScreen({ siteId, session, onBack, onExpired, alertFocus = null, onDismissAlert }) {
  const [site, setSite] = useState(null);
  const [checks, setChecks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [tab, setTab] = useState('Overview');
  const [upgradeNote, setUpgradeNote] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [advancedSection, setAdvancedSection] = useState('Overview');
  const [zealotPrompt, setZealotPrompt] = useState('');
  const [zealotOpenKey, setZealotOpenKey] = useState(0);
  const [toast, setToast] = useState('');
  const scrollRef = useRef(null);
  const appliedAlert = useRef(null);
  const toastTimer = useRef(null);
  const isPro = userIsPro(session.user);

  const showToast = useCallback((message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const openAdvanced = useCallback((section = 'Overview', { zealot = '' } = {}) => {
    setAdvancedSection(section);
    if (zealot) {
      setZealotPrompt(zealot);
      setZealotOpenKey((n) => n + 1);
    } else {
      setZealotPrompt('');
    }
    setTab('Advanced');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const load = useCallback(async () => {
    const token = session.token;
    try {
      const [nextSite, nextChecks, nextIncidents] = await Promise.all([
        api(`/websites/${siteId}`, { token }),
        api(`/websites/${siteId}/monitoring?hours=24&limit=1440`, { token }),
        api(`/websites/${siteId}/incidents?days=30`, { token }),
      ]);
      setSite(nextSite);
      setChecks(Array.isArray(nextChecks) ? nextChecks : []);
      setIncidents(Array.isArray(nextIncidents) ? nextIncidents : []);
      setError('');
    } catch (err) {
      if (err.status === 401) onExpired();
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [siteId, session.token, onExpired]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Open the tab that explains this alert (History / Security / Overview) once per alert id.
  useEffect(() => {
    if (!alertFocus?._id || appliedAlert.current === alertFocus._id) return;
    appliedAlert.current = alertFocus._id;
    setTab(tabForAlert(alertFocus.type));
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
  }, [alertFocus]);

  const chooseTab = (name) => {
    setTab(name);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  // App's handler leaves the site; this one closes what is open inside it first
  useEffect(() => {
    if (!editing && !menuOpen && tab !== 'Advanced') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editing) setEditing(false);
      else if (menuOpen) setMenuOpen(false);
      else {
        setTab('Overview');
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }
      return true;
    });
    return () => subscription.remove();
  }, [editing, menuOpen, tab]);

  const runCheck = async () => {
    setChecking(true);
    try {
      await api(`/websites/${siteId}/test`, { method: 'POST', token: session.token });
      await load();
      // Force Advanced tabs (vitals, security, analytics pack) to reload the saved live payload.
      setRefreshKey((n) => n + 1);
      return true;
    } catch (err) {
      if (err.status === 401) onExpired();
      else setError(err.message);
      return false;
    } finally {
      setChecking(false);
    }
  };

  const runCheckWithToast = async () => {
    const ok = await runCheck();
    if (!ok) return;
    // Site state updates asynchronously; pull a fresh snapshot for the toast.
    try {
      const next = await api(`/websites/${siteId}`, { token: session.token });
      const ms = next?.responseTime != null ? formatMs(next.responseTime) : '--';
      const scoreLabel = healthScore(next) ?? '--';
      showToast(`Updated · ${ms} · score ${scoreLabel}`);
    } catch {
      showToast('Check finished · data refreshed');
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

  if (editing && site) {
    return (
      <EditSiteScreen
        site={site}
        session={session}
        onBack={() => setEditing(false)}
        onSaved={(next) => { setSite(next); setEditing(false); setMenuOpen(false); }}
        onDeleted={onBack}
        onExpired={onExpired}
      />
    );
  }

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
          {site ? (
            <View style={styles.headerTools}>
              <View style={[styles.scoreChip, { backgroundColor: tone.bg }]}>
                <Text style={[styles.scoreChipText, { color: tone.text }]}>{down ? '!' : score ?? '--'}</Text>
              </View>
              <Pressable onPress={() => setMenuOpen((v) => !v)} hitSlop={8} style={styles.moreBtn}>
                <Text style={styles.moreDots}>⋮</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.scoreChip, { backgroundColor: tone.bg }]}>
              <Text style={[styles.scoreChipText, { color: tone.text }]}>--</Text>
            </View>
          )}
        </View>
        {site ? (
          <>
            <View style={styles.headerMetaRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{isUp ? formatMs(site.responseTime) : '--'}</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{timeAgo(site.lastChecked)}</Text>
              </View>
              <View style={[styles.metaChip, styles.liveChip]}>
                <View style={[styles.liveDot, { backgroundColor: status.text }]} />
                <Text style={[styles.metaChipText, { color: status.text }]}>Live</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => openAdvanced('Overview')}
                style={[
                  styles.advancedChip,
                  isPro ? styles.advancedChipPro : styles.advancedChipFree,
                  tab === 'Advanced' && styles.advancedChipActive,
                ]}
              >
                <Text style={[styles.advancedChipText, isPro && styles.advancedChipTextPro]}>
                  {isPro ? '✦ Advanced' : '✦ Pro'}
                </Text>
              </Pressable>
              <Pressable onPress={runCheckWithToast} disabled={checking} style={styles.checkBtn}>
                <Text style={styles.checkBtnText}>{checking ? 'Checking…' : 'Run check'}</Text>
              </Pressable>
            </View>
          </>
        ) : null}
        {toast ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
        {menuOpen && site ? (
          <View style={styles.menu}>
            <View style={styles.menuHero}>
              <Text style={styles.menuKicker}>Site controls</Text>
              <Text style={styles.menuTitle} numberOfLines={1}>{site.name}</Text>
              <Text style={styles.menuSub} numberOfLines={1}>{displayUrl(site.url)}</Text>
            </View>
            {/* eslint-disable-next-line react-hooks/refs */}
            {[
              { icon: '✎', tint: colors.brandSoft, label: 'Edit site & API key', detail: 'Name, URL, platform, integration key', action: () => setEditing(true) },
              { icon: '↗', tint: '#e8eefc', label: 'Open website', detail: 'Launch live site in the browser', action: () => Linking.openURL(site.url) },
              { icon: '⟳', tint: '#e6f7ef', label: checking ? 'Checking…' : 'Run check now', detail: 'Refresh this tab and all Advanced data', action: () => { runCheckWithToast(); } },
              { icon: '✦', tint: '#eee8ff', label: isPro ? 'Advanced · Pro' : 'Advanced locked', detail: 'Analytics · vitals · security · export · Zealot', action: () => openAdvanced('Overview') },
              { icon: '⇩', tint: '#e8f2ff', label: 'Export center', detail: 'CSV checks or JSON for selected tabs', action: () => openAdvanced('Reports') },
            ].map((item) => (
              <Pressable
                key={item.label}
                onPress={() => { setMenuOpen(false); item.action(); }}
                style={styles.menuItem}
              >
                <View style={[styles.menuIcon, { backgroundColor: item.tint }]}>
                  <Text style={styles.menuIconText}>{item.icon}</Text>
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuText}>{item.label}</Text>
                  <Text style={styles.menuDetail}>{item.detail}</Text>
                </View>
                <Text style={styles.menuChevron}>›</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setMenuOpen(false)} style={styles.menuClose}>
              <Text style={styles.menuMuted}>Close menu</Text>
            </Pressable>
          </View>
        ) : null}
        {tab === 'Advanced' ? (
          <View style={styles.advancedBar}>
            <Pressable onPress={() => chooseTab('Overview')} style={styles.advancedBack}>
              <Text style={styles.advancedBackText}>‹ Site tabs</Text>
            </Pressable>
            <Text style={styles.advancedBarTitle}>{isPro ? 'Advanced · Pro' : 'Advanced · Locked'}</Text>
            <View style={styles.advancedBarSpacer} />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.tabBar}>
            {TABS.map((name) => {
              const active = tab === name;
              return (
                <Pressable key={name} onPress={() => { setMenuOpen(false); chooseTab(name); }} style={styles.tab}>
                  <View style={styles.tabLabelRow}>
                    <Text style={[styles.tabText, active && styles.tabTextOn]}>{name}</Text>
                  </View>
                  <View style={[styles.tabLine, active && styles.tabLineOn]} />
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {site && tab === 'Advanced' && isPro ? (
        <View style={styles.advancedPane}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AdvancedPanel
            site={site}
            session={session}
            onExpired={onExpired}
            refreshKey={refreshKey}
            initialSection={advancedSection}
            zealotPrompt={zealotPrompt}
            zealotOpenKey={zealotOpenKey}
          />
        </View>
      ) : null}

      {!(site && tab === 'Advanced' && isPro) ? (
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!site && loading ? <ActivityIndicator color={colors.brand} style={styles.spinner} /> : null}
        {site && alertFocus ? (
          <View style={styles.alertCard}>
            <View style={styles.alertTop}>
              <Text style={styles.alertKicker}>Alert detail</Text>
              {onDismissAlert ? (
                <Pressable onPress={onDismissAlert} hitSlop={8}>
                  <Text style={styles.alertDismiss}>Dismiss</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.alertTitle}>{alertFocus.title || ALERT_KIND[alertFocus.type] || 'Alert'}</Text>
            <View style={styles.alertGrid}>
              <View style={styles.alertCell}>
                <Text style={styles.alertLabel}>What</Text>
                <Text style={styles.alertValue}>{ALERT_KIND[alertFocus.type] || alertFocus.type || 'Alert'}</Text>
              </View>
              <View style={styles.alertCell}>
                <Text style={styles.alertLabel}>When</Text>
                <Text style={styles.alertValue}>{formatWhen(alertFocus.createdAt)}</Text>
              </View>
            </View>
            <View style={styles.alertWhy}>
              <Text style={styles.alertLabel}>Why</Text>
              <Text style={styles.alertValue}>{alertFocus.body || 'No extra detail was stored with this alert.'}</Text>
            </View>
          </View>
        ) : null}
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
            {!isPro ? (
              <Pressable onPress={() => openAdvanced('Overview')} style={styles.overviewPro}>
                <Text style={styles.overviewProKicker}>Recommended</Text>
                <Text style={styles.overviewProTitle}>Upgrade to Pro for Advanced insights</Text>
                <Text style={styles.overviewProLead}>
                  Analytics, PageSpeed, security scans, export, and Zealot — unlock the same dashboard as the website.
                </Text>
                <Text style={styles.overviewProCta}>See Pro features ›</Text>
              </Pressable>
            ) : (
              <>
                <Pressable onPress={() => openAdvanced('Overview')} style={styles.overviewProOpen}>
                  <Text style={styles.overviewProOpenText}>Open Advanced · Analytics, vitals, security, export</Text>
                  <Text style={styles.overviewProOpenChevron}>›</Text>
                </Pressable>
                <Pressable
                  onPress={() => openAdvanced('Overview', {
                    zealot: `Give me a quick health briefing for ${site.name}. What should I watch first?`,
                  })}
                  style={styles.zealotAsk}
                >
                  <Text style={styles.zealotAskKicker}>Zealot</Text>
                  <Text style={styles.zealotAskText}>Ask Zealot about this site</Text>
                  <Text style={styles.zealotAskChevron}>›</Text>
                </Pressable>
              </>
            )}
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
                ['Platform', platformLabel(site.platform)],
                ...runtimeRows(site),
                ['Active plugins', perf.activePlugins ?? null],
                ['Content items', seo.totalContent ?? null],
              ]} />
            </Panel>
            {['wordpress', 'nextjs', 'laravel', 'codeigniter', 'php'].includes(site.platform) ? (
              <Panel title={{ wordpress: 'Plugins', nextjs: 'Libraries', laravel: 'Packages', codeigniter: 'Packages', php: 'Packages' }[site.platform]}>
                {Array.isArray(sec.inventory) && sec.inventory.length > 0 ? (
                  <KeyValue rows={sec.inventory.map((item) => [item.dev ? `${item.name} · dev` : item.name, item.version || '--'])} />
                ) : (
                  <Text style={styles.muted}>Not reported yet.</Text>
                )}
              </Panel>
            ) : null}
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
              <Sparkline series={series} height={160} />
            </Panel>
            <View style={styles.scoreCard}>
              <View style={styles.scoreHero}>
                <ScoreRing value={perf.performanceScore ?? null} tone={scoreTone(perf.performanceScore)} label="Perf" />
                <View style={styles.scoreHeroCopy}>
                  <Text style={styles.scoreHeroTitle}>Performance</Text>
                  <Text style={styles.scoreHeroLead}>Server timings from the latest live check.</Text>
                  <Text style={styles.scoreHeroMetric}>{isUp ? formatMs(site.responseTime) : '--'} round trip</Text>
                </View>
              </View>
              <View style={styles.scoreDetails}>
                <KeyValue
                  compact
                  rows={[
                    ['Server', perf.serverResponseTime != null ? formatMs(perf.serverResponseTime) : null],
                    ['DB query', perf.databaseQueryTime != null ? formatMs(perf.databaseQueryTime) : null],
                    ['CPU', formatRatio(perf.cpuUsage)],
                    ['Memory', formatRatio(perf.memoryUsage)],
                    ['Plugins', perf.activePlugins ?? null],
                  ]}
                />
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
          <>
            <ScoreBlock
              label="Security"
              score={sec.securityScore}
              rows={[
                ['SSL', sec.sslStatus],
                ['Firewall', sec.firewall],
                ['Vulnerability scan', sec.vulnerabilityScan?.replace(/_/g, ' ')],
                ['Malware scan', sec.malwareScan?.replace(/_/g, ' ')],
                ...runtimeRows(site),
                ['Plugins', sec.totalPlugins],
                ['Outdated plugins', sec.outdatedPlugins],
                ['Security plugins', sec.securityPlugins],
              ]}
              itemsTitle="Recommendations"
              items={sec.recommendations || []}
              empty="No security recommendations."
            />
            {isPro ? (
              <Pressable
                onPress={() => openAdvanced('Security', {
                  zealot: `Review security for ${site.name}. Score is ${sec.securityScore ?? 'unknown'}. What should I fix first?`,
                })}
                style={styles.zealotAsk}
              >
                <Text style={styles.zealotAskKicker}>Zealot</Text>
                <Text style={styles.zealotAskText}>Ask Zealot about this security score</Text>
                <Text style={styles.zealotAskChevron}>›</Text>
              </Pressable>
            ) : null}
          </>
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
          <View style={styles.pro}>
            <View style={styles.proLockRow}>
              <Text style={styles.proKicker}>PRO FEATURE</Text>
              <Text style={styles.proLock}>Locked</Text>
            </View>
            <Text style={styles.proTitle}>Advanced for {site.name}</Text>
            <Text style={styles.proLead}>Same Pro Advanced view as the website — Analytics, Web Vitals, security scans, plugins, logs, export and Zealot.</Text>
            {['Google Analytics & Search Console', 'PageSpeed & Core Web Vitals', 'Public security scan', 'Plugin / package audit', 'CSV & JSON export', 'Zealot assistant'].map((item) => (
              <Text key={item} style={styles.proItem}>✦  {item}</Text>
            ))}
            <Pressable
              onPress={async () => {
                try {
                  const result = await api('/auth/upgrade-request', { method: 'POST', token: session.token });
                  setError('');
                  setUpgradeNote(result?.user?.upgradeRequestedAt || session.user?.upgradeRequestedAt
                    ? 'Pro request sent. We will activate it soon.'
                    : 'Pro request sent.');
                } catch (err) {
                  if (err.status === 401) onExpired();
                  else setError(err.message);
                }
              }}
              style={styles.proCta}
            >
              <Text style={styles.proCtaText}>
                {session.user?.upgradeRequestedAt || upgradeNote ? 'Pro request pending' : 'Request Pro access'}
              </Text>
            </Pressable>
            {upgradeNote ? <Text style={styles.proNote}>{upgradeNote}</Text> : null}
            <Pressable onPress={() => chooseTab('Overview')} style={styles.proBack}>
              <Text style={styles.proBackText}>‹ Back to site overview</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      ) : null}

      {site ? (
        <View style={styles.footer}>
          <View style={styles.footerPlatform}>
            {platformIcon(site.platform) ? <Image source={platformIcon(site.platform)} style={styles.footerIcon} resizeMode="contain" /> : null}
            <Text style={styles.footerText}>{platformLabel(site.platform)}</Text>
          </View>
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
      <View style={styles.scoreCard}>
        <View style={styles.scoreHero}>
          <ScoreRing value={score ?? null} tone={scoreTone(score)} label={label} />
          <View style={styles.scoreHeroCopy}>
            <Text style={styles.scoreHeroTitle}>{label}</Text>
            <Text style={styles.scoreHeroLead}>
              {score == null ? 'Waiting for the next detailed check.' : `Score ${score} from the latest site check.`}
            </Text>
          </View>
        </View>
        <View style={styles.scoreDetails}>
          <KeyValue compact rows={rows} />
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { backgroundColor: colors.canvas, paddingTop: 4 },
  headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: colors.line },
  back: { fontSize: 28, lineHeight: 30, color: colors.ink, fontWeight: '500', marginTop: -2 },
  titleText: { flex: 1, paddingRight: 10 },
  name: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  url: { marginTop: 2, color: colors.brand, fontSize: 13, fontWeight: '700' },
  headerTools: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreChip: { minWidth: 48, height: 48, paddingHorizontal: 10, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  scoreChipText: { fontSize: 18, fontWeight: '800' },
  moreBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  moreDots: { color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: -4 },
  headerMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveChip: { backgroundColor: colors.goodSoft, borderColor: 'transparent' },
  metaChipText: { color: colors.inkSoft, fontSize: 11, fontWeight: '800' },
  liveDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  advancedChip: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advancedChipPro: { backgroundColor: colors.brand, borderColor: colors.brand },
  advancedChipFree: { backgroundColor: '#fff6e8', borderColor: '#e0a04a' },
  advancedChipActive: { opacity: 0.92 },
  advancedChipText: { color: '#9a6a1a', fontSize: 12, fontWeight: '800' },
  advancedChipTextPro: { color: colors.white },
  checkBtn: {
    flex: 1,
    backgroundColor: colors.brandDark,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  toast: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toastText: { color: colors.white, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  advancedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  advancedBack: { paddingVertical: 4, paddingRight: 10 },
  advancedBackText: { color: colors.brand, fontSize: 13, fontWeight: '800' },
  advancedBarTitle: { flex: 1, textAlign: 'center', color: colors.ink, fontSize: 13, fontWeight: '800' },
  advancedBarSpacer: { width: 72 },
  zealotAsk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0b1028',
  },
  zealotAskKicker: {
    color: '#7dd3fc',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  zealotAskText: { flex: 1, color: colors.white, fontSize: 13, fontWeight: '800' },
  zealotAskChevron: { color: 'rgba(255,255,255,0.7)', fontSize: 20, fontWeight: '300' },
  proBack: { marginTop: 14, alignItems: 'center' },
  proBackText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '800' },
  overviewPro: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors.brand,
  },
  overviewProKicker: {
    alignSelf: 'flex-start',
    color: colors.white,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  overviewProTitle: { marginTop: 10, color: colors.white, fontSize: 17, fontWeight: '800' },
  overviewProLead: { marginTop: 6, color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  overviewProCta: { marginTop: 12, color: colors.white, fontSize: 13, fontWeight: '800' },
  overviewProOpen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  overviewProOpenText: { flex: 1, color: colors.brandDark || colors.brand, fontSize: 13, fontWeight: '800' },
  overviewProOpenChevron: { color: colors.brand, fontSize: 22, fontWeight: '300' },
  menu: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    shadowColor: '#1f2557',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  menuHero: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.brand,
  },
  menuKicker: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  menuTitle: { marginTop: 4, color: colors.white, fontSize: 18, fontWeight: '800' },
  menuSub: { marginTop: 2, color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconText: { color: colors.brandDark, fontSize: 15, fontWeight: '800' },
  menuCopy: { flex: 1 },
  menuText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  menuDetail: { marginTop: 2, color: colors.inkMuted, fontSize: 11, fontWeight: '600' },
  menuChevron: { color: colors.inkMuted, fontSize: 22, fontWeight: '300' },
  menuClose: { paddingVertical: 12, alignItems: 'center' },
  menuMuted: { color: colors.inkMuted, fontWeight: '700' },
  tabBar: { borderBottomWidth: 1, borderBottomColor: colors.line, marginTop: 12, maxHeight: 46 },
  tabs: { paddingHorizontal: 16, gap: 16, alignItems: 'flex-end', paddingTop: 4 },
  tab: { paddingBottom: 10, flexShrink: 0 },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sparkle: { color: colors.brand, fontSize: 12, fontWeight: '800' },
  tabText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.inkMuted },
  tabTextOn: { color: colors.brand },
  tabTextPro: { color: colors.brandDark },
  proBadge: {
    marginLeft: 2,
    backgroundColor: colors.brand,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proBadgeOn: { backgroundColor: colors.brandDark },
  proBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  tabLine: { height: 3, borderRadius: 99, marginTop: 8, backgroundColor: 'transparent' },
  tabLineOn: { backgroundColor: colors.brand },
  tabLinePro: { backgroundColor: colors.brandDark },
  advancedPane: { flex: 1, minHeight: 0 },
  body: { padding: 16, gap: 12, paddingBottom: 28 },
  error: { color: colors.bad, fontWeight: '700', paddingHorizontal: 16, paddingTop: 8 },
  spinner: { marginTop: 32 },
  alertCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.brandSoft,
  },
  alertTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  alertKicker: { color: colors.brand, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  alertDismiss: { color: colors.inkMuted, fontSize: 12, fontWeight: '800' },
  alertTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 10 },
  alertGrid: { flexDirection: 'row', gap: 12 },
  alertCell: { flex: 1 },
  alertWhy: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  alertLabel: { color: colors.inkMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  alertValue: { color: colors.ink, fontSize: 13, fontWeight: '700', marginTop: 3, lineHeight: 18 },
  hero: { borderRadius: 22, padding: 18, overflow: 'hidden' },
  heroOrb: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.14)', top: -50, right: -30 },
  heroOrbSmall: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.1)', bottom: -36, right: 48 },
  heroTitle: { color: colors.white, fontSize: 18, fontWeight: '800' },
  heroDetail: { marginTop: 6, color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  scoreCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  scoreHero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  scoreHeroCopy: { flex: 1, minWidth: 0 },
  scoreHeroTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  scoreHeroLead: { marginTop: 4, color: colors.inkSoft, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  scoreHeroMetric: { marginTop: 8, color: colors.brand, fontSize: 13, fontWeight: '800' },
  scoreDetails: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 4 },
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
  proLockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  proKicker: { color: colors.white, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  proLock: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  proTitle: { marginTop: 14, color: colors.white, fontSize: 24, fontWeight: '800' },
  proLead: { marginTop: 8, color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 20 },
  proItem: { marginTop: 10, color: colors.white, fontSize: 14, fontWeight: '700' },
  proCta: { marginTop: 18, backgroundColor: colors.white, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  proCtaText: { color: colors.brand, fontWeight: '800', fontSize: 13, letterSpacing: 0.4, textTransform: 'uppercase' },
  proNote: { marginTop: 10, color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
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
  footerPlatform: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerIcon: { width: 14, height: 14 },
  footerText: { color: colors.inkSoft, fontSize: 11, fontWeight: '800' },
  footerStatus: { marginLeft: 'auto', overflow: 'hidden', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: '800' },
});
