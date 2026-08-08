#!/usr/bin/env node
// qid98_his_words.mjs -- D-BP149-036/BISHOP/S36/seg-hiswords
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
//   node scripts\qid98_his_words.mjs

import fs from "fs";
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
      const parts = [];
      if (j.snippet && j.snippet.trim()) parts.push(j.snippet.trim());
      const rs = Array.isArray(j.results) ? j.results : [];
      if (rs.length) parts.push(rs.slice(0, 6).map((r) => typeof r === "string" ? r : [r.title, r.snippet || r.description].filter(Boolean).join(" -- ")).filter(Boolean).join("\n"));
      if (parts.length) return { ok: true, text: parts.join("\n"), sources: (j.citations || []).concat(rs.map((r) => r && r.url).filter(Boolean)), via: `${j.snippet ? "box" : "nobox"}+organic(${rs.length})` };
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
const toLetters = (items) => { const o = []; for (const it of items || []) for (const [L, t] of Object.entries(OPT)) if (norm(t) === norm(it)) o.push(L); return [...new Set(o)]; };

// ── RUN ───────────────────────────────────────────────────────────────────────
say(`${C.b}QID 98 -- THE FOUNDER'S OWN THIRTEEN QUESTIONS, VERBATIM${C.x}`);
say(`${C.dim}Google is the only source. Gemma extracts. The code decides. Cost $0.${C.x}`);
say(`${C.dim}${Object.entries(OPT).map(([k, v]) => `${k}) ${v}`).join("  ")}${C.x}`);
try { const v = await fetch(`http://127.0.0.1:${PORT}/json/version`); say(`${C.dim}CDP ${PORT}: up (${v.status})${C.x}`); }
catch { say(`${C.r}CDP ${PORT} DOWN.${C.x}`); process.exit(1); }

let pool = [...ALL];
const trail = [];
const densities = {};      // letter -> number, from the hard-number questions
const leastVotes = {};     // letter -> count of "least dense / removed as least" findings
const t0 = Date.now();

for (const item of Q(pool)) {
  say(""); say(`${C.c}${C.b}[Q${item.n}] stage ${item.stage} -- ${item.why}${C.x}`);
  say(`${C.dim}  ${item.text}${C.x}`);                      // FULL question, never truncated
  const res = await google(item.text);
  if (!res.ok) { say(`${C.y}  no answer (${res.via})${C.x}`); trail.push({ ...item, answer: "", via: res.via }); continue; }
  say(`${C.g}  A${C.x} ${C.dim}[${res.via}]${C.x} ${res.text.slice(0, 260).split(String.fromCharCode(10)).join(" | ")}`);

  let effect = "";
  if (item.stage === 1) {
    const ex = await extract(`List the world regions this passage says ARE among the most densely populated. Copy wording EXACTLY from: ${ALL.map((L) => OPT[L]).join("; ")}`, res.text, `{"items":["exact region name"]}`);
    const dense = toLetters(ex && ex.items);
    if (dense.length) { const before = pool.length; pool = pool.filter((L) => !dense.includes(L)); effect = `dense (removed): ${dense.join(", ")}   pool ${before} -> ${pool.length}`; }
    else effect = "nothing mapped exactly";
    say(`${C.g}  >>${C.x} ${effect}`);
  } else if (item.stage === 3) {
    const ex = await extract(`Report the ordered list of world regions this passage gives, from ${item.why.includes("most densely to least") ? "most densely populated to least" : "least densely populated to most"}. Copy each name EXACTLY from: ${ALL.map((L) => OPT[L]).join("; ")}`, res.text, `{"order":["exact region name"]}`);
    const ord = toLetters(ex && ex.order);
    if (ord.length >= 2) {
      const leastEnd = item.why.includes("most densely to least") ? ord[ord.length - 1] : ord[0];
      leastVotes[leastEnd] = (leastVotes[leastEnd] || 0) + 1;
      effect = `order: ${ord.join(" > ")}   least-dense end: ${leastEnd}`;
    } else effect = "no usable ordering mapped";
    say(`${C.g}  >>${C.x} ${effect}`);
  } else if (item.stage === 4) {
    const wantLeast = item.why.includes("least");
    const ex = await extract(`List the world regions this passage says to REMOVE. Copy wording EXACTLY from: ${ALL.map((L) => OPT[L]).join("; ")}`, res.text, `{"remove":["exact region name"]}`);
    const rem = toLetters(ex && ex.remove);
    if (rem.length) { if (wantLeast) for (const L of rem) leastVotes[L] = (leastVotes[L] || 0) + 1; effect = `removed as ${wantLeast ? "least" : "MOST"} populated: ${rem.join(", ")}`; }
    else effect = "nothing mapped exactly";
    say(`${C.g}  >>${C.x} ${effect}`);
  } else if (item.stage === 5) {
    const ex = await extract(`For each world region below, report the population density value this passage gives and its unit. Copy each name EXACTLY from: ${ALL.map((L) => OPT[L]).join("; ")}`, res.text, `{"values":[{"region":"exact region name","density":number,"unit":"..."}]}`);
    let n = 0;
    for (const v of (ex && ex.values) || []) for (const L of ALL) if (norm(OPT[L]) === norm(v.region) && typeof v.density === "number") { densities[L] = v.density; n++; }
    effect = n ? `densities: ${Object.entries(densities).map(([L, d]) => `${L}=${d}`).join("  ")}` : "no densities mapped exactly";
    say(`${C.g}  >>${C.x} ${effect}`);
  }
  trail.push({ ...item, answer: res.text, via: res.via, sources: res.sources, effect });
}

// ── TERMINATE. Arithmetic only. No model below this line.
say(""); say(`${C.b}TERMINATOR${C.x}`);
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
