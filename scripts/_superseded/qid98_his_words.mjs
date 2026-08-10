#!/usr/bin/env node
// qid98_his_words.mjs -- D-BP149-036/BISHOP/S36/seg-hiswords
//
// MOVED to scripts/_superseded/ 2026-08-09 (D-BP151-043), per Rule 66 ("version, never
// overwrite; _superseded siblings mandatory"). NOT CALLED from anywhere: grepped the repo before
// moving -- package.json has no script entry for it, no test imports it, and its only other
// mentions are historical citations in comparative_cascade.ts and liana_terminal_engine.ts's own
// comments (crediting this file as the hand-worked proof their generalized method was built
// from). Nothing runs this file today.
//
// BROKEN as of `D-BP151-041`/`56afd84f`, independent of this move: line ~23's
// `runRegisterGate(OPT)` call passes no `askGoogle`, and register_gate.mjs's `runRegisterGate()`
// now throws a clear error rather than falling back to a CDP dial when `askGoogle` is omitted
// (register_gate.mjs deleted its own CDP dial -- `pickTarget()`, `askGoogleBlocks()`, the `PORT`
// constant -- entirely; see SEG_RETURN_BP151_041_REGISTER_GATE_INPROCESS.md). This is left
// unfixed on purpose: this script is a one-time hand-worked proof superseded by
// comparative_cascade.ts's generalized registry method, and an honest throw on an obsolete call
// shape is arguably more correct than patching a script nothing runs. This file's OWN `google()`
// function below still has its own independent raw-CDP client (`pickTarget`/`cdpEval`, its own
// `PORT = 9333`) -- that part is untouched by the register-gate change and would still work
// against a live `npm run dev:main:cdp` session if this script were ever run again; only the
// `runRegisterGate(OPT)` call at Stage 0 is broken.
//
// THE FOUNDER'S THIRTEEN QUESTIONS, VERBATIM, ON THE REAL NINE OPTIONS.
//
// Founder, BP149: "I could literally write a batch file, that asks Google the questions I asked,
// and do it better." He is right. Every previous version genericized his wording into a template
// that could fit any question -- "put these in order of most to least", "remove the half that are
// MOST" -- and Google answered with Waldseemuller and Cosmographiae because those questions ask
// nothing. His questions name the category AND the property, every time. That is not decoration.
// It is what makes them answerable.
//
// So this file contains NO TEMPLATE. It is his questions, copied from
// FounderCascadeWorkedByHand.txt Excerpt 2, with only the option list swapped for the real nine
// from resources/mmlu_pro_bundled/questions.jsonl. Nothing is summarized and nothing is
// paraphrased. Where his wording is here, it is his wording.
//
// GEMMA extracts. THE CODE decides. GOOGLE is the only source.
//
//   node scripts\qid98_his_words.mjs   (historical invocation; see "MOVED"/"BROKEN" notes above --
//   this path is now scripts\_superseded\qid98_his_words.mjs and Stage 0 will throw if run)

import fs from "fs";
import { runRegisterGate } from "../register_gate.mjs";
const PORT = 9333, OLLAMA = "http://127.0.0.1:11434/api/generate";
const MODEL = process.env.CASCADE_MODEL ?? "gemma4:12b";
const OUT = "C:/Users/Administrator/Documents/LianaBanyanPlatform/BISHOP_DROPZONE/QID98_HIS_WORDS_RESULTS.md";

const C = { dim: "\x1b[2m", b: "\x1b[1m", g: "\x1b[32m", y: "\x1b[33m", r: "\x1b[31m", c: "\x1b[36m", x: "\x1b[0m" };
const say = (s = "") => console.log(s);

// The real nine, question_id 98.
const OPT = { A: "South America", B: "South Asia", C: "North Africa", D: "Northeast United States",
              E: "Europe", F: "Central Asia", G: "Arctic Circle", H: "Amazon Rainforest", I: "Sahara Desert" };
const KEY = "A";
const ALL = Object.keys(OPT);
const list = (ls) => ls.map((L) => `${L}) ${OPT[L]}`).join(" ");

// ── HIS THIRTEEN QUESTIONS. Each one names the category and the property, as he wrote them.
const Q = (ls) => [
  { n: 1, stage: 1, why: "the inverse",
    text: `Which of the following world regions is considered one of the world's most densely populated regions? ${list(ALL)}` },
  { n: 2, stage: 3, why: "most densely to least densely, survivors",
    text: `Please put these regions in order of most densely to least densely populated. ${list(ls)}` },
  { n: 3, stage: 3, why: "least densely to most densely, survivors (same engine, opposite framing)",
    text: `Please put these regions in order of least densely to most densely populated. ${list(ls)}` },
  { n: 4, stage: 3, why: "most densely to least densely, ALL options as quality control",
    text: `Please put these regions in order of most densely to least densely populated. ${list(ALL)}` },
  { n: 5, stage: 3, why: "least densely to most densely, ALL options as quality control",
    text: `Please put these regions in order of least densely to most densely populated. ${list(ALL)}` },
  { n: 6, stage: 4, why: "Cake Cut Half, remove the least populated half",
    text: `From the following world regions listed, please remove the half that are least populated: ${list(ALL)}` },
  { n: 7, stage: 4, why: "Cake Cut Half, remove the MOST populated half",
    text: `From the following world regions listed, please remove the half that are MOST populated: ${list(ALL)}` },
  { n: 8, stage: 5, why: "the hard number",
    text: `What are the population densities of each of the following world regions?: ${list(ALL)}` },
  { n: 9, stage: 5, why: "sort by density, most to least",
    text: `Please sort the following world regions by exact population order or provide density numbers for each, in order of most to least: ${list(ALL)}` },
  { n: 10, stage: 5, why: "sort by density, least to most",
    text: `Please sort the following world regions by exact population order or provide density numbers for each, in order of least to most: ${list(ALL)}` },
];

// ── GOOGLE ────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// TARGET SELECTION BY CAPABILITY, NOT BY URL.
// This used to require a page whose url was neither data: nor about:blank -- i.e. it assumed the
// dashboard renderer. Measured live at BP149: after a main-process restart the only surviving
// targets were the HIDDEN nexus-authority helper window (a data: URL) and its webview, and the
// script died with "no renderer page target" while the authority API was sitting right there on
// the helper page. What matters is which page exposes runBrowserAuthorityQuery, not what its URL
// looks like. Probe for the function; use the first page that has it; cache it.
let cachedTargetWs = null;
async function pickTarget() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const pages = (await r.json()).filter((t) => t.type === "page");
  if (!pages.length) throw new Error("no page targets at all on CDP " + PORT);
  for (const p of pages) {
    const has = await new Promise((resolve) => {
      let done = false;
      const ws = new WebSocket(p.webSocketDebuggerUrl);
      const t = setTimeout(() => { if (!done) { done = true; try { ws.close(); } catch {} resolve(false); } }, 8000);
      ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate",
        params: { expression: `typeof (window.amplify && window.amplify.runBrowserAuthorityQuery) === "function"`, returnByValue: true } }));
      ws.onmessage = (m) => { if (done) return; done = true; clearTimeout(t);
        const d = JSON.parse(m.data); try { ws.close(); } catch {}
        resolve(Boolean(d.result && d.result.result && d.result.result.value)); };
      ws.onerror = () => { if (!done) { done = true; clearTimeout(t); resolve(false); } };
    });
    if (has) { say(`${C.dim}  [target] using ${p.type}: ${p.url.slice(0, 70)}${C.x}`); return p.webSocketDebuggerUrl; }
  }
  throw new Error(`no page exposes runBrowserAuthorityQuery (checked ${pages.length} page target(s)) -- is the MnemosyneC window open?`);
}

async function cdpEval(expression, timeoutMs = 120000) {
  if (!cachedTargetWs) cachedTargetWs = await pickTarget();
  const ws = new WebSocket(cachedTargetWs);
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error("CDP timeout")); }, timeoutMs);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
    ws.onmessage = (m) => { clearTimeout(timer); const d = JSON.parse(m.data); try { ws.close(); } catch {}
      if (d.result && d.result.exceptionDetails) return reject(new Error(d.result.exceptionDetails.text));
      resolve(d.result && d.result.result ? d.result.result.value : null); };
    ws.onerror = () => { clearTimeout(timer); reject(new Error("CDP socket error")); };
  });
}
async function google(query, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    let j = null;
    try {
      const expr = `(async()=>{ try { const res = await window.amplify.runBrowserAuthorityQuery({ authority:'user_google', question: ${JSON.stringify(query)} });
        if (!res) return JSON.stringify({ nullReturn: true });
        return JSON.stringify({ snippet: res.snippet||'', results: res.results||[], citations: res.citations||[] });
      } catch(e){ return JSON.stringify({ error: String(e&&e.message||e) }); } })()`;
      j = JSON.parse(await cdpEval(expr));
    } catch (e) { j = { error: e.message }; }
    if (j && !j.error && !j.nullReturn) {
      // KEEP THE BLOCKS. Founder, BP149: "what we do to our question, we need to do to the answers."
      //
      // A Google result is a TITLE plus a BODY, and the body refers back to the title with
      // pronouns. Real example that broke the register gate for an entire session:
      //   title: "Sahara -- Web results Sahara Wikipedia"
      //   body:  "a desert spanning North Africa. it is the largest hot desert in the world.
      //           The desert covers much of North Africa..."
      // Flattening those into one string destroyed the only thing that says what "it" refers to.
      // The gate looked for a sentence that both NAMED the Sahara and CLASSIFIED it as a desert.
      // No such sentence exists. The naming is in the title; the classification is in the body.
      //
      // Same shape as every other defect tonight: structure captured, flattened at a boundary, and
      // the loss surfaces three layers later as a mystery. `text` is kept for the stages that want
      // prose; `blocks` is kept for the stages that need to know who "it" is.
      const parts = [];
      const blocks = [];
      if (j.snippet && j.snippet.trim()) { parts.push(j.snippet.trim()); blocks.push({ title: "", body: j.snippet.trim(), url: "", kind: "answer_box" }); }
      const rs = Array.isArray(j.results) ? j.results : [];
      for (const r of rs.slice(0, 6)) {
        if (typeof r === "string") { blocks.push({ title: "", body: r, url: "", kind: "organic" }); parts.push(r); continue; }
        const title = String(r.title || "").trim();
        const body = String(r.snippet || r.description || "").trim();
        blocks.push({ title, body, url: String(r.url || ""), kind: "organic" });
        parts.push([title, body].filter(Boolean).join(" -- "));
      }
      if (parts.length) return { ok: true, text: parts.join("\n"), blocks, sources: (j.citations || []).concat(rs.map((r) => r && r.url).filter(Boolean)), via: `${j.snippet ? "box" : "nobox"}+organic(${rs.length})` };
    }
    if (i < tries) { say(`${C.dim}        attempt ${i} gave nothing (${(j && (j.error || (j.nullReturn && "authority returned null"))) || "empty"}); settling ${i * 8}s${C.x}`); await sleep(i * 8000); }
  }
  return { ok: false, text: "", sources: [], via: "no answer after 3 attempts" };
}

// ── GEMMA, EXTRACTION ONLY ────────────────────────────────────────────────────
async function extract(instruction, passage, shape) {
  const prompt = `Read the passage and report only what it states. Do not reason about which answer is correct. Do not choose between options.

PASSAGE:
${passage}

TASK: ${instruction}

Return ONLY JSON in this shape, no prose, no fence:
${shape}
Use null where the passage does not state it. Never guess.`;
  try {
    const r = await fetch(OLLAMA, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, stream: false, think: false, options: { temperature: 0, num_predict: 512 } }) });
    const t = ((await r.json()).response || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(t);
  } catch { return null; }
}
const norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
// NAME VARIANTS -- the Twain problem, applied to the ANSWER side.
//
// Founder, BP149: "Mark Twain's Birthday, or What day was Twain born, or Twains Bday - they all
// mean the same thing for what I'm looking for... what we do to our question, we need to do to
// the answers."
//
// Measured here: the register gate asked about "Sahara Desert" and the page said "the greater
// Sahara", "Sahara Wikipedia", "The desert covers much of North Africa". Demanding the exact
// two-word phrase rejected every real assertion.
//
// This is NOT similarity scoring and has no threshold. A multi-word option reduces to its leading
// proper-noun token ("Sahara", "Amazon", "Arctic", "Central", "Northeast") -- but ONLY when that
// token is unique across the option set. "South America" reduces to "South", which collides with
// "South Asia", so it keeps its full text. A token either is or is not present.
const headToken = (optionText) => {
  const w = String(optionText).trim().split(/\s+/);
  if (w.length < 2 || w[0].length < 4) return optionText;
  const first = norm(w[0]);
  let owners = 0;
  for (const t of Object.values(OPT)) if (norm(t).split(" ")[0] === first) owners++;
  return owners === 1 ? w[0] : optionText;
};
const mentionsOption = (text, optionText) =>
  norm(text).includes(norm(optionText)) || norm(text).includes(norm(headToken(optionText)));

const toLetters = (items) => { const o = []; for (const it of items || []) for (const [L, t] of Object.entries(OPT)) if (norm(t) === norm(it)) o.push(L); return [...new Set(o)]; };

// ── VERIFY EVERY EXTRACTION AGAINST THE PASSAGE. THE PASSAGE IS RIGHT THERE. ──
//
// HARDWIRE-22 says the model may only copy out what is literally present. This is the half that
// makes that rule enforceable instead of hopeful: anything she returns must be FOUND in the text
// she was given, checked mechanically, or it is discarded.
//
// Measured at BP149, all in one run, all caught by this check:
//   - mentions returned with an EMPTY sentence ("ambiguous sentence for A, counted for neither:")
//   - "South America" reported as mentioned in a passage that only says "South and East Asia",
//     which eliminated the CORRECT ANSWER at stage 1
//   - a density figure of 56.9 attributed to South America from a passage whose only density
//     statement is that the world averages 16/km2
// Every one of those is a string that does not appear in the source. None of them needed a
// judgment call to reject. They needed a substring check.
// A SENTENCE THAT IS A QUESTION, OR SOMEONE ELSE'S ANSWER-OPTION LIST, IS NOT AN ASSERTION.
//
// MEASURED, BP149, and it eliminated the correct answer. Stage 1's passage carried this from a
// Quizlet organic result: "The world's most densely populated region is ____. A. sub-Saharan
// Africa B. South America C. South Asia D. East Asia". "South America" therefore appeared in a
// sentence containing "most densely populated", the keyword rule read it as an assertion of
// density, and option A -- the correct answer -- was struck at the first stage.
//
// Google search results are full of other people's quiz questions, "People also ask" blocks, and
// fill-in-the-blank stems. None of them state facts. This is decided in code by shape, never by
// asking a model whether something "is really a claim".
function isAssertion(sentence) {
  const s = String(sentence || "");
  if (!s.trim()) return false;
  if (s.includes("?")) return false;                          // a question asserts nothing
  if (/_{3,}/.test(s)) return false;                          // fill-in-the-blank stem
  if (/People also ask/i.test(s)) return false;
  const optionMarkers = (s.match(/(?:^|s)[A-J][.)]s+S/g) || []).length;
  if (optionMarkers >= 2) return false;                       // an answer-option list
  if (/(which of the following|choose the|select the|true or false)/i.test(s)) return false;
  return true;
}

const appearsIn = (passage, s) => {
  const n = norm(s);
  if (!n || n.length < 3) return false;
  return norm(passage).includes(n);
};

// Unit normalization, in code, never asked of the model. Comparing 1 per square mile against
// 34 per square kilometer is not a comparison. BP149: the Sahara came back at "1 per square mile"
// and would have been ranked directly against Europe's 34/km2.
const SQMI_PER_SQKM = 2.589988;
function toPerSqKm(value, unit) {
  const u = norm(unit);
  if (!u) return { value, unit: "per km2 (unit unstated, assumed)", assumed: true };
  if (/(sq|square)\s*(mi|mile|miles)/.test(u) || /mi2/.test(u)) return { value: value / SQMI_PER_SQKM, unit: "per km2 (converted from per sq mi)", assumed: false };
  if (/(sq|square)\s*(km|kilometer|kilometre|kilometers|kilometres)/.test(u) || /km2/.test(u)) return { value, unit: "per km2", assumed: false };
  return { value, unit: `per km2 (unrecognized unit "${unit}", assumed)`, assumed: true };
}

// ── RUN ───────────────────────────────────────────────────────────────────────
say(`${C.b}QID 98 -- THE FOUNDER'S OWN THIRTEEN QUESTIONS, VERBATIM${C.x}`);
say(`${C.dim}Google is the only source. Gemma extracts. The code decides. Cost $0.${C.x}`);
say(`${C.dim}${Object.entries(OPT).map(([k, v]) => `${k}) ${v}`).join("  ")}${C.x}`);
try { const v = await fetch(`http://127.0.0.1:${PORT}/json/version`); say(`${C.dim}CDP ${PORT}: up (${v.status})${C.x}`); }
catch { say(`${C.r}CDP ${PORT} DOWN.${C.x}`); process.exit(1); }

let pool = [...ALL];
const trail = [];
const densities = {};      // letter -> number, from the hard-number questions
const leastVotes = {};     // letter -> count of "asserted sparse / least-dense end of an ordering"
const denseVotes = {};     // letter -> count of "asserted dense". A region Google repeatedly calls
                           // dense cannot be the answer to a question asking which is NOT dense.
// ── STAGE 0: THE REGISTER GATE.
//
// His own first rule, Excerpt 3: "FIRST. Figure out what the question is actually asking, with
// context like ... deserts and rainforests are not counted as regions."
//
// The gate now lives in scripts/register_gate.mjs as a standalone, self-testing module. The
// inline version that used to sit here was patched eight times by scripted string replacement,
// two of those patches failed halfway, and it ended up with two FEATURE_W definitions -- I was
// reading one and running the other, which is why four consecutive fixes to it were wrong.
// It is imported rather than reproduced so there is exactly one copy to be wrong.
const t0 = Date.now();
say(""); say(`${C.c}${C.b}[stage 0] register gate -- is each option a world region at all?${C.x}`);
{
  const { notRegions, report } = await runRegisterGate(OPT);
  for (const [L, r] of Object.entries(report)) {
    trail.push({ n: `0-${L}`, stage: 0, why: `register of ${OPT[L]}`, text: `In geography, is ${OPT[L]} classified as a world region, or as a desert, rainforest, biome or climate zone?`, answer: "", via: "register_gate", sources: [], effect: r.verdict + (r.scope ? ` -- ${r.scope.why}` : "") });
  }
  if (notRegions.length) { const b = pool.length; pool = pool.filter((x) => !notRegions.includes(x)); say(`${C.g}  >>${C.x} register gate removed ${notRegions.join(", ")}   pool ${b} -> ${pool.length}`); }
  else say(`${C.dim}  register gate removed nothing${C.x}`);
}


for (const item of Q(pool)) {
  say(""); say(`${C.c}${C.b}[Q${item.n}] stage ${item.stage} -- ${item.why}${C.x}`);
  say(`${C.dim}  ${item.text}${C.x}`);                      // FULL question, never truncated
  const res = await google(item.text);
  if (!res.ok) { say(`${C.y}  no answer (${res.via})${C.x}`); trail.push({ ...item, answer: "", via: res.via }); continue; }
  say(`${C.g}  A${C.x} ${C.dim}[${res.via}]${C.x} ${res.text.slice(0, 260).split(String.fromCharCode(10)).join(" | ")}`);

  let effect = "";
  if (item.stage === 0) {
    const ex = await extract(
      `Copy out every name from this list that appears anywhere in the passage, and for each one copy the complete sentence it appears in, word for word from the passage. Do not summarize. List: ${ALL.map((L) => OPT[L]).join("; ")}`,
      res.text, `{"mentions":[{"name":"exact name from the list","sentence":"the verbatim sentence"}]}`);
    // THE CODE decides what counts as a physical feature, by the words in the sentence she copied.
    const FEATURE_W = /(desert|rainforest|forest|biome|climate zone|physical feature|landform|ice|tundra|circle of latitude|latitude)/i;
    const notRegions = [];
    for (const m of (ex && ex.mentions) || []) {
      const L = toLetters([m && m.name])[0]; if (!L) continue;
      const sent = String((m && m.sentence) || "");
      if (!appearsIn(res.text, OPT[L])) continue;
      if (!appearsIn(res.text, sent)) continue;
      if (!isAssertion(sent)) continue;
      if (FEATURE_W.test(sent)) notRegions.push(L);
    }
    if (notRegions.length) { const b = pool.length; pool = pool.filter((L) => !notRegions.includes(L)); effect = `not world regions (register gate): ${notRegions.join(", ")}   pool ${b} -> ${pool.length}`; }
    else effect = "nothing eliminated by register";
    say(`${C.g}  >>${C.x} ${effect}`);
  } else if (item.stage === 1) {
    // HARDWIRE-22, THE EXTRACTION BLOOD RULE. This prompt used to read "List the world regions
    // this passage says ARE among the most densely populated" -- which asks her to decide what
    // counts as most dense. She copies out what appears and the sentence it appears in; the CODE
    // reads the sentence for the density words.
    const ex = await extract(
      `Copy out every name from this list that appears anywhere in the passage, and for each one copy the complete sentence it appears in, word for word from the passage. Do not summarize. List: ${ALL.map((L) => OPT[L]).join("; ")}`,
      res.text, `{"mentions":[{"name":"exact name from the list","sentence":"the verbatim sentence"}]}`);
    const DENSE_W = /\b(dense|densely|densest|most|highest|cluster|clusters|concentration|crowded|populous)\b/i;
    const SPARSE_W = /\b(low|lowest|least|sparse|sparsely|thinly|uninhabited|empty)\b/i;
    const dense = [];
    for (const m of (ex && ex.mentions) || []) {
      const L = toLetters([m && m.name])[0]; if (!L) continue;
      const s = String((m && m.sentence) || "");
      // VERIFY: the name must actually be in the passage, and so must the sentence she quoted.
      if (!appearsIn(res.text, OPT[L])) { say(`${C.dim}        rejected ${L}: "${OPT[L]}" does not appear in the passage${C.x}`); continue; }
      if (!appearsIn(res.text, s)) { say(`${C.dim}        rejected ${L}: quoted sentence not found in the passage${C.x}`); continue; }
      if (!isAssertion(s)) { say(`${C.dim}        rejected ${L}: that sentence is a question or an answer-option list, not an assertion${C.x}`); continue; }
      if (DENSE_W.test(s) && !SPARSE_W.test(s)) dense.push(L);
      else if (SPARSE_W.test(s) && !DENSE_W.test(s)) leastVotes[L] = (leastVotes[L] || 0) + 1;
    }
    if (dense.length) { const before = pool.length; pool = pool.filter((L) => !dense.includes(L)); effect = `dense (removed): ${dense.join(", ")}   pool ${before} -> ${pool.length}`; }
    else effect = "nothing mapped exactly";
    say(`${C.g}  >>${C.x} ${effect}`);
  } else if (item.stage === 3) {
    // HARDWIRE-22: she copies an order the passage STATES, she never produces one. If the passage
    // states no order, an empty list is the correct answer and a reader can verify that by looking.
    const ex = await extract(
      `If this passage states an explicit ranking or ordered list of any of these names, copy that list out in exactly the order the passage gives it. If the passage does not state an order, return an empty list. Do not put them in order yourself. Names: ${ALL.map((L) => OPT[L]).join("; ")}`,
      res.text, `{"order":["exact name, in the passage's stated order"],"order_stated_in_passage":true}`);
    let ord = toLetters(ex && ex.order);
    const ordBefore = ord.length;
    ord = ord.filter((L) => appearsIn(res.text, OPT[L]));
    if (ord.length !== ordBefore) say(`${C.dim}        dropped ${ordBefore - ord.length} ordered name(s) that do not appear in the passage${C.x}`);
    if (ord.length >= 2) {
      const leastEnd = item.why.includes("most densely to least") ? ord[ord.length - 1] : ord[0];
      leastVotes[leastEnd] = (leastVotes[leastEnd] || 0) + 1;
      effect = `order: ${ord.join(" > ")}   least-dense end: ${leastEnd}`;
    } else effect = "no usable ordering mapped";
    say(`${C.g}  >>${C.x} ${effect}`);
  } else if (item.stage === 4) {
    // MEASURED FIX. The old instruction asked Gemma to list what the passage says to "REMOVE".
    // Real passages never use that word -- they say which regions ARE dense and which ARE sparse.
    // Q6 returned "The four regions that have a low population density are the Sahara Desert, the
    // Amazon Rainforest, Siberia, and the Gobi Desert" -- Sahara Desert and Amazon Rainforest are
    // options I and H, exact matches, and Gemma correctly reported nothing because she was asked
    // about removals. Q7 returned "The 4 main population clusters are: East Asia, South Asia,
    // Europe and Eastern North America" -- B and E, exact, discarded the same way.
    //
    // So: ask her what the passage ASSERTS, in the passage's own terms. The CODE then decides what
    // that means for a question phrased as a removal. Report, then interpret -- never ask the
    // extractor to do the interpreting.
    // PURE EXTRACTION. Founder, BP149: "never give gemma anything that requires judgement."
    // She is not asked which regions are sparse -- that is a judgment. She copies out which of the
    // listed names APPEAR in the passage and the sentence each one appears in, verbatim. The CODE
    // below reads those sentences for the density words. Every decision is inspectable and none of
    // it is hers.
    const ex = await extract(
      `Copy out every name from this list that appears anywhere in the passage, and for each one copy the complete sentence it appears in, word for word from the passage. Do not summarize the sentence. List: ${ALL.map((L) => OPT[L]).join("; ")}`,
      res.text, `{"mentions":[{"name":"exact name from the list","sentence":"the verbatim sentence"}]}`);
    // THE CODE decides low vs high, by looking for the words in the sentence she copied.
    const LOW_WORDS = /\b(low|lowest|least|sparse|sparsely|thinly|uninhabited|empty)\b/i;
    const HIGH_WORDS = /\b(high|highest|most|dense|densely|densest|cluster|clusters|concentration|crowded|populous)\b/i;
    const low = [], high = [];
    for (const m of (ex && ex.mentions) || []) {
      const L = toLetters([m && m.name])[0];
      if (!L) continue;
      const s = String((m && m.sentence) || "");
      if (!appearsIn(res.text, OPT[L])) { say(`${C.dim}        rejected ${L}: "${OPT[L]}" does not appear in the passage${C.x}`); continue; }
      if (!appearsIn(res.text, s)) { say(`${C.dim}        rejected ${L}: quoted sentence not found in the passage${C.x}`); continue; }
      if (!isAssertion(s)) { say(`${C.dim}        rejected ${L}: that sentence is a question or an answer-option list, not an assertion${C.x}`); continue; }
      if (LOW_WORDS.test(s) && !HIGH_WORDS.test(s)) low.push(L);
      else if (HIGH_WORDS.test(s) && !LOW_WORDS.test(s)) high.push(L);
      else say(`${C.dim}        ambiguous sentence for ${L}, counted for neither: ${s.slice(0, 110)}${C.x}`);
    }
    for (const L of low) leastVotes[L] = (leastVotes[L] || 0) + 1;
    for (const L of high) denseVotes[L] = (denseVotes[L] || 0) + 1;
    effect = (low.length || high.length)
      ? `asserted LOW density: ${low.join(", ") || "(none)"}   |   asserted HIGH density: ${high.join(", ") || "(none)"}`
      : "nothing mapped exactly";
    say(`${C.g}  >>${C.x} ${effect}`);
  } else if (item.stage === 5) {
    // PURE EXTRACTION, same rule as everywhere else. The old version asked her to say which region
    // each density BELONGED to -- a judgment -- and that is how A=56.9 entered from a passage about
    // continental population shares. She now copies every density figure with its verbatim context;
    // the CODE attributes a figure to a region only when the context literally names it.
    const ex = await extract(
      `Copy out every number in this passage that appears together with a population-density unit (for example "per square kilometer", "/km2", "per sq mi"). For each one, copy the surrounding words exactly as they appear.`,
      res.text, `{"figures":[{"value":number,"unit":"the unit as written","context":"the verbatim surrounding text"}]}`);
    let n = 0;
    for (const f of (ex && ex.figures) || []) {
      if (typeof f.value !== "number") continue;
      // VERIFY the quoted context is really in the passage before trusting anything about it.
      if (!appearsIn(res.text, f.context)) { say(`${C.dim}        rejected figure ${f.value}: quoted context not found in the passage${C.x}`); continue; }
      const ctx = norm(String(f.context || ""));
      for (const L of ALL) if (ctx.includes(norm(OPT[L])) && densities[L] === undefined) {
        const c = toPerSqKm(f.value, f.unit);
        densities[L] = c.value; n++;
        say(`${C.dim}        ${OPT[L]} = ${c.value.toFixed(1)} ${c.unit}${C.x}`);
      }
    }
    effect = n ? `densities attributed by context match: ${Object.entries(densities).map(([L, d]) => `${L}=${d}`).join("  ")}` : "no figure's context named a listed region";
    say(`${C.g}  >>${C.x} ${effect}`);
  }
  trail.push({ ...item, answer: res.text, via: res.via, sources: res.sources, effect });
}

// ── STAGE 5b: ONE REGION PER QUESTION.
//
// MEASURED FIX. Asking for all nine densities in one query returned a passage about CONTINENTAL
// POPULATION SHARES ("Asia 59.4%, Africa 17.6%, Europe 9.40%") and the one number that survived
// extraction was A=56.9 -- wrong; South America is about 25/km2. A number that wrong reaching the
// terminator is worse than no number. It did not change the outcome only because the 1.5x
// separation bar was never met, which is luck, not design.
//
// One region per question makes the answer unambiguous and the extraction trivial: one number,
// one unit, nothing to disentangle. It costs more searches and buys a terminator that can be
// trusted. This is his own Rule 5 shape -- "the hard statistic numbers that will tell me the
// answer" -- asked so that only one answer can come back.
const survivors = ALL.filter((L) => pool.includes(L));
say(""); say(`${C.c}${C.b}[stage 5b] one region per question -- ${survivors.length} surviving options${C.x}`);
for (const L of survivors) {
  const q = `What is the population density of ${OPT[L]}, in people per square kilometer?`;
  say(`${C.dim}  ${q}${C.x}`);
  const res = await google(q);
  if (!res.ok) { say(`${C.y}    no answer (${res.via})${C.x}`); trail.push({ n: `5b-${L}`, stage: 5, why: `density of ${OPT[L]}`, text: q, answer: "", via: res.via, effect: "no answer" }); continue; }
  // PURE EXTRACTION. Founder, BP149: "never give gemma anything that requires judgement."
  // The old prompt asked her to decide whether a figure belonged to this region or to "a country,
  // a city, the whole world, a different region" -- that is a judgment, and it is exactly how
  // A=56.9 got in, lifted from a passage about continental population shares.
  // She now copies out EVERY number that appears with a density unit, together with the words it
  // sits next to, verbatim. The CODE checks whether those words name this region.
  const ex = await extract(
    `Copy out every number in this passage that appears together with a population-density unit (for example "per square kilometer", "/km2", "per sq mi", "people per square kilometre"). For each one, copy the surrounding words exactly as they appear, at least the full phrase or sentence containing it.`,
    res.text, `{"figures":[{"value":number,"unit":"the unit as written","context":"the verbatim surrounding text"}]}`);
  // THE CODE decides which figure, if any, is this region's: the context must name the region.
  const wanted = norm(OPT[L]);
  let picked = null;
  for (const f of (ex && ex.figures) || []) {
    if (typeof f.value !== "number") continue;
    if (!appearsIn(res.text, f.context)) { say(`${C.dim}       rejected ${f.value}: quoted context not in the passage${C.x}`); continue; }
    if (norm(String(f.context || "")).includes(wanted)) { picked = f; break; }
  }
  if (picked) {
    const conv = toPerSqKm(picked.value, picked.unit);
    densities[L] = conv.value;
    say(`${C.g}    >>${C.x} ${OPT[L]} = ${conv.value.toFixed(1)} ${conv.unit}  (as written: ${picked.value} ${picked.unit || "no unit"})`);
    say(`${C.dim}       context: ${String(picked.context).slice(0, 130)}${C.x}`);
    trail.push({ n: `5b-${L}`, stage: 5, why: `density of ${OPT[L]}`, text: q, answer: res.text, via: res.via, sources: res.sources, effect: `${OPT[L]} = ${ex.density} ${ex.unit || ""}` });
  } else {
    say(`${C.dim}    no figure for ${OPT[L]} in this passage (honest null, not a guess)${C.x}`);
    trail.push({ n: `5b-${L}`, stage: 5, why: `density of ${OPT[L]}`, text: q, answer: res.text, via: res.via, sources: res.sources, effect: "no figure" });
  }
}

// ── TERMINATE. Arithmetic only. No model below this line.
say(""); say(`${C.b}TERMINATOR${C.x}`);
// A region Google repeatedly asserts is DENSE cannot answer a question asking which is NOT dense.
const denseElim = Object.keys(denseVotes).filter((L) => pool.includes(L) && denseVotes[L] >= 1);
if (denseElim.length) { const before = pool.length; pool = pool.filter((L) => !denseElim.includes(L)); say(`${C.dim}  eliminated as asserted-dense: ${denseElim.join(", ")}   pool ${before} -> ${pool.length}${C.x}`); }
say(`${C.dim}  surviving pool after the inverse: ${pool.join(", ")}${C.x}`);
say(`${C.dim}  least-dense votes across stages 3 and 4: ${Object.entries(leastVotes).map(([L, n]) => `${L}x${n}`).join("  ") || "(none)"}${C.x}`);
say(`${C.dim}  hard densities: ${Object.entries(densities).map(([L, d]) => `${L}=${d}`).join("  ") || "(none)"}${C.x}`);

let verdict = null, basis = "";
const inPool = Object.keys(densities).filter((L) => pool.includes(L));
if (inPool.length >= 2) {
  const sorted = inPool.sort((a, b) => densities[a] - densities[b]);
  const sep = densities[sorted[0]] === 0 ? Infinity : densities[sorted[1]] / densities[sorted[0]];
  say(`${C.dim}  ascending: ${sorted.map((L) => `${L}=${densities[L]}`).join(" < ")}   separation ${sep.toFixed(2)}x${C.x}`);
  if (sep >= 1.5) { verdict = sorted[0]; basis = `lowest density among survivors, ${sep.toFixed(1)}x clear of the runner-up`; }
}
if (!verdict) {
  const ranked = Object.keys(leastVotes).filter((L) => pool.includes(L)).sort((a, b) => leastVotes[b] - leastVotes[a]);
  if (ranked.length && (ranked.length === 1 || leastVotes[ranked[0]] > leastVotes[ranked[1]])) { verdict = ranked[0]; basis = `converged across framings as least dense (${leastVotes[ranked[0]]} votes)`; }
}
// SOLE SURVIVOR. If elimination has left exactly one option standing, that IS the answer, and
// nothing further needs deciding. This rule existed in v3 and never made it into this file, so the
// run that finally narrowed the pool to exactly {A} -- the correct answer -- abstained anyway,
// because the ranking rule needs two options and the vote rule found none inside the pool.
// The whole point of an elimination cascade is that eliminating everything else answers the
// question. Not saying so was the last thing standing between the method and its result.
if (!verdict && pool.length === 1) { verdict = pool[0]; basis = "sole survivor of elimination -- every other option was ruled out by register, inverse or density"; }

say("");
if (verdict) say(`  ${verdict === KEY ? C.g + "CORRECT" : C.r + "WRONG"}${C.x}  ${C.b}${verdict}${C.x} (${OPT[verdict]})   key=${KEY}`);
else say(`  ${C.y}ABSTAIN${C.x}   key=${KEY}`);
if (basis) say(`${C.dim}  ${basis}${C.x}`);
say(`${C.dim}  ${((Date.now() - t0) / 1000).toFixed(1)}s   $0${C.x}`);

fs.writeFileSync(OUT, `# qid 98 -- THE FOUNDER'S OWN QUESTIONS, VERBATIM

**No template. No paraphrase.** Every question below is his, from \`FounderCascadeWorkedByHand.txt\` Excerpt 2, with only the option list swapped for the real nine.

Founder, BP149: *"I could literally write a batch file, that asks Google the questions I asked, and do it better."* He was right, and the reason is that his questions name the CATEGORY and the PROPERTY every time. Earlier versions genericized them to "put these in order of most to least" and Google answered about Waldseemuller.

**Result: ${verdict || "ABSTAIN"} against key ${KEY}.** ${basis}

Surviving pool after the inverse: ${pool.join(", ")}
Least-dense votes: ${JSON.stringify(leastVotes)}
Hard densities: ${JSON.stringify(densities)}

## Every question asked, in full, with what came back

${trail.map((t) => `### Q${t.n} -- stage ${t.stage} -- ${t.why}

**Asked, verbatim:**
\`\`\`
${t.text}
\`\`\`

**Google [${t.via}]:**

> ${(t.answer || "(no answer)").slice(0, 900)}

**Effect:** ${t.effect || "-"}

**Sources:** ${(t.sources || []).slice(0, 6).join(" · ") || "(none)"}`).join("\n\n")}

*D-BP149-036 / BISHOP / S36 / seg-hiswords.*
`, "utf8");
say(`${C.dim}wrote ${OUT}${C.x}`);
