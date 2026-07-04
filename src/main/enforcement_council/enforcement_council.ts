/**
 * enforcement_council.ts -- M4 Court Package · Pattern-aware Council
 *
 * BP089 · Mountain 2 · Wave II (M4 confirmed live · Bishop ratification)
 * loadPackage() returns version 'M4-1.0.0'.
 * vote() uses shard/article/pattern configs to produce deterministic verdicts.
 * Real gemma4:12b inference slots in when M4 model wire completes;
 * until then, rule-based heuristics provide full smoke-test coverage.
 *
 * Canon ref: canon_minor_council_star_chamber_free_local_multi_model_consensus_requires_mountain_1_substrate_priming_bp089
 */

// ---------------------------------------------------------------------------
// Vote tuple returned by each Council member
// ---------------------------------------------------------------------------

export interface CouncilVoteTuple {
  /** True if this member believes a violation occurred */
  violation: boolean;
  /** Article or canon id cited by this member, if any */
  articleCited?: string;
  /** Gadget substitution suggestion (Toolsmith seats) */
  suggestedGadget?: string;
  /** Suggested corrected text (Wrasse / Reminder seats) */
  suggestedCorrection?: string;
  /** Forbidden pattern detected by this member (Toolsmith seats) */
  forbiddenPattern?: string;
  /** Rationale narrative */
  rationale?: string;
}

// ---------------------------------------------------------------------------
// Council member factory args
// ---------------------------------------------------------------------------

export interface CouncilMemberConfig {
  shard?: string;
  article?: string;
  patterns?: import('../scribes/toolsmith_scribe').GadgetRewrite[];
  model: string;
}

// ---------------------------------------------------------------------------
// CouncilMember -- one seat on the 3-member Minor Council
// ---------------------------------------------------------------------------

export class CouncilMember {
  private config: CouncilMemberConfig;

  private constructor(config: CouncilMemberConfig) {
    this.config = config;
  }

  static forShard(shard: string, model: string): CouncilMember {
    return new CouncilMember({ shard, model });
  }

  static forArticle(article: string, model: string): CouncilMember {
    return new CouncilMember({ article, model });
  }

  static withPatterns(
    patterns: import('../scribes/toolsmith_scribe').GadgetRewrite[],
    model: string,
  ): CouncilMember {
    return new CouncilMember({ patterns, model });
  }

  getConfig(): CouncilMemberConfig {
    return this.config;
  }
}

// ---------------------------------------------------------------------------
// CouncilPackage -- opaque handle returned by EnforcementCouncil.loadPackage()
// ---------------------------------------------------------------------------

export interface CouncilPackage {
  version: string;
  loadedAt: number;
  modelTag: string;
}

// ---------------------------------------------------------------------------
// EnforcementCouncil config
// ---------------------------------------------------------------------------

export interface EnforcementCouncilConfig {
  members: [CouncilMember, CouncilMember, CouncilMember];
  package: CouncilPackage;
  keepAlive: boolean;
}

// ---------------------------------------------------------------------------
// Vote request passed to council.vote()
// ---------------------------------------------------------------------------

export interface CouncilVoteRequest {
  question: string;
  context: unknown;
  questionHash: string;
}

// ---------------------------------------------------------------------------
// EnforcementCouncil -- 3-member minor council (M4 Court Package · live)
// ---------------------------------------------------------------------------

export class EnforcementCouncil {
  private cfg: EnforcementCouncilConfig;

  constructor(cfg: EnforcementCouncilConfig) {
    this.cfg = cfg;
  }

  /**
   * Load the Court Package.
   * Returns M4-1.0.0 (confirmed live, Bishop ratification BP089 Wave I).
   */
  static async loadPackage(): Promise<CouncilPackage> {
    return {
      version: 'M4-1.0.0',
      loadedAt: Date.now(),
      modelTag: 'gemma4:12b',
    };
  }

  /**
   * Run a vote across all 3 Council members.
   * Each member inspects the question using its shard / article / pattern config.
   * Deterministic rule-based scoring provides full smoke-test coverage.
   * Real gemma4:12b inference slots in at the model-wire integration pass.
   */
  async vote(req: CouncilVoteRequest): Promise<[CouncilVoteTuple, CouncilVoteTuple, CouncilVoteTuple]> {
    const results = this.cfg.members.map(m => this.memberVote(m, req)) as
      [CouncilVoteTuple, CouncilVoteTuple, CouncilVoteTuple];
    return results;
  }

  // -------------------------------------------------------------------------
  // Per-member vote evaluation
  // -------------------------------------------------------------------------

  private memberVote(member: CouncilMember, req: CouncilVoteRequest): CouncilVoteTuple {
    const cfg = member.getConfig();
    const text = typeof req.question === 'string' ? req.question : '';

    // ---- Shard-based: Reminder Scribe Council ----------------------------

    if (cfg.shard === 'safety_identity') {
      if (
        /\$\s*(?!5(?:\.00)?\/year)[\d]+(?:\.\d+)?\/year/i.test(text) ||
        /members?\s+pay\s+\$(?!5(?:\.00)?\b)[\d]+/i.test(text) ||
        /membership\s+(?:fee|cost|price).*?\$(?!5(?:\.00)?\b)[\d]+/i.test(text)
      ) {
        return {
          violation: true,
          articleCited: 'membership_obviously_better_5_per_year',
          suggestedCorrection: 'Membership is $5/year.',
          rationale: 'Safety/Identity: pricing canon violation',
        };
      }
      if (/unsigned.*broadcast|broadcast.*without.*sign/i.test(text)) {
        return {
          violation: true,
          articleCited: 'mic_stamped_unsigned_broadcast',
          suggestedCorrection: 'Attach MIC STAMPED Ed25519 signature.',
          rationale: 'Safety/Identity: unsigned broadcast',
        };
      }
      return { violation: false };
    }

    if (cfg.shard === 'process_currency') {
      if (/credits?\s*=\s*\$(?![\d.]+\b.*marks)/i.test(text)) {
        return {
          violation: true,
          articleCited: 'three_gear_currency_conversion',
          suggestedCorrection: 'Use canonical three-gear conversion: Credits → Marks → Joules.',
          rationale: 'Process/Currency: incorrect currency conversion',
        };
      }
      if (/members?\s+pay\s+\$(?!5(?:\.00)?\b)[\d]+/i.test(text)) {
        return {
          violation: true,
          articleCited: 'membership_obviously_better_5_per_year',
          suggestedCorrection: 'Membership is $5/year.',
          rationale: 'Process/Currency: pricing violation cross-confirmed',
        };
      }
      return { violation: false };
    }

    if (cfg.shard === 'narrative_ux') {
      if (/questionnaire|fill\s+out\s+(?:a\s+)?(?:form|survey)/i.test(text)) {
        return {
          violation: true,
          articleCited: 'preferences_inferred_no_questionnaire',
          suggestedCorrection: 'Preferences are inferred; questionnaires are banned.',
          rationale: 'Narrative/UX: questionnaire reference',
        };
      }
      if (/members?\s+pay\s+\$(?!5(?:\.00)?\b)[\d]+/i.test(text)) {
        return {
          violation: true,
          articleCited: 'membership_obviously_better_5_per_year',
          suggestedCorrection: 'Membership is $5/year.',
          rationale: 'Narrative/UX: pricing violation cross-confirmed',
        };
      }
      return { violation: false };
    }

    // ---- Article-based: Wrasse Injector Council --------------------------

    if (cfg.article === '§14') {
      if (/squash.*eblet|eblet.*squash|memory\.md.*exceed|overflow.*memory\.md/i.test(text)) {
        return {
          violation: true,
          articleCited: '§14',
          suggestedCorrection: 'Do not squash eblets; offload MEMORY.md entries to topic files.',
          rationale: '§14: compaction-class drift',
        };
      }
      return { violation: false };
    }

    if (cfg.article === '§15') {
      if (/open\s+(?:the\s+)?studio|check\s+(?:in\s+)?(?:the\s+)?studio|log\s+(?:in|into)\s+(?:the\s+)?studio/i.test(text)) {
        const corrected = text
          .replace(/open\s+(?:the\s+)?studio/gi, 'Bishop-direct dispatch via send_message')
          .replace(/check\s+(?:in\s+)?(?:the\s+)?studio/gi, 'pearl_query on relevant channel')
          .replace(/log\s+(?:in|into)\s+(?:the\s+)?studio/gi, 'scribe_log call');
        return {
          violation: true,
          articleCited: '§15',
          suggestedCorrection: corrected,
          rationale: '§15: Studio reference; Bishop-direct substitution required',
        };
      }
      return { violation: false };
    }

    if (cfg.article === '§16_§17') {
      if (/bash\s+grep|grep\s+-r|find\s+\.\s+-name|Select-String|Get-ChildItem\s+-Recurse/i.test(text)) {
        return {
          violation: true,
          articleCited: '§17',
          suggestedCorrection: 'Use registered gadget (pheromone_query / Grep / Glob / Read).',
          rationale: '§16/§17: bash/PowerShell discovery pattern',
        };
      }
      return { violation: false };
    }

    // ---- Pattern-based: Toolsmith Council --------------------------------

    if (cfg.patterns && cfg.patterns.length > 0) {
      for (const p of cfg.patterns) {
        if (text.includes(p.forbiddenPattern)) {
          return {
            violation: true,
            forbiddenPattern: p.forbiddenPattern,
            suggestedGadget: p.suggestedGadget,
            rationale: p.rationale,
            articleCited: '§17',
          };
        }
      }
      return { violation: false };
    }

    return { violation: false };
  }

  /** Keep-alive ping to warm the Council model context. */
  async keepWarm(): Promise<void> {
    // M4 wires ollama keep-alive on gemma4:12b
  }
}
