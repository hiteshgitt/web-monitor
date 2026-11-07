import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { api } from './src/api';
import ErrorBoundary from './src/ErrorBoundary';
import { clearGoogleSession } from './src/google';
import { listenForAlertTaps, registerForPush, unregisterPush } from './src/push';
import { loadToken, saveToken } from './src/session';
import AddSiteScreen from './src/screens/AddSiteScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import LoginScreen from './src/screens/LoginScreen';
import SiteScreen from './src/screens/SiteScreen';
import SitesScreen from './src/screens/SitesScreen';
import { colors } from './src/theme';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [session, setSession] = useState(null);
  const [siteId, setSiteId] = useState(null);
  const [alertFocus, setAlertFocus] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const restore = useCallback(async () => {
    setBooting(true);
    setBootError('');
    try {
      const token = await loadToken();
      if (token) {
        const { user } = await api('/auth/me', { token });
        setSession({ token, user });
      }
    } catch (err) {
      // Only a rejected token ends the session; being offline or a server hiccup must not sign the user out
      if (err.status === 401 || err.status === 403) await saveToken(null);
      else setBootError(err.message);
    }
    setBooting(false);
  }, []);

  useEffect(() => { restore(); }, [restore]);

  useEffect(() => {
    if (session?.token) registerForPush(session.token);
  }, [session?.token]);

  const openAlert = useCallback((alert) => {
    if (!alert?.websiteId) return;
    setShowAlerts(false);
    setShowAdd(false);
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

  const leave = useCallback(async () => {
    await clearGoogleSession();
    await saveToken(null);
    setSession(null);
    setSiteId(null);
    setAlertFocus(null);
    setShowAlerts(false);
    setShowAdd(false);
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPush(session?.token);
    await leave();
  }, [session?.token, leave]);

  const openSite = useCallback((id) => {
    setShowAlerts(false);
    setShowAdd(false);
    setAlertFocus(null);
    setSiteId(id);
  }, []);

  const handleBack = useEffectEvent(() => {
    if (siteId) { setSiteId(null); setAlertFocus(null); return true; }
    if (showAdd) { setShowAdd(false); return true; }
    if (showAlerts) { setShowAlerts(false); return true; }
    return false;
  });

  // Registered once: the newest handler runs first, so a screen's own handler (menu, sub-view) wins over this one
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => handleBack());
    return () => subscription.remove();
  }, []);

  const resetScreens = () => {
    setSiteId(null);
    setAlertFocus(null);
    setShowAlerts(false);
    setShowAdd(false);
  };

  let screen = <LoginScreen onSignIn={signIn} onGoogle={signInWithGoogle} />;
  if (booting) {
    screen = (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  } else if (bootError) {
    screen = (
      <View style={styles.boot}>
        <Text style={styles.bootTitle}>Could not load your account</Text>
        <Text style={styles.bootLead}>{bootError}</Text>
        <Pressable onPress={restore} style={styles.retry}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
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
  } else if (session && showAdd) {
    screen = (
      <AddSiteScreen
        session={session}
        onBack={() => setShowAdd(false)}
        onAdded={(site) => { setShowAdd(false); if (site?._id) setSiteId(site._id); }}
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
    screen = (
      <SitesScreen
        session={session}
        onOpen={openSite}
        onAlerts={() => setShowAlerts(true)}
        onAdd={() => setShowAdd(true)}
        onSignOut={signOut}
        onDeleted={leave}
        onExpired={signOut}
        onUser={(user) => setSession((current) => (current ? { ...current, user } : current))}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ErrorBoundary onReset={resetScreens}>{screen}</ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.canvas },
  bootTitle: { fontSize: 20, fontWeight: '800', color: colors.ink },
  bootLead: { marginTop: 8, marginBottom: 20, fontSize: 15, lineHeight: 21, textAlign: 'center', color: colors.inkSoft },
  retry: { paddingHorizontal: 24, height: 48, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});
