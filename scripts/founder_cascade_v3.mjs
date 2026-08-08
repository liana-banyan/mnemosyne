#!/usr/bin/env node
// founder_cascade_v3.mjs -- D-BP149-035/BISHOP/S35/seg-cascadev3
//
// THE FOUNDER'S CASCADE. ALL FIVE STAGES. THIRTEEN FRAMINGS. HIS WORDING.
//
// v2 implemented three of five stages -- inverse, Jar, hard number -- and skipped stages 3 and 4
// entirely. In his own walkthrough those two do the heavy narrowing: nine options down to five,
// then to two, BEFORE the hard number is ever asked. v2 arrived at stage 5 with eight options
// still in the pool and could not terminate. That was not his cascade; it was the first third of
// it, and the fault was writing from a summary instead of from his file, stage by stage.
//
// EVERY FRAMING BELOW IS HIS WORDING from FounderCascadeWorkedByHand.txt, Excerpt 2, adapted only
// by substituting the real option set. Quoted at each stage so any drift is visible.
//
// DIVISION OF LABOR, unchanged and non-negotiable:
//   GOOGLE   the only source. Multi-source is escalation, never the base layer.
//   GEMMA    extracts structure. Never handed the options and asked to pick.
//            think:false, num_predict >= 256 (HARD BINDING, canon 2026-06-15).
//   THE CODE decides. Elimination and termination are arithmetic over extracted facts.
//
// USAGE, from C:\Users\Administrator\Documents\mnemosyne, MnemosyneC dev running on 9333:
//   node scripts\founder_cascade_v3.mjs --qids=98

import fs from "fs";

const PORT = 9333, OLLAMA = "http://127.0.0.1:11434/api/generate";
const MODEL = process.env.CASCADE_MODEL ?? "gemma4:12b";
const BUNDLE = "resources/mmlu_pro_bundled/questions.jsonl";
const OUT = "C:/Users/Administrator/Documents/LianaBanyanPlatform/BISHOP_DROPZONE/FOUNDER_CASCADE_V3_RESULTS.md";
const BEAT = "C:/Users/Administrator/Documents/LianaBanyanPlatform/HARDWIRE/LEDGER/YOKE/HEARTBEAT/LIANA-CASCADE.beat";

const argv = process.argv.slice(2);
const qidArg = argv.filter((a) => a.startsWith("--qids="))[0];
const QIDS = qidArg ? qidArg.split("=")[1].split(",").map(Number) : [46, 66, 72, 85, 92, 98];

const C = { dim: "\x1b[2m", b: "\x1b[1m", g: "\x1b[32m", y: "\x1b[33m", r: "\x1b[31m", c: "\x1b[36m", x: "\x1b[0m" };
const say = (s = "") => console.log(s);
const stage = (n, t, quote) => { say(""); say(`${C.c}${C.b}  STAGE ${n}${C.x} ${C.b}${t}${C.x}`); if (quote) say(`${C.dim}     his words: "${quote}"${C.x}`); };
// FULL query, never truncated. Founder, BP149: "I DESPISE SUMMARIES. Notice that my words are
// truncated ... Most WHAT. And that is why that question is NOT ASKED correctly of Google."
// A truncated echo hides a malformed question, which is exactly how the malformed ones survived.
const q_ = (s) => say(`${C.dim}     Q: ${s}${C.x}`);
const a_ = (s, via) => say(`${C.g}     A${C.x} ${C.dim}[${via}]${C.x} ${s.slice(0, 200).split(String.fromCharCode(10)).join(" | ")}`);
const got = (s) => say(`${C.g}     >>${C.x} ${s}`);
const note = (s) => say(`${C.dim}        ${s}${C.x}`);
const beat = (s) => { try { fs.appendFileSync(BEAT, `${new Date().toISOString().replace(/\.\d+Z$/, "Z")}  LIANA-CASCADE  ${s}\n`); } catch {} };

// ── GOOGLE ────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastEnd = 0;

async function cdpEval(expression, timeoutMs = 120000) {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const pages = (await r.json()).filter((t) => t.type === "page" && !t.url.startsWith("data:") && t.url !== "about:blank");
  if (!pages.length) throw new Error("no renderer page target");
  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error("CDP timeout")); }, timeoutMs);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
    ws.onmessage = (m) => { clearTimeout(timer); const d = JSON.parse(m.data); try { ws.close(); } catch {}
      if (d.result && d.result.exceptionDetails) return reject(new Error(d.result.exceptionDetails.text));
      resolve(d.result && d.result.result ? d.result.result.value : null); };
    ws.onerror = () => { clearTimeout(timer); reject(new Error("CDP socket error")); };
  });
}

async function googleOnce(query) {
  // MEASURED: runBrowserAuthorityQuery itself returns NULL on some calls. Guard inside the page,
  // never read .snippet off a null there, and report the null honestly rather than as an error.
  const expr = `(async()=>{ try {
    const res = await window.amplify.runBrowserAuthorityQuery({ authority: 'user_google', question: ${JSON.stringify(query)} });
    if (!res) return JSON.stringify({ nullReturn: true });
    return JSON.stringify({ snippet: res.snippet || '', results: res.results || [], citations: res.citations || [], sourceUrl: res.sourceUrl || '' });
  } catch(e) { return JSON.stringify({ error: String(e && e.message || e) }); } })()`;
  const raw = await cdpEval(expr);
  let j = null; try { j = JSON.parse(raw); } catch {}
  if (!j || typeof j !== "object") return { ok: false, text: "", sources: [], via: "no_object" };
  if (j.nullReturn) return { ok: false, text: "", sources: [], via: "authority_returned_null" };
  if (j.error) return { ok: false, text: "", sources: [], via: "error:" + j.error };
  // Both the answer box AND the organic results. Measured: the answer box can be off-target
  // (asked about regions, returned country densities) while the organic list carried the right
  // regional figures. The code only accepts values that map to an option's exact text, so an
  // off-target box contributes nothing rather than poisoning the result.
  const parts = [];
  if (j.snippet && j.snippet.trim()) parts.push(j.snippet.trim());
  const rs = Array.isArray(j.results) ? j.results : [];
  if (rs.length) parts.push(rs.slice(0, 6).map((r) => typeof r === "string" ? r : [r.title, r.snippet || r.description].filter(Boolean).join(" -- ")).filter(Boolean).join("\n"));
  return { ok: parts.length > 0, text: parts.join("\n"), sources: (j.citations || []).concat(rs.map((r) => r && r.url).filter(Boolean)),
           via: `${j.snippet ? "box" : "nobox"}+organic(${rs.length})` };
}

async function google(query, tries = 3) {
  const since = Date.now() - lastEnd;
  if (since < 5000) await sleep(5000 - since);
  let res = { ok: false, via: "unattempted" };
  for (let i = 1; i <= tries; i++) {
    try { res = await googleOnce(query); } catch (e) { res = { ok: false, text: "", sources: [], via: "threw:" + e.message }; }
    if (res.ok) break;
    if (i < tries) { note(`attempt ${i} gave nothing (${res.via}); settling ${i * 8}s`); await sleep(i * 8000); }
  }
  lastEnd = Date.now();
  return res;
}

// ── GEMMA, MECHANICAL ONLY ────────────────────────────────────────────────────
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
    const j = await r.json();
    const t = (j.response || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(t);
  } catch { return null; }
}

// The ONLY text-to-letter mapping in this file. Exact, normalized, no similarity, ever.
const norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
function toLetters(items, opts) {
  const out = [];
  for (const it of items || []) for (const [L, txt] of Object.entries(opts)) if (norm(txt) === norm(it)) out.push(L);
  return [...new Set(out)];
}

// Ask Gemma which listed items a passage names, then map by exact text. Used by every stage.
async function namedIn(passage, opts, pool, instruction) {
  const list = pool.map((L) => opts[L]).join("; ");
  const ex = await extract(`${instruction} Choose only from this list and copy the wording EXACTLY: ${list}`, passage, `{"items":["exact item text"]}`);
  const letters = toLetters(ex && ex.items, opts).filter((L) => pool.includes(L));
  return { letters, raw: ex };
}

// ── THE CASCADE ───────────────────────────────────────────────────────────────
const letter = (i) => String.fromCharCode(65 + i);
function loadQ(qid) { for (const l of fs.readFileSync(BUNDLE, "utf8").split(/\r?\n/)) { if (!l.trim()) continue; const r = JSON.parse(l); if (r.question_id === qid) return r; } return null; }

async function runQuestion(q) {
  const opts = {}; q.options.forEach((o, i) => (opts[letter(i)] = o));
  const all = Object.keys(opts);
  const fmt = (ls) => ls.map((L) => `${L}) ${opts[L]}`).join(" ");
  const trail = [];
  const record = (n, query, res, extracted, effect) => trail.push({ stage: n, query, answer: res.text, via: res.via, sources: res.sources, extracted, effect });

  say(""); say(`${C.b}══════ qid ${q.question_id} ${C.dim}[${q.category}]${C.x}`);
  say(`${C.dim}  ${q.question}${C.x}`); say(`${C.dim}  ${fmt(all)}${C.x}`);
  beat(`qid ${q.question_id} start`);

  let pool = [...all];
  const isNot = /\bNOT\b/.test(q.question);
  const base = q.question.replace(/\bNOT\b/, "").replace(/\s+/g, " ").trim();

  // STAGE 1 -- ASK THE INVERSE
  stage(1, "ask the inverse", "First I put in the inverse, because that usually cuts the question in half, at least");
  const q1 = `${base} ${fmt(all)}`;
  q_(q1); const r1 = await google(q1);
  let asserted = [];
  if (r1.ok) {
    a_(r1.text, r1.via);
    const n = await namedIn(r1.text, opts, all, "List the items the passage says DO have the property being discussed.");
    asserted = n.letters;
    got(asserted.length ? `named as HAVING the property: ${asserted.join(", ")}` : "nothing mapped exactly (no similarity fallback, by design)");
    record(1, q1, r1, n.raw, `asserted=${asserted.join(",")}`);
  } else { note(`no answer (${r1.via})`); record(1, q1, r1, null, "no answer"); }

  // STAGE 2 -- JAR METHOD, from that same single response
  stage(2, "Jar Method", "we got rid of four answers with one google search ... First we take out the Softballs, because we KNOW they are not the answer");
  if (asserted.length) {
    const before = pool.length;
    pool = isNot ? pool.filter((L) => !asserted.includes(L)) : asserted;
    got(`${before} -> ${pool.length}   pool: ${pool.join(", ")}`);
  } else note("nothing eliminable from stage 1");

  // STAGE 3 -- ORDER BOTH DIRECTIONS, then ALL options as quality control
  stage(3, "order both ways, then all options as QC", "another DIFFERENT google search ... to check accuracy of the same engine that I asked ... a FOURTH and FIFTH ... with ALL of them ... as a quality control");
  const orderings = [];
  for (const [dir, set, label] of [
    ["most to least", pool, "survivors"], ["least to most", pool, "survivors"],
    ["most to least", all, "ALL (QC)"], ["least to most", all, "ALL (QC)"],
  ]) {
    const qq = `Please put these in order of ${dir}. ${fmt(set)}`;
    q_(`[${label}] ${qq}`); const rr = await google(qq);
    if (!rr.ok) { note(`no answer (${rr.via})`); record(3, qq, rr, null, "no answer"); continue; }
    a_(rr.text, rr.via);
    const ex = await extract(`Report the ordered list this passage gives, ${dir}. Copy each item's wording EXACTLY from: ${set.map((L) => opts[L]).join("; ")}`, rr.text, `{"order":["exact item text"]}`);
    const ord = toLetters(ex && ex.order, opts).filter((L) => set.includes(L));
    if (ord.length >= 2) { orderings.push({ dir, label, order: ord }); got(`${dir} [${label}]: ${ord.join(" > ")}`); }
    else note("no usable ordering mapped");
    record(3, qq, rr, ex, `order=${ord.join(">")}`);
  }
  // The CODE counts last-place votes. His stage 3 is a consistency check, so agreement is the signal.
  const lastPlace = {};
  for (const o of orderings) { const lo = o.dir === "most to least" ? o.order[o.order.length - 1] : o.order[0]; if (lo) lastPlace[lo] = (lastPlace[lo] || 0) + 1; }
  if (Object.keys(lastPlace).length) got(`least-of-the-property votes: ${Object.entries(lastPlace).map(([L, n]) => `${L}x${n}`).join("  ")}`);

  // STAGE 4 -- CAKE CUT HALF, inverted each pass, re-including what was just eliminated
  stage(4, "Cake Cut Half, inverted, with re-inclusion control", "remove the half that are least ... and now I put BACK IN the ones that were JUST ELIMINATED ... And then I would do the same thing from the OTHER side");
  const cakeVotes = {};
  const q4a = `From the following listed, please remove the half that are least. ${fmt(all)}`;
  q_(q4a); const r4a = await google(q4a);
  let removedLeast = [];
  if (r4a.ok) {
    a_(r4a.text, r4a.via);
    const n = await namedIn(r4a.text, opts, all, "List the items the passage says to REMOVE as the least.");
    removedLeast = n.letters;
    got(`removed as least: ${removedLeast.join(", ") || "(none mapped)"}`);
    for (const L of removedLeast) cakeVotes[L] = (cakeVotes[L] || 0) + 1;
    record(4, q4a, r4a, n.raw, `removedLeast=${removedLeast.join(",")}`);
    if (removedLeast.length >= 2) {
      const q4b = `From the following listed, please remove the half that are least. ${fmt(removedLeast)}`;
      q_(`[re-inclusion control] ${q4b}`); const r4b = await google(q4b);
      if (r4b.ok) {
        a_(r4b.text, r4b.via);
        const n2 = await namedIn(r4b.text, opts, removedLeast, "List the items the passage says to REMOVE as the least.");
        got(`re-inclusion narrowed to: ${n2.letters.join(", ") || "(none mapped)"}`);
        for (const L of n2.letters) cakeVotes[L] = (cakeVotes[L] || 0) + 2; // survives two passes
        record(4, q4b, r4b, n2.raw, `narrowed=${n2.letters.join(",")}`);
      } else { note(`no answer (${r4b.via})`); record(4, q4b, r4b, null, "no answer"); }
    }
  } else { note(`no answer (${r4a.via})`); record(4, q4a, r4a, null, "no answer"); }

  const q4c = `From the following listed, please remove the half that are MOST. ${fmt(all)}`;
  q_(`[other side of the coin] ${q4c}`); const r4c = await google(q4c);
  if (r4c.ok) {
    a_(r4c.text, r4c.via);
    const n = await namedIn(r4c.text, opts, all, "List the items the passage says to REMOVE as the MOST.");
    got(`removed as most: ${n.letters.join(", ") || "(none mapped)"}`);
    for (const L of all) if (!n.letters.includes(L)) cakeVotes[L] = (cakeVotes[L] || 0) + 0.5; // kept on the low side
    record(4, q4c, r4c, n.raw, `removedMost=${n.letters.join(",")}`);
  } else { note(`no answer (${r4c.via})`); record(4, q4c, r4c, null, "no answer"); }

  // STAGE 5 -- TERMINATE ON THE HARD NUMBER
  stage(5, "terminate on the hard number", "Finally, I ask the hard statistic numbers that will tell me the answer from probably ONE prompt");
  const byLetter = {};
  const q5 = `What are the exact figures for each of the following, with units? ${fmt(all)}`;
  q_(q5); const r5 = await google(q5);
  if (r5.ok) {
    a_(r5.text, r5.via);
    const ex = await extract(`For each item, report the single numeric value the passage gives and its unit. Copy item wording EXACTLY from: ${all.map((L) => opts[L]).join("; ")}`, r5.text, `{"values":[{"item":"exact item text","value":number,"unit":"..."}]}`);
    for (const v of (ex && ex.values) || []) for (const L of all) if (norm(opts[L]) === norm(v.item) && typeof v.value === "number") byLetter[L] = v;
    const have = Object.keys(byLetter);
    got(have.length ? `numbers: ${have.map((L) => `${L}=${byLetter[L].value}${byLetter[L].unit || ""}`).join("  ")}` : "no numbers mapped exactly");
    record(5, q5, r5, ex, `numbers=${have.join(",")}`);
  } else { note(`no answer (${r5.via})`); record(5, q5, r5, null, "no answer"); }

  // ── DECIDE. Arithmetic over what the stages produced. No model in this block.
  say(""); say(`${C.b}  TERMINATOR${C.x}`);
  let verdict = null, basis = "";
  const inPool = (L) => pool.includes(L);

  const numbered = Object.keys(byLetter).filter(inPool);
  if (numbered.length >= 2) {
    const sorted = numbered.sort((a, b) => byLetter[a].value - byLetter[b].value);
    const lo = byLetter[sorted[0]].value, next = byLetter[sorted[1]].value;
    const sep = lo === 0 ? Infinity : next / lo;
    note(`hard numbers, ascending: ${sorted.map((L) => `${L}=${byLetter[L].value}`).join(" < ")}   separation ${sep.toFixed(2)}x`);
    if (sep >= 1.5) { verdict = sorted[0]; basis = `stage 5 hard number: lowest at ${sep.toFixed(1)}x separation`; }
    else note("separation below 1.5x, will not terminate on it");
  }
  if (!verdict) {
    const votes = {};
    for (const [L, n] of Object.entries(lastPlace)) if (inPool(L)) votes[L] = (votes[L] || 0) + n;
    for (const [L, n] of Object.entries(cakeVotes)) if (inPool(L)) votes[L] = (votes[L] || 0) + n;
    const ranked = Object.keys(votes).sort((a, b) => votes[b] - votes[a]);
    if (ranked.length) {
      note(`stage 3+4 convergence: ${ranked.map((L) => `${L}=${votes[L]}`).join("  ")}`);
      if (ranked.length === 1 || votes[ranked[0]] >= votes[ranked[1]] + 1.5) { verdict = ranked[0]; basis = `stages 3 and 4 converged on ${ranked[0]} (${votes[ranked[0]]} vs ${ranked[1] ? votes[ranked[1]] : 0})`; }
      else note("stages 3 and 4 did not separate a single option by a clear margin");
    }
  }
  if (!verdict && pool.length === 1) { verdict = pool[0]; basis = "sole survivor of elimination"; }

  const ok = verdict === q.answer;
  say("");
  if (verdict) say(`  ${ok ? C.g + "CORRECT" : C.r + "WRONG"}${C.x}  ${C.b}${verdict}${C.x} (${opts[verdict]})   key=${q.answer}`);
  else say(`  ${C.y}ABSTAIN${C.x}   pool=${pool.join(",")}   key=${q.answer}`);
  if (basis) note(basis);
  beat(`qid ${q.question_id} -> ${verdict || "ABSTAIN"} (key ${q.answer})`);

  return { qid: q.question_id, question: q.question, opts, verdict, correct: q.answer, ok, pool, basis, trail };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
say(`${C.b}FOUNDER CASCADE v3${C.x} -- all five stages, his wording. Google only. Gemma extracts. Code decides.`);
say(`${C.dim}model=${MODEL}  qids=${QIDS.join(",")}  cost=$0${C.x}`);
try { const v = await fetch(`http://127.0.0.1:${PORT}/json/version`); say(`${C.dim}CDP ${PORT}: up (${v.status})${C.x}`); }
catch { say(`${C.r}CDP ${PORT} DOWN. Start MnemosyneC dev and retry.${C.x}`); process.exit(1); }

const t0 = Date.now(); const results = [];
for (const qid of QIDS) {
  const q = loadQ(qid);
  if (!q) { say(`${C.r}qid ${qid} not in bundle${C.x}`); continue; }
  try { results.push(await runQuestion(q)); }
  catch (e) { say(`${C.r}qid ${qid} threw: ${e.message}${C.x}`); results.push({ qid, verdict: null, correct: q.answer, ok: false, trail: [], error: e.message }); }
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const nC = results.filter((r) => r.ok).length, nW = results.filter((r) => r.verdict && !r.ok).length, nA = results.filter((r) => !r.verdict).length;
say(""); say(`${C.b}══ TOTALS${C.x}  correct ${C.g}${nC}${C.x}  wrong ${C.r}${nW}${C.x}  abstain ${C.y}${nA}${C.x}   ${secs}s   $0`);

fs.writeFileSync(OUT, `# FOUNDER CASCADE v3 -- ALL FIVE STAGES

**Google only. Gemma extracts, never judges. The code decides.** Every framing is the Founder's wording from \`FounderCascadeWorkedByHand.txt\` Excerpt 2, adapted only by substituting the real option set.

**v2 implemented three of five stages and skipped 3 and 4, which are the ones that do the heavy narrowing in his own walkthrough.** This is the full method.

| Figure | Value |
|---|---|
| Correct | ${nC} / ${results.length} |
| Wrong | ${nW} / ${results.length} |
| Abstained | ${nA} / ${results.length} |
| Wall-clock | ${secs}s |
| Cost | **$0** |

| qid | verdict | key | outcome | basis |
|---|---|---|---|---|
${results.map((r) => `| ${r.qid} | ${r.verdict || "ABSTAIN"} | ${r.correct} | ${r.ok ? "CORRECT" : r.verdict ? "WRONG" : "abstain"} | ${r.basis || "-"} |`).join("\n")}

## Derivation trails

${results.map((r) => `### qid ${r.qid}
${(r.trail || []).map((t) => `**Stage ${t.stage}** [${t.via}]  ${t.effect}

Q: ${t.query}

> ${(t.answer || "(no answer)").slice(0, 700)}

Extracted: \`${JSON.stringify(t.extracted)}\`
Sources: ${(t.sources || []).slice(0, 5).join(" · ") || "(none)"}`).join("\n\n")}

**Result:** ${r.verdict || "ABSTAIN"} against key ${r.correct}. ${r.basis || ""}`).join("\n\n---\n\n")}

*D-BP149-035 / BISHOP / S35 / seg-cascadev3.*
`, "utf8");
say(`${C.dim}wrote ${OUT}${C.x}`);
