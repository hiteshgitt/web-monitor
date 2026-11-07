import { useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { api } from '../api';
import { colors } from '../theme';

const CONFIRM_WORD = 'DELETE';

// Typed confirmation rather than a password, because Google accounts don't have one
export default function DeleteAccountModal({ visible, session, onClose, onDeleted, onExpired }) {
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = confirm.trim().toUpperCase() === CONFIRM_WORD;

  const close = () => {
    if (busy) return;
    setConfirm('');
    setError('');
    onClose();
  };

  const remove = async () => {
    setError('');
    setBusy(true);
    try {
      await api('/auth/account', { method: 'DELETE', token: session.token });
      await onDeleted();
    } catch (err) {
      setBusy(false);
      if (err.status === 401) onExpired();
      else setError(err.message);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <ScrollView
        style={styles.backdrop}
        contentContainerStyle={styles.center}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Delete your account?</Text>
          <Text style={styles.body}>
            This permanently removes your account, sites, monitoring history, alerts and connected Google data.
            It cannot be undone.
          </Text>
          <Text style={styles.body}>
            Records of paid orders are kept for tax and accounting. Our admin logs keep a record of the deletion, including your email.
          </Text>
          <Text style={styles.label}>Type {CONFIRM_WORD} to confirm</Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            placeholder={CONFIRM_WORD}
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={remove}
            disabled={!ready || busy}
            style={[styles.danger, (!ready || busy) && styles.off]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.dangerText}>Delete account</Text>}
          </Pressable>
          <Pressable onPress={close} disabled={busy} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
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
  title: { marginBottom: 10, fontSize: 20, fontWeight: '800', color: colors.ink },
  body: { marginBottom: 10, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  label: { marginTop: 6, marginBottom: 6, fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  input: {
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 16,
    color: colors.ink,
  },
  error: { marginBottom: 12, color: colors.bad, fontSize: 14, lineHeight: 20 },
  danger: { height: 50, borderRadius: 14, backgroundColor: colors.bad, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.5 },
  dangerText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  cancel: { marginTop: 6, height: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.inkSoft, fontSize: 15, fontWeight: '700' },
});
