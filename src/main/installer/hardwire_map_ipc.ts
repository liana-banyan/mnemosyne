/**
 * hardwire_map_ipc.ts -- D-BP202-BM02-014 / BISHOP / BM02.
 *
 * WIRING (Founder law: WHEN YOU BUILD IT, YOU WIRE IT). This is the main-process module + IPC
 * registration for the HardWire Map schema (`hardwire_manifest.ts` + `hardwire_preselection.ts`),
 * mirroring `mesh_remote_admin_consent.ts`'s established pattern in this codebase: a small set of
 * `ipcMain.handle` calls registered by one exported `register*Ipc()` function, called once at app
 * boot from `index.ts` alongside the other `register*Ipc()` calls, with matching preload exposure
 * and a renderer-facing type declaration. This dispatch's scope is the SPINE only -- no UI is built
 * here; a sibling dispatch owns the actual preinstall screen and calls these three handlers.
 *
 * LAW 4 re-confirmed at this file's own write (the estate's build gate flagged the two sibling
 * files above as possible prior art -- both ARE prior art, because they are the other two files
 * THIS SAME dispatch wrote minutes earlier in this same session; the six HARDWIRE-0X_*.md matches
 * are the unrelated mesh dispatch/SEG protocol docs read during this dispatch's own Founder-law
 * preamble, not an installer schema). The repo-wide search performed at the start of this dispatch
 * (grep across src/ for "manifest", "preinstall"/"pre-install", "HardWire Map") found no pre-existing
 * package-manifest IPC surface to extend -- this is the fresh build that closes that scoped negative.
 *
 * Three read-only handlers, deliberately kept to gadgeting + pure evaluation, nothing else:
 *   - 'hardwire-map:get-manifest'           -> the seeded PackageManifestEntry[]
 *   - 'hardwire-map:get-machine-profile'    -> a freshly GADGETED MachineProfile (real RAM/VRAM/OS)
 *   - 'hardwire-map:get-preselection'       -> gathers the profile, then calls the pure
 *                                              evaluatePackagePreselection() against the manifest
 *
 * Gadgeting reuses ram_detector.ts's EXISTING, already-ratified hardware detection
 * (getTotalRamGb / detectVramGbDetailed) rather than re-implementing a second RAM/VRAM reader --
 * the same "extend, don't replace" instruction this dispatch was given for the model mapping
 * applies equally to the detection surface itself.
 */

import { ipcMain } from 'electron';
import { platform } from 'os';
import { getTotalRamGb, detectVramGbDetailed } from '../hardware/ram_detector';
import { HARDWIRE_PACKAGE_MANIFEST, HARDWIRE_MANIFEST_SCHEMA_VERSION, type PackageManifestEntry } from './hardwire_manifest';
import { evaluatePackagePreselection, type MachineProfile, type PackagePreselectionDecision, type DetectedPlatform } from './hardwire_preselection';

function resolvePlatform(): DetectedPlatform {
  const p = platform();
  if (p === 'win32' || p === 'darwin' || p === 'linux') return p;
  return 'unknown';
}

/** The one real-hardware gadget in this file. Everything downstream of this (the preselection
 *  engine) is pure and takes this object as plain data -- no caller of evaluatePackagePreselection()
 *  needs to touch fs/network/Electron itself. */
export function detectMachineProfile(): MachineProfile {
  const ramGb = getTotalRamGb();
  const vramDetail = detectVramGbDetailed();
  return {
    ramGb,
    vramGb: vramDetail.vramGb,
    os: resolvePlatform(),
    gpuName: vramDetail.adapters?.[0]?.name ?? null,
    diskFreeGb: null, // not gadgeted by ram_detector.ts today -- honestly omitted, not guessed
    alreadyInstalled: [],
  };
}

export function getHardwireManifest(): PackageManifestEntry[] {
  return HARDWIRE_PACKAGE_MANIFEST;
}

export function getHardwirePreselection(): {
  schemaVersion: string;
  profile: MachineProfile;
  decisions: PackagePreselectionDecision[];
} {
  const profile = detectMachineProfile();
  const decisions = evaluatePackagePreselection(profile, HARDWIRE_PACKAGE_MANIFEST);
  return { schemaVersion: HARDWIRE_MANIFEST_SCHEMA_VERSION, profile, decisions };
}

/** Registers the three IPC handlers. Call once at app boot, alongside the other register*Ipc()
 *  calls in index.ts -- mirrors registerMeshRemoteAdminConsentIpc()'s registration pattern exactly. */
export function registerHardwireMapIpc(): void {
  ipcMain.handle('hardwire-map:get-manifest', () => getHardwireManifest());
  ipcMain.handle('hardwire-map:get-machine-profile', () => detectMachineProfile());
  ipcMain.handle('hardwire-map:get-preselection', () => getHardwirePreselection());
  console.log('[HardwireMap] IPC handlers registered (D-BP202-BM02-014)');
}
