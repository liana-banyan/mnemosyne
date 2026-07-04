/**
 * toolsmith_scribe.ts -- Persistent SEG Scribe · Wave I-C
 *
 * BP089 · Mountain 2 · Knight Marathon 5
 * Statute binding: §17 BLOOD (gadget-first)
 * Scope: src/main/scribes/
 *
 * Enforces gadget-first discovery (§17 BLOOD). Each check flows through a
 * 3-member Minor Council, each scanning for a specific forbidden pattern class.
 * 2-of-3 consensus → auto-rewrite applied.
 * 1-of-3           → log-only suggestion (no block, no auto-rewrite).
 *
 * Council sharding:
 *   Alpha · bash_discovery          -- bash grep · grep -r · find . -name · ls -la · cat -n
 *   Beta  · powershell_misuse       -- Select-String · Get-ChildItem -Recurse · Get-Content
 *   Gamma · substrate_path          -- substrate-class path direct-read · product index crawl
 *
 * Voting rules:
 *   2-of-3 flag → GADGET_FIRST_VIOLATION pearl · autoRewrite: true
 *   1-of-3 flag → GADGET_FIRST_VIOLATION pearl · autoRewrite: false · drift watch log
 *   0-of-3     → CLEAN; no action
 *
 * SEG GREEN criteria:
 *   Toolsmith boots · registers in ledger · Council listener registered ·
 *   enters scan loop · correctly identifies `bash grep` in test fixture and
 *   emits GADGET_FIRST_VIOLATION pearl within 5s.
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

export interface ToolsmithScribeConfig {
  gemmaModel: string;
  gadgetAlertChannel: string;
  scanIntervalMs: number;
  ipLedgerRow: string;
}

// ---------------------------------------------------------------------------
// GadgetRewrite -- a forbidden pattern entry with its gadget substitution
// ---------------------------------------------------------------------------

export interface GadgetRewrite {
  forbiddenPattern: string;
  suggestedGadget: string;
  rationale: string;
  patternClass: 'bash_discovery' | 'powershell_misuse' | 'substrate_path_without_gadget';
}

// ---------------------------------------------------------------------------
// Pattern tables (scanned by seat at runtime)
// ---------------------------------------------------------------------------

export const FORBIDDEN_PATTERNS_ALPHA: GadgetRewrite[] = [
  {
    forbiddenPattern: 'bash grep',
    suggestedGadget: 'pheromone_query',
    rationale: 'Canon salience lookups use pheromone_query, not bash grep',
    patternClass: 'bash_discovery',
  },
  {
    forbiddenPattern: 'grep -r',
    suggestedGadget: 'Grep tool or pheromone_query',
    rationale: 'Content search uses Grep tool or pheromone_query',
    patternClass: 'bash_discovery',
  },
  {
    forbiddenPattern: 'find . -name',
    suggestedGadget: 'Glob tool',
    rationale: 'File pattern search uses Glob tool, not shell find',
    patternClass: 'bash_discovery',
  },
  {
    forbiddenPattern: 'cat -n',
    suggestedGadget: 'Read tool',
    rationale: 'File reading uses Read tool, not cat',
    patternClass: 'bash_discovery',
  },
  {
    forbiddenPattern: 'ls -la',
    suggestedGadget: 'Glob tool',
    rationale: 'Directory listing uses Glob tool',
    patternClass: 'bash_discovery',
  },
];

export const FORBIDDEN_PATTERNS_BETA: GadgetRewrite[] = [
  {
    forbiddenPattern: 'Select-String',
    suggestedGadget: 'Grep tool',
    rationale: 'Content search in PowerShell context uses Grep tool',
    patternClass: 'powershell_misuse',
  },
  {
    forbiddenPattern: 'Get-ChildItem -Recurse',
    suggestedGadget: 'Glob tool',
    rationale: 'Recursive directory listing uses Glob tool',
    patternClass: 'powershell_misuse',
  },
  {
    forbiddenPattern: 'Get-Content',
    suggestedGadget: 'Read tool',
    rationale: 'File reading uses Read tool, not Get-Content',
    patternClass: 'powershell_misuse',
  },
];

export const FORBIDDEN_PATTERNS_GAMMA: GadgetRewrite[] = [
  {
    forbiddenPattern: 'substrate-class-path-direct-read',
    suggestedGadget: 'pheromone_query',
    rationale: 'Substrate-class path access requires pheromone_query, not direct file read',
    patternClass: 'substrate_path_without_gadget',
  },
  {
    forbiddenPattern: 'product-index-crawl',
    suggestedGadget: 'substrate route via pheromone_query',
    rationale: 'Product index discovery routes through substrate, not raw index crawl',
    patternClass: 'substrate_path_without_gadget',
  },
];

// ---------------------------------------------------------------------------
// ToolsmithScribe
// ---------------------------------------------------------------------------

export class ToolsmithScribe {
  private emitter: PearlEmitter = new PearlEmitter();
  private ledger: IpLedger = new IpLedger();
  private council: EnforcementCouncil | null = null;
  private councilPackageReady: boolean = false;
  private running: boolean = false;

  constructor(private config: ToolsmithScribeConfig) {}

  // -------------------------------------------------------------------------
  // Boot sequence
  // -------------------------------------------------------------------------

  async boot(): Promise<void> {
    // §16 BLOOD: identity registration before scan
    await this.ledger.registerScribe({
      key: this.config.ipLedgerRow,
      role: 'toolsmith_scribe',
      model: this.config.gemmaModel,
      bootTime: Date.now(),
    });

    PearlEmitter.on('m4_court_package_ready', () => {
      void this.initCouncil();
    });

    this.running = true;
    await this.scanLoop();
  }

  // -------------------------------------------------------------------------
  // Council initialization
  // -------------------------------------------------------------------------

  private async initCouncil(): Promise<void> {
    const pkg: CouncilPackage = await EnforcementCouncil.loadPackage();
    this.council = new EnforcementCouncil({
      members: [
        CouncilMember.withPatterns(FORBIDDEN_PATTERNS_ALPHA, this.config.gemmaModel),
        CouncilMember.withPatterns(FORBIDDEN_PATTERNS_BETA,  this.config.gemmaModel),
        CouncilMember.withPatterns(FORBIDDEN_PATTERNS_GAMMA, this.config.gemmaModel),
      ],
      package: pkg,
      keepAlive: true,
    });
    this.councilPackageReady = true;

    await PearlEmitter.emit('toolsmith_council_warm', {
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
        await this.runCouncilScan(dispatch);
      }
      await this.sleep(this.config.scanIntervalMs);
    }
  }

  // -------------------------------------------------------------------------
  // Council scan
  // -------------------------------------------------------------------------

  private async runCouncilScan(dispatch: Dispatch): Promise<void> {
    // AMBER fallback: Council Package not yet loaded
    if (!this.councilPackageReady || !this.council) {
      await this.singleMemberFallback(dispatch);
      return;
    }

    const votes: [CouncilVoteTuple, CouncilVoteTuple, CouncilVoteTuple] =
      await this.council.vote({
        question: dispatch.text,
        context: { agentId: dispatch.agentId },
        questionHash: dispatch.id,
      });

    const alphaVote = votes[0];
    const betaVote  = votes[1];
    const gammaVote = votes[2];

    const yVotes = [alphaVote, betaVote, gammaVote].filter(v => v.violation).length;

    await this.logCouncilVote({
      scribeId: this.config.ipLedgerRow,
      questionHash: dispatch.id,
      memberVotes: votes,
      consensusYn: yVotes >= 2,
      pearlId: null,
    });

    if (yVotes === 0) return;

    const winningVote = [alphaVote, betaVote, gammaVote].find(v => v.violation)!;
    const autoRewrite = yVotes >= 2;

    const pearlId = await this.emitter.emit({
      channel: this.config.gadgetAlertChannel,
      payload: {
        type: 'GADGET_FIRST_VIOLATION',
        statute: '§17',
        scribe: 'toolsmith_scribe',
        violator: dispatch.agentId,
        forbiddenPattern: winningVote.forbiddenPattern ?? 'unknown',
        suggestedGadget: winningVote.suggestedGadget ?? 'pheromone_query',
        rationale: winningVote.rationale ?? '',
        autoRewrite,
        councilVote: {
          alpha: alphaVote.violation,
          beta:  betaVote.violation,
          gamma: gammaVote.violation,
          yCount: yVotes,
        },
        timestamp: Date.now(),
      },
    });

    if (yVotes === 1) {
      await this.logDriftWatch({
        scribeId: this.config.ipLedgerRow,
        questionHash: dispatch.id,
        memberVotes: [alphaVote.violation, betaVote.violation, gammaVote.violation],
        canonId: '§17_gadget_first',
        dispatchId: dispatch.agentId,
        timestamp: Date.now(),
      });
    }

    // Suppress unused-var warning on pearlId (logged by platform impl)
    void pearlId;
  }

  // -------------------------------------------------------------------------
  // Pre-Council Alpha-only fallback (AMBER mode)
  // -------------------------------------------------------------------------

  private async singleMemberFallback(dispatch: Dispatch): Promise<void> {
    for (const pattern of FORBIDDEN_PATTERNS_ALPHA) {
      if (dispatch.text && dispatch.text.includes(pattern.forbiddenPattern)) {
        await this.emitter.emit({
          channel: this.config.gadgetAlertChannel,
          payload: {
            type: 'GADGET_FIRST_VIOLATION',
            statute: '§17',
            scribe: 'toolsmith_scribe',
            violator: dispatch.agentId,
            forbiddenPattern: pattern.forbiddenPattern,
            suggestedGadget: pattern.suggestedGadget,
            rationale: pattern.rationale,
            autoRewrite: false,
            councilVote: null, // AMBER mode — no council
            timestamp: Date.now(),
          },
        });
      }
    }
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
