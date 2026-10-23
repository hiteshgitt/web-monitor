// Google sign-in OAuth client ID (web). Sign-in with Google is hidden when it isn't set.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const googleSignInEnabled = Boolean(GOOGLE_CLIENT_ID);
