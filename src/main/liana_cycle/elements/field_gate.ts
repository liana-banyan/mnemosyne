// elements/field_gate.ts -- E-FIELD-GATE -- D-BP150-017/BISHOP/S17/seg-fieldgate
//
// THE FOUNDER'S RULING, verbatim, BP150, in his own proof of qid 85: "You need to apply what I
// said in my proof of 85. Where did we ask Google, in survey, what field this was in? And then
// when it came back with 4 fields, it would eliminate the other 3 from the remainder of the
// survey questions. And that means it tells us, by elimination, what it HAS to be. So build that
// in and lets try it again."
//
// WHAT WAS MISSING, verified before this file existed: survey_ask.ts's surveyAsk() sends exactly
// two queries -- "define <term>" and "other meanings of <term>" -- and extracts a REGISTER per
// denotation from whatever prose came back. It never asks Google what FIELD the term belongs to
// as its own question, and it never eliminates a field. This file is that missing step, built as
// its own element (per canon_liana_methods_are_compositions_of_named_elements_bp150) rather than
// folded into survey_ask.ts, so it can be called, read and audited on its own -- exactly the
// relationship comparative_cascade.ts's runStage0RegisterGate() (register gate at the OPTION
// level) already has with the rest of Method 1. THIS file is that gate's sibling at the FIELD
// level. comparative_cascade.ts is not modified by this ticket; its pattern is read, not touched.
//
// THE PROCEDURE, exactly the Founder's two moves, nothing added:
//   STEP 1 -- ASK. Query Google directly for the field(s) the term belongs to, in plain words
//     ("what field is X in"). Extract the field/subject NAMES with gemmaExtract, extraction only
//     (HARDWIRE-22): "copy the field or subject names this passage lists for <term>" -- never
//     "which field is correct". Every extracted name must appear verbatim in the passage it came
//     from (appearsIn, reused from comparative_cascade.ts) or it is discarded.
//   STEP 2 -- ELIMINATE. A field is eliminated when the ASK and the OPTIONS contain no vocabulary
//     belonging to it. Survivors are what the question HAS to be about. THE MECHANICAL RULE (no
//     hand-tuning, no domain word list authored here): for each candidate field, its OWN
//     vocabulary is gathered from the SAME sourced passage(s) that named it -- the words that
//     co-occur with the field name in the retrieved text, never a list this file's author wrote.
//     A field survives if ANY of its vocabulary appears in the ASK or the options; zero support
//     eliminates it. This is the same shape as D1's categorizeBySharedPredicate() in
//     definitional_cascade.ts (mechanical vocabulary overlap, no model call) applied one level
//     up, at the field rather than the option.
//   STEP 3 -- CONSTRAIN. When elimination leaves exactly one surviving field, subsequent
//     denotation queries can be scoped to it ("<term> in <field>") and any already-surveyed
//     denotation whose source-stated register names an ELIMINATED field is dropped
//     (dropDenotationsByEliminatedFields, below). When zero or more than one field survives,
//     nothing is scoped -- narrowing only happens when it is unambiguous.
//   STEP 4 -- REPORT, NEVER PICK. Exactly one survivor is a legitimate elimination result and is
//     reported as such. MORE THAN ONE SURVIVOR is reported in full, with no attempt to choose
//     among them -- forcing a single winner here is E-MATCH-UP wearing this file's clothes, and
//     canon marks E-MATCH-UP UNSOLVED. ZERO survivors falls back to the unconstrained survey,
//     reported honestly, rather than eliminating everything.
//
// THE FOLD-LEVEL APPLICATION, same rule, one level down: once a field survives, the SAME
// elimination-by-co-occurring-vocabulary rule is applied again, this time to the candidate
// denotations survey_ask.ts already enumerated (its `SurveyDenotation[]`) -- each surveyed
// denotation IS a candidate "fold" (a distinct verified sense inside the surviving field), and
// its own sourced sentence supplies its own vocabulary, mechanically, the same way a field's
// passage supplies the field's vocabulary. foldGate() below is a second call to the SAME
// eliminateByVocabulary() core, not a second algorithm.
//
// WHAT THIS FILE DOES NOT DO, AND MUST NEVER DO (the hard guard this ticket was given):
//   - It never chooses a single survivor when more than one remains, at either the field or the
//     fold level. Doing so would be E-MATCH-UP (D5, matching a surveyed sense to one OPTION
//     letter) smuggled in under a different name. D5 stays exactly what definitional_cascade.ts
//     already declares it: NOT IMPLEMENTED, an honest abstain. Narrowing candidate FIELDS/FOLDS
//     is not the same operation as picking an OPTION, and this file only ever does the former.
//   - It authors no domain vocabulary. Every word compared here was pulled mechanically out of a
//     sourced Google passage or the question/options text itself -- never typed into this file by
//     a person guessing what "statistics" or "sewing" words look like. That contamination (a
//     hand-authored cue table carrying "organs" and "drains" from a single benchmark question) is
//     exactly what the governing ticket named as the failure mode this file must not repeat.
//   - It does not special-case qid 85 or any other bundled qid. FIELD_GATE_STOPWORDS below is
//     generic English function-word grammar, the same non-domain discipline nest.ts's
//     FUNCTION_ONLY set and definitional_cascade.ts's D1_STOPWORDS already keep.

import { appearsIn, gemmaExtract, googleBlocks, norm } from '../methods/comparative_cascade';
import type { MethodRunContext } from '../method_registry';
import type { SurveyDenotation } from './survey_ask';
// D-BP150-018 -- THE FIELD GATE'S OWN QUESTION WAS UNSCOPED. Measured on qid 85 (this ticket's
// governing evidence): "what field is bias in" and "what subject or field does bias belong to"
// are BOTH bare-term queries against a common English word, so Google returned pages about the
// EVERYDAY sense (types of bias -- "Name bias", "Study Bias", "confirmation bias") and the word
// "statistics" never entered any candidate set. findCatalystWords() (elements/catalyst_words.ts,
// D-BP150-004) already computes the register signal the Founder pointed at directly -- the
// question's OWN answer set states it ("sample / population / representative / randomization /
// estimates" for qid 85). Reused here, not reimplemented -- see deriveOptionVocabWords() below.
import { findCatalystWords } from './catalyst_words';

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────── mechanical vocabulary, no model, no domain list ───────────────────────────

/** Generic English function words only -- grammar, not content. The same non-domain discipline
 *  as nest.ts's FUNCTION_ONLY and definitional_cascade.ts's D1_STOPWORDS. Nothing here names a
 *  field, a subject, or any word specific to any one question -- that is the whole point: this
 *  set can never be the reason one field beats another. */
const FIELD_GATE_STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'it', 'its', 'this', 'that', 'these', 'those', 'which', 'who', 'whom', 'whose',
  'what', 'where', 'when', 'how', 'why', 'as', 'at', 'by', 'with', 'from', 'into', 'onto', 'than',
  'then', 'so', 'not', 'no', 'nor', 'if', 'but', 'do', 'does', 'did', 'has', 'have', 'had', 'can',
  'could', 'will', 'would', 'should', 'shall', 'may', 'might', 'must', 'there', 'their', 'they',
  'them', 'he', 'she', 'his', 'her', 'we', 'our', 'you', 'your', 'youre', 'i', 'my', 'me', 'one',
  'some', 'any', 'all', 'each', 'every', 'other', 'more', 'most', 'such', 'only', 'own', 'same',
  'also', 'about', 'above', 'after', 'again', 'against', 'because', 'before', 'between', 'both',
  'during', 'further', 'here', 'off', 'once', 'out', 'over', 'under', 'up', 'down', 'while',
]);

/** Mechanical significant-word extraction -- lowercase, strip punctuation, drop short/stop words.
 *  No model call, no judgment: the same shape as definitional_cascade.ts's own significantWords()
 *  (D1, rule 12), reproduced here (not imported) because that function is not exported and this
 *  file must not create an import cycle with definitional_cascade.ts, which imports THIS file. */
function significantWords(text: string): Set<string> {
  return new Set(
    String(text ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !FIELD_GATE_STOPWORDS.has(w)),
  );
}

/** A candidate's OWN vocabulary: every significant word across every passage that named it, minus
 *  the tokens of `excludeTerms` (the searched term itself, and the candidate's own name) -- so a
 *  candidate never "survives" merely because the term being surveyed, or its own name, happens to
 *  appear in the ASK. That would make every candidate survive trivially and the gate would
 *  eliminate nothing; excluding those tokens is what makes the remaining overlap a genuine finding
 *  about co-occurring vocabulary rather than a tautology. */
function vocabularyOf(passages: string[], excludeTerms: string[]): string[] {
  const words = new Set<string>();
  for (const p of passages) {
    for (const w of significantWords(p)) words.add(w);
  }
  for (const t of excludeTerms) {
    for (const w of significantWords(t)) words.delete(w);
  }
  return [...words].sort();
}

function textVocabulary(texts: string[], excludeTerm: string): Set<string> {
  const words = new Set<string>();
  for (const t of texts) {
    for (const w of significantWords(t)) words.add(w);
  }
  for (const w of significantWords(excludeTerm)) words.delete(w);
  return words;
}

// ─────────────────────────── the generic elimination core, shared by field and fold level ───────────────────────────

export interface EliminationOutcome<T> {
  name: string;
  candidate: T;
  /** The candidate's own sourced vocabulary -- always present, even (especially) when it
   *  eliminated the candidate, so the transcript shows what was checked, not just the verdict. */
  vocabulary: string[];
  /** The subset of `vocabulary` that was actually found in the ASK/options -- empty when
   *  eliminated. */
  supportingWords: string[];
  survives: boolean;
  why: string;
}

/** STEP 2's mechanical rule, generic over what is being eliminated (a field or a fold): a
 *  candidate survives iff at least one of its own sourced vocabulary words appears in the
 *  ASK/options vocabulary. No scoring, no ranking among survivors -- this function only ever
 *  partitions into survives/eliminated, and callers (this file's own fieldGate/foldGate) must
 *  never further rank or pick from the survivors. */
function eliminateByVocabulary<T extends { name: string }>(
  items: Array<{ item: T; vocabulary: string[] }>,
  askOptionsVocab: Set<string>,
): { outcomes: EliminationOutcome<T>[]; survivors: T[]; eliminated: EliminationOutcome<T>[] } {
  const outcomes: EliminationOutcome<T>[] = items.map(({ item, vocabulary }) => {
    const supportingWords = vocabulary.filter((w) => askOptionsVocab.has(w));
    const survives = supportingWords.length > 0;
    return {
      name: item.name,
      candidate: item,
      vocabulary,
      supportingWords,
      survives,
      why: survives
        ? `survives -- vocabulary word(s) [${supportingWords.join(', ')}] appear in the ASK/options`
        : `eliminated -- none of its ${vocabulary.length} sourced vocabulary word(s) appear anywhere in the ASK or the options`,
    };
  });
  return {
    outcomes,
    survivors: outcomes.filter((o) => o.survives).map((o) => o.candidate),
    eliminated: outcomes.filter((o) => !o.survives),
  };
}

export type GateDecision = 'ONE_SURVIVOR' | 'MULTIPLE_SURVIVORS' | 'ZERO_SURVIVORS' | 'NO_CANDIDATES';

function decide(survivorCount: number, candidateCount: number): GateDecision {
  if (candidateCount === 0) return 'NO_CANDIDATES';
  if (survivorCount === 0) return 'ZERO_SURVIVORS';
  if (survivorCount === 1) return 'ONE_SURVIVOR';
  return 'MULTIPLE_SURVIVORS';
}

// ─────────────────────────── STEP 1 -- ASK the field, Google, plain words ───────────────────────────

/** D-BP150-018 FIX (A). The option set's OWN discriminating vocabulary, via findCatalystWords()
 *  (elements/catalyst_words.ts) -- mechanical, no domain word list authored here, exactly the
 *  discipline this file's own header already requires ("no hand-tuning, no domain word list
 *  authored here"). This is the register signal the Founder pointed at in his own qid 85 proof:
 *  the question's ANSWER SET states the register, so asking Google what field uses THAT
 *  vocabulary returns pages about the technical register instead of the bare word's everyday
 *  sense. `universal` words (shared by every option) lead, because a word every option shares is
 *  the strongest single signal of the set's shared subject; the remaining catalyst words are
 *  ordered MOST-SHARED-FIRST (not most-discriminating-first) -- a word one option alone uses
 *  (e.g. "beliefs") describes that one option, not the field the whole set sits in. Bounded to
 *  FIELD_VOCAB_QUERY_MAX_WORDS so the query stays a plausible Google search string, not a word
 *  dump; the bound does not change WHICH words are chosen, only how many of the already-ordered
 *  list are sent, same discipline survey_answers.ts's own maxCatalystWordsPerOption documents. */
const FIELD_VOCAB_QUERY_MAX_WORDS = 8;

function deriveOptionVocabWords(options: Record<string, string> | null, term: string): string[] {
  if (!options || Object.keys(options).length < 2) return [];
  const { catalysts, universal } = findCatalystWords(options);
  const termWords = significantWords(term);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const w of universal) {
    if (termWords.has(w) || seen.has(w)) continue;
    seen.add(w);
    ordered.push(w);
  }
  const byShareDesc = [...catalysts].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  for (const c of byShareDesc) {
    if (termWords.has(c.word) || seen.has(c.word)) continue;
    seen.add(c.word);
    ordered.push(c.word);
  }
  return ordered.slice(0, FIELD_VOCAB_QUERY_MAX_WORDS);
}

/** STEP 1's queries. The original two plain-words phrasings of the Founder's own question ("what
 *  field is it in?") are KEPT -- they still run and still contribute candidates, `askFields()`
 *  unions everything every query finds. D-BP150-018 ADDS a third: when the option set supplies
 *  discriminating vocabulary (`vocabWords`), a query built from THAT vocabulary rather than the
 *  bare term -- "what field or subject studies <vocab words>" -- because the bare-term queries
 *  measured on qid 85 both returned pages about the everyday sense of a common English word
 *  ("bias" the personal-prejudice sense) and never surfaced the technical register at all. Adding
 *  a query only ever grows the candidate set that STEP 2's elimination then filters; it cannot
 *  remove anything a caller previously found. */
function fieldQueries(term: string, vocabWords: string[]): string[] {
  const queries = [
    `what field is "${term}" in`,
    `what subject or field does "${term}" belong to`,
  ];
  if (vocabWords.length) {
    queries.push(`what field or subject studies ${vocabWords.join(' ')}`);
  }
  return queries;
}

export interface FieldCandidate {
  /** Verbatim field/subject name, extracted then verified against its own source passage. */
  name: string;
  /** Every distinct passage that named this field (title -- body), for vocabulary derivation --
   *  a field named by more than one source block carries all of them, never just the first. */
  passages: string[];
  /** First source this candidate was found in, for the transcript/audit trail. */
  sourceUrl: string;
  sourceTitle: string;
  why: string;
}

export interface FieldDiscardedBlock {
  query: string;
  sourceUrl: string;
  sourceTitle: string;
  why: string;
}

/** STEP 1. Asks Google directly what field(s) `term` belongs to and extracts every verified field
 *  name. Never picks one -- returns everything found, verified, unranked, exactly survey_ask.ts's
 *  own discipline for denotations. `options`, when supplied, is used ONLY to derive the extra
 *  vocabulary-scoped query (D-BP150-018 FIX A, `deriveOptionVocabWords()` above) -- the
 *  elimination arithmetic below this function is unchanged. */
export async function askFields(
  term: string,
  ctx: MethodRunContext,
  options: Record<string, string> | null = null,
): Promise<{ queries: string[]; candidates: FieldCandidate[]; discarded: FieldDiscardedBlock[] }> {
  const { askGoogle, emit } = ctx;
  const step = (text: string) => emit({ kind: 'stage', text: `-> ${text}`, ts: nowIso() });
  const fact = (text: string) => emit({ kind: 'fact', text: `+ ${text}`, ts: nowIso() });
  const note = (text: string) => emit({ kind: 'note', text, ts: nowIso() });

  const vocabWords = deriveOptionVocabWords(options, term);
  if (vocabWords.length) {
    note(`   option-set vocabulary (findCatalystWords(), most-shared first): ${vocabWords.join(', ')}`);
  }
  const queries = fieldQueries(term, vocabWords);
  const byName = new Map<string, FieldCandidate>();
  const discarded: FieldDiscardedBlock[] = [];

  for (const q of queries) {
    step(`field ask -- ${q}`);
    note(`   ${q}`);
    // eslint-disable-next-line no-await-in-loop -- two queries, sequential, same pattern as survey_ask.ts
    const res = await googleBlocks(askGoogle, q);
    if (!res.ok) {
      note(`   no answer (${res.via})`);
      continue;
    }
    fact(`Google [${res.via}]: ${res.blocks.length} block(s) returned for "${q}"`);

    for (const block of res.blocks) {
      const passage = [block.title, block.body].filter(Boolean).join(' -- ');
      if (!passage.trim()) {
        discarded.push({ query: q, sourceUrl: block.url, sourceTitle: block.title, why: 'block carried no text (title and body both empty)' });
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- one Gemma call per block, same as survey_ask.ts
      const ex = await gemmaExtract(
        `Copy the field or subject names this passage lists for "${term}". If the passage names `
          + 'more than one field or subject, copy every one of them. Copy each name exactly as it '
          + 'appears in the passage, word for word. Do not decide which field is correct. Do not '
          + 'choose between them -- copy all that are named.',
        passage,
        '{"fields":["a field or subject name copied verbatim from the passage, or empty list if none is named"]}',
      );

      const rawFields = Array.isArray(ex?.fields) ? (ex!.fields as unknown[]) : [];
      let verifiedAny = false;
      for (const raw of rawFields) {
        const name = typeof raw === 'string' ? raw.trim() : '';
        if (!name) continue;
        if (!appearsIn(passage, name)) {
          note(`      discarded field name "${name}" -- could not be verified verbatim against the passage it claimed to come from`);
          continue;
        }
        verifiedAny = true;
        const key = norm(name);
        const existing = byName.get(key);
        if (existing) {
          if (!existing.passages.includes(passage)) existing.passages.push(passage);
        } else {
          byName.set(key, {
            name,
            passages: [passage],
            sourceUrl: block.url,
            sourceTitle: block.title,
            why: `named by query "${q}", source ${block.url || '(no url)'}${block.title ? ` ("${block.title}")` : ''}, verified verbatim`,
          });
        }
      }
      if (!verifiedAny) {
        discarded.push({
          query: q,
          sourceUrl: block.url,
          sourceTitle: block.title,
          why: 'no field/subject name in this passage could be verified verbatim',
        });
      }
    }
  }

  return { queries, candidates: [...byName.values()], discarded };
}

// ─────────────────────────── STEPs 2 & 4 -- eliminate, report, never pick ───────────────────────────

export interface FieldGateResult {
  term: string;
  queries: string[];
  candidates: FieldCandidate[];
  discarded: FieldDiscardedBlock[];
  outcomes: EliminationOutcome<FieldCandidate>[];
  survivors: FieldCandidate[];
  eliminated: EliminationOutcome<FieldCandidate>[];
  decision: GateDecision;
  /** STEP 3. Unchanged `term` unless decision === 'ONE_SURVIVOR', in which case
   *  "<term> in <survivor>" -- the scoped form subsequent denotation queries should use. Narrowing
   *  only happens when it is unambiguous; MULTIPLE_SURVIVORS and ZERO_SURVIVORS both leave the
   *  term unconstrained, per STEP 4's refusal to force a pick. */
  scopedTerm: string;
  why: string;
}

/**
 * E-FIELD-GATE. STEPs 1, 2 and 4 of the Founder's ruling: ask what field(s) `term` belongs to,
 * eliminate any field with zero sourced-vocabulary support in `askText`/`options`, and report --
 * never pick -- among whatever survives.
 */
export async function fieldGate(
  term: string,
  askText: string,
  options: Record<string, string> | null,
  ctx: MethodRunContext,
): Promise<FieldGateResult> {
  const { emit } = ctx;
  const say = (text: string) => emit({ kind: 'header', text, ts: nowIso() });
  const note = (text: string) => emit({ kind: 'note', text, ts: nowIso() });

  say(`E-FIELD-GATE -- what field is "${term}" in, and what does that eliminate?`);

  const { queries, candidates, discarded } = await askFields(term, ctx, options);

  if (!candidates.length) {
    const why = `no verifiable field/subject name found for "${term}" across ${queries.length} quer(y/ies) `
      + `(${discarded.length} source block(s) consulted and discarded) -- falling back to the unconstrained survey, not eliminating anything`;
    note(`   ${why}`);
    emit({ kind: 'result', text: `FIELD GATE (${term}): 0 candidate(s) -- unconstrained`, ts: nowIso() });
    return { term, queries, candidates, discarded, outcomes: [], survivors: [], eliminated: [], decision: 'NO_CANDIDATES', scopedTerm: term, why };
  }

  const optionTexts = options ? Object.values(options) : [];
  const askOptionsVocab = textVocabulary([askText, ...optionTexts], term);

  const items = candidates.map((c) => ({
    item: c,
    vocabulary: vocabularyOf(c.passages, [term, c.name]),
  }));
  const { outcomes, survivors, eliminated } = eliminateByVocabulary(items, askOptionsVocab);

  for (const o of outcomes) {
    note(`   field "${o.name}": ${o.why}`);
  }

  const decision = decide(survivors.length, candidates.length);
  let scopedTerm = term;
  let why: string;
  if (decision === 'ONE_SURVIVOR') {
    scopedTerm = `${term} in ${survivors[0].name}`;
    why = `${candidates.length} field(s) asked for, ${eliminated.length} eliminated (zero sourced-vocabulary support in the ASK/options), `
      + `ONE survivor: "${survivors[0].name}" -- by elimination, what it HAS to be. Subsequent survey queries scoped to "${scopedTerm}".`;
  } else if (decision === 'MULTIPLE_SURVIVORS') {
    why = `${candidates.length} field(s) asked for, ${eliminated.length} eliminated, ${survivors.length} SURVIVE: `
      + `${survivors.map((s) => `"${s.name}"`).join(', ')} -- reported together, NONE chosen (forcing a single winner here is E-MATCH-UP, canon UNSOLVED). Term left unconstrained.`;
  } else {
    why = `${candidates.length} field(s) asked for, ALL eliminated -- zero survivors. Falling back to the unconstrained survey rather than eliminating everything.`;
  }
  note(`   ${why}`);
  emit({
    kind: 'result',
    text: `FIELD GATE (${term}): ${candidates.length} candidate(s), ${survivors.length} surviv(or/ors) [${decision}]`,
    ts: nowIso(),
  });

  return { term, queries, candidates, discarded, outcomes, survivors, eliminated, decision, scopedTerm, why };
}

// ─────────────────────────── STEP 3 -- drop already-surveyed denotations from eliminated fields ───────────────────────────

/**
 * Drops any `SurveyDenotation` whose source-stated register names a field this gate ELIMINATED.
 * A denotation whose register is null (source did not state one), or whose register did not
 * appear among this gate's candidates at all, is kept -- this function only ever removes a
 * denotation on POSITIVE evidence that its own register was eliminated, never on absence of
 * evidence either way.
 */
export function dropDenotationsByEliminatedFields(
  denotations: SurveyDenotation[],
  fieldResult: Pick<FieldGateResult, 'eliminated'>,
): { kept: SurveyDenotation[]; dropped: Array<{ denotation: SurveyDenotation; why: string }> } {
  const eliminatedNorm = new Set(fieldResult.eliminated.map((e) => norm(e.name)));
  const kept: SurveyDenotation[] = [];
  const dropped: Array<{ denotation: SurveyDenotation; why: string }> = [];
  for (const d of denotations) {
    if (d.register && eliminatedNorm.has(norm(d.register))) {
      dropped.push({ denotation: d, why: `source-stated register "${d.register}" belongs to a field the field gate eliminated` });
    } else {
      kept.push(d);
    }
  }
  return { kept, dropped };
}

// ─────────────────────────── the fold level -- same rule, one level down ───────────────────────────

export interface FoldCandidate {
  /** Short audit label -- register (if stated) plus a leading clip of the sourced sentence. Not a
   *  new fact; every field of a SurveyDenotation is carried through unchanged below. */
  name: string;
  sentence: string;
  register: string | null;
  sourceUrl: string;
  sourceTitle: string;
}

export interface FoldGateResult {
  /** The field this fold gate ran inside, for the transcript -- "unconstrained" when the field
   *  gate above did not narrow to one survivor. */
  fieldContext: string;
  candidates: FoldCandidate[];
  outcomes: EliminationOutcome<FoldCandidate>[];
  survivors: FoldCandidate[];
  eliminated: EliminationOutcome<FoldCandidate>[];
  decision: GateDecision;
  why: string;
}

function foldLabel(d: SurveyDenotation, index: number): string {
  const clip = d.sentence.length > 70 ? `${d.sentence.slice(0, 70)}...` : d.sentence;
  return `${d.register ?? 'unstated register'} #${index + 1}: "${clip}"`;
}

/**
 * THE SAME ELIMINATION, ONE LEVEL DOWN. Each surveyed denotation (a verified, sourced sense of the
 * term -- what this ticket calls a "fold") is its own candidate, and its own sentence supplies its
 * own vocabulary, mechanically, exactly as a field's passage supplies the field's vocabulary in
 * fieldGate() above. A fold survives iff its vocabulary shares a word with the ASK/options.
 *
 * NEVER PICKS. If more than one fold survives (qid 85's own measured case -- see this ticket's
 * return), both are reported and NEITHER is chosen. D5 (matching a surviving fold to one OPTION
 * letter) remains exactly what definitional_cascade.ts already declares it: NOT IMPLEMENTED.
 */
export function foldGate(
  denotations: SurveyDenotation[],
  term: string,
  askText: string,
  options: Record<string, string> | null,
  fieldContext: string,
): FoldGateResult {
  if (!denotations.length) {
    return {
      fieldContext,
      candidates: [],
      outcomes: [],
      survivors: [],
      eliminated: [],
      decision: 'NO_CANDIDATES',
      why: 'no surveyed denotations available to apply fold-level elimination to',
    };
  }

  const optionTexts = options ? Object.values(options) : [];
  const askOptionsVocab = textVocabulary([askText, ...optionTexts], term);

  const candidates: FoldCandidate[] = denotations.map((d, i) => ({
    name: foldLabel(d, i),
    sentence: d.sentence,
    register: d.register,
    sourceUrl: d.sourceUrl,
    sourceTitle: d.sourceTitle,
  }));

  const items = candidates.map((c) => ({
    item: c,
    // The fold's own sourced sentence IS its passage here -- survey_ask.ts does not carry the
    // full retrieved passage forward on SurveyDenotation, only the verified defining sentence, so
    // the sentence is what this level has to derive vocabulary from. Documented, not hidden.
    vocabulary: vocabularyOf([c.sentence], [term, c.register ?? '']),
  }));
  const { outcomes, survivors, eliminated } = eliminateByVocabulary(items, askOptionsVocab);
  const decision = decide(survivors.length, candidates.length);

  const why = decision === 'ONE_SURVIVOR'
    ? `${candidates.length} fold(s) inside "${fieldContext}", ${eliminated.length} eliminated, ONE survivor: "${survivors[0].name}"`
    : decision === 'MULTIPLE_SURVIVORS'
      ? `${candidates.length} fold(s) inside "${fieldContext}", ${eliminated.length} eliminated, ${survivors.length} SURVIVE together, none chosen: `
        + survivors.map((s) => `"${s.name}"`).join('; ')
      : `${candidates.length} fold(s) inside "${fieldContext}", ALL eliminated -- zero survivors, falling back to every fold unconstrained`;

  return { fieldContext, candidates, outcomes, survivors, eliminated, decision, why };
}
