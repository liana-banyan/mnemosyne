#!/usr/bin/env node
// founder_cascade_v2.mjs -- D-BP149-033/BISHOP/S33/seg-cascadev2
//
// THE FOUNDER'S CASCADE. GOOGLE IS THE ONLY SOURCE. GEMMA EXTRACTS. THE CODE DECIDES.
// Streams every step to the console so the run can be WATCHED, and costs nothing to run.
//
// Founder, BP149: "Use Gemma, and only use Google as the source. with my cascade."
// And: "I want to see the test, which is why I like to run them... So that we can make this
// truly zero cost."
//
// WHAT WENT WRONG IN v1, stated so it is not repeated. The first build (google_cascade_bp149.js)
// contained ZERO Ollama call sites -- Gemma was never invoked. Options were scored by term and
// bigram overlap against Google's prose. On qid 46 every option scored an identical 0.35 because
// the options are permutations of one vocabulary ("change in supply" / "change in quantity
// supplied"). Overlap cannot separate meanings built from the same words. It abstained 6 of 6.
// That is precisely the method the Founder's own doctrine forbids: "if they WERE the same, they
// would use the same words. And they don't." Microscopic and infinitesimal. Espejo and Espejito.
//
// THE DIVISION OF LABOR, and it is the whole design:
//   GOOGLE   supplies facts, with citations. The only source. Multi-source is escalation only.
//   GEMMA    extracts STRUCTURE from those facts. Mechanical only: pull a named quantity, list
//            which entities a passage asserts something about, normalize to JSON. She is NEVER
//            handed the options and asked to pick. Measured four ways at BP149, her judgment is
//            the single least reliable component available.
//   THE CODE decides. Elimination and termination are arithmetic over extracted facts, written
//            here, inspectable afterward. This is the pattern that produced A on qid 98 while her
//            judgment on the same facts produced F.
//
// HONEST LIMIT, up front: this only terminates on questions whose answer reduces to a COMPARISON
// or a SET MEMBERSHIP over extractable facts. Questions that turn on the sense of a phrase
// (qid 85's "bias", qid 92's contested referent object) have no such reduction and will abstain.
// That abstain is the correct answer, not a failure, and the run reports which class each
// question fell into so the two are never confused.
//
// USAGE, from C:\Users\Administrator\Documents\mnemosyne, with MnemosyneC dev running on 9333:
//   node scripts\founder_cascade_v2.mjs
//   node scripts\founder_cascade_v2.mjs --qids=98
//   node scripts\founder_cascade_v2.mjs --qids=98,46 --verbose

import fs from "fs";
import path from "path";

const PORT = 9333;
const OLLAMA = "http://127.0.0.1:11434/api/generate";
const MODEL = process.env.CASCADE_MODEL ?? "gemma4:12b";
const BUNDLE = "resources/mmlu_pro_bundled/questions.jsonl";
const OUT = "C:/Users/Administrator/Documents/LianaBanyanPlatform/BISHOP_DROPZONE/FOUNDER_CASCADE_V2_RESULTS.md";

const argv = process.argv.slice(2);
const VERBOSE = argv.includes("--verbose");
const qidArg = argv.filter((a) => a.startsWith("--qids="))[0];
const QIDS = qidArg ? qidArg.split("=")[1].split(",").map(Number) : [46, 66, 72, 85, 92, 98];

const C = { dim: "\x1b[2m", b: "\x1b[1m", g: "\x1b[32m", y: "\x1b[33m", r: "\x1b[31m", c: "\x1b[36m", x: "\x1b[0m" };
const say = (s = "") => console.log(s);
const step = (s) => say(`${C.c}  ->${C.x} ${s}`);
const fact = (s) => say(`${C.g}     +${C.x} ${s}`);
const note = (s) => say(`${C.dim}       ${s}${C.x}`);

// ─────────────────────────── GOOGLE, THE ONLY SOURCE ───────────────────────────
let wsCache = null;
async function cdpEval(expression, timeoutMs = 180000) {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const targets = await r.json();
  const pages = targets.filter((t) => t.type === "page" && !t.url.startsWith("data:") && t.url !== "about:blank");
  if (!pages.length) throw new Error("no renderer page target on CDP " + PORT);
  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error("CDP timeout")); }, timeoutMs);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
    ws.onmessage = (m) => {
      clearTimeout(timer);
      const d = JSON.parse(m.data);
      try { ws.close(); } catch {}
      if (d.result && d.result.exceptionDetails) return reject(new Error(d.result.exceptionDetails.text));
      resolve(d.result && d.result.result ? d.result.result.value : null);
    };
    ws.onerror = () => { clearTimeout(timer); reject(new Error("CDP socket error")); };
  });
}

// THERE IS ONLY ONE AUTHORITY WEBVIEW AND IT IS SERIALIZED ACROSS ALL FIVE AUTHORITIES
// (verified BP149 by reading runBrowserAuthorityQueryFromMainObserved in src/main/index.ts).
// First live run showed a fail-success-fail pattern across three stages of ONE question, with the
// failing queries SHORTER than the succeeding one, so length was not the cause. The webview needs
// settling time between navigations. Cooldown plus one retry, both reported, never silent.
let lastCallEndedAt = 0;
const COOLDOWN_MS = 4000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function askGoogleOnce(query) {
  const expr = `(async()=>{ try {
    const res = await window.amplify.runBrowserAuthorityQuery({ authority: 'user_google', question: ${JSON.stringify(query)} });
    return JSON.stringify(res);
  } catch(e) { return JSON.stringify({ error: String(e && e.message || e) }); } })()`;
  const raw = await cdpEval(expr);
  let j = null;
  try { j = JSON.parse(raw); } catch { return { ok: false, text: "", sources: [], error: "unparseable CDP return" }; }
  // JSON.parse(null) returns null rather than throwing, so the catch above never fires on a null
  // CDP return and the old code then read j.error off null. That threw on every question in the
  // first run. Guard the shape, not just the parse.
  if (!j || typeof j !== "object") return { ok: false, text: "", sources: [], error: "CDP returned no object (authority call did not resolve)" };
  if (j.error) return { ok: false, text: "", sources: [], error: j.error };
  // Verified live against runBrowserAuthorityQuery: the return carries
  // { snippet, sourceUrl, authority, selectorUsed, citations, results }. `snippet` is the answer
  // text; the earlier field order guessed at fact/answer first and only reached snippet by luck.
  // Verified live: the return carries { snippet, sourceUrl, authority, selectorUsed, citations,
  // results }. `snippet` is populated only when Google renders an ANSWER BOX for the query.
  //
  // ORGANIC-RESULTS FALLBACK, and it exists because of a measured failure. On the first live run
  // the Stage 5 query navigated successfully -- the webview was left parked on its exact search
  // URL -- but returned no snippet, because that query produced no answer box. The organic results
  // were captured and sitting in `j.results` the whole time, unused. That is the same defect shape
  // found twice already tonight: scraped, carried partway, then dropped. Google answered; nothing
  // read the answer.
  // MEASURED, AND IT IS WHY BOTH ARE USED RATHER THAN ONE AS A FALLBACK.
  // Asked "population densities of A) South America C) North Africa E) Europe F) Central Asia",
  // the ANSWER BOX returned COUNTRY densities -- Macau, Monaco, Singapore -- answering a question
  // that was not asked. The ORGANIC RESULTS, captured in the same call and previously unused,
  // contained "Europe: 72 people per square kilometer ... South America: 25 people per square
  // kilometer": exactly the regional figures the cascade needs, and matching the Founder's own
  // hand-worked 25/km2 for South America.
  //
  // So a fallback-only design would still have taken the worse source here. Both are handed to
  // extraction, answer box first, and the CODE accepts a value only when it maps to an option's
  // exact text. An off-target answer box then simply contributes nothing rather than poisoning
  // the result. This is also what the Founder does by hand: he reads the whole page.
  const snip = j.snippet || j.fact || j.answer || (j.result && (j.result.snippet || j.result.fact)) || "";
  const rs = Array.isArray(j.results) ? j.results : (j.result && Array.isArray(j.result.results) ? j.result.results : []);
  const organic = rs.slice(0, 6).map((r) => {
    if (typeof r === "string") return r;
    return [r.title, r.snippet || r.description].filter(Boolean).join(" -- ");
  }).filter(Boolean).join("\n");
  const parts = [];
  if (snip && String(snip).trim()) parts.push(String(snip).trim());
  if (organic) parts.push(organic);
  const text = parts.join("\n");
  const via = `${snip ? "answer_box" : "no_answer_box"}+organic(${rs.length})`;
  const sources = j.citations || j.sources || (j.result && j.result.citations) || [];
  return { ok: Boolean(text && String(text).trim()), text: String(text).trim(), sources, via, raw: j };
}

// Cooldown before, one retry on a non-answer, both announced so a retried result is never
// mistaken for a first-try result.
async function askGoogle(query) {
  const since = Date.now() - lastCallEndedAt;
  if (since < COOLDOWN_MS) await sleep(COOLDOWN_MS - since);
  let res;
  try { res = await askGoogleOnce(query); }
  catch (e) { res = { ok: false, text: "", sources: [], error: e.message }; }
  if (!res.ok) {
    note(`no answer on first try (${res.error || "empty"}) -- settling 8s and retrying once`);
    await sleep(8000);
    try { res = await askGoogleOnce(query); }
    catch (e) { res = { ok: false, text: "", sources: [], error: e.message }; }
    if (res.ok) note("retry succeeded");
  }
  lastCallEndedAt = Date.now();
  return res;
}

// ─────────────────────────── GEMMA, MECHANICAL ONLY ───────────────────────────
// She is never shown the options and asked to choose. Every call below asks for a NAMED
// EXTRACTION whose answer is checkable against the passage it came from.
async function gemmaExtract(instruction, passage, shape) {
  const prompt = `Extract information from the passage. Do not reason about which answer is correct. Do not choose between options. Only report what the passage states.

PASSAGE:
${passage}

TASK: ${instruction}

Return ONLY JSON in exactly this shape, no prose, no markdown fence:
${shape}
If the passage does not state it, use null. Never guess.`;
  const r = await fetch(OLLAMA, {
    method: "POST", headers: { "Content-Type": "application/json" },
    // HARD BINDING, canon 2026-06-15: think:false and num_predict >= 256 on any parseable call.
    body: JSON.stringify({ model: MODEL, prompt, stream: false, think: false, options: { temperature: 0, num_predict: 512 } }),
  });
  const j = await r.json();
  const t = (j.response || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch { return null; }
}

// ─────────────────────────── THE CASCADE ───────────────────────────
function loadQuestion(qid) {
  const rows = fs.readFileSync(BUNDLE, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  for (const r of rows) if (r.question_id === qid) return r;
  return null;
}
const letter = (i) => String.fromCharCode(65 + i);

async function runQuestion(q) {
  const opts = {};
  q.options.forEach((o, i) => (opts[letter(i)] = o));
  const optList = Object.entries(opts).map(([k, v]) => `${k}) ${v}`).join("  ");

  say("");
  say(`${C.b}══ qid ${q.question_id} ${C.dim}[${q.category}]${C.x}`);
  say(`${C.dim}   ${q.question}${C.x}`);
  say(`${C.dim}   ${optList}${C.x}`);

  const trail = [];
  let pool = Object.keys(opts);
  const sourcesAll = [];

  // ── STAGE 0: VET THE QUESTION. His own first rule.
  step("STAGE 0  vet the question, determine the register");
  // His own first rule (Excerpt 3): "FIRST. Figure out what the question is actually asking, with
  // context like how curriculum framing is taught and deserts and rainforests are not counted as
  // regions." So the register probe must be about ELIGIBILITY of the listed options as members of
  // the category the question names, not a generic "define the terms" that returns a field summary.
  const g0 = await askGoogle(`${q.question} Of these specific choices, which are NOT normally taught as members of the category this question is asking about, and why? ${optList}`);
  if (g0.ok) {
    fact(`Google [${g0.via}]: ${g0.text.slice(0, 180).split(String.fromCharCode(10)).join(" | ")}`);
    sourcesAll.push(...g0.sources);
    const reg = await gemmaExtract(
      "List the technical terms this passage defines, and for each, the field or register it belongs to.",
      g0.text, `{"terms":[{"term":"...","register":"..."}]}`);
    if (reg && reg.terms) { for (const t of reg.terms.slice(0, 4)) note(`term: ${t.term} -- register: ${t.register}`); }
    trail.push({ stage: 0, query: g0.raw ? "register probe" : "", text: g0.text, sources: g0.sources, extracted: reg });
  } else { note(`no Google answer (${g0.error || "empty"})`); }

  // ── STAGE 1: ASK THE INVERSE.
  //
  // THE FRAMING SHAPE IS THE FOUNDER'S, NOT A PARAPHRASE OF IT. His hand-worked qid 98 query,
  // verbatim from FounderCascadeWorkedByHand.txt Excerpt 2:
  //   "Which of the following world regions is considered one of the world's most densely
  //    populated regions? A) South America B) Western Europe C) South Asia ..."
  // The lettered options go INSIDE the query. The first run of this script appended them as a
  // trailing sentence instead, and Google answered a different question entirely -- for qid 98 it
  // returned US STATE densities ("New Jersey is the most densely populated state"), from which
  // Gemma faithfully extracted "Northeast United States". The extraction was correct; the
  // question was wrong. Putting the options in the query is what pins the answer to the option set.
  step("STAGE 1  ask the inverse");
  const inverseQ = `${q.question.replace(/\bNOT\b/, "").replace(/\s+/g, " ").trim()} ${optList}`;
  const g1 = await askGoogle(inverseQ);
  let asserted = [];
  if (g1.ok) {
    fact(`Google [${g1.via}]: ${g1.text.slice(0, 180).split(String.fromCharCode(10)).join(" | ")}`);
    sourcesAll.push(...g1.sources);
    // MECHANICAL: which of these named entities does the passage assert the property of?
    const ex = await gemmaExtract(
      `The passage discusses some of these items: ${Object.values(opts).join("; ")}. List ONLY the items the passage explicitly says HAVE the property being discussed. Copy each item's wording exactly from the list above.`,
      g1.text, `{"asserted":["exact item text"]}`);
    if (ex && Array.isArray(ex.asserted)) {
      // The CODE maps text back to letters by exact membership, never by similarity.
      for (const a of ex.asserted) {
        for (const [L, txt] of Object.entries(opts)) {
          if (txt.toLowerCase().trim() === String(a).toLowerCase().trim()) asserted.push(L);
        }
      }
      asserted = [...new Set(asserted)];
      if (asserted.length) fact(`asserted-to-have-the-property: ${asserted.join(", ")}`);
      else note("Gemma named nothing that maps EXACTLY to an option (no similarity fallback, by design)");
    }
    trail.push({ stage: 1, query: inverseQ, text: g1.text, sources: g1.sources, extracted: ex, mappedLetters: asserted });
  } else { note(`no Google answer (${g1.error || "empty"})`); }

  // ── STAGE 2: JAR METHOD. Remove what we now KNOW is not the answer.
  step("STAGE 2  Jar Method");
  const isNegated = /\bNOT\b/.test(q.question);
  if (asserted.length && isNegated) {
    const before = pool.length;
    pool = pool.filter((L) => !asserted.includes(L));
    fact(`removed ${before - pool.length} option(s) asserted to HAVE the property (question asks which does NOT): ${asserted.join(", ")}`);
    say(`${C.dim}       pool: ${pool.join(", ")}${C.x}`);
  } else if (asserted.length) {
    pool = asserted.length ? asserted : pool;
    fact(`kept only asserted options: ${pool.join(", ")}`);
  } else { note("nothing eliminable from stage 1"); }

  // ── STAGE 5: TERMINATE ON THE HARD NUMBER. His rule 5.
  step("STAGE 5  terminate on the hard number");
  let verdict = null, basis = "";
  // His rule 5, verbatim shape from Excerpt 2: "What are the population densities of each of the
  // following world regions?: A) South America B) Western Europe C) South Asia ..." -- the
  // lettered options inside the query, exactly as with the inverse.
  const g5 = await askGoogle(`What are the relevant numeric values for each of the following, with units? ${pool.map((L) => `${L}) ${opts[L]}`).join(" ")}`);
  if (g5.ok) {
    fact(`Google [${g5.via}]: ${g5.text.slice(0, 240).split(String.fromCharCode(10)).join(" | ")}`);
    sourcesAll.push(...g5.sources);
    const nums = await gemmaExtract(
      `For each of these items, report the single numeric value the passage gives, and the unit. Items: ${pool.map((L) => opts[L]).join("; ")}. Copy item wording exactly.`,
      g5.text, `{"values":[{"item":"exact item text","value":number,"unit":"..."}]}`);
    const byLetter = {};
    if (nums && Array.isArray(nums.values)) {
      for (const v of nums.values) {
        for (const L of pool) {
          if (opts[L].toLowerCase().trim() === String(v.item).toLowerCase().trim() && typeof v.value === "number") byLetter[L] = v;
        }
      }
    }
    const have = Object.keys(byLetter);
    if (have.length >= 2) {
      const sorted = have.sort((a, b) => byLetter[a].value - byLetter[b].value);
      note(`ranked: ${sorted.map((L) => `${L}=${byLetter[L].value}${byLetter[L].unit || ""}`).join("  ")}`);
      const lo = byLetter[sorted[0]].value, next = byLetter[sorted[1]].value;
      const sep = next === 0 ? Infinity : next / (lo || 1e-9);
      if (sep >= 1.5) { verdict = sorted[0]; basis = `lowest value with ${sep.toFixed(1)}x separation from the runner-up`; }
      else note(`separation only ${sep.toFixed(2)}x -- below the 1.5x bar, will not terminate on it`);
    } else note(`only ${have.length} option(s) got an exact-matched number -- cannot rank`);
    trail.push({ stage: 5, text: g5.text, sources: g5.sources, extracted: nums, byLetter });
  } else { note(`no Google answer (${g5.error || "empty"})`); }

  // ── DECIDE, or abstain honestly.
  if (!verdict && pool.length === 1) { verdict = pool[0]; basis = "sole survivor after elimination"; }

  const correct = q.answer;
  const ok = verdict === correct;
  say("");
  if (verdict) say(`   ${ok ? C.g + "CORRECT" : C.r + "WRONG"}${C.x}  chose ${C.b}${verdict}${C.x} (${opts[verdict]})  key=${correct}`);
  else say(`   ${C.y}ABSTAIN${C.x}  pool=${pool.join(",")}  key=${correct}`);
  if (basis) note(`basis: ${basis}`);

  return { qid: q.question_id, question: q.question, options: opts, verdict, correct, ok, pool, basis, trail, sources: sourcesAll };
}

// ─────────────────────────── MAIN ───────────────────────────
say(`${C.b}FOUNDER CASCADE v2${C.x}  -- Google is the only source. Gemma extracts. The code decides.`);
say(`${C.dim}model=${MODEL}  qids=${QIDS.join(",")}  cost=$0${C.x}`);

try { const v = await fetch(`http://127.0.0.1:${PORT}/json/version`); say(`${C.dim}CDP ${PORT}: up (${v.status})${C.x}`); }
catch { say(`${C.r}CDP ${PORT} is DOWN. Start MnemosyneC dev (npm run dev:renderer + npm run dev:main:cdp) and retry.${C.x}`); process.exit(1); }

const t0 = Date.now();
const results = [];
for (const qid of QIDS) {
  const q = loadQuestion(qid);
  if (!q) { say(`${C.r}qid ${qid} not in the bundle${C.x}`); continue; }
  try { results.push(await runQuestion(q)); }
  catch (e) { say(`${C.r}qid ${qid} threw: ${e.message}${C.x}`); results.push({ qid, verdict: null, correct: q.answer, ok: false, error: e.message, trail: [], sources: [] }); }
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);

const correct = results.filter((r) => r.ok).length;
const wrong = results.filter((r) => r.verdict && !r.ok).length;
const abst = results.filter((r) => !r.verdict).length;

say("");
say(`${C.b}══ TOTALS${C.x}   correct ${C.g}${correct}${C.x} / wrong ${C.r}${wrong}${C.x} / abstain ${C.y}${abst}${C.x}   ${secs}s   $0`);
say(`${C.dim}An abstain is a correct outcome on a question with no single answer. qid 92 is one.${C.x}`);

const md = `# FOUNDER CASCADE v2 -- RESULTS

**Google is the only source. Gemma extracts structure, never judges. The code decides.**

Founder, BP149: *"Use Gemma, and only use Google as the source. with my cascade."*

| Figure | Value |
|---|---|
| Correct | ${correct} / ${results.length} |
| Wrong | ${wrong} / ${results.length} |
| Abstained | ${abst} / ${results.length} |
| Wall-clock | ${secs}s |
| Cost | **$0** |
| Model | \`${MODEL}\`, local Ollama |

**What v1 did wrong, recorded so it is not repeated:** the first build contained ZERO Ollama call sites and scored options by term/bigram overlap. On qid 46 every option scored an identical 0.35 because the options are permutations of one vocabulary. Overlap cannot separate meanings built from the same words, which is exactly what the Founder's synonym doctrine forbids.

| qid | verdict | key | outcome | basis |
|---|---|---|---|---|
${results.map((r) => `| ${r.qid} | ${r.verdict || "ABSTAIN"} | ${r.correct} | ${r.ok ? "CORRECT" : r.verdict ? "WRONG" : "abstain"} | ${r.basis || "-"} |`).join("\n")}

## Derivation trails

${results.map((r) => `### qid ${r.qid}

**Question:** ${r.question || ""}

${(r.trail || []).map((t) => `**Stage ${t.stage}**\n\n> ${(t.text || "").slice(0, 600)}\n\nExtracted: \`${JSON.stringify(t.extracted)}\`${t.mappedLetters ? `\nMapped to letters: ${t.mappedLetters.join(", ") || "(none)"}` : ""}\n\nSources: ${(t.sources || []).slice(0, 5).map((s) => typeof s === "string" ? s : (s.url || JSON.stringify(s))).join(" · ") || "(none captured)"}`).join("\n\n")}

**Result:** ${r.verdict || "ABSTAIN"} against key ${r.correct}. ${r.basis || ""}
`).join("\n---\n\n")}

*D-BP149-033 / BISHOP / S33 / seg-cascadev2. Every letter chosen here was chosen by arithmetic over extracted facts, never by a model picking among options.*
`;
fs.writeFileSync(OUT, md, "utf8");
say(`${C.dim}wrote ${OUT}${C.x}`);
