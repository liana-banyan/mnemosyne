// AMPLIFY Computer — Wave Template Writer (B61 Phase B / LB-STACK-0164 §3)
//
// Defines and writes the six canonical wave templates to ~/.lb_substrate/wave_templates/.
// Each template is a versioned, HMAC-bound JSON artifact.
//
// Templates (per §3):
//   1. 4_way_cohort@v1            — 4 parallel Pawn, Bishop SEG synthesis
//   2. 8_seg_multi_scope@v1       — 8 parallel Bishop SEGs, cross-domain synthesis
//   3. n_track_math_test@v1       — N parallel cross-vendor, convergence test
//   4. high_vs_low@v1             — 2 parallel tiers, equivalence-metric
//   5. cross_vendor_verification@v1 — N parallel vendors, agreement metric
//   6. recursive_drill_down@v1    — depth-bounded tree, hierarchical synthesis
//
// Canon anchor: LB-STACK-0164 §3; empirical anchors per §3 named-template annotations
// Authored: B61 Phase B (BP037, 2026-05-11)

import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createHmac } from 'crypto';
import type { WaveTemplateSpec } from './wave_generator';

const WAVE_HMAC_KEY =
  process.env.LB_WAVE_HMAC_KEY ?? 'lb-wave-hmac-phase-a-default-key';

function hmacSign(payload: string): string {
  return createHmac('sha256', WAVE_HMAC_KEY).update(payload, 'utf8').digest('hex');
}

function buildTemplate(spec: Omit<WaveTemplateSpec, 'hmac'>): WaveTemplateSpec {
  const hmac = hmacSign(JSON.stringify(spec));
  return { ...spec, hmac };
}

// ─── Template 1 — 4-Way Cohort ───────────────────────────────────────────────

const T1_4WAY_COHORT = buildTemplate({
  template_name:    '4_way_cohort',
  version:          'v1',
  description:
    '4 parallel Pawn calls scoped to disjoint keyword partitions of a shared root question. ' +
    'Bishop SEG collapses the 4 returns into a single research summary with citations ' +
    'partitioned by scope.',
  empirical_anchor:
    'BP025/BP026/BP028 Pawn cohorts; Math Test 1 Pawn tracks T1/T2/T3/T6',
  canon_anchor: 'LB-STACK-0164 §3 Template 1',
  parameter_schema: {
    type: 'object',
    properties: {
      root_question: {
        type:        'string',
        description: 'The shared root question all 4 partitions research',
      },
      partitions: {
        type:        'array',
        description: '4 disjoint keyword scopes (one per Pawn SEG)',
        default:     ['technical', 'economic', 'social', 'legal'],
      },
      depth: {
        type:        'string',
        description: 'Depth instruction: brief | standard | deep',
        default:     'standard',
      },
    },
    required: ['root_question'],
  },
  segs: [
    {
      seg_id:           'seg_partition_01',
      recipient:        'pawn',
      prompt_template:
        'Research the following question focusing EXCLUSIVELY on {partitions[0]} aspects. ' +
        'Do not address other dimensions.\n\nQuestion: {root_question}\n\nDepth: {depth}',
    },
    {
      seg_id:           'seg_partition_02',
      recipient:        'pawn',
      prompt_template:
        'Research the following question focusing EXCLUSIVELY on {partitions[1]} aspects. ' +
        'Do not address other dimensions.\n\nQuestion: {root_question}\n\nDepth: {depth}',
    },
    {
      seg_id:           'seg_partition_03',
      recipient:        'pawn',
      prompt_template:
        'Research the following question focusing EXCLUSIVELY on {partitions[2]} aspects. ' +
        'Do not address other dimensions.\n\nQuestion: {root_question}\n\nDepth: {depth}',
    },
    {
      seg_id:           'seg_partition_04',
      recipient:        'pawn',
      prompt_template:
        'Research the following question focusing EXCLUSIVELY on {partitions[3]} aspects. ' +
        'Do not address other dimensions.\n\nQuestion: {root_question}\n\nDepth: {depth}',
    },
  ],
  synthesis: {
    recipient: 'bishop',
    prompt_template:
      'You are a synthesis engine for a 4-way cohort wave.\n\n' +
      'Root question: {root_question}\n' +
      'Partitions: {partitions[0]} / {partitions[1]} / {partitions[2]} / {partitions[3]}\n\n' +
      '--- SEG RECEIPTS ---\n{receipts}\n--- END RECEIPTS ---\n\n' +
      'Synthesize into a coherent research summary with explicit citations partitioned by scope. ' +
      'Identify convergences and divergences across the 4 partitions.',
  },
  authored_at: '2026-05-11T00:00:00Z',
  author:      'Knight B61 Phase B (BP037)',
});

// ─── Template 2 — 8-SEG Multi-Scope Synthesis ────────────────────────────────

const T2_8SEG_MULTI_SCOPE = buildTemplate({
  template_name:    '8_seg_multi_scope',
  version:          'v1',
  description:
    '8 parallel Bishop SEGs, each authoring a canon-class artifact on a disjoint sub-domain. ' +
    'Parent-domain Knight synthesis SEG indexes all 8 sub-domain artifacts and authors ' +
    'cross-cutting observations.',
  empirical_anchor: 'BP030 canon-authoring waves',
  canon_anchor:     'LB-STACK-0164 §3 Template 2',
  parameter_schema: {
    type: 'object',
    properties: {
      domain: {
        type:        'string',
        description: 'Parent domain for the synthesis (e.g. "cooperative commerce")',
      },
      sub_domains: {
        type:        'array',
        description: '8 disjoint sub-domains, one per Bishop SEG',
        default: [
          'historical context',
          'technical architecture',
          'economic model',
          'legal framework',
          'user experience',
          'governance structure',
          'competitive landscape',
          'future roadmap',
        ],
      },
    },
    required: ['domain'],
  },
  segs: [],
  seg_expand: {
    from_param:          'sub_domains',
    seg_id_template:     'seg_domain_{i02}',
    recipient_template:  'bishop',
    prompt_template:
      'You are authoring a canon-class research artifact.\n\n' +
      'Parent domain: {domain}\n' +
      'Your sub-domain (segment {i02} of 8): {item}\n\n' +
      'Produce a rigorous, structured analysis of "{item}" within the context of "{domain}". ' +
      'This is an independent artifact — do not reference other segments.',
  },
  synthesis: {
    recipient: 'knight',
    prompt_template:
      'You are synthesizing 8 sub-domain artifacts for the parent domain: {domain}\n\n' +
      '--- SUB-DOMAIN RECEIPTS ---\n{receipts}\n--- END RECEIPTS ---\n\n' +
      'Author a cross-cutting synthesis that:\n' +
      '1. Identifies themes that span multiple sub-domains\n' +
      '2. Notes tensions or contradictions between sub-domains\n' +
      '3. Produces an integrated view of {domain} from all 8 angles\n' +
      '4. Flags any sub-domain that requires deeper drill-down',
  },
  authored_at: '2026-05-11T00:00:00Z',
  author:      'Knight B61 Phase B (BP037)',
});

// ─── Template 3 — N-Track Math Test ──────────────────────────────────────────

const T3_N_TRACK_MATH_TEST = buildTemplate({
  template_name:    'n_track_math_test',
  version:          'v1',
  description:
    'N parallel high-tier flagship dispatches across multiple AI vendor tracks. ' +
    'Synthesis SEG runs a Master Object cross-track convergence test, counting independent ' +
    'convergences against threshold.',
  empirical_anchor:
    'Math Test 1 (8-of-9 convergence, BP026); Math Test 4 (9-of-9 convergence, BP028)',
  canon_anchor: 'LB-STACK-0164 §3 Template 3',
  parameter_schema: {
    type: 'object',
    properties: {
      claim: {
        type:        'string',
        description: 'The claim or mathematical/architectural assertion to test',
      },
      recipients: {
        type:        'array',
        description: 'Ordered list of SegRecipients for each track (e.g. ["knight","pawn","rook"])',
        default:     ['knight', 'pawn', 'rook'],
      },
      convergence_threshold: {
        type:        'string',
        description: 'Convergence threshold as fraction string (e.g. "0.8")',
        default:     '0.8',
      },
    },
    required: ['claim'],
  },
  segs: [],
  seg_expand: {
    from_param:         'recipients',
    seg_id_template:    'seg_track_{i02}',
    recipient_template: '{item}',
    prompt_template:
      'MULTI-VENDOR CONVERGENCE TEST — Track {i02}\n\n' +
      'Claim under evaluation: {claim}\n\n' +
      'Provide your independent, rigorous analysis. ' +
      'State explicitly whether you CONVERGE on this claim (agree it is correct/valid) ' +
      'or DIVERGE (disagree, find a flaw, or find it unverifiable). ' +
      'Conclude with a single line: "VERDICT: CONVERGE" or "VERDICT: DIVERGE — [reason]"',
  },
  synthesis: {
    recipient: 'knight',
    prompt_template:
      'MASTER OBJECT CONVERGENCE TEST\n\n' +
      'Claim: {claim}\n' +
      'Tracks: {recipients}\n' +
      'Convergence threshold: {convergence_threshold}\n\n' +
      '--- TRACK RECEIPTS ---\n{receipts}\n--- END RECEIPTS ---\n\n' +
      'Count CONVERGE vs DIVERGE verdicts. Compute convergence ratio = CONVERGE / total.\n' +
      'Report:\n' +
      '1. Per-track verdict table\n' +
      '2. Convergence ratio (e.g. 3/3 = 1.0)\n' +
      '3. PASS (≥ threshold) or FAIL (< threshold)\n' +
      '4. Cross-track Master Object — what all converging tracks agree on\n' +
      '5. Divergence analysis — what diverging tracks cited as flaw/gap',
  },
  authored_at: '2026-05-11T00:00:00Z',
  author:      'Knight B61 Phase B (BP037)',
});

// ─── Template 4 — HIGH-vs-LOW Validation ─────────────────────────────────────

const T4_HIGH_VS_LOW = buildTemplate({
  template_name:    'high_vs_low',
  version:          'v1',
  description:
    '2 parallel dispatches with identical prompts at different capability tiers (high: Knight, ' +
    'low: Pawn). Synthesis produces a side-by-side equivalence-metric Eblet with verdict.',
  empirical_anchor:
    'BP024 Sonnet 4.6 = Opus-equivalent FOREMAN verdict; BP021 LB Librarian probe (LB-CODEX-0028)',
  canon_anchor: 'LB-STACK-0164 §3 Template 4',
  parameter_schema: {
    type: 'object',
    properties: {
      prompt: {
        type:        'string',
        description: 'The identical prompt dispatched to both tiers',
      },
      high_recipient: {
        type:        'string',
        description: 'High-tier SegRecipient',
        default:     'knight',
      },
      low_recipient: {
        type:        'string',
        description: 'Low-tier SegRecipient',
        default:     'pawn',
      },
    },
    required: ['prompt'],
  },
  segs: [
    {
      seg_id:           'seg_high',
      recipient:        '{high_recipient}',
      prompt_template:  'HIGH TIER DISPATCH — respond with comprehensive, rigorous analysis.\n\n{prompt}',
    },
    {
      seg_id:           'seg_low',
      recipient:        '{low_recipient}',
      prompt_template:  'LOW TIER DISPATCH — respond with concise, direct analysis.\n\n{prompt}',
    },
  ],
  synthesis: {
    recipient: 'knight',
    prompt_template:
      'EQUIVALENCE METRIC SYNTHESIS (HIGH-vs-LOW)\n\n' +
      'Prompt under test: {prompt}\n' +
      'High tier: {high_recipient} | Low tier: {low_recipient}\n\n' +
      '--- SEG RECEIPTS ---\n{receipts}\n--- END RECEIPTS ---\n\n' +
      'Produce a side-by-side equivalence analysis:\n' +
      '1. Content overlap score (0–100%) — what fraction of key claims are shared\n' +
      '2. Key divergences — substantive differences in content, accuracy, or depth\n' +
      '3. Verdict: EQUIVALENT | HIGH_SUPERIOR | INSUFFICIENT\n' +
      '4. Recommendation: can the LOW tier substitute for this task class?',
  },
  authored_at: '2026-05-11T00:00:00Z',
  author:      'Knight B61 Phase B (BP037)',
});

// ─── Template 5 — Cross-Vendor Verification ──────────────────────────────────

const T5_CROSS_VENDOR = buildTemplate({
  template_name:    'cross_vendor_verification',
  version:          'v1',
  description:
    'N parallel cross-vendor dispatches at uniform tool-surface depth. ' +
    'Synthesis produces an agreement-metric Eblet quantifying cross-vendor consensus ' +
    'and flagging divergences.',
  empirical_anchor:
    'Math Test 1 multi-vendor convergence on Master Object 𝓜 (BP026)',
  canon_anchor: 'LB-STACK-0164 §3 Template 5',
  parameter_schema: {
    type: 'object',
    properties: {
      prompt: {
        type:        'string',
        description: 'The verification prompt dispatched to all vendors at uniform depth',
      },
      vendors: {
        type:        'array',
        description: 'Ordered list of SegRecipients for each vendor track',
        default:     ['knight', 'pawn', 'rook'],
      },
    },
    required: ['prompt'],
  },
  segs: [],
  seg_expand: {
    from_param:         'vendors',
    seg_id_template:    'seg_vendor_{i02}',
    recipient_template: '{item}',
    prompt_template:
      'CROSS-VENDOR VERIFICATION — Vendor track {i02}\n\n' +
      'Respond with your independent analysis at standard depth.\n\n' +
      'Query: {prompt}\n\n' +
      'Provide: (1) your direct answer, (2) confidence level, (3) any caveats.',
  },
  synthesis: {
    recipient: 'knight',
    prompt_template:
      'CROSS-VENDOR AGREEMENT METRIC\n\n' +
      'Query: {prompt}\n' +
      'Vendors tested: {vendors}\n\n' +
      '--- VENDOR RECEIPTS ---\n{receipts}\n--- END RECEIPTS ---\n\n' +
      'Produce an agreement-metric Eblet:\n' +
      '1. Consensus score (0–100%) — fraction of factual claims all vendors agree on\n' +
      '2. Per-vendor confidence levels\n' +
      '3. Key divergences — where vendors disagree on substance\n' +
      '4. Outlier detection — any vendor notably off-consensus\n' +
      '5. Synthesis verdict: STRONG_CONSENSUS | MODERATE_CONSENSUS | WEAK_CONSENSUS',
  },
  authored_at: '2026-05-11T00:00:00Z',
  author:      'Knight B61 Phase B (BP037)',
});

// ─── Template 6 — Recursive Drill-Down ───────────────────────────────────────

const T6_RECURSIVE_DRILL_DOWN = buildTemplate({
  template_name:    'recursive_drill_down',
  version:          'v1',
  description:
    'Tree-shaped wave; each SEG explores one branch of a root topic. Depth is bounded (Phase B: ' +
    'depth=1 flat expansion; Phase C adds recursive sub-wave spawning per branch). ' +
    'Synthesis SEG produces hierarchical level-synthesis from all branch receipts.',
  empirical_anchor:
    'BP020 depth-3 nested-subagent (1 Knight × 8 Shadow × 8 sub = 64 nested computation paths)',
  canon_anchor: 'LB-STACK-0164 §3 Template 6',
  parameter_schema: {
    type: 'object',
    properties: {
      root_topic: {
        type:        'string',
        description: 'The root topic to drill down from',
      },
      branches: {
        type:        'array',
        description: 'First-level sub-topics (branch names)',
        default:     ['overview', 'mechanisms', 'implications', 'applications'],
      },
      depth: {
        type:        'string',
        description: 'Exploration depth per branch: brief | standard | deep',
        default:     'standard',
      },
    },
    required: ['root_topic'],
  },
  segs: [],
  seg_expand: {
    from_param:         'branches',
    seg_id_template:    'seg_branch_{i02}',
    recipient_template: 'knight',
    prompt_template:
      'RECURSIVE DRILL-DOWN — Level 1, Branch {i02}\n\n' +
      'Root topic: {root_topic}\n' +
      'This branch: {item}\n' +
      'Exploration depth: {depth}\n\n' +
      'Provide a focused exploration of "{item}" as a sub-topic of "{root_topic}". ' +
      'Structure your response as: (1) core concepts, (2) key mechanisms, (3) open questions ' +
      'that would merit further drill-down.',
  },
  synthesis: {
    recipient: 'knight',
    prompt_template:
      'HIERARCHICAL LEVEL-1 SYNTHESIS\n\n' +
      'Root topic: {root_topic}\n' +
      'Branches explored: {branches}\n' +
      'Depth: {depth}\n\n' +
      '--- BRANCH RECEIPTS ---\n{receipts}\n--- END RECEIPTS ---\n\n' +
      'Produce a hierarchical synthesis:\n' +
      '1. Common themes across all branches\n' +
      '2. Key divergences or unique insights per branch\n' +
      '3. Cross-branch emergence — what new understanding arises from the combination\n' +
      '4. Prioritized drill-down targets — which branches warrant Level 2 expansion\n' +
      '5. Level-1 synthesis verdict: COMPREHENSIVE | PARTIAL | NEEDS_EXPANSION',
  },
  authored_at: '2026-05-11T00:00:00Z',
  author:      'Knight B61 Phase B (BP037)',
});

// ─── Registry ─────────────────────────────────────────────────────────────────

const BUILT_IN_TEMPLATES: WaveTemplateSpec[] = [
  T1_4WAY_COHORT,
  T2_8SEG_MULTI_SCOPE,
  T3_N_TRACK_MATH_TEST,
  T4_HIGH_VS_LOW,
  T5_CROSS_VENDOR,
  T6_RECURSIVE_DRILL_DOWN,
];

/**
 * Write all six built-in templates to `templatesDir` if they do not already exist.
 * Idempotent — skips files that are already present.
 * Called by initWaveGenerator() at daemon startup.
 */
export function registerBuiltInTemplates(templatesDir: string): void {
  let written = 0;
  let skipped = 0;

  for (const spec of BUILT_IN_TEMPLATES) {
    const fileName = `${spec.template_name}@${spec.version}.tmpl.json`;
    const filePath = resolve(templatesDir, fileName);

    if (existsSync(filePath)) {
      skipped++;
      continue;
    }

    writeFileSync(filePath, JSON.stringify(spec, null, 2), 'utf8');
    written++;
    console.log(`[wave-templates] wrote ${fileName}`);
  }

  if (written > 0 || skipped > 0) {
    console.log(
      `[wave-templates] ${written} written, ${skipped} already present — ${BUILT_IN_TEMPLATES.length} built-in templates registered`,
    );
  }
}
