// elements/catalyst_words.ts -- E-CATALYST-WORDS -- D-BP150-004/BISHOP/S04/seg-elements
//
// Founder, BP150 (qid 85 walk, step 6): "I would maybe granularize the process I described in the
// note prior to this one, to compare, in sequence, each answer 'Catalyst Words' - words that define
// or change the meaning based on their denotation, with the established Question 'Catalyst Words'."
//
// THE NON-CIRCULAR TEST, ratified BP150. "Words that define or change the meaning" cannot be
// detected by asking what a word means -- that is the thing we are trying to establish. So:
//
//   In the ANSWERS, a catalyst is a word whose PRESENCE VARIES across the option set.
//   In the ASK, the catalyst is the term under definition.
//
// A token appearing in EVERY option cannot distinguish anything, no matter how meaningful it is.
// A token appearing in exactly one option distinguishes maximally. That is a counting operation on
// the option set itself -- no model, no lexicon, no judgment. Canon R-4 of
// canon_liana_methods_are_compositions_of_named_elements_bp150.
//
// Measured BP150 on qid 85: ZERO universal tokens (every content word discriminates something) and
// 14 tokens appearing in exactly 1 of 10 options.

/** Function words carry no denotation to compare, so they are excluded before counting. This list
 *  is grammatical, not topical -- it contains no domain vocabulary, so it cannot be tuned toward a
 *  particular answer without that being visible in the diff. */
const FUNCTION_WORDS = new Set([
  'it', 'its', 'this', 'that', 'these', 'those', 'the', 'a', 'an', 'and', 'or', 'not', 'no',
  'of', 'in', 'on', 'to', 'for', 'from', 'with', 'by', 'at', 'as', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'has', 'have', 'had', 'do', 'does', 'did', 'where', 'when', 'which',
  'who', 'what', 'all', 'any', 'some', 'each', 'both', 'than', 'then', 'there', 'here', 'it’s',
]);

export interface CatalystWord {
  word: string;
  /** How many options contain it. Lower = more discriminating. */
  count: number;
  /** Which options contain it. */
  letters: string[];
}

export interface CatalystResult {
  /** Tokens present in some options but not all, most discriminating first. */
  catalysts: CatalystWord[];
  /** Tokens present in EVERY option. Reported, not discarded: a word the whole set shares is often
   *  the ASK's own term and is exactly what Survey needs to define. */
  universal: string[];
  /** Per-option token sets, so a caller can compare two options directly. */
  perOption: Record<string, string[]>;
}

/**
 * D-BP151-046. ATTRIBUTED: Founder, BP151, verbatim: "can we include in our language matrix that we
 * consult and write to, that some words in that order would NEVER be by themselves. When, ever,
 * would you ever use the word South without either another word or a punctuation mark directly
 * after it? Never. So it would either be ...South. Or ...South America. Or ... South Pole. Or ...
 * South Park. etc. Never just 'I was thinking about going South but..' or 'I was thinking South '
 * without a period. or question mark. or exclamation point or ; or : or whatever. That IS
 * indicative -- so it would in that sentence of the question asked, HAVE TO BE 'South America' and
 * in my examples 'South Pole' and 'South Park'. etc. Never by itself. This is a rule we can apply to
 * resolve the stupid parts."
 *
 * MEASURED, live qid 98 run (LIANA_RUN_qid98_2026-08-09T22-37-19-658Z.json and the Founder's
 * follow-on live run): this was not one fragment, it was six of seven multi-word options --
 * "South America" surveyed "america", "South Asia" surveyed "asia", "North Africa" surveyed
 * "africa", "Northeast United States" surveyed "northeast", "Central Asia" surveyed "central",
 * "Arctic Circle" surveyed "arctic". Only the single-word option ("Europe") survived intact. Every
 * wrongly-surveyed fragment's denotation was for a DIFFERENT referent than the option itself.
 *
 * STRUCTURAL IMPLEMENTATION, NOT A WORD LIST. A dedicated list of "words that never stand alone"
 * (south, north, united, arctic, central, ...) would be exactly the FEATURE_WORDS tare shape already
 * found and rejected in REGISTER_GATE_AUDIT_BP151.md (12 of 15 rules there unattributed). This
 * function detects the Founder's rule STRUCTURALLY instead: a run of 2+ consecutive capitalized
 * words in the option's OWN pre-lowercase text is one referent's proper name and is never split --
 * his own diagnostic ("would you ever use the word South... by itself?") applied mechanically to
 * capitalization, English's own grammatical marker for a proper-noun sequence, not to a
 * hand-authored vocabulary. No model call, no new list: FUNCTION_WORDS (already defined above, used
 * elsewhere in this file for the identical purpose of excluding non-denotational words) trims a
 * leading/trailing word that is capitalized only for sentence-position grammar (e.g. "The United
 * States" -> "united states"), reusing that existing list rather than adding a new one. A run with
 * fewer than 2 surviving non-function words is NOT a bound phrase -- it is left in `remainder` so
 * the ordinary single-word tokenizer below handles it exactly as it did before this ticket.
 */
function extractBoundPhrases(text: string): { phrases: string[]; remainder: string } {
  const CAPITALIZED_RUN_RE = /\b[A-Z][A-Za-z'-]*(?:\s+[A-Z][A-Za-z'-]*)+\b/g;
  const phrases: string[] = [];
  const remainder = text.replace(CAPITALIZED_RUN_RE, (m) => {
    const survivors = m.split(/\s+/).filter((w) => !FUNCTION_WORDS.has(w.toLowerCase()));
    if (survivors.length >= 2) {
      phrases.push(survivors.join(' ').toLowerCase());
      return ' ';
    }
    return ` ${m} `;
  });
  return { phrases, remainder };
}

function tokenize(text: string): string[] {
  const { phrases, remainder } = extractBoundPhrases(String(text));
  const rest = remainder
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FUNCTION_WORDS.has(w));
  return [...phrases, ...rest];
}

/**
 * Finds the discriminating vocabulary of an option set.
 *
 * `sharedFrame` strips a frame every option repeats (e.g. "It describes ...") before counting --
 * without it, the frame's own words look universal and drown the signal.
 */
export function findCatalystWords(options: Record<string, string>, sharedFrame?: RegExp): CatalystResult {
  const entries = Object.entries(options);
  const perOption: Record<string, string[]> = {};
  const sets: Array<[string, Set<string>]> = [];

  for (const [L, text] of entries) {
    const framed = sharedFrame ? sharedFrame.exec(String(text).trim()) : null;
    const body = framed ? framed[1] : String(text);
    const set = new Set(tokenize(body));
    sets.push([L, set]);
    perOption[L] = [...set];
  }

  const n = sets.length;
  const counts = new Map<string, string[]>();
  for (const [L, set] of sets) {
    for (const w of set) {
      const arr = counts.get(w) ?? [];
      arr.push(L);
      counts.set(w, arr);
    }
  }

  const catalysts: CatalystWord[] = [];
  const universal: string[] = [];
  for (const [word, letters] of counts) {
    if (letters.length === n) universal.push(word);
    else catalysts.push({ word, count: letters.length, letters });
  }
  catalysts.sort((a, b) => a.count - b.count || a.word.localeCompare(b.word));
  universal.sort();
  return { catalysts, universal, perOption };
}

/**
 * The ASK's catalyst: the term under definition.
 *
 * Returns null rather than guessing. A definitional question usually quotes or names its term, and
 * when it does not, the honest answer is that Survey must establish it -- not that this function
 * should pick the longest noun and hope.
 */
export function findAskCatalyst(question: string): { term: string; why: string } | null {
  const quoted = /["“]([^"”]{2,40})["”]/.exec(question);
  if (quoted) return { term: quoted[1], why: 'the question quotes the term explicitly' };

  // "...correctly explains bias?" / "...what is the referent object of security?"
  const explains = /\b(?:explains|describes|defines|means|definition of)\s+([a-z][\w-]*)\s*\??$/i.exec(question.trim());
  if (explains) return { term: explains[1], why: 'the term the question asks to be explained or defined' };

  return null;
}
