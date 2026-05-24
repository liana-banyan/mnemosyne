// CelPane Pane Lease — Bushel 60-A Borrow Path (BP037)
//
// Inter-cluster lease semantics for CelPane blink-phase pane borrow.
// A Sprite or Spider operating across a cluster boundary borrows a CelPane
// pane during a blink-phase; the lease MUST auto-release on blink-end.
// No stale leases may persist to block cross-cluster work.
//
// Canon anchor: LB-STACK-0160 (Shadow E-Sprites + E-Spiders)
//               Slipstream L4 (LB-STACK-0163)
//               B60-A Prompt §Path 3 — Borrow
//
// Gate G-BORROW PASS:
//   cross-cluster Sprite borrows pane → blink-phase completes →
//   lease auto-releases → pane re-available within ≤1 blink interval.
//
// Substrate filesystem layout under ~/.lb_substrate/pane_leases/:
//   <lease_id>.lease.json   — active lease record
//   <lease_id>.released.json — release receipt (written on auto or manual release)

import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
} from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { homedir } from 'os';

// ─── Substrate paths ──────────────────────────────────────────────────────

export const LB_SUBSTRATE_ROOT =
  process.env.LB_SUBSTRATE_ROOT ?? resolve(homedir(), '.lb_substrate');

export const PANE_LEASES_DIR = resolve(LB_SUBSTRATE_ROOT, 'pane_leases');

export function ensurePaneLeaseLayout(): void {
  if (!existsSync(PANE_LEASES_DIR)) mkdirSync(PANE_LEASES_DIR, { recursive: true });
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface PaneLease {
  lease_id: string;
  cluster_id: string;
  pane_id: string;
  blink_duration_ms: number;
  acquired_at: string;
  expires_at: string;
  released: boolean;
  released_at: string | null;
  auto_released: boolean;
  session: string;
}

export interface PaneLeaseReceipt {
  lease_id: string;
  cluster_id: string;
  pane_id: string;
  session: string;
  acquired: boolean;
  released: boolean;
  auto_released: boolean;
  blink_duration_ms: number;
  /** ms from blink-end to confirmed release; ≤ blink_duration_ms to pass gate. */
  release_latency_ms: number;
  errors: string[];
}

// ─── In-process timer map (auto-release handles) ──────────────────────────

const _activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ─── Lease file helpers ───────────────────────────────────────────────────

function leaseFilePath(leaseId: string): string {
  return resolve(PANE_LEASES_DIR, `${leaseId}.lease.json`);
}

function releaseFilePath(leaseId: string): string {
  return resolve(PANE_LEASES_DIR, `${leaseId}.released.json`);
}

function loadLease(leaseId: string): PaneLease | null {
  const p = leaseFilePath(leaseId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as PaneLease;
  } catch {
    return null;
  }
}

function saveLease(lease: PaneLease): void {
  writeFileSync(leaseFilePath(lease.lease_id), JSON.stringify(lease, null, 2), 'utf-8');
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Acquire a CelPane pane lease for cross-cluster borrow during a blink-phase.
 * The lease auto-releases after `blinkDurationMs` milliseconds.
 *
 * Returns the `PaneLease` record. Use `waitForRelease(leaseId)` to await the
 * auto-release and collect the full `PaneLeaseReceipt`.
 */
export function acquirePaneLease(opts: {
  cluster_id: string;
  pane_id: string;
  blink_duration_ms: number;
  session: string;
  lease_id?: string;
}): PaneLease {
  ensurePaneLeaseLayout();

  const leaseId = opts.lease_id ?? randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + opts.blink_duration_ms);

  const lease: PaneLease = {
    lease_id: leaseId,
    cluster_id: opts.cluster_id,
    pane_id: opts.pane_id,
    blink_duration_ms: opts.blink_duration_ms,
    acquired_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    released: false,
    released_at: null,
    auto_released: false,
    session: opts.session,
  };

  saveLease(lease);

  // Schedule auto-release.
  const timer = setTimeout(() => {
    _autoRelease(leaseId);
  }, opts.blink_duration_ms);
  _activeTimers.set(leaseId, timer);

  return lease;
}

/**
 * Manually release a lease before blink-end (early return).
 * Cancels the auto-release timer and writes the release receipt.
 */
export function releasePaneLease(leaseId: string): PaneLeaseReceipt {
  return _doRelease(leaseId, false);
}

/**
 * Await the auto-release of a lease by polling the substrate until either the
 * release file appears or a timeout fires (2× blink_duration_ms).
 *
 * Returns the `PaneLeaseReceipt`.
 */
export async function waitForRelease(leaseId: string, pollMs = 5): Promise<PaneLeaseReceipt> {
  const lease = loadLease(leaseId);
  if (!lease) {
    // Already fully released — check for release file.
    const releaseRecord = _readReleaseFile(leaseId);
    if (releaseRecord) return releaseRecord;
    return {
      lease_id: leaseId,
      cluster_id: '',
      pane_id: '',
      session: '',
      acquired: false,
      released: false,
      auto_released: false,
      blink_duration_ms: 0,
      release_latency_ms: -1,
      errors: ['lease not found'],
    };
  }

  // If already released, return immediately.
  if (lease.released) {
    const r = _readReleaseFile(leaseId);
    if (r) return r;
  }

  const deadline = Date.now() + lease.blink_duration_ms * 2 + 100;
  while (Date.now() < deadline) {
    if (existsSync(releaseFilePath(leaseId))) {
      const r = _readReleaseFile(leaseId);
      if (r) return r;
    }
    await _sleep(pollMs);
  }

  // Timeout — force release now.
  return _doRelease(leaseId, true);
}

/**
 * Scan for and purge any stale leases that have passed their expiry without
 * releasing (e.g. after a crash). Returns the count of stale leases cleared.
 */
export function purgeStalePaneLeases(): number {
  ensurePaneLeaseLayout();
  let count = 0;
  try {
    const files = readdirSync(PANE_LEASES_DIR).filter((f) => f.endsWith('.lease.json'));
    const now = Date.now();
    for (const f of files) {
      const fullPath = resolve(PANE_LEASES_DIR, f);
      try {
        const lease = JSON.parse(readFileSync(fullPath, 'utf-8')) as PaneLease;
        if (!lease.released && new Date(lease.expires_at).getTime() < now) {
          // Stale — force-release.
          _autoRelease(lease.lease_id);
          count++;
        }
      } catch { /* skip corrupt files */ }
    }
  } catch { /* dir scan failed */ }
  return count;
}

/** List all active (non-released) leases. */
export function listActivePaneLeases(): PaneLease[] {
  ensurePaneLeaseLayout();
  const out: PaneLease[] = [];
  try {
    for (const f of readdirSync(PANE_LEASES_DIR)) {
      if (!f.endsWith('.lease.json')) continue;
      try {
        const lease = JSON.parse(
          readFileSync(resolve(PANE_LEASES_DIR, f), 'utf-8'),
        ) as PaneLease;
        if (!lease.released) out.push(lease);
      } catch { /* skip */ }
    }
  } catch { /* dir scan failed */ }
  return out;
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function _autoRelease(leaseId: string): void {
  _doRelease(leaseId, true);
}

function _doRelease(leaseId: string, isAuto: boolean): PaneLeaseReceipt {
  // Cancel any pending timer (idempotent for auto-release).
  const timer = _activeTimers.get(leaseId);
  if (timer !== undefined) {
    clearTimeout(timer);
    _activeTimers.delete(leaseId);
  }

  const lease = loadLease(leaseId);
  if (!lease) {
    // Already released — try reading the release file.
    const existing = _readReleaseFile(leaseId);
    if (existing) return existing;
    return {
      lease_id: leaseId,
      cluster_id: '',
      pane_id: '',
      session: '',
      acquired: false,
      released: false,
      auto_released: isAuto,
      blink_duration_ms: 0,
      release_latency_ms: -1,
      errors: ['lease not found'],
    };
  }

  if (lease.released) {
    // Idempotent: already released.
    const existing = _readReleaseFile(leaseId);
    if (existing) return existing;
  }

  const releasedAt = new Date().toISOString();
  const acquiredMs = new Date(lease.acquired_at).getTime();
  const expiresMs = new Date(lease.expires_at).getTime();
  const releaseMs = new Date(releasedAt).getTime();
  const releaseLatencyMs = Math.max(0, releaseMs - expiresMs);

  // Update the lease record on disk.
  lease.released = true;
  lease.released_at = releasedAt;
  lease.auto_released = isAuto;
  saveLease(lease);

  const receipt: PaneLeaseReceipt = {
    lease_id: leaseId,
    cluster_id: lease.cluster_id,
    pane_id: lease.pane_id,
    session: lease.session,
    acquired: true,
    released: true,
    auto_released: isAuto,
    blink_duration_ms: lease.blink_duration_ms,
    release_latency_ms: releaseLatencyMs,
    errors: [],
  };

  // Write the release receipt.
  try {
    writeFileSync(releaseFilePath(leaseId), JSON.stringify(receipt, null, 2), 'utf-8');
  } catch { /* non-fatal */ }

  // Remove the active lease file (pane is now available).
  try {
    unlinkSync(leaseFilePath(leaseId));
  } catch { /* non-fatal */ }

  return receipt;
}

function _readReleaseFile(leaseId: string): PaneLeaseReceipt | null {
  const p = releaseFilePath(leaseId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as PaneLeaseReceipt;
  } catch {
    return null;
  }
}

function _sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
