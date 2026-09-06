#!/usr/bin/env node
// scripts/didasko_method_scaffold.mjs -- D-BP214-XO1947-022/BISHOP-XO/seg-method-scaffold
//
// WHAT THIS IS. The Didasko method-authoring bottleneck, per D-BP214-XO1947-020_THE_DIDASKO_MAP.md
// Part Three/Six: every one of the four newest liana_cycle methods (withheld_curve_shift_guard.ts,
// set_equivalence_match.ts, umbrella_or_school_check.ts, convention_locked_recompute.ts) reimplements
// the SAME skeleton by hand -- withhold options and correctAnswer from the model, abstain honestly
// when a fact was never taught, register itself with the engine -- and only the actual DOMAIN RULE
// differs between them. This script is the "supply the domain rule" half of that split: it emits a
// new method file with the skeleton already correct and one clearly marked place to fill in.
//
// THIS IS A TEXT TEMPLATE, NOT A MODEL, NOT A JUDGMENT-MAKER. It writes TypeScript source from a
// fixed string template with the caller's id/demand/description substituted in. It never calls an
// LLM, never inspects a question, never decides anything about the method's actual logic.
//
// THE THREE LAWS THIS TEMPLATE BAKES IN, so a method built from it cannot violate them by omission
// (per this dispatch's brief, quoting the Founder's Answer Quarantine Policy, 18:27:26Z, and
// HARDWIRE-22):
//   1. ANSWER QUARANTINE, BOTH HALVES. The generated shapeTest() reads input.options only for its
//      COUNT/shape (never its text content, never to decide anything), and NEVER reads
//      input.correctAnswer. The generated run() never places input.options or input.correctAnswer
//      into a prompt string -- there IS no prompt-building code in the stub at all until the human
//      adds an extraction site, and the one marked DOMAIN RULE block sits strictly AFTER the point
//      where options could ever be revealed.
//   2. THE CODE DECIDES, ALWAYS. The generated run() defaults to an honest ABSTAIN citing the
//      missing domain rule BY NAME -- "PLATYPUS: no domain rule authored yet for method '<id>'" --
//      until the human replaces that block. An abstention with a named gap is scored as ABSTAIN by
//      the fixture harness (fixture_harness.test.ts), never as FAIL.
//   3. LITERAL-QUOTE VERIFICATION. A ready-made isLiteralQuoteOf() helper is included, matching the
//      normalization convention already used by withheld_curve_shift_guard.ts and
//      convention_locked_recompute.ts, so the first model-extraction site a method author adds has
//      the verification helper sitting right there rather than reinvented per file.
//
// USAGE:
//   node scripts/didasko_method_scaffold.mjs --id <kebab-case-id> --demand <LianaDemand> \
//     --description "<one-line description>" [--taught "<citation>"] [--file <basename-no-ext>]
//
// REFUSES TO OVERWRITE. If the target file already exists, this script exits 1 and writes nothing.
//
// WHAT THIS DOES NOT DO, STATED PLAINLY (HARDWIRE-23, the Tare Rule): it does not add the
// `import './methods/<file>';` line to liana_terminal_engine.ts (that is a one-line, deliberate,
// Founder/dispatch-reviewed act of making a method LIVE in the production engine -- not something a
// generator should do silently), and it does not write a fixture file (fixture authoring requires a
// real worked example, which is domain knowledge the generator does not have). Both are named in the
// generated file's own header as the two remaining manual steps.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const METHODS_DIR = join(__dirname, '..', 'src', 'main', 'liana_cycle', 'methods');

const KNOWN_DEMANDS = ['RANK', 'DEFINE', 'IDENTIFY', 'CLASSIFY', 'INFER', 'LOCATE-IN-FRAMEWORK', 'COMPUTE'];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      out[key] = val;
      i++;
    }
  }
  return out;
}

function toPascalCase(kebab) {
  return kebab
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function toSnakeCase(kebab) {
  return kebab.replace(/-/g, '_');
}

function fail(msg) {
  console.error(`didasko_method_scaffold: ${msg}`);
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const id = args.id;
  const demand = args.demand;
  const description = args.description;
  const taught = args.taught || '(fill in: the dispatch/spec that taught this method, and its founding worked example)';
  const fileBase = args.file || toSnakeCase(id);

  if (!id || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id)) {
    fail('--id is required and must be kebab-case, e.g. --id my-new-method (got: ' + JSON.stringify(id) + ')');
  }
  if (!demand || !KNOWN_DEMANDS.includes(demand)) {
    fail(`--demand is required and must be one of: ${KNOWN_DEMANDS.join(', ')} (got: ${JSON.stringify(demand)})`);
  }
  if (!description || description.trim().length === 0) {
    fail('--description is required, a one-line description of the shape this method answers');
  }

  const outPath = join(METHODS_DIR, `${fileBase}.ts`);
  if (existsSync(outPath)) {
    fail(`REFUSING TO OVERWRITE existing file: ${outPath}\n` +
      `If this method already exists, edit it directly. If you meant a different method, pass ` +
      `--file <different-basename>.`);
  }
  if (!existsSync(METHODS_DIR)) {
    fail(`methods directory not found at ${METHODS_DIR} -- is this script running from the mnemosyne repo?`);
  }

  const constName = toPascalCase(id).replace(/^./, (c) => c.toLowerCase()) + 'Method';
  const now = new Date().toISOString();

  const template = `// methods/${fileBase}.ts -- GENERATED by scripts/didasko_method_scaffold.mjs on ${now}
//
// id: ${id}
// demand: ${demand}
// ${description}
//
// TAUGHT BY: ${taught}
//
// THIS FILE WAS SCAFFOLDED, NOT HAND-BUILT FROM SCRATCH. The skeleton below (withhold options and
// correctAnswer from every model-facing prompt, abstain honestly on any untaught gap, verify every
// extracted quote as a literal substring before trusting it) is the pattern already common to
// withheld_curve_shift_guard.ts, set_equivalence_match.ts, umbrella_or_school_check.ts, and
// convention_locked_recompute.ts (see D-BP214-XO1947-020_THE_DIDASKO_MAP.md Part Three/Six and
// D-BP214-XO1947-022_THE_METHOD_SCAFFOLD.md for the full account). The ONLY thing this generator
// could not supply is the actual domain rule -- see the "DOMAIN RULE GOES HERE" block in run(),
// below. That is BY NATURE human/Bishop authorship (Part Three of the map above), not plumbing.
//
// TWO STEPS ARE STILL MANUAL, DELIBERATELY, PER HARDWIRE-23 (the Tare Rule -- a generator that also
// silently wires a method live would be doing more than it was asked, and both are real decisions:
//   1. Wire it live: add \`import './methods/${fileBase}';\` to liana_terminal_engine.ts's own
//      side-effect import block, next to the other method imports.
//   2. Author a fixture: add src/main/liana_cycle/methods/fixtures/${id}.fixtures.json (see any
//      existing fixture file for the schema, or fixture_harness.test.ts's own header) once you have
//      a real worked example to regression-test against.
//
// Rule 66: new file, no supersede needed. No em-dashes -- "--" used throughout. American spelling.

import { registerMethod } from '../method_registry';
import type { LianaMethod, MethodQuestionInput, MethodRunContext, ShapeTestResult } from '../method_registry';
import type { LianaTerminalOutcome } from '../../../shared/liana_cycle/liana_terminal_types';

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// LITERAL-QUOTE VERIFICATION -- ready to use the moment you add a model extraction site. Matches
// the normalization convention already used by withheld_curve_shift_guard.ts /
// convention_locked_recompute.ts: whitespace-collapsed, case-preserved substring containment.
// Anything a model returns that is NOT a literal substring of the text it was shown is a
// confabulation, never a paraphrase to trust -- treat a false return here as grounds to abstain,
// exactly like a transport failure, never grounds to guess what the model "probably meant."
// ─────────────────────────────────────────────────────────────────────────────────────────────

function normalizeForQuoteCheck(s: string): string {
  return s.replace(/\\s+/g, ' ').trim();
}

export function isLiteralQuoteOf(candidate: string, source: string): boolean {
  if (!candidate || !source) return false;
  return normalizeForQuoteCheck(source).includes(normalizeForQuoteCheck(candidate));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// shapeTest -- THE TRIGGER. Pure, no I/O, never reads input.correctAnswer. This stub checks ONLY
// the structural shape of the option list (its COUNT), never its text content -- that is the
// Answer Quarantine Policy's "no option list may be present while the question is being solved"
// applied to shapeTest() itself: looking at how MANY options exist is a structural fact, not a
// content decision. Replace the cue-detection TODO below with this method's real, disclosed,
// code-only shape test (a regex over the question stem, an option-arity check, etc.) -- it must
// stay pure (no I/O, no model calls) and must still never read input.correctAnswer.
// ─────────────────────────────────────────────────────────────────────────────────────────────

function shapeTest(input: MethodQuestionInput): ShapeTestResult {
  if (!input.options || Object.keys(input.options).length < 2) {
    return {
      matches: false,
      reason: 'no lettered option list with >=2 rows -- generated default refusal, narrow this ' +
        'further with a real cue-detection rule before this method is taught anything.',
    };
  }
  const question = input.question || '';
  if (question.trim().length === 0) {
    return { matches: false, reason: 'empty question text.' };
  }

  // TODO -- CUE-DETECTION RULE GOES HERE. Pure, no I/O, code-only. This stub matches every
  // question with >=2 options and non-empty text, which is deliberately too wide to ship --
  // narrow it to the real shape this method targets before wiring it into liana_terminal_engine.ts.
  return {
    matches: false,
    reason: 'GENERATED STUB: no cue-detection rule authored yet for method "${id}" -- shapeTest() ' +
      'always refuses until this TODO is replaced with a real, disclosed shape test.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// run -- never reads input.correctAnswer. Never places input.options into a model prompt (there is
// no prompt-building code in this stub at all -- add one only inside the DOMAIN RULE block below,
// and only ever send it literal spans of the QUESTION TEXT, never the option list or the answer).
// The option list is read ONLY at the very end, for the final letter lookup, after the verdict is
// already fully decided by code -- exactly the LEG1-4 convention (see this file's header).
// ─────────────────────────────────────────────────────────────────────────────────────────────

async function run(input: MethodQuestionInput, ctx: MethodRunContext): Promise<LianaTerminalOutcome> {
  const base = {
    qid: input.qid,
    question: input.question,
    freeText: input.qid === undefined,
    options: input.options ?? null,
  };

  // ===================== DOMAIN RULE GOES HERE =====================
  // Replace this whole block with the taught, disclosed, code-only rule for this method's shape.
  // Until it is replaced, this method ABSTAINS on every question it matches, citing the missing
  // rule BY NAME -- this is a correct, honest outcome (a declared platypus), not a failure, and the
  // fixture harness reports it as its own ABSTAIN category, never folded into FAIL.
  ctx.emit({
    kind: 'log',
    text: '${id}: no domain rule authored yet -- abstaining rather than guessing.',
    at: nowIso(),
  } as any);
  return {
    ...base,
    verdict: null,
    abstain: true,
    basis: 'PLATYPUS: no domain rule authored yet for method "${id}" -- this is the generated ' +
      'scaffold stub; replace the DOMAIN RULE block in run() with the taught, code-only rule for ' +
      'this shape before this method can produce a verdict.',
  };
  // ===================== END DOMAIN RULE BLOCK =====================
}

export const ${constName}: LianaMethod = {
  id: '${id}',
  demand: '${demand}',
  name: '${description}',
  taughtBy: '${taught}',
  shapeDescription: '${description} -- GENERATED STUB, shapeTest() always refuses until its ' +
    'cue-detection TODO is replaced with a real, disclosed shape test.',
  shapeTest,
  run,
};

// Registers at import time, same convention as every other method module. The registerMethod()
// call alone is NOT sufficient to make this method reachable -- liana_terminal_engine.ts's own
// side-effect import block must ALSO import this file (a deliberate manual step, see this file's
// header -- the scaffold generator does not wire a method live on its own).
registerMethod(${constName});
`;

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, template, 'utf-8');
  console.log(`didasko_method_scaffold: wrote ${outPath}`);
  console.log('Two manual steps remain (by design, see the file header):');
  console.log(`  1. Replace the shapeTest() cue-detection TODO and the DOMAIN RULE block in run().`);
  console.log(`  2. Add a fixture at src/main/liana_cycle/methods/fixtures/${id}.fixtures.json.`);
  console.log(`  3. When ready to go live: add \`import './methods/${fileBase}';\` to liana_terminal_engine.ts.`);
}

main();
