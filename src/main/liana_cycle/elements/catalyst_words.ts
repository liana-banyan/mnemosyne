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

function tokenize(text: string): string[] {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FUNCTION_WORDS.has(w));
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
