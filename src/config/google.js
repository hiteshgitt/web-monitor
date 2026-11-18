// Google sign-in OAuth client ID (web). Sign-in with Google is hidden when it isn't set.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const googleSignInEnabled = Boolean(GOOGLE_CLIENT_ID);

// "Continue with Ruya Lab" (one account across Ruya Lab products), shown when VITE_RUYALAB_SIGNIN=1.
export const ruyaLabSignInEnabled = import.meta.env.VITE_RUYALAB_SIGNIN === '1';
