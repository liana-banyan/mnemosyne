/**
 * reminder_scribe.ts -- Persistent SEG Scribe · Wave I-A
 *
 * BP089 · Mountain 2 · Knight Marathon 5
 * Statute binding: §3 §14 §15 §16 §17 BLOOD
 * Scope: src/main/scribes/
 *
 * Long-running orchestrator. Loads canon corpus (eblets folder) on startup.
 * Scans all incoming Bishop and Knight dispatches for canon violations.
 * Composes a 3-member Minor Council (M4 enforcement_council Court Package)
 * to vote on each potential violation before emitting a violation pearl.
 *
 * Council sharding:
 *   Member A · safety_identity      -- MIC STAMPED · Ed25519 · membership pricing · no-show forfeit
 *   Member B · process_currency     -- Three-gear currency · substitution rail · marks clearing · advance order
 *   Member C · narrative_ux         -- Preferences inferred · questionnaire ban · taglines · closing liturgy
 *
 * Voting rules:
 *   3-of-3 flag → HARD violation   · block dispatch + emit reminder_scribe_violation pearl (severity: HARD)
 *   2-of-3 flag → CONFIRMED         · emit reminder_scribe_violation pearl (severity: CONFIRMED)
 *   1-of-3 flag → DRIFT_WATCH       · log to scribe_drift_watch · NO pearl · NO block
 *   0-of-3     → CLEAN             · no action
 *
 * SEG GREEN criteria:
 *   Scribe boots · corpus loaded · Council listener registered · scan loop entered ·
 *   emits at least one heartbeat pearl within 30s of boot.
 *
 * Canon ref: canon_minor_council_star_chamber_free_local_multi_model_consensus_requires_mountain_1_substrate_priming_bp089
 */

import { PearlEmitter } from '../pearl/pearl_emitter';
import { IpLedger } from '../identity/ip_ledger';
import { CanonCorpus } from './canon_corpus';
import {
  EnforcementCouncil,
  CouncilMember,
  CouncilVoteTuple,
  CouncilPackage,
} from '../enforcement_council/enforcement_council';
import type { Dispatch, ViolationCandidate, CouncilVoteRow, DriftWatchRow } from './types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface ReminderScribeConfig {
  /** Absolute path to the eblets corpus folder */
  ebletsFolderPath: string;
  /** Local model tag, e.g. 'gemma4:12b' */
  gemmaModel: string;
  /** Pearl channel for violation emissions */
  violationPearlChannel: string;
  /** Milliseconds between dispatch queue polls */
  scanIntervalMs: number;
  /** This scribe's ip_ledger identity key (§16 BLOOD) */
  ipLedgerRow: string;
}

// ---------------------------------------------------------------------------
// Vote summary
// ---------------------------------------------------------------------------

export interface VoteSummary {
  memberAVote: boolean;
  memberBVote: boolean;
  memberCVote: boolean;
  consensus: 'HARD' | 'CONFIRMED' | 'DRIFT_WATCH' | 'CLEAN';
  articlesRaised: string[];
}

// ---------------------------------------------------------------------------
// ReminderScribe
// ---------------------------------------------------------------------------

export class ReminderScribe {
  private corpus!: CanonCorpus;
  private emitter: PearlEmitter = new PearlEmitter();
  private ledger: IpLedger = new IpLedger();
  private council: EnforcementCouncil | null = null;
  private councilPackageReady: boolean = false;
  private running: boolean = false;

  constructor(private config: ReminderScribeConfig) {}

  // -------------------------------------------------------------------------
  // Boot sequence (§16 BLOOD: identity first)
  // -------------------------------------------------------------------------

  async boot(): Promise<void> {
    // 1. Register identity in ip_ledger before any scan (§16 BLOOD)
    await this.ledger.registerScribe({
      key: this.config.ipLedgerRow,
      role: 'reminder_scribe',
      model: this.config.gemmaModel,
      bootTime: Date.now(),
    });

    // 2. Load canon corpus from eblets folder
    this.corpus = await CanonCorpus.loadFromDisk(this.config.ebletsFolderPath);

    // 3. Register Court Package lazy-load listener
    //    Council initializes when M4 signals m4_court_package_ready
    PearlEmitter.on('m4_court_package_ready', () => {
      void this.initCouncil();
    });

    // 4. Emit boot heartbeat (SEG GREEN: must fire within 30s)
    await PearlEmitter.emit('reminder_scribe_heartbeat', {
      scribe: this.config.ipLedgerRow,
      corpusRules: this.corpus.ruleCount,
      eblets: this.corpus.loadedEbletCount,
      councilReady: false,
      timestamp: Date.now(),
    });

    // 5. Enter scan loop
    this.running = true;
    await this.scanLoop();
  }

  // -------------------------------------------------------------------------
  // Council initialization (lazy -- fires on m4_court_package_ready pearl)
  // -------------------------------------------------------------------------

  private async initCouncil(): Promise<void> {
    const pkg: CouncilPackage = await EnforcementCouncil.loadPackage();
    this.council = new EnforcementCouncil({
      members: [
        CouncilMember.forShard('safety_identity',  this.config.gemmaModel),
        CouncilMember.forShard('process_currency', this.config.gemmaModel),
        CouncilMember.forShard('narrative_ux',     this.config.gemmaModel),
      ],
      package: pkg,
      keepAlive: true,
    });
    this.councilPackageReady = true;

    await PearlEmitter.emit('reminder_scribe_council_warm', {
      scribe: this.config.ipLedgerRow,
      timestamp: Date.now(),
    });
  }

  // -------------------------------------------------------------------------
  // Scan loop
  // -------------------------------------------------------------------------

  async scanLoop(): Promise<void> {
    while (this.running) {
      const dispatches = await this.fetchPendingDispatches();
      for (const dispatch of dispatches) {
        const candidates = await this.corpus.checkViolations(dispatch);
        for (const candidate of candidates) {
          const summary = await this.runCouncilVote(dispatch, candidate);
          await this.handleVoteSummary(summary, candidate, dispatch);
        }
      }
      await this.sleep(this.config.scanIntervalMs);
    }
  }

  // -------------------------------------------------------------------------
  // Council vote
  // -------------------------------------------------------------------------

  private async runCouncilVote(
    dispatch: Dispatch,
    candidate: ViolationCandidate,
  ): Promise<VoteSummary> {
    // AMBER fallback: Court Package not yet loaded → single-worker heuristic
    if (!this.councilPackageReady || !this.council) {
      const singleFlag = candidate.confidence > 0.7;
      return {
        memberAVote: singleFlag,
        memberBVote: false,
        memberCVote: false,
        consensus: singleFlag ? 'DRIFT_WATCH' : 'CLEAN',
        articlesRaised: singleFlag ? [candidate.canonId] : [],
      };
    }

    const votes: [CouncilVoteTuple, CouncilVoteTuple, CouncilVoteTuple] =
      await this.council.vote({
        question: dispatch.text,
        context: candidate,
        questionHash: candidate.hash,
      });

    const yVotes = votes.filter(v => v.violation).length;
    const articles = votes.flatMap(v => (v.articleCited ? [v.articleCited] : []));
    const consensus: VoteSummary['consensus'] =
      yVotes === 3 ? 'HARD' :
      yVotes === 2 ? 'CONFIRMED' :
      yVotes === 1 ? 'DRIFT_WATCH' : 'CLEAN';

    // Log vote to scribe_council_vote_log (Bishop applies schema per §7)
    await this.logCouncilVote({
      scribeId: this.config.ipLedgerRow,
      questionHash: candidate.hash,
      memberVotes: votes,
      consensusYn: yVotes >= 2,
      pearlId: null,
    });

    return {
      memberAVote: votes[0]?.violation ?? false,
      memberBVote: votes[1]?.violation ?? false,
      memberCVote: votes[2]?.violation ?? false,
      consensus,
      articlesRaised: articles,
    };
  }

  // -------------------------------------------------------------------------
  // Vote outcome handling
  // -------------------------------------------------------------------------

  private async handleVoteSummary(
    summary: VoteSummary,
    candidate: ViolationCandidate,
    dispatch: Dispatch,
  ): Promise<void> {
    if (summary.consensus === 'CLEAN') return;

    if (summary.consensus === 'DRIFT_WATCH') {
      // 1-of-3: log only; no pearl; no block
      await this.logDriftWatch({
        scribeId: this.config.ipLedgerRow,
        questionHash: candidate.hash,
        memberVotes: [summary.memberAVote, summary.memberBVote, summary.memberCVote],
        canonId: candidate.canonId,
        dispatchId: dispatch.agentId,
        timestamp: Date.now(),
      });
      return;
    }

    // 2-of-3 or 3-of-3: emit violation pearl
    const pearlId = await this.emitter.emit({
      channel: this.config.violationPearlChannel,
      payload: {
        type: 'CANON_VIOLATION',
        severity: summary.consensus,
        canon: candidate.canonId,
        scribe: 'reminder_scribe',
        violator: dispatch.agentId,
        timestamp: Date.now(),
        description: candidate.description,
        correctionSuggested: candidate.correction,
        councilVote: {
          memberA: summary.memberAVote,
          memberB: summary.memberBVote,
          memberC: summary.memberCVote,
          consensus: summary.consensus,
        },
        articlesRaised: summary.articlesRaised,
      },
    });

    await this.logViolation(candidate, dispatch, pearlId, summary);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  shutdown(): void {
    this.running = false;
  }

  // -------------------------------------------------------------------------
  // Stubs -- wired by platform at Wave II
  // -------------------------------------------------------------------------

  private async fetchPendingDispatches(): Promise<Dispatch[]> {
    return [];
  }

  private async logViolation(
    _v: ViolationCandidate,
    _d: Dispatch,
    _pearlId: string,
    _s: VoteSummary,
  ): Promise<void> { /* platform impl */ }

  private async logCouncilVote(_row: CouncilVoteRow): Promise<void> { /* platform impl */ }

  private async logDriftWatch(_row: DriftWatchRow): Promise<void> { /* platform impl */ }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
