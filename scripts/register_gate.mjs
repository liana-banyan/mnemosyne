#!/usr/bin/env node
// register_gate.mjs -- D-BP149-039/BISHOP/S39/seg-registergate
//
// THE REGISTER GATE, AS ONE CLEAN BLOCK. Written fresh, not patched.
//
// Founder's own FIRST rule (FounderCascadeWorkedByHand.txt, Excerpt 3):
//   "FIRST. Figure out what the question is actually asking, with context like ... deserts and
//    rainforests are not counted as regions. So we need to vet the questions themselves, FIRST."
//
// WHY IT IS ITS OWN FILE. The previous attempt lived inside a script that had been patched eight
// times by scripted string replacement, at least two of which failed halfway. Every diagnosis after
// that was reasoning about a file from memory rather than from disk, and four consecutive "one more
// fix" claims were wrong. A gate you cannot test in isolation is a gate you cannot debug.
//
// Run it alone, and it prints its own evidence:
//   node scripts\register_gate.mjs
//   node scripts\register_gate.mjs --only=I,H,G
//
// Or import { runRegisterGate } from it.
//
// THE RULE IT IMPLEMENTS, and every step is code, no model anywhere:
//   1. Ask Google, one option per question. (Bulk questions returned generic definitions and named
//      no option at all. One entity per question is the shape that works, measured twice.)
//   2. Keep Google's result BLOCKS. A block is a TITLE plus a BODY, and the body refers back to the
//      title with pronouns: title "Sahara Wikipedia", body "a desert spanning North Africa. it is
//      the largest hot desert in the world." No single sentence both names AND classifies, which is
//      why sentence-level matching found nothing for an entire session.
//   3. A block is ABOUT an option if its title or body names it -- full name, or its unique leading
//      proper-noun token ("Sahara" for "Sahara Desert"). Uniqueness matters: "South America" would
//      reduce to "South" and collide with "South Asia", so it keeps its full text.
//   4. Drop question-shaped sentences. Google pages are full of "People also ask" and quiz stems,
//      and a question asserts nothing. Reading one as a fact once eliminated the correct answer.
//   5. If the surviving text asserts a physical-feature word and never asserts a region word, the
//      option is not a world region.

import fs from "fs";

const PORT = 9333;
const C = { dim: "\x1b[2m", b: "\x1b[1m", g: "\x1b[32m", y: "\x1b[33m", r: "\x1b[31m", c: "\x1b[36m", x: "\x1b[0m" };
const say = (s = "") => console.log(s);

const FEATURE_WORDS = /\b(desert|deserts|rainforest|rainforests|biome|biomes|climate zone|ecosystem|ecosystems|landform|tundra|ice sheet|line of latitude|circle of latitude)\b/i;
const REGION_WORDS = /\b(world region|subregion|subcontinent|continent|continents|geographic region|cultural region|region of the world)\b/i;

const norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export function headTokenFor(optionText, allOptionTexts) {
  const w = String(optionText).trim().split(/\s+/);
  if (w.length < 2 || w[0].length < 4) return optionText;
  const first = norm(w[0]);
  let owners = 0;
  for (const t of allOptionTexts) if (norm(t).split(" ")[0] === first) owners++;
  return owners === 1 ? w[0] : optionText;
}

export function mentions(text, optionText, allOptionTexts) {
  const t = norm(text);
  if (t.includes(norm(optionText))) return true;
  const h = headTokenFor(optionText, allOptionTexts);
  return h !== optionText && t.includes(norm(h));
}

// A question asserts nothing. Neither does someone else's answer-option list.
export function isAssertion(sentence) {
  const s = String(sentence || "").trim();
  if (!s) return false;
  if (s.includes("?")) return false;
  if (/_{3,}/.test(s)) return false;
  if (/people also ask/i.test(s)) return false;
  if (/\b(which of the following|choose the|select the|true or false)\b/i.test(s)) return false;
  const markers = (s.match(/(?:^|\s)[A-J][.)]\s+\S/g) || []).length;
  if (markers >= 2) return false;
  return true;
}

export function assertionsOf(body) {
  return String(body || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.trim())
    .filter(isAssertion)
    .join(" ");
}

// THE DECISION, over blocks. Pure function -- testable with no network and no model.
export function classifyOption(optionText, blocks, allOptionTexts) {
  const evidence = { about: 0, featureHits: [], regionHits: [] };
  for (const b of blocks || []) {
    const title = String(b.title || "");
    const body = String(b.body || "");
    if (!mentions(`${title} ${body}`, optionText, allOptionTexts)) continue;
    evidence.about++;
    const claims = assertionsOf(body);
    if (!claims) continue;
    if (FEATURE_WORDS.test(claims)) evidence.featureHits.push({ title, claims });
    if (REGION_WORDS.test(claims)) evidence.regionHits.push({ title, claims });
  }
  let verdict = "undetermined";
  if (evidence.featureHits.length && !evidence.regionHits.length) verdict = "not_a_world_region";
  else if (evidence.regionHits.length && !evidence.featureHits.length) verdict = "world_region";
  // BOTH kinds of word present -- the term is getting two different classifications and this gate
  // cannot settle it by keyword. Founder, BP149: "IF something gets different definitions, like
  // those three questions, go find out what the defined terms mean... So that the relative scope is
  // defined." That is what CONFLICT triggers.
  else if (evidence.regionHits.length && evidence.featureHits.length) verdict = "conflict";
  return { verdict, evidence };
}

// ── SCOPE RESOLUTION. Only runs on a CONFLICT. ────────────────────────────────
//
// THE PROBLEM IT SOLVES, measured live. "The Sahara Desert in Africa covers 10% of the continent"
// put the word "continent" in a sentence about the Sahara -- but it says the Sahara is INSIDE a
// continent, not that it IS one. Keyword presence cannot tell those apart, and neither can
// distance: compare "South America, fourth largest of the world's continents", which IS a
// classification and has no verb at all.
//
// The difference is SCOPE, so scope is what gets established. Define the classifying term by its
// EXTENSION -- the closed set of things it names -- and then membership is a set test, in code.
//   "What are the seven continents?"  ->  {Africa, Antarctica, Asia, Australia, Europe,
//                                          North America, South America}
//   Is "South America" in that set?  YES  -> it is a continent-scale region.
//   Is "Sahara Desert" in that set?  NO   -> it is not, whatever words surround it.
//
// This is the Founder's Language Matrix applied to an answer: the term's meaning is fixed by
// looking it up, from a source, before it is used to judge anything.
let continentSetCache = null;

export async function defineContinents(verbose = true) {
  if (continentSetCache) return continentSetCache;
  const q = "What are the seven continents of the world?";
  if (verbose) say(`${C.dim}    [scope] ${q}${C.x}`);
  const res = await askGoogleBlocks(q);
  const text = (res.blocks || []).map((b) => `${b.title} ${b.body}`).join(" ");
  // The seven names are a closed set; the code checks which of them the SOURCE actually states.
  const CANDIDATES = ["Africa", "Antarctica", "Asia", "Australia", "Europe", "North America", "South America", "Oceania"];
  const found = CANDIDATES.filter((c) => norm(text).includes(norm(c)));
  continentSetCache = { names: found, sourced: found.length >= 5, raw: text.slice(0, 400) };
  if (verbose) say(`${C.dim}    [scope] continents named by the source: ${found.join(", ") || "(none)"}${C.x}`);
  return continentSetCache;
}

export async function resolveScope(optionText, allOptionTexts, verbose = true) {
  const cont = await defineContinents(verbose);
  const isContinent = cont.names.some((c) => norm(c) === norm(optionText));
  if (isContinent) return { verdict: "world_region", why: `"${optionText}" is a member of the sourced continent set` };

  // Not a continent by name. Ask what contains it -- containment settles the scope.
  const q = `What continent is ${optionText} located in?`;
  if (verbose) say(`${C.dim}    [scope] ${q}${C.x}`);
  const res = await askGoogleBlocks(q);
  const text = (res.blocks || []).map((b) => `${b.title} ${b.body}`).join(" ");
  const containers = cont.names.filter((c) => norm(c) !== norm(optionText) && norm(text).includes(norm(c)));
  if (containers.length) {
    return { verdict: "not_a_world_region", why: `"${optionText}" is stated to lie within ${containers.join(" / ")}, so it is contained by a continent rather than being one` };
  }
  return { verdict: "undetermined", why: `no containing continent stated for "${optionText}"` };
}

// ── Google, through the Founder's live logged-in session ──────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let cachedWs = null;

async function pickTarget() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const pages = (await r.json()).filter((t) => t.type === "page");
  for (const p of pages) {
    const ok = await new Promise((resolve) => {
      let done = false;
      const ws = new WebSocket(p.webSocketDebuggerUrl);
      const t = setTimeout(() => { if (!done) { done = true; try { ws.close(); } catch {} resolve(false); } }, 8000);
      ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: `typeof (window.amplify && window.amplify.runBrowserAuthorityQuery) === "function"`, returnByValue: true } }));
      ws.onmessage = (m) => { if (done) return; done = true; clearTimeout(t); const d = JSON.parse(m.data); try { ws.close(); } catch {} resolve(Boolean(d.result && d.result.result && d.result.result.value)); };
      ws.onerror = () => { if (!done) { done = true; clearTimeout(t); resolve(false); } };
    });
    if (ok) return p.webSocketDebuggerUrl;
  }
  throw new Error("no CDP page exposes runBrowserAuthorityQuery -- is MnemosyneC running?");
}

export async function askGoogleBlocks(question, tries = 3) {
  if (!cachedWs) cachedWs = await pickTarget();
  for (let i = 1; i <= tries; i++) {
    let raw = null;
    try {
      raw = await new Promise((resolve, reject) => {
        const ws = new WebSocket(cachedWs);
        const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error("CDP timeout")); }, 120000);
        const expr = `(async()=>{ try { const r = await window.amplify.runBrowserAuthorityQuery({ authority:'user_google', question: ${JSON.stringify(question)} });
          if (!r) return JSON.stringify({ nullReturn: true });
          return JSON.stringify({ snippet: r.snippet||'', results: (r.results||[]).map(x => ({ title: x.title||'', body: x.snippet||x.description||'', url: x.url||'' })) });
        } catch(e) { return JSON.stringify({ error: String(e && e.message || e) }); } })()`;
        ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: expr, awaitPromise: true, returnByValue: true } }));
        ws.onmessage = (m) => { clearTimeout(timer); const d = JSON.parse(m.data); try { ws.close(); } catch {} resolve(d.result && d.result.result ? d.result.result.value : null); };
        ws.onerror = () => { clearTimeout(timer); reject(new Error("CDP socket error")); };
      });
    } catch (e) { raw = null; }
    let j = null; try { j = JSON.parse(raw); } catch {}
    if (j && !j.error && !j.nullReturn) {
      const blocks = [];
      if (j.snippet && j.snippet.trim()) blocks.push({ title: "", body: j.snippet.trim(), url: "", kind: "answer_box" });
      for (const r of j.results || []) blocks.push({ ...r, kind: "organic" });
      if (blocks.length) return { ok: true, blocks };
    }
    if (i < tries) await sleep(i * 6000);
  }
  return { ok: false, blocks: [] };
}

export async function runRegisterGate(options, { verbose = true } = {}) {
  const allTexts = Object.values(options);
  const notRegions = [], report = {};
  for (const [L, text] of Object.entries(options)) {
    const q = `In geography, is ${text} classified as a world region, or as a desert, rainforest, biome or climate zone?`;
    if (verbose) say(`${C.dim}  ${q}${C.x}`);
    const res = await askGoogleBlocks(q);
    if (!res.ok) { if (verbose) say(`${C.y}    no answer${C.x}`); report[L] = { verdict: "no_answer" }; continue; }
    let { verdict, evidence } = classifyOption(text, res.blocks, allTexts);
    // THE FOUNDER'S CONDITIONAL: a term that gets two different classifications does not get
    // guessed at. Go define the terms and establish the relative scope.
    if (verdict === "conflict") {
      if (verbose) say(`${C.y}    ${text}: CONFLICT -- classified both ways, resolving scope${C.x}`);
      const scoped = await resolveScope(text, allTexts, verbose);
      verdict = scoped.verdict;
      if (verbose) say(`${C.dim}    [scope] -> ${verdict}: ${scoped.why}${C.x}`);
      report[L] = { verdict, evidence, scope: scoped, blocks: res.blocks.length };
      if (verdict === "not_a_world_region") { notRegions.push(L); if (verbose) say(`${C.g}    >> ${text}: NOT a world region${C.x}`); }
      continue;
    }
    report[L] = { verdict, evidence, blocks: res.blocks.length };
    if (verdict === "not_a_world_region") {
      notRegions.push(L);
      if (verbose) { say(`${C.g}    >> ${text}: NOT a world region${C.x}`); say(`${C.dim}       "${evidence.featureHits[0].claims.slice(0, 140)}"${C.x}`); }
    } else if (verdict === "world_region") {
      if (verbose) { say(`${C.dim}    ${text}: world region${C.x}`); say(`${C.dim}       "${evidence.regionHits[0].claims.slice(0, 120)}"${C.x}`); }
    } else if (verbose) {
      say(`${C.y}    ${text}: undetermined  [blocks=${res.blocks.length} about=${evidence.about} feature=${evidence.featureHits.length} region=${evidence.regionHits.length}]${C.x}`);
    }
  }
  return { notRegions, report };
}

// ── standalone ────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("register_gate.mjs")) {
  const OPT = { A: "South America", B: "South Asia", C: "North Africa", D: "Northeast United States",
                E: "Europe", F: "Central Asia", G: "Arctic Circle", H: "Amazon Rainforest", I: "Sahara Desert" };
  const only = (process.argv.filter((a) => a.startsWith("--only="))[0] || "").split("=")[1];
  const subset = only ? Object.fromEntries(Object.entries(OPT).filter(([L]) => only.split(",").includes(L))) : OPT;

  // SELF-TEST FIRST, no network: the exact blocks that defeated the old gate.
  say(`${C.b}SELF-TEST (no network) -- the real blocks that broke the previous gate${C.x}`);
  const saharaBlocks = [
    { title: "", body: "The core desert biome encompasses about half that area, while the greater Sahara includes a full range of semiarid and related ecosystems." },
    { title: "Sahara -- Web results Sahara Wikipedia", body: "a desert spanning North Africa. it is the largest hot desert in the world. The desert covers much of North Africa, excluding the fertile region" },
    { title: "Sahara | Geography and Cartography", body: "People also ask What is the Sahara Desert classified as? Is the Sahara Desert a biome or ecosystem?" },
  ];
  const samBlocks = [
    { title: "", body: "South America, fourth largest of the world's continents. It is the southern portion of the landmass generally referred to as the New World." },
    { title: "Climate and Biomes in South America", body: "South America features tropical, subtropical, temperate, and polar climate zones." },
  ];
  const all = Object.values(OPT);
  for (const [name, blocks, expect] of [["Sahara Desert", saharaBlocks, "not_a_world_region"], ["South America", samBlocks, "world_region"]]) {
    const { verdict, evidence } = classifyOption(name, blocks, all);
    const ok = verdict === expect;
    say(`  ${ok ? C.g + "PASS" : C.r + "FAIL"}${C.x}  ${name}: got ${verdict}, expected ${expect}   [about=${evidence.about} feature=${evidence.featureHits.length} region=${evidence.regionHits.length}]`);
  }

  say(""); say(`${C.b}LIVE (Google, ${Object.keys(subset).length} option(s))${C.x}`);
  const { notRegions } = await runRegisterGate(subset);
  say(""); say(`${C.b}NOT WORLD REGIONS: ${notRegions.join(", ") || "(none)"}${C.x}`);
}
