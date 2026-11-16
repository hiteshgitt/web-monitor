import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { api } from '../api';
import { colors } from '../theme';

// Account-level RuyaShield connection: paste a read-only API token, replace it, or disconnect.
export default function RuyaShieldModal({ visible, session, onClose, onChanged, onExpired }) {
  const [status, setStatus] = useState(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    api('/integrations/ruyashield', { token: session.token })
      .then((next) => { if (!cancelled) { setStatus(next); setError(''); } })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) onExpired();
        else setError(err.message);
      });
    return () => { cancelled = true; };
  }, [visible, session.token, onExpired]);

  const run = async (path, options) => {
    setBusy(true);
    setError('');
    try {
      const next = await api(path, { token: session.token, ...options });
      setStatus(next);
      setToken('');
      onChanged?.(next);
    } catch (err) {
      if (err.status === 401 && !String(err.message).includes('RuyaShield')) onExpired();
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (busy) return;
    setToken('');
    setError('');
    onClose();
  };

  const tokensUrl = status?.appUrl ? `${status.appUrl}/settings/tokens` : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <ScrollView style={styles.backdrop} contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>RuyaShield</Text>
          <Text style={styles.body}>See security findings from your RuyaShield account next to uptime.</Text>

          {!status && !error ? <ActivityIndicator color={colors.brand} style={styles.spinner} /> : null}
          {status && !status.configured ? <Text style={styles.body}>The RuyaShield connection is not available yet.</Text> : null}

          {status?.configured && status.connected ? (
            <View style={styles.connected}>
              <Text style={styles.connectedTitle}>Connected to {status.orgName}</Text>
              <Text style={styles.muted}>
                Token {status.tokenPrefix}… · since {new Date(status.connectedAt).toLocaleDateString()}
              </Text>
              {status.error ? <Text style={styles.error}>{status.error}</Text> : null}
              <Pressable onPress={() => run('/integrations/ruyashield', { method: 'DELETE' })} disabled={busy} style={styles.disconnect}>
                <Text style={styles.disconnectText}>Disconnect</Text>
              </Pressable>
            </View>
          ) : null}

          {status?.configured ? (
            <>
              {!status.connected ? (
                <View style={styles.steps}>
                  <Text style={styles.step}>1. In RuyaShield, open Settings → API tokens.</Text>
                  {tokensUrl ? (
                    <Pressable onPress={() => Linking.openURL(tokensUrl)}>
                      <Text style={styles.link}>Open RuyaShield ›</Text>
                    </Pressable>
                  ) : null}
                  <Text style={styles.step}>2. Create a token with the assets:read and findings:read scopes.</Text>
                  <Text style={styles.step}>3. Paste it below. It can only read; it cannot start scans or change anything.</Text>
                </View>
              ) : null}
              <Text style={styles.label}>{status.connected ? 'Replace the token' : 'RuyaShield API token'}</Text>
              <TextInput
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                editable={!busy}
                placeholder="rs_…"
                placeholderTextColor={colors.inkMuted}
                style={styles.input}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                onPress={() => run('/integrations/ruyashield', { method: 'PUT', body: { token: token.trim() } })}
                disabled={!token.trim() || busy}
                style={[styles.primary, (!token.trim() || busy) && styles.off]}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{status.connected ? 'Replace token' : 'Connect'}</Text>}
              </Pressable>
            </>
          ) : error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={close} disabled={busy} style={styles.cancel}>
            <Text style={styles.cancelText}>Close</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  center: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { padding: 20, borderRadius: 20, backgroundColor: colors.white },
  title: { marginBottom: 6, fontSize: 20, fontWeight: '800', color: colors.ink },
  body: { marginBottom: 12, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  spinner: { marginVertical: 16 },
  connected: { marginBottom: 14, padding: 14, borderRadius: 14, backgroundColor: colors.canvas },
  connectedTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  muted: { marginTop: 2, fontSize: 12, color: colors.inkMuted },
  disconnect: { marginTop: 10, alignSelf: 'flex-start', paddingVertical: 6 },
  disconnectText: { color: colors.bad, fontSize: 14, fontWeight: '800' },
  steps: { marginBottom: 8, gap: 6 },
  step: { fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  link: { fontSize: 13, fontWeight: '800', color: colors.brand, marginLeft: 14 },
  label: { marginTop: 6, marginBottom: 6, fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  input: {
    marginBottom: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
    borderWidth: 1, borderColor: colors.line, fontSize: 16, color: colors.ink,
  },
  error: { marginBottom: 12, color: colors.bad, fontSize: 14, lineHeight: 20 },
  primary: { height: 50, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.5 },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  cancel: { marginTop: 6, height: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.inkSoft, fontSize: 15, fontWeight: '700' },
});
