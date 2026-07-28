// semantic_centroid.ts -- BP137 Yoke (Semantic Match Durable), STEP 3 (Founder's design)
//
// Different phrasings of the same underlying question cluster near each other in embedding
// space. This module maintains a running-mean CENTROID per question-cluster and derives a
// canonical semantic code (SimHash of the centroid) for that cluster -- used to detect
// write-back pollution: multiple near-duplicate whole_answer eblets for the same effective
// question that should collapse toward one centroid-addressed record instead of accumulating
// N near-copies.
//
// Deliberately ANALYSIS-ONLY here: this module clusters + reports, it never deletes or rewrites
// an eblet in place (Rule 66, same discipline as every other reader in mnem_eblet_store.ts).
// Actual live-store mutation (if ever performed) is a separate, explicit, backed-up operation
// -- see the BP137 report for why Step 3's live collapse was validated against a snapshot
// rather than applied to the live file this session.
//
// The embed function is INJECTED (not imported from ollama_manager.ts directly) so this module
// has zero Electron-runtime coupling and can be exercised from a plain Node driver script
// against a store snapshot, exactly as it would run in-process via ollamaManager.embed.

import { l2Normalize, simhashBits, bitsToHex32 } from './semantic_soccerball';
import type { VerifiedEbletEntry } from './mnem_eblet_store';

export type EmbedFn = (text: string) => Promise<number[] | null>;

export interface CentroidCluster {
  /** Running-mean centroid vector, updated incrementally as members are added. */
  centroid: number[];
  memberCount: number;
  /** The eblets currently assigned to this cluster. */
  members: VerifiedEbletEntry[];
  /** SimHash(centroid) rendered as the 32-hex Soccerball wire format -- the canonical semantic
   *  code for this cluster (recomputed lazily by canonicalCodeForCluster(), not cached here). */
}

// BP137 Yoke v2b Stage A.0.1 (semantic relevance gate upgrade): exported (was private to this
// file) so plow/semantic_relevance_gate.ts can reuse this EXACT formula instead of duplicating
// it -- see that file's header comment for the reuse rationale. No behavior change to any
// existing caller in this file (clusterByEmbedding below still calls it the same way).
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/** Incremental running-mean update: newCentroid = (centroid*n + newVec) / (n+1). */
function updateCentroid(centroid: number[], n: number, newVec: number[]): number[] {
  const len = Math.min(centroid.length, newVec.length);
  const out = new Array(len);
  for (let i = 0; i < len; i++) out[i] = (centroid[i] * n + newVec[i]) / (n + 1);
  return out;
}

/** SimHash(centroid) -> 32-hex canonical code for a cluster, same wire shape as every other
 *  Soccerball/semantic code in this Yoke. */
export function canonicalCodeForCluster(cluster: CentroidCluster): string {
  const normalized = l2Normalize(cluster.centroid);
  const bits = simhashBits(normalized);
  return bitsToHex32(bits);
}

/**
 * Greedy single-pass clustering: for each (entry, embedding) pair, assign to the nearest
 * EXISTING cluster if cosine similarity to that cluster's current centroid clears
 * `similarityThreshold`; otherwise start a new singleton cluster. New phrasings that join an
 * existing cluster UPDATE that cluster's running-mean centroid (Founder's design: "new
 * phrasings update the centroid").
 *
 * Deliberately O(entries * clusters) greedy, not a full pairwise/agglomerative clustering --
 * simple, explainable, and sufficient for the pollution this Yoke targets (a handful of near-
 * identical repeated-ask variants per question, not thousands of clusters).
 */
export function clusterByEmbedding(
  items: Array<{ entry: VerifiedEbletEntry; vector: number[] }>,
  similarityThreshold: number,
): CentroidCluster[] {
  const clusters: CentroidCluster[] = [];
  for (const { entry, vector } of items) {
    let best: { cluster: CentroidCluster; sim: number } | null = null;
    for (const cluster of clusters) {
      const sim = cosineSimilarity(cluster.centroid, vector);
      if (!best || sim > best.sim) best = { cluster, sim };
    }
    if (best && best.sim >= similarityThreshold) {
      best.cluster.centroid = updateCentroid(best.cluster.centroid, best.cluster.memberCount, vector);
      best.cluster.memberCount += 1;
      best.cluster.members.push(entry);
    } else {
      clusters.push({ centroid: vector.slice(), memberCount: 1, members: [entry] });
    }
  }
  return clusters;
}

export interface DuplicateAnalysisResult {
  totalWholeAnswerEntries: number;
  entriesEmbedded: number;
  entriesSkippedNoEmbedding: number;
  clusters: CentroidCluster[];
  duplicateClusters: CentroidCluster[];
  /** Total number of RECORDS that would collapse into one canonical record per duplicate
   *  cluster, i.e. sum(memberCount - 1) over duplicateClusters -- the real, honest "how many
   *  dupes would this remove" count the BP137 spec asks for. */
  recordsThatWouldCollapse: number;
}

/**
 * Runs the full Step 3 dedup analysis over a snapshot of `entries` (typically the output of
 * loadAllVerifiedEblets(), or a copy loaded from a backup file for a live-store dry run).
 * Only class:'whole_answer' (or classless/legacy, same convention as every other reader in
 * this Yoke) entries are considered -- component fragments are never independently servable
 * and are out of scope for this dedup pass. ANALYSIS ONLY: never mutates `entries` or any file.
 */
export async function analyzeDuplicateClusters(
  entries: VerifiedEbletEntry[],
  embedFn: EmbedFn,
  similarityThreshold: number,
): Promise<DuplicateAnalysisResult> {
  const wholeAnswerEntries = entries.filter((e) => e.class !== 'component');
  const items: Array<{ entry: VerifiedEbletEntry; vector: number[] }> = [];
  let skipped = 0;

  for (const entry of wholeAnswerEntries) {
    const vec = await embedFn(entry.question);
    if (!vec) { skipped += 1; continue; }
    items.push({ entry, vector: vec });
  }

  const clusters = clusterByEmbedding(items, similarityThreshold);
  const duplicateClusters = clusters.filter((c) => c.memberCount > 1);
  const recordsThatWouldCollapse = duplicateClusters.reduce((sum, c) => sum + (c.memberCount - 1), 0);

  return {
    totalWholeAnswerEntries: wholeAnswerEntries.length,
    entriesEmbedded: items.length,
    entriesSkippedNoEmbedding: skipped,
    clusters,
    duplicateClusters,
    recordsThatWouldCollapse,
  };
}
