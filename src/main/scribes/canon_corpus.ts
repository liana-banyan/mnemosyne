/**
 * canon_corpus.ts -- Canon corpus loader and violation scanner stub
 *
 * BP089 · Mountain 2
 * Loads eblet files from disk on startup. Provides checkViolations() to
 * return ViolationCandidates for a given dispatch. Full LLM-backed scoring
 * deferred until M4 gemma4:12b integration. Pre-M4 mode uses heuristic
 * keyword matching as a fast-path pre-filter.
 *
 * Canon ref: canon_minor_council_star_chamber_free_local_multi_model_consensus_requires_mountain_1_substrate_priming_bp089
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Dispatch, ViolationCandidate } from './types';

// ---------------------------------------------------------------------------
// Heuristic pre-filter rules (pre-M4 fallback)
// ---------------------------------------------------------------------------

interface CorpusRule {
  canonId: string;
  description: string;
  patterns: RegExp[];
  correction: string;
}

const BUILTIN_RULES: CorpusRule[] = [
  {
    canonId: 'membership_obviously_better_5_per_year',
    description: 'Membership price must be $5/year. Any other price is a canon violation.',
    patterns: [
      /\$\s*(?!5(?:\.00)?\/year)[\d]+(?:\.\d+)?\/year/i,
      /members?\s+pay\s+\$(?!5(?:\.00)?\b)[\d]+/i,
      /membership\s+(?:fee|cost|price)\s+(?:is|of)?\s*\$(?!5(?:\.00)?\b)[\d]+/i,
    ],
    correction: 'Membership is $5/year. No other pricing is canonical.',
  },
  {
    canonId: 'mic_stamped_unsigned_broadcast',
    description: 'All inter-agent broadcasts must carry a MIC STAMPED Ed25519 signature.',
    patterns: [/broadcast[^.]*without.*sign/i, /unsigned.*broadcast/i],
    correction: 'Attach a MIC STAMPED Ed25519 signature before broadcasting.',
  },
  {
    canonId: 'three_gear_currency_conversion',
    description: 'Three-gear currency conversion (Credits/Marks/Joules) must use canonical rates.',
    patterns: [/credits?\s*=\s*\$(?![\d.]+\b.*marks)/i],
    correction: 'Use canonical three-gear conversion: Credits → Marks → Joules at platform-defined rates.',
  },
  {
    canonId: 'preferences_inferred_no_questionnaire',
    description: 'Member preferences must be inferred, never collected via questionnaire.',
    patterns: [/questionnaire/i, /fill\s+out\s+(?:a\s+)?(?:form|survey)/i],
    correction: 'Preferences are inferred from participation; questionnaires are banned.',
  },
  {
    canonId: 'no_show_forfeit_policy',
    description: 'No-show forfeit language in cook/restaurant dispatches must match canon exactly.',
    patterns: [/no.?show.*forfeit/i],
    correction: 'Apply canonical no-show forfeit policy language.',
  },
];

// ---------------------------------------------------------------------------
// CanonCorpus
// ---------------------------------------------------------------------------

export class CanonCorpus {
  private rules: CorpusRule[] = [...BUILTIN_RULES];
  private ebletCount: number = 0;

  private constructor() {}

  /**
   * Load eblets from disk and augment the rule table.
   * Falls back to BUILTIN_RULES only if the folder is missing or empty.
   */
  static async loadFromDisk(ebletsFolderPath: string): Promise<CanonCorpus> {
    const corpus = new CanonCorpus();

    if (!fs.existsSync(ebletsFolderPath)) {
      return corpus;
    }

    let files: string[] = [];
    try {
      files = fs.readdirSync(ebletsFolderPath).filter(f => f.endsWith('.eblet.md') || f.endsWith('.md'));
    } catch (_err) {
      return corpus;
    }

    for (const file of files) {
      try {
        const fullPath = path.join(ebletsFolderPath, file);
        const raw = fs.readFileSync(fullPath, 'utf-8');
        // Simple heuristic: treat the filename stem as the canonId
        const canonId = path.basename(file, path.extname(file));
        corpus.rules.push({
          canonId,
          description: `Eblet corpus rule: ${canonId}`,
          patterns: [],          // LLM-scored; heuristic patterns empty pre-M4
          correction: raw.slice(0, 200),
        });
        corpus.ebletCount++;
      } catch (_err) {
        // Skip unreadable eblets
      }
    }

    return corpus;
  }

  /**
   * Scan a dispatch for potential canon violations.
   * Returns one ViolationCandidate per matched rule.
   */
  async checkViolations(dispatch: Dispatch): Promise<ViolationCandidate[]> {
    const candidates: ViolationCandidate[] = [];

    for (const rule of this.rules) {
      let confidence = 0;
      for (const pattern of rule.patterns) {
        if (pattern.test(dispatch.text ?? '')) {
          confidence = 0.85; // High confidence for hard-coded heuristic match
          break;
        }
      }

      if (confidence > 0) {
        candidates.push({
          canonId: rule.canonId,
          description: rule.description,
          correction: rule.correction,
          confidence,
          hash: `${rule.canonId}__${dispatch.id}`,
        });
      }
    }

    return candidates;
  }

  get loadedEbletCount(): number {
    return this.ebletCount;
  }

  get ruleCount(): number {
    return this.rules.length;
  }
}
