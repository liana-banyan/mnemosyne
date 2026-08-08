// elements/aspect_tag.ts -- E-ASPECT-TAG -- D-BP150-004/BISHOP/S04/seg-elements
//
// THE 5K RULE, as a method element. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/
//     canon_process_result_nominal_are_three_things_the_5k_rule_bp150.eblet.md
//
// Founder, BP150: "Saying 'a process that results in' and 'is a non-representative sample' is NOT
// the same thing. Just like synonyms are NOT the same thing - just similar, and it is that quality
// that makes the difference between 'similar' and 'same' that we get granular on, so we can
// mechanically PROVE a conclusion."
//
// Four aspects of one referent:
//   PROCESS  "he's doing a 5K"      -- in flight; completion conditions not all satisfied
//   ATTEMPT  "he attempted a 5K"    -- past tense WITHOUT completion; started, stopped, unfinished
//   RESULT   "he did a 5K"          -- all completion conditions satisfied, after the fact
//   NOMINAL  "5K"                   -- the bare referent; survives non-completion
//
// NO MODEL IS CONSULTED. Every tag is a declared rule applied to text, and every tag carries the
// reason it was assigned, because an elimination the operator cannot audit is not a proof.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE SAFETY RULE, AND IT IS MEASURED, NOT CAUTIONARY. Canon F-6: using aspect as a MAJORITY-KEEP
// eliminator -- discard everything not in the largest aspect group -- discards the answer key on
// 15 of 140 bundled questions (10.7%), against the 12.3% that got the naive option-eliminator
// banned from this estate. ON qid 85 ITSELF the majority rule discards the correct answer, because
// PROCESS holds 7 options and the key is the lone RESULT.
//
// FIGURE CORRECTED BP150 by adversarial SEG D-BP150-006. This comment first shipped saying
// "14 of 140 (10.0%)", measured with a scratch script written BEFORE this module existed; promoting
// the element here EXTENDED its marker lists, so that figure described a classifier that no longer
// exists. Re-measured against this compiled module: 15 / 10.7%, and multi-group discrimination is
// 38 / 140 (27.1%), not the 20.7% originally published. A measurement is bound to the exact code
// that produced it.
//
// Therefore `eliminateByAspect` REQUIRES the ASK's own aspect and will not accept a majority as a
// substitute for it. That aspect comes from Survey. Until Survey exists, callers get the partition
// and a stated refusal to eliminate -- which is the honest state, not a limitation to work around.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export type LianaAspect = 'PROCESS' | 'ATTEMPT' | 'RESULT' | 'NOMINAL';

export interface AspectTag {
  aspect: LianaAspect;
  /** Always present. The transcript prints this so every tag is auditable by inspection. */
  why: string;
}

/** Nouns that name an activity rather than a thing. A head noun here settles the aspect outright. */
const ACTIVITY_HEADS = ['process', 'method', 'procedure', 'action', 'technique', 'practice'];
/** Predicates of BECOMING -- something is being brought about, so conditions remain outstanding. */
const BECOMING = ['results in', 'creates', 'leads to', 'causes', 'produces', 'yields', 'uses'];
/** Stative copulas -- a state asserted, not a becoming. */
const STATIVE = [' is ', ' are ', ' is not ', ' are not ', ' was ', ' were '];
/** Past tense without completion. */
const ATTEMPT_MARKERS = ['attempted', 'tried to', 'set out to', 'failed to', 'sought to'];

/**
 * Tags one option. Order is significant and encodes the 5K Rule's own reasoning:
 *   1. an explicit attempt marker settles it (past, but not completed)
 *   2. a head noun naming an activity settles it (the option is ABOUT a process)
 *   3. a becoming-predicate settles it (conditions outstanding)
 *   4. a stative predicate makes it a RESULT (the state is asserted as achieved)
 *   5. anything left is a bare referent -- NOMINAL
 */
export function tagAspect(optionText: string, sharedFrame?: RegExp): AspectTag {
  const t = String(optionText).trim();
  // Strip a frame shared by the whole option set (e.g. "It describes ...") so the head noun is the
  // one the option is actually about rather than the frame's own.
  const framed = (sharedFrame ?? /^It describes\s+(.*)$/i).exec(t);
  const body = (framed ? framed[1] : t).trim();
  const lower = ' ' + body.toLowerCase() + ' ';

  for (const a of ATTEMPT_MARKERS) {
    if (lower.includes(a)) return { aspect: 'ATTEMPT', why: `attempt marker "${a}" -- past tense without completion` };
  }
  const head = /^(?:a|an|the)\s+([a-z]+)/i.exec(body);
  const headNoun = head ? head[1].toLowerCase() : null;
  if (headNoun && ACTIVITY_HEADS.includes(headNoun)) {
    return { aspect: 'PROCESS', why: `head noun "${headNoun}" names an activity` };
  }
  for (const b of BECOMING) {
    if (lower.includes(' ' + b + ' ')) return { aspect: 'PROCESS', why: `becoming-predicate "${b}" -- conditions still outstanding` };
  }
  for (const s of STATIVE) {
    if (lower.includes(s)) return { aspect: 'RESULT', why: `stative predicate "${s.trim()}" on head noun "${headNoun ?? '?'}"` };
  }
  return { aspect: 'NOMINAL', why: `bare noun phrase, head "${headNoun ?? '?'}", no becoming and no stative` };
}

export interface AspectPartition {
  tags: Record<string, AspectTag>;
  groups: Record<string, string[]>;
  /** True when more than one aspect is present -- i.e. this element has anything to say at all.
   *  Measured BP150 against THIS compiled module: 38 of 140 bundled questions, 27.1%. (An earlier
   *  20.7% was published from a pre-module scratch script and is corrected here.) Being inert on
   *  the remaining ~73% is correct behavior, not a coverage gap. */
  discriminates: boolean;
}

export function partitionByAspect(options: Record<string, string>, sharedFrame?: RegExp): AspectPartition {
  const tags: Record<string, AspectTag> = {};
  const groups: Record<string, string[]> = {};
  for (const [L, text] of Object.entries(options)) {
    const tag = tagAspect(text, sharedFrame);
    tags[L] = tag;
    (groups[tag.aspect] ??= []).push(L);
  }
  return { tags, groups, discriminates: Object.keys(groups).length > 1 };
}

export interface AspectElimination {
  /** The options that survive. Equal to every input option when no elimination was permitted. */
  survivors: string[];
  eliminated: string[];
  /** Always present, including when nothing was eliminated and especially then. */
  reason: string;
  /** False whenever the element declined to act. A caller that ignores this and treats `survivors`
   *  as a narrowed pool is not wrong -- it is simply unchanged. */
  eliminated_any: boolean;
}

/**
 * Eliminates options whose aspect does not match the ASK's aspect.
 *
 * `askAspect` is REQUIRED and there is deliberately no majority fallback -- see the safety block at
 * the top of this file. Passing null returns every option with a stated refusal.
 */
export function eliminateByAspect(
  options: Record<string, string>,
  askAspect: LianaAspect | null,
  sharedFrame?: RegExp,
): AspectElimination {
  const all = Object.keys(options);
  const { groups, discriminates } = partitionByAspect(options, sharedFrame);
  const shape = Object.entries(groups).map(([a, ls]) => `${a}:${ls.join('')}`).join('  ');

  if (!askAspect) {
    return {
      survivors: all,
      eliminated: [],
      eliminated_any: false,
      reason: `partition ${shape} -- NOT eliminating: the ASK's own aspect is unknown (Survey has not established it). `
        + 'Majority-keep is refused by canon F-6: it discards the answer key on 10.0% of the corpus, and on qid 85 it discards the correct answer.',
    };
  }
  if (!discriminates) {
    return { survivors: all, eliminated: [], eliminated_any: false, reason: `every option is ${all.length ? Object.keys(groups)[0] : 'untagged'} -- aspect cannot discriminate here` };
  }
  const survivors = groups[askAspect] ?? [];
  if (survivors.length === 0) {
    return {
      survivors: all,
      eliminated: [],
      eliminated_any: false,
      reason: `partition ${shape} -- NOT eliminating: no option is in the ASK's aspect (${askAspect}). `
        + 'That is a finding to surface, not a licence to keep the nearest group: it usually means the ASK aspect was established wrongly.',
    };
  }
  return {
    survivors,
    eliminated: all.filter((L) => !survivors.includes(L)),
    eliminated_any: survivors.length < all.length,
    reason: `ASK aspect is ${askAspect}; partition ${shape} -- kept the ${askAspect} group`,
  };
}
