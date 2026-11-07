/**
 * The Android early-access build offered on the landing page until Web Monitor is on Google Play.
 * Cloudflare Workers static assets cap at 25 MiB, so the APK is served from the Expo artifact CDN.
 * Replace url/version/sizeMb/whatsNew whenever a newer preview build should be offered.
 */
export const EARLY_ACCESS_APK = {
  enabled: true,
  url: 'https://expo.dev/artifacts/eas/MqxKk38SoZNERG-vAIEnW8fM5f6dfMkl9w_aV6wjRO8.apk',
  version: '1.1.2',
  sizeMb: 73,
  nextVersion: '1.1.2',
  whatsNew: [
    'Site header no longer crops Run check — Advanced and Run check on their own row',
    'Google sign-in asks which account to use after sign-out',
    'Advanced opens from the header — no more tab scrolling',
    'Export center with selectable categories and clearer spacing',
    'Zealot branded FAB plus Ask Zealot from Overview and Security',
    'Home filters show Healthy / Warning / Down counts',
    'Account menu and Alerts use icons like the web app',
    'Run check shows a quick “Updated” toast with score and latency',
    'Security / SEO hide empty “not available” rows',
  ],
};
