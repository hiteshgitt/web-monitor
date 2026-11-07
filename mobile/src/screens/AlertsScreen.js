import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { api } from '../api';
import { ALERT_KIND, timeAgo } from '../metrics';
import { colors } from '../theme';

const META = {
  site_down: { color: colors.bad, bg: colors.badSoft, label: 'Critical', kind: 'Down' },
  ssl_off: { color: colors.bad, bg: colors.badSoft, label: 'Critical', kind: 'SSL' },
  slow: { color: colors.warn, bg: colors.warnSoft, label: 'Warning', kind: 'Speed' },
  security_low: { color: colors.warn, bg: colors.warnSoft, label: 'Warning', kind: 'Security' },
  plugins: { color: colors.warn, bg: colors.warnSoft, label: 'Warning', kind: 'Updates' },
  site_up: { color: colors.good, bg: colors.goodSoft, label: 'Recovered', kind: 'Up' },
  slow_ok: { color: colors.good, bg: colors.goodSoft, label: 'Recovered', kind: 'Speed' },
  ssl_ok: { color: colors.good, bg: colors.goodSoft, label: 'Recovered', kind: 'SSL' },
};

function AlertIcon({ type, color }) {
  const stroke = color || colors.brand;
  if (type === 'site_down' || type === 'site_up') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={2} />
        <Path d="M12 8v5M12 16.5h.01" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }
  if (type === 'slow' || type === 'slow_ok') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={2} />
        <Path d="M12 7v5l3 2" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  if (type === 'ssl_off' || type === 'ssl_ok' || type === 'security_low') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Alert history plus the switches for which alerts are pushed to this phone (and the customer's browsers)
export default function AlertsScreen({ session, onBack, onOpenAlert, onExpired }) {
  const [tab, setTab] = useState('history');
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [history, prefs] = await Promise.all([
        api('/notifications?limit=50', { token: session.token }),
        api('/notifications/settings', { token: session.token }),
      ]);
      setItems(history.notifications);
      setSettings(prefs);
      setError('');
      if (history.unread > 0) api('/notifications/read', { method: 'POST', token: session.token, body: {} }).catch(() => {});
    } catch (err) {
      if (err.status === 401 || err.status === 403) onExpired();
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session.token, onExpired]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const setPref = async (key, value) => {
    const previous = settings.prefs;
    setSettings((s) => ({ ...s, prefs: { ...s.prefs, [key]: value } }));
    try {
      const { prefs } = await api('/notifications/settings', { method: 'PUT', token: session.token, body: { [key]: value } });
      setSettings((s) => ({ ...s, prefs }));
    } catch (err) {
      setSettings((s) => ({ ...s, prefs: previous }));
      if (err.status === 401) onExpired();
      else setError(err.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10}><Text style={styles.back}>‹ Sites</Text></Pressable>
        <Text style={styles.title}>Alerts</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.tabs}>
        {[['history', 'History'], ['settings', 'Settings']].map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabOn]}>
            <Text style={[styles.tabText, tab === id && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        {loading && !settings ? <ActivityIndicator color={colors.brand} style={styles.spinner} /> : null}

        {tab === 'history' && settings ? (
          items.length === 0 ? (
            <Text style={styles.empty}>No alerts yet. You’ll see them here when a site goes down, slows down or has updates waiting.</Text>
          ) : items.map((item) => {
            const meta = META[item.type] || { color: colors.brand, bg: colors.brandSoft, label: 'Alert', kind: ALERT_KIND[item.type] || 'Alert' };
            return (
              <Pressable
                key={item._id}
                disabled={!item.websiteId}
                onPress={() => onOpenAlert?.(item)}
                style={[styles.item, !item.read && styles.itemUnread]}
              >
                <View style={[styles.itemIcon, { backgroundColor: meta.bg }]}>
                  <AlertIcon type={item.type} color={meta.color} />
                </View>
                <View style={styles.itemBody}>
                  <View style={styles.itemTop}>
                    <View style={[styles.severity, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.severityText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    <Text style={styles.itemTime}>{timeAgo(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                  {item.websiteName ? (
                    <Text style={styles.itemSite} numberOfLines={1}>{item.websiteName}</Text>
                  ) : item.websiteId ? (
                    <Text style={styles.itemSite}>Open site details</Text>
                  ) : null}
                  {item.body ? <Text style={styles.itemText} numberOfLines={3}>{item.body}</Text> : null}
                  <Text style={styles.itemKind}>{meta.kind}</Text>
                </View>
                {item.websiteId ? <Text style={styles.itemChevron}>›</Text> : null}
              </Pressable>
            );
          })
        ) : null}

        {tab === 'settings' && settings ? (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Push notifications</Text>
                  <Text style={styles.rowSub}>Master switch for this phone and your browsers</Text>
                </View>
                <Switch value={settings.prefs.push} onValueChange={(v) => setPref('push', v)} trackColor={{ true: colors.brand }} />
              </View>
            </View>
            <View style={[styles.card, !settings.prefs.push && styles.dim]}>
              {settings.types.map((type, i) => (
                <View key={type.key} style={[styles.row, i > 0 && styles.rowLine]}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{type.label}</Text>
                    <Text style={styles.rowSub}>{type.description}</Text>
                  </View>
                  <Switch
                    value={settings.prefs[type.key]}
                    disabled={!settings.prefs.push}
                    onValueChange={(v) => setPref(type.key, v)}
                    trackColor={{ true: colors.brand }}
                  />
                </View>
              ))}
            </View>
            <Text style={styles.note}>Every alert is still listed under History, whatever you switch off here. If alerts don’t arrive, allow notifications for Web Monitor in your phone’s settings.</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  back: { color: colors.brand, fontWeight: '800', fontSize: 15, width: 70 },
  title: { flex: 1, textAlign: 'center', color: colors.ink, fontSize: 18, fontWeight: '800' },
  headerSpacer: { width: 70 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.7)' },
  tabOn: { backgroundColor: colors.brand },
  tabText: { color: colors.inkSoft, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  tabTextOn: { color: colors.white },
  error: { marginHorizontal: 20, marginBottom: 8, color: colors.bad, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 },
  spinner: { marginTop: 48 },
  empty: { textAlign: 'center', color: colors.inkSoft, fontSize: 15, lineHeight: 22, marginTop: 48, paddingHorizontal: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  itemUnread: { borderColor: colors.brand, backgroundColor: '#f7f8ff' },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  severity: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  severityText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  itemTime: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  itemTitle: { marginTop: 6, color: colors.ink, fontSize: 15, fontWeight: '800' },
  itemSite: { marginTop: 3, color: colors.brand, fontSize: 12, fontWeight: '800' },
  itemText: { color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 4 },
  itemKind: { marginTop: 6, color: colors.inkMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  itemChevron: { color: colors.inkMuted, fontSize: 22, fontWeight: '300', marginTop: 8 },
  card: { backgroundColor: colors.white, borderRadius: 18, paddingHorizontal: 14, marginBottom: 12 },
  dim: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  rowText: { flex: 1 },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  rowSub: { color: colors.inkMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  note: { color: colors.inkMuted, fontSize: 12, lineHeight: 17, paddingHorizontal: 4 },
});
