// scavenger_hunt_aliases.ts -- D-BP223-BM0-X033-060-PRESS-0934-PREP (0.9.34, "option C")
//
// Founder ruling, 2026-09-20 05:30Z, verbatim: "yes, C now, b later. fix the .9.34 as you said
// and the small fix, and what press do you need from me?" -- "C" is a hand-kept alias table;
// "b" (a local embedding) is explicitly NOT built here. See
// BISHOP_DROPZONE\D-BP223-BM0-X033-022-SCAVENGER-HUNT-HAYSTACK-NEEDLE\FINDINGS.md, "Disclosed
// matching-capability gap (NOT silently claimed as solved)": that dispatch found and NAMED this
// exact gap rather than hiding it behind a test suite that avoided the hard case.
//
// THE GAP THIS CLOSES: scavenger_hunt.ts's findScavengerHuntMatches() ranks candidates purely
// by mnem_eblet_store.ts's computeQuestionSimilaritySymmetric() -- an EXACT, stopword-filtered,
// whole-token-overlap score (see that function's own tokenizeQuestion(), which does no
// stemming, spelling-correction, or fuzzy matching of any kind). Under that matcher the
// Founder's own worked example scores 0.0 similarity:
//     query   "Ben Franklins Bday?"                    -> tokens {ben, franklins, bday}
//     stored  "What was Benjamin Franklin's birthday?" -> tokens {benjamin, franklin, birthday, ...}
//   zero shared tokens ("ben"!="benjamin", "franklins"!="franklin", "bday"!="birthday").
//
// THE FIX: a small, hand-kept, WORD-FOR-WORD substitution table, applied by scavenger_hunt.ts
// to the search phrase AFTER normalizePhrase() (lowercased, punctuation stripped to spaces,
// whitespace collapsed) and BEFORE the phrase is handed to computeQuestionSimilaritySymmetric.
// This is a plain object lookup -- no network call, no Ollama call, no model of any kind --
// so it stays inside HARDWIRE-22 / "zero model calls at answer time" exactly like the rest of
// scavenger_hunt.ts.
//
// GROWS FROM USE (TASK.md, verbatim: "keep it a plain JSON/TS map so it can grow from use"):
// this table is deliberately small and human-readable, not an attempt at an exhaustive
// nickname dictionary. New rows get added here as real Scavenger Hunt searches surface real
// misses -- each addition should say, in a comment, where it came from (a real miss, a named
// reference, or a specific Founder phrase), the same way the blocks below do.

/**
 * normalized (lowercase, already punctuation-stripped) token -> its expansion. Keys are
 * matched WHOLE-WORD only (see applyAliases below) -- never a substring match -- against the
 * exact token shape mnem_eblet_store.ts's own tokenizeQuestion() produces. An expansion may be
 * more than one word (space-separated); it is spliced back into the phrase as that many words.
 */
export const SCAVENGER_HUNT_ALIASES: Record<string, string> = {
  // ── The Founder's own worked example (TASK.md D-BP223-BM0-X033-060, 2026-09-20 05:30Z, and
  //    the gap it names in D-BP223-BM0-X033-022's own FINDINGS.md). These three rows alone are
  //    what make "Ben Franklins Bday?" match "What is Benjamin Franklin's birthday?". ──
  ben: 'benjamin',
  bday: 'birthday',
  // "franklins" (no apostrophe) is exactly how the Founder typed the surname in his own worked
  // example -- a dropped-apostrophe possessive as typed in casual speech, not a nickname, kept
  // here because closing THIS ticket's own worked example is the reason this table exists.
  franklins: 'franklin',

  // ── Common English given-name diminutives (male). Source: general English-usage nickname
  //    convention -- the same short forms any English given-name/nickname reference lists for
  //    these names (e.g. "Bill/Billy" for William, "Bob/Bobby" for Robert). Not tied to one
  //    dictionary; included as widely-known common usage, the same class of fact the Founder's
  //    own "Ben -> Benjamin" example is. ──
  bob: 'robert',
  bobby: 'robert',
  rob: 'robert',
  robbie: 'robert',
  bill: 'william',
  billy: 'william',
  will: 'william',
  willy: 'william',
  dick: 'richard',
  rick: 'richard',
  ricky: 'richard',
  jim: 'james',
  jimmy: 'james',
  jack: 'john',
  johnny: 'john',
  mike: 'michael',
  mikey: 'michael',
  dave: 'david',
  davey: 'david',
  steve: 'steven',
  stevie: 'steven',
  tom: 'thomas',
  tommy: 'thomas',
  chris: 'christopher',
  alex: 'alexander',
  sam: 'samuel',
  ed: 'edward',
  eddie: 'edward',
  ted: 'edward',
  teddy: 'theodore',
  fred: 'frederick',
  freddie: 'frederick',
  ken: 'kenneth',
  kenny: 'kenneth',
  larry: 'lawrence',
  matt: 'matthew',
  nick: 'nicholas',
  pat: 'patrick',
  pete: 'peter',
  tony: 'anthony',
  vince: 'vincent',
  walt: 'walter',
  andy: 'andrew',
  greg: 'gregory',
  joe: 'joseph',
  joey: 'joseph',
  ron: 'ronald',
  ronnie: 'ronald',
  stan: 'stanley',
  abe: 'abraham',
  art: 'arthur',

  // ── Common English given-name diminutives (female). Same source class as the block above. ──
  liz: 'elizabeth',
  lizzy: 'elizabeth',
  beth: 'elizabeth',
  betty: 'elizabeth',
  kate: 'katherine',
  katie: 'katherine',
  cathy: 'catherine',
  debbie: 'deborah',
  jen: 'jennifer',
  jenny: 'jennifer',
  jess: 'jessica',
  kim: 'kimberly',
  maggie: 'margaret',
  meg: 'margaret',
  peggy: 'margaret',
  patty: 'patricia',
  sue: 'susan',
  suzy: 'susan',
  vicky: 'victoria',

  // ── Common English written abbreviations (not names). Source: general written-English usage
  //    -- the same short forms any style guide's abbreviation list gives (e.g. "govt" for
  //    government, "dept" for department). Included alongside "Bday -> birthday" (the Founder's
  //    own worked example of this same class). ──
  govt: 'government',
  dept: 'department',
  mtg: 'meeting',
  msg: 'message',
  info: 'information',
  approx: 'approximately',
  univ: 'university',
  corp: 'corporation',
  intl: 'international',
  natl: 'national',
  org: 'organization',
  capt: 'captain',
  gen: 'general',
  dr: 'doctor',
  mr: 'mister',
  mrs: 'missus',
  vs: 'versus',
  yr: 'year',
  yrs: 'years',
};

export interface AliasApplication {
  /** The phrase with every whole-word alias hit replaced by its expansion. Fed to
   *  computeQuestionSimilaritySymmetric() in place of the bare normalized phrase; when nothing
   *  fires this is byte-identical to the input, so behavior for every existing (non-alias)
   *  phrase is unchanged. */
  expanded: string;
  /** Every alias that fired, in the exact order encountered, formatted "key->value" (e.g.
   *  "ben->benjamin") -- human-readable for the run log and for the panel, and directly
   *  reversible (split on "->") if a future consumer needs the pair back apart. */
  fired: string[];
}

/**
 * Applies SCAVENGER_HUNT_ALIASES to an ALREADY-normalized phrase (normalizePhrase() output:
 * lowercase, punctuation replaced with spaces, whitespace collapsed) -- so every word here is
 * already a clean, space-delimited token, matched whole-word only via exact map lookup, never a
 * substring/regex match. Pure function, no I/O, no randomness -- unit-testable directly.
 */
export function applyAliases(normalizedPhrase: string): AliasApplication {
  if (!normalizedPhrase) return { expanded: normalizedPhrase, fired: [] };
  const words = normalizedPhrase.split(' ').filter((w) => w.length > 0);
  const fired: string[] = [];
  const out: string[] = [];
  for (const word of words) {
    const hit = SCAVENGER_HUNT_ALIASES[word];
    if (hit) {
      fired.push(`${word}->${hit}`);
      out.push(hit);
    } else {
      out.push(word);
    }
  }
  return { expanded: out.join(' '), fired };
}
