// AMPLIFY Computer — Hearth App Builder — Signal Emitters
// B69 — Sweat Scribe (G12), Tears Scribe (G13), Forager Scribe (G15)
// Signals append to ~/.claude/state/ paths (or pending files if scribes not yet landed).

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { SweatSignal, TearsSignal, ForagerFlag } from './types';

const CLAUDE_STATE_DIR = join(homedir(), '.claude', 'state');

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function appendSignal(filePath: string, signal: unknown): void {
  ensureDir(join(filePath, '..'));
  try {
    appendFileSync(filePath, JSON.stringify(signal) + '\n', 'utf8');
  } catch (err) {
    console.warn('[HearthSignals] Failed to append signal:', err);
  }
}

// ─── Sweat Scribe (G12) ───────────────────────────────────────────────────────

const SWEAT_LIVE_PATH = join(CLAUDE_STATE_DIR, 'sweat_scribe', 'raw_signals.jsonl');
const SWEAT_PENDING_PATH = join(CLAUDE_STATE_DIR, 'hearth_effort_signals_pending.jsonl');

function sweatPath(): string {
  const liveDir = join(CLAUDE_STATE_DIR, 'sweat_scribe');
  return existsSync(liveDir) ? SWEAT_LIVE_PATH : SWEAT_PENDING_PATH;
}

export function emitSweatSpecExtraction(opts: {
  method: 'ollama' | 'fallback_form';
  latency_ms: number;
  appUuid: string;
  appName: string;
  tokens_estimated?: number;
}): void {
  const signal: SweatSignal = {
    ts: new Date().toISOString(),
    source: 'hearth',
    signal_class: 'spec_extraction',
    payload: opts,
  };
  appendSignal(sweatPath(), signal);
}

export function emitSweatBuildRunner(opts: {
  appUuid: string;
  appName: string;
  duration_ms: number;
  success: boolean;
  os: string;
}): void {
  const signal: SweatSignal = {
    ts: new Date().toISOString(),
    source: 'hearth',
    signal_class: 'build_runner',
    payload: opts,
  };
  appendSignal(sweatPath(), signal);
}

export function emitSweatInstallRunner(opts: {
  appUuid: string;
  appName: string;
  success: boolean;
  os: string;
}): void {
  const signal: SweatSignal = {
    ts: new Date().toISOString(),
    source: 'hearth',
    signal_class: 'install_runner',
    payload: opts,
  };
  appendSignal(sweatPath(), signal);
}

// ─── Tears Scribe (G13) ───────────────────────────────────────────────────────

const TEARS_LIVE_PATH = join(CLAUDE_STATE_DIR, 'tears_scribe', 'raw_signals.jsonl');
const TEARS_PENDING_PATH = join(CLAUDE_STATE_DIR, 'hearth_tears_signals_pending.jsonl');

function tearsPath(): string {
  const liveDir = join(CLAUDE_STATE_DIR, 'tears_scribe');
  return existsSync(liveDir) ? TEARS_LIVE_PATH : TEARS_PENDING_PATH;
}

export function emitTearsInstallFailed(opts: {
  appUuid: string;
  appName: string;
  build_succeeded: boolean;
  coroner_found_breakage: boolean;
}): void {
  if (opts.coroner_found_breakage) return; // only emit if no breakage found
  const signal: TearsSignal = {
    ts: new Date().toISOString(),
    source: 'hearth',
    signal_class: 'install_failed_no_breakage',
    payload: { ...opts, velvet_fingers_attestation: 'implicit_platform_launch' },
  };
  appendSignal(tearsPath(), signal);
}

export function emitTearsBuildCompleteNoInstall(opts: {
  appUuid: string;
  appName: string;
  built_at: string;
  timeout_ms: number;
}): void {
  const signal: TearsSignal = {
    ts: new Date().toISOString(),
    source: 'hearth',
    signal_class: 'build_complete_no_install',
    payload: { ...opts, velvet_fingers_attestation: 'implicit_platform_launch' },
  };
  appendSignal(tearsPath(), signal);
}

export function emitTearsInstallNoOpen(opts: {
  appUuid: string;
  appName: string;
  installed_at: string;
  window_ms: number;
}): void {
  const signal: TearsSignal = {
    ts: new Date().toISOString(),
    source: 'hearth',
    signal_class: 'install_no_open',
    payload: { ...opts, velvet_fingers_attestation: 'implicit_platform_launch' },
  };
  appendSignal(tearsPath(), signal);
}

// ─── Forager Scribe (G15) ─────────────────────────────────────────────────────

const FORAGER_LIVE_PATH = join(CLAUDE_STATE_DIR, 'forager', 'aspirational_items.jsonl');
const FORAGER_PENDING_PATH = join(CLAUDE_STATE_DIR, 'hearth_forager_flags_pending.jsonl');

function foragerPath(): string {
  const liveDir = join(CLAUDE_STATE_DIR, 'forager');
  return existsSync(liveDir) ? FORAGER_LIVE_PATH : FORAGER_PENDING_PATH;
}

export function emitForagerNotImplementable(opts: {
  appUuid: string;
  appName: string;
  description: string;
}): void {
  const flag: ForagerFlag = {
    ts: new Date().toISOString(),
    source: 'hearth',
    flag_class: 'not_yet_implementable',
    description: opts.description,
    appUuid: opts.appUuid,
  };
  appendSignal(foragerPath(), flag);
}

export function emitForagerCrossDomainBridge(opts: {
  appUuid: string;
  description: string;
}): void {
  const flag: ForagerFlag = {
    ts: new Date().toISOString(),
    source: 'hearth',
    flag_class: 'cross_domain_bridge',
    description: opts.description,
    appUuid: opts.appUuid,
  };
  appendSignal(foragerPath(), flag);
}

// ─── Iron Tablet receipt (Substrate) ─────────────────────────────────────────

const IRON_TABLETS_DIR = join(homedir(), '.lb_substrate', 'iron_tablets');

export function writeIronTablet(receipt: {
  uuid: string;
  ts: string;
  appName: string;
  member_id: string;
  build_status: 'success' | 'failure';
  spec?: unknown;
  installer_path?: string;
  error?: string;
}): void {
  ensureDir(IRON_TABLETS_DIR);
  const filename = `LB-IRON-${receipt.uuid.slice(0, 8)}_hearth_app_build_${receipt.uuid}_${Date.now()}.json`;
  const filePath = join(IRON_TABLETS_DIR, filename);
  try {
    appendFileSync(filePath, JSON.stringify(receipt, null, 2), 'utf8');
  } catch (err) {
    console.warn('[HearthSignals] Failed to write iron tablet:', err);
  }
}

// ─── MCCI pending buffer (G14) ────────────────────────────────────────────────

const MCCI_PENDING_PATH = join(CLAUDE_STATE_DIR, 'hearth_mcci_pending.jsonl');

export function appendMCCIThread(entry: {
  thread_id: string;
  app_uuid: string;
  app_name: string;
  message: string;
  role: 'member' | 'hearth';
  build_status?: string;
  install_status?: string;
  ts: string;
}): void {
  // If B82 MCCI is live, this would route to the MCCI substrate.
  // For now, buffer to pending file.
  appendSignal(MCCI_PENDING_PATH, entry);
}
