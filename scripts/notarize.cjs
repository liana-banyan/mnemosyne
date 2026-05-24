// AMPLIFY Computer — macOS Notarization Hook
// B37 Phase 6 — runs after electron-builder signs the Mac app
//
// Required env vars (set in CI / release workflow):
//   APPLE_ID          — developer Apple ID email
//   APPLE_TEAM_ID     — 10-char Team ID from developer.apple.com
//   APPLE_APP_PASSWORD — app-specific password from appleid.apple.com
//
// This hook is called automatically by electron-builder via "afterSign" in package.json.
// It is a no-op on Windows/Linux and in dev builds.

const { notarize } = require('@electron/notarize');
const path = require('path');

module.exports = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize on macOS
  if (electronPlatformName !== 'darwin') return;

  // Skip if signing credentials not present (local build without cert)
  if (!process.env.APPLE_ID || !process.env.APPLE_TEAM_ID || !process.env.APPLE_APP_PASSWORD) {
    console.log('[Notarize] Skipping — APPLE_ID / APPLE_TEAM_ID / APPLE_APP_PASSWORD not set');
    return;
  }

  const appName = context.packager.appInfo.productName;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`[Notarize] Submitting ${appPath} to Apple notarization service…`);

  try {
    await notarize({
      appBundleId: 'com.lianabanyan.amplify-computer',
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    });
    console.log('[Notarize] Notarization complete');
  } catch (err) {
    console.error('[Notarize] Failed:', err.message);
    throw err;
  }
};
