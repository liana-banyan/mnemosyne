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
//
// D-BP150-019 CORRECTION (Founder ruling, mid-ticket): "a field is NOT always what answer options
// have in common, field means a field of study, like medicine or law or physics... using the answer
// options to glean what that is, is very valid [as evidence]." This file's STEP 1 query-building
// was conflating the two -- treating the option set's own shared vocabulary AS the field. Corrected:
// the option vocabulary is now explicitly measured as a COHESION NUMBER (computeThemeCohesion(),
// below) and used only as EVIDENCE to build a CONFIRMATION query ("what subject or field of study
// uses <shared words>", the Founder's own phrasing) -- Google still names the candidates (STEP 1 is
// unchanged in that respect), but a new structural signal (confirmsFieldOfStudy(), below) reports,
// per candidate, whether its OWN sourced text actually uses a "field of X"/"study of X" construction
// -- reported, not an eliminator, because this session had no live Google to measure its recall
// against real data (see that function's own header). A themeless option set (cohesion 0 or 1,
// e.g. a ranking question's short proper nouns) now explicitly skips the confirmation query rather
// than building one from noise -- a ROUTING signal per the Founder, not an error.
//
// D-BP150-019 FIX 2 (structural field-vs-variety) and FIX 3 (vocabulary pooling across
// near-duplicate names) are documented at their own definitions below, near where they run.
import { appearsIn, gemmaExtract, googleBlocks, norm } from '../methods/comparative_cascade';
// D-BP150-018 -- THE FIELD GATE'S OWN QUESTION WAS UNSCOPED. Measured on qid 85 (this ticket's
// governing evidence): "what field is bias in" and "what subject or field does bias belong to"
// are BOTH bare-term queries against a common English word, so Google returned pages about the
// EVERYDAY sense (types of bias -- "Name bias", "Study Bias", "confirmation bias") and the word
// "statistics" never entered any candidate set. findCatalystWords() (elements/catalyst_words.ts,
// D-BP150-004) already computes the register signal the Founder pointed at directly -- the
// question's OWN answer set states it ("sample / population / representative / randomization /
// estimates" for qid 85). Reused here, not reimplemented -- see computeThemeCohesion() below
// (D-BP150-019 correction renamed/extended this from the original deriveOptionVocabWords(), which
// named words but never measured how SHARED they were -- see that section's own header).
import { findCatalystWords } from './catalyst_words';
// D-BP152-008. fieldQueries()'s three literal Google query strings now live in
// resources/liana_survey_queries.json, re-read fresh on every call -- see query_text_loader.ts's
// own header.
import { getQueryText } from '../query_text_loader';
function nowIso() {
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
function significantWords(text) {
    return new Set(String(text ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !FIELD_GATE_STOPWORDS.has(w)));
}
/** A candidate's OWN vocabulary: every significant word across every passage that named it, minus
 *  the tokens of `excludeTerms` (the searched term itself, and the candidate's own name) -- so a
 *  candidate never "survives" merely because the term being surveyed, or its own name, happens to
 *  appear in the ASK. That would make every candidate survive trivially and the gate would
 *  eliminate nothing; excluding those tokens is what makes the remaining overlap a genuine finding
 *  about co-occurring vocabulary rather than a tautology. */
function vocabularyOf(passages, excludeTerms) {
    const words = new Set();
    for (const p of passages) {
        for (const w of significantWords(p))
            words.add(w);
    }
    for (const t of excludeTerms) {
        for (const w of significantWords(t))
            words.delete(w);
    }
    return [...words].sort();
}
function textVocabulary(texts, excludeTerm) {
    const words = new Set();
    for (const t of texts) {
        for (const w of significantWords(t))
            words.add(w);
    }
    for (const w of significantWords(excludeTerm))
        words.delete(w);
    return words;
}
/** STEP 2's mechanical rule, generic over what is being eliminated (a field or a fold): a
 *  candidate survives iff at least one of its own sourced vocabulary words appears in the
 *  ASK/options vocabulary. No scoring, no ranking among survivors -- this function only ever
 *  partitions into survives/eliminated, and callers (this file's own fieldGate/foldGate) must
 *  never further rank or pick from the survivors. */
function eliminateByVocabulary(items, askOptionsVocab) {
    const outcomes = items.map(({ item, vocabulary }) => {
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
function decide(survivorCount, candidateCount) {
    if (candidateCount === 0)
        return 'NO_CANDIDATES';
    if (survivorCount === 0)
        return 'ZERO_SURVIVORS';
    if (survivorCount === 1)
        return 'ONE_SURVIVOR';
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
// ─────────────────────────── D-BP150-019 correction (Founder ruling) ───────────────────────────
// Founder, verbatim: "a field is NOT always what answer options have in common, field means a
// field of study, like medicine or law or physics, but using the answer options to glean what that
// is, is very valid." THE CHAIN this section implements: derive the shared THEME from the options
// (evidence, not the field itself) -> ask Google to CONFIRM what field of study that theme belongs
// to (Google's role is confirmation, not naming) -> only THEN treat a name as a field. The old
// single-function deriveOptionVocabWords() named the words; computeThemeCohesion() below keeps
// that exact word-selection logic (unchanged in substance) but also measures and reports HOW
// SHARED the words actually are, because a themeless option set (a ranking question's short proper
// nouns) must route around this query entirely rather than build one from noise.
/** Words shared by only 1 option are not a "theme" -- they are that one option's OWN vocabulary
 *  (exactly what catalyst_words.ts's own header defines a catalyst to be: a word whose PRESENCE
 *  VARIES). A theme requires at least 2 options in agreement. Below this, the option set is
 *  reported as themeless/disjoint and no theme-confirmation query is sent -- not an error, per the
 *  Founder's own correction: qid 98/92-shaped ranking questions have ZERO shared words by
 *  construction (short proper nouns), and that is a ROUTING signal (this shape belongs to a
 *  different method, comparative_cascade.ts, untouched), not a defect to work around here. */
const MIN_COHESION_FOR_THEME_QUERY = 2;
/** Measures the option set's OWN shared vocabulary and reports it as a COHESION NUMBER, per the
 *  Founder's correction ("report the cohesion number and let it route; do not make a themeless
 *  option set an error"). Mechanical, no model call -- findCatalystWords() (elements/
 *  catalyst_words.ts), unmodified, reused not reimplemented, exactly as before this correction. */
export function computeThemeCohesion(options, term) {
    const optionCount = options ? Object.keys(options).length : 0;
    if (!options || optionCount < 2) {
        return { topCount: 0, optionCount, words: [], why: 'fewer than 2 options -- no shared theme is even definable' };
    }
    const { catalysts, universal } = findCatalystWords(options);
    const termWords = significantWords(term);
    const seen = new Set();
    const ordered = [];
    const universalContent = universal.filter((w) => !termWords.has(w));
    for (const w of universalContent) {
        if (seen.has(w))
            continue;
        seen.add(w);
        ordered.push(w);
    }
    const byShareDesc = [...catalysts]
        .filter((c) => !termWords.has(c.word))
        .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
    for (const c of byShareDesc) {
        if (seen.has(c.word))
            continue;
        seen.add(c.word);
        ordered.push(c.word);
    }
    // A universal (non-term) word is shared by literally every option -- maximal cohesion. Otherwise
    // the strongest signal is the top catalyst's own share count.
    const topCount = universalContent.length ? optionCount : (byShareDesc[0]?.count ?? 0);
    const words = ordered.slice(0, FIELD_VOCAB_QUERY_MAX_WORDS);
    const why = topCount >= MIN_COHESION_FOR_THEME_QUERY
        ? `cohesion ${topCount}/${optionCount} -- top shared word(s) [${words.slice(0, 5).join(', ')}${words.length > 5 ? ', ...' : ''}] present in ${topCount} of ${optionCount} options, a real shared theme worth confirming as a field of study`
        : `cohesion ${topCount}/${optionCount} -- no word shared by more than 1 option (a themeless/disjoint option set -- e.g. a ranking question's short proper nouns, which belongs to a different method entirely) -- theme-confirmation query not sent, not an error`;
    return { topCount, optionCount, words, why };
}
/** STEP 1's queries. The two plain-words phrasings of the Founder's own question ("what field is
 *  it in?") are KEPT -- they still run and still contribute candidates, `askFields()` unions
 *  everything every query finds. A third is added ONLY when `cohesion.topCount` clears
 *  MIN_COHESION_FOR_THEME_QUERY: "what subject or field of study uses <words>" -- the Founder's own
 *  phrasing, verbatim ("asking 'what subject or field of study uses sample, population, sampling'
 *  asks Google to CONFIRM a theme you already hold"), deliberately not "what field studies X" (the
 *  old wording, which measured on qid 85 returned pages about VARIETIES of the term -- "types of
 *  bias" -- rather than confirming the field of study the theme belongs to). Adding a query only
 *  ever grows the candidate set that STEP 2's elimination then filters; it cannot remove anything a
 *  caller previously found. */
function fieldQueries(term, cohesion) {
    // D-BP152-008. All three query strings moved to resources/liana_survey_queries.json (ids
    // "survey.fieldGate.whatFieldIsIn", "survey.fieldGate.whatSubjectBelongsTo",
    // "survey.fieldGate.themeConfirmation") -- the cohesion threshold/word-selection LOGIC below is
    // unchanged; only the query TEXT itself was relocated.
    const queries = [
        getQueryText('survey.fieldGate.whatFieldIsIn', { term }),
        getQueryText('survey.fieldGate.whatSubjectBelongsTo', { term }),
    ];
    if (cohesion.topCount >= MIN_COHESION_FOR_THEME_QUERY && cohesion.words.length) {
        queries.push(getQueryText('survey.fieldGate.themeConfirmation', { words: cohesion.words.join(' ') }));
    }
    return queries;
}
// ─────────────────────────── D-BP150-019 FIX 2 -- structural field-vs-variety rules ───────────────────────────
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** FIX 2(i). The Founder's exact wording, BP150 (in the correction governing this ticket, restated
 *  from the original dispatch): "a field name that contains the term is not a field -- it is a
 *  variety of the term." "Name bias" contains "bias" -- it is a KIND of bias, not a FIELD bias
 *  belongs to. Grammar, not domain knowledge: this tests the candidate name against the term this
 *  gate itself is asking about, using only word-boundary substring containment on normalized text
 *  -- no list of "types of X" was authored anywhere in this file. Confirmed still standing by the
 *  Founder's correction ("YOUR STRUCTURAL RULE STILL STANDS and is now better motivated... Keep it"). */
function containsTermAsWholeWord(name, term) {
    const nTerm = norm(term);
    if (!nTerm)
        return false;
    const nName = norm(name);
    return new RegExp(`\\b${escapeRegex(nTerm)}\\b`).test(nName);
}
/** FIX 2(ii). A second structural rule: a "field" whose entire name IS the hostname of the page it
 *  was extracted from is a source-name artifact ("Wikipedia" extracted from a page at
 *  en.wikipedia.org) -- the passage named its OWN SITE, not a subject the term belongs to.
 *  Mechanical: parses the block's URL, strips "www.", drops trailing labels that are generic
 *  top-/second-level domain suffixes (a closed, syntactic list of TLD strings -- URL grammar, not
 *  the content-domain vocabulary this file's header forbids authoring), and rejects a candidate
 *  name that equals any remaining host label. Generalizes to any site name (Reddit, CNN, Quizlet),
 *  never hand-authored per-site. */
const GENERIC_TLD_LABELS = new Set([
    'com', 'org', 'net', 'edu', 'gov', 'co', 'io', 'info', 'biz', 'us', 'uk', 'ca', 'au', 'de',
    'me', 'app', 'dev',
]);
function hostLabels(url) {
    if (!url)
        return [];
    try {
        const host = new URL(url).hostname.replace(/^www\./i, '');
        const labels = host.split('.').filter(Boolean);
        while (labels.length > 1 && GENERIC_TLD_LABELS.has(labels[labels.length - 1].toLowerCase())) {
            labels.pop();
        }
        return labels;
    }
    catch {
        return [];
    }
}
function isSourceNameArtifact(name, url) {
    const nName = norm(name);
    if (!nName)
        return null;
    for (const label of hostLabels(url)) {
        if (norm(label) === nName)
            return label;
    }
    return null;
}
// ─────────────────────────── D-BP150-019 correction, item 3 -- "field of X" confirmation ───────────────────────────
/** Founder: "a field of study is the kind of thing that completes 'the field of X' or 'the study of
 *  X' -- test it against retrieved text rather than a list you write." Generic English constructions
 *  for naming an academic field, tested against the candidate's OWN sourced passages -- not a list
 *  of field names, a list of the SENTENCE SHAPES that name one.
 *
 *  REPORTED, NOT AN ELIMINATOR: this session had no live Google (the ticket's own testing
 *  constraint), so there is no real captured text this session to measure how often a genuine
 *  field's own sourced passage happens to use this exact phrasing (recall is unmeasured). Treating
 *  its absence as proof a candidate is NOT a field would risk exactly the over-elimination this
 *  ticket's hard guards warn against ("do not tune... if a rule only works because you looked at
 *  one, say so"), on a rule I cannot verify against real data this session. So `confirmed: false` is
 *  reported alongside every survivor, never subtracted from `survivors` -- eliminateByVocabulary()
 *  remains the only thing that removes a candidate, unchanged, per the hard guard. Promoting this to
 *  a hard filter is future work, once it can be measured against real captured text. */
function confirmsFieldOfStudy(name, passages) {
    const rawName = name.trim();
    if (!rawName)
        return { confirmed: false, why: 'empty name' };
    const escName = escapeRegex(rawName).replace(/\s+/g, '\\s+');
    const patterns = [
        new RegExp(`\\b(field|study|discipline|branch)\\s+of\\s+${escName}\\b`, 'i'),
        new RegExp(`\\b${escName}\\s+is\\s+(a|an)\\s+(field|discipline|branch)\\b`, 'i'),
    ];
    for (const p of passages) {
        for (const re of patterns) {
            if (re.test(p)) {
                return { confirmed: true, why: `sourced passage names it as a field of study ("field of X"/"study of X"/"X is a field" construction found)` };
            }
        }
    }
    return {
        confirmed: false,
        why: 'no sourced passage for this candidate uses a "field of X"/"study of X"/"X is a field" construction -- '
            + 'NOT rejected on that basis (unverified against real data this session, see this function\'s own header) -- reported as unconfirmed',
    };
}
// ─────────────────────────── D-BP150-019 FIX 3 -- pool vocabulary across near-duplicate names ───────────────────────────
/** Diagnosis (see this ticket's return for the full writeup): `askFields()`'s per-block loop below
 *  merges candidates by EXACT normalized-string equality only (`byName.get(norm(name))`). The SAME
 *  true field named with different verbatim wording across different sourced blocks -- "statistics"
 *  in one block's passage, "Descriptive statistics" or "the study of statistics" in another --
 *  becomes MULTIPLE separate candidates, each carrying only its OWN block's vocabulary. Because
 *  `eliminateByVocabulary()` (STEP 2, unmodified, per the hard guard) requires a SINGLE candidate's
 *  OWN vocabulary to overlap the ASK/options, a field's true supporting vocabulary can be split
 *  across siblings such that no single fragment survives even though their UNION would. This
 *  function pools that vocabulary BEFORE elimination runs, by folding a candidate into an
 *  already-kept candidate when one name is a whole-word substring of the other -- "statistics" and
 *  "Descriptive statistics" are the SAME field at different specificity, not two competing fields.
 *  Processes shortest names first so the more general name anchors the merge. Names shorter than
 *  MIN_MERGE_NAME_LEN are never merge targets or donors -- containment on a 1-3 letter fragment is
 *  not a meaningful structural signal. eliminateByVocabulary() itself is NOT touched -- this only
 *  changes what counts as ONE candidate before it runs. */
const MIN_MERGE_NAME_LEN = 4;
function mergeContainedFieldNames(entries) {
    const sorted = [...entries].sort((a, b) => norm(a.name).length - norm(b.name).length);
    const kept = [];
    for (const cand of sorted) {
        const nName = norm(cand.name);
        if (nName.length < MIN_MERGE_NAME_LEN) {
            kept.push(cand);
            continue;
        }
        const parent = kept.find((k) => {
            const nk = norm(k.name);
            return nk.length >= MIN_MERGE_NAME_LEN && nk !== nName && new RegExp(`\\b${escapeRegex(nk)}\\b`).test(nName);
        });
        if (parent) {
            for (const p of cand.passages)
                if (!parent.passages.includes(p))
                    parent.passages.push(p);
            parent.why += `; also named "${cand.name}" (${cand.sourceUrl || cand.sourceTitle || 'source unknown'}) -- `
                + `merged in, same field at different specificity (name contains "${parent.name}")`;
        }
        else {
            kept.push(cand);
        }
    }
    return kept;
}
/** STEP 1. Asks Google directly what field(s) `term` belongs to and extracts every verified field
 *  name. Never picks one -- returns everything found, verified, unranked, exactly survey_ask.ts's
 *  own discipline for denotations. `options`, when supplied, is used ONLY to derive the extra
 *  theme-confirmation query's vocabulary (`computeThemeCohesion()` above, D-BP150-018 FIX A +
 *  D-BP150-019 correction) -- the elimination arithmetic below this function is unchanged. */
export async function askFields(term, ctx, options = null) {
    const { askGoogle, emit } = ctx;
    const step = (text) => emit({ kind: 'stage', text: `-> ${text}`, ts: nowIso() });
    const fact = (text) => emit({ kind: 'fact', text: `+ ${text}`, ts: nowIso() });
    const note = (text) => emit({ kind: 'note', text, ts: nowIso() });
    const cohesion = computeThemeCohesion(options, term);
    note(`   theme cohesion (options' own shared vocabulary, evidence pointing at a field, not the field itself): ${cohesion.why}`);
    const queries = fieldQueries(term, cohesion);
    const byName = new Map();
    const discarded = [];
    // D-BP151-006 PARSER INSTRUMENT (OBSERVATION ONLY -- no rule/threshold/order below this line is
    // changed by this ticket). Answers ONE question: when the field gate asks Google for the field
    // of study, does "statistics" come back and get lost, or does it never come back at all? Every
    // note() below is emitted via ctx.emit, exactly like every other note()/fact()/step() already in
    // this file, so it lands in the run receipt's `transcript` array (main/index.ts, D-BP150-015)
    // through the SAME mechanism -- no parallel logging path is invented.
    note(`   PARSER INSTRUMENT: ${queries.length} field quer(y/ies) queued to send, in order: `
        + queries.map((q, i) => `[q${i}] "${q}"`).join(' | '));
    for (const [qIndex, q] of queries.entries()) {
        step(`field ask -- ${q}`);
        note(`   [q${qIndex}] ${q}`);
        // eslint-disable-next-line no-await-in-loop -- two queries, sequential, same pattern as survey_ask.ts
        const res = await googleBlocks(askGoogle, q);
        if (!res.ok) {
            note(`   no answer (${res.via})`);
            note(`   PARSER INSTRUMENT [q${qIndex}] RAW RETURN: res.ok=false, via=${res.via} -- no blocks to log`);
            continue;
        }
        fact(`Google [${res.via}]: ${res.blocks.length} block(s) returned for "${q}"`);
        // PARSER INSTRUMENT -- the RAW, UNTRUNCATED (unless noted) text/blocks returned for this
        // query, logged BEFORE any extraction touches them. A separate read-only pass over res.blocks
        // so it cannot perturb the extraction loop below in any way.
        res.blocks.forEach((block, bi) => {
            const rawBody = block.body ?? '';
            const isTrunc = rawBody.length > 4000;
            const bodyLogged = isTrunc ? `${rawBody.slice(0, 4000)}` : rawBody;
            note(`   PARSER INSTRUMENT [q${qIndex}][block${bi}] RAW GOOGLE RETURN -- kind=${block.kind || '(none)'} `
                + `url=${block.url || '(no url)'} title="${block.title || '(no title)'}" `
                + `body${isTrunc ? ' (TRUNCATED at 4000 chars, full untruncated length was ' + rawBody.length + ')' : ' (untruncated, verbatim)'}="${bodyLogged}"`);
        });
        for (const block of res.blocks) {
            const passage = [block.title, block.body].filter(Boolean).join(' -- ');
            if (!passage.trim()) {
                discarded.push({ query: q, sourceUrl: block.url, sourceTitle: block.title, why: 'block carried no text (title and body both empty)' });
                continue;
            }
            // PARSER INSTRUMENT -- the exact input handed to gemmaExtract(), verbatim, before any
            // parsing/normalization happens to it.
            const passageForLog = passage.length > 4000 ? passage.slice(0, 4000) : passage;
            note(`   PARSER INSTRUMENT [q${qIndex}] gemmaExtract INPUT -- passage${passage.length > 4000 ? ' (TRUNCATED at 4000 chars, full untruncated length was ' + passage.length + ')' : ' (untruncated, verbatim)'}="${passageForLog}"`);
            // eslint-disable-next-line no-await-in-loop -- one Gemma call per block, same as survey_ask.ts
            const ex = await gemmaExtract(`Copy the field or subject names this passage lists for "${term}". If the passage names `
                + 'more than one field or subject, copy every one of them. Copy each name exactly as it '
                + 'appears in the passage, word for word. Do not decide which field is correct. Do not '
                + 'choose between them -- copy all that are named.', passage, '{"fields":["a field or subject name copied verbatim from the passage, or empty list if none is named"]}');
            // PARSER INSTRUMENT -- the exact raw output of gemmaExtract(), before ANY parsing or
            // normalization (rawFields below is the first thing that touches it).
            note(`   PARSER INSTRUMENT [q${qIndex}] gemmaExtract RAW OUTPUT -- ${JSON.stringify(ex)}`);
            const rawFields = Array.isArray(ex?.fields) ? ex.fields : [];
            let verifiedAny = false;
            for (const raw of rawFields) {
                const name = typeof raw === 'string' ? raw.trim() : '';
                if (!name)
                    continue;
                if (!appearsIn(passage, name)) {
                    note(`      discarded field name "${name}" -- could not be verified verbatim against the passage it claimed to come from`);
                    continue;
                }
                if (containsTermAsWholeWord(name, term)) {
                    note(`      discarded field name "${name}" -- contains the term "${term}" itself, so it is a VARIETY of the term, not a field it belongs to (structural rule, D-BP150-019 FIX 2)`);
                    continue;
                }
                const hostArtifact = isSourceNameArtifact(name, block.url);
                if (hostArtifact) {
                    note(`      discarded field name "${name}" -- matches the source's own hostname label "${hostArtifact}" (${block.url || '(no url)'}) -- a site-name artifact, not a subject (structural rule, D-BP150-019 FIX 2)`);
                    continue;
                }
                verifiedAny = true;
                const key = norm(name);
                const existing = byName.get(key);
                if (existing) {
                    if (!existing.passages.includes(passage))
                        existing.passages.push(passage);
                }
                else {
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
    // D-BP150-019 FIX 3. Pool vocabulary across near-duplicate names ("statistics" / "Descriptive
    // statistics") BEFORE eliminateByVocabulary() runs -- see mergeContainedFieldNames()'s own header
    // for the diagnosis this addresses. eliminateByVocabulary() itself, below in fieldGate(), is
    // unchanged; this only changes what counts as one candidate going into it.
    const mergedCandidates = mergeContainedFieldNames([...byName.values()]);
    if (mergedCandidates.length !== byName.size) {
        note(`   FIX 3: pooled ${byName.size - mergedCandidates.length} near-duplicate name(s) into a broader candidate by name containment (e.g. "Descriptive statistics" folded into "statistics") before elimination`);
    }
    return { queries, candidates: mergedCandidates, discarded, cohesion };
}
/**
 * E-FIELD-GATE. STEPs 1, 2 and 4 of the Founder's ruling: ask what field(s) `term` belongs to,
 * eliminate any field with zero sourced-vocabulary support in `askText`/`options`, and report --
 * never pick -- among whatever survives.
 */
export async function fieldGate(term, askText, options, ctx) {
    const { emit } = ctx;
    const say = (text) => emit({ kind: 'header', text, ts: nowIso() });
    const note = (text) => emit({ kind: 'note', text, ts: nowIso() });
    say(`E-FIELD-GATE -- what field is "${term}" in, and what does that eliminate?`);
    const { queries, candidates, discarded } = await askFields(term, ctx, options);
    // PARSER INSTRUMENT -- the candidate list immediately after extraction (askFields(), including
    // its FIX3 near-duplicate pooling), BEFORE eliminateByVocabulary() (STEP 2) runs below. This is
    // the single most decisive readout for the boundary question this ticket exists to answer: if
    // "statistics" (or any expected name) is not in this list, it was lost at or before extraction,
    // not by elimination.
    note(`   PARSER INSTRUMENT: candidate list immediately after extraction, BEFORE any elimination rule runs -- `
        + `${candidates.length} candidate(s): `
        + (candidates.length
            ? candidates.map((c) => `"${c.name}" (${c.passages.length} sourced passage(s), source=${c.sourceUrl || '(no url)'})`).join(' | ')
            : '(none)'));
    if (!candidates.length) {
        const why = `no verifiable field/subject name found for "${term}" across ${queries.length} quer(y/ies) `
            + `(${discarded.length} source block(s) consulted and discarded) -- falling back to the unconstrained survey, not eliminating anything`;
        note(`   ${why}`);
        emit({ kind: 'result', text: `FIELD GATE (${term}): 0 candidate(s) -- unconstrained`, ts: nowIso() });
        return { term, queries, candidates, discarded, outcomes: [], survivors: [], eliminated: [], decision: 'NO_CANDIDATES', scopedTerm: term, why, confirmations: {} };
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
        // PARSER INSTRUMENT -- for each elimination rule application: candidate, rule, decision,
        // reason, laid out as discrete labeled fields (the line above carries the same information in
        // prose; this line is the machine-greppable form). Rule is named explicitly because
        // eliminateByVocabulary() is the ONLY place a candidate is removed from `survivors` in this
        // file (STEP 2) -- the structural discards (FIX 2's containsTermAsWholeWord/
        // isSourceNameArtifact) happen earlier, inside askFields(), and are already logged there at
        // the point they fire.
        note(`   PARSER INSTRUMENT elimination -- candidate="${o.name}" rule=eliminateByVocabulary(STEP2 vocabulary-overlap) `
            + `decision=${o.survives ? 'SURVIVES' : 'ELIMINATED'} `
            + `candidateVocabWordCount=${o.vocabulary.length} supportingWords=[${o.supportingWords.join(', ')}] reason="${o.why}"`);
    }
    // D-BP150-019 correction, item 3. CONFIRMATION, not elimination -- see confirmsFieldOfStudy()'s
    // own header for why this is reported and never subtracted from `survivors`.
    const confirmations = {};
    for (const s of survivors) {
        confirmations[s.name] = confirmsFieldOfStudy(s.name, s.passages);
        note(`   field "${s.name}" field-of-study confirmation: ${confirmations[s.name].confirmed ? 'CONFIRMED' : 'unconfirmed'} -- ${confirmations[s.name].why}`);
    }
    const decision = decide(survivors.length, candidates.length);
    let scopedTerm = term;
    let why;
    if (decision === 'ONE_SURVIVOR') {
        scopedTerm = `${term} in ${survivors[0].name}`;
        why = `${candidates.length} field(s) asked for, ${eliminated.length} eliminated (zero sourced-vocabulary support in the ASK/options), `
            + `ONE survivor: "${survivors[0].name}" (field-of-study ${confirmations[survivors[0].name].confirmed ? 'CONFIRMED' : 'unconfirmed'}) -- by elimination, what it HAS to be. Subsequent survey queries scoped to "${scopedTerm}".`;
    }
    else if (decision === 'MULTIPLE_SURVIVORS') {
        why = `${candidates.length} field(s) asked for, ${eliminated.length} eliminated, ${survivors.length} SURVIVE: `
            + `${survivors.map((s) => `"${s.name}"${confirmations[s.name].confirmed ? ' [CONFIRMED field of study]' : ''}`).join(', ')} -- reported together, NONE chosen (forcing a single winner here is E-MATCH-UP, canon UNSOLVED). Term left unconstrained.`;
    }
    else {
        why = `${candidates.length} field(s) asked for, ALL eliminated -- zero survivors. Falling back to the unconstrained survey rather than eliminating everything.`;
    }
    note(`   ${why}`);
    emit({
        kind: 'result',
        text: `FIELD GATE (${term}): ${candidates.length} candidate(s), ${survivors.length} surviv(or/ors) [${decision}]`,
        ts: nowIso(),
    });
    return { term, queries, candidates, discarded, outcomes, survivors, eliminated, decision, scopedTerm, why, confirmations };
}
// ─────────────────────────── STEP 3 -- drop already-surveyed denotations from eliminated fields ───────────────────────────
/**
 * Drops any `SurveyDenotation` whose source-stated register names a field this gate ELIMINATED.
 * A denotation whose register is null (source did not state one), or whose register did not
 * appear among this gate's candidates at all, is kept -- this function only ever removes a
 * denotation on POSITIVE evidence that its own register was eliminated, never on absence of
 * evidence either way.
 */
export function dropDenotationsByEliminatedFields(denotations, fieldResult) {
    const eliminatedNorm = new Set(fieldResult.eliminated.map((e) => norm(e.name)));
    const kept = [];
    const dropped = [];
    for (const d of denotations) {
        if (d.register && eliminatedNorm.has(norm(d.register))) {
            dropped.push({ denotation: d, why: `source-stated register "${d.register}" belongs to a field the field gate eliminated` });
        }
        else {
            kept.push(d);
        }
    }
    return { kept, dropped };
}
function foldLabel(d, index) {
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
export function foldGate(denotations, term, askText, options, fieldContext) {
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
    const candidates = denotations.map((d, i) => ({
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
