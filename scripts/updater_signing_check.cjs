// updater_signing_check.cjs -- D-BP223-BM0-X030-073-STALE-STATE-AND-PRIVACY-FIXES, P3.
//
// XO X030 pick on Founder k/0a8d1c96: turn the updater signature check ON and FAIL THE BUILD if signing config is absent.
// No unsigned build ships with only a warning.
//
// WHY BOTH KEYS. electron-updater (6.8.3, NsisUpdater.verifySignature) checks a downloaded installer ONLY when
// app-update.yml carries publisherName; with no publisherName it returns null and installs WITHOUT checking. electron-builder
// (24.13.3, PublishManager.js:202-206) writes publisherName only when win.verifyUpdateCodeSignature is not false AND
// winPackager.computedPublisherName resolves. With the custom Azure Trusted Signing hook (win.sign = scripts/sign.cjs) there
// is no local certificate, so computedPublisherName is null unless win.publisherName is set explicitly. So "check ON" means:
//   win.verifyUpdateCodeSignature === true   AND   win.publisherName names the signing certificate's CN.
// The 0.9.30 installers are signed CN=Jonathan Jones (Get-AuthenticodeSignature, Valid), so that is the expected name.
//
// Called from scripts/sign.cjs (electron-builder's win.sign hook) on every signing pass, so a build cannot produce a
// Windows artifact while either the signing env or the updater config is missing. Also runnable by hand:
//   node scripts/updater_signing_check.cjs
'use strict';

const fs = require('fs');
const path = require('path');

const SIGNING_ENV = ['TRUSTED_SIGNING_ENDPOINT', 'TRUSTED_SIGNING_ACCOUNT', 'TRUSTED_SIGNING_PROFILE'];

/** Pure: checks one electron-builder win config block and one env object. Returns { ok, problems[] }. */
function checkUpdaterSigning(winConfig, env) {
  const problems = [];
  const win = winConfig || {};
  if (win.verifyUpdateCodeSignature !== true) problems.push('build.win.verifyUpdateCodeSignature must be true (it is ' + JSON.stringify(win.verifyUpdateCodeSignature) + ')');
  const names = Array.isArray(win.publisherName) ? win.publisherName : (win.publisherName ? [win.publisherName] : []);
  if (!names.length || !names.every((n) => typeof n === 'string' && n.trim())) problems.push('build.win.publisherName must name the signing certificate CN, or electron-updater skips the check');
  const missing = SIGNING_ENV.filter((k) => !(env && typeof env[k] === 'string' && env[k].trim()));
  if (missing.length) problems.push('signing env missing: ' + missing.join(', '));
  return { ok: problems.length === 0, problems };
}

/** Reads the build config electron-builder is using. A --config file (the lean build) wins over package.json. */
function loadWinConfig(repoRoot, configPath) {
  if (configPath && fs.existsSync(configPath)) return (JSON.parse(fs.readFileSync(configPath, 'utf8')) || {}).win;
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  return pkg.build && pkg.build.win;
}

/** Throws with every problem named. Used by sign.cjs. */
function assertUpdaterSigning(winConfig, env) {
  const r = checkUpdaterSigning(winConfig, env);
  if (!r.ok) {
    throw new Error('[Sign] BUILD REFUSED (X030-073 P3): no unsigned or unverifiable build ships.\n  - ' + r.problems.join('\n  - '));
  }
  return r;
}

module.exports = { SIGNING_ENV, checkUpdaterSigning, loadWinConfig, assertUpdaterSigning };

if (require.main === module) {
  const repoRoot = path.join(__dirname, '..');
  const r = checkUpdaterSigning(loadWinConfig(repoRoot, process.argv[2]), process.env);
  console.log(r.ok ? 'OK updater signature check is ON and signing config is present' : 'NO\n  - ' + r.problems.join('\n  - '));
  process.exit(r.ok ? 0 : 1);
}
