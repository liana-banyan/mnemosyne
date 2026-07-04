// Shadow E-Sprite Registry — Bushel 60 Phase B (BP030)
//
// Scripted v1: pattern-match + lock-signature courier daemon.
// NO AI inference — deterministic glob/path matching only.
//
// Architecture reference:
//   ~/Documents/LianaBanyanPlatform/BISHOP_DROPZONE/14_CanonicalReferences/
//     LOCAL_CPU_COMPUTE_ARCHITECTURE_SPRITES_SPIDERS_BP030.md
// Canon eblet:
//   ~/.claude/state/eblets/CANON/shadow_e_sprites_spiders_inter_cluster_courier_web_architecture_bp030.eblet.md
//   (LB-STACK-0160)
//
// Substrate filesystem layout (created on demand under ~/.lb_substrate/):
//   sprite_queue/        — incoming dispatch files (one .json per dispatch)
//   sprite_active/       — in-flight Sprites + delivery + recall flag receipts
//   receipts/sprite/     — final per-dispatch receipts (canonical record)
//
// Substrate IS the bus. No SSE, no broker, no shared memory — only files.
// First-success-wins recall: shared flag-file lock; delivery broadcasts
// recall to abort siblings.

import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  readdirSync,
  statSync,
  copyFileSync,
  unlinkSync,
  watch as fsWatch,
  type FSWatcher,
} from 'fs';
import { resolve, basename, join, dirname } from 'path';
import { randomUUID, createHash } from 'crypto';
import { homedir } from 'os';
import { writeVerifiedEblet } from './mnem_eblet_store';

// ─── Substrate paths ──────────────────────────────────────────────────────

export const LB_SUBSTRATE_ROOT =
  process.env.LB_SUBSTRATE_ROOT ?? resolve(homedir(), '.lb_substrate');

export const SPRITE_QUEUE_DIR = resolve(LB_SUBSTRATE_ROOT, 'sprite_queue');
export const SPRITE_ACTIVE_DIR = resolve(LB_SUBSTRATE_ROOT, 'sprite_active');
export const SPRITE_RECEIPT_DIR = resolve(
  LB_SUBSTRATE_ROOT,
  'receipts',
  'sprite',
);

export function ensureSubstrateLayout(): void {
  for (const d of [
    LB_SUBSTRATE_ROOT,
    SPRITE_QUEUE_DIR,
    SPRITE_ACTIVE_DIR,
    SPRITE_RECEIPT_DIR,
  ]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

// ─── Types ────────────────────────────────────────────────────────────────

export type ClusterName = 'bishop' | 'knight' | 'pawn' | 'rook' | string;

export interface SpriteDispatch {
  dispatch_id: string;
  session: string; // e.g. "BP030"
  package_path: string; // absolute path to the artifact
  source_cluster: ClusterName;
  destination_cluster: ClusterName;
  // Lock signature: a SHA-256 of the destination cluster name + package basename,
  // plus an optional path-pattern (glob-like substring) the courier must match
  // against candidate dropzone paths. Scripted v1 uses substring + cluster name.
  lock_signature: string;
  destination_path_pattern: string; // substring match against absolute candidate paths
  redundancy_count: number; // default 3
  spawn_timestamp: string; // ISO
  // Candidate dropzone paths the supervisor will scan. The first that satisfies
  // both (a) substring contains destination_path_pattern AND (b) cluster-name
  // appears in path is the delivery target. v1 is deterministic; the
  // "randomized walk" is implemented as a Sprite-local shuffle of this list.
  candidate_dropzones: string[];
  metadata?: Record<string, unknown>;
}

export interface SpriteDeliveryReceipt {
  dispatch_id: string;
  session: string;
  package_path: string;
  delivered_to: string; // absolute path inside destination cluster
  delivered_by_sprite_id: string;
  destination_cluster: ClusterName;
  source_cluster: ClusterName;
  redundancy_count: number;
  spawn_timestamp: string;
  first_delivery_timestamp: string;
  first_delivery_latency_ms: number;
  delivery_success: boolean;
  redundant_recall_count: number;
  recall_latency_ms_per_sprite: number[];
  errors: string[];
}

interface SpriteRunHandle {
  sprite_id: string;
  dispatch_id: string;
  startedAt: number;
  abort: () => void;
  done: Promise<void>;
}

// ─── Lock signature helper ────────────────────────────────────────────────

export function computeLockSignature(
  destinationCluster: ClusterName,
  packagePath: string,
): string {
  const h = createHash('sha256');
  h.update(`${destinationCluster.toLowerCase()}::${basename(packagePath)}`);
  return h.digest('hex').slice(0, 32);
}

export function verifyLockSignature(
  candidatePath: string,
  destinationCluster: ClusterName,
  destinationPathPattern: string,
): boolean {
  const lower = candidatePath.toLowerCase();
  const clusterToken = destinationCluster.toLowerCase();
  const patternToken = destinationPathPattern.toLowerCase();
  // Two-factor pattern match: cluster name appears AND pattern matches.
  // v1 is deterministic & cheap; promotion target is Haiku adjudication on ambiguity.
  return lower.includes(clusterToken) && lower.includes(patternToken);
}

// ─── File-flag protocol primitives ────────────────────────────────────────

function deliveredFlagPath(dispatchId: string): string {
  return resolve(SPRITE_ACTIVE_DIR, `${dispatchId}.delivered.json`);
}

function recallFlagPath(dispatchId: string): string {
  return resolve(SPRITE_ACTIVE_DIR, `${dispatchId}.recall`);
}

function recalledReceiptPath(dispatchId: string, spriteId: string): string {
  return resolve(SPRITE_ACTIVE_DIR, `${dispatchId}.${spriteId}.recalled.json`);
}

function dispatchQueueFile(dispatchId: string): string {
  return resolve(SPRITE_QUEUE_DIR, `${dispatchId}.dispatch.json`);
}

// ─── Sprite Supervisor / Registry ─────────────────────────────────────────

export class SpriteRegistry {
  private active = new Map<string, SpriteRunHandle[]>();
  private queueWatcher: FSWatcher | null = null;
  private readonly tickMs: number;
  private logFn: (line: string) => void;

  constructor(opts?: { tickMs?: number; logger?: (line: string) => void }) {
    this.tickMs = opts?.tickMs ?? 25;
    this.logFn = opts?.logger ?? (() => {});
    ensureSubstrateLayout();
  }

  /**
   * Watch the sprite_queue directory for new dispatch files. When one appears,
   * read it, spawn N parallel Sprite workers, then delete the queue file.
   */
  startQueueWatcher(): void {
    if (this.queueWatcher) return;
    ensureSubstrateLayout();
    try {
      this.queueWatcher = fsWatch(SPRITE_QUEUE_DIR, (_event, filename) => {
        if (!filename) return;
        if (!filename.endsWith('.dispatch.json')) return;
        const full = resolve(SPRITE_QUEUE_DIR, filename);
        // Debounce + existence check: file may still be being written
        setTimeout(() => this._tryAbsorbDispatch(full), 5);
      });
      this.logFn(`[SpriteRegistry] Watching ${SPRITE_QUEUE_DIR}`);
    } catch (err) {
      this.logFn(`[SpriteRegistry] watch failed: ${String(err)}`);
    }
  }

  stopQueueWatcher(): void {
    if (this.queueWatcher) {
      this.queueWatcher.close();
      this.queueWatcher = null;
    }
  }

  /**
   * Drain whatever is currently in the queue directory (synchronous startup
   * recovery + a polling fallback for environments where fs.watch is flaky).
   */
  drainQueueOnce(): void {
    ensureSubstrateLayout();
    let entries: string[] = [];
    try {
      entries = readdirSync(SPRITE_QUEUE_DIR);
    } catch {
      return;
    }
    for (const name of entries) {
      if (!name.endsWith('.dispatch.json')) continue;
      this._tryAbsorbDispatch(resolve(SPRITE_QUEUE_DIR, name));
    }
  }

  private _tryAbsorbDispatch(filePath: string): void {
    if (!existsSync(filePath)) return;
    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    if (!raw.trim()) return;
    let dispatch: SpriteDispatch;
    try {
      dispatch = JSON.parse(raw) as SpriteDispatch;
    } catch (err) {
      this.logFn(`[SpriteRegistry] bad dispatch JSON ${filePath}: ${String(err)}`);
      return;
    }
    // Already absorbed?
    if (this.active.has(dispatch.dispatch_id)) {
      try { unlinkSync(filePath); } catch { /* ignore */ }
      return;
    }
    try { unlinkSync(filePath); } catch { /* ignore */ }
    void this.dispatchSprites(dispatch);
  }

  /**
   * Externally-callable: push a dispatch into the queue. Returns the dispatch id.
   */
  enqueue(dispatch: Omit<SpriteDispatch, 'dispatch_id' | 'spawn_timestamp'> & {
    dispatch_id?: string;
    spawn_timestamp?: string;
  }): SpriteDispatch {
    const full: SpriteDispatch = {
      dispatch_id: dispatch.dispatch_id ?? randomUUID(),
      session: dispatch.session,
      package_path: dispatch.package_path,
      source_cluster: dispatch.source_cluster,
      destination_cluster: dispatch.destination_cluster,
      lock_signature: dispatch.lock_signature,
      destination_path_pattern: dispatch.destination_path_pattern,
      redundancy_count: Math.max(1, dispatch.redundancy_count | 0),
      spawn_timestamp: dispatch.spawn_timestamp ?? new Date().toISOString(),
      candidate_dropzones: dispatch.candidate_dropzones,
      metadata: dispatch.metadata,
    };
    ensureSubstrateLayout();
    writeFileSync(dispatchQueueFile(full.dispatch_id), JSON.stringify(full, null, 2));
    return full;
  }

  /**
   * Spawn N parallel Sprite workers for a single dispatch. First-success-wins
   * with file-flag recall.
   */
  async dispatchSprites(dispatch: SpriteDispatch): Promise<SpriteDeliveryReceipt> {
    ensureSubstrateLayout();
    if (dispatch.source_cluster.toLowerCase() === dispatch.destination_cluster.toLowerCase()) {
      const err = 'intra-cluster delivery not supported by Sprites (use direct SEG-to-SEG)';
      this.logFn(`[SpriteRegistry] dispatch ${dispatch.dispatch_id} rejected: ${err}`);
      const skip: SpriteDeliveryReceipt = {
        dispatch_id: dispatch.dispatch_id,
        session: dispatch.session,
        package_path: dispatch.package_path,
        delivered_to: '',
        delivered_by_sprite_id: '',
        destination_cluster: dispatch.destination_cluster,
        source_cluster: dispatch.source_cluster,
        redundancy_count: dispatch.redundancy_count,
        spawn_timestamp: dispatch.spawn_timestamp,
        first_delivery_timestamp: '',
        first_delivery_latency_ms: -1,
        delivery_success: false,
        redundant_recall_count: 0,
        recall_latency_ms_per_sprite: [],
        errors: [err],
      };
      writeFileSync(
        resolve(SPRITE_RECEIPT_DIR, `${dispatch.session}_${dispatch.dispatch_id}.json`),
        JSON.stringify(skip, null, 2),
      );
      return skip;
    }

    const handles: SpriteRunHandle[] = [];
    const recallLatencies: number[] = [];
    const errors: string[] = [];
    const t0 = Date.now();

    // Per-sprite abort flags (in-process); the on-disk recall flag is the
    // canonical signal but in-process flags allow synchronous abort.
    const abortFlags: { aborted: boolean }[] = [];

    let firstDeliverySpriteId = '';
    let firstDeliveryPath = '';
    let firstDeliveryTs = '';
    let firstDeliveryLatency = -1;

    const deliveryPromises: Promise<void>[] = [];
    for (let i = 0; i < dispatch.redundancy_count; i++) {
      const spriteId = `spt-${dispatch.dispatch_id.slice(0, 8)}-${i}`;
      const flag = { aborted: false };
      abortFlags.push(flag);
      // Deterministic-but-distinct shuffle seed per Sprite — emulates the
      // "randomized walk" without nondeterminism in tests.
      const seed = i * 1009 + 7;
      const promise = this._runSprite(
        dispatch,
        spriteId,
        seed,
        flag,
        (deliveredAtPath, ts, latency) => {
          if (firstDeliverySpriteId) return false; // someone else won
          firstDeliverySpriteId = spriteId;
          firstDeliveryPath = deliveredAtPath;
          firstDeliveryTs = ts;
          firstDeliveryLatency = latency;
          // Broadcast recall — write the flag file. Other Sprites poll it.
          try {
            writeFileSync(
              recallFlagPath(dispatch.dispatch_id),
              JSON.stringify({
                dispatch_id: dispatch.dispatch_id,
                won_by: spriteId,
                ts,
              }),
            );
          } catch (err) {
            errors.push(`recall flag write failed: ${String(err)}`);
          }
          // Trip in-process flags too (faster than disk poll on same machine)
          for (let j = 0; j < abortFlags.length; j++) {
            if (j !== i) abortFlags[j].aborted = true;
          }
          return true;
        },
        (recallLatencyMs) => {
          recallLatencies.push(recallLatencyMs);
        },
        (err) => errors.push(err),
      );
      handles.push({
        sprite_id: spriteId,
        dispatch_id: dispatch.dispatch_id,
        startedAt: t0,
        abort: () => { flag.aborted = true; },
        done: promise,
      });
      deliveryPromises.push(promise);
    }
    this.active.set(dispatch.dispatch_id, handles);

    await Promise.all(deliveryPromises);
    this.active.delete(dispatch.dispatch_id);

    const receipt: SpriteDeliveryReceipt = {
      dispatch_id: dispatch.dispatch_id,
      session: dispatch.session,
      package_path: dispatch.package_path,
      delivered_to: firstDeliveryPath,
      delivered_by_sprite_id: firstDeliverySpriteId,
      destination_cluster: dispatch.destination_cluster,
      source_cluster: dispatch.source_cluster,
      redundancy_count: dispatch.redundancy_count,
      spawn_timestamp: dispatch.spawn_timestamp,
      first_delivery_timestamp: firstDeliveryTs,
      first_delivery_latency_ms: firstDeliveryLatency,
      delivery_success: !!firstDeliverySpriteId,
      redundant_recall_count: recallLatencies.length,
      recall_latency_ms_per_sprite: recallLatencies,
      errors,
    };

    try {
      writeFileSync(
        resolve(SPRITE_RECEIPT_DIR, `${dispatch.session}_${dispatch.dispatch_id}.json`),
        JSON.stringify(receipt, null, 2),
      );
    } catch (err) {
      this.logFn(`[SpriteRegistry] receipt write failed: ${String(err)}`);
    }

    // Cleanup: delivered flag + recall flag remain as audit; the per-sprite
    // recalled receipts remain too. Caller can reap if desired.
    return receipt;
  }

  private async _runSprite(
    dispatch: SpriteDispatch,
    spriteId: string,
    shuffleSeed: number,
    abortFlag: { aborted: boolean },
    onDelivery: (path: string, ts: string, latencyMs: number) => boolean,
    onRecalled: (latencyMs: number) => void,
    onError: (err: string) => void,
  ): Promise<void> {
    const t0 = Date.now();
    // Walk substrate paths: shuffle candidate_dropzones with seed, walk in order.
    const candidates = pseudoShuffle([...dispatch.candidate_dropzones], shuffleSeed);
    const recallFlag = recallFlagPath(dispatch.dispatch_id);

    for (const candidate of candidates) {
      // Recall check (cheap, every step)
      if (abortFlag.aborted || existsSync(recallFlag)) {
        const latency = Date.now() - t0;
        onRecalled(latency);
        try {
          writeFileSync(
            recalledReceiptPath(dispatch.dispatch_id, spriteId),
            JSON.stringify({
              sprite_id: spriteId,
              dispatch_id: dispatch.dispatch_id,
              recalled_at: new Date().toISOString(),
              recall_latency_ms: latency,
            }),
          );
        } catch { /* non-fatal */ }
        return;
      }

      // Pattern match against the candidate path
      if (!verifyLockSignature(
        candidate,
        dispatch.destination_cluster,
        dispatch.destination_path_pattern,
      )) {
        // Simulate "walking" — small async yield so other Sprites get scheduled
        await sleep(this.tickMs);
        continue;
      }

      // We have a match. Try to deliver.
      let deliveredPath = '';
      try {
        if (!existsSync(candidate)) mkdirSync(candidate, { recursive: true });
        if (!existsSync(dispatch.package_path)) {
          onError(`package not found: ${dispatch.package_path}`);
          return;
        }
        deliveredPath = resolve(candidate, basename(dispatch.package_path));
        // Idempotent copy: overwrite is OK on first write; we let the flag
        // arbitrate first-success-wins so duplicates won't reach this line.
        copyFileSync(dispatch.package_path, deliveredPath);
      } catch (err) {
        onError(`delivery copy failed for ${spriteId}: ${String(err)}`);
        return;
      }

      const ts = new Date().toISOString();
      const latency = Date.now() - t0;
      // Atomic-ish flag write: only the first to write the .delivered.json
      // file is the canonical winner. Use writeFileSync with 'wx' flag.
      const flagPath = deliveredFlagPath(dispatch.dispatch_id);
      let weWonOnDisk = false;
      try {
        // 'wx' = fail if exists. This is the disk-level race resolver.
        writeFileSync(
          flagPath,
          JSON.stringify({
            dispatch_id: dispatch.dispatch_id,
            sprite_id: spriteId,
            delivered_to: deliveredPath,
            delivered_at: ts,
            latency_ms: latency,
          }),
          { flag: 'wx' },
        );
        weWonOnDisk = true;
      } catch {
        // Another Sprite beat us to it on disk; treat as recall.
        weWonOnDisk = false;
      }

      if (!weWonOnDisk) {
        // Roll back our duplicate copy (best-effort) and emit recalled receipt.
        try { unlinkSync(deliveredPath); } catch { /* ignore */ }
        const recallLatency = Date.now() - t0;
        onRecalled(recallLatency);
        try {
          writeFileSync(
            recalledReceiptPath(dispatch.dispatch_id, spriteId),
            JSON.stringify({
              sprite_id: spriteId,
              dispatch_id: dispatch.dispatch_id,
              recalled_at: new Date().toISOString(),
              recall_latency_ms: recallLatency,
              reason: 'lost_disk_race',
            }),
          );
        } catch { /* non-fatal */ }
        return;
      }

      // Notify the supervisor we won; it broadcasts in-process recall + writes
      // the disk recall flag.
      const accepted = onDelivery(deliveredPath, ts, latency);
      if (!accepted) {
        // Should not happen given the wx-guarded write, but defensive:
        try { unlinkSync(deliveredPath); } catch { /* ignore */ }
      } else {
        // SEG-4: Delivery race winner → verified eblet write (non-blocking, Andon-gated).
        // question = package_path (artifact dispatched); answer = delivered_to path.
        const sha256 = createHash('sha256')
          .update(dispatch.package_path + deliveredPath)
          .digest('hex');
        writeVerifiedEblet({
          question: dispatch.package_path,
          answer: `delivered:${deliveredPath}`,
          provenance: `sprite:${dispatch.dispatch_id}:${dispatch.session}`,
          verified: true,
          sha256,
          timestamp: Date.now(),
        }).catch(console.error);
      }
      return;
    }

    // Walked the whole substrate without a match.
    onError(`no candidate dropzone matched for ${spriteId}`);
  }

  /**
   * Cold-start handshake: purge stale residual substrate state, then run a
   * single canary Sprite dispatch to verify first-success-recall semantics
   * work from a freshly-booted cluster.
   *
   * Gate G-COLD-START PASS:
   *   receipt.canary_delivered === true && receipt.state_coherence_ok === true
   */
  async coldStartHandshake(opts: {
    session: string;
    canaryPackagePath: string;
    canaryDropzone: string;
    destinationCluster?: ClusterName;
  }): Promise<ColdStartReceipt> {
    const ts = new Date().toISOString();
    const errors: string[] = [];
    ensureSubstrateLayout();

    // Step 1: Purge stale residual state files from any prior crashed run.
    let staleCleared = 0;
    try {
      const activeFiles = readdirSync(SPRITE_ACTIVE_DIR);
      for (const f of activeFiles) {
        const full = resolve(SPRITE_ACTIVE_DIR, f);
        try { unlinkSync(full); staleCleared++; } catch { /* non-fatal */ }
      }
    } catch (e) {
      errors.push(`stale-clear scan failed: ${String(e)}`);
    }

    // Step 2: Ensure destination dropzone exists.
    const destCluster: ClusterName = opts.destinationCluster ?? 'knight';
    try {
      if (!existsSync(opts.canaryDropzone)) {
        mkdirSync(opts.canaryDropzone, { recursive: true });
      }
    } catch (e) {
      errors.push(`canary dropzone create failed: ${String(e)}`);
    }

    // Step 3: Run a single-Sprite canary dispatch from cold.
    const canaryId = `cold-canary-${Date.now().toString(36)}`;
    const t0 = Date.now();
    let canaryReceipt: SpriteDeliveryReceipt | null = null;
    try {
      canaryReceipt = await this.dispatchSprites({
        dispatch_id: canaryId,
        session: opts.session,
        package_path: opts.canaryPackagePath,
        source_cluster: 'bishop',
        destination_cluster: destCluster,
        lock_signature: computeLockSignature(destCluster, opts.canaryPackagePath),
        destination_path_pattern: opts.canaryDropzone,
        redundancy_count: 1,
        spawn_timestamp: new Date().toISOString(),
        candidate_dropzones: [opts.canaryDropzone],
      });
    } catch (e) {
      errors.push(`canary dispatch threw: ${String(e)}`);
    }
    const latencyMs = Date.now() - t0;

    const canaryDelivered = canaryReceipt?.delivery_success === true;

    // Step 4: State-coherence assertion — no dual-deliver zombie.
    // With redundancy_count=1, there is exactly 1 Sprite; it wins and writes
    // the `.recall` broadcast file (expected — this is the delivery signal).
    // What must NOT exist are `.recalled.json` files, which would indicate a
    // sibling Sprite was incorrectly spawned and then recalled (zombie siblings).
    let stateCoherence = false;
    if (canaryDelivered) {
      try {
        const zombieFiles = readdirSync(SPRITE_ACTIVE_DIR).filter(
          (f) => f.includes(canaryId) && f.endsWith('.recalled.json'),
        );
        stateCoherence = zombieFiles.length === 0;
        if (!stateCoherence) {
          errors.push(`zombie sibling recalls after single-Sprite canary: ${zombieFiles.join(', ')}`);
        }
      } catch (e) {
        errors.push(`coherence scan failed: ${String(e)}`);
      }
    }

    if (canaryReceipt?.errors?.length) {
      for (const e of canaryReceipt.errors) errors.push(e);
    }

    const receipt: ColdStartReceipt = {
      session: opts.session,
      ts,
      stale_files_cleared: staleCleared,
      canary_dispatch_id: canaryId,
      canary_delivered: canaryDelivered,
      canary_latency_ms: latencyMs,
      state_coherence_ok: stateCoherence,
      errors,
    };

    try {
      writeFileSync(
        resolve(SPRITE_RECEIPT_DIR, `${opts.session}_cold_start_${canaryId}.json`),
        JSON.stringify(receipt, null, 2),
      );
    } catch { /* non-fatal */ }

    return receipt;
  }

  /**
   * Update an in-flight dispatch: recall it and re-fire with the new package.
   * If the dispatch is already settled, returns resolution 'already_settled'.
   *
   * Gate G-UPDATE PASS:
   *   resolution === 'resigned_and_refired' AND no zombie delivery from original.
   */
  async updateDispatch(opts: {
    original_dispatch_id: string;
    new_package_path: string;
    session: string;
    candidate_dropzones: string[];
    destination_cluster: ClusterName;
    destination_path_pattern: string;
  }): Promise<UpdateReceipt> {
    const ts = new Date().toISOString();
    const errors: string[] = [];

    const isInFlight = this.active.has(opts.original_dispatch_id);

    // Check if already settled (receipt on disk, not currently active).
    let alreadySettled = false;
    if (!isInFlight) {
      try {
        const settled = readdirSync(SPRITE_RECEIPT_DIR).some((f) =>
          f.includes(opts.original_dispatch_id),
        );
        alreadySettled = settled;
      } catch { /* treat as not found */ }
    }

    if (alreadySettled) {
      return {
        original_dispatch_id: opts.original_dispatch_id,
        new_dispatch_id: null,
        new_package_path: opts.new_package_path,
        resolution: 'already_settled',
        ts,
        errors: ['dispatch already settled; no update possible'],
      };
    }

    if (!isInFlight) {
      return {
        original_dispatch_id: opts.original_dispatch_id,
        new_dispatch_id: null,
        new_package_path: opts.new_package_path,
        resolution: 'not_found',
        ts,
        errors: ['dispatch not found in active registry'],
      };
    }

    // Recall the in-flight original (writes recall flag + aborts in-process).
    this.recall(opts.original_dispatch_id, 'update_resign');

    // Re-fire with the updated package.
    const newDispatchId = `upd-${opts.original_dispatch_id.slice(0, 8)}-${Date.now().toString(36)}`;
    let newReceipt: SpriteDeliveryReceipt | null = null;
    try {
      newReceipt = await this.dispatchSprites({
        dispatch_id: newDispatchId,
        session: opts.session,
        package_path: opts.new_package_path,
        source_cluster: 'bishop',
        destination_cluster: opts.destination_cluster,
        lock_signature: computeLockSignature(opts.destination_cluster, opts.new_package_path),
        destination_path_pattern: opts.destination_path_pattern,
        redundancy_count: 1,
        spawn_timestamp: new Date().toISOString(),
        candidate_dropzones: opts.candidate_dropzones,
      });
    } catch (e) {
      errors.push(`re-fire dispatch threw: ${String(e)}`);
    }

    if (newReceipt && !newReceipt.delivery_success) {
      errors.push(`re-fired dispatch ${newDispatchId} did not deliver`);
    }
    if (newReceipt?.errors?.length) {
      for (const e of newReceipt.errors) errors.push(e);
    }

    const updateReceipt: UpdateReceipt = {
      original_dispatch_id: opts.original_dispatch_id,
      new_dispatch_id: newDispatchId,
      new_package_path: opts.new_package_path,
      resolution: 'resigned_and_refired',
      ts,
      errors,
    };

    try {
      writeFileSync(
        resolve(SPRITE_RECEIPT_DIR, `${opts.session}_update_${opts.original_dispatch_id}.json`),
        JSON.stringify(updateReceipt, null, 2),
      );
    } catch { /* non-fatal */ }

    return updateReceipt;
  }

  /**
   * Get a snapshot of currently-active dispatches (for /yoke/sprite/status).
   */
  getActiveSnapshot(): Array<{
    dispatch_id: string;
    sprite_count: number;
    started_at: string;
  }> {
    const out: Array<{ dispatch_id: string; sprite_count: number; started_at: string }> = [];
    for (const [dispatch_id, handles] of this.active) {
      out.push({
        dispatch_id,
        sprite_count: handles.length,
        started_at: new Date(handles[0]?.startedAt ?? Date.now()).toISOString(),
      });
    }
    return out;
  }

  /**
   * Externally-callable: write a recall flag for a dispatch (admin abort).
   */
  recall(dispatchId: string, reason = 'external_recall'): boolean {
    if (!dispatchId) return false;
    try {
      writeFileSync(
        recallFlagPath(dispatchId),
        JSON.stringify({
          dispatch_id: dispatchId,
          reason,
          ts: new Date().toISOString(),
        }),
      );
      const handles = this.active.get(dispatchId);
      if (handles) {
        for (const h of handles) h.abort();
      }
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Deterministic shuffle using a Linear Congruential Generator seeded by `seed`. */
function pseudoShuffle<T>(arr: T[], seed: number): T[] {
  let s = seed >>> 0;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Cold-Start types ─────────────────────────────────────────────────────

export interface ColdStartReceipt {
  session: string;
  ts: string;
  stale_files_cleared: number;
  canary_dispatch_id: string;
  canary_delivered: boolean;
  canary_latency_ms: number;
  /** True when the canary produced exactly one delivery and no zombie recalls. */
  state_coherence_ok: boolean;
  errors: string[];
}

// ─── Update-path types ────────────────────────────────────────────────────

export type UpdateResolution =
  | 'resigned_and_refired'
  | 'already_settled'
  | 'not_found';

export interface UpdateReceipt {
  original_dispatch_id: string;
  new_dispatch_id: string | null;
  new_package_path: string;
  resolution: UpdateResolution;
  ts: string;
  errors: string[];
}

// ─── Singleton accessor (used by substrate_api Yoke endpoints) ───────────

let _singleton: SpriteRegistry | null = null;
export function getSpriteRegistry(): SpriteRegistry {
  if (!_singleton) {
    _singleton = new SpriteRegistry({
      logger: (l) => console.log(l),
    });
    _singleton.startQueueWatcher();
  }
  return _singleton;
}
