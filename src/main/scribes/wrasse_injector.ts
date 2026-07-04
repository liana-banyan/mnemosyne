/**
 * wrasse_injector.ts -- Persistent SEG Scribe · Wave I-B
 *
 * BP089 · Mountain 2 · Knight Marathon 5
 * Statute binding: §14 §15 §16 §17 BLOOD
 * Scope: src/main/scribes/
 *
 * Enforces §14/§15/§16/§17 BLOOD statutes. Blocks compaction-class drift.
 * Emits drift-correction injections. Each check flows through a 3-member
 * Minor Council, one per BLOOD article, returning a vote tuple.
 *
 * Council sharding:
 *   Wrasse-§14    · compaction-class drift   -- eblet squash · MEMORY.md overflow · canon text alteration
 *   Wrasse-§15    · Bishop-direct sub        -- "open Studio" · "log in Studio" · "check Studio"
 *   Wrasse-§16/17 · identity + gadget-first  -- ip_ledger row missing · bash discovery in dispatch
 *
 * Voting rules:
 *   2-of-3 flag → emit DRIFT_CORRECTION pearl + inject correction
 *   1-of-3 flag → log to scribe_drift_watch; NO inject; NO block
 *   0-of-3     → CLEAN; no action
 *
 * SEG GREEN criteria:
 *   Wrasse boots · registers in ledger · Council listener registered ·
 *   enters enforce loop · detects at least one seeded §15 pattern in test
 *   fixture within 10s.
 *
 * Canon ref: canon_bishop_eat_our_own_cooking_substrate_first_dispatch_route_by_task_fit_bp089
 */

import { PearlEmitter } from '../pearl/pearl_emitter';
import { IpLedger } from '../identity/ip_ledger';
import {
  EnforcementCouncil,
  CouncilMember,
  CouncilVoteTuple,
  CouncilPackage,
} from '../enforcement_council/enforcement_council';
import type { Dispatch, CouncilVoteRow, DriftWatchRow } from './types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface WrasseInjectorConfig {
  gemmaModel: string;
  driftCorrectionChannel: string;
  scanIntervalMs: number;
  ipLedgerRow: string;
}

// ---------------------------------------------------------------------------
// Statute codes
// ---------------------------------------------------------------------------

export type StatuteCode = '§14' | '§15' | '§16' | '§17';

// ---------------------------------------------------------------------------
// Vote tuple returned by Wrasse Council members
// ---------------------------------------------------------------------------

export interface WrasseVoteTuple {
  violationYn: boolean;
  articleCited: StatuteCode | null;
  suggestedCorrection: string | null;
}

// ---------------------------------------------------------------------------
// Drift correction payload
// ---------------------------------------------------------------------------

export interface DriftCorrection {
  statuteViolated: StatuteCode;
  originalText: string;
  correctedText: string;
  injectionTarget: string;
  councilVote: {
    seat14: WrasseVoteTuple;
    seat15: WrasseVoteTuple;
    seat1617: WrasseVoteTuple;
    majorityAgreed: boolean;
  };
}

// ---------------------------------------------------------------------------
// §15 Studio substitution patterns (pre-Council regex fallback)
// ---------------------------------------------------------------------------

const STUDIO_PATTERNS: Array<{ pattern: RegExp; correction: string }> = [
  {
    pattern: /open\s+(?:the\s+)?studio/gi,
    correction: 'Bishop-direct dispatch available via send_message',
  },
  {
    pattern: /check\s+(?:in\s+)?(?:the\s+)?studio/gi,
    correction: 'pearl_query on the relevant channel',
  },
  {
    pattern: /log\s+(?:in|into)\s+(?:the\s+)?studio/gi,
    correction: 'scribe_log call via MnemosyneC MCP',
  },
];

// ---------------------------------------------------------------------------
// WrasseInjector
// ---------------------------------------------------------------------------

export class WrasseInjector {
  private emitter: PearlEmitter = new PearlEmitter();
  private ledger: IpLedger = new IpLedger();
  private council: EnforcementCouncil | null = null;
  private councilPackageReady: boolean = false;
  private running: boolean = false;

  constructor(private config: WrasseInjectorConfig) {}

  // -------------------------------------------------------------------------
  // Boot sequence
  // -------------------------------------------------------------------------

  async boot(): Promise<void> {
    // §16 BLOOD: register identity before any enforcement
    await this.ledger.registerScribe({
      key: this.config.ipLedgerRow,
      role: 'wrasse_injector',
      model: this.config.gemmaModel,
      bootTime: Date.now(),
    });

    // Lazy-load Council Package when M4 lands
    PearlEmitter.on('m4_court_package_ready', () => {
      void this.initCouncil();
    });

    this.running = true;
    await this.enforceLoop();
  }

  // -------------------------------------------------------------------------
  // Council initialization
  // -------------------------------------------------------------------------

  private async initCouncil(): Promise<void> {
    const pkg: CouncilPackage = await EnforcementCouncil.loadPackage();
    this.council = new EnforcementCouncil({
      members: [
        CouncilMember.forArticle('§14',     this.config.gemmaModel),
        CouncilMember.forArticle('§15',     this.config.gemmaModel),
        CouncilMember.forArticle('§16_§17', this.config.gemmaModel),
      ],
      package: pkg,
      keepAlive: true,
    });
    this.councilPackageReady = true;

    await PearlEmitter.emit('wrasse_council_warm', {
      scribe: this.config.ipLedgerRow,
      timestamp: Date.now(),
    });
  }

  // -------------------------------------------------------------------------
  // Enforce loop
  // -------------------------------------------------------------------------

  async enforceLoop(): Promise<void> {
    while (this.running) {
      const pending = await this.fetchPendingDispatches();
      for (const dispatch of pending) {
        const result = await this.runCouncilCheck(dispatch);
        if (result) {
          await this.emitAndLog(result, dispatch);
        }
      }
      await this.sleep(this.config.scanIntervalMs);
    }
  }

  // -------------------------------------------------------------------------
  // Council check
  // -------------------------------------------------------------------------

  private async runCouncilCheck(dispatch: Dispatch): Promise<DriftCorrection | null> {
    if (!this.councilPackageReady || !this.council) {
      return this.singleWorkerFallback(dispatch);
    }

    const votes: [CouncilVoteTuple, CouncilVoteTuple, CouncilVoteTuple] =
      await this.council.vote({
        question: dispatch.text,
        context: { agentId: dispatch.agentId },
        questionHash: dispatch.id,
      });

    const seat14    = this.parseVote(votes[0]);
    const seat15    = this.parseVote(votes[1]);
    const seat1617  = this.parseVote(votes[2]);

    const yVotes = [seat14, seat15, seat1617].filter(v => v.violationYn).length;

    await this.logCouncilVote({
      scribeId: this.config.ipLedgerRow,
      questionHash: dispatch.id,
      memberVotes: votes,
      consensusYn: yVotes >= 2,
      pearlId: null,
    });

    if (yVotes === 0) return null;

    if (yVotes === 1) {
      await this.logDriftWatch({
        scribeId: this.config.ipLedgerRow,
        questionHash: dispatch.id,
        memberVotes: [seat14.violationYn, seat15.violationYn, seat1617.violationYn],
        canonId: seat14.articleCited ?? seat15.articleCited ?? seat1617.articleCited ?? 'unknown',
        dispatchId: dispatch.agentId,
        timestamp: Date.now(),
      });
      return null;
    }

    // 2-of-3 or 3-of-3: build correction
    const primarySeat = [seat14, seat15, seat1617].find(v => v.violationYn)!;
    const correctedText = primarySeat.suggestedCorrection ?? dispatch.text;

    return {
      statuteViolated: primarySeat.articleCited ?? '§15',
      originalText: dispatch.text,
      correctedText,
      injectionTarget: dispatch.agentId,
      councilVote: {
        seat14,
        seat15,
        seat1617,
        majorityAgreed: true,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Vote parsing
  // -------------------------------------------------------------------------

  private parseVote(raw: CouncilVoteTuple): WrasseVoteTuple {
    return {
      violationYn: raw.violation,
      articleCited: (raw.articleCited as StatuteCode) ?? null,
      suggestedCorrection: raw.suggestedCorrection ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Pre-Council §15 regex fallback (AMBER mode)
  // -------------------------------------------------------------------------

  private singleWorkerFallback(dispatch: Dispatch): DriftCorrection | null {
    for (const { pattern, correction } of STUDIO_PATTERNS) {
      if (pattern.test(dispatch.text ?? '')) {
        const correctedText = dispatch.text.replace(pattern, correction);
        return {
          statuteViolated: '§15',
          originalText: dispatch.text,
          correctedText,
          injectionTarget: dispatch.agentId,
          councilVote: {
            seat14:   { violationYn: false, articleCited: null, suggestedCorrection: null },
            seat15:   { violationYn: true,  articleCited: '§15', suggestedCorrection: correction },
            seat1617: { violationYn: false, articleCited: null, suggestedCorrection: null },
            majorityAgreed: false,
          },
        };
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Pearl emission + vote log
  // -------------------------------------------------------------------------

  private async emitAndLog(correction: DriftCorrection, dispatch: Dispatch): Promise<void> {
    const pearlId = await this.emitter.emit({
      channel: this.config.driftCorrectionChannel,
      payload: {
        type: 'DRIFT_CORRECTION',
        statute: correction.statuteViolated,
        scribe: 'wrasse_injector',
        originalText: correction.originalText,
        correctedText: correction.correctedText,
        injectionTarget: correction.injectionTarget,
        councilVote: correction.councilVote,
        timestamp: Date.now(),
      },
    });

    await this.logCouncilVote({
      scribeId: this.config.ipLedgerRow,
      questionHash: dispatch.id,
      memberVotes: [],
      consensusYn: true,
      pearlId,
    });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  shutdown(): void {
    this.running = false;
  }

  // -------------------------------------------------------------------------
  // Stubs
  // -------------------------------------------------------------------------

  private async fetchPendingDispatches(): Promise<Dispatch[]> {
    return [];
  }

  private async logCouncilVote(_row: CouncilVoteRow): Promise<void> { /* platform impl */ }

  private async logDriftWatch(_row: DriftWatchRow): Promise<void> { /* platform impl */ }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
