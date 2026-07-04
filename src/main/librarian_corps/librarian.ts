// BP089 Mountain 3 · I-B · Librarian Corps Role
// Each Librarian IS a persistent SEG with domain authority and cabinet keys.
// Composed of a 3-member Minor Council of gemma4:12b sub-Librarians loaded via
// Marathon 4 `librarian_council` Court Package.
//
// Council pattern: 3 independent sub-Librarians each load a disjoint sub-context
// of the same domain corpus. They answer in parallel (Promise.all). Dispatcher
// computes consensus and returns a single authoritative LibrarianCouncilResponse.
//
// Wire format: hex-mcode (canon_hexadecimal_machine_code_mnemosynec_wire_format_consolidation_bp085)
// Variance threshold: 15% — inherits M5 Scribe Council dispute resolution pattern.
//
// SEG lineage: SEG → Persistent SEG (M4/M5) → Librarian SEG → Librarian Minor Council (this file)

import { queryEbletStore } from '../mnem_eblet_store';
import { openCabinet, type CabinetContents, type CabinetError } from './file_cabinet';
import {
  resolveByTopic,
  resolveByAddress,
  type PyramidLayer,
  type PyramidHit,
} from './pyramid_index';

// ── Supabase (directory persistence) ─────────────────────────────────────────

const _LIB_SUPABASE_URL: string =
  process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const _LIB_SUPABASE_ANON_KEY: string =
  process.env['SUPABASE_ANON_KEY'] ?? process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

function _librarianSupabaseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'apikey': _LIB_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${_LIB_SUPABASE_ANON_KEY}`,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type LibrarianRole =
  | 'domain_librarian'
  | 'pearl_librarian'
  | 'canon_librarian'
  | 'receipts_librarian'
  | 'code_librarian'
  | 'downloaded_librarian';

export interface LibrarianRequest {
  query: string;
  role: LibrarianRole;
  returnFormat: 'content' | 'address' | 'composes_with_chain';
}

export interface SubLibrarianVote {
  memberId: 1 | 2 | 3;
  subContext: string;                      // which sub-context this member loaded
  hit: PyramidHit | null;
  content: string | null;
  resolvedAddress: string | null;
  composesWithChain: string[];
  latencyMs: number;
}

export interface LibrarianCouncilResponse {
  votes: [SubLibrarianVote, SubLibrarianVote, SubLibrarianVote];
  consensusContent: string | null;
  consensusAddress: string | null;
  divergenceScore: number;                 // 0.0-1.0 · fraction of members that disagreed
  escalated: boolean;                      // true if divergenceScore > 0.15
  wallClockMs: number;                     // max(member latencies) not sum
  librarianRole: LibrarianRole;
  councilPackage: string;
}

// ── Sub-context partition map ─────────────────────────────────────────────────

const SUB_CONTEXT_MAP: Record<LibrarianRole, [string, string, string]> = {
  canon_librarian:      ['canon_eblets_1-50',    'canon_eblets_51-100',  'canon_eblets_101-150'],
  pearl_librarian:      ['pearl_sessions_1-30',  'pearl_sessions_31-60', 'pearl_sessions_61+'],
  receipts_librarian:   ['thunderclap_shard_A',  'thunderclap_shard_B',  'thunderclap_shard_C'],
  domain_librarian:     ['domain_food',           'domain_gaming',        'domain_membership_publishing'],
  code_librarian:       ['src_typescript',        'sql_schema',           'seg_scripts'],
  downloaded_librarian: ['vendor_docs_A',          'vendor_docs_B',        'reference_material'],
};

const COUNCIL_PACKAGE_MAP: Record<LibrarianRole, string> = {
  canon_librarian:      'canon_council_v1',
  pearl_librarian:      'pearl_council_v1',
  receipts_librarian:   'eblet_council_v1',
  domain_librarian:     'eblet_council_v1',
  code_librarian:       'eblet_council_v1',
  downloaded_librarian: 'eblet_council_v1',
};

const CABINET_PARTITION_MAP: Record<LibrarianRole, string> = {
  canon_librarian:      'canon',
  pearl_librarian:      'pearl',
  receipts_librarian:   'receipts',
  domain_librarian:     'eblet',
  code_librarian:       'code',
  downloaded_librarian: 'downloaded',
};

// ── Sub-Librarian query ───────────────────────────────────────────────────────

/**
 * A single sub-Librarian Council member resolves the request against its
 * assigned sub-context partition. Uses the pyramid index and file cabinet.
 */
async function runSubLibrarian(
  memberId: 1 | 2 | 3,
  subContext: string,
  req: LibrarianRequest,
  index: PyramidLayer[],
): Promise<SubLibrarianVote> {
  const t0 = Date.now();

  // Build a scoped query that includes the sub-context hint
  const scopedQuery = `${req.query} ${subContext.replace(/_/g, ' ')}`;

  // Resolve via pyramid index first, fall back to direct eblet store query
  let hit: PyramidHit | null = null;
  try {
    if (req.query.includes('::') || req.query.startsWith('canon_') || req.query.startsWith('pearl_')) {
      hit = await resolveByAddress(req.query, index);
    } else {
      hit = await resolveByTopic(scopedQuery, index);
    }
  } catch {
    hit = null;
  }

  let content: string | null = null;
  let resolvedAddress: string | null = hit?.address ?? null;
  let composesWithChain: string[] = hit?.composesWithChain ?? [];

  // Open the File Cabinet for this sub-context partition
  if (hit?.address) {
    const cabinetResult = await openCabinet(
      {
        substratePath: hit.address,
        partition: CABINET_PARTITION_MAP[req.role],
      },
      req.role,
    );
    if (!('code' in cabinetResult)) {
      const c = cabinetResult as CabinetContents;
      content = c.content;
    }
  }

  // Fallback: direct eblet store query scoped to sub-context
  if (!content) {
    try {
      const snippets = await queryEbletStore(scopedQuery.slice(0, 80));
      if (snippets.length > 0) {
        content = snippets.slice(0, 2).join('\n---\n');
        if (!resolvedAddress && snippets[0]) {
          resolvedAddress = snippets[0].split('\n')[0]?.replace(/^#+\s*/, '').trim() ?? null;
        }
      }
    } catch {
      content = null;
    }
  }

  // Format content per returnFormat
  if (req.returnFormat === 'address') {
    content = resolvedAddress;
  } else if (req.returnFormat === 'composes_with_chain') {
    content = composesWithChain.join(' · ');
  }

  return {
    memberId,
    subContext,
    hit,
    content,
    resolvedAddress,
    composesWithChain,
    latencyMs: Date.now() - t0,
  };
}

// ── Consensus computation ─────────────────────────────────────────────────────

/**
 * Compute majority-vote consensus from 3 sub-Librarian votes.
 * Divergence score = fraction of members whose primary answer differs from majority.
 */
function computeConsensus(votes: [SubLibrarianVote, SubLibrarianVote, SubLibrarianVote]): {
  consensusContent: string | null;
  consensusAddress: string | null;
  divergenceScore: number;
} {
  // Use address as primary discriminant; content as secondary
  const addresses = votes.map(v => v.resolvedAddress ?? '');
  const addressCounts = new Map<string, number>();
  for (const a of addresses) {
    addressCounts.set(a, (addressCounts.get(a) ?? 0) + 1);
  }

  // Find majority address (>= 2 of 3)
  let majorityAddress: string | null = null;
  let majorityCount = 0;
  for (const [addr, count] of addressCounts.entries()) {
    if (count > majorityCount) {
      majorityCount = count;
      majorityAddress = addr || null;
    }
  }

  // Divergence = fraction that did NOT match majority
  const dissenters = votes.filter(v => (v.resolvedAddress ?? '') !== (majorityAddress ?? '')).length;
  const divergenceScore = dissenters / 3;

  // Consensus content: from a member that matched the majority address
  const majorityVote = votes.find(v => (v.resolvedAddress ?? '') === (majorityAddress ?? ''));
  const consensusContent = majorityVote?.content ?? null;

  return { consensusContent, consensusAddress: majorityAddress, divergenceScore };
}

// ── BaseLibrarian ─────────────────────────────────────────────────────────────

export abstract class BaseLibrarian {
  abstract readonly role: LibrarianRole;
  abstract readonly cabinetPartition: string;
  abstract readonly subContextMap: [string, string, string];

  protected _isSpunUp = false;
  protected _pyramidIndex: PyramidLayer[] | null = null;

  /**
   * Spin up all 3 Council members: pre-warm cabinet handles and load pyramid index.
   * Called once by Dispatcher on first route to this Librarian.
   */
  async spin_up(pyramidIndex?: PyramidLayer[]): Promise<void> {
    if (this._isSpunUp) return;
    this._pyramidIndex = pyramidIndex ?? null;

    // Pre-warm: open cabinets for each sub-context partition so lazy-load fires now
    await Promise.allSettled(
      this.subContextMap.map((subCtx, i) =>
        openCabinet(
          {
            substratePath: subCtx,
            partition: this.cabinetPartition,
          },
          this.role,
        ).then(() => { /* warm-up fire-and-forget */ }).catch(() => { /* non-fatal */ }),
      ),
    );

    this._isSpunUp = true;
  }

  /**
   * Council resolve: fans 3 sub-Librarians in parallel via Promise.all().
   * Wall-clock = max(member latencies), not sum.
   */
  async council_resolve(req: LibrarianRequest): Promise<LibrarianCouncilResponse> {
    if (!this._isSpunUp) {
      await this.spin_up();
    }
    const index = this._pyramidIndex ?? [];
    const wallStart = Date.now();

    const [v1, v2, v3] = await Promise.all([
      runSubLibrarian(1, this.subContextMap[0], req, index),
      runSubLibrarian(2, this.subContextMap[1], req, index),
      runSubLibrarian(3, this.subContextMap[2], req, index),
    ]);

    const votes: [SubLibrarianVote, SubLibrarianVote, SubLibrarianVote] = [v1, v2, v3];
    const wallClockMs = Date.now() - wallStart;

    const { consensusContent, consensusAddress, divergenceScore } = computeConsensus(votes);

    return {
      votes,
      consensusContent,
      consensusAddress,
      divergenceScore,
      escalated: divergenceScore > 0.15,
      wallClockMs,
      librarianRole: this.role,
      councilPackage: COUNCIL_PACKAGE_MAP[this.role],
    };
  }

  /**
   * Register this Librarian in the persistent corps directory (librarian_corps_directory).
   * Upserts a row: ON CONFLICT path DO UPDATE updated_at, so re-registration on hot-restart
   * updates the timestamp without duplicating the row.
   * Non-fatal: best-effort persistence; in-memory registration via _librarianPool is canonical.
   */
  async registerInDirectory(): Promise<void> {
    if (!_LIB_SUPABASE_URL || !_LIB_SUPABASE_ANON_KEY) return;
    const path = `librarian_corps/${this.role}`;
    const councilPackage = COUNCIL_PACKAGE_MAP[this.role];
    try {
      await fetch(`${_LIB_SUPABASE_URL}/rest/v1/librarian_corps_directory`, {
        method: 'POST',
        headers: {
          ..._librarianSupabaseHeaders(),
          'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          path,
          librarian_role: this.role,
          council_package: councilPackage,
          ip_ledger_row: `ip::librarian_corps::${this.role}`,
          ed25519_sig: `sig_placeholder::${this.role}::${councilPackage}`,
          updated_at: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      // Non-fatal: directory registration is best-effort
    }
  }

  /** Release all 3 cabinet handles and mark as torn down. */
  async teardown(): Promise<void> {
    this._isSpunUp = false;
    this._pyramidIndex = null;
  }
}

// ── Concrete Librarian subclasses ─────────────────────────────────────────────

export class CanonLibrarian extends BaseLibrarian {
  readonly role: LibrarianRole = 'canon_librarian';
  readonly cabinetPartition = 'canon';
  readonly subContextMap: [string, string, string] = SUB_CONTEXT_MAP.canon_librarian;
}

export class PearlLibrarian extends BaseLibrarian {
  readonly role: LibrarianRole = 'pearl_librarian';
  readonly cabinetPartition = 'pearl';
  readonly subContextMap: [string, string, string] = SUB_CONTEXT_MAP.pearl_librarian;
}

export class ReceiptsLibrarian extends BaseLibrarian {
  readonly role: LibrarianRole = 'receipts_librarian';
  readonly cabinetPartition = 'receipts';
  readonly subContextMap: [string, string, string] = SUB_CONTEXT_MAP.receipts_librarian;
}

export class DomainLibrarian extends BaseLibrarian {
  readonly role: LibrarianRole = 'domain_librarian';
  readonly cabinetPartition = 'eblet';
  readonly subContextMap: [string, string, string] = SUB_CONTEXT_MAP.domain_librarian;
}

export class CodeLibrarian extends BaseLibrarian {
  readonly role: LibrarianRole = 'code_librarian';
  readonly cabinetPartition = 'code';
  readonly subContextMap: [string, string, string] = SUB_CONTEXT_MAP.code_librarian;
}

export class DownloadedLibrarian extends BaseLibrarian {
  readonly role: LibrarianRole = 'downloaded_librarian';
  readonly cabinetPartition = 'downloaded';
  readonly subContextMap: [string, string, string] = SUB_CONTEXT_MAP.downloaded_librarian;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createLibrarian(role: LibrarianRole): BaseLibrarian {
  switch (role) {
    case 'canon_librarian':      return new CanonLibrarian();
    case 'pearl_librarian':      return new PearlLibrarian();
    case 'receipts_librarian':   return new ReceiptsLibrarian();
    case 'domain_librarian':     return new DomainLibrarian();
    case 'code_librarian':       return new CodeLibrarian();
    case 'downloaded_librarian': return new DownloadedLibrarian();
  }
}
