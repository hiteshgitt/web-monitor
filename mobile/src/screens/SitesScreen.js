import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import {
  STATUS_LABEL, displayUrl, formatMs, healthScore, scoreTone, statusTone, timeAgo,
} from '../metrics';
import { colors, toneColor } from '../theme';

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

export default function SitesScreen({ session, onOpen, onSignOut, onExpired }) {
  const [sites, setSites] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const data = await api('/websites', { token: session.token });
      setSites(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      if (err.status === 401) onExpired();
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session.token, onExpired]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return sites.filter((site) => matches(site, filter) && (
      !term || site.name.toLowerCase().includes(term) || site.url.toLowerCase().includes(term)
    ));
  }, [sites, query, filter]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Image source={require('../../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.kicker}>{visible.length} of {sites.length} sites</Text>
        </View>
        <Pressable onPress={onSignOut} hitSlop={8}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>
      <Text style={styles.account} numberOfLines={1}>{session.user?.name || session.user?.email}</Text>

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
          return (
            <Pressable key={item.id} onPress={() => setFilter(item.id)} style={[styles.filter, on && styles.filterOn]}>
              <Text style={[styles.filterText, on && styles.filterTextOn]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={visible}
        keyExtractor={(item) => item._id}
        contentContainerStyle={visible.length === 0 ? styles.emptyWrap : styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        ListEmptyComponent={!loading ? (
          <Text style={styles.empty}>{sites.length === 0 ? 'No sites on this account yet. Add one on the website, then pull to refresh.' : 'No sites match this search.'}</Text>
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
  signOut: { color: colors.brand, fontWeight: '800', fontSize: 14 },
  account: { marginTop: 2, marginHorizontal: 20, color: colors.inkSoft, fontSize: 13, fontWeight: '700' },
  search: { marginHorizontal: 16, marginTop: 14, backgroundColor: '#e4e8f8', borderRadius: 16, paddingHorizontal: 14 },
  searchInput: { height: 46, color: colors.ink, fontSize: 15, fontWeight: '700' },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  filter: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.7)' },
  filterOn: { backgroundColor: colors.brand },
  filterText: { color: colors.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  filterTextOn: { color: colors.white },
  error: { marginHorizontal: 20, marginBottom: 8, color: colors.bad, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 28, paddingTop: 8 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', padding: 32 },
  empty: { textAlign: 'center', color: colors.inkSoft, fontSize: 16, lineHeight: 22 },
  spinner: { marginTop: 48 },
  card: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 18, marginBottom: 10, overflow: 'hidden' },
  accent: { width: 4 },
  cardBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { flex: 1, paddingRight: 10 },
  url: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  name: { marginTop: 2, color: colors.ink, fontSize: 16, fontWeight: '800' },
  score: { fontSize: 26, fontWeight: '800' },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  metaText: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  faint: { color: colors.inkMuted, marginHorizontal: 6 },
  response: { marginLeft: 'auto', color: colors.ink, fontSize: 13, fontWeight: '800' },
});