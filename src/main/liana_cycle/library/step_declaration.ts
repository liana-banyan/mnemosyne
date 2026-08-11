// step_declaration.ts -- D-BP152-018/BISHOP/seg-register-orphan-steps
//
// THE STEP DECLARATION SHAPE. Spec:
//   LianaBanyanPlatform\BISHOP_DROPZONE\LIANA_CYCLE_BENCH_SPEC.md section 3.3.
//
// Section 3.3, verbatim requirement: "a step needs at minimum: an id (and, per §4.2, a
// version, e.g. `19:1`); its inputs (what state it reads); its outputs (what state it
// writes); its query text, if it issues one, as an editable field...; and its attribution --
// per HARDWIRE-23, every decision rule a step contains must carry either
// `ATTRIBUTED: Founder, BP<NNN>, verbatim: "..."` or `TARE: no Founder order, awaiting
// ruling` at the site of the rule."
//
// This module is the SEED of spec item 2 (section 9: "Build the Library as a data structure"),
// authorized narrowly by D-BP152-018 for item 1 only (register the orphaned elements/ exports
// as declared steps). Bishop, verbatim, on the authorization: "BECAUSE THERE IS NOWHERE TO
// REGISTER INTO YET, you must create the minimal registry structure to hold them... a typed
// declaration shape plus a catalog listing the verified entries. That is the seed of spec
// item 2, deliberately, and it is the smallest thing that makes item 1 possible."
//
// INERT BY DESIGN. This module holds only type definitions -- no runtime logic, no import of
// any elements/ file, nothing that could execute a registered step. Making a declared step
// actually callable is spec item 12 ("the typed/pulled-entry override execution path"),
// explicitly BLOCKED on the Founder's confirmation of what "typed" may lawfully mean under
// HARDWIRE-22, and is out of this ticket's boundary -- see orphan_catalog.ts's header for the
// full boundary statement.

/** Per HARDWIRE-23 Law 4: every decision rule carries its attribution at the site of the rule,
 *  as either a specific Founder citation or an explicit, dated TARE marker. There is no third
 *  category -- an unmarked decision rule defaults to TARE. */
export type StepAttribution =
  | {
      kind: 'ATTRIBUTED';
      /** Which Founder ruling this traces to, e.g. "BP150". */
      founderRuling: string;
      /** His words, verbatim, as quoted in the source file's own header comment. Never
       *  paraphrased -- copied character-for-character from the cited file. */
      quote: string;
      /** file:line (or a line range) inside the repo where that quote is recorded, so the
       *  attribution can be checked against the source rather than trusted on the record's own
       *  say-so. */
      citedAt: string;
    }
  | {
      kind: 'TARE';
      /** Why this decision rule has no Founder order behind it -- named plainly, per
       *  HARDWIRE-23 Law 2 ("stop and ask, do not implement and disclose"). This catalog only
       *  DESCRIBES pre-existing code; it does not add or remove any decision rule, and marking
       *  something TARE here does not authorize building or relying on it. */
      note: string;
    }
  | {
      /** This step's own logic contains no decision rule to attribute -- it is a pure
       *  measurement/partition/loop with no branch that could change which answer comes out
       *  (HARDWIRE-23's own stated test, "What This Law Does Not Do"). Used only when that test
       *  is genuinely met; a step that merely LOOKS simple but does branch on a threshold is
       *  ATTRIBUTED or TARE, never this. */
      kind: 'NO_DECISION_RULE';
      why: string;
    };

/** DECIDES = returns a decision with downstream consequences (an elimination, a narrowed pool).
 *  REPORTS = returns a measurement/partition with no elimination of its own.
 *  DECIDES_AND_REFUSES = decides when its own safety gate is satisfied, otherwise reports and
 *  refuses rather than guessing -- the discipline this codebase repeats across
 *  aspect_tag.ts/field_gate.ts/substitution_search.ts alike. */
export type StepDecisionShape = 'DECIDES' | 'REPORTS' | 'DECIDES_AND_REFUSES';

export interface StepQueryText {
  /** Whether this step forms or issues any outbound Google query text at all. */
  issuesQuery: boolean;
  /** Human-readable description of the query text/template this step forms, if any. This is
   *  documentation ONLY -- never a live copy of an editable resource, and never itself sent
   *  anywhere by this catalog. */
  description: string | null;
  /** Whether that query text (if any) is loaded at runtime from
   *  resources/liana_survey_queries.json (the D-BP152-008 runtime-editable resource) or is
   *  hardcoded inline in the TypeScript source. This catalog does not read or modify that
   *  resource file either way. */
  loadedFromQueryResource: boolean;
}

export interface StepDeclaration {
  /** Stable id: `elements.<file-stem>.<exportName>`. */
  id: string;
  /** Per spec §4.2 (`19:1` / `19:2`): this is a first, unmodified registration of existing code,
   *  so every entry in this ticket's catalog is version "1". A saved contingency editing this
   *  step's behavior would be version "2", etc. -- not applicable here, since nothing is edited. */
  version: string;
  /** Repo-relative path to the file this export is defined in. */
  sourceFile: string;
  /** The line the `export` keyword for this symbol appears on, at the commit named in the
   *  catalog that declares this entry. */
  sourceLine: number;
  /** The literal exported symbol name. */
  exportName: string;
  /** A step is not always a function -- some registered symbols are exported consts consumed as
   *  gate data by a sibling function in the same file. */
  exportKind: 'function' | 'const';
  /** One sentence, read from the CODE itself (the function body / const value), not copied from
   *  the file's comment header -- per this ticket's explicit instruction. */
  whatItDoes: string;
  /** D-BP152-045/BISHOP/seg-composer-ui-fixes -- OPTIONAL PARENTAGE. Founder, BP152, verbatim:
   *  "can you indicate with the NameNumbers if they are part of a script or method or whatever?
   *  ... so that users know what each are a part of?" The canonical `Name:Number` id (this
   *  declaration's own registered id, e.g. "DefineTheTerm:1") of the composite step this one is
   *  a PART of, e.g. "Survey:1" -- undefined for a step that is not part of any composite. This
   *  is display metadata only: it is never read by script_runner.ts, never a decision input, and
   *  changing it cannot change which answer any step produces (same discipline as script.ts's own
   *  `attribution` field on a ScriptStepRef, see that file's header). The minimum field needed to
   *  let the composer panel render "Parent:N > Child:N" from real registry data instead of a
   *  hardcoded UI map. */
  parentId?: string;
  /** What this step reads: parameters and their shape. */
  inputs: string;
  /** What this step returns or produces. */
  outputs: string;
  decidesOrReports: StepDecisionShape;
  queryText: StepQueryText;
  attribution: StepAttribution;
  /** Why this export was found to have zero live callers -- direct or transitive -- as of the
   *  commit named in the catalog that declares this entry. The evidence trail, not just the
   *  verdict, so the finding can be re-checked rather than trusted. */
  orphanEvidence: string;
}
