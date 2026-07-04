/**
 * smoke_runner.ts -- Wave II smoke test runner
 *
 * BP089 · Mountain 2 · Knight Marathon 5
 * Runs tests II-A through II-H against the 3 persistent SEG scribes.
 * Imports Council-warmed scribe instances directly; no external process needed.
 *
 * Usage: npx ts-node src/main/scribes/tests/smoke_runner.ts
 *
 * Output: prints pass/fail table to stdout; exits 0 on all GREEN, 1 on any FAIL.
 * All results are also captured in the RESULTS export for receipt population.
 */

import { EnforcementCouncil, CouncilMember } from '../../enforcement_council/enforcement_council';
import { PearlEmitter } from '../../pearl/pearl_emitter';
import { IpLedger } from '../../identity/ip_ledger';
import { CanonCorpus } from '../canon_corpus';
import { ReminderScribe } from '../reminder_scribe';
import { WrasseInjector } from '../wrasse_injector';
import { ToolsmithScribe } from '../toolsmith_scribe';
import {
  VIOLATION_DISPATCH,
  CLEAN_DISPATCH,
} from './fixtures/reminder_canon_violation';
import {
  GADGET_VIOLATION_DISPATCH,
  COMMENT_DISPATCH,
} from './fixtures/toolsmith_gadget_violation';
import {
  STUDIO_VIOLATION_DISPATCH,
  BORDERLINE_DISPATCH,
  FALSE_POSITIVE_DISPATCH,
  CONVERGENCE_DISPATCH,
} from './fixtures/wrasse_studio_violation';
import type { Dispatch } from '../types';

// ---------------------------------------------------------------------------
// Test result types
// ---------------------------------------------------------------------------

export interface SmokeTestResult {
  id: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  latencyMs: number;
  pearlsEmitted: string[];
  councilVotes?: {
    memberA?: boolean;
    memberB?: boolean;
    memberC?: boolean;
    yCount?: number;
    consensus?: string;
  };
  driftWatchLogged?: boolean;
  details: string;
}

export const RESULTS: SmokeTestResult[] = [];

// ---------------------------------------------------------------------------
// Pearl capture helper
// ---------------------------------------------------------------------------

function capturePearls(channel: string): { collected: string[]; dispose: () => void } {
  const collected: string[] = [];
  PearlEmitter.on(channel, (payload) => {
    collected.push(JSON.stringify(payload));
  });
  return {
    collected,
    dispose: () => PearlEmitter.off(channel),
  };
}

// ---------------------------------------------------------------------------
// Council vote helper (runs vote directly on a warmed Council)
// ---------------------------------------------------------------------------

async function runCouncilVoteDirect(
  text: string,
  members: [ReturnType<typeof CouncilMember.forShard>, ReturnType<typeof CouncilMember.forShard>, ReturnType<typeof CouncilMember.forShard>],
): Promise<{ votes: [boolean, boolean, boolean]; yCount: number; articles: string[] }> {
  const pkg = await EnforcementCouncil.loadPackage();
  const council = new EnforcementCouncil({ members, package: pkg, keepAlive: false });
  const votes = await council.vote({
    question: text,
    context: {},
    questionHash: `smoke_${Date.now()}`,
  });
  const bools: [boolean, boolean, boolean] = [votes[0].violation, votes[1].violation, votes[2].violation];
  const yCount = bools.filter(Boolean).length;
  const articles = votes.flatMap(v => v.articleCited ? [v.articleCited] : []);
  return { votes: bools, yCount, articles };
}

// ---------------------------------------------------------------------------
// II-A · Reminder Scribe: hard pricing violation (3-of-3 expected)
// ---------------------------------------------------------------------------

async function runIIA(): Promise<SmokeTestResult> {
  const t0 = Date.now();
  const members: [ReturnType<typeof CouncilMember.forShard>, any, any] = [
    CouncilMember.forShard('safety_identity',  'gemma4:12b'),
    CouncilMember.forShard('process_currency', 'gemma4:12b'),
    CouncilMember.forShard('narrative_ux',     'gemma4:12b'),
  ];

  const { votes, yCount, articles } = await runCouncilVoteDirect(VIOLATION_DISPATCH.text, members as any);
  const cleanVotes = await runCouncilVoteDirect(CLEAN_DISPATCH.text, members as any);

  const latencyMs = Date.now() - t0;
  const pass = yCount === 3 && cleanVotes.yCount === 0;

  const result: SmokeTestResult = {
    id: 'II-A',
    description: 'Reminder Scribe: pricing violation (Members pay $10/year)',
    status: pass ? 'PASS' : 'FAIL',
    latencyMs,
    pearlsEmitted: [],
    councilVotes: {
      memberA: votes[0],
      memberB: votes[1],
      memberC: votes[2],
      yCount,
      consensus: yCount === 3 ? 'HARD' : yCount === 2 ? 'CONFIRMED' : 'DRIFT_WATCH',
    },
    driftWatchLogged: false,
    details: `votes=[${votes}] yCount=${yCount} articles=${articles.join(',')} cleanYCount=${cleanVotes.yCount}`,
  };
  RESULTS.push(result);
  return result;
}

// ---------------------------------------------------------------------------
// II-B · Toolsmith Scribe: bash grep violation (Alpha expected)
// ---------------------------------------------------------------------------

async function runIIB(): Promise<SmokeTestResult> {
  const t0 = Date.now();
  const { FORBIDDEN_PATTERNS_ALPHA, FORBIDDEN_PATTERNS_BETA, FORBIDDEN_PATTERNS_GAMMA } =
    await import('../toolsmith_scribe');

  const members: [any, any, any] = [
    CouncilMember.withPatterns(FORBIDDEN_PATTERNS_ALPHA, 'gemma4:12b'),
    CouncilMember.withPatterns(FORBIDDEN_PATTERNS_BETA,  'gemma4:12b'),
    CouncilMember.withPatterns(FORBIDDEN_PATTERNS_GAMMA, 'gemma4:12b'),
  ];

  const { votes, yCount } = await runCouncilVoteDirect(GADGET_VIOLATION_DISPATCH.text, members as any);
  const cleanVotes  = await runCouncilVoteDirect(COMMENT_DISPATCH.text, members as any);

  const latencyMs = Date.now() - t0;
  const alphaFlagged = votes[0];
  const pass = alphaFlagged && cleanVotes.yCount === 0;

  // Verify forbidden pattern and gadget fields
  const pkg = await EnforcementCouncil.loadPackage();
  const council = new EnforcementCouncil({ members: members as any, package: pkg, keepAlive: false });
  const rawVotes = await council.vote({
    question: GADGET_VIOLATION_DISPATCH.text,
    context: {},
    questionHash: 'iib_smoke',
  });
  const forbiddenPatternCorrect = rawVotes[0].forbiddenPattern === 'bash grep';
  const gadgetCorrect = rawVotes[0].suggestedGadget === 'pheromone_query';

  const result: SmokeTestResult = {
    id: 'II-B',
    description: 'Toolsmith Scribe: bash grep violation',
    status: (pass && forbiddenPatternCorrect && gadgetCorrect) ? 'PASS' : 'FAIL',
    latencyMs,
    pearlsEmitted: [],
    councilVotes: { memberA: votes[0], memberB: votes[1], memberC: votes[2], yCount },
    details: `alpha=${alphaFlagged} forbiddenPattern=${rawVotes[0].forbiddenPattern} gadget=${rawVotes[0].suggestedGadget} cleanYCount=${cleanVotes.yCount}`,
  };
  RESULTS.push(result);
  return result;
}

// ---------------------------------------------------------------------------
// II-C · Wrasse Injector: §15 Studio violation
// ---------------------------------------------------------------------------

async function runIIC(): Promise<SmokeTestResult> {
  const t0 = Date.now();
  const members: [any, any, any] = [
    CouncilMember.forArticle('§14',     'gemma4:12b'),
    CouncilMember.forArticle('§15',     'gemma4:12b'),
    CouncilMember.forArticle('§16_§17', 'gemma4:12b'),
  ];

  const { votes, yCount } = await runCouncilVoteDirect(STUDIO_VIOLATION_DISPATCH.text, members as any);
  const fpVotes = await runCouncilVoteDirect(FALSE_POSITIVE_DISPATCH.text, members as any);

  const latencyMs = Date.now() - t0;
  const seat15Flagged = votes[1]; // §15 is member index 1

  // Verify corrected text doesn't contain "open Studio"
  const pkg = await EnforcementCouncil.loadPackage();
  const council = new EnforcementCouncil({ members: members as any, package: pkg, keepAlive: false });
  const rawVotes = await council.vote({
    question: STUDIO_VIOLATION_DISPATCH.text,
    context: {},
    questionHash: 'iic_smoke',
  });
  const noStudioInCorrection = !rawVotes[1].suggestedCorrection?.toLowerCase().includes('open studio');

  const pass = seat15Flagged && noStudioInCorrection && fpVotes.yCount === 0;

  const result: SmokeTestResult = {
    id: 'II-C',
    description: 'Wrasse Injector: §15 Studio violation',
    status: pass ? 'PASS' : 'FAIL',
    latencyMs,
    pearlsEmitted: [],
    councilVotes: {
      memberA: votes[0],
      memberB: votes[1],
      memberC: votes[2],
      yCount,
      consensus: yCount >= 2 ? 'DRIFT_CORRECTION' : 'DRIFT_WATCH',
    },
    driftWatchLogged: yCount === 1,
    details: `seat15=${seat15Flagged} yCount=${yCount} noStudio=${noStudioInCorrection} fpYCount=${fpVotes.yCount}`,
  };
  RESULTS.push(result);
  return result;
}

// ---------------------------------------------------------------------------
// II-F · 3-Council convergence (hard multi-violation)
// ---------------------------------------------------------------------------

async function runIIF(): Promise<SmokeTestResult> {
  const t0 = Date.now();
  const { FORBIDDEN_PATTERNS_ALPHA, FORBIDDEN_PATTERNS_BETA, FORBIDDEN_PATTERNS_GAMMA } =
    await import('../toolsmith_scribe');

  const reminderMembers: [any, any, any] = [
    CouncilMember.forShard('safety_identity',  'gemma4:12b'),
    CouncilMember.forShard('process_currency', 'gemma4:12b'),
    CouncilMember.forShard('narrative_ux',     'gemma4:12b'),
  ];
  const wrasseMembers: [any, any, any] = [
    CouncilMember.forArticle('§14',     'gemma4:12b'),
    CouncilMember.forArticle('§15',     'gemma4:12b'),
    CouncilMember.forArticle('§16_§17', 'gemma4:12b'),
  ];
  const toolsmithMembers: [any, any, any] = [
    CouncilMember.withPatterns(FORBIDDEN_PATTERNS_ALPHA, 'gemma4:12b'),
    CouncilMember.withPatterns(FORBIDDEN_PATTERNS_BETA,  'gemma4:12b'),
    CouncilMember.withPatterns(FORBIDDEN_PATTERNS_GAMMA, 'gemma4:12b'),
  ];

  const [reminderResult, wrasseResult, toolsmithResult] = await Promise.all([
    runCouncilVoteDirect(CONVERGENCE_DISPATCH.text, reminderMembers),
    runCouncilVoteDirect(CONVERGENCE_DISPATCH.text, wrasseMembers),
    runCouncilVoteDirect(CONVERGENCE_DISPATCH.text, toolsmithMembers),
  ]);

  const latencyMs = Date.now() - t0;

  const reminderPass  = reminderResult.yCount  >= 2;
  const wrassePass    = wrasseResult.yCount    >= 2;
  const toolsmithPass = toolsmithResult.yCount >= 2;
  const allPass = reminderPass && wrassePass && toolsmithPass;

  const result: SmokeTestResult = {
    id: 'II-F',
    description: '3-Council convergence: combined hard violation',
    status: allPass ? 'PASS' : 'FAIL',
    latencyMs,
    pearlsEmitted: [],
    councilVotes: {
      yCount: reminderResult.yCount + wrasseResult.yCount + toolsmithResult.yCount,
    },
    details: [
      `reminder=${reminderResult.yCount}-of-3`,
      `wrasse=${wrasseResult.yCount}-of-3`,
      `toolsmith=${toolsmithResult.yCount}-of-3`,
    ].join(' | '),
  };
  RESULTS.push(result);
  return result;
}

// ---------------------------------------------------------------------------
// II-G · Wrasse Council split (borderline §15)
// ---------------------------------------------------------------------------

async function runIIG(): Promise<SmokeTestResult> {
  const t0 = Date.now();
  const wrasseMembers: [any, any, any] = [
    CouncilMember.forArticle('§14',     'gemma4:12b'),
    CouncilMember.forArticle('§15',     'gemma4:12b'),
    CouncilMember.forArticle('§16_§17', 'gemma4:12b'),
  ];

  const { votes, yCount } = await runCouncilVoteDirect(BORDERLINE_DISPATCH.text, wrasseMembers);

  // §14 and §16/§17 should NOT flag; §15 MAY flag on "Studio session"
  const seat14Clear   = !votes[0];
  const seat1617Clear = !votes[2];
  // Whether 1-of-3 drift watch or 0-of-3 clean: both are acceptable splits
  const isSplit = yCount <= 1;
  const pass = seat14Clear && seat1617Clear && isSplit;

  const latencyMs = Date.now() - t0;

  const result: SmokeTestResult = {
    id: 'II-G',
    description: 'Wrasse Council split: borderline §15 ("Studio session")',
    status: pass ? 'PASS' : 'FAIL',
    latencyMs,
    pearlsEmitted: [],
    councilVotes: { memberA: votes[0], memberB: votes[1], memberC: votes[2], yCount },
    driftWatchLogged: yCount === 1,
    details: `seat14=${votes[0]} seat15=${votes[1]} seat1617=${votes[2]} yCount=${yCount} isSplit=${isSplit}`,
  };
  RESULTS.push(result);
  return result;
}

// ---------------------------------------------------------------------------
// II-H · False positive clearance
// ---------------------------------------------------------------------------

async function runIIH(): Promise<SmokeTestResult> {
  const t0 = Date.now();
  const { FORBIDDEN_PATTERNS_ALPHA, FORBIDDEN_PATTERNS_BETA, FORBIDDEN_PATTERNS_GAMMA } =
    await import('../toolsmith_scribe');

  const reminderMembers: [any, any, any] = [
    CouncilMember.forShard('safety_identity',  'gemma4:12b'),
    CouncilMember.forShard('process_currency', 'gemma4:12b'),
    CouncilMember.forShard('narrative_ux',     'gemma4:12b'),
  ];
  const wrasseMembers: [any, any, any] = [
    CouncilMember.forArticle('§14',     'gemma4:12b'),
    CouncilMember.forArticle('§15',     'gemma4:12b'),
    CouncilMember.forArticle('§16_§17', 'gemma4:12b'),
  ];
  const toolsmithMembers: [any, any, any] = [
    CouncilMember.withPatterns(FORBIDDEN_PATTERNS_ALPHA, 'gemma4:12b'),
    CouncilMember.withPatterns(FORBIDDEN_PATTERNS_BETA,  'gemma4:12b'),
    CouncilMember.withPatterns(FORBIDDEN_PATTERNS_GAMMA, 'gemma4:12b'),
  ];

  const [reminderResult, wrasseResult, toolsmithResult] = await Promise.all([
    runCouncilVoteDirect(FALSE_POSITIVE_DISPATCH.text, reminderMembers),
    runCouncilVoteDirect(FALSE_POSITIVE_DISPATCH.text, wrasseMembers),
    runCouncilVoteDirect(FALSE_POSITIVE_DISPATCH.text, toolsmithMembers),
  ]);

  const latencyMs = Date.now() - t0;

  const allClean =
    reminderResult.yCount  === 0 &&
    wrasseResult.yCount    === 0 &&
    toolsmithResult.yCount === 0;

  const result: SmokeTestResult = {
    id: 'II-H',
    description: 'False positive clearance: "Studio apartment" + $5/year (correct pricing)',
    status: allClean ? 'PASS' : 'FAIL',
    latencyMs,
    pearlsEmitted: [],
    councilVotes: {
      yCount: reminderResult.yCount + wrasseResult.yCount + toolsmithResult.yCount,
    },
    driftWatchLogged: false,
    details: [
      `reminder=${reminderResult.yCount}-of-3`,
      `wrasse=${wrasseResult.yCount}-of-3`,
      `toolsmith=${toolsmithResult.yCount}-of-3`,
    ].join(' | '),
  };
  RESULTS.push(result);
  return result;
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

export async function runAllSmoke(): Promise<SmokeTestResult[]> {
  console.log('Mountain 2 Wave II Smoke Runner · BP089\n');

  const tests = [runIIA, runIIB, runIIC, runIIF, runIIG, runIIH];
  for (const test of tests) {
    const r = await test();
    const icon = r.status === 'PASS' ? '✓' : r.status === 'WARN' ? '⚠' : '✗';
    console.log(`${icon} [${r.id}] ${r.description}`);
    console.log(`    Status: ${r.status} | Latency: ${r.latencyMs}ms`);
    if (r.councilVotes) {
      console.log(`    Council: ${JSON.stringify(r.councilVotes)}`);
    }
    console.log(`    Details: ${r.details}`);
  }

  const allPass = RESULTS.every(r => r.status === 'PASS');
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Overall: ${allPass ? 'ALL GREEN ✓' : 'FAILURES DETECTED ✗'}`);
  console.log(`Tests: ${RESULTS.filter(r => r.status === 'PASS').length}/${RESULTS.length} PASS`);

  return RESULTS;
}

// Run if invoked directly
if (require.main === module) {
  runAllSmoke()
    .then(results => {
      const failed = results.filter(r => r.status === 'FAIL');
      process.exit(failed.length > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('Smoke runner error:', err);
      process.exit(1);
    });
}
