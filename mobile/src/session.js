import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'webmonitor_token';

export async function loadToken() {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token) {
  if (Platform.OS === 'web') {
    if (token) globalThis.localStorage.setItem(TOKEN_KEY, token);
    else globalThis.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}
