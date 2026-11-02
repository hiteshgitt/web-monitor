import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { api } from './src/api';
import { listenForAlertTaps, registerForPush, unregisterPush } from './src/push';
import { loadToken, saveToken } from './src/session';
import AlertsScreen from './src/screens/AlertsScreen';
import LoginScreen from './src/screens/LoginScreen';
import SiteScreen from './src/screens/SiteScreen';
import SitesScreen from './src/screens/SitesScreen';
import { colors } from './src/theme';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [siteId, setSiteId] = useState(null);
  const [alertFocus, setAlertFocus] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false);

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

  useEffect(() => {
    if (session?.token) registerForPush(session.token);
  }, [session?.token]);

  const openAlert = useCallback((alert) => {
    if (!alert?.websiteId) return;
    setShowAlerts(false);
    setAlertFocus(alert);
    setSiteId(alert.websiteId);
  }, []);

  useEffect(() => listenForAlertTaps(openAlert), [openAlert]);

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
    await unregisterPush(session?.token);
    await saveToken(null);
    setSession(null);
    setSiteId(null);
    setAlertFocus(null);
    setShowAlerts(false);
  }, [session?.token]);

  const openSite = useCallback((id) => {
    setShowAlerts(false);
    setAlertFocus(null);
    setSiteId(id);
  }, []);

  let screen = <LoginScreen onSignIn={signIn} onGoogle={signInWithGoogle} />;
  if (booting) {
    screen = (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  } else if (session && siteId) {
    screen = (
      <SiteScreen
        siteId={siteId}
        session={session}
        alertFocus={alertFocus?.websiteId === siteId ? alertFocus : null}
        onDismissAlert={() => setAlertFocus(null)}
        onBack={() => { setSiteId(null); setAlertFocus(null); }}
        onExpired={signOut}
      />
    );
  } else if (session && showAlerts) {
    screen = (
      <AlertsScreen
        session={session}
        onBack={() => setShowAlerts(false)}
        onOpenAlert={openAlert}
        onExpired={signOut}
      />
    );
  } else if (session) {
    screen = <SitesScreen session={session} onOpen={openSite} onAlerts={() => setShowAlerts(true)} onSignOut={signOut} onExpired={signOut} />;
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
