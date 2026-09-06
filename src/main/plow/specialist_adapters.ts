/**
 * specialist_adapters.ts — BP1xx Pawn Authority List Phase 1 · 13 External Specialist API Adapters
 *
 * Implements the Founder-Invented 14-Domain Looping Methodology external data layer.
 * Each adapter: accepts question text + domain → returns CandidateEblet[].
 * FireGuard 1.0s stagger between adapter dispatches per question (upstream caller).
 *
 * Adapter roster:
 *   1. Wikipedia    — en.wikipedia.org/api/rest_v1
 *   2. Wikidata     — www.wikidata.org/w/api.php
 *   3. StackExchange — api.stackexchange.com/2.3
 *   4. arXiv        — export.arxiv.org/api/query
 *   5. Wolfram Alpha — api.wolframalpha.com/v2/query  (key from env)
 *   6. OpenAlex     — api.openalex.org
 *   7. NIST         — webbook.nist.gov (chem/phys) + nvlpubs.nist.gov
 *   8. PubMed       — eutils.ncbi.nlm.nih.gov/entrez/eutils
 *   9. Common Crawl — index.commoncrawl.org CDX
 *  10. Europe PMC   — www.ebi.ac.uk/europepmc/webservices/rest  (BP1xx Phase 1, no key)
 *  11. openFDA      — api.fda.gov/drug/label.json  (BP1xx Phase 1, no key)
 *  12. MedlinePlus  — wsearch.nlm.nih.gov/ws/query  (BP1xx Phase 1, no key, XML)
 *  13. Crossref     — api.crossref.org/works  (BP1xx Phase 1, no key, polite pool)
 *
 * SPECIALIST_METADATA (below the registry) carries the Phase 1 Standard/Premium
 * tier + domain-affinity + cost seed for the Pawn authority list. Descriptive only.
 *
 * Weight scale: 0.0-1.0 (Miner threshold: >= 0.6).
 * Content length: Miner threshold >= 100 chars.
 * Timeout per adapter: 5000ms.
 *
 * KN-BP145-C (BP145): the per-adapter `weight` value below is no longer a hand-typed
 * constant. It is resolved per call, per (source, domain), through resolveSourceWeight()
 * (see the SourceCredibilityLedger section below), which returns UNMEASURED_PASSTHROUGH_WEIGHT
 * until a real outcome-attributed observation exists for that exact (source, domain) pair and
 * clears MIN_SAMPLE_SIZE_FOR_GATING. No observation-writer exists anywhere in this codebase yet
 * (attribution is blocked on KN-BP144-14 Phase 1, per SPEC_THE_BANYAN_METRIC_FOR_SOURCES_BP144.md
 * Section 1), so today every call resolves to UNMEASURED_PASSTHROUGH_WEIGHT -- honestly absent,
 * not the old 0.62-0.90 hand-typed guesses this replaces.
 */

// --- D-BP220-BM0-014 Stage 2 (Option 3: brand `.content` itself) -------------------------------
//
// Stage 1 (DurableWritable/toDurableWritable, immediately below CandidateEblet) closes the
// durable-write hole for callers that go through a durable-write entry point's typed parameter.
// It does NOT stop a caller from doing `candidates.map((c) => c.content)` for some OTHER purpose
// (a prompt, a network dispatch, a log line) and then handing THAT bare string[] somewhere unsafe
// -- nothing about a plain `content: string` field stops the flattening itself. Stage 2 closes
// that: `CandidateEblet.content` is `CandidateContent`, not `string`, and `CandidateContent` is a
// genuine class with a PRIVATE constructor and a PRIVATE raw field -- TypeScript compares classes
// with private members NOMINALLY, not structurally, so no other shape in this codebase can ever
// satisfy it by accident. The only way to read a string back out is `.unwrap(sinkKind)`, which
// takes a mandatory ContentSinkKind so a future call site's intent is legible at the type level.
//
// WHY NOT A BRANDED STRING (`string & { brand: true }`) INSTEAD: tried first, and rejected by
// direct test (see the Stage 2 guard-demonstration snippet in this dispatch's scratchpad). A
// branded-string intersection is still structurally a string for every read operation (.slice(),
// .length, string concatenation all still work with zero unwrap), and -- critically -- TypeScript
// arrays are covariant, so `CandidateContent[]` under that design would STILL be assignable to a
// plain `string[]`-typed parameter with zero compile error. `.map((c) => c.content)` would have
// kept typechecking into something usable as string[] -- exactly the flattening this Stage exists
// to catch. Only a genuine non-string class closes that gap.
export type ContentSinkKind = 'PROMPT' | 'DURABLE_STORE' | 'NETWORK' | 'LOG';

/** See the Stage 2 header comment above for why this must be a real class (nominal typing via a
 *  private member), not a branded string. `raw` and the constructor are both private: no code
 *  outside this class -- not even code in this same file -- can read a `CandidateContent`'s
 *  string value except through `.unwrap()`, and no code anywhere can construct one except
 *  through `.wrap()`. */
export class CandidateContent {
  private constructor(private readonly raw: string) {}

  /** THE ONLY way to construct a `CandidateContent`. Every specialist adapter in this file wraps
   *  its extracted text through this before putting it on a `CandidateEblet.content` field. */
  static wrap(raw: string): CandidateContent {
    return new CandidateContent(raw);
  }

  /** THE ONLY way to get a plain string back out. `sink` is mandatory, not decorative: it makes
   *  a call site's destination legible at the type level (a reviewer, or a future stricter
   *  version of this method, can tell a PROMPT read from a DURABLE_STORE read without re-deriving
   *  it from surrounding code). Every sink resolves to the same raw value today -- the
   *  trust-aware SANITIZATION for untrusted candidates (sanitizeUntrustedContentForQuoting, the
   *  fence markers, the UNTRUSTED-candidate refusal in toDurableWritable below) already lives at
   *  each call site and continues to run AFTER this unwrap, completely unchanged; this method
   *  only ever hands back the raw text, never decides on its own whether that text is safe for
   *  the stated sink. */
  unwrap(_sink: ContentSinkKind): string {
    return this.raw;
  }
}

export interface CandidateEblet {
  source: string;         // adapter name
  content: CandidateContent; // factual content (must pass Miner: >= 100 chars). NEVER a bare
  // string -- see the ContentSinkKind/CandidateContent header comment immediately above this
  // interface. Read it back out via `.unwrap(sinkKind)`, never by any other means.
  weight: number;         // resolved via resolveSourceWeight() -- see SourceCredibilityLedger below
  sid: string;            // stable ID (hash of source + content prefix)
  provenance_url?: string;
  domain?: string;
  /** D-BP220-BM0-003 (voter-path prompt-injection enforcement). OPTIONAL, absent for every one
   *  of the 9(+) encyclopedia-swarm adapters in this file (Wikipedia/Wikidata/arXiv/etc.) -- they
   *  never set it, so `c.trust` is `undefined` for them, byte-identical to pre-change behavior.
   *  Set to the literal `'UNTRUSTED'` ONLY at the one call site in plow_mc_answerer.ts that
   *  constructs a browser-authority candidate straight from a `BrowserAuthorityLookupResult`
   *  (browser_authority_types.ts), carrying that object's own `trust`/`acquiredFrom`/
   *  `acquiredAtUtc` fields through onto the candidate instead of flattening them away. Exists so
   *  a consumer of `factsForArbitration`/`componentFactsList` can tell, per-candidate, "this is
   *  scraped web text, not an encyclopedia extract" and render it as quoted evidence rather than
   *  as trusted prompt text. See plow_mc_answerer.ts's `renderFactForPrompt`/
   *  `sanitizeUntrustedContentForQuoting`. */
  trust?: 'UNTRUSTED';
  /** D-BP220-BM0-003, paired with `trust` above -- same value as the source
   *  BrowserAuthorityLookupResult.acquiredFrom (e.g. 'google', 'perplexity'). Absent whenever
   *  `trust` is absent. */
  acquiredFrom?: string;
  /** D-BP220-BM0-003, paired with `trust` above -- same ISO8601 value as the source
   *  BrowserAuthorityLookupResult.acquiredAtUtc. Absent whenever `trust` is absent. */
  acquiredAtUtc?: string;
}

// --- Durable-write projection guard (D-BP220-BM0-014, Stage 1: Option 2) ---------------------
//
// THE DISEASE this exists to close: `candidates.map((c) => c.content)` (or any equally silent
// flattening of a `CandidateEblet[]` to a bare `string[]`) drops `c.trust`/`c.acquiredFrom`/
// `c.acquiredAtUtc` at exactly the boundary where it matters most -- a DURABLE, verified:true
// eblet write. Three separate prompt-injection/store-poisoning escapes were found in one day
// (D-BP220-BM0-003/005/007 -- voter prompt, Star Chamber warm-seed, Stage D component write),
// all the same flattening in different clothes. Each of those three fixes is a REVIEWER-
// enforced guard: renderFactForPrompt/renderFactForStarChamberSeed (plow_mc_answerer.ts) and
// writeRoundEblets' per-item `if (fact.trust === 'UNTRUSTED') continue` are all runtime checks
// a future call site can simply fail to call. Nothing stops a fourth durable-write entry point
// from doing `candidates.map((c) => c.content)` straight into a `verified: true` write; the
// compiler has no opinion.
//
// `DurableWritable` is the fix: it is what a durable, verified:true eblet write legitimately
// needs from a candidate, and it structurally CANNOT carry untrusted content, because the ONLY
// way to produce one is `toDurableWritable()` immediately below, which refuses (omits) every
// candidate carrying `trust === 'UNTRUSTED'` before it ever becomes a `DurableWritable`. A
// durable-write entry point (runScribe in canonical_pipeline.ts; writeRoundEblets in
// plow_mc_answerer.ts) declares its candidate parameter as `DurableWritable[]`, not
// `CandidateEblet[]` -- so a future call site that still has raw `CandidateEblet[]` and tries
// to hand it straight to one of those functions FAILS TO COMPILE, and the only way to make it
// compile is to route through `toDurableWritable()` first, which is exactly the guard.
export interface DurableWritable {
  source: string;
  content: string;
  weight: number;
  sid: string;
  provenance_url?: string;
  domain?: string;
  /** NOMINAL BRAND, required (not optional) -- WITHOUT this field `DurableWritable` is a pure
   *  structural SUBSET of `CandidateEblet` (every field above also exists on CandidateEblet,
   *  with compatible types), so TypeScript's structural typing would let a bare
   *  `CandidateEblet[]` -- UNTRUSTED candidates and all -- pass directly into a
   *  `DurableWritable[]`-typed parameter with ZERO conversion and ZERO compile error. That is
   *  not a hypothetical: it was verified by direct test (see the D-BP220-BM0-014 Stage 1
   *  guard-demonstration snippet) that `runScribe(..., someCandidateEblets, ...)` compiled
   *  clean with no brand field present, silently defeating the whole guard. This field exists
   *  ONLY to make that impossible: `CandidateEblet` never carries it, so TypeScript refuses
   *  the assignment with a real "property is missing" error. The ONLY place that ever sets it
   *  is `toDurableWritable()` immediately below (via an explicit cast, since the brand carries
   *  no real runtime meaning -- it exists purely for the compiler). */
  readonly __durableWritableBrand: true;
}

/** THE ONLY way to produce a `DurableWritable[]`. Refuses (omits, does not throw -- matching
 *  every other non-fatal per-candidate discipline already in this codebase, e.g. runScribe's
 *  own try/catch-per-candidate and writeRoundEblets' pre-existing per-item `continue`) every
 *  candidate carrying `trust === 'UNTRUSTED'`. A trusted candidate (`trust` absent -- every
 *  encyclopedia-swarm adapter in this file) passes through with its `content` field unchanged:
 *  byte-identical to the old `.map((c) => c.content)` behavior for the path that was always
 *  safe. Pure, synchronous, no I/O -- safe to call at any durable-write call site. */
export function toDurableWritable(candidates: readonly CandidateEblet[]): DurableWritable[] {
  const out: DurableWritable[] = [];
  for (const c of candidates) {
    if (c.trust === 'UNTRUSTED') {
      continue;
    }
    out.push({
      source: c.source,
      content: c.content.unwrap('DURABLE_STORE'),
      weight: c.weight,
      sid: c.sid,
      provenance_url: c.provenance_url,
      domain: c.domain,
      // The brand: this object literal is the ONE place in this codebase allowed to set it.
      // No cast needed -- `out.push(...)` already checks the literal against DurableWritable,
      // and every required field (including this one) is present.
      __durableWritableBrand: true,
    });
  }
  return out;
}

// ─── Source Credibility Ledger (KN-BP145-C, BP145) ─────────────────────────────
//
// Replaces the fabricated static per-adapter `weight` literals this file used to carry at
// (pre-change) lines 117, 154, 195, 235, 287, 334, 367, 391, 444, 485, 507, 521, 566, 617, 674,
// 719, 777, 850, 891 -- nineteen hand-typed numbers between 0.62 and 0.90, assigned once by a
// human, never updated by an outcome. Full design: SPEC_THE_BANYAN_METRIC_FOR_SOURCES_BP144.md
// at C:\Users\Administrator\Documents\LianaBanyanPlatform\BISHOP_DROPZONE\. This is the minimum
// honest slice of that design scoped to this one file, per KN-BP145-C.
//
// NAMING: deliberately NOT called "Banyan Metric" anywhere in this section's identifiers.
// ~120 legacy eblets already use that name for an unrelated BP045-060 per-session scoring
// framework (confirmed by the SPEC's own orphan check, which found BanyanMetricLedger.tsx
// scores sessions, not sources). This concept is named the SourceCredibilityLedger throughout --
// a distinct, source-x-domain concept, flagged here for Bishop to canonicalize or rename later.
//
// NON-SEPARABLE UNIT: every read and write below is keyed by (sourceId, domainId) together.
// There is no lookup or storage path in this module that scores a source without a domain
// attached (SPEC: "a source score without a domain is not a valid record").

/** One (source, domain) credibility record: a count of real observations, the empirical
 *  correctness rate over those observations, and the date of the most recent one. */
export interface SourceCredibilityRecord {
  sourceId: string;
  domainId: string;
  observedN: number;
  scoreValue: number;   // mean correctness over observedN observations, 0.0-1.0
  vintageDate: string;  // ISO-8601 timestamp of the most recent observation, per SPEC Section 4
}

// No observation-writer exists anywhere in this codebase yet: per SPEC Section 1, per-claim
// attribution (which specific source's content a scored answer's final letter actually rested
// on) is blocked on KN-BP144-14 Phase 1 landing. The ledger therefore starts, and today stays,
// EMPTY. This is intentional -- seeding it with anything, including the same 0.62-0.90 numbers
// under a new name, is exactly the fabrication this ticket exists to kill. In-memory only (a
// Map, not a file or DB table): nothing persists it across process restarts yet, because nothing
// writes to it yet either. Flagged as a known gap in the KN-BP145-C report, not papered over.
const sourceCredibilityLedger = new Map<string, SourceCredibilityRecord>();

function sourceCredibilityKey(sourceId: string, domainId: string): string {
  return `${sourceId}::${domainId}`;
}

/**
 * Minimum number of real, outcome-attributed observations a (source, domain) pair must carry
 * before its empirical score is allowed to gate, rank, or otherwise influence anything. Fixed
 * here, before any observation exists, and must not be adjusted later after seeing what some
 * source's score would look like at a different threshold (SPEC Section 2: "a minimum-n
 * threshold picked after seeing which sources look good or bad at various candidate thresholds
 * is not a threshold, it is the desired conclusion wearing a number").
 *
 * Rationale for 30: a conventional statistical floor for treating a binomial proportion's normal
 * approximation as reasonable (the "np >= 5 and n(1-p) >= 5" rule of thumb implies n >= 20 at the
 * worst case p = 0.5; 30 is the more common textbook rounding of that floor, sometimes called the
 * "n >= 30" rule for the sampling distribution of a mean/proportion to be treated as approximately
 * normal). At n = 30 and the worst-case true rate p = 0.5, the two-sided 95% Wald interval
 * half-width is 1.96 * sqrt(0.5*0.5/30) ~= 0.179 -- under 18 points, tight enough that a score
 * crossing this floor says something, not nothing. No source has any observations yet, so there
 * was nothing to tune this number against when it was picked; it is a textbook floor, not a
 * fitted one.
 */
export const MIN_SAMPLE_SIZE_FOR_GATING = 30;

/**
 * A record whose most recent observation (vintageDate) is older than this is treated as
 * UNMEASURED for gating/ranking purposes -- never as BAD (SPEC Section 4, "Source BM must decay
 * toward UNMEASURED, never toward BAD"). The underlying record (observedN, scoreValue,
 * vintageDate) is never deleted, decremented, or zeroed by this check; the vintage stamp is
 * exactly what lets a later reader see "this was true on this date" even after the score has
 * stopped gating anything (SPEC Section 4's "unmeasured-but-dated" fourth state). 180 days is a
 * deliberately generous idle window -- long enough that a source already cleared to gate is not
 * punished for a short quiet spell, short enough that a truly stale measurement stops being
 * trusted as current. Decay is evaluated lazily, at read time in resolveSourceWeight() below, not
 * by any background timer that mutates stored records.
 */
export const STALE_AFTER_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * The value CandidateEblet.weight resolves to for any (source, domain) pair with no record, a
 * record below MIN_SAMPLE_SIZE_FOR_GATING, or a record older than STALE_AFTER_MS -- i.e., every
 * pair today, since the ledger starts empty and nothing writes to it yet.
 *
 * `weight` is a required `number` field (not optional) because three files this ticket does not
 * own read it via numeric threshold comparisons that must keep compiling and behaving sanely
 * without being touched: plow_mc_answerer.ts (`c.weight >= MINER_MIN_WEIGHT` at its Miner gate,
 * `b.weight - a.weight` at its Furnace sort), canonical_pipeline.ts (the same Miner-gate/Furnace-
 * sort pair, plus runSaladin()'s own `candidate.weight >= 0.7` / `candidate.weight >= 0.75`
 * heuristic-fallback thresholds), and csia_research.ts (the same Miner-gate pattern). All three
 * import MINER_MIN_WEIGHT = 0.6 from canonical_pipeline.ts.
 *
 * This constant is deliberately set to that same 0.6 -- not imported (canonical_pipeline.ts
 * already imports from this file, so importing back would create a circular module dependency;
 * the literal is duplicated intentionally, with this comment as the tie between them) -- so that
 * "unmeasured" is mathematically guaranteed to clear the Miner content-quality gate (neither
 * privileged nor penalized by it) while ALSO failing runSaladin's higher 0.7/0.75 skip-challenge
 * thresholds. That second effect is an intended, honest consequence, not an oversight: every
 * candidate from every adapter in this file now receives Saladin's full adversarial challenge
 * instead of the automatic pass the old fabricated high weights (0.80-0.90) used to buy it. More
 * scrutiny for an unmeasured source is the safe direction -- "gates nothing" must never be read
 * as "assume good."
 */
export const UNMEASURED_PASSTHROUGH_WEIGHT = 0.6;

/**
 * Resolves the effective CandidateEblet.weight for one (source, domain) pair. Returns the real
 * empirical score only when a record exists, has cleared MIN_SAMPLE_SIZE_FOR_GATING, and is not
 * stale (per STALE_AFTER_MS); otherwise returns UNMEASURED_PASSTHROUGH_WEIGHT. Every adapter
 * function below calls this in place of the hand-typed literal it used to return.
 */
export function resolveSourceWeight(sourceId: string, domainId: string): number {
  const record = sourceCredibilityLedger.get(sourceCredibilityKey(sourceId, domainId));
  if (!record) return UNMEASURED_PASSTHROUGH_WEIGHT;
  if (record.observedN < MIN_SAMPLE_SIZE_FOR_GATING) return UNMEASURED_PASSTHROUGH_WEIGHT;
  const ageMs = Date.now() - Date.parse(record.vintageDate);
  if (!Number.isFinite(ageMs) || ageMs > STALE_AFTER_MS) return UNMEASURED_PASSTHROUGH_WEIGHT;
  return record.scoreValue;
}

/**
 * Records one real, outcome-attributed observation for a (source, domain) pair and returns the
 * updated record. Not called anywhere in this codebase yet -- no consumer currently attributes a
 * scored answer's correctness back to a specific source's claim (SPEC Section 1: per-claim
 * attribution is "currently absent" for both the specialist adapters and the browser
 * authorities). Exported now so the write side of the ledger exists and is ready the moment
 * per-claim attribution lands (KN-BP144-14 Phase 1), rather than being invented twice. A caller
 * that has not yet verified attribution has no business calling this -- recording an observation
 * against the wrong source is worse than recording nothing.
 */
export function recordSourceObservation(
  sourceId: string,
  domainId: string,
  wasCorrect: boolean,
  observedAt: string = new Date().toISOString(),
): SourceCredibilityRecord {
  const key = sourceCredibilityKey(sourceId, domainId);
  const existing = sourceCredibilityLedger.get(key);
  const priorN = existing ? existing.observedN : 0;
  const priorScore = existing ? existing.scoreValue : 0;
  const newN = priorN + 1;
  const newScore = (priorScore * priorN + (wasCorrect ? 1 : 0)) / newN;
  const record: SourceCredibilityRecord = {
    sourceId,
    domainId,
    observedN: newN,
    scoreValue: newScore,
    vintageDate: observedAt,
  };
  sourceCredibilityLedger.set(key, record);
  return record;
}

/** Inspection/test hook only -- not a gating call site. Returns the raw stored record (if any),
 *  with no staleness or minimum-sample resolution applied (that logic lives in
 *  resolveSourceWeight() above). */
export function getSourceCredibilityRecord(sourceId: string, domainId: string): SourceCredibilityRecord | undefined {
  return sourceCredibilityLedger.get(sourceCredibilityKey(sourceId, domainId));
}

// ─── Source Appearance Log (D-BP152-025 scope addition) ────────────────────────
//
// Founder, BP152, verbatim (asking for the Nexus-capture ticket to also feed this ledger):
// "include the reference sources that the answer gives in the filtering once I press capture - to
// add to our sources and start the BM score and rating for each - it has to make a new source if
// not in there already, and add to the existing if it is." Then, on the trap raised back to him
// (a citation appearing in an answer is not evidence it was correct): "Yes agreed sources just
// make an appearance, ... all what you said. The correctness score gets moved only from the
// correct answer traced back to the provenance sources."
//
// THIS IS DELIBERATELY A SEPARATE MAP, NOT A NEW WRITE PATH INTO sourceCredibilityLedger ABOVE.
// recordSourceObservation() (above) unconditionally folds a `wasCorrect` boolean into
// scoreValue/observedN on every call -- there is no way to call it and record "this source merely
// appeared" without moving the correctness mean. Extending THAT function's semantics to accept an
// appearance with no correctness signal was flagged back to the Founder as a fork rather than
// built unilaterally (HARDWIRE-23); his ruling above is what authorizes this section. So: an
// appearance NEVER touches SourceCredibilityRecord, scoreValue, observedN, or
// resolveSourceWeight()'s gating -- confirmed by inspection, nothing below this line reads or
// writes sourceCredibilityLedger.
//
// KEYING NOTE: sourceCredibilityLedger above is keyed by (sourceId, SUBJECT-MATTER domainId) --
// e.g. recordSourceObservationsForClaims()'s `domainId` is the QUESTION's category, not the
// source's own web domain (see `citation:<hostname>` as sourceId there, with a separate subject
// domainId alongside it). A Nexus capture happens at Step 0, before Survey/method selection ever
// classifies a question's subject-matter category (liana_terminal_engine.ts runs Survey/Demand
// Test/selectMethod() AFTER Step 0) -- there is no real subject-matter domain available to key by
// at capture time, and inventing one would be a fabrication. This log is therefore keyed by the
// CITATION'S OWN hostname (the "source" in the Founder's literal sense -- "make a new source if
// not in there already") -- a different, and deliberately separate, axis from the correctness
// ledger's subject-domain keying above.
//
// THE TRACEBACK ITSELF IS NOT BUILT HERE, ON PURPOSE. "Correctness moves only from a KNOWN-CORRECT
// ANSWER, traced back to the provenance sources that answer actually rested on" (Founder ruling,
// same message) is a separate, later mechanism -- this section only records enough on each
// appearance (domain, full URL verbatim, link text, which surface, which run/qid) that a future
// traceback COULD be built from it. No caller anywhere moves scoreValue from an appearance.

/** One raw appearance of a source -- a citation link a Nexus capture found on a page, with
 *  everything a later correctness traceback (out of this ticket's scope, per the Founder's own
 *  ruling above) would need to use it. Recording too little here would make that future trace
 *  impossible to build; this is deliberately the full set the Founder named. */
export interface SourceAppearanceRecord {
  /** The citation's own hostname (e.g. "en.wikipedia.org") -- the keying "domain" for this log,
   *  distinct from sourceCredibilityLedger's subject-matter domainId (see header above). */
  sourceDomain: string;
  /** Full URL, verbatim, untruncated -- never just the hostname. */
  url: string;
  /** The citation link's visible text, verbatim. */
  linkText: string;
  /** Which of the five Nexus surfaces the capture was taken from ('google' | 'perplexity' |
   *  'claude' | 'chatgpt' | 'gemini'), or null if undetermined. */
  surface: string | null;
  /** The raw run input (qid or free text) this capture was attached to. */
  runContext: string;
  /** ISO-8601 timestamp of the capture. */
  capturedAt: string;
}

const sourceAppearanceLog = new Map<string, SourceAppearanceRecord[]>();

/**
 * Records ONE raw appearance, keyed by the citation's own hostname (`appearance.sourceDomain`):
 * creates that domain's appearance list if it does not exist yet, appends to it if it does --
 * exactly the Founder's "make a new source if not in there already, and add to the existing if it
 * is," scoped to appearances only. Returns whether this was a brand-new domain (for the "N new
 * vs. M existing" report the Founder's own ticket asked for) and the domain's running appearance
 * count. NEVER touches sourceCredibilityLedger, scoreValue, or observedN -- see this section's
 * header.
 */
export function recordSourceAppearance(appearance: SourceAppearanceRecord): { isNewDomain: boolean; appearanceCountForDomain: number } {
  const key = appearance.sourceDomain;
  const existing = sourceAppearanceLog.get(key);
  const isNewDomain = !existing;
  const list = existing ? existing.slice() : [];
  list.push(appearance);
  sourceAppearanceLog.set(key, list);
  return { isNewDomain, appearanceCountForDomain: list.length };
}

/** Inspection/test hook -- every appearance recorded so far for one source domain, oldest first. */
export function getSourceAppearances(sourceDomain: string): SourceAppearanceRecord[] {
  return sourceAppearanceLog.get(sourceDomain) ?? [];
}

/**
 * BP149 D-BP149-016 (Founder ruling R1, verbatim: "per-claim attribution" -- "A source earns or
 * loses standing on EACH FACT it supplies, never on the answer the fact fed into. ... the
 * observation record must carry the *claim* as its unit, not the *question*.") and R2 ("Make
 * sure recordSourceObservation() IS wired.").
 *
 * THE SIGNATURE QUESTION THIS TICKET WAS ASKED TO SETTLE: recordSourceObservation() above
 * already takes exactly one (sourceId, domainId, wasCorrect) event per call -- it was never
 * incapable of per-claim granularity, it simply had zero callers. No signature change was
 * needed; what was missing was a caller that loops per CLAIM instead of collapsing to one call
 * per QUESTION. This is that loop: one recordSourceObservation() call per receipt in `receipts`
 * (plow_mc_answerer.ts's ProvenanceReceipt[] -- the codebase's own existing claim unit, one per
 * candidate fact a voter actually saw), rather than a single call keyed on whichever authority
 * "won" the question. A source cited on 4 receipts across 4 questions earns 4 independent
 * (source, domain) observations here, never 1.
 *
 * DISCLOSED LIMITATION, not smoothed over: `wasCorrect` is the graded correctness of the FINAL
 * ANSWER the receipt contributed to, applied per-claim -- this codebase has no independent
 * per-fact truth check (no mechanism verifies "was THIS specific claim, on its own, true"). This
 * is the per-claim ATTRIBUTION unit R1 requires (each source's claim is scored separately from
 * every other source's claim on the same question), but it is not yet per-claim GROUND-TRUTH
 * verification (a source that supplied one correct and one incorrect fact to the SAME correct
 * answer still gets both scored as correct here). Closing that second gap needs a real fact-level
 * verifier, which does not exist anywhere in this repo today -- named as a follow-on, not invented
 * here to avoid it landing as a second half-built mechanism (R5's own defect class).
 *
 * When a receipt carries `citations` (BP149 R4's type-boundary fix -- see
 * BrowserAuthorityLookupResult.citations / ProvenanceReceipt.citations), each citation is ALSO
 * recorded as its own, finer-grained claim under the `citation:<hostname>` sourceId -- this is
 * how an individual citation the scraper collected actually reaches the ledger, not just the
 * coarser adapter/authority-name receipt it was attached to.
 */
export function recordSourceObservationsForClaims(
  receipts: ReadonlyArray<{ source: string; citations?: ReadonlyArray<{ category: string }> }>,
  domainId: string,
  wasCorrect: boolean,
  observedAt?: string,
): SourceCredibilityRecord[] {
  const out: SourceCredibilityRecord[] = [];
  for (const receipt of receipts) {
    out.push(recordSourceObservation(receipt.source, domainId, wasCorrect, observedAt));
    if (receipt.citations) {
      for (const citation of receipt.citations) {
        out.push(recordSourceObservation(`citation:${citation.category}`, domainId, wasCorrect, observedAt));
      }
    }
  }
  return out;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

const ADAPTER_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, opts?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), ADAPTER_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

function stableId(source: string, content: string): string {
  // Simple stable ID without crypto (avoids import complications in renderer context)
  let h = 0x811c9dc5;
  const str = source + ':' + content.slice(0, 120);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function extractSearchTerms(question: string): string {
  // Remove stopwords, keep meaningful terms (max 6 words for API search)
  const stopwords = new Set([
    'what','is','the','a','an','of','in','on','at','to','for','with','and','or',
    'not','be','are','was','were','how','why','when','where','who','which',
    'does','do','did','has','have','had','will','would','could','should',
    'that','this','these','those','there','their','than','then','very',
    'can','may','might','shall','its','it','he','she','they','we','you',
    'if','but','by','from','about','into','through','between','because',
  ]);
  return question
    .replace(/[?.,!;:()[\]{}'"]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w.toLowerCase()))
    .slice(0, 6)
    .join(' ');
}

// ─── 1. Wikipedia ─────────────────────────────────────────────────────────────

export async function fetchWikipedia(question: string, domain: string, maxResults = 2): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    // BP134 Yoke #32 Phase C: srlimit is the server-side result count -- raising ONLY the
    // local slice below without also raising this would be a no-op (Wikipedia never returns
    // more than srlimit hits to slice from). Both move together, gated by the same maxResults
    // caller-supplied cap (default 2 preserves today's live A/B/C behavior exactly).
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(terms)}&srlimit=${Math.max(2, maxResults)}&format=json&origin=*`;
    const searchResp = await fetchWithTimeout(searchUrl);
    if (!searchResp.ok) return [];

    const searchData = await searchResp.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
    const results = searchData?.query?.search ?? [];
    if (results.length === 0) return [];

    const candidates: CandidateEblet[] = [];

    for (const hit of results.slice(0, maxResults)) {
      try {
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`;
        const summaryResp = await fetchWithTimeout(summaryUrl);
        if (!summaryResp.ok) continue;

        const summary = await summaryResp.json() as { extract?: string; content_urls?: { desktop?: { page?: string } } };
        const content = summary.extract ?? '';
        if (content.length < 100) continue;

        candidates.push({
          source: 'wikipedia',
          content: CandidateContent.wrap(content.slice(0, 800)),
          weight: resolveSourceWeight('wikipedia', domain),
          sid: stableId('wikipedia', content),
          provenance_url: summary.content_urls?.desktop?.page,
          domain,
        });
      } catch { /* skip on error */ }
    }

    return candidates;
  } catch { return []; }
}

// ─── 2. Wikidata ──────────────────────────────────────────────────────────────

export async function fetchWikidata(question: string, domain: string, maxResults = 2): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    // BP134 Yoke #32 Phase C: same request-limit/local-slice pairing as fetchWikipedia above --
    // the request limit must rise with maxResults or the local slice has nothing extra to take.
    const requestLimit = Math.max(3, maxResults);
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(terms)}&language=en&limit=${requestLimit}&format=json&origin=*`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as { search?: Array<{ label?: string; description?: string; url?: string }> };
    const results = data?.search ?? [];

    return results
      .filter((r) => r.description && r.description.length >= 30)
      .slice(0, maxResults)
      .map((r) => {
        const content = `${r.label ?? ''}: ${r.description ?? ''}`;
        return {
          source: 'wikidata',
          content: CandidateContent.wrap(content.length >= 100 ? content : content + ' (Wikidata entity)'),
          weight: resolveSourceWeight('wikidata', domain),
          sid: stableId('wikidata', content),
          provenance_url: r.url,
          domain,
        };
      })
      .filter((c) => c.content.unwrap('LOG').length >= 100);
  } catch { return []; }
}

// ─── 3. StackExchange ─────────────────────────────────────────────────────────

export async function fetchStackExchange(
  question: string,
  domain: string,
  apiKey?: string,
): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  const site = ['computer_science', 'math', 'engineering', 'physics'].includes(domain)
    ? 'stackoverflow' : 'stackexchange';

  try {
    const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';
    const url = `https://api.stackexchange.com/2.3/search?site=${site}&intitle=${encodeURIComponent(terms)}&pagesize=3&filter=withbody${keyParam}`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as { items?: Array<{ title?: string; body?: string; link?: string; score?: number }> };
    const items = data?.items ?? [];

    return items
      .filter((item) => (item.score ?? 0) >= 0)
      .slice(0, 2)
      .map((item) => {
        const rawBody = (item.body ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const content = `${item.title ?? ''}: ${rawBody.slice(0, 600)}`;
        return {
          source: 'stackexchange',
          content: CandidateContent.wrap(content.slice(0, 700)),
          weight: resolveSourceWeight('stackexchange', domain),
          sid: stableId('stackexchange', content),
          provenance_url: item.link,
          domain,
        };
      })
      .filter((c) => c.content.unwrap('LOG').length >= 100);
  } catch { return []; }
}

// ─── 4. arXiv ─────────────────────────────────────────────────────────────────

export async function fetchArxiv(question: string, domain: string): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(terms)}&max_results=3&sortBy=relevance`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const xml = await resp.text();

    // Parse entries from Atom XML
    const entries: CandidateEblet[] = [];
    const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
    for (const match of entryMatches) {
      const entry = match[1];
      const title = (/<title>([\s\S]*?)<\/title>/.exec(entry))?.[1]?.trim() ?? '';
      const summary = (/<summary>([\s\S]*?)<\/summary>/.exec(entry))?.[1]?.trim() ?? '';
      const link = (/<id>([\s\S]*?)<\/id>/.exec(entry))?.[1]?.trim() ?? '';

      if (!summary || summary.length < 80) continue;

      const content = `${title}: ${summary}`.slice(0, 800);
      if (content.length < 100) continue;

      entries.push({
        source: 'arxiv',
        content: CandidateContent.wrap(content),
        weight: resolveSourceWeight('arxiv', domain),
        sid: stableId('arxiv', content),
        provenance_url: link,
        domain,
      });

      if (entries.length >= 2) break;
    }

    return entries;
  } catch { return []; }
}

// ─── 5. Wolfram Alpha ─────────────────────────────────────────────────────────

export async function fetchWolframAlpha(
  question: string,
  domain: string,
  apiKey?: string,
): Promise<CandidateEblet[]> {
  if (!apiKey) return [];

  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://api.wolframalpha.com/v2/query?input=${encodeURIComponent(terms)}&format=plaintext&output=JSON&appid=${encodeURIComponent(apiKey)}`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as { queryresult?: { pods?: Array<{ title?: string; subpods?: Array<{ plaintext?: string }> }> } };
    const pods = data?.queryresult?.pods ?? [];

    const snippets: string[] = [];
    for (const pod of pods.slice(0, 4)) {
      const podTitle = pod.title ?? '';
      for (const sub of pod.subpods ?? []) {
        const txt = sub.plaintext?.trim() ?? '';
        if (txt && txt.length >= 20) {
          snippets.push(`${podTitle}: ${txt}`);
        }
      }
    }

    if (snippets.length === 0) return [];

    const content = snippets.join(' | ').slice(0, 800);
    if (content.length < 100) return [];

    return [{
      source: 'wolfram',
      content: CandidateContent.wrap(content),
      weight: resolveSourceWeight('wolfram', domain),
      sid: stableId('wolfram', content),
      domain,
    }];
  } catch { return []; }
}

// ─── 6. OpenAlex ──────────────────────────────────────────────────────────────

export async function fetchOpenAlex(question: string, domain: string): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(terms)}&per-page=3&select=title,abstract_inverted_index,doi&mailto=support@lianabanyan.com`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as { results?: Array<{ title?: string; abstract_inverted_index?: Record<string, number[]>; doi?: string }> };
    const results = data?.results ?? [];

    const candidates: CandidateEblet[] = [];
    for (const work of results.slice(0, 2)) {
      const title = work.title ?? '';

      // Reconstruct abstract from inverted index
      let abstract = '';
      if (work.abstract_inverted_index) {
        const posMap: Array<[number, string]> = [];
        for (const [word, positions] of Object.entries(work.abstract_inverted_index)) {
          for (const pos of positions) {
            posMap.push([pos, word]);
          }
        }
        posMap.sort((a, b) => a[0] - b[0]);
        abstract = posMap.map((p) => p[1]).join(' ');
      }

      const content = abstract
        ? `${title}: ${abstract}`.slice(0, 700)
        : title.length >= 100 ? title : '';

      if (content.length < 100) continue;

      candidates.push({
        source: 'openalex',
        content: CandidateContent.wrap(content),
        weight: resolveSourceWeight('openalex', domain),
        sid: stableId('openalex', content),
        provenance_url: work.doi ? `https://doi.org/${work.doi}` : undefined,
        domain,
      });
    }

    return candidates;
  } catch { return []; }
}

// ─── 7. NIST ──────────────────────────────────────────────────────────────────

export async function fetchNIST(question: string, domain: string): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    // NIST NVLPUBS search (broad technical reference)
    const url = `https://nvlpubs.nist.gov/nistpubs/search/?sType=combined&query=${encodeURIComponent(terms)}&rows=3&format=json`;
    const resp = await fetchWithTimeout(url);

    if (resp.ok) {
      const data = await resp.json() as { docs?: Array<{ title?: string; abstract?: string; doi?: string }> };
      const docs = data?.docs ?? [];
      const candidates: CandidateEblet[] = [];

      for (const doc of docs.slice(0, 2)) {
        const content = `${doc.title ?? ''}: ${doc.abstract ?? ''}`.slice(0, 700);
        if (content.length < 100) continue;
        candidates.push({
          source: 'nist',
          content: CandidateContent.wrap(content),
          weight: resolveSourceWeight('nist', domain),
          sid: stableId('nist', content),
          provenance_url: doc.doi ? `https://doi.org/${doc.doi}` : undefined,
          domain,
        });
      }

      if (candidates.length > 0) return candidates;
    }

    // Fallback: NIST WebBook for chemistry/physics constants
    if (['chemistry', 'physics', 'engineering'].includes(domain)) {
      const wbUrl = `https://webbook.nist.gov/cgi/cbook.cgi?Name=${encodeURIComponent(terms.split(' ')[0])}&Units=SI&cTG=on&cSA=on&sType=Name`;
      const wbResp = await fetchWithTimeout(wbUrl);
      if (wbResp.ok) {
        const html = await wbResp.text();
        const titleMatch = /<title>(.*?)<\/title>/i.exec(html);
        const descMatch = /<p[^>]*>([^<]{80,400})<\/p>/i.exec(html);
        if (titleMatch && descMatch) {
          const content = `NIST WebBook: ${titleMatch[1].replace(' - NIST WebBook', '').trim()}: ${descMatch[1].trim()}`.slice(0, 600);
          if (content.length >= 100) {
            return [{
              source: 'nist',
              content: CandidateContent.wrap(content),
              weight: resolveSourceWeight('nist', domain),
              sid: stableId('nist_webbook', content),
              provenance_url: wbUrl,
              domain,
            }];
          }
        }
      }
    }

    return [];
  } catch { return []; }
}

// ─── 8. PubMed ────────────────────────────────────────────────────────────────

export async function fetchPubMed(
  question: string,
  domain: string,
  apiKey?: string,
): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const keyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';

    // Step 1: search for PMIDs
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(terms)}&retmax=3&retmode=json${keyParam}`;
    const searchResp = await fetchWithTimeout(searchUrl);
    if (!searchResp.ok) return [];

    const searchData = await searchResp.json() as { esearchresult?: { idlist?: string[] } };
    const ids = searchData?.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];

    // Step 2: fetch summaries
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.slice(0, 2).join(',')}&retmode=json${keyParam}`;
    const summaryResp = await fetchWithTimeout(summaryUrl);
    if (!summaryResp.ok) return [];

    const summaryData = await summaryResp.json() as { result?: Record<string, { title?: string; source?: string; pubdate?: string }> };
    const resultMap = summaryData?.result ?? {};

    const candidates: CandidateEblet[] = [];
    for (const id of ids.slice(0, 2)) {
      const item = resultMap[id];
      if (!item?.title) continue;
      const content = `PubMed (${item.pubdate ?? ''}): ${item.title}. Source: ${item.source ?? 'Journal'}`.slice(0, 600);
      if (content.length < 100) continue;
      candidates.push({
        source: 'pubmed',
        content: CandidateContent.wrap(content),
        weight: resolveSourceWeight('pubmed', domain),
        sid: stableId('pubmed', content),
        provenance_url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        domain,
      });
    }

    return candidates;
  } catch { return []; }
}

// ─── 9. Common Crawl ──────────────────────────────────────────────────────────

export async function fetchCommonCrawl(question: string, domain: string): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    // Use the CDX API to search for crawled content about the topic
    // We use the latest CC-MAIN index via the CDX server
    const ccQuery = encodeURIComponent(terms.replace(/\s+/g, '+'));
    const cdxUrl = `https://index.commoncrawl.org/CC-MAIN-2024-10-index?url=*${ccQuery}*&output=json&limit=3&filter=status:200`;
    const resp = await fetchWithTimeout(cdxUrl);

    if (resp.ok) {
      const text = await resp.text();
      const lines = text.trim().split('\n').filter(Boolean);
      const candidates: CandidateEblet[] = [];

      for (const line of lines.slice(0, 2)) {
        try {
          const entry = JSON.parse(line) as { url?: string; filename?: string; offset?: string; length?: string };
          if (!entry.url) continue;

          // Build a meaningful content snippet from the CDX metadata
          const content = `Common Crawl index: URL ${entry.url} was crawled in CC-MAIN-2024-10, confirming this is a publicly documented topic related to ${terms}.`;
          if (content.length < 100) continue;

          candidates.push({
            source: 'commoncrawl',
            content: CandidateContent.wrap(content),
            weight: resolveSourceWeight('commoncrawl', domain),
            sid: stableId('commoncrawl', entry.url),
            provenance_url: entry.url,
            domain,
          });
        } catch { continue; }
      }

      if (candidates.length > 0) return candidates;
    }

    // Fallback: search via Bing Web Search (CDX not great for keyword queries)
    // Use a simple DuckDuckGo instant answer fallback
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(terms)}&format=json&no_html=1&skip_disambig=1`;
    const ddgResp = await fetchWithTimeout(ddgUrl);
    if (ddgResp.ok) {
      const ddg = await ddgResp.json() as { AbstractText?: string; AbstractURL?: string; RelatedTopics?: Array<{ Text?: string; FirstURL?: string }> };
      const abstract = ddg.AbstractText ?? '';
      if (abstract.length >= 100) {
        return [{
          source: 'commoncrawl',
          content: CandidateContent.wrap(abstract.slice(0, 700)),
          weight: resolveSourceWeight('commoncrawl', domain),
          sid: stableId('duckduckgo', abstract),
          provenance_url: ddg.AbstractURL,
          domain,
        }];
      }

      const related = ddg.RelatedTopics ?? [];
      for (const topic of related.slice(0, 2)) {
        const text = topic.Text ?? '';
        if (text.length >= 100) {
          return [{
            source: 'commoncrawl',
            content: CandidateContent.wrap(text.slice(0, 600)),
            weight: resolveSourceWeight('commoncrawl', domain),
            sid: stableId('duckduckgo', text),
            provenance_url: topic.FirstURL,
            domain,
          }];
        }
      }
    }

    return [];
  } catch { return []; }
}

// ─── 10. Europe PMC ───────────────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 1: no-key REST adapter, medicine/biology.
// Probed live 2026-07-31: https://www.ebi.ac.uk/europepmc/webservices/rest/search
// with resultType=core returns resultList.result[] items carrying abstractText
// (HTML-tagged, e.g. <h4>Background</h4>...) -- resultType=lite (the endpoint
// default) omits abstractText entirely, so core is required for usable content.

export async function fetchEuropePMC(question: string, domain: string, maxResults = 2): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(terms)}&format=json&resultType=core&pageSize=${Math.max(3, maxResults)}`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as {
      resultList?: { result?: Array<{ title?: string; abstractText?: string; doi?: string; pmid?: string }> };
    };
    const results = data?.resultList?.result ?? [];
    if (results.length === 0) return [];

    const candidates: CandidateEblet[] = [];
    for (const r of results.slice(0, maxResults)) {
      const title = r.title ?? '';
      const abstract = (r.abstractText ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const content = (abstract ? `${title}: ${abstract}` : title).slice(0, 800);
      if (content.length < 100) continue;

      candidates.push({
        source: 'europepmc',
        content: CandidateContent.wrap(content),
        weight: resolveSourceWeight('europepmc', domain),
        sid: stableId('europepmc', content),
        provenance_url: r.doi ? `https://doi.org/${r.doi}` : (r.pmid ? `https://europepmc.org/article/MED/${r.pmid}` : undefined),
        domain,
      });
    }

    return candidates;
  } catch { return []; }
}

// ─── 11. openFDA ──────────────────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 1: no-key REST adapter, drug/device safety.
// Probed live 2026-07-31: https://api.fda.gov/drug/label.json works with no key
// (the FDA-issued key only raises the rate limit). results[] items carry SPL
// label sections (indications_and_usage[], warnings_and_cautions[],
// boxed_warning[]) plus an openfda{} sub-object with brand_name/generic_name.

export async function fetchOpenFDA(question: string, domain: string, maxResults = 2): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(terms)}&limit=${Math.max(3, maxResults)}`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as {
      results?: Array<{
        openfda?: { brand_name?: string[]; generic_name?: string[] };
        indications_and_usage?: string[];
        warnings_and_cautions?: string[];
        boxed_warning?: string[];
        set_id?: string;
      }>;
    };
    const results = data?.results ?? [];
    if (results.length === 0) return [];

    const candidates: CandidateEblet[] = [];
    for (const r of results.slice(0, maxResults)) {
      const name = r.openfda?.brand_name?.[0] ?? r.openfda?.generic_name?.[0] ?? '';
      const body = (r.indications_and_usage?.[0] ?? r.warnings_and_cautions?.[0] ?? r.boxed_warning?.[0] ?? '').trim();
      if (!body) continue;

      const content = `${name ? name + ': ' : ''}${body}`.slice(0, 800);
      if (content.length < 100) continue;

      candidates.push({
        source: 'openfda',
        content: CandidateContent.wrap(content),
        weight: resolveSourceWeight('openfda', domain),
        sid: stableId('openfda', content),
        provenance_url: r.set_id ? `https://api.fda.gov/drug/label.json?search=set_id:${r.set_id}` : undefined,
        domain,
      });
    }

    return candidates;
  } catch { return []; }
}

// ─── 12. MedlinePlus ──────────────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 1: no-key REST adapter, health.
// Probed live 2026-07-31: https://wsearch.nlm.nih.gov/ws/query?db=healthTopics
// returns XML (not JSON) -- <document url="..."><content name="title">...
// </content><content name="FullSummary">...</content></document> per hit, with
// HTML-entity-escaped inner markup (e.g. &lt;span class="qt0"&gt;) that must be
// decoded before tag-stripping.

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export async function fetchMedlinePlus(question: string, domain: string, maxResults = 2): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${encodeURIComponent(terms)}&retmax=${Math.max(3, maxResults)}`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const xml = await resp.text();
    const candidates: CandidateEblet[] = [];
    const docMatches = xml.matchAll(/<document[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/document>/g);

    for (const match of docMatches) {
      const docUrl = match[1];
      const body = match[2];
      const titleMatch = /<content name="title">([\s\S]*?)<\/content>/.exec(body);
      const summaryMatch = /<content name="FullSummary">([\s\S]*?)<\/content>/.exec(body);

      const title = decodeXmlEntities(titleMatch?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
      const summary = decodeXmlEntities(summaryMatch?.[1] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!summary || summary.length < 60) continue;

      const content = `${title}: ${summary}`.slice(0, 800);
      if (content.length < 100) continue;

      candidates.push({
        source: 'medlineplus',
        content: CandidateContent.wrap(content),
        weight: resolveSourceWeight('medlineplus', domain),
        sid: stableId('medlineplus', content),
        provenance_url: docUrl,
        domain,
      });

      if (candidates.length >= maxResults) break;
    }

    return candidates;
  } catch { return []; }
}

// ─── 13. Crossref ─────────────────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 1: no-key REST adapter, scholarly metadata
// across all domains. Probed live 2026-07-31: https://api.crossref.org/works
// with mailto= (polite pool, still no key/auth) returns message.items[] with
// title[]/container-title[]/abstract (JATS-tagged, often absent)/DOI/URL.

export async function fetchCrossref(question: string, domain: string, maxResults = 2): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(terms)}&rows=${Math.max(3, maxResults)}&mailto=Social@lianabanyan.com`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as {
      message?: { items?: Array<{ title?: string[]; 'container-title'?: string[]; abstract?: string; DOI?: string; URL?: string }> };
    };
    const items = data?.message?.items ?? [];
    if (items.length === 0) return [];

    const candidates: CandidateEblet[] = [];
    for (const item of items.slice(0, maxResults)) {
      const title = item.title?.[0] ?? '';
      const container = item['container-title']?.[0] ?? '';
      const abstract = (item.abstract ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const content = (abstract ? `${title}: ${abstract}` : (container ? `${title} (${container})` : title)).slice(0, 800);
      if (content.length < 100) continue;

      candidates.push({
        source: 'crossref',
        content: CandidateContent.wrap(content),
        weight: resolveSourceWeight('crossref', domain),
        sid: stableId('crossref', content),
        provenance_url: item.DOI ? `https://doi.org/${item.DOI}` : item.URL,
        domain,
      });
    }

    return candidates;
  } catch { return []; }
}

// ─── 14. ClinicalTrials.gov ───────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 2: no-key REST adapter, medicine/health.
// Probed live 2026-07-31: https://clinicaltrials.gov/api/v2/studies?query.term=...
// (v2 API -- the classic v1 /api/query API was retired) returns HTTP 200 with
// studies[] items carrying protocolSection.identificationModule.{nctId,briefTitle},
// .descriptionModule.briefSummary, .statusModule.overallStatus,
// .conditionsModule.conditions[].

export async function fetchClinicalTrials(question: string, domain: string, maxResults = 2): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(terms)}&pageSize=${Math.max(3, maxResults)}`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as {
      studies?: Array<{
        protocolSection?: {
          identificationModule?: { nctId?: string; briefTitle?: string };
          descriptionModule?: { briefSummary?: string };
          statusModule?: { overallStatus?: string };
          conditionsModule?: { conditions?: string[] };
        };
      }>;
    };
    const studies = data?.studies ?? [];
    if (studies.length === 0) return [];

    const candidates: CandidateEblet[] = [];
    for (const s of studies.slice(0, maxResults)) {
      const ps = s.protocolSection;
      const nctId = ps?.identificationModule?.nctId;
      const title = ps?.identificationModule?.briefTitle ?? '';
      const summary = (ps?.descriptionModule?.briefSummary ?? '').replace(/\s+/g, ' ').trim();
      const status = ps?.statusModule?.overallStatus ?? '';
      const conditions = (ps?.conditionsModule?.conditions ?? []).join(', ');

      const body = summary || conditions;
      if (!body) continue;
      const content = `${title}${status ? ` (${status})` : ''}: ${body}`.slice(0, 800);
      if (content.length < 100) continue;

      candidates.push({
        source: 'clinicaltrials',
        content: CandidateContent.wrap(content),
        weight: resolveSourceWeight('clinicaltrials', domain),
        sid: stableId('clinicaltrials', content),
        provenance_url: nctId ? `https://clinicaltrials.gov/study/${nctId}` : undefined,
        domain,
      });
    }

    return candidates;
  } catch { return []; }
}

// ─── 15. World Bank Indicators ────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 2: no-key REST adapter, economics/business.
// Probed live 2026-07-31: https://api.worldbank.org/v2/country/WLD/indicator/<code>
// ?format=json&mrv=1 returns HTTP 200 with a [meta, rows[]] tuple; rows[0] carries
// {indicator:{id,value}, country:{id,value}, countryiso3code, date, value}. The
// World Bank Indicators API has no free-text search over indicator content (only
// exact indicator codes / dataset browsing), so this adapter maps a curated set of
// common economics keywords found in the question to a known indicator code
// (defaulting to the World aggregate, most-recent-value via mrv=1) instead of
// attempting arbitrary full-text search. Returns [] (honest no-op) when no
// keyword in the question matches the curated table.

const WORLD_BANK_INDICATORS: Array<{ keywords: string[]; code: string; label: string }> = [
  { keywords: ['gdp', 'gross domestic product'], code: 'NY.GDP.MKTP.CD', label: 'GDP (current US$)' },
  { keywords: ['inflation', 'consumer price', 'cpi'], code: 'FP.CPI.TOTL.ZG', label: 'Inflation, consumer prices (annual %)' },
  { keywords: ['unemployment'], code: 'SL.UEM.TOTL.ZS', label: 'Unemployment, total (% of total labor force)' },
  { keywords: ['population'], code: 'SP.POP.TOTL', label: 'Population, total' },
  { keywords: ['life expectancy'], code: 'SP.DYN.LE00.IN', label: 'Life expectancy at birth, total (years)' },
  { keywords: ['export'], code: 'NE.EXP.GNFS.CD', label: 'Exports of goods and services (current US$)' },
  { keywords: ['import'], code: 'NE.IMP.GNFS.CD', label: 'Imports of goods and services (current US$)' },
  { keywords: ['government debt', 'national debt', 'public debt'], code: 'GC.DOD.TOTL.GD.ZS', label: 'Central government debt, total (% of GDP)' },
  { keywords: ['poverty'], code: 'SI.POV.DDAY', label: 'Poverty headcount ratio at $2.15 a day (% of population)' },
  { keywords: ['interest rate'], code: 'FR.INR.RINR', label: 'Real interest rate (%)' },
  { keywords: ['trade'], code: 'NE.TRD.GNFS.ZS', label: 'Trade (% of GDP)' },
  { keywords: ['foreign direct investment', 'fdi'], code: 'BX.KLT.DINV.WD.GD.ZS', label: 'Foreign direct investment, net inflows (% of GDP)' },
];

const WORLD_BANK_COUNTRIES: Array<{ keywords: string[]; code: string; name: string }> = [
  { keywords: ['united states', 'u.s.', 'usa', 'america'], code: 'US', name: 'United States' },
  { keywords: ['china'], code: 'CN', name: 'China' },
  { keywords: ['india'], code: 'IN', name: 'India' },
  { keywords: ['japan'], code: 'JP', name: 'Japan' },
  { keywords: ['germany'], code: 'DE', name: 'Germany' },
  { keywords: ['united kingdom', 'britain', 'u.k.'], code: 'GB', name: 'United Kingdom' },
  { keywords: ['world'], code: 'WLD', name: 'World' },
];

export async function fetchWorldBank(question: string, domain: string): Promise<CandidateEblet[]> {
  const qLower = question.toLowerCase();
  const indicator = WORLD_BANK_INDICATORS.find((i) => i.keywords.some((k) => qLower.includes(k)));
  if (!indicator) return [];

  const country = WORLD_BANK_COUNTRIES.find((c) => c.keywords.some((k) => qLower.includes(k)))
    ?? { keywords: [], code: 'WLD', name: 'World' };

  try {
    const url = `https://api.worldbank.org/v2/country/${country.code}/indicator/${indicator.code}?format=json&mrv=1`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as unknown as [unknown, Array<{ value?: number | null; date?: string; country?: { value?: string } }> | null];
    const rows = data?.[1] ?? [];
    const row = rows[0];
    if (!row || row.value === null || row.value === undefined) return [];

    const countryName = row.country?.value ?? country.name;
    const content = `${indicator.label} — ${countryName}, ${row.date}: ${row.value} (World Bank Indicators, World Development Indicators source).`.slice(0, 500);
    if (content.length < 100) return [];

    return [{
      source: 'worldbank',
      content: CandidateContent.wrap(content),
      weight: resolveSourceWeight('worldbank', domain),
      sid: stableId('worldbank', content),
      provenance_url: `https://data.worldbank.org/indicator/${indicator.code}?locations=${country.code}`,
      domain,
    }];
  } catch { return []; }
}

// ─── 16. Semantic Scholar Graph API ────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 2: keyless REST adapter (works without a key at
// a lower shared rate limit), broad multi-disciplinary scholarly coverage.
// Probed live 2026-07-31: https://api.semanticscholar.org/graph/v1/paper/search
// ?query=...&fields=title,abstract,url -- first burst attempt returned HTTP 429
// (shared keyless quota), retry after backoff returned HTTP 200 with
// { data: [{ paperId, title, abstract, url }] }. A 429 is treated the same as any
// other non-ok response here (silent []); the plow's staggered per-question
// dispatch already spaces adapter calls, and no key is available to raise the quota.

export async function fetchSemanticScholar(question: string, domain: string, maxResults = 2): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(terms)}&limit=${Math.max(3, maxResults)}&fields=title,abstract,url`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as { data?: Array<{ title?: string; abstract?: string; url?: string }> };
    const results = data?.data ?? [];
    if (results.length === 0) return [];

    const candidates: CandidateEblet[] = [];
    for (const r of results.slice(0, maxResults)) {
      const title = r.title ?? '';
      const abstract = (r.abstract ?? '').replace(/\s+/g, ' ').trim();
      const content = (abstract ? `${title}: ${abstract}` : title).slice(0, 800);
      if (content.length < 100) continue;

      candidates.push({
        source: 'semanticscholar',
        content: CandidateContent.wrap(content),
        weight: resolveSourceWeight('semanticscholar', domain),
        sid: stableId('semanticscholar', content),
        provenance_url: r.url,
        domain,
      });
    }

    return candidates;
  } catch { return []; }
}

// ─── DEFERRED: OECD Data Explorer (SDMX) ───────────────────────────────────────
// BP1xx Pawn Authority List Phase 2: probed live 2026-07-31 --
// https://sdmx.oecd.org/public/rest/data/OECD.SDD.NAD,DSD_NAMAIN1@DF_QNA,1.0/all
// ?startPeriod=2023&dimensionAtObservation=AllDimensions&format=jsondata returns
// HTTP 200, but the SDMX-JSON "data cube" keys observations by a composite,
// colon-joined index string (e.g. "0:1:4:0:0:1:0:13:0:0:1:0:0:0") against a
// 14-dimension observation structure (FREQ, ADJUSTMENT, REF_AREA, SECTOR,
// COUNTERPART_SECTOR, TRANSACTION, INSTR_ASSET, ACTIVITY, EXPENDITURE,
// UNIT_MEASURE, PRICE_BASE, TRANSFORMATION, TABLE_IDENTIFIER, TIME_PERIOD) whose
// per-dimension code lists must be separately resolved from the DSD/dataflow
// structure query before a single numeric observation can be decoded. There is
// no keyword/full-text query surface that maps a natural-language question to a
// specific dataflow + 14-tuple of dimension codes -- every dataflow needs its own
// hand-built dimension map. Per the build brief ("if a clean query is hard,
// DEFER it honestly rather than shipping a non-returning adapter"), OECD is
// deferred here: no fetchOECD function, no SpecialistName entry, no roster wiring.
// A future build could hand-curate a small number of (dataflow, dimension-tuple)
// pairs for specific well-known series (e.g. quarterly GDP growth per country)
// the same way WORLD_BANK_INDICATORS above curates World Bank indicator codes.

// ─── Exported adapter registry ─────────────────────────────────────────────────

export type SpecialistName =
  | 'wikipedia' | 'wikidata' | 'stackexchange' | 'arxiv'
  | 'wolfram' | 'openalex' | 'nist' | 'pubmed' | 'commoncrawl'
  | 'europepmc' | 'openfda' | 'medlineplus' | 'crossref'
  | 'clinicaltrials' | 'worldbank' | 'semanticscholar';

export interface SpecialistKeys {
  wolframApiKey?: string;
  stackExchangeKey?: string;
  pubmedApiKey?: string;
  /** BP134 Yoke #32 Phase C: field-sowing deep-harvest override for the two adapters whose
   *  caps this Yoke raises (wikipedia, wikidata). Undefined -- the live A/B/C button's default
   *  path -- preserves today's behavior exactly (each adapter's own `= 2` default applies). */
  maxResultsPerAdapter?: number;
}

export type SpecialistFn = (q: string, domain: string, keys?: SpecialistKeys) => Promise<CandidateEblet[]>;

export const SPECIALIST_REGISTRY: Record<SpecialistName, SpecialistFn> = {
  wikipedia:    (q, d, k) => fetchWikipedia(q, d, k?.maxResultsPerAdapter),
  wikidata:     (q, d, k) => fetchWikidata(q, d, k?.maxResultsPerAdapter),
  stackexchange:(q, d, k) => fetchStackExchange(q, d, k?.stackExchangeKey),
  arxiv:        (q, d) => fetchArxiv(q, d),
  wolfram:      (q, d, k) => fetchWolframAlpha(q, d, k?.wolframApiKey),
  openalex:     (q, d) => fetchOpenAlex(q, d),
  nist:         (q, d) => fetchNIST(q, d),
  pubmed:       (q, d, k) => fetchPubMed(q, d, k?.pubmedApiKey),
  commoncrawl:  (q, d) => fetchCommonCrawl(q, d),
  europepmc:    (q, d, k) => fetchEuropePMC(q, d, k?.maxResultsPerAdapter),
  openfda:      (q, d, k) => fetchOpenFDA(q, d, k?.maxResultsPerAdapter),
  medlineplus:  (q, d, k) => fetchMedlinePlus(q, d, k?.maxResultsPerAdapter),
  crossref:     (q, d, k) => fetchCrossref(q, d, k?.maxResultsPerAdapter),
  clinicaltrials:  (q, d, k) => fetchClinicalTrials(q, d, k?.maxResultsPerAdapter),
  worldbank:       (q, d) => fetchWorldBank(q, d),
  semanticscholar: (q, d, k) => fetchSemanticScholar(q, d, k?.maxResultsPerAdapter),
};

// ─── Tier metadata (Phase 1 seed of the Standard/Premium authority registry) ───
// BP1xx Pawn Authority List Phase 1: additive-only classification layer over
// SPECIALIST_REGISTRY. Purely descriptive -- no caller reads this yet, so adding
// it changes zero runtime dispatch behavior. "premium" here means the adapter is
// a no-op without a paid/keyed credential (only wolfram, today); adapters that
// merely accept an OPTIONAL key for a higher rate limit (stackexchange, pubmed)
// are still "standard" since they return real candidates with zero keys configured.
// Membership-orthogonal: this Standard/Premium split classifies external data-source
// API keys, not LB membership tiers -- $5/year membership unchanged, pricing identical
// for all members; no member-facing cost is introduced or implied by this map.

export type SpecialistTier = 'standard' | 'premium';

export interface SpecialistMetadata {
  tier: SpecialistTier;
  domains: string[];
  costNote: string;
}

export const SPECIALIST_METADATA: Record<SpecialistName, SpecialistMetadata> = {
  wikipedia:     { tier: 'standard', domains: ['general', 'history', 'philosophy', 'law', 'business', 'economics', 'other'], costNote: 'Free, no key required.' },
  wikidata:      { tier: 'standard', domains: ['general', 'history', 'philosophy', 'law', 'business', 'economics', 'other'], costNote: 'Free, no key required.' },
  stackexchange: { tier: 'standard', domains: ['computer_science', 'math', 'engineering', 'physics', 'business', 'economics'], costNote: 'Free without key; optional key raises the daily quota.' },
  arxiv:         { tier: 'standard', domains: ['math', 'physics', 'computer_science', 'engineering', 'biology', 'psychology'], costNote: 'Free, no key, no enforced rate limit.' },
  wolfram:       { tier: 'premium', domains: ['math', 'physics', 'chemistry', 'engineering'], costNote: 'Requires a Wolfram Alpha AppID (free-tier signup exists); no-op with no key.' },
  openalex:      { tier: 'standard', domains: ['general', 'biology', 'health', 'psychology'], costNote: 'Free, no key; mailto param opts into the polite pool.' },
  nist:          { tier: 'standard', domains: ['physics', 'chemistry', 'engineering'], costNote: 'Free, no key required.' },
  pubmed:        { tier: 'standard', domains: ['biology', 'chemistry', 'psychology', 'health'], costNote: 'Free without key; optional NCBI API key raises the rate limit.' },
  commoncrawl:   { tier: 'standard', domains: ['general'], costNote: 'Free, no key; DuckDuckGo fallback also free/no key.' },
  europepmc:     { tier: 'standard', domains: ['biology', 'health', 'chemistry'], costNote: 'Free, no key required (Europe PMC REST API).' },
  openfda:       { tier: 'standard', domains: ['health'], costNote: 'Free, no key required (openFDA public API; FDA-issued key only raises rate limit).' },
  medlineplus:   { tier: 'standard', domains: ['health'], costNote: 'Free, no key required (NLM Web Search Service, XML response).' },
  crossref:      { tier: 'standard', domains: ['general', 'history', 'philosophy', 'law', 'business', 'economics', 'psychology', 'biology', 'health', 'math', 'physics', 'chemistry', 'computer_science', 'engineering', 'other'], costNote: 'Free, no key; mailto param opts into the Crossref polite pool.' },
  clinicaltrials:  { tier: 'standard', domains: ['health'], costNote: 'Free, no key required (ClinicalTrials.gov API v2; the classic v1 API was retired).' },
  worldbank:       { tier: 'standard', domains: ['economics', 'business'], costNote: 'Free, no key required (World Bank Indicators API; curated keyword-to-indicator lookup, not full-text search).' },
  semanticscholar: { tier: 'standard', domains: ['computer_science', 'economics', 'philosophy', 'law', 'biology', 'math', 'physics', 'chemistry', 'engineering', 'psychology', 'health', 'business', 'history'], costNote: 'Free without key; keyless calls share a lower rate limit (observed HTTP 429 under burst, recovers on backoff).' },
};

// ─── Authority enable/disable resolution (BP139 Phase 2) ───────────────────────
// Founder directive (canon BP139): every source has a user toggle; STANDARD sources
// default ON; PREMIUM/paid sources default OFF and opt-in; the plow consults a
// source ONLY if enabled.
//
// isAuthorityEnabled() is the pure resolver (no I/O, fully unit-testable): an
// explicit user override always wins; absent that, the default is tier-driven
// (standard -> true, premium -> false). Today only `wolfram` is premium, so this
// is the only specialist whose default flips; every other pre-existing specialist
// (all tier: 'standard') keeps firing exactly as before.
//
// readAuthorityEnableOverridesFromSettings() is the settings-READ hook. It does not
// invent a new settings file: it reads the SAME ai_dispatch_settings.json that
// ai_dispatch_ipc.ts's loadSettings()/saveSettings() already own (userData dir),
// under the SAME `mnem_drt_specialists` key SettingsTab.tsx already writes to for
// 4 of the 13 names (wikipedia/wikidata/arxiv/wolfram). Because the file is plain
// JSON (no runtime schema enforcement), reading it here as
// Partial<Record<SpecialistName, boolean>> already supports overrides for all 13
// names the moment something writes them -- no settings-file/shape change needed.
//
// TODO (renderer toggle UI): src/renderer/components/SettingsTab.tsx (~lines
// 908-1066, the `mnem_drt_specialists` block + updateSpecialist()/checkbox JSX)
// only renders checkboxes for wikipedia/wikidata/arxiv/wolfram today. Extending
// that same UI section to the other 9 SpecialistName keys (europepmc, openfda,
// medlineplus, crossref, stackexchange, nist, pubmed, commoncrawl, openalex) --
// still writing into the same `mnem_drt_specialists` object via the existing
// ai-dispatch:save-settings IPC round-trip -- is the only remaining wiring for a
// user to flip these from the app. Not built here; out of this build's scope.

export type AuthorityEnableOverrides = Partial<Record<SpecialistName, boolean>>;

/** Pure resolver: explicit override wins, else default-by-tier (standard=on, premium=off). */
export function isAuthorityEnabled(name: SpecialistName, overrides?: AuthorityEnableOverrides): boolean {
  const override = overrides?.[name];
  if (override !== undefined) return override;
  return SPECIALIST_METADATA[name].tier === 'standard';
}

/**
 * Settings-read hook (main-process only). Reads ai_dispatch_settings.json's
 * `mnem_drt_specialists` object from userData and returns it as
 * AuthorityEnableOverrides. Electron/fs/path are require()'d lazily inside the
 * function body (not at module scope) so this file stays importable from a plain
 * Node context -- e.g. a compiled-output smoke test run outside Electron -- without
 * throwing at import time. Any failure (no Electron app, missing file, bad JSON)
 * yields {} (i.e. every specialist falls back to its tier default), never a throw.
 */
export function readAuthorityEnableOverridesFromSettings(): AuthorityEnableOverrides {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron') as typeof import('electron');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync, existsSync } = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { join } = require('path') as typeof import('path');
    const p = join(app.getPath('userData'), 'ai_dispatch_settings.json');
    if (!existsSync(p)) return {};
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as { mnem_drt_specialists?: AuthorityEnableOverrides };
    return parsed?.mnem_drt_specialists ?? {};
  } catch {
    return {};
  }
}

// ─── Browser-LLM authorities (BP139 Founder canon, ChatGPT/Gemini/Claude) ──────────────────────
// Founder directive (BP139, non-negotiable): ChatGPT/Gemini/Claude are general "second opinion"
// authorities reachable ONLY by driving the user's own already-logged-in browser session for
// each vendor (same $0-to-Liana-Banyan mechanism user_google/user_perplexity already use -- see
// src/shared/plow/browser_authority_types.ts + src/main/plow/browser_authority_adapter.ts).
// ChatGPT/Gemini are PREMIUM/PAID (the user's own ChatGPT Plus / Gemini Advanced subscription).
// Claude (this build pass) is wired against the user's FREE, logged-in claude.ai/new web UI --
// see its BROWSER_LLM_AUTHORITY_METADATA entry's tier:'free' + costNote below -- rate-limited by
// claude.ai's own free-tier caps rather than billed. All three MUST default OFF regardless of
// tier, firing ONLY when the user explicitly opts in (see isBrowserLlmAuthorityEnabled below for
// why "free" never implies "default-on").
//
// Deliberately NOT added to SpecialistName/SPECIALIST_REGISTRY above: that registry's shape is
// `(question, domain, specialistKeys) => Promise<CandidateEblet[]>`, a synchronous-fetch REST
// adapter contract. Browser-LLM authorities are not REST fetches (no API key can substitute for
// "drive the user's logged-in browser tab") -- forcing them into SPECIALIST_REGISTRY would mean
// fabricating a fetch function that does not actually do what its neighbors do. This is its own
// small, parallel type/metadata/resolver family, structurally isolated from SPECIALIST_REGISTRY
// dispatch (see plow_mc_answerer.ts's runAuthorityEnsemble for the actual gated call sites) --
// which also means these three names can never appear in the SpecialistName-typed
// widenerOperators/effectiveOperators/report.additionalOperators plumbing at all, so the Andon
// escalation-widen retry path (attemptEscalationWidenAndRetry) is structurally incapable of
// ever firing one of these premium authorities, gate or no gate.

export type BrowserLlmAuthorityName = 'user_chatgpt' | 'user_gemini' | 'user_claude';

// (this build pass) tier widened from the literal 'premium' to 'premium' | 'free': user_claude
// now has a REAL live bridge (see plow_mc_answerer.ts's queryClaudeBrowserAuthority and
// webview_preload.ts's interactive handler) and runs against the user's FREE claude.ai plan --
// calling it "premium" would misrepresent it as a paid-subscription feature it no longer is.
// BP140-K4: user_chatgpt/user_gemini relabeled 'premium' -> 'free' too, same rationale --
// both now have REAL live bridges (queryChatGptBrowserAuthority/queryGeminiBrowserAuthority,
// plow_mc_answerer.ts) against chatgpt.com's/gemini.google.com's FREE, logged-in web UIs, never a
// paid ChatGPT Plus/Gemini Advanced subscription and never a metered OpenAI/Google AI API key.
// Widening this union does NOT change the default-off guarantee below: isBrowserLlmAuthorityEnabled()'s
// only true-by-default branch checks for the literal 'standard', which neither 'premium' nor
// 'free' ever is -- so all three authorities stay exactly as default-OFF/opt-in-only as they
// were under 'premium'.
export interface BrowserLlmAuthorityMetadata {
  tier: 'premium' | 'free';
  /** ['all'] -- these are general-purpose second opinions, not domain-specific like wolfram. */
  domains: string[];
  costNote: string;
}

export const BROWSER_LLM_AUTHORITY_METADATA: Record<BrowserLlmAuthorityName, BrowserLlmAuthorityMetadata> = {
  // BP140-K4: WIRED. Free, rate-limited: uses chatgpt.com's own logged-in free web UI via
  // MnemosyneC's embedded nexus browser -- an interactive type/submit/wait/scrape flow
  // (webview_preload.ts's CHATGPT_DRIVER_CONFIG), never the metered OpenAI API and never a
  // ChatGPT Plus subscription requirement. Still opt-in only (see isBrowserLlmAuthorityEnabled
  // below) -- a shared free-tier quota should never be spent without the user explicitly
  // turning it on.
  user_chatgpt: {
    tier: 'free',
    domains: ['all'],
    costNote: "Uses your own logged-in chatgpt.com session (free plan; ChatGPT Plus also works if you have it) via MnemosyneC's own embedded nexus browser -- an interactive type/submit/wait/scrape flow, not the metered OpenAI API.",
  },
  // BP140-K4: WIRED. Same free/opt-in contract as user_chatgpt above, against
  // gemini.google.com's own logged-in free web UI (webview_preload.ts's GEMINI_DRIVER_CONFIG).
  user_gemini: {
    tier: 'free',
    domains: ['all'],
    costNote: "Uses your own logged-in gemini.google.com session (free plan; Gemini Advanced also works if you have it) via MnemosyneC's own embedded nexus browser -- an interactive type/submit/wait/scrape flow, not the metered Google AI API.",
  },
  user_claude: {
    // (this build pass) relabeled premium -> free: wired against claude.ai's FREE, logged-in
    // web UI (claude.ai/new on the free plan), not a paid Claude Pro subscription and never the
    // metered Anthropic API (ai-providers/anthropic-client.ts is a separate, unrelated path and
    // is never used here). Still opt-in/default-OFF (see isBrowserLlmAuthorityEnabled below) --
    // "free" describes cost, not default-on-ness -- because the free plan is rate-limited and an
    // always-on second opinion could burn the user's daily/hourly message quota unexpectedly.
    tier: 'free',
    domains: ['all'],
    costNote: 'Uses your own logged-in claude.ai session (free plan; Claude Pro also works if you have it) via MnemosyneC\'s own embedded nexus browser -- an interactive type/submit/wait/scrape flow, not the metered Anthropic API. Rate-limited by claude.ai\'s own free-tier message caps; opt-in only because a shared free-plan quota should never be spent without you explicitly turning it on.',
  },
};

export type BrowserLlmAuthorityEnableOverrides = Partial<Record<BrowserLlmAuthorityName, boolean>>;

/** Pure resolver, same override-wins-else-tier-default contract as isAuthorityEnabled() above.
 *  Neither 'premium' nor 'free' (the only two BROWSER_LLM_AUTHORITY_METADATA tiers as of this
 *  build pass) is ever 'standard', so the tier-default branch is ALWAYS false here -- there is no
 *  code path in this function that can return true without an explicit `overrides[name] ===
 *  true`. This is the "default OFF, opt-in only" guarantee for every browser-LLM authority
 *  (including user_claude after its free-tier relabel above), provable by inspection of this one
 *  function. */
export function isBrowserLlmAuthorityEnabled(
  name: BrowserLlmAuthorityName,
  overrides?: BrowserLlmAuthorityEnableOverrides,
): boolean {
  const override = overrides?.[name];
  if (override !== undefined) return override;
  return (BROWSER_LLM_AUTHORITY_METADATA[name].tier as string) === 'standard'; // always false today
}

/**
 * Settings-read hook, main-process only. Reads the SAME ai_dispatch_settings.json /
 * mnem_drt_specialists object readAuthorityEnableOverridesFromSettings() already reads (no new
 * file, no new IPC channel) -- the renderer's SettingsTab.tsx AUTHORITY_SOURCES list writes
 * PREMIUM rows into this same `Record<string, boolean>` keyed by `src.key`, and since the file is
 * plain untyped JSON, adding 'user_chatgpt'/'user_gemini'/'user_claude' keys there is read here
 * without any schema change. Any failure (no Electron app, missing file, bad JSON) yields {}
 * (every browser-LLM authority falls back to its always-false tier default), never a throw.
 */
export function readBrowserLlmAuthorityEnableOverridesFromSettings(): BrowserLlmAuthorityEnableOverrides {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron') as typeof import('electron');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync, existsSync } = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { join } = require('path') as typeof import('path');
    const p = join(app.getPath('userData'), 'ai_dispatch_settings.json');
    if (!existsSync(p)) return {};
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as { mnem_drt_specialists?: BrowserLlmAuthorityEnableOverrides };
    return parsed?.mnem_drt_specialists ?? {};
  } catch {
    return {};
  }
}

// ─── BP139 Concordance Gate (Founder canon: "I want to tune it") ───────────────────────────
//
// Founder directive: a lone uncorroborated authority answer for a conceptual/NO-COMPUTE question
// (bias, Critical Security Studies, geography, etc.) is the root cause of several misses --
// runAuthorityEnsemble's own single-candidate accept path (plow_mc_answerer.ts) takes exactly
// one Google/Perplexity/browser-LLM/specialist-swarm answer and accepts it outright, with no
// corroboration at all. concordanceStrictness is the user-tunable knob that lets the Founder
// require real corroboration before that lone answer is accepted. DEFAULT ('lenient') MUST
// reproduce today's exact behavior -- see resolveConcordanceAcceptance in plow_mc_answerer.ts,
// the pure decision function this setting feeds, for the byte-identical-default proof.
export type ConcordanceStrictness = 'lenient' | 'require_two' | 'require_majority';

const CONCORDANCE_STRICTNESS_VALUES: ConcordanceStrictness[] = ['lenient', 'require_two', 'require_majority'];

/**
 * Settings-read hook, main-process only, same "read once, resolve per-call, fail-closed-to-
 * default" convention as readAuthorityEnableOverridesFromSettings()/
 * readBrowserLlmAuthorityEnableOverridesFromSettings() above -- reads the SAME
 * ai_dispatch_settings.json (userData dir) under a new top-level `concordance_strictness` key
 * (mirrors the existing `answer_cache_mode`/`csia_mode`/`csia_research` flat-key convention in
 * ai_dispatch_ipc.ts's AiDispatchSettings). Any failure (no Electron app, missing file, bad
 * JSON, or a value outside the 3-member union) yields 'lenient' -- the safe, behavior-preserving
 * default -- never a throw and never a guessed stricter mode.
 */
export function readConcordanceStrictnessFromSettings(): ConcordanceStrictness {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron') as typeof import('electron');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync, existsSync } = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { join } = require('path') as typeof import('path');
    const p = join(app.getPath('userData'), 'ai_dispatch_settings.json');
    if (!existsSync(p)) return 'lenient';
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as { concordance_strictness?: string };
    const raw = parsed?.concordance_strictness;
    if (raw && (CONCORDANCE_STRICTNESS_VALUES as string[]).includes(raw)) {
      return raw as ConcordanceStrictness;
    }
    return 'lenient';
  } catch {
    return 'lenient';
  }
}
