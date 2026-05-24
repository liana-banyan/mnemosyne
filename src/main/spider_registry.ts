// Shadow E-Spider Registry — Bushel 60 Phase C (BP030)
//
// FAISS-v1: cosine-similarity bridge-line query + drift-traversal across substrate.
// Sonnet-small adjudication on the 0.55–0.70 uncertainty band is documented as
// the promotion path; v1 ships with deterministic cosine-only routing so the
// receipt is reproducible.
//
// Architecture reference:
//   ~/Documents/LianaBanyanPlatform/BISHOP_DROPZONE/14_CanonicalReferences/
//     LOCAL_CPU_COMPUTE_ARCHITECTURE_SPRITES_SPIDERS_BP030.md   §4
// Canon eblet:
//   ~/.claude/state/eblets/CANON/shadow_e_sprites_spiders_inter_cluster_courier_web_architecture_bp030.eblet.md
//   (LB-STACK-0160)
//
// Stack:
//   - Python sidecar at  http://127.0.0.1:8765  (sentence-transformers + FAISS)
//   - Substrate filesystem under  ~/.lb_substrate/spider_web/
//
// Substrate is the bus. Per-link JSON files under spider_web/links/ are the
// pheromone strands; each carries similarity, access count, and Chronos pane.

import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from 'fs';
import { resolve, basename } from 'path';
import { randomUUID } from 'crypto';
import { homedir } from 'os';

// ─── Substrate paths ──────────────────────────────────────────────────────

export const LB_SUBSTRATE_ROOT =
  process.env.LB_SUBSTRATE_ROOT ?? resolve(homedir(), '.lb_substrate');

export const SPIDER_WEB_DIR = resolve(LB_SUBSTRATE_ROOT, 'spider_web');
export const SPIDER_LINKS_DIR = resolve(SPIDER_WEB_DIR, 'links');
export const SPIDER_RECEIPT_DIR = resolve(
  LB_SUBSTRATE_ROOT,
  'receipts',
  'spider',
);
export const SPIDER_REQUEST_DIR = resolve(SPIDER_WEB_DIR, 'requests');

export const EMBEDDING_SIDECAR_URL =
  process.env.EMBEDDING_SIDECAR_URL ?? 'http://127.0.0.1:8765';

export function ensureSpiderSubstrateLayout(): void {
  for (const d of [
    LB_SUBSTRATE_ROOT,
    SPIDER_WEB_DIR,
    SPIDER_LINKS_DIR,
    SPIDER_RECEIPT_DIR,
    SPIDER_REQUEST_DIR,
  ]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface SpiderRequest {
  anchor_id: string;
  anchor_path: string;
  session: string;
  drift_budget?: number;             // max bridge-line probe rounds (default 8)
  attach_threshold?: number;         // cosine threshold for attach (default 0.65)
  uncertainty_low?: number;          // adjudication band lower (default 0.55)
  uncertainty_high?: number;         // adjudication band upper (default 0.70)
  per_round_topk?: number;           // candidates fetched per drift round (default 8)
  frame_target?: number;             // anchors required for frame complete (default 5)
  spawn_timestamp: string;           // Chronos pane (ISO 8601)
}

export interface PheromoneLink {
  link_id: string;
  source_anchor_id: string;
  dest_anchor_id: string;
  source_anchor_path: string;
  dest_anchor_path: string;
  similarity: number;                // cosine, normalized vectors -> [-1, 1]
  access_count: number;              // bumped each time a link is reinforced
  chronos_pane: string;              // ISO 8601 — when link first written
  last_reinforced: string;           // ISO 8601 — most recent reinforcement
  session: string;
}

export interface SpiderReceipt {
  anchor_id: string;
  anchor_path: string;
  session: string;
  spawn_timestamp: string;
  termination_timestamp: string;
  drift_rounds_executed: number;
  candidates_probed: number;
  anchors_attached: number;
  frame_size: number;                // distinct anchors in frame (incl. source)
  pheromone_links_written: number;
  pheromone_links_reinforced: number;
  average_link_similarity: number;
  similarity_distribution: Record<string, number>;
  attached_anchor_ids: string[];
  uncertain_band_skipped: number;    // count of 0.55–0.70 cases skipped (no Sonnet)
  errors: string[];
  termination_reason:
    | 'frame_target_reached'
    | 'drift_budget_exhausted'
    | 'no_new_candidates'
    | 'sidecar_unreachable';
}

// ─── Sidecar IPC (built-in fetch in Node 18+/Electron) ────────────────────

interface SimilarHit {
  id: string;
  path: string;
  similarity: number;
  rank: number;
}

async function sidecarSimilar(
  text: string,
  k: number,
  excludeIds: string[],
): Promise<SimilarHit[]> {
  const res = await fetch(`${EMBEDDING_SIDECAR_URL}/similar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, k, exclude_ids: excludeIds }),
  });
  if (!res.ok) {
    throw new Error(`sidecar /similar failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { hits: SimilarHit[] };
  return data.hits;
}

async function sidecarHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${EMBEDDING_SIDECAR_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Pheromone link IO ────────────────────────────────────────────────────

function linkFilename(srcId: string, destId: string): string {
  // safe filename: replace any non-alnum/_/-/. with _
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return `${sanitize(srcId)}__${sanitize(destId)}.json`;
}

function loadLink(srcId: string, destId: string): PheromoneLink | null {
  const p = resolve(SPIDER_LINKS_DIR, linkFilename(srcId, destId));
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as PheromoneLink;
  } catch {
    return null;
  }
}

function saveLink(link: PheromoneLink): void {
  const p = resolve(SPIDER_LINKS_DIR, linkFilename(
    link.source_anchor_id,
    link.dest_anchor_id,
  ));
  writeFileSync(p, JSON.stringify(link, null, 2), 'utf-8');
}

/** Write a fresh pheromone link, or reinforce an existing one. */
export function reinforcePheromoneLink(args: {
  source_anchor_id: string;
  source_anchor_path: string;
  dest_anchor_id: string;
  dest_anchor_path: string;
  similarity: number;
  session: string;
}): { wrote: boolean; reinforced: boolean; link: PheromoneLink } {
  const now = new Date().toISOString();
  const existing = loadLink(args.source_anchor_id, args.dest_anchor_id);
  if (existing) {
    existing.access_count += 1;
    existing.last_reinforced = now;
    // similarity is monotonically tracked: keep max observed
    if (args.similarity > existing.similarity) {
      existing.similarity = args.similarity;
    }
    saveLink(existing);
    return { wrote: false, reinforced: true, link: existing };
  }
  const link: PheromoneLink = {
    link_id: randomUUID(),
    source_anchor_id: args.source_anchor_id,
    source_anchor_path: args.source_anchor_path,
    dest_anchor_id: args.dest_anchor_id,
    dest_anchor_path: args.dest_anchor_path,
    similarity: args.similarity,
    access_count: 1,
    chronos_pane: now,
    last_reinforced: now,
    session: args.session,
  };
  saveLink(link);
  return { wrote: true, reinforced: false, link };
}

// ─── Drift-traversal core ─────────────────────────────────────────────────

interface AttachedAnchor {
  id: string;
  path: string;
  similarity_to_source: number;
}

/**
 * Bridge-line query + drift traversal + multi-anchor reinforcement.
 *
 * v1 is deterministic (top-K cosine; threshold attach; no stochastic walk).
 * The Founder-canonical "drifts in the wind" is preserved as the per-round
 * fan-out from the *current attached frontier* rather than only the source —
 * the bridge line is launched from each newly-attached anchor in turn,
 * accumulating frame anchors until target / budget / no-new-candidates.
 *
 * Promotion path:
 *   - stochastic top-K selection weighted by similarity
 *   - Sonnet-small adjudication for similarities in [uncertainty_low, uncertainty_high]
 */
export async function runSpider(req: SpiderRequest): Promise<SpiderReceipt> {
  ensureSpiderSubstrateLayout();

  const driftBudget = req.drift_budget ?? 8;
  const attachThreshold = req.attach_threshold ?? 0.65;
  const uncertaintyLow = req.uncertainty_low ?? 0.55;
  const uncertaintyHigh = req.uncertainty_high ?? 0.70;
  const perRoundTopK = req.per_round_topk ?? 8;
  const frameTarget = req.frame_target ?? 5;

  const errors: string[] = [];
  let candidatesProbed = 0;
  let anchorsAttached = 0;
  let linksWritten = 0;
  let linksReinforced = 0;
  let driftRoundsExecuted = 0;
  let uncertainBandSkipped = 0;
  let terminationReason: SpiderReceipt['termination_reason'] =
    'drift_budget_exhausted';

  // Sidecar reachable?
  if (!(await sidecarHealth())) {
    return {
      anchor_id: req.anchor_id,
      anchor_path: req.anchor_path,
      session: req.session,
      spawn_timestamp: req.spawn_timestamp,
      termination_timestamp: new Date().toISOString(),
      drift_rounds_executed: 0,
      candidates_probed: 0,
      anchors_attached: 0,
      frame_size: 1,
      pheromone_links_written: 0,
      pheromone_links_reinforced: 0,
      average_link_similarity: 0,
      similarity_distribution: {},
      attached_anchor_ids: [],
      uncertain_band_skipped: 0,
      errors: ['sidecar_unreachable'],
      termination_reason: 'sidecar_unreachable',
    };
  }

  // Read anchor content (text used as the bridge-line query basis)
  let anchorText = '';
  try {
    anchorText = readFileSync(req.anchor_path, 'utf-8');
  } catch (e) {
    errors.push(`anchor_read_failed: ${(e as Error).message}`);
  }
  const anchorQueryText = anchorText.slice(0, 8000);

  // Frontier = anchors we should drift from; visited = excluded from results
  const visited = new Set<string>([req.anchor_id]);
  const attached: AttachedAnchor[] = [];
  const linkSimilarities: number[] = [];

  // Frontier seeded with the source anchor; expand outward.
  type FrontierItem = { id: string; path: string; queryText: string };
  let frontier: FrontierItem[] = [
    { id: req.anchor_id, path: req.anchor_path, queryText: anchorQueryText },
  ];

  for (let round = 0; round < driftBudget; round++) {
    if (frontier.length === 0) {
      terminationReason = 'no_new_candidates';
      break;
    }
    driftRoundsExecuted++;
    const newFrontier: FrontierItem[] = [];
    let anyAttachedThisRound = false;

    for (const node of frontier) {
      let hits: SimilarHit[] = [];
      try {
        hits = await sidecarSimilar(
          node.queryText,
          perRoundTopK,
          Array.from(visited),
        );
      } catch (e) {
        errors.push(`similar_call_failed: ${(e as Error).message}`);
        continue;
      }
      candidatesProbed += hits.length;

      for (const h of hits) {
        if (visited.has(h.id)) continue;
        if (h.similarity >= attachThreshold) {
          // Attach: reinforce link from the *frontier node* that found it,
          // AND from the source anchor (multi-anchor frame reinforcement).
          visited.add(h.id);
          anchorsAttached++;
          anyAttachedThisRound = true;
          attached.push({
            id: h.id,
            path: h.path,
            similarity_to_source: h.similarity,
          });
          linkSimilarities.push(h.similarity);

          const r1 = reinforcePheromoneLink({
            source_anchor_id: node.id,
            source_anchor_path: node.path,
            dest_anchor_id: h.id,
            dest_anchor_path: h.path,
            similarity: h.similarity,
            session: req.session,
          });
          if (r1.wrote) linksWritten++;
          else linksReinforced++;

          if (node.id !== req.anchor_id) {
            // also reinforce from the source anchor — frame reinforcement
            const r2 = reinforcePheromoneLink({
              source_anchor_id: req.anchor_id,
              source_anchor_path: req.anchor_path,
              dest_anchor_id: h.id,
              dest_anchor_path: h.path,
              similarity: h.similarity,
              session: req.session,
            });
            if (r2.wrote) linksWritten++;
            else linksReinforced++;
          }

          // queue for next-round drift
          let extText = '';
          try {
            extText = readFileSync(h.path, 'utf-8').slice(0, 8000);
          } catch {
            extText = h.id; // fall back to id-as-query if file unreadable
          }
          newFrontier.push({ id: h.id, path: h.path, queryText: extText });
        } else if (
          h.similarity >= uncertaintyLow &&
          h.similarity < uncertaintyHigh
        ) {
          // Uncertainty band — promotion path is Sonnet-small adjudication.
          // v1 abstains and counts the skip.
          uncertainBandSkipped++;
        }
      }

      if (attached.length >= frameTarget) break;
    }

    if (attached.length >= frameTarget) {
      terminationReason = 'frame_target_reached';
      break;
    }
    if (!anyAttachedThisRound) {
      terminationReason = 'no_new_candidates';
      break;
    }
    frontier = newFrontier;
  }

  // Build similarity distribution buckets
  const dist: Record<string, number> = {
    '0.65-0.70': 0,
    '0.70-0.80': 0,
    '0.80-0.90': 0,
    '0.90+': 0,
  };
  for (const s of linkSimilarities) {
    if (s >= 0.9) dist['0.90+']++;
    else if (s >= 0.8) dist['0.80-0.90']++;
    else if (s >= 0.7) dist['0.70-0.80']++;
    else dist['0.65-0.70']++;
  }
  const avgSim =
    linkSimilarities.length > 0
      ? linkSimilarities.reduce((a, b) => a + b, 0) / linkSimilarities.length
      : 0;

  const receipt: SpiderReceipt = {
    anchor_id: req.anchor_id,
    anchor_path: req.anchor_path,
    session: req.session,
    spawn_timestamp: req.spawn_timestamp,
    termination_timestamp: new Date().toISOString(),
    drift_rounds_executed: driftRoundsExecuted,
    candidates_probed: candidatesProbed,
    anchors_attached: anchorsAttached,
    frame_size: visited.size, // includes source anchor
    pheromone_links_written: linksWritten,
    pheromone_links_reinforced: linksReinforced,
    average_link_similarity: Number(avgSim.toFixed(4)),
    similarity_distribution: dist,
    attached_anchor_ids: attached.map((a) => a.id),
    uncertain_band_skipped: uncertainBandSkipped,
    errors,
    termination_reason: terminationReason,
  };

  // Persist receipt
  const receiptName = `${req.session}_${basename(
    req.anchor_id,
  ).replace(/[^a-zA-Z0-9_.-]/g, '_')}.json`;
  writeFileSync(
    resolve(SPIDER_RECEIPT_DIR, receiptName),
    JSON.stringify(receipt, null, 2),
    'utf-8',
  );

  return receipt;
}

// ─── Registry façade ──────────────────────────────────────────────────────

export interface SpiderDispatchInput {
  anchor_path: string;
  anchor_id?: string;
  session?: string;
  drift_budget?: number;
  attach_threshold?: number;
  per_round_topk?: number;
  frame_target?: number;
}

export async function dispatchSpider(
  input: SpiderDispatchInput,
): Promise<SpiderReceipt> {
  ensureSpiderSubstrateLayout();
  const anchorId =
    input.anchor_id ??
    basename(input.anchor_path).replace(/\.eblet\.md$|\.md$/i, '');
  const session = input.session ?? 'BP030';
  const req: SpiderRequest = {
    anchor_id: anchorId,
    anchor_path: input.anchor_path,
    session,
    drift_budget: input.drift_budget,
    attach_threshold: input.attach_threshold,
    per_round_topk: input.per_round_topk,
    frame_target: input.frame_target,
    spawn_timestamp: new Date().toISOString(),
  };
  return runSpider(req);
}

/** Read all pheromone links (for inspection / receipts). */
export function listPheromoneLinks(): PheromoneLink[] {
  ensureSpiderSubstrateLayout();
  const out: PheromoneLink[] = [];
  for (const f of readdirSync(SPIDER_LINKS_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      out.push(
        JSON.parse(
          readFileSync(resolve(SPIDER_LINKS_DIR, f), 'utf-8'),
        ) as PheromoneLink,
      );
    } catch {
      /* ignore corrupt links */
    }
  }
  return out;
}
