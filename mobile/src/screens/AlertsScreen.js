import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { timeAgo } from '../metrics';
import { colors } from '../theme';

const TONE = {
  site_down: colors.bad, ssl_off: colors.bad, slow: colors.warn, security_low: colors.warn,
  site_up: colors.good, slow_ok: colors.good, ssl_ok: colors.good,
};

// Alert history plus the switches for which alerts are pushed to this phone (and the customer's browsers)
export default function AlertsScreen({ session, onBack, onOpenSite, onExpired }) {
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

  useEffect(() => { load(); }, [load]);

  const setPref = async (key, value) => {
    const previous = settings.prefs;
    setSettings((s) => ({ ...s, prefs: { ...s.prefs, [key]: value } }));
    try {
      const { prefs } = await api('/notifications/settings', { method: 'PUT', token: session.token, body: { [key]: value } });
      setSettings((s) => ({ ...s, prefs }));
    } catch (err) {
      setSettings((s) => ({ ...s, prefs: previous }));
      setError(err.message);
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
          ) : items.map((item) => (
            <Pressable
              key={item._id}
              disabled={!item.websiteId}
              onPress={() => onOpenSite(item.websiteId)}
              style={[styles.item, !item.read && styles.itemUnread]}
            >
              <View style={[styles.itemDot, { backgroundColor: TONE[item.type] || colors.brand }]} />
              <View style={styles.itemBody}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.itemTime}>{timeAgo(item.createdAt)}</Text>
                </View>
                {item.body ? <Text style={styles.itemText}>{item.body}</Text> : null}
              </View>
            </Pressable>
          ))
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
  item: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 16, padding: 14, marginBottom: 8 },
  itemUnread: { borderWidth: 1.5, borderColor: colors.brandSoft },
  itemDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5, marginRight: 10 },
  itemBody: { flex: 1 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemTitle: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '800' },
  itemTime: { color: colors.inkMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  itemText: { color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 3 },
  card: { backgroundColor: colors.white, borderRadius: 18, paddingHorizontal: 14, marginBottom: 12 },
  dim: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  rowText: { flex: 1 },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  rowSub: { color: colors.inkMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  note: { color: colors.inkMuted, fontSize: 12, lineHeight: 17, paddingHorizontal: 4 },
});
