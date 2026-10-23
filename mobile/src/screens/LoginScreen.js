import { useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { googleIdToken } from '../google';
import { colors } from '../theme';

export default function LoginScreen({ onSignIn, onGoogle }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await onSignIn(email.trim(), password);
    } catch (err) {
      setError(err.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError('');
    setBusy(true);
    try {
      const credential = await googleIdToken();
      if (credential) await onGoogle(credential);
    } catch (err) {
      const code = String(err.code || '');
      if (code === 'SIGN_IN_CANCELLED' || code === '-5') return;
      setError(err.message || 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.wrap}>
          <Image source={require('../../assets/logo-mark.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.mark}>Web Monitor</Text>
          <Text style={styles.lead}>Sign in with the same account you use on the website.</Text>

          <Pressable onPress={google} disabled={busy} style={({ pressed }) => [styles.google, pressed && styles.pressed]}>
            <Text style={styles.googleText}>Continue with Google</Text>
          </Pressable>
          <Text style={styles.or}>or use email</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            placeholder="you@company.com"
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            placeholder="At least 8 characters"
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
            onSubmitEditing={submit}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={busy || !email.trim() || !password}
            style={({ pressed }) => [styles.button, (busy || !email.trim() || !password) && styles.buttonOff, pressed && styles.pressed]}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logo: { width: 168, height: 64, marginBottom: 16 },
  mark: { fontSize: 32, fontWeight: '800', color: colors.ink },
  google: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleText: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  or: { marginVertical: 16, textAlign: 'center', color: colors.inkMuted, fontWeight: '700' },
  lead: { marginTop: 8, marginBottom: 28, fontSize: 16, lineHeight: 22, color: colors.inkSoft },
  label: { marginBottom: 6, fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  input: {
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    fontSize: 16,
    color: colors.ink,
  },
  error: { marginBottom: 12, color: colors.bad, fontSize: 14, lineHeight: 20 },
  button: {
    marginTop: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOff: { opacity: 0.55 },
  pressed: { backgroundColor: colors.brandDark },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
