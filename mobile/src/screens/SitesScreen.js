import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, BackHandler, FlatList, Image, Linking, Pressable, RefreshControl, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { api } from '../api';
import { userIsPro } from '../session';
import DeleteAccountModal from './DeleteAccountModal';
import {
  STATUS_LABEL, displayUrl, formatMs, healthScore, platformLabel, scoreTone, statusTone, timeAgo,
} from '../metrics';
import { platformIcon } from '../platforms';
import { colors, toneColor } from '../theme';

function BellIcon({ color = colors.brand, size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.3 21a1.94 1.94 0 0 0 3.4 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PlusIcon({ color = colors.brand, size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function SparklesIcon({ color = colors.brand, size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

function ShareIcon({ color = colors.brand, size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 3v12M8 7l4-4 4 4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function GlobeIcon({ color = colors.brand, size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" stroke={color} strokeWidth={2} />
      <Path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function LogOutIcon({ color = colors.bad, size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ShieldIcon({ color = colors.brand, size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TrashIcon({ color = colors.bad, size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'healthy', label: 'Healthy' },
  { id: 'warning', label: 'Warning' },
  { id: 'down', label: 'Down' },
];

const matches = (site, filter) => {
  if (filter === 'all') return true;
  if (filter === 'down') return site.status === 'error' || site.status === 'offline';
  return site.status === filter;
};

export default function SitesScreen({ session, onOpen, onAlerts, onAdd, onSignOut, onDeleted, onExpired, onUser }) {
  const [sites, setSites] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusUrl, setStatusUrl] = useState('');
  const [accountNote, setAccountNote] = useState('');
  const isPro = userIsPro(session.user);
  const avatarUrl = session.user?.avatarUrl || session.user?.avatar_url || null;
  const initials = (session.user?.name || session.user?.email || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

  const load = useCallback(async () => {
    try {
      const [data, alerts] = await Promise.all([
        api('/websites', { token: session.token }),
        api('/notifications?limit=1', { token: session.token }).catch(() => null),
      ]);
      setSites(Array.isArray(data) ? data : []);
      if (alerts) setUnread(alerts.unread);
      setError('');
    } catch (err) {
      if (err.status === 401 || err.status === 403) onExpired();
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session.token, onExpired]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setMenuOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [menuOpen]);

  const searched = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return sites;
    return sites.filter((site) => (
      site.name.toLowerCase().includes(term) || site.url.toLowerCase().includes(term)
    ));
  }, [sites, query]);

  const filterCounts = useMemo(() => ({
    all: searched.length,
    healthy: searched.filter((site) => matches(site, 'healthy')).length,
    warning: searched.filter((site) => matches(site, 'warning')).length,
    down: searched.filter((site) => matches(site, 'down')).length,
  }), [searched]);

  const visible = useMemo(
    () => searched.filter((site) => matches(site, filter)),
    [searched, filter],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Image source={require('../../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.kicker}>{visible.length} of {sites.length} sites</Text>
        </View>
        <Pressable onPress={onAlerts} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Alerts">
          <BellIcon />
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable onPress={onAdd} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Add site">
          <PlusIcon />
        </Pressable>
        <Pressable onPress={() => setMenuOpen((v) => !v)} hitSlop={8} style={styles.avatarBtn} accessibilityLabel="Account menu">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          {isPro ? <View style={styles.avatarProDot} /> : null}
        </Pressable>
      </View>
      <Text style={styles.account} numberOfLines={1}>
        {session.user?.name || session.user?.email} · {isPro ? 'Pro' : 'Free'}
      </Text>
      <DeleteAccountModal
        visible={deleting}
        session={session}
        onClose={() => setDeleting(false)}
        onDeleted={onDeleted}
        onExpired={onExpired}
      />
      {menuOpen ? (
        <View style={styles.menu}>
          <View style={styles.menuHero}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.menuAvatar} />
            ) : (
              <View style={[styles.avatarFallback, styles.menuAvatarFallback]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.menuHeroCopy}>
              <Text style={styles.menuHeroName} numberOfLines={1}>{session.user?.name || 'Account'}</Text>
              <Text style={styles.menuHeroEmail} numberOfLines={1}>{session.user?.email}</Text>
              <Text style={styles.menuHeroPlan}>{isPro ? 'Pro plan' : 'Free plan'}</Text>
            </View>
          </View>
          {[
            {
              key: 'pro',
              icon: SparklesIcon,
              tint: '#eee8ff',
              label: isPro ? 'Your Pro plan' : session.user?.upgradeRequestedAt ? 'Pro request pending' : 'Request Pro upgrade',
              detail: isPro ? 'Advanced analytics unlocked' : 'Analytics, vitals, security, Zealot',
              action: async () => {
                try {
                  const result = await api('/auth/upgrade-request', { method: 'POST', token: session.token });
                  if (result?.user) onUser?.(result.user);
                  setAccountNote(isPro ? 'You are already on Pro.' : 'Pro request sent.');
                } catch (err) {
                  if (err.status === 401) onExpired();
                  else setAccountNote(err.message);
                }
              },
            },
            {
              key: 'status',
              icon: ShareIcon,
              tint: '#e6f7ef',
              label: 'Share public status',
              detail: 'Send your public status page link',
              action: async () => {
                try {
                  const data = statusUrl ? { url: statusUrl } : await api('/auth/status-page', { token: session.token });
                  if (data.url) {
                    setStatusUrl(data.url);
                    await Share.share({ message: data.url, title: 'Public status page' });
                  } else setAccountNote('No public status link yet.');
                } catch (err) {
                  if (err.status === 401) onExpired();
                  else setAccountNote(err.message);
                }
              },
            },
            {
              key: 'web',
              icon: GlobeIcon,
              tint: '#e8eefc',
              label: 'Open website',
              detail: 'webmonitor.ruyalab.com',
              action: () => Linking.openURL('https://webmonitor.ruyalab.com'),
            },
            {
              key: 'legal',
              icon: ShieldIcon,
              tint: '#e8eefc',
              label: 'Privacy and terms',
              detail: 'How your data is handled',
              action: () => Linking.openURL('https://webmonitor.ruyalab.com/privacy'),
            },
            {
              key: 'out',
              icon: LogOutIcon,
              tint: colors.badSoft,
              label: 'Sign out',
              detail: 'Switch account or leave this device',
              danger: true,
              action: onSignOut,
            },
            {
              key: 'delete',
              icon: TrashIcon,
              tint: colors.badSoft,
              label: 'Delete account',
              detail: 'Permanently remove your account and data',
              danger: true,
              action: () => setDeleting(true),
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Pressable key={item.key} onPress={item.action} style={styles.menuItem}>
                <View style={[styles.menuIcon, { backgroundColor: item.tint }]}>
                  <Icon color={item.danger ? colors.bad : colors.brand} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={[styles.menuText, item.danger && styles.menuDanger]}>{item.label}</Text>
                  <Text style={styles.menuDetail}>{item.detail}</Text>
                </View>
                <Text style={styles.menuChevron}>›</Text>
              </Pressable>
            );
          })}
          {accountNote ? <Text style={styles.menuNote}>{accountNote}</Text> : null}
        </View>
      ) : null}

      <View style={styles.search}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search sites"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
      </View>
      <View style={styles.filters}>
        {FILTERS.map((item) => {
          const on = filter === item.id;
          const count = filterCounts[item.id] ?? 0;
          const toneStyle = !on && item.id === 'healthy' && count > 0 ? styles.filterHealthy
            : !on && item.id === 'warning' && count > 0 ? styles.filterWarning
              : !on && item.id === 'down' && count > 0 ? styles.filterDown
                : null;
          const countStyle = on ? styles.filterCountOn
            : item.id === 'healthy' ? styles.filterCountHealthy
              : item.id === 'warning' ? styles.filterCountWarning
                : item.id === 'down' ? styles.filterCountDown
                  : styles.filterCount;
          return (
            <Pressable
              key={item.id}
              onPress={() => setFilter(item.id)}
              style={[styles.filter, on && styles.filterOn, toneStyle]}
            >
              <Text style={[styles.filterText, on && styles.filterTextOn]}>{item.label}</Text>
              <View style={[styles.filterCountWrap, on && styles.filterCountWrapOn, !on && countStyle]}>
                <Text style={[styles.filterCountText, on && styles.filterCountTextOn]}>{count}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={visible}
        keyExtractor={(item) => item._id}
        contentContainerStyle={visible.length === 0 ? styles.emptyWrap : styles.list}
        ItemSeparatorComponent={() => <View style={styles.cardGap} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        ListHeaderComponent={!isPro ? (
          <Pressable
            onPress={async () => {
              try {
                const result = await api('/auth/upgrade-request', { method: 'POST', token: session.token });
                if (result?.user) onUser?.(result.user);
                setAccountNote(session.user?.upgradeRequestedAt ? 'Pro request already pending.' : 'Pro request sent.');
                setMenuOpen(true);
              } catch (err) {
                if (err.status === 401) onExpired();
                else {
                  setAccountNote(err.message);
                  setMenuOpen(true);
                }
              }
            }}
            style={styles.proBanner}
          >
            <View style={styles.proBannerBadge}>
              <Text style={styles.proBannerBadgeText}>PRO</Text>
            </View>
            <View style={styles.proBannerCopy}>
              <Text style={styles.proBannerTitle}>
                {session.user?.upgradeRequestedAt ? 'Pro request pending' : 'Unlock Advanced monitoring'}
              </Text>
              <Text style={styles.proBannerLead}>
                Analytics, Web Vitals, security scans, export, and Zealot — same as the website.
              </Text>
            </View>
            <Text style={styles.proBannerCta}>{session.user?.upgradeRequestedAt ? 'Pending' : 'Upgrade'}</Text>
          </Pressable>
        ) : null}
        ListEmptyComponent={!loading ? (
          <Text style={styles.empty}>{sites.length === 0 ? 'No sites on this account yet. Tap Add to connect one, then pull to refresh.' : 'No sites match this search.'}</Text>
        ) : <ActivityIndicator color={colors.brand} style={styles.spinner} />}
        renderItem={({ item }) => {
          const down = item.status === 'error' || item.status === 'offline';
          const score = healthScore(item);
          const tone = toneColor[down ? 'bad' : scoreTone(score)];
          const status = toneColor[statusTone(item.status)];
          return (
            <Pressable onPress={() => onOpen(item._id)} style={styles.card}>
              <View style={[styles.accent, { backgroundColor: tone.text }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <View style={styles.cardTitle}>
                    <View style={styles.platform}>
                      {platformIcon(item.platform) ? (
                        <Image source={platformIcon(item.platform)} style={styles.platformIcon} resizeMode="contain" />
                      ) : null}
                      <Text style={styles.platformText} numberOfLines={1}>{platformLabel(item.platform)}</Text>
                    </View>
                    <Text style={styles.url} numberOfLines={1}>{displayUrl(item.url)}</Text>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  </View>
                  <Text style={[styles.score, { color: tone.text }]}>{down ? '!' : score ?? '--'}</Text>
                </View>
                <View style={styles.meta}>
                  <View style={[styles.dot, { backgroundColor: status.text }]} />
                  <Text style={styles.metaText}>{STATUS_LABEL[item.status] || 'Waiting'}</Text>
                  <Text style={styles.faint}>·</Text>
                  <Text style={styles.metaText}>{timeAgo(item.lastChecked)}</Text>
                  <Text style={styles.response}>{down ? '--' : formatMs(item.responseTime)}</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 6 },
  headerText: { flex: 1 },
  logo: { width: 108, height: 40 },
  kicker: { marginTop: 6, color: colors.inkMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.bad,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.canvas,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: colors.white, fontSize: 13, fontWeight: '800' },
  avatarProDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.good,
    borderWidth: 2,
    borderColor: colors.canvas,
  },
  account: { marginTop: 2, marginHorizontal: 20, color: colors.inkSoft, fontSize: 13, fontWeight: '700' },
  menu: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  menuHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.brandSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  menuAvatar: { width: 48, height: 48, borderRadius: 24 },
  menuAvatarFallback: { width: 48, height: 48, borderRadius: 24 },
  menuHeroCopy: { flex: 1, minWidth: 0 },
  menuHeroName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  menuHeroEmail: { marginTop: 2, color: colors.inkSoft, fontSize: 12, fontWeight: '600' },
  menuHeroPlan: { marginTop: 4, color: colors.brand, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCopy: { flex: 1, minWidth: 0 },
  menuText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  menuDetail: { marginTop: 2, color: colors.inkMuted, fontSize: 11, fontWeight: '600' },
  menuChevron: { color: colors.inkMuted, fontSize: 22, fontWeight: '300' },
  menuDanger: { color: colors.bad },
  menuNote: { paddingHorizontal: 16, paddingVertical: 12, color: colors.inkSoft, fontSize: 12, fontWeight: '600' },
  search: { marginHorizontal: 16, marginTop: 14, backgroundColor: '#e4e8f8', borderRadius: 16, paddingHorizontal: 14 },
  searchInput: { height: 46, color: colors.ink, fontSize: 15, fontWeight: '700' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterHealthy: { backgroundColor: colors.goodSoft, borderColor: 'rgba(31,157,104,0.2)' },
  filterWarning: { backgroundColor: colors.warnSoft, borderColor: 'rgba(166,124,18,0.22)' },
  filterDown: { backgroundColor: colors.badSoft, borderColor: 'rgba(197,54,76,0.2)' },
  filterText: { color: colors.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  filterTextOn: { color: colors.white },
  filterCountWrap: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  filterCountWrapOn: { backgroundColor: 'rgba(255,255,255,0.22)' },
  filterCount: { backgroundColor: colors.brandSoft },
  filterCountHealthy: { backgroundColor: 'rgba(31,157,104,0.18)' },
  filterCountWarning: { backgroundColor: 'rgba(166,124,18,0.18)' },
  filterCountDown: { backgroundColor: 'rgba(197,54,76,0.16)' },
  filterCountText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  filterCountTextOn: { color: colors.white },
  error: { marginHorizontal: 20, marginBottom: 8, color: colors.bad, fontWeight: '700' },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: colors.brand,
  },
  proBannerBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  proBannerBadgeText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  proBannerCopy: { flex: 1, minWidth: 0 },
  proBannerTitle: { color: colors.white, fontSize: 14, fontWeight: '800' },
  proBannerLead: { marginTop: 3, color: 'rgba(255,255,255,0.88)', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  proBannerCta: {
    color: colors.brand,
    backgroundColor: colors.white,
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 11,
    fontWeight: '800',
  },
  list: { paddingHorizontal: 16, paddingBottom: 28, paddingTop: 8 },
  cardGap: { height: 12 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', padding: 32 },
  empty: { textAlign: 'center', color: colors.inkSoft, fontSize: 16, lineHeight: 22 },
  spinner: { marginTop: 48 },
  card: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 18, overflow: 'hidden' },
  accent: { width: 4 },
  cardBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { flex: 1, paddingRight: 10 },
  platform: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, marginBottom: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.brandSoft },
  platformIcon: { width: 14, height: 14 },
  platformText: { color: colors.inkSoft, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  url: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  name: { marginTop: 2, color: colors.ink, fontSize: 16, fontWeight: '800' },
  score: { fontSize: 26, fontWeight: '800' },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  metaText: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  faint: { color: colors.inkMuted, marginHorizontal: 6 },
  response: { marginLeft: 'auto', color: colors.ink, fontSize: 13, fontWeight: '800' },
});