// semantic_soccerball.ts -- BP137 Yoke (Semantic Match Durable), STEP 1 (additive, new file)
//
// This is a NEW, standalone semantic-code primitive. It does NOT replace, wrap, or call
// caithedral-core's existing soccerball_emit (see
// C:\Users\Administrator\Documents\mnemosyne\caithedral-core\src\tools\soccerball_tools.ts) --
// that function is a content-addressed SHA-256 hash of pearl_ids + bindings
// (`createHash('sha256').update(JSON.stringify({p,b})).digest('hex').slice(0,32)`), confirmed
// this session to be structurally a 32-LOWERCASE-HEX-CHARACTER string (128 bits), NOT semantic.
//
// semantic_soccerball_emit() below produces a code in the SAME 32-hex-char wire shape (so it is
// structurally interchangeable with a sha256 Soccerball ID anywhere a bare hex string is stored/
// compared), but the 128 bits are filled by SimHash/random-hyperplane LSH over an L2-normalized
// Ollama embedding vector of the input text, instead of a content hash. Hamming distance between
// two such codes approximates cosine similarity between their source texts -- that is the
// semantic-match signal this Yoke wires into the answer-cache (see mnem_eblet_store.ts /
// ai_dispatch_ipc.ts for the read/write integration).
//
// Fail-soft contract (mandatory, matches ollamaManager.embed()'s own contract): every exported
// function that depends on a live embedding returns null when the embedding is unavailable for
// that text (network error, model missing, malformed response) -- NEVER throws. Callers MUST
// treat null as "semantic match unavailable for this request" and fall back to the existing
// token-similarity path (computeQuestionSimilaritySymmetric in mnem_eblet_store.ts).

import { ollamaManager } from './ollama_manager';

/** 128-bit code -- same bit-width as the existing 32-hex-char Soccerball wire format. */
const SIMHASH_BITS = 128;

// BP137 Yoke: fixed seed (not time-based) so the random hyperplanes generated within THIS
// process are: (a) reproducible run-to-run/restart-to-restart -- essential because semantic
// codes are PERSISTED in verified_eblets.jsonl and must remain Hamming-comparable against
// codes computed by a future app launch, and (b) consistent for the lifetime of one process,
// so two calls in the same session are always comparable. This is deliberately NOT a
// cryptographic random source -- LSH hyperplanes only need statistical properties, not secrecy.
const HYPERPLANE_SEED = 0x5ea1c0de;

function mulberry32(seed: number): () => number {
  let a = seed;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cached per embedding-dimensionality (nomic-embed-text is confirmed 768-dim this session; a
// future different embed model with a different vector length still gets its own consistent,
// deterministic hyperplane set, keyed by dim, rather than silently reusing mismatched planes).
const _hyperplaneCache = new Map<number, number[][]>();

function getHyperplanes(dim: number): number[][] {
  const cached = _hyperplaneCache.get(dim);
  if (cached) return cached;

  const rand = mulberry32(HYPERPLANE_SEED);
  const planes: number[][] = [];
  for (let i = 0; i < SIMHASH_BITS; i++) {
    const plane: number[] = new Array(dim);
    for (let j = 0; j < dim; j++) {
      // Box-Muller transform -> standard-normal components, the conventional random-hyperplane
      // normal-vector distribution for SimHash/random-hyperplane LSH (Charikar's algorithm).
      const u1 = Math.max(rand(), 1e-12);
      const u2 = rand();
      plane[j] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    planes.push(plane);
  }
  _hyperplaneCache.set(dim, planes);
  return planes;
}

/** L2-normalize a vector to unit length. Zero/degenerate vectors are returned unchanged
 *  (defensive -- Ollama has never been observed to emit an all-zero embedding, but a divide-
 *  by-zero must never throw). */
export function l2Normalize(vec: number[]): number[] {
  let sumSq = 0;
  for (const v of vec) sumSq += v * v;
  const norm = Math.sqrt(sumSq);
  if (norm === 0 || !Number.isFinite(norm)) return vec.slice();
  return vec.map((v) => v / norm);
}

/** SimHash: project the vector onto SIMHASH_BITS random hyperplanes, one bit per plane (sign
 *  of the dot product). Two vectors with small angle between them agree on most bits. */
export function simhashBits(vec: number[]): number[] {
  const planes = getHyperplanes(vec.length);
  return planes.map((plane) => {
    let dot = 0;
    for (let i = 0; i < vec.length; i++) dot += vec[i] * plane[i];
    return dot >= 0 ? 1 : 0;
  });
}

/** Pack 128 bits into 32 lowercase hex chars -- the existing Soccerball wire format
 *  (4 bits/nibble per hex char, MSB-first within each nibble; self-consistent with
 *  hex32ToBits below, which is all Hamming-distance comparison requires). */
export function bitsToHex32(bits: number[]): string {
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    const nibble = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
    hex += nibble.toString(16);
  }
  return hex;
}

export function hex32ToBits(hex: string): number[] {
  const bits: number[] = [];
  for (const ch of hex) {
    const n = parseInt(ch, 16);
    if (Number.isNaN(n)) continue;
    bits.push((n >> 3) & 1, (n >> 2) & 1, (n >> 1) & 1, n & 1);
  }
  return bits;
}

export function hammingDistance(hexA: string, hexB: string): number {
  const a = hex32ToBits(hexA);
  const b = hex32ToBits(hexB);
  const len = Math.min(a.length, b.length);
  let dist = 0;
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) dist++;
  // Any length mismatch (malformed/truncated stored code) counts as fully-differing on the
  // uncovered tail -- conservative (pushes similarity down, never fabricates a false match).
  dist += Math.abs(a.length - b.length);
  return dist;
}

/** Standard SimHash -> cosine-similarity approximation: expected bit-disagreement fraction
 *  d = hammingDist/totalBits ~= theta/pi (theta = angle between the source vectors), so
 *  cosine_similarity = cos(theta) ~= cos(pi * d). Range [-1, 1], same as real cosine similarity. */
export function hammingToSimilarity(hammingDist: number, totalBits: number = SIMHASH_BITS): number {
  const d = Math.min(1, hammingDist / totalBits);
  return Math.cos(Math.PI * d);
}

/** Convenience: approximate cosine similarity directly from two 32-hex Soccerball codes. */
export function computeSemanticSimilarity(codeA: string, codeB: string): number {
  return hammingToSimilarity(hammingDistance(codeA, codeB));
}

/**
 * semantic_soccerball_emit -- STEP 1 (additive). Embeds `text` via local Ollama
 * (ollamaManager.embed), L2-normalizes, SimHashes to 128 bits, renders as a 32-hex-char code.
 *
 * This is ADDITIVE alongside caithedral-core's existing sha256-based soccerball_emit -- it does
 * not replace it, is not called by it, and is not called by it in reverse. Fails soft: returns
 * null whenever ollamaManager.embed() returns null (see that function's doc comment for the
 * exact fail-soft contract) -- callers MUST fall back to the existing token-similarity path.
 */
export async function semantic_soccerball_emit(text: string): Promise<string | null> {
  const vec = await ollamaManager.embed(text);
  if (!vec) return null;
  try {
    const normalized = l2Normalize(vec);
    const bits = simhashBits(normalized);
    return bitsToHex32(bits);
  } catch (err) {
    console.warn('[SemanticSoccerball] emit failed after embed succeeded (fail-soft, returning null):', err);
    return null;
  }
}
