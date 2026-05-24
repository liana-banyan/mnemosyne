// AMPLIFY Computer — Wave Trigger Engine (B61 Phase C / LB-STACK-0164 §4)
//
// Four trigger classes that make Drekaskip ride waves automatically:
//
//   Class A — Anchor-triggered (synchronous):
//     Natural-language anchor parsing → structured WaveRequest compile
//     Endpoint: POST /yoke/wave/nl
//
//   Class B — Substrate-state-triggered (asynchronous):
//     Subscribe to pheromone routing events; fire pre-configured waves on
//     threshold-crossings.
//     Config: ~/.lb_substrate/wave_triggers/class_b_subscriptions.json
//
//   Class C — Scheduled (cron):
//     Time-based triggers fire periodic waves.
//     Config: ~/.lb_substrate/wave_triggers/class_c_schedules.json
//
//   Class D — Cascade-triggered (recursive):
//     Wave synthesis output contains <!-- fire-next: {...} --> directive;
//     generator reads + fires cascade wave automatically.
//     Registered via wave_generator.registerPostSynthesisHook
//
//   Dedup + debounce:
//     Any same-template-same-binding wave fired within the debounce window
//     collapses to a single dispatch (prevents trigger-storm).
//
// Canon anchor: LB-STACK-0164 §4, §10
// Authored: B61 Phase C (BP037, 2026-05-11)

import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { dispatchWave, registerPostSynthesisHook, type WaveRequest } from './wave_generator';

// ─── Paths ─────────────────────────────────────────────────────────────────

const LB_SUBSTRATE_ROOT =
  process.env.LB_SUBSTRATE_ROOT ?? resolve(homedir(), '.lb_substrate');

const WAVE_TRIGGERS_DIR     = resolve(LB_SUBSTRATE_ROOT, 'wave_triggers');
const CLASS_B_CONFIG_PATH   = resolve(WAVE_TRIGGERS_DIR, 'class_b_subscriptions.json');
const CLASS_C_CONFIG_PATH   = resolve(WAVE_TRIGGERS_DIR, 'class_c_schedules.json');
const TRIGGER_LOG_PATH      = resolve(WAVE_TRIGGERS_DIR, 'trigger_engine.log');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ClassBSubscription {
  id: string;
  /** Pheromone event type that activates this subscription. */
  event_type: string;
  /**
   * Optional threshold conditions — all keys must match the event payload
   * for this subscription to fire.
   */
  threshold?: Record<string, unknown>;
  template_name: string;
  /** Static parameter bindings; values prefixed "$event." are pulled from event payload. */
  params: Record<string, unknown>;
  /** Anchor string (supports "$event.summary" placeholder). */
  anchor_template: string;
  enabled: boolean;
  /** Debounce window in ms; 0 disables debounce for this subscription. */
  debounce_ms?: number;
}

export interface ClassCSchedule {
  id: string;
  /** Standard 5-field cron expression (min hour dom mon dow). */
  cron: string;
  template_name: string;
  params: Record<string, unknown>;
  anchor: string;
  enabled: boolean;
  /** Debounce window in ms; defaults to 0 (cron already has natural spacing). */
  debounce_ms?: number;
}

export interface TriggerFireReceipt {
  trigger_class: 'A' | 'B' | 'C' | 'D';
  trigger_id: string;
  template_name: string;
  wave_id: string;
  anchor: string;
  fired_at: string;
}

// ─── Dedup / Debounce Registry ───────────────────────────────────────────────

/** last-fired epoch ms per dedup key */
const _dedupeRegistry = new Map<string, number>();

/** Default debounce window: 60 seconds */
export const DEFAULT_DEBOUNCE_MS = 60_000;

function dedupeKey(templateName: string, params: Record<string, unknown>): string {
  const stable = JSON.stringify(params, Object.keys(params).sort());
  const hash   = createHash('sha256').update(stable).digest('hex').slice(0, 16);
  return `${templateName}|${hash}`;
}

/**
 * Returns true if the trigger should fire (outside debounce window).
 * Side-effect: updates the registry timestamp when returning true.
 */
function shouldFire(
  templateName: string,
  params: Record<string, unknown>,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): boolean {
  if (debounceMs === 0) return true;
  const key      = dedupeKey(templateName, params);
  const lastFired = _dedupeRegistry.get(key) ?? 0;
  const now      = Date.now();
  if (now - lastFired < debounceMs) {
    triggerLog(`[dedup] SUPPRESSED ${templateName} — debounce active (${Math.round((now - lastFired) / 1000)}s since last fire)`);
    return false;
  }
  _dedupeRegistry.set(key, now);
  return true;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function ensureTriggerDirs(): void {
  if (!existsSync(WAVE_TRIGGERS_DIR)) mkdirSync(WAVE_TRIGGERS_DIR, { recursive: true });
}

function triggerLog(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(`[wave-trigger] ${msg}`);
  try {
    const { appendFileSync } = require('fs') as typeof import('fs');
    appendFileSync(TRIGGER_LOG_PATH, line + '\n', 'utf8');
  } catch {
    // non-fatal
  }
}

/**
 * Resolve $event.fieldName placeholders in a value using the event payload.
 */
function resolveEventRef(value: unknown, eventPayload: Record<string, unknown>): unknown {
  if (typeof value === 'string' && value.startsWith('$event.')) {
    const field = value.slice('$event.'.length);
    return eventPayload[field] ?? value;
  }
  return value;
}

function resolveParams(
  params: Record<string, unknown>,
  eventPayload: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    resolved[k] = resolveEventRef(v, eventPayload);
  }
  return resolved;
}

async function fireTriggerWave(
  triggerClass: 'A' | 'B' | 'C' | 'D',
  triggerId: string,
  templateName: string,
  params: Record<string, unknown>,
  anchor: string,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): Promise<TriggerFireReceipt | null> {
  if (!shouldFire(templateName, params, debounceMs)) return null;

  const req: WaveRequest = {
    anchor,
    template_name: templateName,
    params,
  };

  try {
    const wave = await dispatchWave(req);
    const receipt: TriggerFireReceipt = {
      trigger_class: triggerClass,
      trigger_id:    triggerId,
      template_name: templateName,
      wave_id:       wave.wave_id,
      anchor,
      fired_at:      new Date().toISOString(),
    };
    triggerLog(
      `[class-${triggerClass}] FIRED trigger="${triggerId}" template="${templateName}" wave_id="${wave.wave_id}"`,
    );
    return receipt;
  } catch (err) {
    triggerLog(`[class-${triggerClass}] ERROR trigger="${triggerId}": ${String(err)}`);
    return null;
  }
}

// ─── Class A — Natural-Language Anchor Parsing ───────────────────────────────

interface NlPattern {
  template: string;
  paramKey: string;
  patterns: RegExp[];
  defaultPartitions?: string[];
}

const NL_PATTERNS: NlPattern[] = [
  {
    template: '4_way_cohort@v1',
    paramKey: 'root_question',
    patterns: [
      /(?:fire\s+)?(?:a\s+)?4[- ]?way\s+cohort\s+(?:on|about|for)\s+(.+)/i,
      /cohort\s+wave\s+(?:on|about|for)\s+(.+)/i,
      /(?:fire\s+)?4[- ]?partition\s+(?:on|about|for)\s+(.+)/i,
    ],
  },
  {
    template: '8_seg_multi_scope@v1',
    paramKey: 'domain',
    patterns: [
      /(?:fire\s+)?(?:an?\s+)?8[- ]?seg(?:\s+multi[- ]?scope)?\s+(?:on|about|for)\s+(.+)/i,
      /multi[- ]?scope\s+wave\s+(?:on|about|for)\s+(.+)/i,
    ],
  },
  {
    template: 'n_track_math_test@v1',
    paramKey: 'claim',
    patterns: [
      /(?:fire\s+)?(?:a\s+)?(?:math\s+test|n[- ]?track|convergence\s+test)\s+(?:on|about|for)\s+(.+)/i,
      /(?:fire\s+)?multi[- ]?vendor\s+(?:convergence|test)\s+(?:on|about|for)\s+(.+)/i,
    ],
  },
  {
    template: 'high_vs_low@v1',
    paramKey: 'prompt',
    patterns: [
      /(?:fire\s+)?(?:a\s+)?high[- ]?vs[- ]?low\s+(?:on|about|for)\s+(.+)/i,
      /equivalence\s+(?:test|wave)\s+(?:on|about|for)\s+(.+)/i,
    ],
  },
  {
    template: 'cross_vendor_verification@v1',
    paramKey: 'prompt',
    patterns: [
      /(?:fire\s+)?(?:a\s+)?cross[- ]?vendor\s+(?:verification|wave)\s+(?:on|about|for)\s+(.+)/i,
      /vendor\s+verification\s+(?:on|about|for)\s+(.+)/i,
    ],
  },
  {
    template: 'recursive_drill_down@v1',
    paramKey: 'root_topic',
    patterns: [
      /(?:fire\s+)?(?:a\s+)?(?:recursive\s+)?drill[- ]?down\s+(?:on|about|for)\s+(.+)/i,
      /(?:fire\s+)?branch\s+wave\s+(?:on|about|for)\s+(.+)/i,
    ],
  },
];

/**
 * Class A: Parse a casual natural-language phrase into a WaveRequest.
 *
 * Returns null if no pattern matches (caller should treat as unknown intent).
 *
 * Examples:
 *   "fire a 4-way cohort on cooperative-AI governance"
 *   → { template_name: "4_way_cohort@v1", params: { root_question: "cooperative-AI governance" }, anchor: "..." }
 *
 *   "cross-vendor verification on Creator equity math"
 *   → { template_name: "cross_vendor_verification@v1", params: { prompt: "Creator equity math" }, ... }
 */
export function parseNlWaveRequest(text: string): WaveRequest | null {
  const normalized = text.trim();
  if (!normalized) return null;

  for (const { template, paramKey, patterns } of NL_PATTERNS) {
    for (const re of patterns) {
      const m = normalized.match(re);
      if (m && m[1]) {
        const subject = m[1].trim().replace(/\.$/, '');
        return {
          anchor:        `[NL-class-A] ${template} — ${subject.slice(0, 80)}`,
          template_name: template,
          params:        { [paramKey]: subject },
        };
      }
    }
  }

  return null;
}

// ─── Class B — Substrate-State Triggered ─────────────────────────────────────

const DEFAULT_CLASS_B_CONFIG: ClassBSubscription[] = [
  {
    id:             'b_canon_eblet_spider',
    event_type:     'canon_eblet_landed',
    template_name:  'cross_vendor_verification@v1',
    params:         { prompt: '$event.summary' },
    anchor_template: '[class-B] canon-eblet cross-verify — $event.eblet_id',
    enabled:        true,
    debounce_ms:    120_000,
  },
  {
    id:             'b_crown_jewel_cohort',
    event_type:     'crown_jewel_bound',
    template_name:  '4_way_cohort@v1',
    params:         { root_question: '$event.summary' },
    anchor_template: '[class-B] crown-jewel 4-way cohort — $event.jewel_id',
    enabled:        true,
    debounce_ms:    120_000,
  },
  {
    id:             'b_stack_tier_1_verify',
    event_type:     'stack_ledger_tier_1',
    template_name:  'cross_vendor_verification@v1',
    params:         { prompt: '$event.summary' },
    anchor_template: '[class-B] stack-ledger tier-1 verification — $event.ledger_id',
    enabled:        true,
    debounce_ms:    300_000,
  },
  {
    id:             'b_aa_formal_high_vs_low',
    event_type:     'aa_formal_complete',
    template_name:  'high_vs_low@v1',
    params:         { prompt: '$event.summary' },
    anchor_template: '[class-B] A&A formal high-vs-low — $event.formal_id',
    enabled:        true,
    debounce_ms:    180_000,
  },
];

function loadClassBConfig(): ClassBSubscription[] {
  if (!existsSync(CLASS_B_CONFIG_PATH)) return DEFAULT_CLASS_B_CONFIG;
  try {
    const raw = readFileSync(CLASS_B_CONFIG_PATH, 'utf8');
    return JSON.parse(raw) as ClassBSubscription[];
  } catch (err) {
    triggerLog(`[class-B] config parse error: ${String(err)} — using defaults`);
    return DEFAULT_CLASS_B_CONFIG;
  }
}

/** Write the default Class B config to disk (idempotent). */
function ensureClassBConfig(): void {
  if (existsSync(CLASS_B_CONFIG_PATH)) return;
  writeFileSync(CLASS_B_CONFIG_PATH, JSON.stringify(DEFAULT_CLASS_B_CONFIG, null, 2), 'utf8');
  triggerLog('[class-B] wrote default class_b_subscriptions.json');
}

/**
 * Emit a substrate-state event to the Class B subscriber system.
 *
 * Called from anywhere in the AMPLIFY substrate when a notable state change occurs.
 * The event payload should contain enough context for param templates to bind.
 *
 * @param eventType  e.g. "canon_eblet_landed", "crown_jewel_bound"
 * @param payload    Free-form payload; field values are bound to subscription params
 */
export function emitSubstrateEvent(
  eventType: string,
  payload: Record<string, unknown>,
): void {
  const subs = loadClassBConfig().filter(s => s.enabled && s.event_type === eventType);
  if (subs.length === 0) return;

  triggerLog(`[class-B] event "${eventType}" received — ${subs.length} subscriber(s)`);

  for (const sub of subs) {
    // Check threshold conditions
    if (sub.threshold) {
      const pass = Object.entries(sub.threshold).every(
        ([k, v]) => payload[k] === v,
      );
      if (!pass) {
        triggerLog(`[class-B] sub "${sub.id}" threshold not met — skip`);
        continue;
      }
    }

    const resolvedParams  = resolveParams(sub.params, payload);
    const resolvedAnchor  = (sub.anchor_template as string)
      .replace(/\$event\.(\w+)/g, (_, f) => String(payload[f] ?? `$event.${f}`));
    const debounceMs = sub.debounce_ms ?? DEFAULT_DEBOUNCE_MS;

    setImmediate(() => {
      fireTriggerWave('B', sub.id, sub.template_name, resolvedParams, resolvedAnchor, debounceMs)
        .catch((err: unknown) => triggerLog(`[class-B] async fire error: ${String(err)}`));
    });
  }
}

// ─── Class C — Cron Scheduler ─────────────────────────────────────────────────

const DEFAULT_CLASS_C_CONFIG: ClassCSchedule[] = [
  {
    id:            'c_anderson_watch_daily',
    cron:          '0 6 * * *',
    template_name: 'cross_vendor_verification@v1',
    params:        { prompt: 'Anderson watch-list review: scan for new patent disclosures, academic filings, or competitive developments that could affect Liana Banyan IP claims.' },
    anchor:        '[class-C] Anderson watch-list daily scan',
    enabled:       true,
  },
  {
    id:            'c_cross_vendor_weekly',
    cron:          '0 9 * * 1',
    template_name: 'cross_vendor_verification@v1',
    params:        { prompt: 'Weekly cross-vendor substrate verification: confirm no vendor drift on cooperative-AI governance, 83.3% Creator split, and $5/year membership canon.' },
    anchor:        '[class-C] cross-vendor weekly verification',
    enabled:       true,
  },
  {
    id:            'c_mnemosyne_memory_daily',
    cron:          '0 23 * * *',
    template_name: '4_way_cohort@v1',
    params:        {
      root_question: 'SR-019 Mnemosyne MEMORY pass: catalog today\'s session learnings across technical, canonical, economic, and legal dimensions for substrate compounding.',
    },
    anchor:        '[class-C] SR-019 Mnemosyne daily MEMORY pass',
    enabled:       true,
  },
  {
    id:            'c_test_every_5min',
    cron:          '*/5 * * * *',
    template_name: 'cross_vendor_verification@v1',
    params:        { prompt: 'Phase C G3 test pulse: confirm Wave Generator Class C (cron) trigger is firing on schedule. Respond with timestamp and "CLASS_C_CRON_PULSE: OK".' },
    anchor:        '[class-C] G3 test pulse — every 5 minutes',
    enabled:       false,
  },
];

function loadClassCConfig(): ClassCSchedule[] {
  if (!existsSync(CLASS_C_CONFIG_PATH)) return DEFAULT_CLASS_C_CONFIG;
  try {
    const raw = readFileSync(CLASS_C_CONFIG_PATH, 'utf8');
    return JSON.parse(raw) as ClassCSchedule[];
  } catch (err) {
    triggerLog(`[class-C] config parse error: ${String(err)} — using defaults`);
    return DEFAULT_CLASS_C_CONFIG;
  }
}

function ensureClassCConfig(): void {
  if (existsSync(CLASS_C_CONFIG_PATH)) return;
  writeFileSync(CLASS_C_CONFIG_PATH, JSON.stringify(DEFAULT_CLASS_C_CONFIG, null, 2), 'utf8');
  triggerLog('[class-C] wrote default class_c_schedules.json');
}

/**
 * Minimal 5-field cron evaluator.
 *
 * Supports:
 *   - `*` — any value
 *   - `*\/N` — every N steps (e.g. `*\/5` matches 0,5,10,...)
 *   - `N` — exact value
 *
 * Returns milliseconds until the next fire after `now`.
 */
export function nextCronFireMs(expr: string, now: Date = new Date()): number {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`Invalid cron expression (expected 5 fields): "${expr}"`);
  const [minExpr, hourExpr, domExpr, monExpr, dowExpr] = parts as [string, string, string, string, string];

  function matchesField(val: number, fieldExpr: string): boolean {
    if (fieldExpr === '*') return true;
    if (fieldExpr.startsWith('*/')) {
      const step = parseInt(fieldExpr.slice(2), 10);
      if (isNaN(step) || step <= 0) throw new Error(`Invalid step in cron field: "${fieldExpr}"`);
      return val % step === 0;
    }
    const n = parseInt(fieldExpr, 10);
    if (isNaN(n)) throw new Error(`Invalid cron field value: "${fieldExpr}"`);
    return val === n;
  }

  // Start searching from the next whole minute
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  // Search at most 366 days forward (covers yearly crons)
  const limitMs = now.getTime() + 366 * 24 * 60 * 60 * 1000;

  while (candidate.getTime() <= limitMs) {
    if (
      matchesField(candidate.getMinutes(),    minExpr) &&
      matchesField(candidate.getHours(),      hourExpr) &&
      matchesField(candidate.getDate(),       domExpr) &&
      matchesField(candidate.getMonth() + 1, monExpr) &&
      matchesField(candidate.getDay(),        dowExpr)
    ) {
      return Math.max(0, candidate.getTime() - now.getTime());
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  throw new Error(`No valid fire time found within 366 days for cron: "${expr}"`);
}

/** Schedule a single cron entry using recursive setTimeout. */
function scheduleCronEntry(schedule: ClassCSchedule): void {
  const fire = () => {
    const now = new Date();
    let delayMs: number;
    try {
      delayMs = nextCronFireMs(schedule.cron, now);
    } catch (err) {
      triggerLog(`[class-C] cron "${schedule.id}" parse error: ${String(err)} — retiring`);
      return;
    }

    setTimeout(() => {
      triggerLog(`[class-C] cron "${schedule.id}" FIRING (${schedule.cron})`);
      fireTriggerWave(
        'C',
        schedule.id,
        schedule.template_name,
        schedule.params,
        schedule.anchor,
        schedule.debounce_ms ?? 0,
      )
        .catch((err: unknown) => triggerLog(`[class-C] fire error: ${String(err)}`))
        .finally(() => fire()); // re-schedule after each fire
    }, delayMs);

    const nextAt = new Date(Date.now() + delayMs);
    triggerLog(`[class-C] cron "${schedule.id}" next fire at ${nextAt.toISOString()} (in ${Math.round(delayMs / 1000)}s)`);
  };

  fire(); // kick off the schedule loop
}

function initCronScheduler(): void {
  const schedules = loadClassCConfig().filter(s => s.enabled);
  if (schedules.length === 0) {
    triggerLog('[class-C] no enabled cron schedules found');
    return;
  }
  triggerLog(`[class-C] starting ${schedules.length} cron schedule(s)`);
  for (const s of schedules) {
    scheduleCronEntry(s);
  }
}

// ─── Class D — Cascade Triggered ─────────────────────────────────────────────

/**
 * Parse a `<!-- fire-next: {...} -->` directive from synthesis text.
 *
 * The directive format:
 *   <!-- fire-next: {"template":"4_way_cohort@v1","params":{...},"anchor":"..."} -->
 *
 * Returns null if no directive found.
 */
function parseCascadeDirective(synthesisText: string): {
  template: string;
  params: Record<string, unknown>;
  anchor: string;
} | null {
  // Match the directive — allow the JSON to span multiple lines
  const match = synthesisText.match(/<!--\s*fire-next:\s*(\{[\s\S]*?\})\s*-->/);
  if (!match || !match[1]) return null;
  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>;
    if (typeof parsed.template !== 'string' || !parsed.template) return null;
    return {
      template: parsed.template as string,
      params:   (parsed.params as Record<string, unknown>) ?? {},
      anchor:   typeof parsed.anchor === 'string' ? parsed.anchor : `[class-D] cascade from ${parsed.template as string}`,
    };
  } catch {
    return null;
  }
}

/**
 * Class D post-synthesis hook — registered into wave_generator.
 * Called by the Wave Generator after every synthesis completes.
 */
function handleCascadeFromSynthesis(
  waveId: string,
  anchor: string,
  synthesisText: string,
): void {
  const directive = parseCascadeDirective(synthesisText);
  if (!directive) return;

  triggerLog(
    `[class-D] cascade directive found in wave "${waveId}" — template="${directive.template}" anchor="${directive.anchor}"`,
  );

  const cascadeAnchor = `[class-D] cascade from wave-${waveId.slice(0, 8)}: ${directive.anchor}`;

  setImmediate(() => {
    fireTriggerWave(
      'D',
      `cascade-${waveId.slice(0, 8)}`,
      directive.template,
      directive.params,
      cascadeAnchor,
      DEFAULT_DEBOUNCE_MS,
    ).catch((err: unknown) => triggerLog(`[class-D] cascade fire error: ${String(err)}`));
  });
}

// ─── Master Init ──────────────────────────────────────────────────────────────

let _engineInitialized = false;

/**
 * Initialize the Wave Trigger Engine.
 * Safe to call multiple times (idempotent after first call).
 *
 * - Ensures trigger config dirs exist
 * - Writes default configs if absent
 * - Starts Class C cron scheduler
 * - Registers Class D cascade hook into wave_generator
 *
 * Class A is stateless (call parseNlWaveRequest() directly).
 * Class B subscribers are activated via emitSubstrateEvent().
 */
export function initTriggerEngine(): void {
  if (_engineInitialized) return;
  _engineInitialized = true;

  ensureTriggerDirs();
  ensureClassBConfig();
  ensureClassCConfig();

  // Class C — start cron scheduler
  initCronScheduler();

  // Class D — register cascade hook into wave_generator
  registerPostSynthesisHook(handleCascadeFromSynthesis);

  triggerLog('[trigger-engine] initialized — class B (pheromone), C (cron), D (cascade) ACTIVE');
}

// ─── Trigger Status Summary ───────────────────────────────────────────────────

export function getTriggerSummary(): {
  initialized: boolean;
  class_b_subscriptions: number;
  class_b_enabled: number;
  class_c_schedules: number;
  class_c_enabled: number;
  dedup_registry_size: number;
} {
  const classBConfig = loadClassBConfig();
  const classCConfig = loadClassCConfig();
  return {
    initialized:          _engineInitialized,
    class_b_subscriptions: classBConfig.length,
    class_b_enabled:       classBConfig.filter(s => s.enabled).length,
    class_c_schedules:     classCConfig.length,
    class_c_enabled:       classCConfig.filter(s => s.enabled).length,
    dedup_registry_size:   _dedupeRegistry.size,
  };
}
