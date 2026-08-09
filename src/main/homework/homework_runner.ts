// BP140-K3 — Homework: idle-time, AC-power, $0-Ollama-only background substrate worker.
//
// Loop pattern mirrors src/main/ip_ledger/mesh_diff_loop.ts (setInterval + startX()/stopX(),
// ~5s startup delay). Gates ALL local, per canon:
//   Gate 1 — not on battery        (same powerMonitor.isOnBatteryPower try/catch as mesh_diff_loop:97-106)
//   Gate 2 — system idle           (Electron powerMonitor.getSystemIdleTime(), NEW to this codebase)
//   Gate 3 — app not busy          (homework_busy_gate.ts heartbeat + mesh_test's isOneClickRunActive())
//   Gate 4 — user opted in         (homework_enabled setting, OFF by default)
//
// HARD RULE: every model call in this file goes through 127.0.0.1:11434 (ollamaManager /
// the same OLLAMA_API_BASE ollama_adapter.ts uses). This file NEVER imports wave_generator,
// dispatchWave, star_chamber_dispatch, or any Pawn/Rook/Knight/Bishop cloud-seat dispatcher —
// if a job can't be done locally for free, runForageEbletJob() below fails soft and the job is
// marked FAILED, never escalated to a paid seat.
//
// Job queue: ~/.lb_substrate/on_deck/homework/*.eblet.md (same base dir convention as
// on_deck_bridge.ts's resolveBaseDir(), one level deeper). on_deck_bridge.ts's listOnDeck() is
// read-only (confirmed — see that file's own header); this file is the first PULLER in the
// on_deck family, scoped only to homework/.

import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { app, powerMonitor } from 'electron';
import { ollamaManager } from '../ollama_manager';
import { FLOOR_MODEL } from '../../shared/floor-model';
import { isAppBusy } from './homework_busy_gate';
import { isOneClickRunActive } from '../mesh_test/one_click_mmlu_pro';
import {
  parseHomeworkFile,
  markHomeworkFailed,
  moveHomeworkFileToFired,
  type HomeworkItem,
  type HomeworkPriority,
} from './homework_frontmatter';

const OLLAMA_API_BASE = 'http://127.0.0.1:11434';
const SWEEP_INTERVAL_MS = 60 * 1000; // check once a minute — cheap, no network cost if gated off
const DEFAULT_IDLE_THRESHOLD_SECONDS = 300; // 5 minutes
const FORAGE_EXCERPT_CHARS = 6_000; // keep the prompt small enough for the floor model's context
const FORAGE_TIMEOUT_MS = 120_000;

let homeworkLoopTimer: ReturnType<typeof setInterval> | null = null;

// ─── Settings (read-only from this file's side) ────────────────────────────────
// Homework does NOT own ai_dispatch_settings.json — ai_dispatch_ipc.ts does (see its
// AiDispatchSettings interface's homework_enabled / homework_idle_threshold_seconds fields and
// its 'ai-dispatch:save-settings' handler, both updated alongside this file in the same Yoke).
// This reads the SAME file by the SAME path convention, self-contained, matching
// mesh_diff_loop.ts's own no-shared-import style rather than reaching into ai_dispatch_ipc.ts's
// private loadSettings().

interface HomeworkRelevantSettings {
  homework_enabled?: boolean;
  homework_idle_threshold_seconds?: number;
}

function readHomeworkSettings(): HomeworkRelevantSettings {
  try {
    const p = join(app.getPath('userData'), 'ai_dispatch_settings.json');
    if (!existsSync(p)) return {};
    return JSON.parse(readFileSync(p, 'utf-8')) as HomeworkRelevantSettings;
  } catch {
    return {};
  }
}

function isHomeworkEnabled(): boolean {
  return readHomeworkSettings().homework_enabled === true;
}

function idleThresholdSeconds(): number {
  const configured = readHomeworkSettings().homework_idle_threshold_seconds;
  return typeof configured === 'number' && configured > 0 ? configured : DEFAULT_IDLE_THRESHOLD_SECONDS;
}

// ─── Gates ──────────────────────────────────────────────────────────────────────

/** Gate 1 — same battery-aware pattern as mesh_diff_loop.ts:97-106, verbatim try/catch shape. */
function isOnBatteryPower(): boolean {
  try {
    if (typeof powerMonitor.isOnBatteryPower === 'function' && powerMonitor.isOnBatteryPower()) {
      return true;
    }
  } catch {
    // powerMonitor not available in this context — treat as "not on battery" (proceed to other gates)
  }
  return false;
}

/** Gate 2 — NEW to this codebase: Electron's getSystemIdleTime() in seconds. */
function isSystemIdleEnough(): { idle: boolean; idleSeconds: number } {
  try {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    return { idle: idleSeconds >= idleThresholdSeconds(), idleSeconds };
  } catch {
    // Cannot verify idle state — fail SAFE (do not run), never fail open.
    return { idle: false, idleSeconds: 0 };
  }
}

/** Gate 3 — no active user Ask (homework_busy_gate heartbeat) and no scored mesh-test running
 *  (mesh_test/one_click_mmlu_pro.ts's own already-exported running flag — reused, not duplicated). */
function isAppFreeForHomework(): boolean {
  return !isAppBusy() && !isOneClickRunActive();
}

// ─── Puller: scan homework/ for READY jobs, lowest priority first ──────────────

const PRIORITY_RANK: Record<HomeworkPriority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

function homeworkBaseDir(): string {
  // Same base convention as on_deck_bridge.ts's resolveBaseDir(), one directory deeper.
  return resolve(homedir(), '.lb_substrate', 'on_deck', 'homework');
}

function homeworkFiredDir(): string {
  return join(homeworkBaseDir(), 'fired');
}

/** Scans homework/ (NOT fired/, NOT the on_deck sequential/anytime/conditional/ dirs) for
 *  status:READY jobs, sorted lowest-priority-first — Homework is background filler work, so the
 *  least time-pressured queued job runs first, never crowding out anything more urgent that
 *  might later get a real (paid-seat) dispatch path. */
function listReadyHomeworkJobs(): HomeworkItem[] {
  const dir = homeworkBaseDir();
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.eblet.md'))
    .map((d) => join(dir, d.name))
    .sort();

  const items: HomeworkItem[] = [];
  for (const fp of files) {
    const result = parseHomeworkFile(fp);
    if (result.ok && result.item.frontmatter.status === 'READY') {
      items.push(result.item);
    } else if (!result.ok) {
      console.warn(`[homework] skipping malformed job file ${fp}: ${result.error}`);
    }
  }

  items.sort((a, b) => PRIORITY_RANK[a.frontmatter.priority] - PRIORITY_RANK[b.frontmatter.priority]);
  return items;
}

// ─── Job type: forage_eblet ─────────────────────────────────────────────────────
// Given a queued archive file path, read it, use the LOCAL Ollama model to identify/summarize
// it, and mint an eblet into the preservation Vault's CANON directory
// (Asteroid-ProofVault\state\eblets\CANON\*.eblet.md — additive only, Rule 66 / vault-sacrosanct,
// NEVER deletes or overwrites an existing file; see mintForageEblet() below).

/** Very light RTF de-markup for .rtf archive scans — strips control words/groups so the model
 *  sees prose instead of RTF syntax noise. Not a full RTF parser (out of scope for a proof-of-
 *  life job type); good enough for identify/summarize purposes on scanned document exports. */
function toPlainText(filePath: string, raw: string): string {
  if (!filePath.toLowerCase().endsWith('.rtf')) return raw;
  return raw
    .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildForagePrompt(sourceLabel: string, excerpt: string): string {
  return (
    `You are helping catalog an archive file for a personal knowledge vault.\n` +
    `File: ${sourceLabel}\n\n` +
    `Read the excerpt below and respond with:\n` +
    `1. A one-line identification of what this document is (letter, journal entry, form, etc.)\n` +
    `2. A 3-5 sentence summary of its content\n\n` +
    `Excerpt:\n"""\n${excerpt}\n"""\n`
  );
}

interface ForageResult {
  ok: boolean;
  reason?: string;
  provenance?: string;
  /** Absolute path of the CANON *.eblet.md file this job minted (set only on ok:true). */
  ebletPath?: string;
}

// ─── CANON vault output (additive-only, Rule 66 / vault-sacrosanct) ────────────
// Founder's absolute path is C:\Users\Administrator\Documents\Asteroid-ProofVault\state\eblets\
// CANON\ — built from homedir() rather than a literal hardcoded username, same portability
// convention env_loader.ts's loadWorkingKeysEnv() already uses for the sibling LockBox path.

function canonVaultDir(): string {
  // Test-only escape hatch (D-BP151-021's own test writes here instead of the real Vault —
  // LB-GOLD-0399 vault-sacrosanct, a test must never mint into Asteroid-ProofVault). Unset in
  // production; same override convention canon_threshold_classifier.ts's own
  // CANON_CLASSIFIER_VAULT_ROOT already uses.
  const testOverride = process.env.HOMEWORK_TEST_CANON_VAULT_DIR;
  if (testOverride && testOverride.trim() !== '') return resolve(testOverride);
  return resolve(homedir(), 'Documents', 'Asteroid-ProofVault', 'state', 'eblets', 'CANON');
}

/** Derive a filesystem-safe slug from a source label (strip extension, collapse anything that
 *  isn't [A-Za-z0-9_-] to '_') for use in the forage_<slug>_<timestamp>.eblet.md filename. */
function slugifyForForage(label: string): string {
  const withoutExt = label.replace(/\.[^./\\]+$/, '');
  const slug = withoutExt.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return slug.length > 0 ? slug : 'source';
}

// ─── CANON classification AT MINT TIME (D-BP151-021/BISHOP/seg-classify-at-mint) ──────
//
// ATTRIBUTED: Founder, BP151, verbatim (filed FD-BP151-09,
// LianaBanyanPlatform\BISHOP_DROPZONE\FOUNDER_DECISIONS_BP151.md): "And lets just start
// classifying minted eblets WHEN WE MINT THEM, from now on. I'm SICK of fixing old crap -
// it's repainting the same 5 miles of highway, all over again. I yearn for the horizon.
// Let's get there." Forward-looking only — this wires classification into the ONE live
// code path in this repo (and librarian-mcp) confirmed to mint a new *.eblet.md file into
// Asteroid-ProofVault\state\eblets\CANON\ (see mintForageEblet() below). No existing
// eblet is read, reclassified, or touched by this block.
//
// Reuses librarian-mcp's proven canon_threshold_classifier.ts (Young Red Queen: 943/945
// classified, pilot 39/40, fresh 30-sample 30/30 — D-BP149-020 applied its output to 852
// eblets with zero conflicts on read-back) via mint_classify_bridge.mjs, a thin
// child-process transport shim living in librarian-mcp/scripts/ (see that file's own
// header for why a subprocess bridge is required rather than a static import: this app's
// tsconfig is CommonJS/rootDir-src-main, the classifier is ESM and uses
// import.meta.url). No classification judgment is reimplemented here or in the bridge —
// both merely relay a call to the real, unmodified proposeEbletTags().
//
// HARD RULES, all from FD-BP151-09 / the ticket that ordered this wiring:
//   - The classifier PROPOSES, never ratifies. machine_classified/human_ratified below
//     are always true/false — a human ratifying this is a separate, later step this code
//     never performs.
//   - If the classifier refuses, is unreachable, times out, or errors, classifyForMint()
//     resolves to the 'unclassified' status — it NEVER throws, and mintForageEblet()'s
//     write proceeds exactly as if this block were absent. A refusal is a real result,
//     never guessed into a type.
//   - Confidence is NEVER read for any gating/ordering/filtering purpose here (per the
//     Young Red Queen ratification note: 794 of 943 of her confidence scores sit at
//     exactly 1.0 — not usable signal). This block does not forward confidence into the
//     mint receipt at all.

// Margin only — canon_threshold_classifier.ts's own DEFAULT_CLASSIFIER_CONFIG.timeout_ms
// is 45000 for the Ollama call itself; this outer timeout exists solely to catch a hung
// subprocess and never races the classifier's own internal timeout.
const CLASSIFIER_BRIDGE_TIMEOUT_MS = 60_000;

export interface MintClassificationReceipt {
  metadata_type_status: 'proposal' | 'unclassified';
  metadata_type: string | null;
  metadata_type_reason: string;
  metadata_type_classifier: string;
  metadata_type_model: string;
  metadata_type_machine_classified: true;
  metadata_type_human_ratified: false;
}

function classifierBridgePath(): string {
  return resolve(homedir(), 'Documents', 'LianaBanyanPlatform', 'librarian-mcp', 'scripts', 'mint_classify_bridge.mjs');
}

const CLASSIFIER_NAME = 'canon_threshold_classifier.ts/proposeEbletTags';

function unclassifiedReceipt(reason: string, model = 'none'): MintClassificationReceipt {
  return {
    metadata_type_status: 'unclassified',
    metadata_type: null,
    metadata_type_reason: reason,
    metadata_type_classifier: CLASSIFIER_NAME,
    metadata_type_model: model,
    metadata_type_machine_classified: true,
    metadata_type_human_ratified: false,
  };
}

/** Calls the real Young Red Queen classifier on content about to be minted, via the
 *  child-process bridge (see file-header block above). Never throws; never blocks past
 *  CLASSIFIER_BRIDGE_TIMEOUT_MS; any refusal/error/timeout resolves to the honest
 *  'unclassified' status, never a guessed type — mintForageEblet()'s caller must proceed
 *  with the mint regardless of what this function returns. */
// Exported for homework_runner.test.ts (D-BP151-021) only — same "export the pure/testable
// unit" convention this repo's other *.test.ts idiom relies on (e.g. comparative_cascade.ts's
// toPerSqKm). No other caller outside this file and its test exists.
export async function classifyForMint(candidate: {
  relPath: string;
  absPath: string;
  currentFrontmatter: string;
  bodyExcerpt: string;
}): Promise<MintClassificationReceipt> {
  const bridgePath = classifierBridgePath();
  if (!existsSync(bridgePath)) {
    return unclassifiedReceipt(`classifier bridge not found at ${bridgePath}`);
  }

  return new Promise<MintClassificationReceipt>((resolvePromise) => {
    let settled = false;
    const done = (result: MintClassificationReceipt) => {
      if (settled) return;
      settled = true;
      resolvePromise(result);
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn('node', [bridgePath], { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      done(unclassifiedReceipt(`failed to spawn classifier bridge: ${String(e)}`));
      return;
    }

    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* non-fatal */ }
      done(unclassifiedReceipt('classifier bridge timed out'));
    }, CLASSIFIER_BRIDGE_TIMEOUT_MS);

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

    child.on('error', (e) => {
      clearTimeout(timer);
      done(unclassifiedReceipt(`classifier bridge process error: ${String(e)}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        done(unclassifiedReceipt(`classifier bridge exited ${code}: ${stderr.slice(0, 300)}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as {
          error?: string;
          proposed_metadata_type?: string | null;
          reason?: string;
          model?: string;
          degraded?: boolean;
        };
        if (parsed && parsed.error) {
          done(unclassifiedReceipt(`classifier bridge reported: ${String(parsed.error).slice(0, 300)}`));
          return;
        }
        if (!parsed || typeof parsed.proposed_metadata_type === 'undefined') {
          done(unclassifiedReceipt('classifier bridge returned an unrecognized shape'));
          return;
        }
        if (parsed.degraded || !parsed.proposed_metadata_type) {
          done(unclassifiedReceipt(
            String(parsed.reason ?? 'classifier returned no proposal'),
            String(parsed.model ?? 'unknown'),
          ));
          return;
        }
        done({
          metadata_type_status: 'proposal',
          metadata_type: String(parsed.proposed_metadata_type),
          metadata_type_reason: String(parsed.reason ?? ''),
          metadata_type_classifier: CLASSIFIER_NAME,
          metadata_type_model: String(parsed.model ?? 'unknown'),
          metadata_type_machine_classified: true,
          metadata_type_human_ratified: false,
        });
      } catch (e) {
        done(unclassifiedReceipt(`classifier bridge output unparseable: ${String(e)}`));
      }
    });

    child.stdin?.write(JSON.stringify(candidate));
    child.stdin?.end();
  });
}

/** Mint a CANON *.eblet.md file for one forage_eblet run. Additive only — filename embeds a
 *  fresh Date.now() timestamp so two runs (even on the same source file) can never collide and
 *  never overwrite an earlier mint; the CANON dir is created if missing (defensive — it should
 *  already exist) but no existing file under it is ever read, moved, or rewritten. Mirrors the
 *  frontmatter + body shape of the hand-authored *.eblet.md files already in that directory
 *  (see canon_eblet_maturity_states_ratcheted_not_iron_cast_bp140.eblet.md), but honestly
 *  self-describes as unverified/Provisional per that same maturity-states canon — an unattended
 *  background summarization has no human/corroboration signal behind it.
 *
 *  D-BP151-021: now ADDITIVELY calls classifyForMint() (above) before writing, and folds its
 *  MintClassificationReceipt into the frontmatter as metadata_type/metadata_type_status/etc.
 *  Classification failure of any kind never prevents the mint — see classifyForMint()'s own
 *  contract.
 *
 *  Exported for homework_runner.test.ts (D-BP151-021) only. */
export async function mintForageEblet(params: {
  sourceLabel: string;
  sourcePath: string;
  model: string;
  summary: string;
  provenance: string;
}): Promise<{ ok: true; path: string } | { ok: false; reason: string }> {
  try {
    const canonDir = canonVaultDir();
    if (!existsSync(canonDir)) {
      mkdirSync(canonDir, { recursive: true });
    }

    const slug = slugifyForForage(params.sourceLabel);
    const timestamp = Date.now();
    const filename = `forage_${slug}_${timestamp}.eblet.md`;
    const filePath = join(canonDir, filename);
    const nowIso = new Date(timestamp).toISOString();

    // D-BP151-021: classify BEFORE writing (single write, no read-modify-write pass over
    // an existing file) — the candidate body is exactly what is about to be written below.
    const classification = await classifyForMint({
      relPath: filename,
      absPath: filePath,
      currentFrontmatter: '',
      bodyExcerpt: params.summary.slice(0, 1200),
    });

    const body = [
      '---',
      `name: forage-${slug}-${timestamp}`,
      `description: "Homework forage_eblet (BP140-K3): $0 local-Ollama auto-summary of archive file '${params.sourceLabel}'. Unattended background job — no human corroboration, honest maturity: Provisional."`,
      'type: forage',
      'class: homework-forage · unverified · provisional · $0-local-ollama',
      'bp: BP140-K3',
      `provenance: ${params.provenance}`,
      'verified: false',
      'maturity: Provisional',
      `model: ${params.model}`,
      `source_path: "${params.sourcePath}"`,
      `minted_at: ${nowIso}`,
      // D-BP151-021/FD-BP151-09: additive-only fields, a PROPOSAL never a ratification.
      `metadata_type: ${classification.metadata_type ?? 'unclassified'}`,
      `metadata_type_status: ${classification.metadata_type_status}`,
      `metadata_type_reason: "${classification.metadata_type_reason.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
      `metadata_type_classifier: ${classification.metadata_type_classifier}`,
      `metadata_type_model: ${classification.metadata_type_model}`,
      `metadata_type_machine_classified: ${classification.metadata_type_machine_classified}`,
      `metadata_type_human_ratified: ${classification.metadata_type_human_ratified}`,
      '---',
      '',
      `# Forage: ${params.sourceLabel}`,
      '',
      `**Source file:** \`${params.sourcePath}\``,
      `**Model:** \`${params.model}\` (local Ollama, $0)`,
      `**Minted:** ${nowIso}`,
      `**Provenance:** \`${params.provenance}\``,
      '',
      '## Summary',
      '',
      params.summary,
      '',
      '---',
      "Minted automatically by Homework (BP140-K3) — idle-time, AC-power, $0-Ollama-only " +
        "background substrate worker. Honest per computeHonestVerification()'s contract: an " +
        'unattended background summarization has no human/corroboration signal, so this eblet ' +
        'is truthfully **unverified** / **Provisional** maturity until independently ' +
        'corroborated (see canon_eblet_maturity_states_ratcheted_not_iron_cast_bp140). ' +
        'metadata_type above is a MACHINE PROPOSAL (canon_threshold_classifier.ts, D-BP151-021) ' +
        '— not human-ratified; see metadata_type_status.',
      '',
    ].join('\n');

    writeFileSync(filePath, body, 'utf-8');
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, reason: `mintForageEblet failed: ${String(err)}` };
  }
}

async function runForageEbletJob(item: HomeworkItem): Promise<ForageResult> {
  const { source_path } = item.frontmatter;

  if (!existsSync(source_path)) {
    return { ok: false, reason: `source_path does not exist: ${source_path}` };
  }

  let raw: string;
  try {
    raw = readFileSync(source_path, 'utf-8');
  } catch (e) {
    return { ok: false, reason: `Cannot read source_path: ${String(e)}` };
  }

  const excerpt = toPlainText(source_path, raw).slice(0, FORAGE_EXCERPT_CHARS);
  if (excerpt.trim().length === 0) {
    return { ok: false, reason: 'source_path produced no readable text content' };
  }

  // FREE EXECUTION HARD RULE: local Ollama only. No dispatchWave, no wave templates, no
  // Pawn/Rook/Knight/Bishop cloud seats. If Ollama is not reachable, SKIP (fail soft) — never
  // escalate to a paid path.
  if (!(await ollamaManager.isReachable())) {
    return { ok: false, reason: 'Ollama unreachable — cannot forage for free locally, skipping (never escalates to paid)' };
  }

  const model = ollamaManager.getSelectedModel() ?? FLOOR_MODEL;
  const label = basename(source_path);
  const prompt = buildForagePrompt(label, excerpt);

  let summary: string;
  try {
    const res = await fetch(`${OLLAMA_API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { num_predict: 400, temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(FORAGE_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, reason: `Ollama HTTP ${res.status}: ${await res.text().catch(() => 'unknown')}` };
    }
    const data = (await res.json()) as { response?: string };
    summary = (data.response ?? '').trim();
    if (!summary) return { ok: false, reason: 'Ollama returned an empty summary' };
  } catch (err) {
    return { ok: false, reason: `Ollama call failed: ${String(err)}` };
  }

  const provenance = `homework:forage_eblet:${label}:${Date.now()}`;

  const mintResult = await mintForageEblet({
    sourceLabel: label,
    sourcePath: source_path,
    model,
    summary,
    provenance,
  });

  if (!mintResult.ok) {
    return { ok: false, reason: mintResult.reason };
  }

  return { ok: true, provenance, ebletPath: mintResult.path };
}

async function runHomeworkJob(item: HomeworkItem): Promise<ForageResult> {
  switch (item.frontmatter.job_type) {
    case 'forage_eblet':
      return runForageEbletJob(item);
    default: {
      // Exhaustiveness guard — HomeworkJobTypeSchema is a single-member enum today; this branch
      // is unreachable until a second job type is added (Bishop review gate per task spec).
      const neverType: never = item.frontmatter.job_type;
      return { ok: false, reason: `Unknown job_type: ${String(neverType)}` };
    }
  }
}

// ─── Sweep ──────────────────────────────────────────────────────────────────────

async function runHomeworkSweep(): Promise<void> {
  if (!isHomeworkEnabled()) return; // OFF by default — no-op every tick until the user opts in

  if (isOnBatteryPower()) {
    return; // silent — this is the expected common case on laptops, not worth logging every minute
  }

  const { idle, idleSeconds } = isSystemIdleEnough();
  if (!idle) return; // silent — same reasoning as battery gate

  if (!isAppFreeForHomework()) {
    console.log('[homework] system idle but app busy (Ask in flight or scored mesh-test running) — skipping this tick');
    return;
  }

  const jobs = listReadyHomeworkJobs();
  if (jobs.length === 0) return;

  const job = jobs[0];
  const idleMinutes = Math.floor(idleSeconds / 60);

  // Re-check the busy/idle gates were still true immediately before starting — cheap and closes
  // the small race window between listReadyHomeworkJobs()'s directory scan and the actual run.
  if (!isAppFreeForHomework() || isOnBatteryPower()) {
    console.log('[homework] gate flipped just before dispatch — skipping this tick, will retry next sweep');
    return;
  }

  try {
    const result = await runHomeworkJob(job);
    if (result.ok) {
      moveHomeworkFileToFired(job, homeworkFiredDir());
      console.log(
        `[homework] idle ${idleMinutes}min, ran ${job.frontmatter.job_type} on ${job.frontmatter.source_path}, ` +
        `minted ${result.ebletPath ?? result.provenance}, $0`,
      );
    } else {
      markHomeworkFailed(job, result.reason ?? 'unknown failure');
      console.warn(`[homework] job ${job.frontmatter.homework_id} FAILED: ${result.reason}`);
    }
  } catch (err) {
    // Belt-and-suspenders: runHomeworkJob()'s job-type implementations are themselves supposed
    // to fail soft and return { ok:false }, but an uncaught throw must never crash the loop or
    // silently drop the job — mark it FAILED so it stays visible for triage.
    markHomeworkFailed(job, `Uncaught error: ${String(err)}`);
    console.error(`[homework] job ${job.frontmatter.homework_id} threw:`, err);
  }
  // Deliberately does NOT loop to a second job in the same tick — "run ONE job at a time,
  // fully interruptible" per spec. The next setInterval tick re-checks all gates from scratch.
}

// ─── Boot wiring (mirrors mesh_diff_loop.ts's startX()/stopX() shape) ─────────

export function startHomeworkLoop(): void {
  if (homeworkLoopTimer) return; // already running
  console.log('[homework] Starting — 60s gate-check interval · OFF by default until homework_enabled=true');
  setTimeout(() => {
    runHomeworkSweep().catch((e: Error) => console.error('[homework] initial sweep error:', e));
  }, 5000);
  homeworkLoopTimer = setInterval(() => {
    runHomeworkSweep().catch((e: Error) => console.error('[homework] sweep error:', e));
  }, SWEEP_INTERVAL_MS);
}

export function stopHomeworkLoop(): void {
  if (homeworkLoopTimer) {
    clearInterval(homeworkLoopTimer);
    homeworkLoopTimer = null;
    console.log('[homework] Stopped');
  }
}
