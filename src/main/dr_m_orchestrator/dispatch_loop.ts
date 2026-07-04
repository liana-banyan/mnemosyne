// dispatch_loop.ts -- Mountain 1 · I-D · Dispatch Loop Wire-Up (Council-Default)
// KNIGHT MARATHON 4 · BP089 · BLACK MAMBA
//
// Ties substrate_reader + brain_swap + hex_mcode + minor_star_chamber into the
// existing peer dispatch path. Dr. M's orchestration tick runs here.
//
// DEFAULT dispatch path is Minor Council via selectCouncil().
// Single-brain dispatch is a special case (speed-critical / known-low-variance).
// Smart Router ({ auto: true }) chooses Court Package by task category.
//
// Logging: every dispatch writes to:
//   dr_m_dispatch_log    (every dispatch)
//   brain_swap_audit     (every brain/council selection)
//   council_dispatch_log (every council dispatch)
// via Supabase REST (Bishop applies SQL schema from BISHOP_DROPZONE/sql/).
//
// IPC: registers 'dr-m-dispatch' channel (MOUNTAIN_1_ADDITION · pure addition · no modifications).

import { ipcMain } from 'electron';
import { randomUUID, createHash } from 'node:crypto';
import type { SubstrateReader, DatabaseConfig } from './substrate_reader';
import type { CCI, TaskCategory, ModelId } from './brain_swap';
import { selectCouncil, selectBrain } from './brain_swap';
import { encode, decode } from './hex_mcode';
import type { FrameType } from './hex_mcode';
import { minorCouncil } from './minor_star_chamber';
import type { CourtPackageLibrary, CouncilPackageName } from './court_packages';
import type { RelayClient } from '../federation/relay-client';
// MOUNTAIN_1b_ADDITION: PLOW LOOP default Council path
import { runPlowLoop } from './plow/plow_loop';

// ─── Dispatch mode ────────────────────────────────────────────────────────────────

export type DispatchMode =
  | { council: CouncilPackageName }
  | { single_brain: ModelId }
  | { auto: true };

// ─── Request / Result ─────────────────────────────────────────────────────────────

export interface DispatchRequest {
  task_id: string;
  category: TaskCategory;
  prompt: string;
  target_peer?: string;
  substrate_inject: boolean;
  mode?: DispatchMode;
}

export interface DispatchResult {
  task_id: string;
  response: string;
  brain_used: string;
  dispatch_mode: 'council' | 'single_brain';
  council_variance?: number;
  council_escalated?: boolean;
  council_member_count?: number;
  substrate_context_bytes: number;
  latency_ms: number;
  hex_frame_size_bytes: number;
  peer_id?: string;
  // MOUNTAIN_1b_ADDITION: PLOW LOOP metadata (pure additions · not breaking)
  plow_confidence?: number;     // from PlowLoopResult.confidence
  plow_iterations?: number;     // from PlowLoopResult.iterations
  plow_domain?: string;         // from PlowLoopResult.domain
  plow_advantage_size?: number; // from PlowLoopResult.advantage_used.bundle_size_bytes
}

// ─── DispatchLoop interface ───────────────────────────────────────────────────────

export interface DispatchLoop {
  dispatch(req: DispatchRequest): Promise<DispatchResult>;
  shutdown(): Promise<void>;
}

// ─── Supabase logging helpers ─────────────────────────────────────────────────────

async function supabaseInsert(
  db: DatabaseConfig,
  table: string,
  row: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(`${db.supabaseUrl}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: db.anonKey,
        Authorization: `Bearer ${db.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
  } catch {
    // Fire-and-forget logging · never throw from log path
  }
}

// ─── createDispatchLoop ───────────────────────────────────────────────────────────

export function createDispatchLoop(
  reader: SubstrateReader,
  brains: CCI[],
  relay: RelayClient | null,
  packages: CourtPackageLibrary,
  db?: DatabaseConfig
): DispatchLoop {

  async function dispatch(req: DispatchRequest): Promise<DispatchResult> {
    const t0 = Date.now();
    const mode = req.mode ?? { auto: true };

    // Step 1: Read substrate
    const substrateContext = req.substrate_inject
      ? await reader.read().catch((_e) => {
          console.warn('[DispatchLoop] substrate read failed, using minimal context');
          return {
            timestamp: new Date().toISOString(),
            peer_count: 0,
            recent_peers: [],
            recent_pearls: [],
            hot_eblets: [],
            active_pheromones: [],
            context_size_bytes: 0,
            query_latency_ms: 0,
          };
        })
      : {
          timestamp: new Date().toISOString(),
          peer_count: 0,
          recent_peers: [],
          recent_pearls: [],
          hot_eblets: [],
          active_pheromones: [],
          context_size_bytes: 0,
          query_latency_ms: 0,
        };

    let result: DispatchResult;

    // ─── Council path (DEFAULT) ───────────────────────────────────────────────────

    if ('council' in mode || 'auto' in mode) {
      const packageName: CouncilPackageName = 'council' in mode
        ? mode.council
        : (() => {
            // Smart Router: task category → council
            const categoryMap: Record<TaskCategory, CouncilPackageName> = {
              substrate_query:     'reader_council',
              reasoning_hard:      'strategic_council',
              peer_dispatch:       'composer_council',
              routine_summarize:   'reader_council',
              tool_required:       'adjudicator_council',
              scribe_enforcement:  'enforcement_council',
              librarian_query:     'librarian_council',
            };
            return categoryMap[req.category] ?? 'composer_council';
          })();

      // Step 2: Load package (lazy, cached)
      const pkg = await packages.get(packageName);

      // Step 3: Select council
      const councilSelection = selectCouncil(req.category, [pkg]);

      // Step 4: Encode council_request hex frame
      const councilRequestFrame = encode('council_request' as FrameType, {
        task_id: req.task_id,
        council_package: packageName,
        question_hash: createHash('sha256').update(req.prompt).digest('hex').slice(0, 16),
        member_count: councilSelection.members.length,
      });

      // Step 5: MOUNTAIN_1b_ADDITION — runPlowLoop replaces raw minorCouncil fan-out
      // Default Council path now flows through the PLOW LOOP:
      //   classifyQueryDomain → plowDomainAdvantage → primed minorCouncil → scoreConfidence
      // The single-brain path is UNCHANGED (speed-critical / known-low-variance special case).
      const plowResult = await runPlowLoop(req.prompt, packageName, reader, {
        maxIterations: 3,
        confidenceThreshold: 0.75,
        db: db,
      }); // MOUNTAIN_1b_ADDITION

      // Map PlowLoopResult → MinorCouncilResult shape for downstream logging compatibility
      const councilResult = {
        result: plowResult.answer,
        variance: plowResult.council_variance,
        escalated: plowResult.escalated,
        member_answers: [] as Array<{ brain_id: string; answer: string; tokens_used: number; latency_ms: number }>,
        council_package: packageName,
        members_fired: 0,
        latency_ms: plowResult.total_latency_ms,
      };

      // Step 6+7: scoreConvergence + escalation handled inside minorCouncil

      // Step 8: Encode result frame
      const resultPayload = {
        task_id: req.task_id,
        council_package: packageName,
        variance: councilResult.variance,
        escalated: councilResult.escalated,
        response_excerpt: councilResult.result.slice(0, 500),
      };
      const resultFrame = councilResult.escalated
        ? encode('council_escalation' as FrameType, resultPayload)
        : encode('council_response' as FrameType, resultPayload);

      const decodedFrame = decode(resultFrame);

      const latencyMs = Date.now() - t0;

      // Step 9: Logging
      if (db) {
        const questionHash = createHash('sha256').update(req.prompt).digest('hex');

        await Promise.allSettled([
          supabaseInsert(db, 'dr_m_dispatch_log', {
            id: randomUUID(),
            task_id: req.task_id,
            created_at: new Date().toISOString(),
            category: req.category,
            prompt_excerpt: req.prompt.slice(0, 500),
            brain_used: packageName,
            brain_vendor: 'local',
            dispatch_mode: 'council',
            brain_fallback: 0,
            council_package_name: packageName,
            council_variance: councilResult.variance,
            council_escalated: councilResult.escalated ? 1 : 0,
            council_member_count: councilResult.members_fired,
            target_peer_id: req.target_peer ?? null,
            substrate_context_bytes: substrateContext.context_size_bytes,
            hex_frame_size_bytes: resultFrame.length / 2,
            crc_valid: decodedFrame.crc_valid ? 1 : 0,
            latency_ms: latencyMs,
            response_excerpt: councilResult.result.slice(0, 500),
            status: 'ok',
          }),
          supabaseInsert(db, 'brain_swap_audit', {
            id: randomUUID(),
            task_id: req.task_id,
            created_at: new Date().toISOString(),
            category: req.category,
            selection_type: 'council',
            brain_selected: packageName,
            brain_vendor: 'local',
            selection_reason: 'smart_router_council',
            cost_per_1k_tokens: 0,
          }),
          supabaseInsert(db, 'council_dispatch_log', {
            id: randomUUID(),
            task_id: req.task_id,
            created_at: new Date().toISOString(),
            council_package: packageName,
            question_hash: questionHash,
            prompt_excerpt: req.prompt.slice(0, 500),
            members_fired: councilResult.members_fired,
            member_answers: JSON.stringify(
              councilResult.member_answers.map((a) => ({
                brain_id: a.brain_id,
                answer_excerpt: a.answer.slice(0, 200),
                latency_ms: a.latency_ms,
              }))
            ),
            variance: councilResult.variance,
            variance_threshold: pkg.variance_threshold,
            escalated: councilResult.escalated ? 1 : 0,
            escalation_brain: councilResult.escalated ? 'claude-sonnet-4-6' : null,
            aggregate_answer_excerpt: councilResult.result.slice(0, 500),
            total_latency_ms: latencyMs,
            substrate_context_bytes: substrateContext.context_size_bytes,
            status: councilResult.escalated ? 'escalated' : 'ok',
          }),
        ]);
      }

      result = {
        task_id: req.task_id,
        response: councilResult.result,
        brain_used: packageName,
        dispatch_mode: 'council',
        council_variance: councilResult.variance,
        council_escalated: councilResult.escalated,
        council_member_count: councilResult.members_fired,
        substrate_context_bytes: substrateContext.context_size_bytes,
        latency_ms: latencyMs,
        hex_frame_size_bytes: resultFrame.length / 2,
        peer_id: req.target_peer,
        // MOUNTAIN_1b_ADDITION: PLOW LOOP metadata
        plow_confidence: plowResult.confidence,
        plow_iterations: plowResult.iterations,
        plow_domain: String(plowResult.domain),
        plow_advantage_size: plowResult.advantage_used.bundle_size_bytes,
      };

    } else {
      // ─── Single-brain path (SPECIAL CASE) ──────────────────────────────────────

      // Step 1: selectBrain
      const targetBrainId = 'single_brain' in mode ? mode.single_brain : undefined;
      let brain = targetBrainId
        ? brains.find((b) => b.brain_id === targetBrainId) ?? selectBrain(req.category, brains)
        : selectBrain(req.category, brains);

      // Step 3: brain.reason()
      const cciResponse = await brain.reason(req.prompt, substrateContext);

      // Step 4: encode dispatch_request
      const dispatchFrame = encode('dispatch_request', {
        task_id: req.task_id,
        category: req.category,
        brain_id: brain.brain_id,
        prompt_excerpt: req.prompt.slice(0, 200),
      });

      // Step 7: decode round-trip CRC validation
      const decodedFrame = decode(dispatchFrame);

      const latencyMs = Date.now() - t0;

      // Step 8: Log
      if (db) {
        await Promise.allSettled([
          supabaseInsert(db, 'dr_m_dispatch_log', {
            id: randomUUID(),
            task_id: req.task_id,
            created_at: new Date().toISOString(),
            category: req.category,
            prompt_excerpt: req.prompt.slice(0, 500),
            brain_used: brain.brain_id,
            brain_vendor: brain.vendor,
            dispatch_mode: 'single_brain',
            brain_fallback: 0,
            council_package_name: null,
            council_variance: null,
            council_escalated: null,
            council_member_count: null,
            target_peer_id: req.target_peer ?? null,
            substrate_context_bytes: substrateContext.context_size_bytes,
            hex_frame_size_bytes: dispatchFrame.length / 2,
            crc_valid: decodedFrame.crc_valid ? 1 : 0,
            latency_ms: latencyMs,
            response_excerpt: cciResponse.content.slice(0, 500),
            status: 'ok',
          }),
          supabaseInsert(db, 'brain_swap_audit', {
            id: randomUUID(),
            task_id: req.task_id,
            created_at: new Date().toISOString(),
            category: req.category,
            selection_type: 'single_brain',
            brain_selected: brain.brain_id,
            brain_vendor: brain.vendor,
            selection_reason: targetBrainId ? 'explicit_override' : 'auto_single_brain',
            cost_per_1k_tokens: brain.cost_per_1k_tokens,
          }),
        ]);
      }

      result = {
        task_id: req.task_id,
        response: cciResponse.content,
        brain_used: brain.brain_id,
        dispatch_mode: 'single_brain',
        substrate_context_bytes: substrateContext.context_size_bytes,
        latency_ms: latencyMs,
        hex_frame_size_bytes: dispatchFrame.length / 2,
        peer_id: req.target_peer,
      };
    }

    return result;
  }

  async function shutdown(): Promise<void> {
    // Clean shutdown (no persistent connections to close in v0.5.x)
  }

  return { dispatch, shutdown };
}

// ─── IPC: dr-m-dispatch (MOUNTAIN_1_ADDITION · pure addition) ────────────────────

let _loopInstance: DispatchLoop | null = null;

export function registerDrMDispatchIPC(loop: DispatchLoop): void {
  _loopInstance = loop;
  // MOUNTAIN_1_ADDITION
  ipcMain.handle('dr-m-dispatch', async (_event, req: DispatchRequest) => {
    if (!_loopInstance) return { error: 'DispatchLoop not initialized' };
    try {
      return await _loopInstance.dispatch(req);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });
}
