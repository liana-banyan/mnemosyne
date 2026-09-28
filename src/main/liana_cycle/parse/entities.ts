// D-BP223-BM04-h2cbpv9w-170 / PARSE_ENTITIES / seat BM04, module C2 of the shared parsing layer.
// Spec: PLATFORM/BISHOP_DROPZONE/D-BP223-BM04-h2cbpv9w-170_PARSING_LAYER_SCOPE.md, section C2.
//
// PURE DETERMINISTIC CODE. No model call of any kind, per HARDWIRE-22 (the Extraction Blood Rule)
// and this dispatch's own instruction ("this layer must remain 100% deterministic code with no
// model in the loop, now or in any later iteration, without a fresh Founder ruling"). This module
// answers "who/what is this text talking about" -- actors and items, with a conservative,
// positive-evidence pronoun resolver -- never "what does the question want done with them" (that
// judgment stays in each method's own shapeTest, per the scope doc's cross-cutting design point).
//
// ZERO DEPENDENCY ON parse/quantities.ts, deliberately, per this dispatch's own write-fence
// instruction ("do NOT import [quantities.ts] yet; entities returns spans and text"). Item
// quantity adjacency below is detected with a small local digit/number-word check, not a full
// Quantity extraction -- consolidating that duplication is quantities.ts's job (C1), not this
// module's. ZERO DEPENDENCY ON parse/ask.ts either (not needed for actor/item extraction); this
// module's own sentence splitter mirrors ask.ts's (unexported, so it cannot be imported) rather
// than diverging from its proven abbreviation-guard design -- see splitSentences() below.
//
// CONSOLIDATES the actor/pronoun/plural handling that section A of the scope doc measured as
// fragmented across methods/*.ts with NO shared import anywhere: capitalized-name capture
// (named in only 7 of ~90 narrow files, inline and unnamed in dozens more -- 4 separate sites
// inside two_hop_multiple_chain_difference.ts alone), `stem()` (7 files, naive `s$` or `(es|s)$`
// strip -- confirmed by reading running_balance_add_then_subtract.ts and
// literal_percent_of_stated_base.ts in full), `sameName()` (5 files, all an identical
// case-insensitive trim-and-compare -- confirmed by reading age_substitution_chain_single_unknown.ts
// and running_balance_add_then_subtract.ts in full), and `singularize()`/`singular()` (4 files
// each, confirmed by reading ratio_chain_backsolve_no_sum.ts in full -- an `-ies`/`-s` suffix
// strip with NO irregular-plural table, so "children"/"feet"/"mice"/"people" all fail silently
// in every one of those 9 files). None of the ~90 narrow methods read for this dispatch (or the
// scope doc's own prior read) implements GENDERED pronoun resolution against a name table at
// all -- every file that touches an actor identity does so by NAME-to-NAME string equality only
// (`sameName`), never by resolving "he"/"she"/"they" back to one of several named actors. That
// gap is exactly what W15's own `@whatBreaksIt` sections name by hand (the scope doc's section D
// worked example) and is this module's actual novel contribution, not a mechanical refactor of
// existing code the way `stem`/`sameName`/`singularize` consolidation is.
//
// POSITIVE-EVIDENCE CONTRACT, ABSTAIN-FIRST. A name is only reported as an Actor when at least
// one of its occurrences carries positive evidence of being a person/organization referent (an
// attributive verb immediately after it, a title prefix, or a possessive marker) -- a capitalized
// word that never once satisfies this is not returned at all, matching HARDWIRE-22's "could a
// reader verify this by looking" test. A pronoun is only resolved when EXACTLY one candidate
// antecedent qualifies under this module's own rule (see resolvePronounAt below); two or more
// candidates is an explicit, spanned, reasoned abstain, never a "most recent actor" guess -- the
// precise failure class two-hop-multiple-chain-difference-v1's own `@whatBreaksIt` documents by
// hand for a hand-written shape, generalized here into one audited rule.

/** A [start, end) character offset pair into the ORIGINAL input text handed to `extractEntities`,
 *  so `original.slice(span[0], span[1])` always reproduces the referenced text exactly. */
export type Span = [number, number];

export interface Actor {
  /** Canonical display name: the title-prefixed form ("Mrs. Hilt") when any occurrence carried a
   *  title, otherwise the bare capitalized name ("James") or role-noun phrase ("farmer") when no
   *  proper name exists anywhere in the text. */
  name: string;
  /** Span of this actor's FIRST positive-evidence-bearing mention in the text. */
  span: Span;
  /** Every span where this actor's own name/role-noun text (not a pronoun) occurs, earliest first. */
  mentions: Span[];
  /** Every span where a pronoun was positively resolved back to this actor, earliest first. */
  pronounMentions: Span[];
  /** Every positive-evidence reason this actor was recognized and how each pronoun binding (if
   *  any) was justified. Never empty. */
  evidence: string[];
}

export interface Item {
  /** The bare noun text, lowercase-normalized only in case (e.g. "candies", not "Candies"); the
   *  ORIGINAL casing as it appeared at `span` is preserved verbatim in `noun`. */
  noun: string;
  span: Span;
  plural: boolean;
  /** The Actor.name (or role-noun name) this item was possessively linked to ("Tom's brother",
   *  "her share"), when a positive possessive marker resolved one. Absent, never guessed, when no
   *  possessive marker touches this noun. */
  ownerActor?: string;
  evidence: string[];
}

export interface Entities {
  actors: Actor[];
  items: Item[];
  /** Every explicit abstain this pass recorded -- an ambiguous pronoun (2+ candidate antecedents),
   *  a group reference ("them"/"they"/"their"/"both"/"altogether"/"each of them" that this module
   *  never resolves to one member), or a malformed/empty input. Named with a span and a reason,
   *  never silent. */
  abstains: { reason: string; span: Span }[];
}

// -------------------------------------------------------------------------------------------
// Sentence splitting, mirroring ask.ts's own (unexported) abbreviation-guarded splitter so a
// title like "Mrs. Hilt" is never mistaken for a sentence boundary here either. Duplicated
// rather than imported because ask.ts does not export it and the write fence for this dispatch
// forbids modifying ask.ts.
// -------------------------------------------------------------------------------------------

interface SentenceSpan {
  text: string;
  span: Span;
}

const TITLE_WORDS = ['Mr', 'Mrs', 'Ms', 'Dr', 'Jr', 'Sr', 'Prof'];
const TITLE_ABBREVIATIONS = TITLE_WORDS.join('|');
const ABBREVIATION_GUARD = `(?<!\\b(?:${TITLE_ABBREVIATIONS}))`;

function splitSentences(text: string): SentenceSpan[] {
  const out: SentenceSpan[] = [];
  const boundary = new RegExp(`${ABBREVIATION_GUARD}[.!?]+["')\\]]*(?=\\s|$)`, 'g');
  let cursor = 0;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = boundary.exec(text))) {
    const end = m.index + m[0].length;
    pushTrimmed(out, text, cursor, end);
    cursor = end;
  }
  if (cursor < text.length) pushTrimmed(out, text, cursor, text.length);
  return out;
}

function pushTrimmed(out: SentenceSpan[], text: string, start: number, end: number): void {
  const raw = text.slice(start, end);
  const leadingWs = raw.length - raw.replace(/^\s+/, '').length;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return;
  const realStart = start + leadingWs;
  out.push({ text: trimmed, span: [realStart, realStart + trimmed.length] });
}

/** Index of the sentence containing character position `pos` (clamped to the last sentence if
 *  `pos` lands past the end, which only happens for a pronoun found via a regex whose match
 *  extends past the last recognized sentence boundary -- defensive, not expected in practice). */
function sentenceIndexOfPosition(sentences: SentenceSpan[], pos: number): number {
  for (let i = 0; i < sentences.length; i++) {
    if (pos >= sentences[i].span[0] && pos < sentences[i].span[1]) return i;
  }
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (pos >= sentences[i].span[0]) return i;
  }
  return 0;
}

// -------------------------------------------------------------------------------------------
// Name-candidate filtering: pronouns and sentence-initial function words are never proper-noun
// candidates, regardless of capitalization (a sentence starting "If Sarah has..." must never
// treat "If" as a name; a sentence starting "He has..." must never treat capitalized "He" as a
// name distinct from the pronoun "he").
// -------------------------------------------------------------------------------------------

// Personal pronouns (case-insensitive) are NEVER treated as name candidates, at any position --
// this is what stops a sentence-initial "He"/"She"/"They" (extremely common in GSM8K, where a
// pronoun-led sentence almost always follows the sentence that named the actor) from being
// captured as a separate, bogus "actor" alongside the real named one.
const PRONOUN_WORDS = new Set([
  'he', 'she', 'they', 'it', 'him', 'her', 'them', 'his', 'hers', 'theirs', 'their',
  'we', 'you', 'i', 'me', 'my', 'mine', 'your', 'yours', 'us', 'our', 'ours',
]);

// A fixed, documented (non-exhaustive) list of ordinary words that are capitalized ONLY because
// they open a sentence -- never proper nouns. Named explicitly in this dispatch's own build
// instruction: "If/When/After/Each/How/There/Then/Every". Checked ONLY at the sentence-initial
// position; the same word appearing mid-sentence (rare for these, but not impossible) is not
// filtered by this list, since a mid-sentence capital letter is stronger positive evidence.
const SENTENCE_INITIAL_STOPLIST = new Set([
  'if', 'when', 'after', 'each', 'how', 'there', 'then', 'every',
  'while', 'since', 'because', 'although', 'though', 'unless', 'once', 'until', 'whereas',
  'before', 'during', 'suppose', 'given', 'assume', 'let',
  'the', 'a', 'an', 'this', 'that', 'these', 'those',
  'but', 'and', 'so', 'yet', 'or', 'also', 'both', 'all', 'some', 'many', 'several', 'few', 'most',
  'first', 'second', 'third', 'next', 'later', 'finally', 'meanwhile', 'another', 'no', 'not',
  'what', 'which', 'who', 'where', 'why',
  // Round 2 additions, required by the broader "sentence-initial capitalized subject position is
  // itself positive evidence" rule added below (see scanNameOccurrences): capitalized number
  // words ("Ten of them are yellow") and common temporal/discourse adverbs ("Yesterday, she...")
  // must stay excluded or they would be wrongly established as actors now that verb-adjacency is
  // no longer the ONLY route to evidence for a sentence-initial token.
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'twenty', 'thirty', 'forty', 'fifty', 'dozen', 'half',
  'yesterday', 'today', 'tomorrow', 'currently', 'initially', 'overall', 'therefore', 'thus',
  'hence', 'however', 'sometimes', 'usually', 'normally', 'originally', 'previously', 'recently',
  'soon', 'now', 'here', 'together', 'altogether', 'instead', 'additionally', 'similarly',
  'consequently', 'afterward', 'afterwards', 'eventually', 'immediately', 'suddenly',
  'unfortunately', 'fortunately', 'typically', 'generally', 'specifically', 'according',
  // Prepositions that commonly open a sentence in GSM8K-style word problems ("For $75 she
  // bought..."), found necessary the same way (gsm8k-train-23 regressed a prior-passing test
  // fixture until "for" was added here) -- a preposition alone is never a name.
  'for', 'with', 'by', 'from', 'as', 'into', 'about', 'over', 'under', 'across', 'among',
  'between', 'without', 'within', 'through', 'upon', 'toward', 'towards', 'near', 'beside',
  'above', 'below', 'of', 'on', 'at', 'in', 'to',
  // Round 3, found by auditing every distinct actor name established ONLY by the sentence-
  // initial-subject rule across the full coverage run (see the return doc): imperative
  // computation verbs (the same closed set ask.ts's own IMPERATIVE_RE already names -- reused
  // here as a stoplist rather than an import, since ask.ts does not export the list and the write
  // fence forbids modifying ask.ts), more number words (the earlier round only added one-to-
  // twelve/twenty/thirty/forty/fifty), and a handful of adjective/gerund words that occasionally
  // open a GSM8K sentence but are never a name ("New York," "Traveling at 200 mph," "Blue fish
  // make up half"). "Calculate" alone was the single largest false-positive actor found (38
  // occurrences across the reserve) before this fix.
  'calculate', 'find', 'determine', 'compute', 'express', 'give', 'state', 'report',
  'last', 'out', 'assuming', 'only', 'twice', 'considering', 'due', 'including', 'none',
  'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  'new', 'traveling', 'travelling', 'right', 'large', 'small', 'big', 'little',
  'red', 'blue', 'green', 'yellow', 'purple', 'white', 'black', 'orange', 'pink', 'brown',
]);

// Attributive verbs/modals: positive evidence that a preceding capitalized token is a
// person/organization SUBJECT, not a stray capitalized word. Seeded from this dispatch's own
// build instruction ("has," "had," "bought," "collected," "earns") and widened, by the same
// discipline ask.ts's own coverage-driven fixes used, to the verb forms actually observed across
// the fixtures and adversarial cases built for this module (see the return doc's coverage
// section for which additions were measured, not guessed). Fixed and documented, never widened
// "until it looks good" past what a real fixture required, per the scope doc's own section F
// warning.
const ATTRIBUTIVE_VERBS: string[] = [
  'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being',
  'has', 'have', 'had',
  'will', 'would', 'can', 'could', 'shall', 'should', 'must', 'may', 'might',
  'does', 'did', 'do',
  'earns', 'earned', 'earn',
  'buys', 'bought', 'buy',
  'sells', 'sold', 'sell',
  'spends', 'spent', 'spend',
  'needs', 'needed', 'need',
  'wants', 'wanted', 'want',
  'makes', 'made', 'make',
  'writes', 'wrote', 'write',
  'walks', 'walked', 'walk',
  'runs', 'ran', 'run',
  'rides', 'rode', 'ride',
  'drives', 'drove', 'drive',
  'takes', 'took', 'take',
  'gets', 'got', 'get',
  'plays', 'played', 'play',
  'works', 'worked', 'work',
  'saves', 'saved', 'save',
  'gives', 'gave', 'give',
  'receives', 'received', 'receive',
  'pays', 'paid', 'pay',
  'eats', 'ate', 'eat',
  'drinks', 'drank', 'drink',
  'reads', 'read',
  'collects', 'collected', 'collect',
  'shares', 'shared', 'share',
  'owns', 'owned', 'own',
  'keeps', 'kept', 'keep',
  'uses', 'used', 'use',
  'plants', 'planted', 'plant',
  'grows', 'grew', 'grow',
  'picks', 'picked', 'pick',
  'packs', 'packed', 'pack',
  'fills', 'filled', 'fill',
  'cuts', 'cut',
  'builds', 'built', 'build',
  'creates', 'created', 'create',
  'starts', 'started', 'start',
  'finishes', 'finished', 'finish',
  'wins', 'won', 'win',
  'loses', 'lost', 'lose',
  'throws', 'threw', 'throw',
  'catches', 'caught', 'catch',
  'travels', 'traveled', 'travel',
  'visits', 'visited', 'visit',
  'invites', 'invited', 'invite',
  'decides', 'decided', 'decide',
  'likes', 'liked', 'like',
  'serves', 'served', 'serve',
  'orders', 'ordered', 'order',
  'delivers', 'delivered', 'deliver',
  'charges', 'charged', 'charge',
  'doubles', 'doubled', 'double',
  'splits', 'split',
  'divides', 'divided', 'divide',
  'weighs', 'weighed', 'weigh',
  'measures', 'measured', 'measure',
  'counts', 'counted', 'count',
  'adds', 'added', 'add',
  'borrows', 'borrowed', 'borrow',
  'lends', 'lent', 'lend',
  'owes', 'owed', 'owe',
  'donates', 'donated', 'donate',
  'raises', 'raised', 'raise',
  'scores', 'scored', 'score',
  'sets', 'set',
  'puts', 'put',
  'brings', 'brought', 'bring',
  'sends', 'sent', 'send',
  'finds', 'found', 'find',
  'wonders', 'wondered', 'wonder',
  'wishes', 'wished', 'wish',
  'hopes', 'hoped', 'hope',
  'plans', 'planned', 'plan',
  'goes', 'went', 'go',
  'comes', 'came', 'come',
  'stays', 'stayed', 'stay',
  'leaves', 'left', 'leave',
  'moves', 'moved', 'move',
  'chooses', 'chose', 'choose',
  // Round 2, added after hand-checking 20 sampled pronoun resolutions across the full
  // 3,685-item gsm8k-train tuning reserve (see the return doc): gsm8k-train-1404 ("Carson leans
  // over the railing at the zoo... falls into the... enclosure") was NOT established as an actor
  // at all -- "leans" was not in this list, so no occurrence of "Carson" anywhere in the text
  // carried positive evidence, and the module fell back to the role-noun "zoo," wrongly binding
  // "him"/"he" (which plainly refer to Carson) to a location instead. This batch adds the
  // measured-missing verb plus a bounded set of other common word-problem action verbs found the
  // same way -- still a fixed, documented, non-exhaustive list per this module's own discipline,
  // not "widened until it looks good."
  'leans', 'leaned', 'lean', 'falls', 'fell', 'fall', 'climbs', 'climbed', 'climb',
  'jumps', 'jumped', 'jump', 'sits', 'sat', 'sit', 'stands', 'stood', 'stand',
  'asks', 'asked', 'ask', 'tells', 'told', 'tell', 'says', 'said', 'say', 'calls', 'called', 'call',
  'helps', 'helped', 'help', 'carries', 'carried', 'carry', 'holds', 'held', 'hold',
  'drops', 'dropped', 'drop', 'cleans', 'cleaned', 'clean', 'washes', 'washed', 'wash',
  'teaches', 'taught', 'teach', 'learns', 'learned', 'learn', 'studies', 'studied', 'study',
  'cooks', 'cooked', 'cook', 'bakes', 'baked', 'bake', 'pours', 'poured', 'pour',
  'arrives', 'arrived', 'arrive', 'returns', 'returned', 'return', 'opens', 'opened', 'open',
  'closes', 'closed', 'close', 'enters', 'entered', 'enter', 'sleeps', 'slept', 'sleep',
  'draws', 'drew', 'draw', 'digs', 'dug', 'dig', 'waters', 'watered', 'water',
  'feeds', 'fed', 'feed', 'swims', 'swam', 'swim', 'flies', 'flew', 'fly',
  'types', 'typed', 'type', 'trains', 'trained', 'train', 'practices', 'practiced', 'practice',
  'exercises', 'exercised', 'exercise', 'wakes', 'woke', 'wake',
];
const ATTRIBUTIVE_VERB_SET = new Set(ATTRIBUTIVE_VERBS);
// A short, fixed, documented set of adverbs tolerated BETWEEN a name and its verb ("Bonnie ALSO
// collected...") -- found necessary by hand-checking sampled resolutions (see the return doc):
// gsm8k-train-3709 ("Her twin sister Bonnie also collected cat stickers and had 63 in her
// collection") never established "Bonnie" (the verb "collected" was not adjacent, "also" sat
// between them), so the closing "her collection" -- which names BONNIE's collection -- was
// wrongly bound to June under the single-actor-in-scope shortcut instead of correctly abstaining
// once two actors compete for the window. Tolerating this fixed adverb set is the same
// discipline ask.ts's own comma-tolerant IMPERATIVE_RE uses: a bounded, positive-evidence
// widening measured against a real fixture, not an open-ended skip of "any word."
const ADVERB_BEFORE_VERB = '(?:also|then|finally|still|just|already|even|now)\\s+';
const VERB_AFTER_NAME_RE = new RegExp(`^\\s+(?:${ADVERB_BEFORE_VERB})?(?:${ATTRIBUTIVE_VERBS.join('|')})\\b`, 'i');

// A fixed, documented (non-exhaustive) list of role nouns that stand in for an actor when the
// text names NO proper noun at all ("the farmer", "a store", "the class") -- per this dispatch's
// own build instruction. Deliberately a closed list (matching ask.ts's own UNIT_HINT_PHRASES /
// TIMEFRAME_RE precedent of a fixed cue list rather than open-ended noun-phrase detection), used
// ONLY as a fallback when zero proper-name actors were found anywhere in the text.
const ROLE_NOUNS = new Set([
  'farmer', 'store', 'shop', 'class', 'teacher', 'student', 'company', 'factory', 'bakery',
  'school', 'family', 'team', 'club', 'library', 'restaurant', 'bank', 'museum', 'hospital',
  'driver', 'worker', 'cashier', 'manager', 'clerk', 'gardener', 'painter', 'customer', 'owner',
  'chef', 'baker', 'florist', 'vendor', 'merchant', 'zoo', 'garden', 'office', 'warehouse',
  'market', 'gym', 'cafe', 'salon', 'garage', 'boy', 'girl', 'man', 'woman', 'kid', 'child',
  'artist', 'musician', 'coach', 'nurse', 'doctor', 'waiter', 'waitress', 'barber',
]);
const ROLE_NOUN_RE = new RegExp(`\\b(?:the|a|an)\\s+(${Array.from(ROLE_NOUNS).join('|')})\\b`, 'gi');

// A small, fixed, DOCUMENTED name-gender table -- deliberately non-exhaustive, per this
// dispatch's own build instruction ("a small documented name-gender table with an explicit
// UNKNOWN default that abstains"). Any name absent from both sets resolves to gender `null`
// (UNKNOWN); the pronoun resolver's gender-matched branch (used only when 2+ actors are already
// in scope) then requires exactly one candidate of the pronoun's gender among those WITH a known
// gender, so an UNKNOWN-gender name is correctly never force-matched to a gendered pronoun.
const MALE_NAMES = new Set([
  'james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas', 'mark',
  'charles', 'christopher', 'daniel', 'matthew', 'paul', 'steven', 'andrew', 'kenneth', 'joshua',
  'kevin', 'brian', 'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan', 'jacob',
  'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon',
  'benjamin', 'samuel', 'gregory', 'alexander', 'patrick', 'jack', 'dennis', 'jerry', 'tyler',
  'aaron', 'jose', 'adam', 'nathan', 'henry', 'douglas', 'peter', 'zachary', 'kyle', 'walter',
  'harold', 'carl', 'jeremy', 'roger', 'keith', 'roy', 'mike', 'sam', 'tom', 'bob', 'bill', 'rick',
  'sean', 'alex', 'frank', 'chris', 'steve', 'albert', 'roque', 'jasper', 'winston', 'wendell',
  'marcus', 'carlos', 'juan', 'miguel', 'roberto', 'antonio', 'mario', 'kai', 'owen', 'simon',
  'victor', 'vincent', 'bruce', 'derek', 'travis', 'cody', 'jorge', 'ivan', 'leo', 'max', 'gabriel',
  'elijah', 'ethan', 'noah', 'liam', 'lucas', 'caleb', 'isaac', 'xavier', 'julian', 'wyatt',
  'johnson', 'benson', 'hilt',
  // Round 2 additions, found by hand-checking 20 sampled resolutions over the full gsm8k-train
  // tuning reserve (see the return doc): each of these names appeared in a sample and would
  // otherwise have gone through as UNKNOWN gender.
  'chandler', 'rafael', 'bobby', 'carson',
]);
const FEMALE_NAMES = new Set([
  'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica', 'sarah',
  'karen', 'lisa', 'nancy', 'betty', 'sandra', 'margaret', 'ashley', 'kimberly', 'emily', 'donna',
  'michelle', 'carol', 'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'laura', 'helen',
  'sharon', 'cynthia', 'kathleen', 'amy', 'angela', 'shirley', 'anna', 'brenda', 'pamela', 'emma',
  'nicole', 'samantha', 'katherine', 'christine', 'debra', 'rachel', 'catherine', 'carolyn',
  'janet', 'ruth', 'maria', 'heather', 'diane', 'julie', 'joyce', 'victoria', 'kelly', 'christina',
  'joan', 'evelyn', 'judith', 'megan', 'andrea', 'cheryl', 'hannah', 'jacqueline', 'martha',
  'gloria', 'teresa', 'ann', 'sara', 'madison', 'frances', 'kathryn', 'janice', 'jean', 'abigail',
  'alice', 'julia', 'judy', 'sophia', 'grace', 'olivia', 'isabella', 'charlotte', 'amelia', 'mia',
  'harper', 'ella', 'wendy', 'natalie', 'betsy',
  // Round 2 additions, found by hand-checking 20 sampled resolutions over the full gsm8k-train
  // tuning reserve (see the return doc). "julie" is the fixture that exposed the gender-conflict
  // veto's absence (gsm8k-train-5534): with "julie" now known, "his" in that same text correctly
  // abstains instead of wrongly binding to Julie.
  'julie', 'jenna', 'peggy', 'cindy', 'beth', 'padma', 'nadine',
]);

function nameGender(displayName: string): 'he' | 'she' | null {
  // Strip a leading title ("Mrs. Hilt" -> "hilt") and take the LAST bare word (surnames alone are
  // not gendered, but "Mrs."/"Mr." themselves are a stronger, direct gender signal than the name
  // table -- checked first).
  const lower = displayName.toLowerCase();
  if (/^mrs\.|^ms\./.test(lower)) return 'she';
  if (/^mr\./.test(lower)) return 'he';
  const bare = lower.replace(/^(?:mr|mrs|ms|dr|jr|sr|prof)\.\s+/, '').trim();
  const firstWord = bare.split(/\s+/)[0];
  if (MALE_NAMES.has(firstWord)) return 'he';
  if (FEMALE_NAMES.has(firstWord)) return 'she';
  return null;
}

// -------------------------------------------------------------------------------------------
// Plural detection, WITH an irregular table -- the exact gap this dispatch's own build
// instruction named against the 9 files' naive `s$`/`(es|s)$` strip read in full above (none of
// which handle "children"/"feet"/"mice"/"people").
// -------------------------------------------------------------------------------------------

const IRREGULAR_PLURAL_NOUNS = new Set([
  'children', 'feet', 'mice', 'people', 'men', 'women', 'teeth', 'geese', 'oxen',
]);

function isPluralNoun(word: string): boolean {
  const w = word.toLowerCase();
  if (IRREGULAR_PLURAL_NOUNS.has(w)) return true;
  if (/ies$/.test(w) && w.length > 3) return true; // "candies" -> plural, "ties" -> plural
  if (/(?:s|sh|ch|x|z)es$/.test(w)) return true; // "boxes","dishes","glasses","churches"
  if (/s$/.test(w) && !/ss$/.test(w) && w.length > 1) return true; // "pages","dogs" but not "glass"
  return false;
}

// -------------------------------------------------------------------------------------------
// Name-candidate scan: title-prefixed names first (so "Mrs. Hilt" is one candidate, not a
// discarded "Mrs" plus a bare "Hilt"), then every other bare capitalized token, filtered by the
// pronoun/stoplist rules above.
// -------------------------------------------------------------------------------------------

interface NameOccurrence {
  span: Span;
  titled: boolean;
  /** true when this exact occurrence itself carries positive evidence (verb-adjacent, title, or
   *  possessive-marked) -- used to decide whether the KEY as a whole gets established. */
  hasEvidence: boolean;
  evidenceReason?: string;
}

const TITLE_NAME_RE = new RegExp(`\\b(${TITLE_WORDS.join('|')})\\.\\s+([A-Z][a-z]+)\\b`, 'g');
const BARE_NAME_RE = /\b[A-Z][a-z]+\b/g;
const TITLE_WORD_SET = new Set(TITLE_WORDS);

// Contraction-prone lowercase words never accepted as a possessive OWNER ("he's", "it's",
// "that's", "what's", "there's", "here's", "let's", "who's" are contractions of "is"/"has" in
// the overwhelming majority of English usage, never a genuine possessive antecedent).
const CONTRACTION_STOPWORDS = new Set(['he', 'she', 'it', 'that', 'what', 'there', 'here', 'let', 'who', 'they', 'we', 'you']);

function scanNameOccurrences(text: string, sentences: SentenceSpan[]): Map<string, NameOccurrence[]> {
  const byKey = new Map<string, NameOccurrence[]>();
  const consumedBareStarts = new Set<number>();

  let tm: RegExpExecArray | null;
  TITLE_NAME_RE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((tm = TITLE_NAME_RE.exec(text))) {
    const bareName = tm[2];
    const bareStart = tm.index + tm[0].length - bareName.length;
    consumedBareStarts.add(bareStart);
    const fullSpan: Span = [tm.index, tm.index + tm[0].length];
    const key = bareName; // group under the bare surname so later untitled mentions merge in
    const occ: NameOccurrence = { span: fullSpan, titled: true, hasEvidence: true, evidenceReason: `title prefix '${tm[1]}.' at char ${tm.index}` };
    const list = byKey.get(key) ?? [];
    list.push(occ);
    byKey.set(key, list);
  }

  let bm: RegExpExecArray | null;
  BARE_NAME_RE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((bm = BARE_NAME_RE.exec(text))) {
    const word = bm[0];
    const start = bm.index;
    if (TITLE_WORD_SET.has(word)) continue; // the title token itself, already folded into TITLE_NAME_RE
    if (consumedBareStarts.has(start)) continue; // already captured as the name-half of a title match
    if (PRONOUN_WORDS.has(word.toLowerCase())) continue;

    const sIdx = sentenceIndexOfPosition(sentences, start);
    const isSentenceInitial = start === sentences[sIdx]?.span[0];
    if (isSentenceInitial && SENTENCE_INITIAL_STOPLIST.has(word.toLowerCase())) continue;

    const end = start + word.length;
    const after = text.slice(end, end + 40);
    let hasEvidence = false;
    let evidenceReason: string | undefined;
    if (/^'s\b/.test(after)) {
      hasEvidence = true;
      evidenceReason = `possessive marker "'s" immediately after '${word}' at char ${start}`;
    } else if (VERB_AFTER_NAME_RE.test(after)) {
      // Report the VERB itself in the evidence text, skipping a tolerated adverb ("also") if one
      // is present, so the reason names the actual attributive verb that fired.
      const verbMatch = /^\s+(?:(?:also|then|finally|still|just|already|even|now)\s+)?([a-zA-Z]+)/.exec(after);
      hasEvidence = true;
      evidenceReason = `attributive verb '${verbMatch ? verbMatch[1] : '?'}' near '${word}' at char ${start}`;
    } else if (isSentenceInitial) {
      // Round 2 fix, found by hand-checking coverage output (see the return doc):
      // gsm8k-train-1027 ("John commissions an artist...") was never established because
      // "commissions" was not (and, given GSM8K's real diversity, never fully could be) in the
      // fixed ATTRIBUTIVE_VERBS list, so the module wrongly fell back to a role-noun actor
      // ("artist") and bound every "he"/"him" to it instead of John. A capitalized token that
      // OPENS a sentence and is NOT in SENTENCE_INITIAL_STOPLIST (which already excludes function
      // words, number words, and discourse adverbs) is itself strong positive evidence in
      // GSM8K-style word problems: the subject position of a sentence is essentially always
      // either the established actor or the actor being introduced. This generalizes past any
      // single fixed verb list, at the (accepted, documented) cost of also establishing a
      // sentence-initial ORGANIZATION/PLACE name this way -- still a real entity in the text, not
      // a stray word, matching this module's own "actor or role noun" scope.
      hasEvidence = true;
      evidenceReason = `sentence-initial capitalized subject '${word}' at char ${start} (no verb/possessive found, but sentence-initial position outside the fixed stoplist is itself positive evidence)`;
    }
    const span: Span = [start, end];
    const list = byKey.get(word) ?? [];
    list.push({ span, titled: false, hasEvidence, evidenceReason });
    byKey.set(word, list);
  }

  return byKey;
}

// -------------------------------------------------------------------------------------------
// Actor assembly: a name key is ESTABLISHED (returned as an Actor) only when at least one of its
// occurrences anywhere in the text carries positive evidence. This is deliberately a WHOLE-TEXT
// check, not a first-occurrence-only check -- "Mike and Johnson in the ratio 2:5" (no verb
// adjacent to either name at that point) is still established because a LATER sentence in the
// same text ("will Mike have", "Johnson got $2500") supplies the evidence; this mirrors how a
// human reader confirms a name is a real participant by reading the whole passage, not just the
// clause the name first appears in.
// -------------------------------------------------------------------------------------------

function buildActorsFromNames(byKey: Map<string, NameOccurrence[]>): Actor[] {
  const actors: Actor[] = [];
  for (const [bareKey, occs] of byKey) {
    const evidenceOccs = occs.filter((o) => o.hasEvidence);
    if (evidenceOccs.length === 0) continue; // never established anywhere -- not returned at all
    const sorted = [...occs].sort((a, b) => a.span[0] - b.span[0]);
    const titledOcc = sorted.find((o) => o.titled);
    const displayName = titledOcc ? sortTitledDisplay(titledOcc, bareKey) : bareKey;
    const evidence = evidenceOccs.map((o) => o.evidenceReason!).filter(Boolean);
    actors.push({
      name: displayName,
      span: sorted[0].span,
      mentions: sorted.map((o) => o.span),
      pronounMentions: [],
      evidence: evidence.length > 0 ? evidence : [`name '${bareKey}' established`],
    });
  }
  actors.sort((a, b) => a.span[0] - b.span[0]);
  return actors;
}

function sortTitledDisplay(titledOcc: NameOccurrence, bareKey: string): string {
  // The titled occurrence's own reason string names the title word; reconstruct "Mrs. Hilt" from
  // it rather than re-deriving from the original text (the occurrence itself has no text field --
  // by design, this module returns spans/keys, not duplicated text -- see the same
  // spans-and-text-only discipline ask.ts documents for itself).
  const m = /title prefix '([A-Za-z]+)\.'/.exec(titledOcc.evidenceReason ?? '');
  const title = m ? m[1] : 'Mr';
  return `${title}. ${bareKey}`;
}

function buildRoleNounActors(text: string): Actor[] {
  const byNoun = new Map<string, Span[]>();
  let m: RegExpExecArray | null;
  ROLE_NOUN_RE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((m = ROLE_NOUN_RE.exec(text))) {
    const noun = m[1].toLowerCase();
    const start = text.indexOf(m[1], m.index);
    const span: Span = [start, start + m[1].length];
    const list = byNoun.get(noun) ?? [];
    list.push(span);
    byNoun.set(noun, list);
  }
  const actors: Actor[] = [];
  for (const [noun, spans] of byNoun) {
    const sorted = [...spans].sort((a, b) => a[0] - b[0]);
    actors.push({
      name: noun,
      span: sorted[0],
      mentions: sorted,
      pronounMentions: [],
      evidence: [`role noun '${noun}' used as fallback actor: no proper-name actor found anywhere in the text`],
    });
  }
  actors.sort((a, b) => a.span[0] - b.span[0]);
  return actors;
}

// -------------------------------------------------------------------------------------------
// Pronoun resolution. Two resolution rules, matching this dispatch's own build instruction
// exactly:
//   (1) SINGLE ACTOR IN SCOPE -- when exactly one actor has been established anywhere before the
//       pronoun's position, every non-group pronoun resolves to it, regardless of gender (a
//       gender-unknown name like "Weng" or "Roque" still resolves this way -- gender is only
//       needed to disambiguate BETWEEN candidates, not to confirm a candidate that has no
//       competitor at all).
//   (2) GENDER-MATCHED, WINDOWED -- when 2+ actors are already in scope, restrict candidates to
//       those with a NAME (not pronoun) mention in the pronoun's own sentence or the immediately
//       preceding sentence, then require EXACTLY ONE of those windowed candidates to have a
//       gender matching the pronoun (he/him/his -> 'he'; she/her/hers -> 'she'). Zero or 2+
//       matches is an explicit abstain -- this is the guard against the exact "most recent actor
//       across an ambiguous gap" failure two-hop-multiple-chain-difference-v1's own
//       `@whatBreaksIt` names by hand.
// "they"/"them"/"their"/"theirs" are NEVER resolved to a single actor -- per this dispatch's own
// instruction ("'each of them'/'both'/'altogether' recorded as group references"), and because in
// practice these almost always refer to a previously named PLURAL ITEM group (e.g. "Ten of THEM
// are yellow" referring to flowers, not to the garden's single owner), never to one person.
// Resolving them to whichever lone actor happens to be in scope would be exactly the kind of
// guess this module's positive-evidence discipline forbids.
// -------------------------------------------------------------------------------------------

const GROUP_PRONOUN_RE = /\b(they|them|their|theirs)\b/gi;
// Case-INSENSITIVE: a sentence-initial "He"/"She"/"His"/"Her" (extremely common in GSM8K, since a
// pronoun-led sentence is the normal way a text continues talking about the actor it just named)
// must be matched, not just the lowercase mid-sentence form. A real, measured bug found during
// the fixture pass: an earlier case-SENSITIVE version of this regex silently dropped every
// sentence-initial "He"/"She" occurrence (confirmed against gsm8k-train-2, -5, -6, -13, -23, each
// of which opens at least one sentence with a capitalized pronoun that a case-sensitive match
// missed entirely) -- not a corner case, the dominant shape.
const GENDERED_PRONOUN_RE = /\b(he|him|his|she|her|hers)\b/gi;
const POSSESSIVE_PRONOUN_WORDS = new Set(['his', 'her', 'their', 'hers', 'theirs']);
const NOUN_AFTER_PRONOUN_RE = /^\s+([a-z][a-z-]*)\b/;

function pronounGender(word: string): 'he' | 'she' {
  return /^h(e|im|is)$/i.test(word) ? 'he' : 'she';
}

interface PronounEvent {
  word: string;
  span: Span;
  sentenceIndex: number;
}

function scanGenderedPronouns(text: string, sentences: SentenceSpan[]): PronounEvent[] {
  const out: PronounEvent[] = [];
  let m: RegExpExecArray | null;
  GENDERED_PRONOUN_RE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((m = GENDERED_PRONOUN_RE.exec(text))) {
    const span: Span = [m.index, m.index + m[0].length];
    out.push({ word: m[0], span, sentenceIndex: sentenceIndexOfPosition(sentences, m.index) });
  }
  return out;
}

function scanGroupPronouns(text: string): { word: string; span: Span }[] {
  const out: { word: string; span: Span }[] = [];
  let m: RegExpExecArray | null;
  GROUP_PRONOUN_RE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((m = GROUP_PRONOUN_RE.exec(text))) {
    out.push({ word: m[0], span: [m.index, m.index + m[0].length] });
  }
  return out;
}

/**
 * Resolves ONE gendered pronoun occurrence against the actors already established, per the two
 * rules documented above. Returns the resolved Actor, or `null` with a reason string when this
 * module's own rule cannot resolve it unambiguously (the caller records that reason in
 * `abstains`).
 */
function resolvePronounAt(
  event: PronounEvent,
  actors: Actor[],
  sentences: SentenceSpan[],
): { actor: Actor | null; reason: string } {
  const priorActors = actors.filter((a) => a.span[0] < event.span[0]);
  if (priorActors.length === 0) {
    return { actor: null, reason: `no actor established before pronoun '${event.word}' at char ${event.span[0]}` };
  }
  if (priorActors.length === 1) {
    const only = priorActors[0];
    const onlyGender = nameGender(only.name);
    const targetGender = pronounGender(event.word);
    // Round 2 fix, found by hand-checking 20 sampled resolutions across the full 3,685-item
    // gsm8k-train tuning reserve (see the return doc): gsm8k-train-5534 ("Julie wants to give her
    // favorite cousin a $2345 mountain bike for HIS birthday") wrongly bound "his" to Julie under
    // the "single actor in scope, regardless of gender" rule, because Julie's gender was absent
    // from the name table at the time (gender: null/UNKNOWN never conflicts). "His" plainly refers
    // to the (unregistered) cousin, not Julie. A KNOWN gender conflict is real negative evidence
    // even with only one candidate -- this module now vetoes the single-actor shortcut in that one
    // case and abstains instead of forcing a mismatched bind; an actor with UNKNOWN gender (the
    // common case for names absent from the small documented table) is unaffected and still
    // resolves via the original rule.
    if (onlyGender && onlyGender !== targetGender) {
      return {
        actor: null,
        reason: `only actor '${only.name}' in scope has known gender '${onlyGender}', which conflicts with pronoun '${event.word}' (expected '${targetGender}') -- abstaining rather than binding a gender-mismatched actor (the pronoun likely names an unestablished third party)`,
      };
    }
    return { actor: only, reason: `single actor '${only.name}' in scope -- unambiguous (gender unknown or matches)` };
  }

  const windowed = priorActors.filter((a) =>
    a.mentions.some((sp) => {
      const idx = sentenceIndexOfPosition(sentences, sp[0]);
      return idx === event.sentenceIndex || idx === event.sentenceIndex - 1;
    }),
  );
  const targetGender = pronounGender(event.word);
  const geneMatched = windowed.filter((a) => nameGender(a.name) === targetGender);

  if (geneMatched.length === 1) {
    return { actor: geneMatched[0], reason: `exactly one gender-matched ('${targetGender}') actor '${geneMatched[0].name}' named in the current or immediately preceding sentence, among ${priorActors.length} actors in scope` };
  }
  if (geneMatched.length === 0) {
    return { actor: null, reason: `${priorActors.length} actors in scope but none windowed to the current/preceding sentence match gender '${targetGender}' for pronoun '${event.word}' -- abstaining rather than guessing` };
  }
  return { actor: null, reason: `${geneMatched.length} same-gender ('${targetGender}') candidate actors (${geneMatched.map((a) => a.name).join(', ')}) named in the current or immediately preceding sentence for pronoun '${event.word}' -- ambiguous, abstaining rather than picking the most recent` };
}

// -------------------------------------------------------------------------------------------
// Item extraction: quantity-adjacent nouns, article-adjacent nouns, and possessive chains
// ("Tom's brother's bicycle"). A small local number check stands in for a full quantity
// extractor (parse/quantities.ts, C1) per this module's write-fence instruction not to import it
// yet.
// -------------------------------------------------------------------------------------------

const ONE_WORD_NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'dozen', 'twenty', 'thirty', 'forty', 'fifty', 'hundred', 'thousand',
];
const QUANTITY_ANCHOR_RE = new RegExp(
  `\\b(?:\\d+(?:\\.\\d+)?|${ONE_WORD_NUMBER_WORDS.join('|')})\\b`,
  'gi',
);
const ARTICLE_ANCHOR_RE = /\b(?:the|a|an)\b/gi;
// Owner is either a capitalized proper name or a lowercase common noun (for a possessive chain's
// second link, e.g. "brother's bicycle"), but never a pronoun/contraction word. No lookahead is
// needed for chaining: "Tom's brother's bicycle" matches "Tom's" first (consuming only that much),
// leaving "brother's" to be found by the NEXT exec() call starting right after it, so a two-level
// possessive chain resolves in two ordinary iterations, not one lookahead trick.
const POSSESSIVE_ITEM_RE = /\b([A-Za-z][a-zA-Z]*)'s\b/g;
const POSSESSIVE_PRONOUN_ANCHOR_RE = /\b(his|her|their)\b/gi;

// A fixed, documented (non-exhaustive) list of adjective/modifier words this module skips OVER
// when looking for the head noun immediately after a quantity or article -- "a NEW wallet" should
// report the item as "wallet," not "new." Found necessary by hand-inspecting the first pass's raw
// output on the 10 tuning-reserve fixtures (see the return doc): "new," "large," "small,"
// "favorite," and "cold"/"cream" (as in "a pound of CREAM cheese") were all captured as the item
// itself before this fix. Up to 2 consecutive modifier words are skipped; a longer adjective
// chain, or an adjective outside this fixed list, is left as-is (reported as the "noun") rather
// than guessing further -- an honest limitation, not silently hidden (see the return doc).
const MODIFIER_SKIP_WORDS = new Set([
  'new', 'old', 'large', 'small', 'big', 'little', 'favorite', 'other', 'additional', 'same',
  'different', 'cold', 'cream', 'media', 'young', 'fresh', 'local', 'red', 'blue', 'green',
  'yellow', 'purple', 'white', 'black', 'orange', 'pink', 'brown', 'fast', 'slow', 'long', 'short',
  'tall', 'wide', 'narrow', 'extra', 'more', 'less', 'few', 'several', 'summer', 'winter',
  'spring', 'business', 'total', 'combined', 'remaining', 'used', 'unused', 'empty', 'full',
]);
// Matches, right after a quantity/article anchor, up to 2 fixed modifier words then the head
// noun -- e.g. "a NEW wallet" -> skips "new," captures "wallet"; "500 movies" -> no modifier,
// captures "movies" directly.
const HEAD_NOUN_AFTER_RE = new RegExp(
  `^\\s+(?:(?:${Array.from(MODIFIER_SKIP_WORDS).join('|')})\\s+){0,2}([a-z][a-z-]*)\\b`,
  'i',
);

// Function words (articles, prepositions, conjunctions, pronouns, auxiliary/modal verbs) and a
// short list of abstract/aggregation nouns ask.ts's own unitHint vocabulary already owns --
// excluded so item extraction reports concrete nouns, not a bag of every lowercase word that
// happens to sit next to a quantity or article (a real, measured false-positive class found on
// the first pass: "$15 FOR that purpose" captured "for," "$75 SHE bought" captured "she").
const NON_NOUN_STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'for', 'in', 'on', 'at', 'with', 'from', 'by', 'as', 'than',
  'that', 'this', 'these', 'those', 'and', 'or', 'but', 'so', 'if', 'into', 'about', 'per', 'each',
  'all', 'any', 'no', 'not', 'it', 'its', 'she', 'he', 'they', 'him', 'her', 'them', 'his', 'hers',
  'their', 'theirs', 'we', 'you', 'i', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has',
  'have', 'had', 'will', 'would', 'can', 'could', 'do', 'does', 'did',
  'same', 'total', 'number', 'amount', 'rest', 'other', 'others', 'first', 'second', 'third',
  'more', 'less', 'many', 'much', 'lot', 'lots', 'way', 'ways', 'time',
]);

function findHeadNounAfter(text: string, anchorEnd: number): { noun: string; span: Span } | null {
  const window = text.slice(anchorEnd, anchorEnd + 60);
  const m = HEAD_NOUN_AFTER_RE.exec(window);
  if (!m || !m[1]) return null;
  const noun = m[1];
  const nounStartInWindow = m[0].length - noun.length;
  const start = anchorEnd + nounStartInWindow;
  if (NON_NOUN_STOPWORDS.has(noun.toLowerCase())) return null;
  return { noun, span: [start, start + noun.length] };
}

function extractItemsFromQuantitiesAndArticles(text: string): Item[] {
  const bySpanKey = new Map<string, Item>();

  const addItem = (noun: string, span: Span, evidenceReason: string) => {
    const key = `${span[0]}:${span[1]}`;
    if (bySpanKey.has(key)) return;
    bySpanKey.set(key, {
      noun,
      span,
      plural: isPluralNoun(noun),
      evidence: [evidenceReason],
    });
  };

  let m: RegExpExecArray | null;
  QUANTITY_ANCHOR_RE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((m = QUANTITY_ANCHOR_RE.exec(text))) {
    const found = findHeadNounAfter(text, m.index + m[0].length);
    if (found) addItem(found.noun, found.span, `noun '${found.noun}' immediately follows a quantity ('${m[0]}')`);
  }

  ARTICLE_ANCHOR_RE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((m = ARTICLE_ANCHOR_RE.exec(text))) {
    const found = findHeadNounAfter(text, m.index + m[0].length);
    if (found) addItem(found.noun, found.span, `noun '${found.noun}' immediately follows an article ('${m[0]}')`);
  }

  return Array.from(bySpanKey.values()).sort((a, b) => a.span[0] - b.span[0]);
}

function extractPossessiveItems(text: string, actorsByBareName: Map<string, Actor>): { items: Item[] } {
  const items: Item[] = [];

  let m: RegExpExecArray | null;
  POSSESSIVE_ITEM_RE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((m = POSSESSIVE_ITEM_RE.exec(text))) {
    const owner = m[1];
    if (CONTRACTION_STOPWORDS.has(owner.toLowerCase())) continue;
    const found = findHeadNounAfter(text, m.index + m[0].length);
    if (!found) continue;
    const ownerActor = actorsByBareName.get(owner)?.name ?? owner;
    items.push({
      noun: found.noun,
      span: found.span,
      plural: isPluralNoun(found.noun),
      ownerActor,
      evidence: [`possessive marker '${owner}'s' links '${found.noun}' to owner '${ownerActor}'`],
    });
  }

  return { items };
}

// -------------------------------------------------------------------------------------------
// extractEntities
// -------------------------------------------------------------------------------------------

/**
 * Extracts actors (named people/organizations, or a role-noun fallback when no name exists) and
 * items (quantity/article/possessive-adjacent nouns) from `text`, resolving unambiguous pronouns
 * back to the actor they name and recording every ambiguous case as an explicit abstain.
 * Deterministic, no model call, exact spans into the original `text`.
 */
export function extractEntities(text: string): Entities {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { actors: [], items: [], abstains: [{ reason: 'abstain: input is not a non-empty string', span: [0, 0] }] };
  }

  const sentences = splitSentences(text);
  const nameOccurrences = scanNameOccurrences(text, sentences);
  let actors = buildActorsFromNames(nameOccurrences);
  if (actors.length === 0) {
    actors = buildRoleNounActors(text);
  }

  const abstains: { reason: string; span: Span }[] = [];

  // Pronoun resolution (gendered: he/him/his/she/her/hers).
  const genderedPronouns = scanGenderedPronouns(text, sentences);
  for (const event of genderedPronouns) {
    const { actor, reason } = resolvePronounAt(event, actors, sentences);
    if (actor) {
      actor.pronounMentions.push(event.span);
      actor.evidence.push(`pronoun '${event.word}' at char ${event.span[0]} resolved: ${reason}`);
    } else {
      abstains.push({ reason: `pronoun '${event.word}' abstained: ${reason}`, span: event.span });
    }
  }

  // Group pronouns (they/them/their/theirs) are always recorded as group references, never
  // resolved to one actor -- per this dispatch's own instruction.
  for (const g of scanGroupPronouns(text)) {
    abstains.push({
      reason: `group reference '${g.word}' does not resolve to a single actor (each-of-them/both/altogether pattern)`,
      span: g.span,
    });
  }

  // Possessive pronouns (his/her/their) that resolved to a single actor also link the following
  // noun as an owned Item -- reusing the SAME resolution the gendered-pronoun pass already did
  // for "his"/"her" (a resolved pronounMention span means that pronoun WAS bound to an actor).
  const actorsByBareName = new Map<string, Actor>();
  for (const [bareKey] of nameOccurrences) {
    const found = actors.find((a) => a.name === bareKey || a.name.endsWith(` ${bareKey}`));
    if (found) actorsByBareName.set(bareKey, found);
  }

  const possessiveItems: Item[] = [];
  let ppm: RegExpExecArray | null;
  POSSESSIVE_PRONOUN_ANCHOR_RE.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((ppm = POSSESSIVE_PRONOUN_ANCHOR_RE.exec(text))) {
    const word = ppm[1].toLowerCase();
    if (word === 'their') {
      // "their" is a group possessive -- already recorded as a group-reference abstain above by
      // scanGroupPronouns; do not additionally attach an ownerActor (no single owner exists).
      continue;
    }
    const wordSpan: Span = [ppm.index, ppm.index + ppm[0].length];
    const owningActor = actors.find((a) => a.pronounMentions.some((sp) => sp[0] === wordSpan[0] && sp[1] === wordSpan[1]));
    if (!owningActor) continue; // the pronoun itself was abstained -- do not guess an owner either
    const found = findHeadNounAfter(text, wordSpan[1]);
    if (!found) continue;
    possessiveItems.push({
      noun: found.noun,
      span: found.span,
      plural: isPluralNoun(found.noun),
      ownerActor: owningActor.name,
      evidence: [`possessive pronoun '${word}' resolved to '${owningActor.name}' links '${found.noun}'`],
    });
  }

  const { items: nameOwnedItems } = extractPossessiveItems(text, actorsByBareName);
  const genericItems = extractItemsFromQuantitiesAndArticles(text);

  // Merge items, preferring the more specific (owner-carrying) entry when spans collide.
  const bySpan = new Map<string, Item>();
  for (const it of genericItems) bySpan.set(`${it.span[0]}:${it.span[1]}`, it);
  for (const it of [...nameOwnedItems, ...possessiveItems]) bySpan.set(`${it.span[0]}:${it.span[1]}`, it);
  const items = Array.from(bySpan.values()).sort((a, b) => a.span[0] - b.span[0]);

  actors.forEach((a) => {
    a.pronounMentions.sort((x, y) => x[0] - y[0]);
  });
  abstains.sort((a, b) => a.span[0] - b.span[0]);

  return { actors, items, abstains };
}
