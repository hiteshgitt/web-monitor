import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';

// Same Google client the website uses. The ID token is checked by the API.
export const GOOGLE_WEB_CLIENT_ID = '111600729792-qmdiib16v9bsibq288nho36drdm4piu5.apps.googleusercontent.com';

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

export async function googleIdToken() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  const idToken = response.data.idToken;
  if (!idToken) throw new Error('Google did not return a sign-in token.');
  return idToken;
}
