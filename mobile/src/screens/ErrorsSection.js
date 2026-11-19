import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { api } from '../api';
import { timeAgo } from '../metrics';
import { colors } from '../theme';
import { Panel } from '../ui';
import { styles } from './SecurityCards';

// Advanced → Errors (Pro): grouped server errors with file, line and stack, resolve / reopen. Opening it reads the
// site first (the API does that), so the list is current.
export default function ErrorsSection({ siteId, session, onExpired }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [openFp, setOpenFp] = useState('');
  const [busy, setBusy] = useState('');

  const fail = useCallback((err) => { if (err.status === 401) onExpired(); else setError(err.message); }, [onExpired]);
  const fetchErrors = useCallback(() => api(`/advanced/errors/${siteId}`, { token: session.token, timeoutMs: 25000 })
    .then((next) => { setData(next); setError(''); }).catch(fail).finally(() => setLoading(false)), [siteId, session.token, fail]);
  useEffect(() => { fetchErrors(); }, [fetchErrors]);
  const load = () => { setLoading(true); fetchErrors(); };

  const toggle = async (g) => {
    setBusy(g.fp);
    try {
      const next = await api(`/advanced/errors-resolve/${siteId}`, { method: 'POST', token: session.token, body: { fp: g.fp, reopen: g.status === 'resolved' } });
      setData((d) => ({ ...d, groups: next.groups }));
    } catch (err) { fail(err); } finally { setBusy(''); }
  };
  const groups = data?.groups || [];

  return (
    <Panel title="Errors">
      <Pressable onPress={load} disabled={loading} hitSlop={8} style={{ position: 'absolute', top: 14, right: 16 }}>
        <Text style={styles.link}>{loading ? 'Refreshing…' : 'Refresh'}</Text>
      </Pressable>
      {loading && !data ? <ActivityIndicator color={colors.brand} style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {data?.note ? <Text style={styles.warn}>{data.note}</Text> : null}
      {data && !groups.length ? (
        <Text style={styles.body}>
          {data.tracked === false
            ? 'Error tracking is not on for this site yet. Update the integration (Next.js also needs instrumentation.ts).'
            : 'No errors recorded. New server errors appear here with file, line and stack trace.'}
        </Text>
      ) : null}
      {groups.map((g) => {
        const resolved = g.status === 'resolved';
        const expanded = openFp === g.fp;
        return (
          <View key={g.fp} style={[styles.item, !resolved && styles.itemBad]}>
            <Pressable onPress={() => setOpenFp(expanded ? '' : g.fp)}>
              <View style={styles.meta}>
                {resolved ? <Text style={[styles.ignored, { color: colors.good, backgroundColor: colors.goodSoft }]}>RESOLVED</Text> : null}
                <Text style={[styles.chip, { color: colors.bad, backgroundColor: colors.badSoft }]}>{String(g.type || 'Error').toUpperCase()}</Text>
                <Text style={styles.kicker}>{g.count}× · last {timeAgo(g.lastSeen)}</Text>
              </View>
              <Text style={[styles.title, resolved && styles.dim]} numberOfLines={expanded ? undefined : 3}>{g.message}</Text>
              {g.file ? <Text style={styles.mono} selectable>{g.file}{g.line ? `:${g.line}` : ''}{g.location ? `  ·  ${g.location}` : ''}</Text> : null}
            </Pressable>
            {expanded && g.stack?.length ? <Text style={styles.code} selectable>{g.stack.join('\n')}</Text> : null}
            {expanded ? <Text style={styles.muted}>First seen {timeAgo(g.firstSeen)}{g.digest ? ` · digest ${g.digest}` : ''}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 18 }}>
              {g.stack?.length ? <Pressable onPress={() => setOpenFp(expanded ? '' : g.fp)} hitSlop={6}><Text style={styles.link}>{expanded ? 'Hide stack' : 'Stack trace'}</Text></Pressable> : null}
              <Pressable onPress={() => toggle(g)} disabled={busy === g.fp} hitSlop={6}>
                <Text style={styles.link}>{busy === g.fp ? 'Saving…' : resolved ? 'Reopen' : 'Resolve'}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      <Text style={styles.note}>Messages are cleaned on the site before they are sent: emails, tokens and passwords are replaced.</Text>
    </Panel>
  );
}
