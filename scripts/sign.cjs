// AMPLIFY Computer -- Windows Code Signing Hook (Azure Trusted Signing)
// Wires electron-builder's custom Windows sign hook (win.sign, app-builder-lib
// 24.13.3) to Microsoft's .NET `sign` CLI, which talks to Azure Trusted Signing
// and applies an RFC3161 timestamp.
//
// electron-builder 24.13.3 does NOT support a native `azureSignOptions` key.
// The only supported hook is `win.sign` in package.json, which electron-builder
// resolves via app-builder-lib's `resolveFunction()` (out/platformPackager.js:604-628):
// it `require()`s this file and looks for a named export called "sign", falling
// back to `module.exports.default || module.exports`. A plain
// `module.exports = async (configuration, packager) => {...}` (as used below)
// satisfies that fallback.
//
// electron-builder calls this hook once per signing pass with a
// CustomWindowsSignTaskConfiguration object (app-builder-lib
// out/codeSign/windowsCodeSign.d.ts:6-20), whose relevant fields are:
//   configuration.path   -- absolute path to the file to sign (.exe / .dll / installer)
//   configuration.hash   -- "sha1" | "sha256" (may be called twice for dual-signing)
//   configuration.name   -- product name
//   configuration.isNest -- true on the second (nested) signing pass
// We only need `configuration.path`.
//
// IMPORTANT: this hook only fires when electron-builder has NO legacy
// certificate configured (no win.certificateFile / certificateSha1 /
// certificateSubjectName, no CSC_LINK / WIN_CSC_LINK env var) -- see
// app-builder-lib out/winPackager.js:32-76 (cscInfo lazy getter) and
// out/winPackager.js:168-183 (sign() only invokes the custom hook when
// cscInfo resolves to null). Do not set any of those or this hook will be
// skipped in favor of the built-in signtool.exe / osslsigncode path.
//
// This is a BUILD-TIME, BUILD-MACHINE-ONLY step. End users never see or need
// any of this -- they just receive an already-signed binary.
//
// --- Required env vars (Trusted Signing target -- read directly below) ---
//   TRUSTED_SIGNING_ENDPOINT           -- Azure Trusted Signing region endpoint
//   TRUSTED_SIGNING_ACCOUNT            -- Trusted Signing account name
//   TRUSTED_SIGNING_PROFILE            -- certificate profile name
//
// --- Required env vars (Azure auth -- consumed by the `sign` CLI itself via
//     its own Azure.Identity environment-credential lookup; this hook does
//     NOT read or forward these, `sign` picks them up from process.env
//     automatically because it inherits this process's environment) ---
//   AZURE_TENANT_ID
//   AZURE_CLIENT_ID
//   AZURE_CLIENT_SECRET
//
// If the tool (`sign` / `sign.exe`) is not installed, see the "GAPS" note in
// the SEG report -- that is a hard failure (thrown), not a fail-soft path,
// because it only happens when the caller already declared signing intent
// (TRUSTED_SIGNING_* present) and a build that silently ships unsigned in
// that situation would be worse than a loud failure.

const { spawnSync } = require('child_process');
const path = require('path');
const { assertUpdaterSigning, loadWinConfig } = require('./updater_signing_check.cjs');

module.exports = async function signWindows(configuration) {
  const filePath = configuration && configuration.path;

  // D-BP223-BM0-X030-073 P3 (XO X030 pick on Founder k/0a8d1c96): FAIL THE BUILD, never warn-and-ship-unsigned.
  // The old fail-soft branch here ("Building unsigned (local/dev build)") is removed. Every signing pass now requires
  // the three TRUSTED_SIGNING_* variables AND the updater signature check ON (win.verifyUpdateCodeSignature true plus
  // win.publisherName). configuration.options is the win config electron-builder is actually using (package.json build
  // or a --config file such as the lean build's); package.json is the fallback.
  const winConfig = (configuration && configuration.options) || loadWinConfig(path.join(__dirname, '..'));
  assertUpdaterSigning(winConfig, process.env);

  const endpoint = process.env.TRUSTED_SIGNING_ENDPOINT;
  const account = process.env.TRUSTED_SIGNING_ACCOUNT;
  const profile = process.env.TRUSTED_SIGNING_PROFILE;

  if (!filePath) {
    throw new Error('[Sign] BUILD REFUSED (X030-073 P3): electron-builder gave no file path to sign; a skipped file would ship unsigned.');
  }

  // `sign` is the Microsoft.Trusted.Signing.Client / .NET global tool
  // (`dotnet tool install --global sign`). On Windows its PATH shim is
  // `sign.exe`; elsewhere it is a plain `sign` shell shim. Name it explicitly
  // rather than relying on implicit PATHEXT resolution.
  const signBin = process.platform === 'win32' ? 'sign.exe' : 'sign';

  // `artifact-signing` is the current (non-obsolete) verb in the `sign` CLI for
  // Azure Trusted Signing; the older `trusted-signing` verb is marked obsolete.
  // Same Azure service, same auth, same timestamp behavior -- only the three
  // account flags are renamed (-ase / -asa / -ascp). The env var names below
  // stay TRUSTED_SIGNING_* to match the Azure portal product name.
  const args = [
    'code',
    'artifact-signing',
    filePath,
    '--artifact-signing-endpoint', endpoint,
    '--artifact-signing-account', account,
    '--artifact-signing-certificate-profile', profile,
    // RFC3161 timestamp: without this the Authenticode signature becomes
    // invalid the moment the short-lived (3-day) Trusted Signing leaf
    // certificate expires. A trusted RFC3161 timestamp token proves the
    // signature was made while the cert was valid, so Windows/SmartScreen
    // keeps trusting the binary indefinitely after the cert itself expires.
    '--timestamp-url', 'http://timestamp.acs.microsoft.com',
    '--file-digest', 'SHA256',
    '--timestamp-digest', 'SHA256',
  ];

  console.log(`[Sign] Signing ${filePath} via Azure Trusted Signing...`);

  // Args passed as an array (spawnSync, no shell) -- never build a shell
  // string, so file paths and credentials can never be misparsed or injected.
  const result = spawnSync(signBin, args, { encoding: 'utf8' });

  if (result.error) {
    // e.g. ENOENT -- the `sign` tool itself is not installed/on PATH.
    // Creds ARE present here (we already returned above if not), so a build
    // that silently ships unsigned at this point would be a false sense of
    // security. Fail loudly.
    throw new Error(
      `[Sign] Failed to launch "${signBin}": ${result.error.message}. ` +
      'Install the .NET "sign" global tool (dotnet tool install --global sign) on the build machine.'
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `[Sign] "${signBin}" exited with code ${result.status} while signing ${filePath}.\n` +
      `stdout:\n${result.stdout}\n` +
      `stderr:\n${result.stderr}`
    );
  }

  console.log(`[Sign] Signed ${filePath}`);
};
