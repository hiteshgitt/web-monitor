import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { api } from './src/api';
import { loadToken, saveToken } from './src/session';
import LoginScreen from './src/screens/LoginScreen';
import SiteScreen from './src/screens/SiteScreen';
import SitesScreen from './src/screens/SitesScreen';
import { colors } from './src/theme';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [siteId, setSiteId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await loadToken();
      if (!token) {
        if (!cancelled) setBooting(false);
        return;
      }
      try {
        const { user } = await api('/auth/me', { token });
        if (!cancelled) setSession({ token, user });
      } catch {
        await saveToken(null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const startSession = async (data) => {
    await saveToken(data.token);
    setSession({ token: data.token, user: data.user });
  };

  const signIn = async (email, password) => {
    await startSession(await api('/auth/login', { method: 'POST', body: { email, password } }));
  };

  const signInWithGoogle = async (credential) => {
    await startSession(await api('/auth/google', { method: 'POST', body: { credential } }));
  };

  const signOut = useCallback(async () => {
    await saveToken(null);
    setSession(null);
    setSiteId(null);
  }, []);

  let screen = <LoginScreen onSignIn={signIn} onGoogle={signInWithGoogle} />;
  if (booting) {
    screen = (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  } else if (session && siteId) {
    screen = <SiteScreen siteId={siteId} session={session} onBack={() => setSiteId(null)} onExpired={signOut} />;
  } else if (session) {
    screen = <SitesScreen session={session} onOpen={setSiteId} onSignOut={signOut} onExpired={signOut} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {screen}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
});
