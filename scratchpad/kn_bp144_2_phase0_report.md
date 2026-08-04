# KN-BP144-2 Phase 0 Report — Verify the Key Before Building Anything to Reach It

**Status: mandatory pre-code report, per ticket. No code has been written yet.**

## 1. Verbatim text of every option A-J for qid 85, corpus path and record identifier

Two corpus files carry this record with matching text and a matching correct-answer
statement; the one carrying the numeric `question_id` field that matches the run-038
receipt directly is treated as primary:

- **Primary**: `C:\Users\Administrator\Documents\mnemosyne\resources\mmlu_pro_bundled\questions.jsonl`,
  line record with `"question_id": 85`, `"source_id": "8230"`, `"src": "tiger-lab-mmlu-pro-curated"`.
- **Secondary (same content, indexed differently, no `question_id` field)**:
  `resources/mmlu_pro/math/questions.json` (array index 539), `resources/mmlu_pro/math/questions_raw.json`
  (array index 541), `resources/mmlu_pro/math/questions_curated.json` (array index 541) — all three keyed by
  `"source_id": "8230"`.

Question stem: **"Which of these statements correctly explains bias?"**

| Letter | Verbatim option text |
|---|---|
| A | It describes a process that results in a sample that does not represent the population. |
| B | It describes a process that results in a sample that is too large or too small. |
| C | It describes a process that uses a random sampling method. |
| D | It describes a process that results in a sample that perfectly represents the population. |
| E | It describes a sample that is not representative of the population. |
| F | It describes a process that always results in accurate estimates. |
| G | It describes the influence of the researcher's personal beliefs on the outcome of the study. |
| H | It describes a lack of randomization in the sampling process. |
| I | It describes a process where the sampling method has no influence on the outcome of the study. |
| J | It describes a process that creates estimates that are too high on average or too low on average. |

Corpus answer key: `"answer": "E"`, `"answer_index": 4`. This matches the run-038 receipt's
`correctLetter: "E"` for `question_id: 85` exactly
(`C:\Users\Administrator\Downloads\038mnemo_mesh_test_receipt_2026-08-03T21-28-38-365Z.json`).

The run-038 receipt's `ensemble_candidates` for this question (verified by direct read of the receipt,
not by paraphrase) show `user_perplexity` and `user_claude` both returning letter `"J"`, with the reasoning
text quoted verbatim in the ticket. `specialist_swarm` returned `"A"`. The three local self-sample voters
(the path that actually produced the final `parsedLetter`) returned `"G","G","G"` — so the final wrong
answer that reached the scoreboard for this question was **G**, not J; J and A are the two ensemble
*candidates* the ticket's Phase 0 asks about, and both are present verbatim in the receipt's
`ensemble_candidates` array.

## 2. Exactly which words distinguish E from J

> **E**: "It describes **a sample** that is not representative of **the population**."
>
> **J**: "It describes a process that creates estimates that are too high on average or too low on average."

The distinguishing words, precisely:

- **E's grammatical object is "a sample"** — bias is named as a property of a static, singular thing (the
  sample itself: it "is not representative"). **J's grammatical object is "a process"** that "creates
  estimates" — bias is named as an action/mechanism and its aggregate output, not a state.
- **E contains the explicit referent "the population."** Its claim ("not representative of the population")
  states what the deviation is *relative to*, in E's own text.
- **J contains no referent at all.** "too high on average or too low on average" — high or low **relative to
  what**? J's own text never says. It does not contain the words "population," "true value," "parameter," or
  any other comparison referent. The comparison referent that makes J *sound* correct ("rather than centered
  on the true population value") is a phrase both live authorities (Perplexity, Claude) added in their own
  reasoning text — it is not in option J's text. Direct receipt quotes, verbatim:
  - `user_perplexity`: *"...makes estimates consistently too high or too low on average, rather than
    centered on the true population value."*
  - `user_claude`: *"...causes the resulting estimates to be consistently too high or too low on average,
    rather than centered on the true population value."*

  Both authorities independently supplied the exact same six words — "rather than centered on the true
  population value" — that do not appear anywhere in option J's own text. This is precisely the Founder's
  rule 11 in the wild ("if they WERE the same, they would use the same words. And they don't."): the
  authorities are not quoting J, they are *finishing* J with words borrowed from their own prior knowledge of
  what real statistical bias means, and then crediting J with having said it.

## 3. The general rule (Phase 0's actual deliverable)

> **An option may be credited as matching a verified definitional predicate only if the option's own text
> contains the predicate's required comparison referent; an option that states an effect or a magnitude
> without naming what it is measured against does not match, even when it is the kind of statement a
> domain expert would recognize and complete from outside knowledge.**

This is stated with no reference to bias, sampling, statistics, or qid 85 by name — it is a rule about how a
predicate-match stage must read literal option text versus how a fluent external authority reads it, and it
applies to any question where the verified definition contains an explicit "differs from / relative to /
compared with X" clause and the surviving options vary in whether they restate X or omit it.

**Honesty check on this rule (per the ticket's explicit anti-force-fit instruction):** this rule is
sufficient, on the corpus text above, to eliminate J (J omits the referent; A and E both contain it: A says
"...does not represent **the population**," E says "...not representative of **the population**"). It is
**not** sufficient, by itself, to choose between A and E — both literally contain the referent. See item 4.

## 4. Founder's own narrowing vs. the machine authorities' landing on J — named, and why they differ

**The machine authorities (Perplexity, Claude) land on J** by a *paraphrase-completion* error: they read J,
recognize it as gesturing at the textbook statistical-bias concept they already know, and complete it with
words J's own text does not contain (see item 2). Their elimination logic, to the extent it is reconstructable
from the receipt's `ensemble_candidate` reasoning text (e.g. `answer_coroner:ensemble_candidate:user_claude`,
`sha256 e0b44abbc64a3d38ead4cfd2179153d3c92dad8bc45a54605bec184cb2980961`), explicitly rules out A and E on the
grounds that A/E describe "a single unrepresentative sample" while bias, in their framing, is "a property of
the sampling/estimation process itself" — i.e. they treat "process" as the *correct* grammatical subject for
an explanation of bias, and single-sample state-descriptions (A, E) as therefore describing a *symptom*, not
the definition. That is a coherent piece of reasoning; it is simply reasoning about the *concept* of bias in
general, not about what J's own sentence says.

**The ticket's own framing states the Founder's hand walkthrough (BP141, Excerpt 7) also ends at `{A, E}`,**
not at a single letter chosen by name. Reading Excerpt 7 directly: the Founder categorizes the options,
determines the register (statistics), issues the mandatory verification lookup ("what is bias in
statistics"), reduces the returned definition to the predicate "error that results in something different
than the true values of a population," and then says the predicate "sounds a lot like... E." He does not, in
that message, explicitly say "and not A" or give a textual reason to prefer E over A specifically — his
predicate ("something different than the true values of a population") is satisfied by **both** A ("a process
that results in a sample that does not represent the population") and E ("a sample that is not representative
of the population"), since both name the same referent ("the population") and the same defect
("does not represent" / "not representative"). A and E differ from each other only in whether the *process*
or the *sample itself* is named as the grammatical subject — a real distinction, but one this recovered
transcript excerpt does not show the Founder resolving explicitly in words, and one this report does not
manufacture a rule to force, per the ticket's explicit instruction not to build a gate that names this
question to force a single answer.

**Named plainly: A and J are eliminated by different reasoning.** J is eliminated by the general
literal-referent rule in item 3 (its own text never states what its "too high/too low on average" is relative
to). A is *not* eliminated by that rule — A survives it, exactly as it survives in both the Founder's hand
walkthrough and the ticket's own stated `{A, E}` endpoint. The honest, unforced result of applying the
verified predicate literally is **`{A, E}`, matching the Founder's own recorded endpoint** — not a further
narrowing to E alone. Phase 2's implementation is designed and reported against that honest target: it must
correctly eliminate J (and every other wrong option) via the general rule above, and it is explicitly allowed,
per the ticket ("If it lands `{A, E}` still, that is also the result and it is worth knowing"), to land on
`{A, E}` rather than manufacturing an unsupported final tie-break between A and E.

## Flags — speculative vs. verified in this Phase 0 report

- **Verified** (read directly from files, not inferred): the verbatim option text, the corpus paths and
  record identifiers, the answer key, the receipt's `ensemble_candidates` letters and reasoning strings for
  qid 85, the receipt's final `parsedLetter` (G) and `voter_letters` (G,G,G).
- **Verified** (read directly from `FOUNDER_CASCADE_WORKED_BY_HAND_VERBATIM_RECOVERED_BP144.md` Excerpt 7):
  the Founder's own five-to-six-step walkthrough text, quoted verbatim in that file.
- **Speculative / this report's own inference, flagged as such:** the specific claim in item 2 that both
  live authorities "finished" J with borrowed words rather than reasoning from J's own text is an inference
  from the fact that both authorities' reasoning strings contain an identical six-word phrase absent from J's
  corpus text — a strong textual coincidence, but this report does not have visibility into either
  authority's actual reasoning process and cannot prove intent, only the textual fact of the mismatch.
  **Speculative:** whether A and E are distinguishable by any *general* rule at all (as opposed to A and E
  being a genuine tie under the literal-predicate rule, which is this report's working conclusion) is not
  resolved here and is reported as unresolved rather than forced.
