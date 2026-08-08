// liana_terminal_engine.ts -- D-BP149-041/BISHOP/S41/seg-methodregistry
//
// THE LIANA CYCLE TERMINAL'S ENTRY POINT -- now a METHOD REGISTRY dispatcher, not a single
// hardcoded cascade. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/
//     canon_the_liana_cycle_is_a_method_registry_taught_by_humans_bp149.eblet.md
// Founder, BP149, verbatim: "put this engine behind the terminal, so I just type the
// question... exactly... I guide, I train, I give the Human Nuance, and you record (through
// Mnemosynec) and learn and apply... the POINT is that that won't cover EVERY question. But I
// will. And so will other human operators, which will teach the Substrate in the Cooperative."
//
// THIS FILE REPLACES the previous liana_terminal_engine.ts (D-BP149-034), which was a port of
// an OLDER, INCOMPLETE cascade (stages 0/1/2/5 only, one hardcoded elimination path applied to
// every question regardless of shape). BP149 measured that cascade against six real questions
// and found it terminates on exactly one of them (qid 98, the only one with an orderable
// property) -- the other five have no property to rank and would silently abstain or, worse,
// run the ranking machinery on a question it does not fit and produce confident nonsense. The
// fix is not a better cascade; it is knowing WHEN a cascade applies at all. See the canon above
// for the full ruling.
//
// WHAT THIS FILE DOES NOW: parses the Founder's input (a bundled qid, or free text with
// optionally embedded lettered options), asks EVERY registered method's shapeTest() whether it
// fits, and either (a) runs the one method that matches, (b) reports a known-but-unimplemented
// method matched (a stub, e.g. definitional-cascade today), or (c) says plainly that no method
// fits, lists what IS on file and why none applied, and invites the Founder to work the
// question by hand -- never runs a method whose shape test failed. See method_registry.ts for
// the registry itself and src/main/liana_cycle/methods/*.ts for the two methods this ticket
// registers.
//
// DOES NOT TOUCH src/main/plow/plow_mc_answerer.ts. Fully separate module, separate engine.
// index.ts's IPC wiring ('liana-terminal-run' handler, the heartbeat write after this resolves)
// is UNCHANGED by this ticket -- runLianaCycleQuestion's signature is byte-identical to the
// file it replaces, so nothing outside this directory needed to change.

import fs from 'node:fs';
import { join, resolve } from 'node:path';
import { app } from 'electron';
import type { LianaTerminalEvent, LianaTerminalOutcome } from '../../shared/liana_cycle/liana_terminal_types';
import { listMethods, selectMethod } from './method_registry';
import type { AskGoogleFn, EmitFn, MethodQuestionInput } from './method_registry';
// Registering a method is a side effect of importing its module (see each file's own
// `registerMethod(...)` call at the bottom). Both are imported here, and ONLY here, so the
// registry is fully populated before the first `runLianaCycleQuestion` call, regardless of
// which other file happens to import this one first.
import './methods/comparative_cascade';
import './methods/definitional_cascade';

// Re-exported so index.ts's existing closure (`(question) =>
// runBrowserAuthorityQueryFromMain({...})`) keeps type-checking against exactly the same shape
// it always has -- this ticket does not change index.ts.
export type { AskGoogleFn, EmitFn };

function nowIso(): string {
  return new Date().toISOString();
}
function say(emit: EmitFn, text: string): void {
  emit({ kind: 'header', text, ts: nowIso() });
}
function note(emit: EmitFn, text: string): void {
  emit({ kind: 'note', text, ts: nowIso() });
}

// ─────────────────────────── bundle lookup (unchanged convention) ───────────────────────────

interface BundledQuestion {
  question_id: number;
  question: string;
  options: string[];
  answer: string;
  category?: string;
}

function resolveBundledDatasetPath(): string {
  const packaged = typeof process !== 'undefined' && (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
    ? join((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath!, 'mmlu_pro_bundled', 'questions.jsonl')
    : null;
  if (app.isPackaged && packaged) return packaged;
  return resolve(app.getAppPath(), 'resources', 'mmlu_pro_bundled', 'questions.jsonl');
}

function loadQuestion(qid: number): BundledQuestion | null {
  const bundlePath = resolveBundledDatasetPath();
  if (!fs.existsSync(bundlePath)) return null;
  const rows = fs
    .readFileSync(bundlePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as BundledQuestion);
  return rows.find((r) => r.question_id === qid) ?? null;
}

const letter = (i: number) => String.fromCharCode(65 + i);

// ─────────────────────────── input parsing ───────────────────────────
// THE INPUT IS A QUESTION. The Founder types a question (or a qid); both are accepted. A qid
// loads its real options from the bundled corpus. Free text may carry its own lettered option
// list inline ("Question text? A) foo B) bar C) baz", the same shape the Founder's own
// hand-worked questions already use, e.g. qid98_his_words.mjs's `list()` helper) -- when at
// least two `L)` markers are found, everything before the first one is the question and each
// marker starts that option's text. Free text with no lettered options at all has no option
// pool for any registry method to eliminate among; it is handled honestly in the "no method
// matches" branch below, not silently answered as a bare fact lookup (that generic fallback is
// exactly what the BP149 ruling replaces -- see this file's header).

interface ParsedInput {
  qid?: number;
  question: string;
  options: Record<string, string> | null;
  correctAnswer?: string;
  qidNotFound?: boolean;
}

function parseQid(qid: number): ParsedInput {
  const q = loadQuestion(qid);
  if (!q) return { qid, question: '', options: null, qidNotFound: true };
  const opts: Record<string, string> = {};
  q.options.forEach((o, i) => { opts[letter(i)] = o; });
  return { qid, question: q.question, options: opts, correctAnswer: q.answer };
}

function parseFreeText(input: string): ParsedInput {
  const markerRe = /(?:^|\s)([A-J])\)\s*/g;
  const matches = [...input.matchAll(markerRe)];
  if (matches.length < 2) return { question: input, options: null };
  const first = matches[0];
  const question = input.slice(0, first.index).trim();
  const options: Record<string, string> = {};
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const L = m[1];
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? input.length : input.length;
    options[L] = input.slice(start, end).trim();
  }
  return { question: question || input, options };
}

// ─────────────────────────── entry point ───────────────────────────

/** Runs one question through the terminal: parse the input, ask the method registry which
 *  (if any) registered method fits its shape, and either run that method, report a
 *  known-but-unimplemented match, or say plainly that nothing fits and invite the Founder to
 *  teach the next one. Never runs a method whose shape test failed. Never throws -- an internal
 *  failure is reported as an 'error' event plus an abstained outcome, matching this estate's
 *  honest-abstain-over-fabrication rule. */
export async function runLianaCycleQuestion(input: string, askGoogle: AskGoogleFn, emit: EmitFn): Promise<LianaTerminalOutcome> {
  const trimmed = input.trim();
  try {
    let parsed: ParsedInput;
    if (/^\d+$/.test(trimmed)) {
      parsed = parseQid(Number(trimmed));
      if (parsed.qidNotFound) {
        emit({ kind: 'error', text: `qid ${parsed.qid} not found in the bundled corpus (resources/mmlu_pro_bundled/questions.jsonl)`, ts: nowIso() });
        return { qid: parsed.qid, question: '', verdict: null, abstain: true, freeText: false, error: 'qid not in bundle', options: null };
      }
    } else {
      parsed = parseFreeText(trimmed);
    }

    const methodInput: MethodQuestionInput = {
      qid: parsed.qid,
      question: parsed.question,
      options: parsed.options,
      correctAnswer: parsed.correctAnswer,
    };
    const freeText = parsed.qid == null;

    say(emit, parsed.qid != null ? `qid ${parsed.qid}` : 'free-text question');
    note(emit, `   ${parsed.question}`);
    if (parsed.options) {
      note(emit, `   ${Object.entries(parsed.options).map(([k, v]) => `${k}) ${v}`).join('  ')}`);
    } else {
      note(emit, '   (no lettered option list -- typed as a bare question)');
    }

    emit({ kind: 'stage', text: '-> METHOD SELECTION -- checking every method on file', ts: nowIso() });
    const methods = listMethods();
    for (const m of methods) {
      const shape = m.shapeTest(methodInput);
      note(emit, `   ${m.id} (${m.name}): ${shape.matches ? 'MATCHES' : 'no match'} -- ${shape.reason}`);
    }

    const selection = selectMethod(methodInput);
    if (!selection) {
      const roster = methods.map((m) => `${m.id} [taught by: ${m.taughtBy}]`).join('\n     ');
      emit({ kind: 'result', text: 'NO METHOD MATCHES -- this question does not fit any recorded method.', ts: nowIso() });
      note(emit, `   Methods on file:\n     ${roster}`);
      note(emit, '   This is not a failure -- it is the next teaching opportunity. Work this one by hand; the Liana Cycle records what you did and it becomes the next method.');
      return { qid: parsed.qid, question: parsed.question, verdict: null, correct: parsed.correctAnswer, abstain: true, freeText, error: 'no_method_matched', options: parsed.options };
    }

    const { method, shape } = selection;
    say(emit, `METHOD SELECTED: ${method.name} (${method.id})`);
    note(emit, `   why: ${shape.reason}`);
    note(emit, `   taught by: ${method.taughtBy}`);

    if (!method.run) {
      emit({ kind: 'result', text: `NOT YET TAUGHT -- ${method.name} is a registered method whose shape matched, but it has no runner yet.`, ts: nowIso() });
      note(emit, '   This is a known shape, not an unknown one -- the Founder has not walked a case for it yet. That is the next teaching session.');
      return { qid: parsed.qid, question: parsed.question, verdict: null, correct: parsed.correctAnswer, abstain: true, freeText, error: 'method_not_yet_taught', method: method.id, options: parsed.options };
    }

    const outcome = await method.run(methodInput, { askGoogle, emit });
    return { ...outcome, method: method.id, options: parsed.options };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    emit({ kind: 'error', text: `terminal threw: ${msg}`, ts: nowIso() });
    return { question: trimmed, verdict: null, abstain: true, freeText: !/^\d+$/.test(trimmed), error: msg, options: null };
  }
}
