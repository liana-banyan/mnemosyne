// elements/survey_answers.ts -- E-SURVEY-ANSWERS -- D-BP150-014/BISHOP/seg-survey2
//
// SURVEY THE ANSWERS. Ratified canon:
//   Asteroid-ProofVault/state/eblets/CANON/
//     canon_liana_methods_are_compositions_of_named_elements_bp150.eblet.md  (element table, R-6, R-7)
//     canon_the_nest_method_bp150.eblet.md  (E-SURVEY-ANSWERS becomes a hard prerequisite, not a nicety)
//
// Founder, BP150: "we need to parse each one to define what it represents, in the same process as
// survey for the question... If we don't understand the meaning that the answer is the expression
// of, then we really can't say if it applies or not, even if we truly understand the question."
//
// WHAT THIS FILE DOES, PER OPTION, AND NOTHING MORE:
//   1. The ASSERTION is the option's own text, copied verbatim (HARDWIRE-22) -- never paraphrased.
//      An option in this estate's bundled corpus already IS a full statement (definitional_cascade's
//      D1 comment: nine of qid 85's ten options literally begin "It describes...") -- there is
//      nothing to extract that summarizing would not corrupt, so nothing is extracted here; the
//      option text itself is the fact this file works from.
//   2. KIND -- checkKind(assertion) (elements/kind_check.ts). NOT reimplemented here.
//   3. ASPECT -- tagAspect(assertion) (elements/aspect_tag.ts). NOT reimplemented here.
//   4. THE OPTION'S OWN CATALYST WORD(S) -- findCatalystWords() (elements/catalyst_words.ts) runs
//      ONCE across the whole option set (unchanged, not reimplemented), then for THIS option, its
//      own discriminating word(s) -- "words that define or change the meaning based on their
//      denotation" (Founder, catalyst_words.ts header) -- are handed to surveyAsk() (elements/
//      survey_ask.ts), THE SAME FUNCTION E-SURVEY-ASK calls for the question's own term. This is
//      "the same machinery per option" the governing canon's element table specifies for
//      E-SURVEY-ANSWERS -- called literally, never reimplemented.
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO, AND WHY:
//   - It does not compare one option's survey against another's, or against the ASK's survey. That
//     comparison -- deciding whether an option's meaning MATCHES the ask's -- is E-MATCH-UP (D5),
//     and canon marks E-MATCH-UP UNSOLVED. Doing it here would smuggle that unsolved problem into a
//     module whose whole job is to refuse it, exactly the discipline survey_ask.ts's own header
//     states for the ASK side ("Comparing denotations against each other and eliminating on the
//     difference is E-MATCH-UP (D5), and canon marks E-MATCH-UP UNSOLVED").
//   - It does not rank options against each other by any score. There is no "best" option anywhere
//     in this file's output, only N independently surveyed facts.
//   - It does not write a second kind-classifier or a second aspect-classifier. checkKind() and
//     tagAspect() are called, never copied or approximated.
//   - It does not decide which of an option's tokens is "the" catalyst word by any means other than
//     findCatalystWords()'s own count-based ordering (elements/catalyst_words.ts, R-4: mechanical,
//     no model). `maxCatalystWordsPerOption` bounds cost (each surveyed word costs 2 Google queries
//     + up to 2 Gemma extractions -- see survey_ask.ts's own two-query design); it does not change
//     WHICH words are chosen, only how many of the already-ordered list get surveyed.
import { surveyAsk } from './survey_ask';
import { checkKind } from './kind_check';
import { tagAspect } from './aspect_tag';
import { findCatalystWords } from './catalyst_words';
function nowIso() {
    return new Date().toISOString();
}
/**
 * E-SURVEY-ANSWERS. For every option in `options`, records what it ASSERTS (its own verbatim
 * text), its KIND, its ASPECT, and enumerates the denotations of its own most-discriminating
 * word(s) via E-SURVEY-ASK. Never compares options to each other. Never ranks. Never picks a
 * "best" option -- that is E-MATCH-UP, canon UNSOLVED, and stays out of this file exactly as it
 * stays out of survey_ask.ts.
 */
export async function surveyAnswers(options, ctx, opts = {}) {
    const { emit } = ctx;
    const say = (text) => emit({ kind: 'header', text, ts: nowIso() });
    const note = (text) => emit({ kind: 'note', text, ts: nowIso() });
    const fact = (text) => emit({ kind: 'fact', text: `+ ${text}`, ts: nowIso() });
    const letters = Object.keys(options);
    const maxWords = opts.maxCatalystWordsPerOption ?? 1;
    say(`E-SURVEY-ANSWERS -- what does each of ${letters.length} option(s) assert? (never compares, never ranks)`);
    const catalystResult = findCatalystWords(options, opts.sharedFrame);
    const out = {};
    for (const L of letters) {
        const assertion = options[L];
        const kindResult = checkKind(assertion);
        const aspectResult = tagAspect(assertion, opts.sharedFrame);
        const ownCatalysts = catalystResult.catalysts
            .filter((c) => c.letters.includes(L))
            .map((c) => c.word);
        const toSurvey = ownCatalysts.slice(0, Math.max(0, maxWords));
        note(`   ${L}) "${assertion}"`);
        note(`      kind: ${kindResult.type ?? 'UNRECOGNIZED'} (${kindResult.why})`);
        note(`      aspect: ${aspectResult.aspect} (${aspectResult.why})`);
        note(`      catalyst words (most discriminating first): ${ownCatalysts.join(', ') || '(none)'} -- surveying: ${toSurvey.join(', ') || '(none)'}`);
        const surveys = [];
        for (const word of toSurvey) {
            const s = await surveyAsk(word, ctx);
            surveys.push(s);
            fact(`${L}) survey("${word}"): ${s.denotations.length} denotation(s), ${s.discarded.length} discarded`);
        }
        const why = `${kindResult.type ?? 'UNRECOGNIZED'} / ${aspectResult.aspect}; ${toSurvey.length} catalyst word(s) surveyed `
            + `(${ownCatalysts.length} total discriminating word(s) available); NOT compared against any other option -- `
            + 'that comparison is E-MATCH-UP, canon UNSOLVED';
        out[L] = {
            letter: L,
            assertion,
            kind: kindResult.type,
            kindWhy: kindResult.why,
            aspect: aspectResult.aspect,
            aspectWhy: aspectResult.why,
            catalystWords: ownCatalysts,
            surveys,
            why,
        };
    }
    const why = `${letters.length} option(s) surveyed independently -- `
        + `${letters.map((L) => `${L}: ${out[L].kind ?? 'UNRECOGNIZED'}/${out[L].aspect}`).join(', ')}. `
        + 'NOT compared, NOT ranked -- E-MATCH-UP (canon UNSOLVED) does not run here.';
    emit({ kind: 'result', text: `SURVEY-ANSWERS: ${letters.length} option(s) typed`, ts: nowIso() });
    return { options: out, letters, why };
}
