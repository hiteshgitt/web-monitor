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

export default function AddSiteScreen({ session, onBack, onAdded, onExpired }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [platform, setPlatform] = useState('wordpress');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    const trimmedUrl = url.trim().replace(/\/$/, '');
    if (!name.trim() || !trimmedUrl || !apiKey.trim()) {
      setError('Name, URL and API key are required.');
      return;
    }
    setBusy(true);
    try {
      const check = await api('/websites/verify', {
        method: 'POST',
        token: session.token,
        body: { url: trimmedUrl, platform, apiKey: apiKey.trim() },
      });
      if (!check.ok) {
        setError(check.message || 'Unable to connect. Check the URL, platform and API key.');
        return;
      }
      const created = await api('/websites', {
        method: 'POST',
        token: session.token,
        body: { name: name.trim(), url: trimmedUrl, platform, apiKey: apiKey.trim() },
      });
      onAdded(created);
    } catch (err) {
      if (err.status === 401) onExpired();
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Add website</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>We check the connection before saving, using the API key from the Web Monitor integration on your site.</Text>
        <Field label="Name" value={name} onChangeText={setName} placeholder="My site" />
        <Field label="URL" value={url} onChangeText={setUrl} placeholder="https://example.com" autoCapitalize="none" />
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
        <Field label="API key" value={apiKey} onChangeText={setApiKey} placeholder="From the site integration" autoCapitalize="none" secureTextEntry />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={save} disabled={busy} style={styles.save}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Verify & add</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.inkMuted}
        style={styles.input}
        autoCorrect={false}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  back: { color: colors.brand, fontSize: 16, fontWeight: '800' },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  lead: { color: colors.inkSoft, fontSize: 14, lineHeight: 20, marginBottom: 4 },
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
  save: { marginTop: 8, backgroundColor: colors.brand, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: colors.white, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
});
