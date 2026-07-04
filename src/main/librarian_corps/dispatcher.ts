// BP089 Mountain 3 · I-D · Librarian Corps Dispatcher
// Single entry point Dr. M uses. Routes queries to the correct Librarian Council.
// 60-second in-process path cache (no cross-peer cache in this mountain).
// Divergence threshold: 15% (inherited from M5 Scribe Council pattern).
// Escalation target: flagship adjudicator_council when divergence > 0.15.
// Wire format: hex-mcode response frames.
// Vote logging: Supabase librarian_council_vote_log table (schema §7).
//
// Routing table:
//   canon tier            → CanonLibrarian Council
//   pearl / session_close → PearlLibrarian Council
//   eblet / receipt       → ReceiptsLibrarian Council
//   eblet / ts,sql,seg    → CodeLibrarian Council
//   eblet / food,gaming   → DomainLibrarian Council
//   eblet / vendor,dl     → DownloadedLibrarian Council
//   fallback              → DomainLibrarian Council

import { encodeFrame } from '../wire/hex-encode';
import {
  buildPyramidIndex,
  bootstrapFromDb,
  resolveByTopic,
  resolveByAddress,
  type PyramidLayer,
  type PyramidHit,
} from './pyramid_index';
import {
  createLibrarian,
  type LibrarianRole,
  type LibrarianCouncilResponse,
  type BaseLibrarian,
} from './librarian';

// ── Configuration ──────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000;          // 60-second in-process path cache
const ESCALATION_THRESHOLD = 0.15;   // M5 Scribe Council variance threshold
const VOTE_LOG_TIMEOUT_MS = 8_000;

const SUPABASE_URL: string =
  process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_ANON_KEY: string =
  process.env['SUPABASE_ANON_KEY'] ?? process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DispatchRequest {
  query: string;                    // natural-language or substrate address
  preferredTier?: 'canon' | 'pearl' | 'eblet';
  returnFormat?: 'content' | 'address' | 'composes_with_chain';
}

export interface DispatchResponse {
  hit: PyramidHit | null;
  librarianRole: LibrarianRole;
  councilPackage: string;
  content: string | null;
  composesWithChain: string[];
  hexFrame: string;                 // hex-mcode encoded response
  latencyMs: number;                // wall-clock from dispatch() call to return
  pyramidResolveMs: number;
  cabinetOpenMs: number;
  councilVoteMs: number;            // wall-clock for 3-member fan-out
  divergenceScore: number;
  escalated: boolean;
  fromCache: boolean;
}

// ── Module-level state ────────────────────────────────────────────────────────

interface CacheEntry {
  response: DispatchResponse;
  expireAtMs: number;
}

const _responseCache = new Map<string, CacheEntry>();
let _pyramidIndex: PyramidLayer[] | null = null;

/** Librarian Council pool: instantiated once, spun up lazily */
const _librarianPool = new Map<LibrarianRole, BaseLibrarian>();

function getLibrarian(role: LibrarianRole): BaseLibrarian {
  if (!_librarianPool.has(role)) {
    _librarianPool.set(role, createLibrarian(role));
  }
  return _librarianPool.get(role)!;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

function supabaseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

async function writeVoteLog(params: {
  cabinetPath: string;
  librarianRole: LibrarianRole;
  councilPackage: string;
  memberVotes: LibrarianCouncilResponse['votes'];
  consensusYN: boolean;
  escalatedYN: boolean;
  divergenceScore: number;
  latencyMs: number;
}): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/librarian_council_vote_log`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        cabinet_path: params.cabinetPath,
        librarian_role: params.librarianRole,
        council_package: params.councilPackage,
        member_votes: params.memberVotes,
        consensus_y_n: params.consensusYN,
        escalated_y_n: params.escalatedYN,
        divergence_score: params.divergenceScore.toFixed(4),
        latency_ms: params.latencyMs,
        session_bp: 'BP089',
      }),
      signal: AbortSignal.timeout(VOTE_LOG_TIMEOUT_MS),
    });
  } catch {
    // Non-fatal: vote log best-effort
  }
}

// ── Pyramid index singleton ───────────────────────────────────────────────────

async function getPyramidIndex(): Promise<PyramidLayer[]> {
  if (_pyramidIndex === null) {
    _pyramidIndex = await buildPyramidIndex();
  }
  return _pyramidIndex;
}

// ── Routing logic ─────────────────────────────────────────────────────────────

const TOPIC_ROUTING: Array<{
  tags: string[];
  role: LibrarianRole;
  tier?: 'canon' | 'pearl' | 'eblet';
}> = [
  { tags: [],                                     role: 'canon_librarian',      tier: 'canon'  },
  { tags: ['session_close', 'smoke_test', 'pass_b', 'trial_02b', 'benchmark'],
                                                  role: 'pearl_librarian',      tier: 'pearl'  },
  { tags: ['receipt', 'thunderclap'],             role: 'receipts_librarian'                   },
  { tags: ['typescript', 'sql', 'seg', 'code'],   role: 'code_librarian'                       },
  { tags: ['food', 'gaming', 'domain'],           role: 'domain_librarian'                     },
  { tags: ['downloaded', 'vendor', 'reference'],  role: 'downloaded_librarian'                 },
];

function selectLibrarianRole(hit: PyramidHit | null, query: string): LibrarianRole {
  if (!hit) return 'domain_librarian';

  // Tier takes priority
  if (hit.tier === 'canon') return 'canon_librarian';
  if (hit.tier === 'pearl') return 'pearl_librarian';

  // Eblet tier: route by topic-tag signal
  const lq = query.toLowerCase();
  for (const route of TOPIC_ROUTING.slice(2)) {
    if (route.tags.some(t => hit.topicTags.includes(t) || lq.includes(t))) {
      return route.role;
    }
  }

  return 'domain_librarian'; // fallback
}

// ── Escalation to flagship adjudicator_council ────────────────────────────────

async function escalateToAdjudicator(
  req: DispatchRequest,
  councilResponse: LibrarianCouncilResponse,
): Promise<string | null> {
  // Emit escalation pearl
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/pearl-emit`, {
        method: 'POST',
        headers: { ...supabaseHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pearl_id: `council_escalation_${Date.now()}`,
          payload: {
            event: 'council_escalated',
            query: req.query,
            librarianRole: councilResponse.librarianRole,
            divergenceScore: councilResponse.divergenceScore,
            votes: councilResponse.votes.map(v => ({
              memberId: v.memberId,
              resolvedAddress: v.resolvedAddress,
              latencyMs: v.latencyMs,
            })),
            bp: 'BP089',
          },
        }),
        signal: AbortSignal.timeout(5_000),
      }).catch(() => { /* non-fatal */ });
    } catch {
      // Non-fatal
    }
  }

  // Adjudicator: use the highest-confidence vote (lowest latency = most confident)
  // In production, this would route to a flagship gemma4:12b adjudicator_council.
  // For this mountain: use the vote with the lowest latency as the authoritative answer.
  const sorted = [...councilResponse.votes].sort((a, b) => a.latencyMs - b.latencyMs);
  const adjudicatedVote = sorted[0];

  return adjudicatedVote?.content ?? councilResponse.consensusContent ?? null;
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

function normalizeQueryKey(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

function checkCache(key: string): DispatchResponse | null {
  const entry = _responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expireAtMs) {
    _responseCache.delete(key);
    return null;
  }
  return { ...entry.response, fromCache: true };
}

function storeCache(key: string, response: DispatchResponse): void {
  _responseCache.set(key, {
    response,
    expireAtMs: Date.now() + CACHE_TTL_MS,
  });
}

// ── Hex-mcode encoding ────────────────────────────────────────────────────────

function encodeDispatchResponse(response: Omit<DispatchResponse, 'hexFrame'>, dispatchId: string): string {
  const payload: Record<string, unknown> = {
    content:           response.content,
    address:           response.hit?.address ?? null,
    composesWithChain: response.composesWithChain,
    librarianRole:     response.librarianRole,
    councilPackage:    response.councilPackage,
    divergenceScore:   response.divergenceScore,
    escalated:         response.escalated,
    latencyMs:         response.latencyMs,
    councilVoteMs:     response.councilVoteMs,
    fromCache:         response.fromCache,
  };
  return encodeFrame(dispatchId, 'answer', payload);
}

// ── Public dispatch ───────────────────────────────────────────────────────────

let _dispatchCounter = 0;

/**
 * Main dispatch function. Dr. M calls this; she receives a DispatchResponse.
 * - Checks 60s path cache (returns fromCache: true on hit)
 * - Resolves via Inverted Pyramid Index
 * - Routes to correct Librarian Council
 * - Fans 3 sub-Librarians in parallel
 * - Computes consensus; escalates if divergence > 0.15
 * - Writes vote log to Supabase
 * - Returns hex-mcode encoded DispatchResponse
 */
export async function dispatch(req: DispatchRequest): Promise<DispatchResponse> {
  const wallStart = Date.now();
  const cacheKey = normalizeQueryKey(req.query);
  _dispatchCounter++;
  const dispatchId = `d${_dispatchCounter.toString(16).padStart(7, '0')}`;

  // 1. Cache check
  const cached = checkCache(cacheKey);
  if (cached) {
    return cached;
  }

  // 2. Pyramid index resolution
  const pyramidStart = Date.now();
  const index = await getPyramidIndex();

  let hit: PyramidHit | null = null;
  try {
    // Prefer address resolution for slug-style queries
    if (/^canon_|^pearl_|::/.test(req.query)) {
      hit = await resolveByAddress(req.query, index);
    } else {
      hit = await resolveByTopic(req.query, index);
    }

    // Apply preferredTier filter: if hit doesn't match preferred tier, try again
    if (hit && req.preferredTier && hit.tier !== req.preferredTier) {
      const tierHit = await resolveByTopic(
        `${req.preferredTier} ${req.query}`,
        index,
      );
      if (tierHit?.tier === req.preferredTier) hit = tierHit;
    }
  } catch {
    hit = null;
  }
  const pyramidResolveMs = Date.now() - pyramidStart;

  // 3. Select Librarian Council
  const librarianRole = selectLibrarianRole(hit, req.query);
  const librarian = getLibrarian(librarianRole);

  // Ensure Librarian is spun up with the current pyramid index
  await librarian.spin_up(index);

  // 4. Council resolve (3 sub-Librarians in parallel)
  const councilStart = Date.now();
  const councilResponse = await librarian.council_resolve({
    query: req.query,
    role: librarianRole,
    returnFormat: req.returnFormat ?? 'content',
  });
  const councilVoteMs = Date.now() - councilStart;
  const cabinetOpenMs = Math.max(...councilResponse.votes.map(v => v.latencyMs));

  // 5. Consensus or escalation
  let finalContent: string | null = councilResponse.consensusContent;
  let escalated = councilResponse.escalated;

  if (councilResponse.divergenceScore > ESCALATION_THRESHOLD) {
    finalContent = await escalateToAdjudicator(req, councilResponse);
    escalated = true;
  }

  // 6. Write vote log
  const latencyMs = Date.now() - wallStart;
  await writeVoteLog({
    cabinetPath: hit?.address ?? req.query,
    librarianRole,
    councilPackage: councilResponse.councilPackage,
    memberVotes: councilResponse.votes,
    consensusYN: !escalated,
    escalatedYN: escalated,
    divergenceScore: councilResponse.divergenceScore,
    latencyMs,
  });

  // 7. Build and encode response
  const composesWithChain = [
    ...new Set(councilResponse.votes.flatMap(v => v.composesWithChain)),
  ].slice(0, 10);

  const responseBase: Omit<DispatchResponse, 'hexFrame'> = {
    hit,
    librarianRole,
    councilPackage: councilResponse.councilPackage,
    content: finalContent,
    composesWithChain,
    latencyMs,
    pyramidResolveMs,
    cabinetOpenMs,
    councilVoteMs,
    divergenceScore: councilResponse.divergenceScore,
    escalated,
    fromCache: false,
  };

  const hexFrame = encodeDispatchResponse(responseBase, dispatchId);
  const response: DispatchResponse = { ...responseBase, hexFrame };

  // 8. Cache and return
  storeCache(cacheKey, response);
  return response;
}

// ── Cold-start bootstrap ──────────────────────────────────────────────────────

let _corpsDirBootstrapped = false;

/**
 * Cold-start bootstrap: loads librarian_corps_directory and pyramid_index_canonical
 * from Supabase to reconstruct in-memory routing state without re-registration calls.
 * Call once at process startup before the first dispatch().
 * Idempotent: second call is a no-op.
 *
 * Phase 1 — corps directory: reads all rows, pre-populates _librarianPool.
 * Phase 2 — pyramid index:   calls bootstrapFromDb(); seeds _pyramidIndex if DB is non-empty.
 */
export async function initLibrarianCorps(): Promise<void> {
  if (_corpsDirBootstrapped) return;
  _corpsDirBootstrapped = true;

  // Phase 1: reconstruct librarian pool from persisted directory rows
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/librarian_corps_directory?select=path,librarian_role,council_package`,
        {
          headers: supabaseHeaders(),
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (resp.ok) {
        const rows: Array<{ path: string; librarian_role: string; council_package: string }> =
          await resp.json();
        let loadedCount = 0;
        for (const row of rows) {
          const role = row.librarian_role as LibrarianRole;
          if (!_librarianPool.has(role)) {
            _librarianPool.set(role, createLibrarian(role));
            loadedCount++;
          }
        }
        console.info(
          `[LibrarianCorps] bootstrap: ${loadedCount} librarian(s) loaded from directory` +
          ` (${rows.length} row(s) in DB)`,
        );
      }
    } catch {
      console.info('[LibrarianCorps] bootstrap: directory load failed (non-fatal; will lazy-init on first dispatch)');
    }
  } else {
    console.info('[LibrarianCorps] bootstrap: SUPABASE_URL/ANON_KEY not set; skipping directory load');
  }

  // Phase 2: seed pyramid index from DB (bootstrapFromDb returns null if table is empty)
  try {
    const dbIndex = await bootstrapFromDb();
    if (dbIndex !== null && dbIndex.length > 0) {
      _pyramidIndex = dbIndex;
      const total = dbIndex.reduce((sum, l) => sum + l.topicIndex.size, 0);
      console.info(
        `[LibrarianCorps] bootstrap: pyramid index seeded from DB` +
        ` (${total} topic-tag entries across ${dbIndex.length} layers)`,
      );
    } else {
      console.info('[LibrarianCorps] bootstrap: pyramid_index_canonical empty; will build in-memory on first dispatch');
    }
  } catch {
    console.info('[LibrarianCorps] bootstrap: pyramid index DB load failed (non-fatal; will build in-memory)');
  }
}

// ── Cache management utilities ────────────────────────────────────────────────

/** Force-clear the dispatch cache (for smoke test II-E force-cold runs). */
export function clearDispatchCache(): void {
  _responseCache.clear();
}

/** Teardown all Librarian instances (for graceful shutdown or test cleanup). */
export async function teardownAllLibrarians(): Promise<void> {
  await Promise.allSettled([..._librarianPool.values()].map(l => l.teardown()));
  _librarianPool.clear();
  _pyramidIndex = null;
}

/** Force rebuild the pyramid index (for hot-reload or smoke test use). */
export async function rebuildPyramidIndex(): Promise<void> {
  _pyramidIndex = await buildPyramidIndex();
  for (const librarian of _librarianPool.values()) {
    await librarian.spin_up(_pyramidIndex);
  }
}
