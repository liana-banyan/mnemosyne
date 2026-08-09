// definitional_cascade.ts -- D-BP149-043/BISHOP/S43/seg-method2build
//
// METHOD 2 of the Liana Cycle method registry: THE DEFINITIONAL CASCADE. Shape: the question
// turns on what a term MEANS, and the options are competing statements of that meaning.
// Taught by the Founder's qid 85 walkthrough (bias), FounderCascadeWorkedByHand.txt Excerpt
// 7 -- he never orders anything for that question. He categorizes the options by shared
// predicate, looks up the definition of the term, establishes the REGISTER (statistics, not
// sewing, not K-pop), reduces the definition to its core sense, and matches on sense rather
// than tokens. Rules 12, 13 and 11 of his fourteen -- see
// C:\Users\Administrator\Documents\LianaBanyanPlatform\BISHOP_DROPZONE\METHOD_2_TEACHING_BP149.md
// for the ticket's own reading of the excerpt, stage by stage.
//
// SHARED PREFIX -- stages 0, 1 and 2 of Method 1 (comparative_cascade.ts), REUSED NOT COPIED.
// Founder, BP149, verbatim (method_registry.ts header): "Use stages 0, 1 and 2 from Method 1,
// then add ... rules 12, 13 and 11 -- a different cascade for a different question shape."
// runStage0RegisterGate() and extractAssertedMentions() are imported from comparative_cascade.ts
// (which was given a small, behavior-preserving refactor by this ticket to make that import
// possible -- see that file's own "shared stages 0/1/2" header block). Both stages were built
// and calibrated for comparative/ranking questions (region membership, dense/sparse vocabulary);
// applied here to a definitional question they are EXPECTED to mostly find nothing to do, and
// that is reported honestly in the transcript, not hidden -- an honest no-op is not a bug.
//
// D1 THROUGH D5, HIS RULES 12/13/11 -- new to this file, the actual Method 2 machinery:
//   D1 categorize options by shared predicate (rule 12) -- mechanical vocabulary clustering, no
//      model call anywhere.
//   D2-D4 (D-BP150-016, SUPERSEDES the original D2/D3/D4 below) -- SURVEY THE ASK instead of
//      collapsing it. The original D2/D3/D4 each independently CHOSE a single sense of the term:
//      D2 looked the bare term up once, D3 GUESSED one register from option vocabulary and
//      verified only that guess, D4 reduced the verified passage to ONE core sense. Canon F-1
//      (canon_liana_methods_are_compositions_of_named_elements_bp150.eblet.md) is the measured
//      failure this caused: on qid 85, Stage 1's inverse call fetched the SAMPLING fold of "bias"
//      ("A sampling method is called biased if it systematically favors some outcomes over
//      others") and discarded it against every option, then D2/D3/D4 independently re-fetched
//      and silently carried forward the ESTIMATOR fold instead ("bias is the tendency of a
//      statistic to overestimate or underestimate the population parameter") -- two different
//      folds inside ONE register (statistics), picked between with no record that a choice had
//      even been made. qid 85's key (E) lives in the SAMPLING fold; the ESTIMATOR fold points at
//      J. Had D5 been implemented against the collapsed sense, it would have answered confidently
//      and wrongly. surveyAsk() (elements/survey_ask.ts, E-SURVEY-ASK) replaces D2/D3/D4's
//      collapse: it enumerates every verified denotation of the term, unranked, each carried
//      forward with its verbatim sentence, source, source-stated register and aspect. It picks
//      nothing. D1 (mechanical clustering) is untouched below; it is not part of the collapse.
//   D5 match on sense (E-MATCH-UP) -- DELIBERATELY NOT IMPLEMENTED. HARDWIRE-22 + this ticket's
//      own instruction: no bigram overlap, no embedding distance, no forced pick. Measured this
//      session: a bigram scorer gave all ten of qid 46's options an identical 0.35; a narrow
//      YES/NO to the local model scored 1 of 4 and flipped its own answer at temperature 0.
//      This stage ends in an HONEST ABSTAIN carrying EVERY surveyed denotation forward as a
//      sourced fact, plus the surviving candidate pool -- not one collapsed core sense. An
//      abstain at D5 is a PASS for this ticket -- nothing here is tuned to reach the answer key,
//      and canon marks E-MATCH-UP UNSOLVED: implementing it here would smuggle the unsolved
//      sense-matching problem in disguised, and on qid 85 itself it would answer J and be wrong.

import { avgOptionWordCount, registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, MethodRunContext, ShapeTestResult } from '../method_registry';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';
import {
  extractAssertedMentions,
  googleBlocks,
  HIGH_WORDS,
  LOW_WORDS,
  runStage0RegisterGate,
} from './comparative_cascade';
// D-BP150-016 -- E-SURVEY-ASK, wired in to replace D2/D3/D4's collapse. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/
//     canon_liana_methods_are_compositions_of_named_elements_bp150.eblet.md
import { surveyAsk } from '../elements/survey_ask';

function nowIso(): string {
  return new Date().toISOString();
}

// Calibrated against the six real BP149 questions in the canon comparison table: qid 85's ten
// options average ~11 words each and nine of ten literally begin "It describes..." -- a set of
// competing statements of what a term means, not short members of one category (contrast qid
// 98's region names, avg ~2 words). MIN_AVG_OPTION_WORDS mirrors comparative_cascade.ts's own
// MAX_AVG_OPTION_WORDS_FOR_RANKING (6) from the opposite side, so a question in the gap between
// the two (qid 92's referent-object question, avg ~3.3 words, no definitional cue) matches
// neither method and correctly falls through to "no method matches, ask the human."
const MIN_AVG_OPTION_WORDS_FOR_DEFINITIONS = 5;

const DEFINITIONAL_CUE_RE = /\b(correctly (explains|describes|defines)|best (explains|describes|defines)|which of the following statements|refers to|is defined as|means)\b/i;

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  if (!input.options || Object.keys(input.options).length < 2) {
    return { matches: false, reason: 'no option pool of competing statements to match on sense' };
  }
  if (!DEFINITIONAL_CUE_RE.test(input.question)) {
    return { matches: false, reason: 'question does not ask what a term means or which statement correctly explains/defines it' };
  }
  const avgWords = avgOptionWordCount(input.options);
  if (avgWords < MIN_AVG_OPTION_WORDS_FOR_DEFINITIONS) {
    return {
      matches: false,
      reason: `options are too short (avg ${avgWords.toFixed(1)} words, < ${MIN_AVG_OPTION_WORDS_FOR_DEFINITIONS}) to be competing statements of a definition`,
    };
  }
  return {
    matches: true,
    reason: `question asks what a term means and options are full competing statements (avg ${avgWords.toFixed(1)} words) -- shape recognized, method not yet taught`,
  };
}

// ─────────────────────────── D1: categorize by shared predicate (rule 12), mechanical ───────────────────────────

const D1_STOPWORDS = new Set([
  'it', 'describes', 'a', 'an', 'the', 'of', 'that', 'results', 'in', 'is', 'are', 'to', 'for',
  'on', 'with', 'and', 'or', 'process', 'which', 'this', 'be', 'has', 'have', 'their', 'from',
  'by', 'as', 'at', 'not', 'no',
]);

function significantWords(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !D1_STOPWORDS.has(w)),
  );
}

interface D1Result {
  clusters: string[][];
  oddOneOut: string[];
  oddOneOutBasis: 'isolated' | 'min-degree';
  wordSets: Record<string, Set<string>>;
}

/** D1, rule 12: "Well, first, I categorize the possible answers... A, B, sorta C but more to
 *  that, D, E same as C ... G does not." Mechanical clustering by shared CONTENT vocabulary --
 *  no model call anywhere, arithmetic over the option text only, per HARDWIRE-22 ("the code
 *  decides"). Two options join a cluster when they share at least MIN_SHARED_WORDS significant
 *  (non-stopword) words; connected components over that graph are the clusters. A component of
 *  size 1 is reported as an odd one out (isolated -- nothing else in the set shares its
 *  vocabulary at all). If nothing is isolated at this threshold, the option(s) with the fewest
 *  total shared-word connections are reported instead, explicitly labeled by degree rather than
 *  isolation so the finding is never overstated beyond what the arithmetic actually shows. */
const MIN_SHARED_WORDS = 2;

function categorizeBySharedPredicate(OPT: Record<string, string>): D1Result {
  const letters = Object.keys(OPT);
  const wordSets: Record<string, Set<string>> = {};
  for (const L of letters) wordSets[L] = significantWords(OPT[L]);

  const degree: Record<string, number> = {};
  for (const L of letters) degree[L] = 0;
  const parent: Record<string, string> = {};
  for (const L of letters) parent[L] = L;
  const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: string, b: string) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[ra] = rb; };

  for (let i = 0; i < letters.length; i++) {
    for (let j = i + 1; j < letters.length; j++) {
      const a = letters[i]; const b = letters[j];
      let shared = 0;
      for (const w of wordSets[a]) if (wordSets[b].has(w)) shared++;
      if (shared >= MIN_SHARED_WORDS) { union(a, b); degree[a]++; degree[b]++; }
    }
  }
  const groups: Record<string, string[]> = {};
  for (const L of letters) { const r = find(L); (groups[r] ||= []).push(L); }
  const clusters = Object.values(groups).filter((g) => g.length > 1);
  let oddOneOut = Object.values(groups).filter((g) => g.length === 1).flat();
  let oddOneOutBasis: D1Result['oddOneOutBasis'] = 'isolated';
  if (!oddOneOut.length && letters.length) {
    const minDeg = Math.min(...letters.map((L) => degree[L]));
    oddOneOut = letters.filter((L) => degree[L] === minDeg);
    oddOneOutBasis = 'min-degree';
  }
  return { clusters, oddOneOut, oddOneOutBasis, wordSets };
}

// ─────────────────────────── D2: the bare term ───────────────────────────

/** Pulls the term the question is actually asking about off the definitional cue phrase itself
 *  ("...correctly explains BIAS?" -> "bias") -- code, not a model guess. Falls back to the last
 *  content word in the question if no cue phrase is found (shapeTest already required one to
 *  reach this point, so the fallback is a safety net, not the normal path). */
function extractBareTerm(question: string): string {
  const m = question.match(/(?:explains?|describes?|defines?|refers to|means)\s+([a-z][a-z0-9 '-]*?)\s*[?.!]*\s*$/i);
  if (m && m[1].trim()) return m[1].trim();
  const stripped = question.replace(/[?.!]+$/, '').trim();
  const words = stripped.split(/\s+/);
  return words[words.length - 1] || stripped;
}

// D3's original register-guess lexicon (guessRegisterFromOptions/REGISTER_LEXICON) is REMOVED as
// of D-BP150-016 -- it guessed exactly one register from option vocabulary, which is the collapse
// this ticket replaces. surveyAsk()'s own per-source register extraction (source-stated, verified
// verbatim, never guessed from option vocabulary) supersedes it; see survey_ask.ts's own header.

// ─────────────────────────── run ───────────────────────────

async function run(input: MethodQuestionInput, ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  const { askGoogle, emit } = ctx;
  const OPT = input.options as Record<string, string>;
  const ALL = Object.keys(OPT);
  const KEY = input.correctAnswer;
  const t0 = Date.now();

  const say = (text: string) => emit({ kind: 'header', text, ts: nowIso() });
  const step = (text: string) => emit({ kind: 'stage', text: `-> ${text}`, ts: nowIso() });
  const fact = (text: string) => emit({ kind: 'fact', text: `+ ${text}`, ts: nowIso() });
  const note = (text: string) => emit({ kind: 'note', text, ts: nowIso() });

  say(`METHOD definitional-cascade -- ${input.qid != null ? `qid ${input.qid}` : 'free-text'}`);
  note(`   ${input.question}`);
  note(`   ${ALL.map((L) => `${L}) ${OPT[L]}`).join('  ')}`);

  // ── SHARED PREFIX: stages 0, 1 and 2 of Method 1, reused not copied (see this file's header) ──
  let pool = [...ALL];
  pool = await runStage0RegisterGate(OPT, pool, ctx);

  const inverseQuestion = /\bNOT\b/i.test(input.question)
    ? input.question.replace(/\bNOT\s+/i, ' ').replace(/\s+/g, ' ').trim()
    : input.question;
  step('STAGE 1  ask the inverse -- one cheap source, the question turned around (shared code, comparative_cascade.ts)');
  const q1Text = `${inverseQuestion} ${ALL.map((L) => `${L}) ${OPT[L]}`).join(' ')}`;
  note(`   ${q1Text}`);
  const denseVotes: Record<string, number> = {};
  const leastVotes: Record<string, number> = {};
  const res1 = await googleBlocks(askGoogle, q1Text);
  if (res1.ok) {
    fact(`Google [${res1.via}]: ${res1.text}`);
    const mentions = await extractAssertedMentions(res1.text, ALL, OPT, note);
    for (const { L, sentence: s } of mentions) {
      if (HIGH_WORDS.test(s) && !LOW_WORDS.test(s)) denseVotes[L] = (denseVotes[L] || 0) + 1;
      else if (LOW_WORDS.test(s) && !HIGH_WORDS.test(s)) leastVotes[L] = (leastVotes[L] || 0) + 1;
    }
    note(`   >> asserted-high votes: ${JSON.stringify(denseVotes)}   asserted-low votes: ${JSON.stringify(leastVotes)}`);
  } else {
    note(`   no answer (${res1.via})`);
  }

  step('STAGE 2  Jar Method -- remove the blocks we now KNOW are not the answer');
  const jarElim = Object.keys(denseVotes).filter((L) => pool.includes(L) && denseVotes[L] >= 1);
  if (jarElim.length) {
    const before = pool.length;
    pool = pool.filter((L) => !jarElim.includes(L));
    fact(`Jar Method removed ${jarElim.join(', ')}   pool ${before} -> ${pool.length}`);
  } else {
    note("   Jar Method removed nothing -- stage 1's high/low vocabulary (built for ranking questions) found nothing to assert here, which is an honest no-op for a definitional question, not a failure");
  }

  // ── D1: categorize by shared predicate, mechanical ──
  say('D1  CATEGORIZE OPTIONS BY SHARED PREDICATE (rule 12) -- mechanical, no model');
  const survivingOPT: Record<string, string> = {};
  for (const L of pool) survivingOPT[L] = OPT[L];
  const d1 = categorizeBySharedPredicate(survivingOPT);
  if (d1.clusters.length) {
    for (const cluster of d1.clusters) {
      note(`   cluster: ${cluster.join(', ')}   (${cluster.map((L) => `${L}: ${[...d1.wordSets[L]].join('/')}`).join('   ')})`);
    }
  } else {
    note('   no cluster reached the 2-shared-word threshold');
  }
  note(`   odd one out (${d1.oddOneOutBasis === 'isolated' ? 'shares no significant vocabulary with anything else' : 'fewest shared-vocabulary connections of the set'}): ${d1.oddOneOut.join(', ') || '(none)'}`);

  // ── D2-D4 REPLACED: SURVEY THE ASK -- enumerate denotations, do not collapse (E-SURVEY-ASK) ──
  // D-BP150-016, see this file's header for the qid 85 failure this closes. Term extraction off
  // the definitional cue phrase stays here (mechanical, code -- E-CATALYST-WORDS/D2's own job);
  // surveyAsk() takes the extracted term and does its OWN Google queries ("define <term>" and
  // "other meanings of <term>"), emitting every verified denotation to the transcript itself, on
  // its own line, sourced -- that visibility is half the deliverable, per this ticket.
  say('D2  SURVEY THE ASK -- enumerate denotations, do not collapse (E-SURVEY-ASK, wired D-BP150-016)');
  const term = extractBareTerm(input.question);
  note(`   term: "${term}"`);
  const survey = await surveyAsk(term, ctx);

  // ── D5: match on sense (E-MATCH-UP) -- DO NOT FAKE THIS. Honest abstain. ──
  say('D5  MATCH ON SENSE -- NOT IMPLEMENTED, HONEST ABSTAIN (E-MATCH-UP is UNSOLVED per canon)');
  note('   no bigram overlap, no embedding distance, no forced pick, no "here are the options, pick one"');
  note('   measured this session: a bigram scorer gave all ten of qid 46\'s options an identical 0.35; a narrow YES/NO to the local model scored 1 of 4 and flipped its own answer at temperature 0');
  note(`   surviving candidate pool: ${pool.join(', ')}`);
  if (survey.denotations.length) {
    note(`   ${survey.denotations.length} surveyed denotation(s) carried forward, UNRESOLVED -- comparing these against the options is E-MATCH-UP, not run here:`);
    survey.denotations.forEach((d, i) => {
      note(`      denotation ${i + 1} [${d.aspect.aspect}${d.register ? `, register: ${d.register}` : ', register: unstated'}]: "${d.sentence}" (${d.sourceUrl || d.sourceTitle || 'source unknown'})`);
    });
  } else {
    note('   survey found no verifiable denotation to carry forward -- an honest empty result, not a fabrication');
  }
  note('   sense-matching is not yet solved -- this is the exact case the Language Matrix / E-MATCH-UP exists to close, per the teaching');

  const elapsedS = ((Date.now() - t0) / 1000).toFixed(1);
  emit({ kind: 'result', text: `ABSTAIN (D5/E-MATCH-UP not implemented)   pool=${pool.join(',')}${KEY != null ? `  key=${KEY}` : ''}`, ts: nowIso() });
  note(`   ${elapsedS}s`);

  const denotationBasisParts = survey.denotations.map((d, i) =>
    `denotation ${i + 1} [${d.aspect.aspect}${d.register ? `, register: ${d.register}` : ', register: unstated'}]: "${d.sentence}"`,
  );
  const basisParts = [
    `D1 clustered ${Object.keys(survivingOPT).length} options (odd one out: ${d1.oddOneOut.join(', ') || 'none'})`,
    `D2 surveyed "${term}" via E-SURVEY-ASK (does not collapse): ${survey.denotations.length} denotation(s) found, ${survey.discarded.length} block(s) discarded`,
    ...denotationBasisParts,
    'D5 sense-matching (E-MATCH-UP) not implemented -- deliberate honest abstain per the BP149 teaching, HARDWIRE-22 and canon (E-MATCH-UP UNSOLVED)',
  ];
  return {
    qid: input.qid,
    question: input.question,
    verdict: null,
    correct: KEY,
    abstain: true,
    freeText: input.qid == null,
    basis: `${basisParts.join('; ')}. candidates: ${pool.join(', ')}`,
  };
}

export const definitionalCascadeMethod: LianaMethod = {
  id: 'definitional-cascade',
  name: 'The Definitional Cascade',
  // D-BP150-003: this method resolves what a term MEANS. Its answer is a meaning, so its demand
  // is DEFINE. It must not run on a question that demands anything else.
  demand: 'DEFINE',
  taughtBy: "the Founder's qid 85 walkthrough (bias), FounderCascadeWorkedByHand.txt Excerpt 7 -- D1 built BP149 (D-BP149-043); D2-D4's collapse replaced by E-SURVEY-ASK's enumeration BP150 (D-BP150-016) after qid 85's own two-fold defect; D5 (sense-matching / E-MATCH-UP) deliberately left an honest abstain, not yet solved",
  shapeDescription: 'the question turns on what a term means and the options are competing statements of that meaning',
  shapeTest,
  run,
};

registerMethod(definitionalCascadeMethod);
