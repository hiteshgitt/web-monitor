import { useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { colors } from '../theme';

const PLATFORMS = [
  { id: 'wordpress', label: 'WordPress' },
  { id: 'nextjs', label: 'Next.js' },
  { id: 'laravel', label: 'Laravel' },
  { id: 'codeigniter', label: 'CodeIgniter' },
  { id: 'php', label: 'PHP' },
  { id: 'other', label: 'Other' },
];

export default function EditSiteScreen({ site, session, onBack, onSaved, onDeleted, onExpired }) {
  const [name, setName] = useState(site.name || '');
  const [url, setUrl] = useState(site.url || '');
  const [apiKey, setApiKey] = useState('');
  const [platform, setPlatform] = useState(site.platform || 'other');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setError('');
    const trimmedUrl = url.trim().replace(/\/$/, '');
    if (!name.trim() || !trimmedUrl) {
      setError('Name and URL are required.');
      return;
    }
    setBusy('save');
    try {
      if (apiKey.trim()) {
        const check = await api('/websites/verify', {
          method: 'POST',
          token: session.token,
          body: { url: trimmedUrl, platform, apiKey: apiKey.trim(), websiteId: site._id },
        });
        if (!check.ok) {
          setError(check.message || 'Unable to verify the new API key.');
          return;
        }
      }
      const updated = await api(`/websites/${site._id}`, {
        method: 'PUT',
        token: session.token,
        body: {
          name: name.trim(),
          url: trimmedUrl,
          platform,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        },
      });
      onSaved(updated);
    } catch (err) {
      if (err.status === 401) onExpired();
      else setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    setBusy('delete');
    setError('');
    try {
      await api(`/websites/${site._id}`, { method: 'DELETE', token: session.token });
      onDeleted();
    } catch (err) {
      if (err.status === 401) onExpired();
      else setError(err.message);
      setBusy('');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Site settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>Update connection details for {site.name}. Leave the API key blank to keep the current key.</Text>
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="URL" value={url} onChangeText={setUrl} autoCapitalize="none" />
        <Text style={styles.label}>Platform</Text>
        <View style={styles.pills}>
          {PLATFORMS.map((item) => {
            const on = platform === item.id;
            return (
              <Pressable key={item.id} onPress={() => setPlatform(item.id)} style={[styles.pill, on && styles.pillOn]}>
                <Text style={[styles.pillText, on && styles.pillTextOn]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field
          label="New API key (optional)"
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="Leave blank to keep current"
          autoCapitalize="none"
          secureTextEntry
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={save} disabled={Boolean(busy)} style={styles.save}>
          {busy === 'save' ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Save changes</Text>}
        </Pressable>

        <View style={styles.danger}>
          <Text style={styles.dangerTitle}>Danger zone</Text>
          <Text style={styles.lead}>Removing a site deletes its history from Web Monitor.</Text>
          {confirmDelete ? (
            <View style={styles.dangerRow}>
              <Pressable onPress={remove} disabled={Boolean(busy)} style={styles.delete}>
                {busy === 'delete' ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Confirm delete</Text>}
              </Pressable>
              <Pressable onPress={() => setConfirmDelete(false)} style={styles.cancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmDelete(true)} style={styles.cancel}>
              <Text style={[styles.cancelText, { color: colors.bad }]}>Delete this site</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.inkMuted} style={styles.input} autoCorrect={false} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  back: { color: colors.brand, fontSize: 16, fontWeight: '800' },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  lead: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  field: { gap: 6 },
  label: { color: colors.inkMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  input: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  pillOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { color: colors.inkSoft, fontSize: 12, fontWeight: '800' },
  pillTextOn: { color: colors.white },
  error: { color: colors.bad, fontWeight: '700' },
  save: { marginTop: 4, backgroundColor: colors.brand, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: colors.white, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  danger: { marginTop: 20, padding: 16, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.badSoft, gap: 10 },
  dangerTitle: { color: colors.bad, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  dangerRow: { gap: 8 },
  delete: { backgroundColor: colors.bad, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cancel: { borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas },
  cancelText: { color: colors.inkSoft, fontWeight: '800' },
});
