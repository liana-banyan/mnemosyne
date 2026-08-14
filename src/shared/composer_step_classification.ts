// composer_step_classification.ts -- D-BP154-017/BISHOP-SEG/S17/seg-classify
//
// THE RATIFIED MAPPING (Founder, BP154 turn, verbatim: "yes, that mapping is right - build it." --
// FD-BP154-04/FD-BP154-05, BISHOP_DROPZONE\RULINGS_BP154.md), for the Composer's own steps
// (Softballs:1/NamedSet:1/Discriminator:1 today; the Terminator, D-BP154-018, reuses this same
// module for its own verdict). His reason, verbatim: "so that we can see what is happening and
// how well or not what we put in worked."
//
//   PROVEN        stated value, verbatim span, AND independent document corroboration
//   CORROBORATED  stated value confirmed by a NAMED third-party document
//   ANSWERED      stated value with a verifiable span, one mechanism, no corroboration yet
//   ABSTAIN       nothing stated -- source silent, or not obtained
//
// EVERY CLASS HERE IS DECIDABLE WITHOUT THE ANSWER KEY (BP154_PLOW_CLASSIFICATION_RECON.md's own
// requirement). classifyComposerStepResult() below reads only STRUCTURAL facts already present on
// a step's own result object -- ok/excluded-or-included-or-kinds/answerProvenance/corroboration --
// never which letter is correct. Test for every branch: "would this rule survive on a question
// whose answer we do not know?" Yes -- nothing here branches on option identity or content.
//
// PROVEN IS RESERVED, NOT FORCED. Softballs/NamedSet/Discriminator never touch a deterministic
// solver (they are Gemma-extraction + Gemini-answer + Google-document-corroboration all the way
// down, HARDWIRE-22), so classifyComposerStepResult() never emits PROVEN for them -- that would be
// inventing a distinction the mechanism doesn't support (corroborateClaim(), composer_step_
// evidence.ts, already requires a verbatim span before it ever reports corroborated:true, so
// "verbatim span + one document" and "verbatim span + AND independent document corroboration" are
// the same event for these three steps; manufacturing a fake gap between them would be exactly the
// "false pass" BP154 dispatch warned against, five runs deep, all published A on unstated bases).
// PROVEN's own emitter, added D-BP154-018, is the TERMINATOR branch below (typeof r.abstain ===
// 'boolean'): a verdict whose EVERY contributing feeder step was independently CORROBORATED (not
// merely one of them) -- redundant, independent document-backing across the whole basis, not just
// a single fact. comparative_cascade.ts's own detectValueConvergence()/evaluateComparativeTerminator()
// machinery is untouched by this file and by terminator_step.ts -- that machinery is fenced
// (comparative_cascade.ts stays untouched beyond gemmaExtract() itself), and this new elimination-
// based terminator (FD-BP152-19, UNIQUE OR ABSTAIN) is a separate, self-contained reducer that
// never calls it. This file only classifies what it can HONESTLY tell apart; CORROBORATED is the
// ceiling for Softballs/NamedSet/Discriminator alone, and PROVEN only ever comes from a verdict
// resting on multiple independently-corroborated facts.
//
// A FAILURE MAY NEVER BE PRESENTED AS A SUCCESS (today's law across six defects, THE_PAIL_BP154.md
// STAGE 5's own dispatch): `ok !== true` is ABSTAIN, full stop, regardless of what a summary string
// might otherwise say -- the query-bill false-credit case ("answered FROM OWNED EVIDENCE ... FRAME
// UNAVAILABLE" in one sentence) is exactly what checking `ok` first, before anything else,
// prevents. `ok === true` with zero stated claims is ALSO ABSTAIN, not ANSWERED -- Softballs'/
// NamedSet's/Discriminator's own "(none stated)" case is an honest silent source, not a value.
//
// ABSTAIN IS NOT AN ERROR. Colours below are chosen so ABSTAIN reads as neutral/legitimate (slate),
// never red -- red is reserved for something this file does not even classify (a thrown exception,
// handled upstream by script_runner.ts's own 'failed' step status, never reaching this function at
// all).
//
// COLOUR REUSE, NOT A THIRD HAND-COPY (BP154_PLOW_CLASSIFICATION_RECON.md: "the color hex table
// already exists TWICE ... a third hand-copy is forbidden"). PROVEN's and CORROBORATED's colours
// below are the LITERAL hex values answer_coroner.ts's classifyForDemoDisplay() already uses for
// its own 'proven' (#4ade80/#052e16) and 'corroborated' (#60a5fa/#0c2340) classes (src/main/plow/
// answer_coroner.ts:698-699, 737-738) -- cited, not re-derived, so this module's PROVEN/CORROBORATED
// read as the SAME visual language the plow already taught an operator, not a competing palette.
// ANSWERED and ABSTAIN have no equivalent in the plow's six-class table (that table has no
// "stated but uncorroborated" or "legitimately nothing stated" tier of its own), so they are new,
// picked to read clearly as "weaker than corroborated" (grey) and "neutral, not a failure" (slate)
// respectively without inventing a third hand-copy of anything that already exists elsewhere.

export type ComposerStepClass = 'PROVEN' | 'CORROBORATED' | 'ANSWERED' | 'ABSTAIN';

export interface ComposerStepClassStyle {
  label: string;
  /** One-clause, plain-English explanation of what this class means FOR A STEP -- rendered next
   *  to the badge so "which means what to who about why" (Founder, BP148: "no one knows" is the
   *  failure mode this exists to prevent) is answered in place, not left to a legend elsewhere. */
  description: string;
  icon: string;
  colorFg: string;
  colorBg: string;
}

export const COMPOSER_STEP_CLASS_STYLE: Readonly<Record<ComposerStepClass, ComposerStepClassStyle>> = {
  PROVEN: {
    label: 'PROVEN',
    description: 'A stated value, its verbatim span, AND an independently corroborating document all agree.',
    icon: '★', // ★ -- same glyph answer_coroner.ts uses for its own 'proven'
    colorFg: '#4ade80',
    colorBg: '#052e16',
  },
  CORROBORATED: {
    label: 'CORROBORATED',
    description: 'The stated value is confirmed by a named third-party document, with its own verbatim span.',
    icon: '✓', // ✓ -- same glyph answer_coroner.ts uses for its own 'corroborated'
    colorFg: '#60a5fa',
    colorBg: '#0c2340',
  },
  ANSWERED: {
    label: 'ANSWERED',
    description: 'A stated value with a verifiable span, from one mechanism -- no corroboration yet.',
    icon: '•', // •
    colorFg: '#cbd5e1',
    colorBg: '#1f2937',
  },
  ABSTAIN: {
    label: 'ABSTAIN',
    description: 'Nothing stated -- the source was silent, or no usable answer was obtained. Not a failure.',
    icon: '–', // –
    colorFg: '#94a3b8',
    colorBg: '#1e293b',
  },
};

/** Structural shape SoftballsResult/NamedSetResult/DiscriminatorResult all share (softballs_step.
 *  ts/named_set_step.ts/discriminator_step.ts) -- duck-typed here on purpose so this module does
 *  not import any of those three files (which would pull main-process-only code into a renderer-
 *  safe shared module) or classify_cascade.ts (FORBIDDEN). Every field is read defensively; a
 *  value of the wrong shape is treated as "not present", never thrown on. */
interface StepResultShape {
  ok?: unknown;
  error?: unknown;
  query?: unknown;
  excluded?: unknown;
  included?: unknown;
  kinds?: unknown;
  /** DiscriminatorResult-only (discriminator_step.ts): the SEPARATE, single decisive
   *  category-denoting claim -- corroborateClaim() prefers THIS over `kinds[]` when both are
   *  present (that file's own STAGE 3 comment: "Prefers the category-denoting kind"). MEASURED
   *  live, qid 98, this ticket: a real run returned `kinds: []` (per-option classifications) but
   *  a stated, document-corroborated `categoryKind` -- counting only `kinds.length` would have
   *  reported ABSTAIN for a step that actually answered and was corroborated, exactly the
   *  "a success shown as a failure" mis-read this file's own header warns against for the
   *  opposite direction. Counted as one additional stated claim when both its `kind` and `span`
   *  are non-empty strings (verifyCategoryKind(), discriminator_step.ts, already verified the span
   *  before this ever reaches here -- this file re-checks only that the fields are non-empty, not
   *  the verbatim-in-passage fact itself, which is not this module's job). */
  categoryKind?: { kind?: unknown; span?: unknown } | null;
  answerProvenance?: { mechanism?: unknown; sourceId?: unknown; detail?: unknown } | null;
  corroboration?: {
    attempted?: unknown; corroborated?: unknown; sourceUrl?: unknown; sourceTitle?: unknown;
    span?: unknown; error?: unknown;
  } | null;
  /** TerminatorResult-only (terminator_step.ts, D-BP154-018) -- a DIFFERENT shape from the three
   *  feeder steps (no excluded/included/kinds array of its own; it derives a verdict FROM them).
   *  Detected by the presence of `abstain` (a boolean every TerminatorResult sets, `ok===true` or
   *  not) rather than any of the fields above. `basisStepClasses` is terminator_step.ts's own,
   *  already-computed classification of every feeder step that contributed an elimination --
   *  reduced below into this verdict's own class, never re-derived from scratch here (this module
   *  has no way to re-run that reduction faithfully without re-importing the feeder steps'
   *  result shapes a second time). */
  abstain?: unknown;
  abstainReason?: unknown;
  verdict?: unknown;
  basisStepClasses?: unknown;
}

export interface ComposerStepClassification {
  cls: ComposerStepClass;
  /** Plain-English reason THIS run landed on this class, distinct from the style table's generic
   *  description -- e.g. "nothing stated" vs "3 stated, 1 document-corroborated". */
  detail: string;
  /** How many options this step stated a verified claim about (0 for ABSTAIN by construction). */
  statedCount: number;
}

/** THE ONE PLACE a Composer step's raw result becomes a badge. Never asked of a model, never
 *  reads which letter is which -- see this file's header for the mapping and why PROVEN is
 *  reserved. Accepts `unknown` because script_bridge.ts's own ComposerStepOutcome.raw is `unknown`
 *  by construction (three different result interfaces share no common exported type). */
export function classifyComposerStepResult(raw: unknown): ComposerStepClassification {
  if (!raw || typeof raw !== 'object') {
    return { cls: 'ABSTAIN', detail: 'no result to classify', statedCount: 0 };
  }
  const r = raw as StepResultShape;
  if (r.ok !== true) {
    const err = typeof r.error === 'string' && r.error ? r.error : 'the step did not complete';
    return { cls: 'ABSTAIN', detail: err, statedCount: 0 };
  }
  // TerminatorResult branch (D-BP154-018) -- checked first, before the generic excluded/included/
  // kinds path below, since a terminator verdict has none of those and would otherwise fall
  // through to the statedCount===0 ABSTAIN case for the wrong reason.
  if (typeof r.abstain === 'boolean') {
    if (r.abstain) {
      const reason = typeof r.abstainReason === 'string' && r.abstainReason ? r.abstainReason : 'abstained';
      return { cls: 'ABSTAIN', detail: reason, statedCount: 0 };
    }
    const classes = Array.isArray(r.basisStepClasses) ? (r.basisStepClasses as unknown[]) : [];
    const corroboratedOrBetter = classes.filter((c) => c === 'CORROBORATED' || c === 'PROVEN').length;
    const verdictLabel = typeof r.verdict === 'string' ? r.verdict : '(unknown)';
    if (classes.length > 0 && corroboratedOrBetter === classes.length) {
      return { cls: 'PROVEN', detail: `verdict ${verdictLabel}, every contributing step independently corroborated`, statedCount: 1 };
    }
    if (corroboratedOrBetter > 0) {
      return { cls: 'CORROBORATED', detail: `verdict ${verdictLabel}, at least one contributing step independently corroborated`, statedCount: 1 };
    }
    return { cls: 'ANSWERED', detail: `verdict ${verdictLabel}, contributing step(s) stated but not corroborated`, statedCount: 1 };
  }
  const statedArray = Array.isArray(r.excluded)
    ? r.excluded
    : Array.isArray(r.included)
      ? r.included
      : Array.isArray(r.kinds)
        ? r.kinds
        : [];
  const categoryKindStated = Boolean(
    r.categoryKind && typeof r.categoryKind.kind === 'string' && r.categoryKind.kind
      && typeof r.categoryKind.span === 'string' && r.categoryKind.span,
  );
  const statedCount = statedArray.length + (categoryKindStated ? 1 : 0);
  if (statedCount === 0) {
    return { cls: 'ABSTAIN', detail: 'the source was silent -- nothing stated (absence is omission, not denial)', statedCount: 0 };
  }
  const corrob = r.corroboration;
  if (corrob && corrob.corroborated === true) {
    const title = typeof corrob.sourceTitle === 'string' && corrob.sourceTitle ? corrob.sourceTitle : (typeof corrob.sourceUrl === 'string' ? corrob.sourceUrl : 'a named document');
    return { cls: 'CORROBORATED', detail: `${statedCount} stated, confirmed by "${title}"`, statedCount };
  }
  return { cls: 'ANSWERED', detail: `${statedCount} stated, verbatim span verified, no corroboration yet`, statedCount };
}
