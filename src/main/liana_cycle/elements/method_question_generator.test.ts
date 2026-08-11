// elements/method_question_generator.test.ts -- D-BP152-032/BISHOP/seg-auto-method-and-key-exclusion
//
// Manual assert() + console output + process.exit(1) on failure, no test-framework dependency --
// same prior-art convention as survey_stage.test.ts / comparative_cascade.test.ts, copied
// verbatim: requires the COMPILED dist/main/liana_cycle/elements/method_question_generator.js.
//
// Run (after `npm run build:main`):
//   node src\main\liana_cycle\elements\method_question_generator.test.ts
//
// WHAT THIS TESTS, per D-BP152-032's own VERIFY section:
//   (a) for qid 98's real text plus plausible Part 1/2 answers, the generated questions
//       instantiate the Founder's two shapes (FD-BP152-03) with subjects that are literal spans
//       of the question.
//   (b) unusable inputs (no terms, no question text, a term that is not a literal span) generate
//       none and say so -- never a silent empty result.
//   (c) every generated question is tagged 'machine-generated' -- distinguishable in a transcript
//       from an operator-typed one.
// Also covers: Q1 reuses the EXACT existing 'survey.constraint.definitionScale' template (no
// second wording invented for the shape askConstraint() already asks live); the unit-adjacency
// rule is positional only (a parenthetical elsewhere in the text, not adjacent to the subject,
// must NOT be picked up).

(function main(): void {

const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label}${detail ? ` -- ${detail}` : ''}`);
    failed++;
  }
}

const distPath = path.join(__dirname, '..', '..', '..', '..', 'dist', 'main', 'liana_cycle', 'elements', 'method_question_generator.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require(distPath) as typeof import('./method_question_generator');
const {
  generateMethodQuestions,
  generateScaleDefinitionQuestion,
  generateThresholdQuestion,
  literalSubjectSpan,
  detectAdjacentUnit,
} = mod;

console.log('method_question_generator.test.ts -- D-BP152-032 STAGE 1\n');

const QID98 = "Which of the following world regions is NOT considered one of the world's most densely populated regions?";

// ── (a) qid 98, real text, plausible Part 1/2 answers -> both shapes, literal-span subjects ────
{
  const terms = [{ term: 'densely populated' }, { term: 'NOT' }];
  const gen = generateMethodQuestions(terms, QID98, 'classified');
  assert(gen.refusals.length === 0, '(a) qid98: no refusals for terms that are literal spans', JSON.stringify(gen.refusals));
  assert(gen.questions.length === 4, '(a) qid98: both shapes generated for both named terms (2 terms x 2 shapes)', String(gen.questions.length));
  const scaleQ = gen.questions.find((q) => q.shape === 'SCALE_DEFINITION' && q.term === 'densely populated');
  const threshQ = gen.questions.find((q) => q.shape === 'THRESHOLD' && q.term === 'densely populated');
  assert(!!scaleQ && QID98.toLowerCase().includes(scaleQ.subject.toLowerCase()), '(a) SCALE subject is a literal span of qid98', scaleQ && scaleQ.subject);
  assert(!!threshQ && QID98.toLowerCase().includes(threshQ.subject.toLowerCase()), '(a) THRESHOLD subject is a literal span of qid98', threshQ && threshQ.subject);
  assert(!!scaleQ && scaleQ.questionText === "What specific definition and scale of 'densely populated' is this question using?", '(a) SCALE question text is the EXACT existing survey.constraint.definitionScale template', scaleQ && scaleQ.questionText);
  assert(!!threshQ && threshQ.questionText === "What is the specific threshold used to qualify as 'densely populated'?", '(a) THRESHOLD question text is the reduced FD-BP152-03 template with no unit (none adjacent in qid98)', threshQ && threshQ.questionText);
  assert(!!scaleQ && scaleQ.queryId === 'survey.constraint.definitionScale', '(a) SCALE queryId points at the same template id askConstraint() uses');
  assert(!!threshQ && threshQ.queryId === 'survey.constraint.threshold', '(a) THRESHOLD queryId points at the no-unit template');
}

// ── (c) every generated question is tagged machine-generated ───────────────────────────────────
{
  const gen = generateMethodQuestions([{ term: 'densely populated' }], QID98, null);
  assert(gen.questions.length === 2, '(c) setup: two questions generated');
  assert(gen.questions.every((q) => q.source === 'machine-generated'), '(c) every generated question is tagged source: "machine-generated"');
}

// ── (b) unusable inputs generate none and say so ────────────────────────────────────────────────
{
  const noTerms = generateMethodQuestions([], QID98, null);
  assert(noTerms.questions.length === 0, '(b) no Part 1 terms: zero questions generated');
  assert(noTerms.refusals.length === 1, '(b) no Part 1 terms: exactly one explicit refusal', JSON.stringify(noTerms.refusals));
  assert(/no Part 1 term/.test(noTerms.refusals[0].why), '(b) refusal names the missing input', noTerms.refusals[0].why);

  const noQuestionText = generateMethodQuestions([{ term: 'densely populated' }], '', null);
  assert(noQuestionText.questions.length === 0, '(b) no question text: zero questions generated');
  assert(noQuestionText.refusals.length === 1, '(b) no question text: exactly one explicit refusal', JSON.stringify(noQuestionText.refusals));

  const notLiteral = generateMethodQuestions([{ term: 'a phrase not present in the question at all' }], QID98, null);
  assert(notLiteral.questions.length === 0, '(b) non-literal-span term: zero questions generated');
  assert(notLiteral.refusals.length === 2, '(b) non-literal-span term: BOTH shapes refused explicitly, never silently dropped', JSON.stringify(notLiteral.refusals));
  assert(notLiteral.refusals.every((r) => /not a literal span/.test(r.why)), '(b) both refusals name the literal-span requirement');
}

// ── literalSubjectSpan() -- case-insensitive match, original casing preserved ──────────────────
{
  const span = literalSubjectSpan('DENSELY POPULATED', QID98);
  assert(span === 'densely populated', 'literalSubjectSpan: case-insensitive match, returns the QUESTION\'s own casing, not the term\'s', String(span));
  assert(literalSubjectSpan('not present anywhere', QID98) === null, 'literalSubjectSpan: returns null for a non-match, never a guess');
}

// ── detectAdjacentUnit() -- positional only, never picks up a non-adjacent parenthetical ───────
{
  const withAdjacentUnit = "What is the specific population density threshold (people per square kilometer) used to qualify as densely populated?";
  assert(detectAdjacentUnit('threshold', withAdjacentUnit) === '(people per square kilometer)', 'detectAdjacentUnit: finds a parenthetical immediately after the subject');
  assert(detectAdjacentUnit('densely populated', QID98) === null, 'detectAdjacentUnit: null when no unit is adjacent to the subject in qid98');
  const nonAdjacent = 'What is the threshold used to qualify as densely populated (a term defined elsewhere)?';
  assert(detectAdjacentUnit('threshold', nonAdjacent) === null, 'detectAdjacentUnit: a parenthetical elsewhere in the text (not adjacent to THIS subject) is not picked up', String(detectAdjacentUnit('threshold', nonAdjacent)));
}

// ── generateScaleDefinitionQuestion()/generateThresholdQuestion() refuse individually ───────────
{
  const badTerm = 'nowhere in the text';
  const q1 = generateScaleDefinitionQuestion(badTerm, QID98);
  const q2 = generateThresholdQuestion(badTerm, QID98);
  assert(!('questionText' in q1), 'generateScaleDefinitionQuestion refuses (no questionText) for a non-literal-span term');
  assert(!('questionText' in q2), 'generateThresholdQuestion refuses (no questionText) for a non-literal-span term');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

})();
