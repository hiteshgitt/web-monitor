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
  nextVersion: '1.4.0',
  whatsNew: [
    'Release Radar: security releases affecting your sites, from announcement to patched (Pro)',
    'Errors: grouped errors with file, line and stack trace (Pro)',
    'Server: CPU, memory, disks and attack attempts from the server agent (Pro)',
    'Known vulnerabilities with CVSS, including WordPress plugins, and suspicious files on the Security tab (Pro)',
    'Tapping a Pro alert opens the right section',
  ],
};
