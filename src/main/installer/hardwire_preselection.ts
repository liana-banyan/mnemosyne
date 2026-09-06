/**
 * hardwire_preselection.ts -- D-BP202-BM02-014 / BISHOP / BM02.
 *
 * The Founder's rule, verbatim, is absolute: "so they are FULLY in control the entire time."
 * `evaluatePackagePreselection()` below is a PURE function -- no filesystem access, no network
 * access, no Electron import -- so it is directly unit-testable and directly callable from the UI
 * dispatch that owns the actual preinstall screen (a sibling dispatch, not this one). It takes an
 * already-detected machine profile (gathered by `hardwire_map_ipc.ts`'s IPC handler, which is the
 * ONLY place in this dispatch's code that touches real hardware) and the package manifest, and
 * returns, for EVERY package, a decision plus a reason string -- never a hidden or forced choice,
 * and never an unexplained checkbox state. An unchecked item still carries its reasoning, exactly
 * as much as a checked one does.
 */

import type { PackageId, PackageManifestEntry } from './hardwire_manifest';

// ─── Machine profile ────────────────────────────────────────────────────────────────────────────

export type DetectedPlatform = 'win32' | 'darwin' | 'linux' | 'unknown';

export interface MachineProfile {
  ramGb: number;
  /** null = genuinely undetectable (no GPU, or detection failed) -- NEVER zero. Mirrors
   *  ram_detector.ts's own detectVramGb() convention exactly, on purpose: this file consumes that
   *  same honest-unknown semantics rather than inventing a second one. */
  vramGb: number | null;
  os: DetectedPlatform;
  /** Optional context, not required for a decision. */
  gpuName?: string | null;
  diskFreeGb?: number | null;
  /** Package ids already present on this machine (e.g. an existing Ollama install). Purely
   *  informational for the reason text -- does not change checked/unchecked state; the user is
   *  still shown the same recommendation and can still re-download or skip. */
  alreadyInstalled?: PackageId[];
}

// ─── Decision ───────────────────────────────────────────────────────────────────────────────────

export type PreselectionDecisionKind = 'recommended' | 'not-recommended' | 'required' | 'incompatible';

export interface PackagePreselectionDecision {
  packageId: PackageId;
  decision: PreselectionDecisionKind;
  /** The preselected checkbox state. ALWAYS user-overridable by the UI dispatch that consumes
   *  this -- this field is a DEFAULT, never an enforcement. */
  checked: boolean;
  /** The expandable rationale text, populated for EVERY package regardless of checked/unchecked
   *  state -- this is the field the Founder's design puts under "already-checkmarked (and..
   *  incidentally also under the unchecked ones)". */
  reason: string;
  /** Set when a not-recommended/incompatible model package has a better-fitting alternative in the
   *  same manifest (the Founder's own gemma4:12b -> gemma2:9b worked example). */
  alternativePackageId?: PackageId | null;
}

/**
 * Pure decision function. No fs, no network, no Electron -- offline-testable by construction.
 *
 * Order of evaluation per package:
 *   1. RAM floor (`requirements.minRamGb`) -- below it, the package is 'incompatible' outright,
 *      regardless of anything else, since no VRAM step-down or dependency reasoning can fix a RAM
 *      shortfall.
 *   2. VRAM requirement (`requirements.minVramGb`), only when set (models only):
 *      - `profile.vramGb === null` (genuinely undetectable, not zero): falls back to
 *        'not-recommended' with an HONEST note that VRAM could not be measured -- never silently
 *        recommends a model whose fit could not be confirmed.
 *      - `profile.vramGb` known: 'recommended' when it meets the requirement, 'not-recommended'
 *        otherwise, and in the not-recommended case this function looks for the SMALLEST other
 *        model package in the manifest whose own requirement DOES fit, and names it as
 *        `alternativePackageId` -- this is what makes the Founder's gemma4:12b/8GB/gemma2:9b example
 *        concrete rather than a hardcoded special case.
 *   3. Dependency rollup (`requirements.dependsOn`): a runtime package (e.g. 'ollama') becomes
 *      'required' when at least one package that depends on it is 'recommended'; otherwise it keeps
 *      its own manifest-driven default rationale.
 */
export function evaluatePackagePreselection(
  profile: MachineProfile,
  manifest: PackageManifestEntry[],
): PackagePreselectionDecision[] {
  const byId = new Map(manifest.map((m) => [m.id, m] as const));

  // Pass 1: every package's OWN fit, ignoring dependency rollup for now.
  const own = new Map<PackageId, PackagePreselectionDecision>();

  for (const pkg of manifest) {
    const alreadyNote =
      profile.alreadyInstalled && profile.alreadyInstalled.includes(pkg.id)
        ? ' (already installed on this machine)'
        : '';

    // 1. RAM floor.
    if (typeof pkg.requirements.minRamGb === 'number' && profile.ramGb < pkg.requirements.minRamGb) {
      own.set(pkg.id, {
        packageId: pkg.id,
        decision: 'incompatible',
        checked: false,
        reason:
          `Incompatible: this machine has ${profile.ramGb} GB of RAM, below the ${pkg.requirements.minRamGb} GB ` +
          `${pkg.displayName} needs.${alreadyNote}`,
        alternativePackageId: null,
      });
      continue;
    }

    // 2. VRAM requirement (models only -- non-model packages have minVramGb null/undefined).
    const requiredVram = pkg.requirements.minVramGb;
    if (typeof requiredVram === 'number') {
      if (profile.vramGb === null) {
        own.set(pkg.id, {
          packageId: pkg.id,
          decision: 'not-recommended',
          checked: false,
          reason:
            `VRAM could not be detected on this machine (no GPU found, or detection failed) -- ` +
            `${pkg.displayName} needs about ${requiredVram} GB of VRAM to run well on GPU, and this ` +
            `cannot be confirmed, so it is left unchecked rather than guessed at.${alreadyNote}`,
          alternativePackageId: null,
        });
      } else if (profile.vramGb >= requiredVram) {
        own.set(pkg.id, {
          packageId: pkg.id,
          decision: 'recommended',
          checked: true,
          reason: `${pkg.rationale.recommended} Detected VRAM: ${profile.vramGb} GB, needs ~${requiredVram} GB.${alreadyNote}`,
          alternativePackageId: null,
        });
      } else {
        const alternative = findSmallestFittingModel(manifest, pkg.id, profile.vramGb);
        own.set(pkg.id, {
          packageId: pkg.id,
          decision: 'not-recommended',
          checked: false,
          reason:
            `${pkg.rationale.notRecommended} Detected VRAM: ${profile.vramGb} GB, needs ~${requiredVram} GB.` +
            (alternative ? ` Recommending ${byId.get(alternative)?.displayName ?? alternative} instead.` : '') +
            alreadyNote,
          alternativePackageId: alternative,
        });
      }
      continue;
    }

    // 3. Non-model packages default to their manifest rationale; dependency rollup happens in pass 2.
    own.set(pkg.id, {
      packageId: pkg.id,
      decision: 'not-recommended',
      checked: false,
      reason: `${pkg.rationale.notRecommended}${alreadyNote}`,
      alternativePackageId: null,
    });
  }

  // Pass 2: dependency rollup. A package becomes 'required' (and checked) when at least one
  // recommended/required package in the manifest names it in dependsOn.
  const dependedOnByRecommended = new Set<PackageId>();
  for (const pkg of manifest) {
    const decision = own.get(pkg.id);
    if (!decision) continue;
    if (decision.decision === 'recommended' || decision.decision === 'required') {
      for (const dep of pkg.requirements.dependsOn ?? []) {
        dependedOnByRecommended.add(dep);
      }
    }
  }

  for (const depId of dependedOnByRecommended) {
    const dep = byId.get(depId);
    const current = own.get(depId);
    if (!dep || !current) continue;
    // A dependency that is itself incompatible stays incompatible -- rollup cannot force a package
    // onto hardware that cannot run it.
    if (current.decision === 'incompatible') continue;
    const dependents = manifest
      .filter((p) => (p.requirements.dependsOn ?? []).includes(depId) && own.get(p.id)?.checked)
      .map((p) => p.displayName);
    own.set(depId, {
      packageId: depId,
      decision: 'required',
      checked: true,
      reason:
        `Required because ${dependents.join(', ')} ${dependents.length === 1 ? 'is' : 'are'} recommended ` +
        `for this machine and ${dependents.length === 1 ? 'needs' : 'need'} ${dep.displayName} installed first.`,
      alternativePackageId: null,
    });
  }

  return manifest.map((pkg) => own.get(pkg.id)!);
}

/** Among the OTHER packages in the manifest that carry a VRAM requirement, find the largest one
 *  that still fits the detected VRAM -- "smallest fitting" in the sense of "closest fit below the
 *  one that didn't fit", not literally smallest overall. Used to populate `alternativePackageId`. */
function findSmallestFittingModel(
  manifest: PackageManifestEntry[],
  excludeId: PackageId,
  vramGb: number,
): PackageId | null {
  const candidates = manifest
    .filter((p) => p.id !== excludeId && typeof p.requirements.minVramGb === 'number')
    .filter((p) => (p.requirements.minVramGb as number) <= vramGb)
    .sort((a, b) => (b.requirements.minVramGb as number) - (a.requirements.minVramGb as number));
  return candidates.length > 0 ? candidates[0].id : null;
}
