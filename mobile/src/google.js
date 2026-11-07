import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';

// Same Google client the website uses. The ID token is checked by the API.
export const GOOGLE_WEB_CLIENT_ID = '111600729792-qmdiib16v9bsibq288nho36drdm4piu5.apps.googleusercontent.com';

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

/** Clear the Google SDK session so the next sign-in shows the account picker. */
export async function clearGoogleSession() {
  try {
    const user = await GoogleSignin.getCurrentUser();
    if (!user) return;
    try {
      await GoogleSignin.revokeAccess();
    } catch {
      // revoke can fail if already cleared — still sign out locally
    }
    await GoogleSignin.signOut();
  } catch {
    // No Google session, or Play Services unavailable — app sign-out still proceeds
  }
}

export async function googleIdToken() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // Prefer a clean picker after a previous session (sign-out may have already cleared it).
  try {
    const existing = await GoogleSignin.getCurrentUser();
    if (existing) await GoogleSignin.signOut();
  } catch {
    // ignore
  }
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  const idToken = response.data.idToken;
  if (!idToken) throw new Error('Google did not return a sign-in token.');
  return idToken;
}
