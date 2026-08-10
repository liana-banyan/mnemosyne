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
// D-BP151-041/BISHOP/seg-register-gate-inprocess: the standalone `node scripts\register_gate.mjs`
// debug-CLI entry point that used to run alone via its own CDP dial is REMOVED (Founder order,
// BP151: "drop the debug CLI"). This module now runs only imported, in-process, inside Electron's
// main-process V8 isolate (register_gate_loader.ts's loadRegisterGate(), called from
// comparative_cascade.ts's runStage0RegisterGate()). It reaches Google through an injected
// askGoogle function, never CDP -- see runRegisterGate()'s own doc comment below. Tested via
// scripts/register_gate.test.mjs, not by running this file directly.
//
// Import { runRegisterGate } from it.
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

export async function defineContinents(askGoogle, verbose = true) {
  if (continentSetCache) return continentSetCache;
  const q = "What are the seven continents of the world?";
  if (verbose) say(`${C.dim}    [scope] ${q}${C.x}`);
  const res = await askGoogle(q);
  const text = (res.blocks || []).map((b) => `${b.title} ${b.body}`).join(" ");
  // The seven names are a closed set; the code checks which of them the SOURCE actually states.
  const CANDIDATES = ["Africa", "Antarctica", "Asia", "Australia", "Europe", "North America", "South America", "Oceania"];
  const found = CANDIDATES.filter((c) => norm(text).includes(norm(c)));
  continentSetCache = { names: found, sourced: found.length >= 5, raw: text.slice(0, 400) };
  if (verbose) say(`${C.dim}    [scope] continents named by the source: ${found.join(", ") || "(none)"}${C.x}`);
  return continentSetCache;
}

export async function resolveScope(askGoogle, optionText, allOptionTexts, verbose = true) {
  const cont = await defineContinents(askGoogle, verbose);
  const isContinent = cont.names.some((c) => norm(c) === norm(optionText));
  if (isContinent) return { verdict: "world_region", why: `"${optionText}" is a member of the sourced continent set` };

  // Not a continent by name. Ask what contains it -- containment settles the scope.
  const q = `What continent is ${optionText} located in?`;
  if (verbose) say(`${C.dim}    [scope] ${q}${C.x}`);
  const res = await askGoogle(q);
  const text = (res.blocks || []).map((b) => `${b.title} ${b.body}`).join(" ");
  const containers = cont.names.filter((c) => norm(c) !== norm(optionText) && norm(text).includes(norm(c)));
  if (containers.length) {
    return { verdict: "not_a_world_region", why: `"${optionText}" is stated to lie within ${containers.join(" / ")}, so it is contained by a continent rather than being one` };
  }
  return { verdict: "undetermined", why: `no containing continent stated for "${optionText}"` };
}

// ── Google, via the injected in-process bridge ─────────────────────────────────
//
// D-BP151-041/BISHOP/seg-register-gate-inprocess: this module no longer dials CDP itself. It
// used to reach the Founder's live Google session through a WebSocket round trip to a
// `--remote-debugging-port` (askGoogleBlocks()/pickTarget(), superseded) that called
// `window.amplify.runBrowserAuthorityQuery` in a renderer -- itself nothing but
// `ipcRenderer.invoke('nexus-browser-authority-run-query')` wired straight back to
// `runBrowserAuthorityQueryFromMain()` in this SAME main-process V8 isolate (see
// REGISTER_GATE_WEBCONTENTS_FEASIBILITY_BP151.md, D-BP151-040). The caller
// (comparative_cascade.ts's runStage0RegisterGate()) already holds that function as
// `ctx.askGoogle` and now passes an adapter for it into `runRegisterGate(options, { askGoogle })`
// below -- the CDP round trip was a longer path back to a function this process already had in
// hand, so it is deleted rather than kept as a fallback. `askGoogle` here is any function shaped
// `(question: string) => Promise<{ ok: boolean, blocks: Array<{title,body,url,kind}> }>`; the
// standalone-CLI mode that used to supply this via CDP has been removed (Founder order, BP151:
// "drop the debug CLI") -- callers MUST inject one, there is no fallback dial.

export async function runRegisterGate(options, { verbose = true, askGoogle } = {}) {
  if (typeof askGoogle !== "function") {
    throw new Error(
      "runRegisterGate requires an injected askGoogle({question}) function -- register_gate.mjs no longer dials CDP itself (D-BP151-041). Pass the in-process bridge (ctx.askGoogle from MethodRunContext, adapted to return {ok, blocks})."
    );
  }
  const allTexts = Object.values(options);
  const notRegions = [], report = {};
  for (const [L, text] of Object.entries(options)) {
    const q = `In geography, is ${text} classified as a world region, or as a desert, rainforest, biome or climate zone?`;
    if (verbose) say(`${C.dim}  ${q}${C.x}`);
    const res = await askGoogle(q);
    if (!res.ok) { if (verbose) say(`${C.y}    no answer${C.x}`); report[L] = { verdict: "no_answer" }; continue; }
    let { verdict, evidence } = classifyOption(text, res.blocks, allTexts);
    // THE FOUNDER'S CONDITIONAL: a term that gets two different classifications does not get
    // guessed at. Go define the terms and establish the relative scope.
    if (verdict === "conflict") {
      if (verbose) say(`${C.y}    ${text}: CONFLICT -- classified both ways, resolving scope${C.x}`);
      const scoped = await resolveScope(askGoogle, text, allTexts, verbose);
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

// D-BP151-041/BISHOP/seg-register-gate-inprocess: the standalone `node scripts\register_gate.mjs`
// debug-CLI mode (and its no-network self-test) that used to live here is REMOVED. Founder-ordered
// (BP151, verbatim: "drop the debug CLI"). It only ever worked by dialing CDP directly (via the
// now-deleted askGoogleBlocks()/pickTarget()), and this module no longer carries that dial -- a
// bare `node` process has no in-process askGoogle to inject, so the entry point would be a
// half-path that looks callable and isn't. The self-test's fixtures (the Sahara/South America
// blocks that defeated the previous gate) now live as real, run assertions in
// scripts/register_gate.test.mjs, alongside coverage for the injected-askGoogle wiring this
// ticket adds. To exercise the gate live, run it the way production does: through
// comparative_cascade.ts's Stage 0 inside the running Electron app (`npm run dev` /
// `npm run dev:main`), which now injects ctx.askGoogle -- see register_gate_loader.ts and
// comparative_cascade.ts's runStage0RegisterGate().
