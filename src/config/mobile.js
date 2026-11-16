/**
 * The Android early-access build offered on the landing page until Web Monitor is on Google Play.
 * Cloudflare Workers static assets cap at 25 MiB, so the APK is served from the Expo artifact CDN.
 * Replace url/version/sizeMb/whatsNew whenever a newer preview build should be offered.
 */
export const EARLY_ACCESS_APK = {
  enabled: true,
  url: 'https://expo.dev/artifacts/eas/5MyE1KsKdZ0G5BYTM-OnMH-uE3IoECNoXpsnY08X1nM.apk',
  version: '1.3.0',
  sizeMb: 72,
  nextVersion: '1.3.0',
  whatsNew: [
    'RuyaShield findings on each site’s Security tab (Pro)',
    'Connect your RuyaShield account from the app menu',
    'Alerts when RuyaShield finds a new critical or high issue',
    'Push notifications on Android when a site goes down or recovers',
  ],
};
