// Push alerts on the phone: Expo push token registered with the server, shown while the app is open too.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { api } from './api';

export const ALERT_CHANNEL = 'alerts';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken = null;

// Asks for permission and registers this phone. Returns null (no throw) when push isn't possible:
// permission denied, web, or a build without push credentials.
export async function registerForPush(sessionToken) {
  if (Platform.OS === 'web') return null;
  try {
    if (Platform.OS === 'android') {
      // Android 13+ shows the permission prompt only once a channel exists
      await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
        name: 'Site alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#5868cf',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return null;

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const label = [Constants.deviceName, Platform.OS === 'ios' ? 'iPhone app' : 'Android app'].filter(Boolean).join(' · ');
    await api('/notifications/devices', { method: 'POST', token: sessionToken, body: { kind: 'expo', token, label } });
    registeredToken = token;
    return token;
  } catch (error) {
    console.warn('Push registration failed:', error?.message);
    return null;
  }
}

// On sign-out: stop sending this account's alerts to the phone
export async function unregisterPush(sessionToken) {
  if (!registeredToken || !sessionToken) return;
  await api('/notifications/devices/remove', { method: 'POST', token: sessionToken, body: { token: registeredToken } }).catch(() => {});
  registeredToken = null;
}

// Calls onOpenSite(websiteId) when an alert is tapped, including the one that launched the app
export function listenForAlertTaps(onOpenSite) {
  const open = (response) => {
    const websiteId = response?.notification?.request?.content?.data?.websiteId;
    if (websiteId) onOpenSite(websiteId);
  };
  // Cleared after use, or the same alert would reopen its site on every launch
  Notifications.getLastNotificationResponseAsync()
    .then((response) => { if (response) { open(response); Notifications.clearLastNotificationResponseAsync?.(); } })
    .catch(() => {});
  const subscription = Notifications.addNotificationResponseReceivedListener(open);
  return () => subscription.remove();
}
