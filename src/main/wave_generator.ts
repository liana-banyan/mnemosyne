// AMPLIFY Computer — Wave Generator Daemon (B61 Phase A+B+C / LB-STACK-0164 §1–§3, §4)
// Phase A: six core operations with inline SEG decomposition
// Phase B: six versioned HMAC-bound wave templates (LB-STACK-0164 §3)
// Phase C: post-synthesis hook registry for Class D cascade triggers (LB-STACK-0164 §4)
//
// Core operations (§1):
//   1. Receive   — POST /yoke/wave/dispatch
//   2. Decompose — inline SEG array OR template-based expansion (Phase B)
//   3. Dispatch  — N parallel Yoke calls (Knight/Bishop/Pawn/Rook)
//   4. Watch     — per-SEG progress log in wave_active/{wave_id}/seg_NN_progress/
//   5. Synthesize — synthesis SEG (Sonnet 4.6 default) with all N receipts
//   6. Report    — HMAC-bound synthesis_receipt.eblet.md in wave_archive/{wave_id}/
//
// Six named templates (§3):
//   1. 4_way_cohort@v1            — 4 parallel Pawn calls, Bishop synthesis
//   2. 8_seg_multi_scope@v1       — 8 parallel Bishop SEGs, cross-domain synthesis
//   3. n_track_math_test@v1       — N parallel cross-vendor flagship dispatches
//   4. high_vs_low@v1             — 2 parallel tiers, equivalence-metric synthesis
//   5. cross_vendor_verification@v1 — N parallel cross-vendor, agreement metric
//   6. recursive_drill_down@v1    — depth-bounded tree, hierarchical synthesis
//
// Substrate paths (L2 per canon §5):
//   ~/.lb_substrate/wave_queue/     — queued requests
//   ~/.lb_substrate/wave_active/    — in-flight waves + per-SEG progress
//   ~/.lb_substrate/wave_archive/   — completed waves + synthesis Eblet + HMAC
//   ~/.lb_substrate/wave_templates/ — versioned template definitions (Phase B)
//
// Crash-restart resilience (canon §9): init scans wave_active/ and marks any
// waves that were mid-flight as 'aborted' (async HTTP calls cannot be resumed).
//
// Canon anchor: LB-STACK-0164 §1–§3, §5, §6, §9, §10

import {
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  appendFileSync,
} from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { randomUUID, createHmac, createHash } from 'crypto';

// Layer 2+3: Adaptive Concurrency Carrier
import { getCachedCap, probeIfStale } from './concurrency_probe';

// ─── Substrate paths ──────────────────────────────────────────────────────────

export const LB_SUBSTRATE_ROOT =
  process.env.LB_SUBSTRATE_ROOT ?? resolve(homedir(), '.lb_substrate');

export const WAVE_QUEUE_DIR     = resolve(LB_SUBSTRATE_ROOT, 'wave_queue');
export const WAVE_ACTIVE_DIR    = resolve(LB_SUBSTRATE_ROOT, 'wave_active');
export const WAVE_ARCHIVE_DIR   = resolve(LB_SUBSTRATE_ROOT, 'wave_archive');
export const WAVE_TEMPLATES_DIR = resolve(LB_SUBSTRATE_ROOT, 'wave_templates');

/** Yoke server base (Phase 0 endpoints). */
const YOKE_BASE = `http://127.0.0.1:${process.env.SUBSTRATE_API_PORT ?? '11480'}`;

/** HMAC signing key for wave receipts. Rotate via env or leave at default. */
const WAVE_HMAC_KEY =
  process.env.LB_WAVE_HMAC_KEY ?? 'lb-wave-hmac-phase-a-default-key';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SegRecipient = 'pawn' | 'rook' | 'knight' | 'bishop';
export type WaveStatus   = 'queued' | 'running' | 'synthesizing' | 'complete' | 'aborted';
export type SegStatus    = 'pending' | 'dispatched' | 'done' | 'error';

export interface SegConfig {
  /** Short identifier — e.g. "seg_01". Generated if omitted. */
  seg_id?: string;
  recipient: SegRecipient;
  prompt: string;
  /** Optional context messages forwarded to Pawn/Rook. */
  context_msgs?: Array<{ role: string; content: string }>;
}

export interface WaveRequest {
  /** Caller-supplied; generated if absent. */
  wave_id?: string;
  /** Human-readable label / canon anchor. */
  anchor: string;
  /**
   * Phase A: inline decomposition — pre-formed SEG array.
   * Phase B: omit when using template_name + params.
   */
  segs?: SegConfig[];
  /**
   * Phase B: named template from wave_templates/ (e.g. "4_way_cohort@v1").
   * When set, `params` supplies the parameter binding.
   */
  template_name?: string;
  /** Phase B: parameter bindings for the named template. */
  params?: Record<string, unknown>;
  /**
   * Synthesis prompt sent to the synthesis SEG.
   * Use `{receipts}` as the placeholder for the concatenated SEG replies.
   * Defaults to template synthesis_shape or standard summary template.
   */
  synthesis_prompt?: string;
  /** Override synthesis SEG recipient. Default: template synthesis_shape or 'knight'. */
  synthesis_recipient?: SegRecipient;
  /**
   * Layer 1 — Adaptive Concurrency Carrier: work-plan declaration.
   * Ideal SEG count the payload declares (not constrained by dispatch shape).
   * Wave fails if concurrency cap < acceptable_min.
   */
  seg_count_target?: number;
  /** Layer 1: minimum acceptable cap floor. Wave is aborted below this. */
  acceptable_min?: number;
}

// ─── Wave Template Types (Phase B / LB-STACK-0164 §3) ────────────────────────

export interface SegTemplateSpec {
  seg_id: string;
  /** Literal SegRecipient or param reference like "{param}". */
  recipient: string;
  prompt_template: string;
}

export interface SegExpandSpec {
  /** Parameter name that holds the array to iterate over. */
  from_param: string;
  /** Template for seg_id — may use {i} and {i02}. */
  seg_id_template: string;
  /** Literal recipient or "{item}" to use array element. */
  recipient_template: string;
  /** Prompt template — may use {item}, {i}, {i02} and any wave params. */
  prompt_template: string;
}

export interface SynthesisSpec {
  /** Literal SegRecipient. */
  recipient: string;
  /** Prompt template with {receipts} placeholder + any wave params. */
  prompt_template: string;
}

export interface WaveTemplateSpec {
  template_name: string;
  version: string;
  description: string;
  empirical_anchor: string;
  canon_anchor: string;
  /** JSON Schema (informational; used to apply defaults). */
  parameter_schema: {
    type: string;
    properties?: Record<string, { type?: string; description?: string; default?: unknown }>;
    required?: string[];
  };
  /** Fixed SEGs. Empty array when seg_expand handles all SEGs. */
  segs: SegTemplateSpec[];
  /** Variable-N SEG expansion. Absent for fixed-N templates. */
  seg_expand?: SegExpandSpec;
  synthesis: SynthesisSpec;
  authored_at: string;
  author: string;
  /** HMAC-SHA256 over serialized spec content (excluding this field). */
  hmac?: string;
}

export interface SegProgress {
  seg_id: string;
  recipient: SegRecipient;
  status: SegStatus;
  dispatch_id?: string;
  started_at: string;
  done_at?: string;
  reply?: string;
  error?: string;
}

export interface Wave {
  wave_id: string;
  anchor: string;
  request: WaveRequest;
  status: WaveStatus;
  segs: SegProgress[];
  created_at: string;
  started_at?: string;
  synthesizing_at?: string;
  completed_at?: string;
  synthesis_text?: string;
  synthesis_receipt_path?: string;
  hmac?: string;
  error?: string;
  /** Path to this wave's active directory (during running) or archive dir (after complete). */
  dir?: string;
}

// ─── In-memory store ──────────────────────────────────────────────────────────

const _waves = new Map<string, Wave>();

// ─── Phase C — Post-Synthesis Hook Registry ───────────────────────────────────

type PostSynthesisHook = (waveId: string, anchor: string, synthesisText: string) => void;
const _postSynthesisHooks: PostSynthesisHook[] = [];

/**
 * Register a callback to be invoked after every wave synthesis completes.
 * Used by the Trigger Engine (Phase C) for Class D cascade detection.
 * Multiple hooks may be registered; all are called in order.
 */
export function registerPostSynthesisHook(hook: PostSynthesisHook): void {
  _postSynthesisHooks.push(hook);
}

// ─── Filesystem helpers ───────────────────────────────────────────────────────

function ensureSubstrateDirs(): void {
  for (const d of [WAVE_QUEUE_DIR, WAVE_ACTIVE_DIR, WAVE_ARCHIVE_DIR, WAVE_TEMPLATES_DIR]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

function waveQueuePath(waveId: string): string {
  return resolve(WAVE_QUEUE_DIR, `${waveId}.wave.json`);
}

function waveActivePath(waveId: string): string {
  return resolve(WAVE_ACTIVE_DIR, waveId);
}

function waveArchivePath(waveId: string): string {
  return resolve(WAVE_ARCHIVE_DIR, waveId);
}

function saveWaveJson(wave: Wave): void {
  const dir = wave.status === 'complete' || wave.status === 'aborted'
    ? waveArchivePath(wave.wave_id)
    : waveActivePath(wave.wave_id);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'wave.json'), JSON.stringify(wave, null, 2), 'utf8');
}

function logSegProgress(wave: Wave, seg: SegProgress, event: string): void {
  const activeDir = waveActivePath(wave.wave_id);
  const segDir    = resolve(activeDir, `${seg.seg_id}_progress`);
  if (!existsSync(segDir)) mkdirSync(segDir, { recursive: true });
  const line = JSON.stringify({ event, seg_id: seg.seg_id, status: seg.status, ts: new Date().toISOString() });
  appendFileSync(resolve(segDir, 'events.jsonl'), line + '\n', 'utf8');
}

function hmacSign(payload: string): string {
  return createHmac('sha256', WAVE_HMAC_KEY).update(payload, 'utf8').digest('hex');
}

function contentSha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 32);
}

// ─── Phase B — Template Engine (LB-STACK-0164 §3) ────────────────────────────

/**
 * Interpolate `{param}` and `{param[N]}` references in a template string.
 * - `{param}` → string value; arrays joined with ", "
 * - `{param[N]}` → Nth element of array param
 */
function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)(?:\[(\d+)\])?\}/g, (match, key: string, indexStr?: string) => {
    const val = params[key];
    if (val === undefined) return match;
    if (indexStr !== undefined) {
      if (!Array.isArray(val)) return match;
      const item = val[parseInt(indexStr, 10)];
      return item !== undefined ? String(item) : match;
    }
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  });
}

/** Apply parameter_schema defaults for any missing params. */
function applySchemaDefaults(
  params: Record<string, unknown>,
  schema: WaveTemplateSpec['parameter_schema'],
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...params };
  const props = schema.properties ?? {};
  for (const [key, def] of Object.entries(props)) {
    if (result[key] === undefined && def.default !== undefined) {
      result[key] = def.default;
    }
  }
  return result;
}

/** Expand a template spec + bound params into a concrete SegConfig array + synthesis config. */
function decomposeFromTemplate(
  spec: WaveTemplateSpec,
  rawParams: Record<string, unknown>,
): { segs: SegConfig[]; synthRecipient: SegRecipient; synthPromptTemplate: string } {
  const params = applySchemaDefaults(rawParams, spec.parameter_schema);
  const segs: SegConfig[] = [];

  // Fixed SEGs
  for (const s of spec.segs) {
    segs.push({
      seg_id:    interpolate(s.seg_id, params),
      recipient: interpolate(s.recipient, params) as SegRecipient,
      prompt:    interpolate(s.prompt_template, params),
    });
  }

  // Variable-N expansion
  if (spec.seg_expand) {
    const { from_param, seg_id_template, recipient_template, prompt_template } = spec.seg_expand;
    const arr = params[from_param];
    if (!Array.isArray(arr)) {
      throw new Error(
        `Template "${spec.template_name}@${spec.version}": param "${from_param}" must be an array`,
      );
    }
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i] as unknown;
      const segParams: Record<string, unknown> = {
        ...params,
        item:  String(item),
        i:     String(i),
        i02:   String(i).padStart(2, '0'),
      };
      segs.push({
        seg_id:    interpolate(seg_id_template, segParams),
        recipient: interpolate(recipient_template, segParams) as SegRecipient,
        prompt:    interpolate(prompt_template, segParams),
      });
    }
  }

  if (segs.length === 0) {
    throw new Error(`Template "${spec.template_name}@${spec.version}": produced zero SEGs`);
  }

  const synthRecipient = interpolate(spec.synthesis.recipient, params) as SegRecipient;
  const synthPromptTemplate = interpolate(spec.synthesis.prompt_template, params);

  return { segs, synthRecipient, synthPromptTemplate };
}

/**
 * Load a named template from wave_templates/.
 * Name format: "4_way_cohort@v1" or just "4_way_cohort" (defaults to @v1).
 */
export function loadTemplate(name: string): WaveTemplateSpec {
  const resolved = name.includes('@') ? name : `${name}@v1`;
  const tmplPath = resolve(WAVE_TEMPLATES_DIR, `${resolved}.tmpl.json`);
  if (!existsSync(tmplPath)) {
    throw new Error(`Wave template not found: "${resolved}" (looked at ${tmplPath})`);
  }
  const raw  = readFileSync(tmplPath, 'utf8');
  const spec = JSON.parse(raw) as WaveTemplateSpec;

  // HMAC verification (warn on mismatch, do not block)
  if (spec.hmac) {
    const { hmac: _hmac, ...rest } = spec;
    const expected = hmacSign(JSON.stringify(rest));
    if (spec.hmac !== expected) {
      console.warn(
        `[wave-generator] WARNING: template "${resolved}" HMAC mismatch — verify file integrity`,
      );
    }
  }

  return spec;
}

/** List all installed template names (without .tmpl.json extension). */
export function listTemplates(): string[] {
  if (!existsSync(WAVE_TEMPLATES_DIR)) return [];
  return readdirSync(WAVE_TEMPLATES_DIR)
    .filter(f => f.endsWith('.tmpl.json'))
    .map(f => f.replace('.tmpl.json', ''));
}

/** Expand template → concrete segs + synthesis config, mutating req in place. */
function expandTemplateIntoRequest(req: WaveRequest): void {
  if (!req.template_name) return;
  const spec     = loadTemplate(req.template_name);
  const expanded = decomposeFromTemplate(spec, req.params ?? {});
  req.segs                = expanded.segs;
  req.synthesis_prompt    = req.synthesis_prompt    ?? expanded.synthPromptTemplate;
  req.synthesis_recipient = req.synthesis_recipient ?? expanded.synthRecipient;
}

// ─── Operation 1 — RECEIVE / INIT ─────────────────────────────────────────────

/**
 * Crash-restart resilience (canon §9).
 * On startup: load all waves from disk. Any that were `running` or `synthesizing`
 * (mid-flight HTTP calls that can't be resumed) are marked `aborted`.
 */
export function initWaveGenerator(): void {
  ensureSubstrateDirs();
  // Phase B: register built-in templates (idempotent; skips existing)
  try {
    // Dynamic import to avoid circular dep; module is always present in dist/
    const writerPath = resolve(__dirname, 'wave_template_writer.js');
    if (existsSync(writerPath)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { registerBuiltInTemplates } = require(writerPath) as {
        registerBuiltInTemplates: (dir: string) => void;
      };
      registerBuiltInTemplates(WAVE_TEMPLATES_DIR);
    }
  } catch (e) {
    console.warn('[wave-generator] could not register built-in templates:', e);
  }

  // Scan wave_active/ for abandoned waves
  const activeEntries = readdirSync(WAVE_ACTIVE_DIR);
  for (const entry of activeEntries) {
    const waveJsonPath = resolve(WAVE_ACTIVE_DIR, entry, 'wave.json');
    if (!existsSync(waveJsonPath)) continue;
    try {
      const wave = JSON.parse(readFileSync(waveJsonPath, 'utf8')) as Wave;
      if (wave.status === 'running' || wave.status === 'synthesizing') {
        wave.status = 'aborted';
        wave.error  = 'aborted on daemon restart (in-flight waves cannot be resumed)';
        // Move to archive
        const archiveDir = waveArchivePath(wave.wave_id);
        if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true });
        writeFileSync(resolve(archiveDir, 'wave.json'), JSON.stringify(wave, null, 2), 'utf8');
      }
      _waves.set(wave.wave_id, wave);
    } catch {
      // skip malformed entries
    }
  }

  // Also load completed waves from archive (for status queries)
  const archiveEntries = readdirSync(WAVE_ARCHIVE_DIR);
  for (const entry of archiveEntries) {
    if (_waves.has(entry)) continue;
    const waveJsonPath = resolve(WAVE_ARCHIVE_DIR, entry, 'wave.json');
    if (!existsSync(waveJsonPath)) continue;
    try {
      const wave = JSON.parse(readFileSync(waveJsonPath, 'utf8')) as Wave;
      _waves.set(wave.wave_id, wave);
    } catch {
      // skip malformed entries
    }
  }

  console.log(`[wave-generator] init complete — ${_waves.size} wave(s) loaded from substrate`);

  // Layer 2: boot-time concurrency cap probe (non-blocking; skips if cache is fresh)
  setImmediate(() => {
    probeIfStale().catch((err) =>
      console.warn('[wave-generator] boot concurrency probe failed (non-fatal):', err),
    );
  });
}

// ─── Operation 2 — DECOMPOSE ──────────────────────────────────────────────────

/**
 * Normalise the (already-expanded) `segs` array into SegProgress records.
 * Phase B template expansion happens upstream in dispatchWave before this runs.
 */
function decomposeRequest(req: WaveRequest): SegProgress[] {
  return (req.segs ?? []).map((s, i) => ({
    seg_id:   s.seg_id ?? `seg_${String(i + 1).padStart(2, '0')}`,
    recipient: s.recipient,
    status:    'pending' as const,
    started_at: new Date().toISOString(),
  }));
}

// ─── Layer 3: Retry-on-empty helpers (R17 SHOW-RESULTS at content layer) ──────

/** Minimum character count for a reply to be considered substantive. */
const CONTENT_SUBSTANTIVE_MIN = 100;

function isSubstantiveReply(reply: string): boolean {
  return reply.trim().length >= CONTENT_SUBSTANTIVE_MIN && reply !== '(no reply)';
}

const SEG_RETRY_MAX    = 3;
const SEG_RETRY_DELAYS = [1_000, 2_000, 4_000] as const;

async function sleepMs(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ─── Operation 3 — DISPATCH (per-SEG) ────────────────────────────────────────

/**
 * Dispatch one SEG via the appropriate Phase 0 Yoke endpoint.
 * Returns the raw reply text.
 */
async function dispatchSeg(
  seg: SegProgress,
  segConfig: SegConfig,
  waveId: string,
): Promise<string> {
  const dispatchId = randomUUID();
  seg.dispatch_id  = dispatchId;
  seg.status       = 'dispatched';

  if (seg.recipient === 'pawn') {
    const body = JSON.stringify({
      dispatch_id: dispatchId,
      session:     `wave-${waveId}`,
      prompt:      segConfig.prompt,
      context_msgs: segConfig.context_msgs ?? [],
    });
    const res  = await fetch(`${YOKE_BASE}/yoke/pawn/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) throw new Error(`Pawn dispatch HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { reply?: string; error?: string };
    if (data.error) throw new Error(`Pawn dispatch error: ${data.error}`);
    return data.reply ?? '(no reply)';
  }

  if (seg.recipient === 'rook') {
    const body = JSON.stringify({
      dispatch_id: dispatchId,
      session:     `wave-${waveId}`,
      prompt:      segConfig.prompt,
    });
    const res  = await fetch(`${YOKE_BASE}/yoke/rook/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) throw new Error(`Rook dispatch HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { reply?: string; error?: string };
    if (data.error) throw new Error(`Rook dispatch error: ${data.error}`);
    return data.reply ?? '(no reply)';
  }

  if (seg.recipient === 'knight' || seg.recipient === 'bishop') {
    // Knight + Bishop both use Anthropic claude-sonnet-4-5.
    // Bishop role is a dispatch-class distinction (synthesis authoring), not a model switch.
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error(`ANTHROPIC_API_KEY not set for ${seg.recipient} SEG`);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5',
        max_tokens: 4096,
        messages:   [{ role: 'user', content: segConfig.prompt }],
      }),
    });
    if (!res.ok) throw new Error(`${seg.recipient} dispatch HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content?: Array<{ text?: string }>; error?: { message?: string } };
    if (data.error) throw new Error(`${seg.recipient} dispatch error: ${data.error.message}`);
    return data.content?.[0]?.text ?? '(no reply)';
  }

  throw new Error(`Unknown SEG recipient: ${seg.recipient as string}`);
}

/**
 * Layer 3: dispatch a SEG with retry-on-empty (exponential backoff).
 * Retries up to SEG_RETRY_MAX times if reply is null/empty/"(no reply)".
 * Throws after max retries with a content-empty error (distinct from HTTP error).
 * This ensures Drekaskip status='error' (not 'done') for empty-content failures — R17.
 */
async function dispatchSegWithRetry(
  seg: SegProgress,
  segConfig: SegConfig,
  waveId: string,
): Promise<string> {
  for (let attempt = 0; attempt <= SEG_RETRY_MAX; attempt++) {
    if (attempt > 0) {
      const delay = SEG_RETRY_DELAYS[attempt - 1] ?? 4_000;
      console.warn(
        `[wave-generator] SEG ${seg.seg_id} empty reply (attempt ${attempt}/${SEG_RETRY_MAX}) — retrying in ${delay}ms`,
      );
      await sleepMs(delay);
    }

    try {
      const reply = await dispatchSeg(seg, segConfig, waveId);
      if (isSubstantiveReply(reply)) return reply;
      // dispatch-OK but content-empty — loop to retry
    } catch (err) {
      if (attempt < SEG_RETRY_MAX) {
        console.warn(
          `[wave-generator] SEG ${seg.seg_id} dispatch error (attempt ${attempt + 1}) — will retry:`,
          String(err),
        );
        continue;
      }
      throw new Error(
        `dispatch failed after ${SEG_RETRY_MAX + 1} attempts: ${String(err)}`,
      );
    }
  }

  // All retries exhausted with empty content
  throw new Error(
    `content-empty after ${SEG_RETRY_MAX + 1} attempts — dispatch-OK but no substantive reply ` +
    `(API concurrency throttle suspected; probe cap via Drekaskip panel)`,
  );
}

// ─── Operations 4–6 — WATCH / SYNTHESIZE / REPORT (wave lifecycle) ────────────

const DEFAULT_SYNTHESIS_PROMPT =
  'You are a synthesis engine. The following SEG (sub-execution-group) replies have been ' +
  'collected from a parallel wave dispatch. Synthesize them into a coherent, structured summary.\n\n' +
  '--- SEG RECEIPTS ---\n{receipts}\n--- END RECEIPTS ---\n\n' +
  'Provide a synthesis that integrates all SEG outputs.';

async function runWaveLifecycle(wave: Wave, req: WaveRequest): Promise<void> {
  // ── Layer 1: acceptable_min cap gate ──────────────────────────────────────
  if (req.acceptable_min !== undefined && req.acceptable_min > 0) {
    const cap = getCachedCap();
    if (cap < req.acceptable_min) {
      wave.status = 'aborted';
      wave.error  =
        `Concurrency cap (${cap}) is below acceptable_min (${req.acceptable_min}) — wave aborted. ` +
        `Re-probe via Drekaskip panel or lower acceptable_min in the canonical payload.`;
      saveWaveJson(wave);
      _waves.set(wave.wave_id, wave);
      console.warn(`[wave-generator] wave ${wave.wave_id} aborted: cap ${cap} < acceptable_min ${req.acceptable_min}`);
      return;
    }
  }

  // ── RUNNING: Operation 4 — WATCH (parallel or rolling-window dispatch) ────
  wave.status     = 'running';
  wave.started_at = new Date().toISOString();
  saveWaveJson(wave);

  const segConfigs = (req.segs ?? []).map((s, i) => ({
    ...s,
    seg_id: wave.segs[i]!.seg_id,
  }));

  // Layer 3: dispatch task builder (retry-on-empty; status='error' on content-empty after retries)
  function makeDispatchTask(seg: SegProgress, idx: number): Promise<void> {
    logSegProgress(wave, seg, 'STARTED');
    return dispatchSegWithRetry(seg, segConfigs[idx]!, wave.wave_id)
      .then((reply) => {
        seg.status  = 'done';
        seg.reply   = reply;
        seg.done_at = new Date().toISOString();
        logSegProgress(wave, seg, 'DONE');
        saveWaveJson(wave);
      })
      .catch((err: unknown) => {
        // Includes content-empty error — surfaces as 'error', not silently 'done'
        seg.status  = 'error';
        seg.error   = String(err);
        seg.done_at = new Date().toISOString();
        logSegProgress(wave, seg, 'ERROR');
        saveWaveJson(wave);
      });
  }

  // Layer 2: rolling-window dispatch when seg count exceeds concurrency cap
  const cap      = getCachedCap();
  const segCount = wave.segs.length;

  if (segCount <= cap) {
    // All parallel (cap is sufficient)
    await Promise.all(wave.segs.map((seg, i) => makeDispatchTask(seg, i)));
  } else {
    // Rolling windows of `cap` size
    console.log(
      `[wave-generator] wave ${wave.wave_id}: ${segCount} SEGs > cap ${cap} — using rolling windows`,
    );
    for (let start = 0; start < segCount; start += cap) {
      const end    = Math.min(start + cap, segCount);
      const window = wave.segs.slice(start, end);
      await Promise.all(window.map((seg, wi) => makeDispatchTask(seg, start + wi)));
      console.log(`[wave-generator] window ${start}–${end - 1} complete`);
    }
  }

  const allDone = wave.segs.every(s => s.status === 'done' || s.status === 'error');
  if (!allDone) {
    wave.status = 'aborted';
    wave.error  = 'not all SEGs completed';
    saveWaveJson(wave);
    _waves.set(wave.wave_id, wave);
    return;
  }

  // ── SYNTHESIZING: Operation 5 — SYNTHESIZE ───────────────────────────────
  wave.status          = 'synthesizing';
  wave.synthesizing_at = new Date().toISOString();
  saveWaveJson(wave);

  const receiptsBlock = wave.segs
    .map(s =>
      `[${s.seg_id}] (${s.recipient}) ${s.status === 'done' ? s.reply : `ERROR: ${s.error}`}`,
    )
    .join('\n\n');

  const synthPromptTemplate = req.synthesis_prompt ?? DEFAULT_SYNTHESIS_PROMPT;
  const synthPrompt         = synthPromptTemplate.replace('{receipts}', receiptsBlock);
  const synthRecipient      = req.synthesis_recipient ?? 'knight';
  const synthSegId          = 'seg_synth';

  const synthSeg: SegProgress = {
    seg_id:     synthSegId,
    recipient:  synthRecipient,
    status:     'pending',
    started_at: new Date().toISOString(),
  };

  let synthesisText = '';
  try {
    const synthSegConfig: SegConfig = {
      seg_id:    synthSegId,
      recipient: synthRecipient,
      prompt:    synthPrompt,
    };
    synthSeg.status = 'dispatched';
    synthesisText   = await dispatchSeg(synthSeg, synthSegConfig, wave.wave_id);
    synthSeg.status  = 'done';
    synthSeg.reply   = synthesisText;
    synthSeg.done_at = new Date().toISOString();
  } catch (err: unknown) {
    synthSeg.status  = 'error';
    synthSeg.error   = String(err);
    synthSeg.done_at = new Date().toISOString();
    synthesisText    = `[synthesis error: ${String(err)}]`;
  }

  wave.synthesis_text = synthesisText;

  // Phase C — Class D cascade: notify post-synthesis hooks
  for (const hook of _postSynthesisHooks) {
    try { hook(wave.wave_id, wave.anchor, synthesisText); } catch { /* non-fatal */ }
  }

  // ── COMPLETE: Operation 6 — REPORT ────────────────────────────────────────
  wave.status       = 'complete';
  wave.completed_at = new Date().toISOString();

  // Build the HMAC-signed synthesis_receipt.eblet.md
  const ebletContent = buildEblet(wave, synthSeg);
  const ebletHmac    = hmacSign(ebletContent);
  wave.hmac          = ebletHmac;

  // Write to wave_archive/{wave_id}/
  const archiveDir = waveArchivePath(wave.wave_id);
  if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true });

  const ebletPath = resolve(archiveDir, 'synthesis_receipt.eblet.md');
  writeFileSync(ebletPath, ebletContent, 'utf8');
  writeFileSync(resolve(archiveDir, 'wave.hmac'), ebletHmac, 'utf8');
  wave.synthesis_receipt_path = ebletPath;
  wave.dir = archiveDir;

  // Final wave.json goes to archive
  writeFileSync(resolve(archiveDir, 'wave.json'), JSON.stringify(wave, null, 2), 'utf8');

  _waves.set(wave.wave_id, wave);
  console.log(`[wave-generator] wave ${wave.wave_id} COMPLETE (${wave.segs.length} SEGs + synthesis)`);
}

function buildEblet(wave: Wave, synthSeg: SegProgress): string {
  const segSummary = wave.segs
    .map(
      s =>
        `### ${s.seg_id} (${s.recipient}) — ${s.status}\n` +
        (s.status === 'done'
          ? `**Reply excerpt:** ${(s.reply ?? '').slice(0, 300)}${(s.reply ?? '').length > 300 ? '…' : ''}`
          : `**Error:** ${s.error}`),
    )
    .join('\n\n');

  const contentHash = contentSha256(wave.synthesis_text ?? '');

  const templateLine = wave.request.template_name
    ? `**Template:** ${wave.request.template_name}\n`
    : '';

  return `# Wave Synthesis Receipt — ${wave.wave_id}
**Anchor:** ${wave.anchor}
${templateLine}**Wave Status:** ${wave.status}
**Created:** ${wave.created_at}
**Completed:** ${wave.completed_at ?? 'N/A'}
**SEG Count:** ${wave.segs.length}
**Synthesis SEG:** ${synthSeg.seg_id} (${synthSeg.recipient}) — ${synthSeg.status}
**Synthesis Content Hash:** ${contentHash}

---

## SEG Receipts

${segSummary}

---

## Synthesis

${wave.synthesis_text ?? '(none)'}

---

*B61 Phase A+B+C Wave Generator — LB-STACK-0164 §1–§4. Aircraft Carrier holds. Substrate compounds.*
`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Dispatch a new wave. Returns the Wave immediately (status = queued);
 * execution proceeds asynchronously.
 */
export async function dispatchWave(req: WaveRequest): Promise<Wave> {
  ensureSubstrateDirs();

  // Phase B: expand template into inline segs if template_name provided
  if (req.template_name) {
    expandTemplateIntoRequest(req);
  }

  const waveId = req.wave_id ?? `wave-${randomUUID()}`;

  if (!req.segs || req.segs.length === 0) {
    throw new Error('wave request must contain at least one SEG (provide segs[] or template_name)');
  }

  const segs   = decomposeRequest(req);
  const now    = new Date().toISOString();

  const wave: Wave = {
    wave_id:    waveId,
    anchor:     req.anchor,
    request:    req,
    status:     'queued',
    segs,
    created_at: now,
  };

  _waves.set(waveId, wave);

  // Persist request to wave_queue/ immediately (crash point A safety)
  writeFileSync(
    waveQueuePath(waveId),
    JSON.stringify({
      waveId,
      anchor:        req.anchor,
      template_name: req.template_name ?? null,
      segs:          (req.segs ?? []).length,
      queued_at:     now,
    }, null, 2),
    'utf8',
  );

  // Save initial wave.json to wave_active/{wave_id}/
  saveWaveJson(wave);

  // Launch async (non-blocking — HTTP response returns wave_id immediately)
  setImmediate(() => {
    runWaveLifecycle(wave, req).catch((err: unknown) => {
      wave.status = 'aborted';
      wave.error  = String(err);
      saveWaveJson(wave);
      console.error(`[wave-generator] wave ${waveId} aborted:`, err);
    });
  });

  return wave;
}

/** Get current wave status by wave_id. Returns null if not found. */
export function getWave(waveId: string): Wave | null {
  return _waves.get(waveId) ?? null;
}

/**
 * Abort an in-flight wave. Sets status = aborted; cannot cancel in-flight HTTP.
 * Returns true if wave existed and was abortable.
 */
export function abortWave(waveId: string): boolean {
  const wave = _waves.get(waveId);
  if (!wave) return false;
  if (wave.status === 'complete' || wave.status === 'aborted') return false;
  wave.status = 'aborted';
  wave.error  = 'aborted by operator request';
  saveWaveJson(wave);
  return true;
}

/** Recent activity summary for /healthz. */
export function getWaveSummary(): {
  total: number;
  complete: number;
  running: number;
  queued: number;
  aborted: number;
  last_wave_id: string | null;
} {
  const all   = [..._waves.values()];
  const sorted = all.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return {
    total:        all.length,
    complete:     all.filter(w => w.status === 'complete').length,
    running:      all.filter(w => w.status === 'running' || w.status === 'synthesizing').length,
    queued:       all.filter(w => w.status === 'queued').length,
    aborted:      all.filter(w => w.status === 'aborted').length,
    last_wave_id: sorted[0]?.wave_id ?? null,
  };
}
