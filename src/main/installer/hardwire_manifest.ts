/**
 * hardwire_manifest.ts -- D-BP202-BM02-014 / BISHOP / BM02.
 *
 * LAW 4 WAS ASKED BEFORE THIS FILE WAS WRITTEN. `ram_detector.ts` (src/main/hardware/ram_detector.ts)
 * was read in full first. It ALREADY has a machine-to-model mapping (`rightSize()`, `applyVramGate()`,
 * `MODEL_WEIGHTS_GB`, `requiredVramGb()`) for the models MnemosyneC runs its own reasoning on. That
 * mapping is EXTENDED here, not replaced: this file imports `requiredVramGb` from ram_detector.ts
 * rather than re-deriving a second, driftable copy of the same VRAM figures. What did NOT already
 * exist, confirmed by a repo-wide search of src/ for "manifest", "preinstall"/"pre-install", and
 * "HardWire Map" (case-insensitive): a MANIFEST describing installable PACKAGES (the runtime and
 * language dependencies around those models, not the models' own VRAM ladder) with per-package
 * rationale text, license, and source-resolution metadata. That is a scoped negative, and this file
 * is the fresh build that closes it.
 *
 * THE FOUNDER'S OWN DESIGN (recovered verbatim, session BP201, re-quoted in this dispatch's brief):
 *   "...could we install a 'pre install' that does the HardWire Map, shows the preselected options
 *   based on that, so they can CHOOSE what they want to download and have the info to make that
 *   decision as an expandable under each already-checkmarked (and.. incidentally also under the
 *   unchecked ones, like why we don't recommend installing gemma 4:12b on an 8GB vram bc, and
 *   instead recommend 2:9b, or whatnot) and that covers the licensing, and early FAQ, so that they
 *   are really informed about what it does ... so they are FULLY in control the entire time."
 *
 * This file is the MANIFEST half of that design. `hardwire_preselection.ts` (same directory) is the
 * pure decision engine that reads this manifest plus a detected machine profile and produces the
 * preselected/expandable-reason state the Founder describes. `hardwire_map_ipc.ts` wires both to the
 * rest of the app. Neither the downloader (the Ollama-style multi-progress-bar UI) nor the settings
 * panel is built here -- two sibling dispatches own those and hang off this schema.
 *
 * ── WHY THE MANIFEST NEVER CARRIES A THIRD-PARTY WEIGHT FILE ─────────────────────────────────────
 *
 * Model weights are multiple gigabytes. GitHub releases (where this app itself ships) cap
 * individual assets and are not a sane place to store or serve someone else's multi-GB binary
 * blobs. Each `PackageManifestEntry.source` therefore names WHERE that package's artifact actually
 * lives -- the Ollama registry for a model tag, python.org for the Python installer -- and nothing
 * in this file mirrors those bytes into our own repository. `lb-repository` remains a valid `source.kind`
 * for artifacts we DO own (e.g. a future first-party plugin), but none of the four seeded packages
 * below use it.
 *
 * ── LIVE FOUNDER RULING RECEIVED MID-DISPATCH (coordinator relay, this session) ──────────────────
 *
 * Verbatim: "Manifest is right, don't host the weights - and are doing it correctly, each package
 * names it's source - and that way when they update, we don't have to worry about it."
 *
 * That is not just approval of the "don't mirror weights" decision above -- it names the REASON,
 * and the reason changes a schema decision: naming a package's source so upstream updates arrive on
 * their own means the schema must PREFER a source form that resolves to the publisher's CURRENT
 * version at fetch time over a hardcoded, pinnable artifact URL that rots the moment the publisher
 * ships a new build. `PackageSource.pinned` is therefore false for every package below. A tag like
 * `gemma2:9b` is itself the un-pinned, always-current resolution mechanism -- the Ollama registry
 * serves whatever is CURRENTLY published under that tag, so this manifest never has to be edited
 * when Google/Ollama ship a new build of the same tag. `PackageSource.pinned` exists as an escape
 * hatch for a genuinely required pin (see its own doc comment for the bar that must be cleared), not
 * as a default.
 *
 * This is the SAME discipline canon_installer_url_must_resolve_from_latest_yml_not_hardcoded_
 * latest_exe_bp105.eblet.md already ratified for OUR OWN installer (resolve from latest.yml, never
 * hardcode "-latest.exe" -- BP105's root cause was a Fastly alias frozen to a GitHub tag that never
 * existed). The Founder's live ruling extends that exact discipline to third-party package sources:
 * `PackageSource.versionResolutionUrl` is this file's equivalent of BP105's `latest.yml` -- the
 * endpoint a downloader MUST resolve the real artifact from at fetch time, never a literal frozen
 * filename. See each seeded entry below for the concrete resolution endpoint per package.
 */

import { requiredVramGb } from '../hardware/ram_detector';

// ─── Identity & category ────────────────────────────────────────────────────────────────────────

/** Stable id. For an Ollama-registry model this IS the registry tag (e.g. 'gemma2:9b') so that
 *  `requiredVramGb(id)` and `PackageSource.registryModel` never have to be kept in sync by hand. */
export type PackageId = string;

export type PackageCategory = 'runtime' | 'language' | 'model';

// ─── Source resolution ──────────────────────────────────────────────────────────────────────────

export type PackageSourceKind =
  | 'ollama-registry'  // a model pulled through the Ollama registry by tag
  | 'publisher-site'   // the original publisher's own download surface (ollama.com, python.org)
  | 'lb-repository';    // our own repository -- small first-party artifacts ONLY, never multi-GB weights

export interface PackageSource {
  kind: PackageSourceKind;

  /** True only when this package is deliberately locked to one version instead of letting the
   *  publisher's own resolution mechanism serve whatever is current. Founder ruling (this dispatch,
   *  live): naming a source so updates "arrive on their own" is the point -- a pin defeats that.
   *  Pin ONLY when a pin is genuinely required for correctness (for example: this manifest's
   *  preselection reasoning is validated against one specific build's MEASURED VRAM footprint, per
   *  ram_detector.ts's MODEL_WEIGHTS_GB table, and an unannounced upstream swap to a differently
   *  sized build would silently invalidate that measurement without anyone re-checking it) -- never
   *  as a default and never merely for convenience. Every seeded entry below is `pinned: false`. */
  pinned: boolean;

  /** Required whenever `pinned` is true. The Founder's own "why," not "we chose to." */
  pinnedReason?: string;

  /** 'ollama-registry' only: the registry TAG, e.g. 'gemma2:9b' -- never a resolved blob digest or
   *  a snapshot URL. The tag is itself the always-current resolution mechanism. */
  registryModel?: string;

  /** Human-readable homepage / documentation link shown to the user in the expandable. NEVER a
   *  resolved download URL -- see `versionResolutionUrl` for the machine-facing resolution path. */
  homepageUrl: string;

  /** BP105 canon, extended by the Founder's live ruling to third-party sources: the machine-facing
   *  endpoint a downloader MUST resolve this package's real artifact URL/version FROM at fetch
   *  time -- a registry manifest endpoint, a releases/latest API, or a directory index carrying the
   *  current version. NEVER a literal hardcoded "-latest"-style alias; that is the exact defect
   *  BP105 found (a stale Fastly rewrite pointed at a GitHub tag, `vlatest`, that never existed).
   *  This field only names WHERE to resolve from -- performing the resolution and the actual
   *  progress-bar download is the sibling downloader dispatch's scope, not this file's. */
  versionResolutionUrl?: string;
}

// ─── Sizes, requirements, rationale, license ───────────────────────────────────────────────────

export interface PackageSizeFigure {
  /** GiB (1024-based), matching ram_detector.ts's own existing convention for its "GB" labels
   *  (verified there: its disk-weight figures equal bytes/1073741824, not bytes/1e9). */
  valueGb: number;
  /** false = UNVERIFIED. A fabricated size that misleads a user about what fits on their machine is
   *  worse than an admitted unknown (this dispatch's own instruction) -- so an unverified figure is
   *  marked as such in the data, never silently presented as fact. */
  verified: boolean;
  /** Where the figure came from (a live fetch, with what was fetched and when), or -- when
   *  `verified` is false -- an honest statement of why it is an estimate and what it is based on. */
  sourceNote: string;
}

export interface PackageRequirements {
  /** null/undefined = no VRAM requirement (not a model, or CPU-only). When set, this is the figure
   *  a preselection engine compares detected VRAM against. For the two model packages below this is
   *  NOT hand-entered -- it is `requiredVramGb(id)` from ram_detector.ts's existing, already-ratified
   *  VRAM gate, so the two mappings can never silently drift apart. */
  minVramGb?: number | null;
  minRamGb?: number;
  minDiskGb?: number;
  /** Other manifest package ids this one needs installed first, e.g. every Ollama-registry model
   *  depends on 'ollama'. */
  dependsOn?: PackageId[];
}

export interface PackageRationale {
  /** Shown in the expandable under an ALREADY-CHECKED (recommended) package: why this fits. */
  recommended: string;
  /** Shown in the expandable under an UNCHECKED (not recommended / incompatible) package: why NOT,
   *  and what to use instead when there is a better-fitting alternative. The Founder's own example
   *  is literal and must be expressible here: gemma4:12b on an 8 GB VRAM machine shows WHY NOT and
   *  points at gemma2:9b instead. */
  notRecommended: string;
}

export interface PackageLicense {
  name: string;
  url: string;
  /** Founder verbatim: "that way it would load the license before releasing any code, not that
   *  that stops anything but we would know where it went and where it came from." True for every
   *  seeded package below -- the preinstall UI (sibling dispatch) is expected to show this before
   *  any download begins, per that instruction. */
  mustAcceptBeforeDownload: boolean;
}

export interface PackageFaqEntry {
  question: string;
  answer: string;
}

export interface PackageManifestEntry {
  id: PackageId;
  displayName: string;
  category: PackageCategory;
  version: string;
  source: PackageSource;
  downloadSize: PackageSizeFigure;
  installedSize: PackageSizeFigure;
  requirements: PackageRequirements;
  rationale: PackageRationale;
  license: PackageLicense;
  /** "early FAQ" per the Founder's own words -- optional, but every seeded entry below carries at
   *  least one, since informed-choice is the entire point of this schema. */
  faq?: PackageFaqEntry[];
}

// ─── Manifest schema version ───────────────────────────────────────────────────────────────────

/** Bumped whenever PackageManifestEntry's shape changes in a way a downloader/UI consumer must
 *  know about. Not a package version -- a schema version. */
export const HARDWIRE_MANIFEST_SCHEMA_VERSION = '1.0.0';

// ─── Seeded packages ────────────────────────────────────────────────────────────────────────────
//
// Real figures, live-fetched this dispatch (2026-08-28) rather than invented. Sources:
//   - Ollama Windows installer size: GitHub API, repos/ollama/ollama/releases/latest ->
//     OllamaSetup.exe, 1,565,765,264 bytes, tag v0.33.2, published 2026-08-27.
//   - Python Windows installer size: python.org/ftp/python/3.14.7/ directory listing ->
//     python-3.14.7-amd64.exe, 33,258,168 bytes.
//   - gemma2:9b, gemma4:12b download sizes: Ollama registry manifest endpoint
//     (registry.ollama.ai/v2/library/<name>/manifests/<tag>), summed layer sizes. gemma4:12b's
//     figure (7,556,507,848 B = 7.04 GiB) independently CORROBORATES ram_detector.ts's own
//     pre-existing disk-weight comment for the same tag ("7,556,508,396 B = 7.04 GB") to within
//     548 bytes -- strong cross-check that both this dispatch's live fetch and that file's earlier
//     measurement are reading the same real artifact, not two different guesses.
//   - VRAM requirements: NOT hand-entered here. `requiredVramGb('gemma2:9b')` and
//     `requiredVramGb('gemma4:12b')` are called live below, against ram_detector.ts's own
//     MODEL_WEIGHTS_GB/requiredVramGb() -- the existing, already-ratified mapping this dispatch was
//     told to extend rather than replace.

function gib(bytes: number): number {
  return Math.round((bytes / (1024 * 1024 * 1024)) * 1000) / 1000;
}

const OLLAMA_WIN_INSTALLER_BYTES = 1_565_765_264; // GitHub releases/latest, OllamaSetup.exe, v0.33.2
const PYTHON_WIN_INSTALLER_BYTES = 33_258_168; // python.org/ftp/python/3.14.7/python-3.14.7-amd64.exe
const GEMMA2_9B_BYTES = 5_443_151_930; // registry.ollama.ai manifest, summed layers
const GEMMA4_12B_BYTES = 7_556_507_848; // registry.ollama.ai manifest, summed layers

const GEMMA2_9B_REQUIRED_VRAM_GB = requiredVramGb('gemma2:9b');
const GEMMA4_12B_REQUIRED_VRAM_GB = requiredVramGb('gemma4:12b');

export const HARDWIRE_PACKAGE_MANIFEST: PackageManifestEntry[] = [
  {
    id: 'ollama',
    displayName: 'Ollama',
    category: 'runtime',
    version: 'v0.33.2',
    source: {
      kind: 'publisher-site',
      pinned: false,
      homepageUrl: 'https://ollama.com/download/windows',
      // Ollama's own GitHub Releases "latest" API is a genuine self-resolving endpoint (it always
      // answers with whatever the publisher most recently tagged) -- exactly the BP105-compliant
      // shape, unlike a frozen "-latest.exe" alias.
      versionResolutionUrl: 'https://api.github.com/repos/ollama/ollama/releases/latest',
    },
    downloadSize: {
      valueGb: gib(OLLAMA_WIN_INSTALLER_BYTES),
      verified: true,
      sourceNote:
        'GitHub API repos/ollama/ollama/releases/latest, asset OllamaSetup.exe, ' +
        `${OLLAMA_WIN_INSTALLER_BYTES.toLocaleString()} bytes, tag v0.33.2, fetched live 2026-08-28.`,
    },
    installedSize: {
      valueGb: gib(OLLAMA_WIN_INSTALLER_BYTES) * 1.15,
      verified: false,
      sourceNote:
        'UNVERIFIED. No installed-footprint measurement was taken this dispatch. Estimated as ' +
        'installer size + 15% unpack/registration overhead, a rough heuristic only -- do not present ' +
        'this as a measured figure to the user without this caveat.',
    },
    requirements: {
      minVramGb: null,
      minRamGb: 8, // UNVERIFIED floor, see faq below
      minDiskGb: 4,
      dependsOn: [],
    },
    rationale: {
      recommended:
        'The model runtime every local AI model in this manifest depends on. If any model below is ' +
        'recommended for your machine, Ollama is required to run it.',
      notRecommended:
        'Skip Ollama only if you do not intend to run any local model on this machine -- everything ' +
        'else in MnemosyneC that does not need a local model still works without it.',
    },
    license: {
      name: 'MIT License',
      url: 'https://github.com/ollama/ollama/blob/main/LICENSE',
      mustAcceptBeforeDownload: true,
    },
    faq: [
      {
        question: 'Why does Ollama need at least 8 GB of RAM?',
        answer:
          'UNVERIFIED against a specific published Ollama document this dispatch. This is a commonly ' +
          'cited community floor for running even the smallest local models comfortably alongside the ' +
          'rest of the OS, not a figure this dispatch confirmed against Ollama\'s own docs live.',
      },
      {
        question: 'Does installing Ollama send my data anywhere?',
        answer:
          'Ollama runs models locally; it does not require a network connection to run an already- ' +
          'downloaded model. Downloading a model does contact the Ollama registry.',
      },
    ],
  },
  {
    id: 'python',
    displayName: 'Python 3.14',
    category: 'language',
    version: '3.14.7',
    source: {
      kind: 'publisher-site',
      pinned: false,
      homepageUrl: 'https://www.python.org/downloads/windows/',
      // python.org has no stable "-latest.exe" alias (the exact hazard class BP105 found for our
      // own installer) -- the "Latest Python 3 Release" index page must be parsed at fetch time for
      // the current version string; the downloader must NEVER hardcode "python-3.14.7-amd64.exe".
      versionResolutionUrl: 'https://www.python.org/downloads/windows/',
    },
    downloadSize: {
      valueGb: gib(PYTHON_WIN_INSTALLER_BYTES),
      verified: true,
      sourceNote:
        `python.org/ftp/python/3.14.7/ directory listing, python-3.14.7-amd64.exe, ` +
        `${PYTHON_WIN_INSTALLER_BYTES.toLocaleString()} bytes, fetched live 2026-08-28.`,
    },
    installedSize: {
      valueGb: 0.2,
      verified: false,
      sourceNote:
        'UNVERIFIED. Not measured this dispatch. A standard CPython 3.14 Windows install commonly ' +
        'lands in the 150-250 MB range once the standard library and pip are unpacked; 0.2 GB is a ' +
        'rough midpoint estimate, not a measurement.',
    },
    requirements: {
      minVramGb: null,
      minRamGb: 4,
      minDiskGb: 1,
      dependsOn: [],
    },
    rationale: {
      recommended:
        'Only needed if you plan to write or run Python-based scripts or plugins against MnemosyneC ' +
        '(for example, contributing to the substrate tooling). Not required for core operation.',
      notRecommended:
        'MnemosyneC\'s core app and local model runtime (Ollama) do not require Python. Skip this ' +
        'unless you specifically intend to develop or run Python tooling.',
    },
    license: {
      name: 'PSF License Agreement for Python',
      url: 'https://docs.python.org/3/license.html',
      mustAcceptBeforeDownload: true,
    },
    faq: [
      {
        question: 'Do I need Python to use MnemosyneC?',
        answer: 'No. Python is an optional developer convenience, not a runtime dependency of the app.',
      },
    ],
  },
  {
    id: 'gemma2:9b',
    displayName: 'Gemma 2 (9B)',
    category: 'model',
    version: '9b',
    source: {
      kind: 'ollama-registry',
      pinned: false,
      registryModel: 'gemma2:9b',
      homepageUrl: 'https://ollama.com/library/gemma2',
      versionResolutionUrl: 'https://registry.ollama.ai/v2/library/gemma2/manifests/9b',
    },
    downloadSize: {
      valueGb: gib(GEMMA2_9B_BYTES),
      verified: true,
      sourceNote:
        `registry.ollama.ai/v2/library/gemma2/manifests/9b, summed layer sizes, ` +
        `${GEMMA2_9B_BYTES.toLocaleString()} bytes, fetched live 2026-08-28.`,
    },
    installedSize: {
      valueGb: gib(GEMMA2_9B_BYTES),
      verified: true,
      sourceNote:
        'Ollama stores a pulled model\'s blobs as-is (no separate extraction step) -- confirmed by ' +
        'ram_detector.ts\'s own disk-vs-resident distinction, where the disk/"weight" figure IS the ' +
        'GET /api/tags size field, i.e. the on-disk blob size. Installed size therefore equals ' +
        'download size for an Ollama-registry model.',
    },
    requirements: {
      // NOT hand-entered -- ram_detector.ts's own requiredVramGb(), the existing ratified VRAM gate.
      minVramGb: GEMMA2_9B_REQUIRED_VRAM_GB,
      minRamGb: 12, // matches ram_detector.ts's 'core' RAM tier floor for this model's raw tier pick
      minDiskGb: Math.ceil(gib(GEMMA2_9B_BYTES) + 1),
      dependsOn: ['ollama'],
    },
    rationale: {
      recommended:
        'Fits comfortably within your detected VRAM. This is MnemosyneC\'s CORE-tier model -- strong ' +
        'accuracy at a size that runs well on mid-range GPUs.',
      notRecommended:
        'Not recommended: your detected VRAM is below what gemma2:9b needs to run well on GPU. It ' +
        'would fall back to a slow CPU/GPU split.',
    },
    license: {
      name: 'Gemma Terms of Use',
      url: 'https://ai.google.dev/gemma/terms',
      mustAcceptBeforeDownload: true,
    },
    faq: [
      {
        question: 'Why is gemma2:9b sometimes recommended INSTEAD of gemma4:12b?',
        answer:
          'This is the Founder\'s own worked example. gemma4:12b needs more VRAM than gemma2:9b to run ' +
          'entirely on GPU. On a machine with 8 GB of VRAM, gemma4:12b does not fit but gemma2:9b does, ' +
          'so gemma2:9b is recommended and gemma4:12b is shown as not-recommended with this same reason.',
      },
    ],
  },
  {
    id: 'gemma4:12b',
    displayName: 'Gemma 4 (12B)',
    category: 'model',
    version: '12b',
    source: {
      kind: 'ollama-registry',
      pinned: false,
      registryModel: 'gemma4:12b',
      homepageUrl: 'https://ollama.com/library/gemma4',
      versionResolutionUrl: 'https://registry.ollama.ai/v2/library/gemma4/manifests/12b',
    },
    downloadSize: {
      valueGb: gib(GEMMA4_12B_BYTES),
      verified: true,
      sourceNote:
        `registry.ollama.ai/v2/library/gemma4/manifests/12b, summed layer sizes, ` +
        `${GEMMA4_12B_BYTES.toLocaleString()} bytes, fetched live 2026-08-28. Independently ` +
        `corroborates ram_detector.ts's pre-existing disk-weight comment for the same tag ` +
        '(7,556,508,396 B) to within 548 bytes.',
    },
    installedSize: {
      valueGb: gib(GEMMA4_12B_BYTES),
      verified: true,
      sourceNote: 'Same basis as gemma2:9b above -- Ollama blob-store size equals download size.',
    },
    requirements: {
      minVramGb: GEMMA4_12B_REQUIRED_VRAM_GB,
      minRamGb: 24, // matches ram_detector.ts's 'full' RAM tier floor for this model's raw tier pick
      minDiskGb: Math.ceil(gib(GEMMA4_12B_BYTES) + 1),
      dependsOn: ['ollama'],
    },
    rationale: {
      recommended:
        'Fits your detected VRAM. This is MnemosyneC\'s FULL/ULTRA-tier flagship model -- the highest ' +
        'accuracy tier, at the cost of needing the most VRAM of the models in this manifest.',
      notRecommended:
        'Not recommended: your detected VRAM is below what gemma4:12b needs to run entirely on GPU ' +
        '(it needs the most of any model in this manifest). gemma2:9b is the recommended alternative ' +
        'when it fits instead.',
    },
    license: {
      name: 'Gemma Terms of Use',
      url: 'https://ai.google.dev/gemma/terms',
      mustAcceptBeforeDownload: true,
    },
    faq: [
      {
        question: 'What happens if I check gemma4:12b anyway on a small-VRAM machine?',
        answer:
          'Nothing stops you -- the Founder\'s rule is that you stay fully in control the entire time. ' +
          'Ollama will still run it, splitting the model between GPU and CPU, but expect it to be ' +
          'noticeably slower than gemma2:9b on the same machine.',
      },
    ],
  },
];
