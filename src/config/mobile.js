/**
 * The Android early-access build offered on the landing page until Web Monitor is on Google Play.
 * Cloudflare Workers static assets cap at 25 MiB, so the APK is served from the Expo artifact CDN.
 * Replace url/version/sizeMb/whatsNew whenever a newer preview build should be offered.
 */
export const EARLY_ACCESS_APK = {
  enabled: true,
  url: 'https://expo.dev/artifacts/eas/mXxDAgHE5yQcs6mjES3XEeHhySAAQ4f6eMx2-W3vTMU.apk',
  version: '1.2.0',
  sizeMb: 75,
  nextVersion: '1.2.0',
  whatsNew: [
    'Push notifications on Android when a site goes down or recovers',
    'Delete your account from the app menu',
    'Report a Zealot answer that looks wrong',
    'A crashed screen now offers Try again instead of closing the app',
  ],
};
