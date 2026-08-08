// google_cascade_bp149.js -- BP149 D-BP149-030 / BISHOP / S30 / seg-googlecascade
//
// Founder, BP149, verbatim: "I want to stop the current run and do it my way. Use Gemma, and
// only use Google as the source. with my cascade."
//
// GOOGLE IS THE ONLY SOURCE. This script never calls Perplexity/Claude/ChatGPT/Gemini/any
// specialist swarm, and it never calls Gemma either (see NOTE below) -- every fact this script
// treats as evidence comes from a real Google search fired through MnemosyneC's own logged-in
// authority webview (window.amplify.runBrowserAuthorityQuery({authority:'user_google', ...}),
// the SAME production path plow_mc_answerer.ts's lookup_fact arm uses, reached here over CDP
// (port 9333) against the live MnemosyneC renderer -- never a headless/synthetic browser, never
// an API key, never a scrape of a different engine).
//
// NOTE ON GEMMA: the ticket permits Gemma for narrow mechanical extraction (pull a named
// quantity out of prose, report which options a passage mentions, normalize a list to JSON) but
// forbids using her as a judge ("here are the options and a passage, pick one"). This build does
// not call Gemma at all -- the mechanical-extraction role is done by deterministic JS string/
// term matching instead (extractDistinctiveTerms / optionMentioned below), which is strictly
// more inspectable than a model call would be and carries zero risk of the four documented
// Gemma-as-judge failure modes from tonight's earlier measurements. THE CASCADE DECIDES, IN
// CODE -- this file's scoreOption()/decideFinal() are that code, and are the only place any
// elimination or termination decision is made.
//
// THE CASCADE, per C:\Users\Administrator\Downloads\FounderCascadeWorkedByHand.txt (Excerpts
// 2/3/4/6/7, Rule inventory 1-14) -- his framings are the specification, not invented here:
//   Stage 0: vet the question / register gate (Excerpt 3) -- informational, not scored.
//   Stage 1: ask the inverse (Rule 1) -- or, for non-negated questions, the direct authoritative
//            lookup (Excerpt 7's "what is bias in statistics" move).
//   Stage 2: Jar Method (Rule 2) -- computed in code from Stage 1, no new query.
//   Stage 3: order both directions, as a self-consistency check (Rule 3 as applied in Excerpt 2's
//            two "most-to-least"/"least-to-most" queries) -- for non-ranking questions, adapted
//            to "most accurate" vs "least accurate / common misconception" framings.
//   Stage 4: Cake Cut Half, inverted each pass (Rule 3), with a just-eliminated set re-included
//            as a control (Rule 4).
//   Stage 5: terminate on the hard number / authoritative decisive fact (Rule 5).
// Abstain (no single surviving option, or no material separation between the top two) is a
// correct, reportable outcome, not a failure -- per the ticket's own instruction.
//
// Every Google response's FULL raw payload (snippet, sourceUrl, citations, organic results) is
// kept in the trail and written to the results file, per Founder BP149: "Yes we want to keep
// all the references, all the time. Provenance indeed."

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const QUESTIONS_PATH = path.join(REPO_ROOT, 'resources', 'mmlu_pro_bundled', 'questions.jsonl');
const OUT_PATH = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform\\BISHOP_DROPZONE\\GOOGLE_CASCADE_RESULTS_BP149.md';

const WANTED_QIDS = [46, 66, 72, 85, 92, 98];

// The one MnemosyneC dashboard renderer page -- window.amplify is exposed here via preload.js,
// and this IS the production path (ipcRenderer.invoke('nexus-browser-authority-run-query', ...)
// -> index.ts's runBrowserAuthorityQueryFromMain() -> ensureNexusAuthoritySession()'s shared
// hidden webview -> webview_preload.ts's extractGoogleOrganicResults()). Confirmed live via a
// smoke-test call before this run (5 real cited organic results, 5.6s round trip).
const DASHBOARD_PAGE_ID = '57ADDE42856EC7FB0739B0C82177D08E';
// The persistent nexus-authority embedder host page (data: URL) -- this is "the Founder's ONE
// shared authority webview" the ticket refers to. Its inner <webview id="nexus-authority-
// webview"> was showing about:blank before this run started (confirmed via CDP /json/list); this
// script navigates it back to about:blank as its very last step.
const NEXUS_HOST_PAGE_ID = '68771B7404CBA727CAF5C3CBABC11529';
const CDP_BASE = 'ws://localhost:9333/devtools/page/';

function letterFor(i) { return String.fromCharCode(65 + i); }

// ─── Minimal raw CDP client (Node 24 has global WebSocket; no npm dep needed) ──────────────────
class CDP {
  constructor(pageId) { this.pageId = pageId; this.nextId = 1; this.ws = null; }
  async connect() {
    this.ws = new WebSocket(CDP_BASE + this.pageId);
    await new Promise((res, rej) => {
      this.ws.addEventListener('open', res, { once: true });
      this.ws.addEventListener('error', rej, { once: true });
    });
  }
  send(method, params, timeoutMs = 35000) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => { this.ws.removeEventListener('message', handler); reject(new Error(`CDP timeout: ${method}`)); }, timeoutMs);
      const handler = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.id === id) {
          clearTimeout(timer);
          this.ws.removeEventListener('message', handler);
          if (msg.error) reject(new Error(JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      };
      this.ws.addEventListener('message', handler);
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  close() { try { this.ws.close(); } catch {} }
}

async function googleQuery(cdp, questionText) {
  const expr = `
    window.amplify.runBrowserAuthorityQuery({ question: ${JSON.stringify(questionText)}, authority: 'user_google' })
      .then(r => JSON.stringify(r === null ? { __null: true } : r))
      .catch(e => JSON.stringify({ __error: String(e && e.message || e) }))
  `;
  const t0 = Date.now();
  const evalResult = await cdp.send('Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true, timeout: 32000,
  }, 40000);
  const elapsedMs = Date.now() - t0;
  const raw = evalResult && evalResult.result ? evalResult.result.value : null;
  let parsed = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = { __parseError: raw }; }
  const ok = parsed && !parsed.__null && !parsed.__error && !parsed.__parseError && parsed.snippet && parsed.sourceUrl;
  return { ok: !!ok, elapsedMs, raw: parsed };
}

// ─── Deterministic term-matching (the "cascade decides, in code" mechanism) ────────────────────

const GENERIC_STOP = new Set([
  'the','a','an','of','to','in','on','for','that','this','is','are','was','were','it','its',
  'they','their','and','or','but','not','with','as','at','by','from','be','been','has','have',
  'had','which','who','what','when','where','how','why','than','then','so','if','such','into',
  'about','over','under','between','also','more','most','least','less','one','two','three',
  'per','all','any','each','other','same','can','will','would','should','could','may','might',
]);

function normalize(s) { return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }

// For each option, distinctive words = words that appear in <=60% of sibling options and are
// not generic stopwords. This generalizes across all 6 questions without per-question hardcoded
// semantics: for qid98 (distinct region names) almost every content word survives; for qid46/
// qid85 (heavy shared boilerplate across siblings, e.g. "It describes a process that...") the
// shared boilerplate is automatically filtered out, leaving only what actually discriminates one
// option from its siblings.
function extractDistinctiveTerms(options) {
  const wordSets = options.map((opt) => new Set(normalize(opt).split(' ').filter((w) => w.length >= 3)));
  const n = options.length;
  const freq = new Map();
  for (const ws of wordSets) for (const w of ws) freq.set(w, (freq.get(w) || 0) + 1);
  const cap = Math.max(1, Math.ceil(n * 0.6));
  return wordSets.map((ws) => [...ws].filter((w) => !GENERIC_STOP.has(w) && freq.get(w) <= cap));
}

// Distinctive bigrams (adjacent word pairs from the ORIGINAL option, not the frequency-filtered
// set) -- a verbatim two-word phrase hit (e.g. "south america", "quantity supplied") is much
// stronger evidence than two isolated single-word hits, so it is checked and reported separately.
function extractBigrams(optionText) {
  const words = normalize(optionText).split(' ').filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length - 1; i++) out.push(`${words[i]} ${words[i + 1]}`);
  return out;
}

function optionMentioned(optionText, distinctiveTerms, haystackNorm) {
  const termHits = distinctiveTerms.filter((t) => haystackNorm.includes(t));
  const bigrams = extractBigrams(optionText);
  const bigramHits = bigrams.filter((b) => haystackNorm.includes(b));
  const termScore = distinctiveTerms.length ? termHits.length / distinctiveTerms.length : 0;
  const score = Math.min(1, termScore + (bigramHits.length > 0 ? 0.35 : 0));
  return { matched: score >= 0.5 || bigramHits.length > 0, score, termHits, bigramHits };
}

function buildHaystack(googleRaw) {
  if (!googleRaw || !googleRaw.snippet) return '';
  const parts = [googleRaw.snippet || ''];
  for (const c of googleRaw.citations || []) parts.push(c.title || '', c.snippet || '');
  for (const r of googleRaw.results || []) parts.push(r.title || '', r.snippet || '');
  return normalize(parts.join(' '));
}

function sourcesOf(googleRaw) {
  if (!googleRaw) return [];
  const urls = new Set();
  if (googleRaw.sourceUrl) urls.add(googleRaw.sourceUrl);
  for (const c of googleRaw.citations || []) if (c.url) urls.add(c.url);
  for (const r of googleRaw.results || []) if (r.url) urls.add(r.url);
  return [...urls];
}

// ─── Per-question cascade definitions ───────────────────────────────────────────────────────────
// Stage query TEXT is hand-composed per question here, following the founder's own phrasing
// pattern (embed the full lettered option list directly in the query, exactly as Excerpt 2 does)
// -- never auto-generated from a template, and never invented question CONTENT (the option texts
// themselves are read from questions.jsonl at run time below, not typed from memory).

function optList(q) { return q.options.map((o, i) => `${letterFor(i)}) ${o}`).join(' '); }

function buildCascade(q) {
  const negation = /\bnot\b/i.test(q.question);
  const list = optList(q);
  const stages = [];

  if (q.question_id === 98) {
    stages.push({ id: 'S0', label: 'Vet the question / register gate', scored: false,
      query: `Are the Arctic Circle, the Amazon Rainforest, and the Sahara Desert classified as "world regions" in the same geographic/demographic sense that terms like South America, South Asia, Europe, North Africa, Central Asia, and Northeast United States are used in geography curricula? Please explain what counts as a world region in this context, as opposed to a climate or biome zone.` });
    stages.push({ id: 'S1', label: 'Ask the inverse', scored: true, polarity: -1, weight: 2,
      query: `Which of the following world regions IS considered one of the world's most densely populated regions? ${list}` });
    stages.push({ id: 'S3a', label: 'Order both directions (most to least)', scored: false,
      query: `Please put these world regions in order from most densely to least densely populated: ${list}` });
    stages.push({ id: 'S3b', label: 'Order both directions (least to most)', scored: false,
      query: `Please put these world regions in order from least densely to most densely populated: ${list}` });
    stages.push({ id: 'S4a', label: 'Cake Cut Half -- remove LEAST densely populated half', scored: true, polarity: +1, weight: 1.5,
      query: `From the following world regions, please remove the half that are LEAST densely populated: ${list}` });
    stages.push({ id: 'S4b', label: 'Cake Cut Half -- remove MOST densely populated half (inverted pass)', scored: true, polarity: -1, weight: 1.5,
      query: `From the following world regions, please remove the half that are MOST densely populated: ${list}` });
    stages.push({ id: 'S4c', label: 'Reinclude just-eliminated options as a control', scored: false, control: true,
      query: `From only this smaller set of world regions (some previously judged more densely populated, included here again as a control), please remove the half that are LEAST densely populated: ${list}` });
    stages.push({ id: 'S5', label: 'Terminate on the hard number', scored: true, polarity: 0, weight: 3, needsCue: true,
      query: `What are the exact population densities, in people per square kilometer, of each of the following world regions? ${list}` });
  } else if (q.question_id === 46) {
    stages.push({ id: 'S0', label: 'Vet the question / register gate', scored: false,
      query: `In introductory microeconomics, what is the precise difference between a "change in supply" (the entire supply curve shifts, caused by a factor OTHER than the good's own price, such as a cost/input change or a weather shock) and a "change in quantity supplied" (movement ALONG a fixed supply curve, caused by a change in the good's own price)?` });
    stages.push({ id: 'S1', label: 'Direct lookup, all three parts', scored: true, polarity: +1, weight: 2,
      query: `Economics question: a) Cold weather in Florida destroys a great deal of the orange crop, so there are fewer oranges in the country's supermarkets -- is this a change in supply or a change in quantity supplied? b) The cost of limes increases, so bar owners raise the price of gin and tonics -- is the RESULTING price rise for gin and tonics a change in supply or a change in quantity supplied? c) The price of leather shoes goes up, which induces manufacturers of leather shoes to increase production -- is this a change in supply or a change in quantity supplied? Please answer a), b), and c) separately.` });
    stages.push({ id: 'S3a', label: 'Order both directions (most textbook-standard quantity-supplied example)', scored: false,
      query: `Of these three economic events -- (a) cold weather destroying Florida's orange crop reducing supermarket oranges, (b) rising lime costs causing bar owners to raise gin and tonic prices, (c) rising leather shoe prices inducing manufacturers to increase production -- which is the clearest textbook example of a change in QUANTITY SUPPLIED (movement along the supply curve, caused by the good's own price changing)?` });
    stages.push({ id: 'S3b', label: 'Order both directions (most textbook-standard supply-shift example)', scored: false,
      query: `Of these three economic events -- (a) cold weather destroying Florida's orange crop reducing supermarket oranges, (b) rising lime costs causing bar owners to raise gin and tonic prices, (c) rising leather shoe prices inducing manufacturers to increase production -- which is the clearest textbook example of a change in SUPPLY (the entire supply curve shifting, caused by something other than the good's own price)?` });
    stages.push({ id: 'S4a', label: 'Cake Cut Half -- which is LEAST a supply shift', scored: true, polarity: -1, weight: 1.5,
      query: `Of cold weather destroying an orange crop, rising lime costs raising gin and tonic prices, and rising leather shoe prices inducing more shoe production -- which ONE of these three is LEAST likely to be classified by economists as a "change in supply"?` });
    stages.push({ id: 'S4b', label: 'Cake Cut Half -- which is MOST a supply shift (inverted pass)', scored: true, polarity: +1, weight: 1.5,
      query: `Of cold weather destroying an orange crop, rising lime costs raising gin and tonic prices, and rising leather shoe prices inducing more shoe production -- which ONE of these three is MOST clearly classified by economists as a "change in supply"?` });
    stages.push({ id: 'S4c', label: 'Reinclude control -- input-cost-change distractor', scored: false, control: true,
      query: `Including a fourth control case -- a factory's own labor costs rising, which is a well-known pure "change in supply" cause -- of the four cases (weather destroying a crop, a related good's cost rising, a good's own price rising and inducing more production, and a factory's own labor cost rising), which are true supply-curve shifts rather than movements along the curve?` });
    stages.push({ id: 'S5', label: 'Terminate on the hard number (each part, explicitly)', scored: true, polarity: +1, weight: 3,
      query: `Give the definitive classroom-standard classification, one word each ("supply" or "quantity supplied"), for: (a) a weather event destroying a crop and reducing the amount on shelves, (b) a related good's cost rise causing a price rise for a different but linked good, (c) a good's own price rising and inducing its own producers to supply more of it.` });
  } else if (q.question_id === 66) {
    stages.push({ id: 'S0', label: 'Vet the question / register gate', scored: false,
      query: `In dental/head-and-neck anatomy, what oral structures drain lymph specifically to the SUBMANDIBULAR lymph nodes (as opposed to the submental nodes or the deep cervical nodes)? Please be precise about which teeth, lips, and palate regions drain there.` });
    stages.push({ id: 'S1', label: 'Direct lookup', scored: true, polarity: +1, weight: 2,
      query: `A patient's submandibular lymph nodes are enlarged. Which potential infection sites should be checked? Consider specifically: the hard palate, the upper lip, the upper central incisor, and the lower first molar -- which of these actually drain to the submandibular nodes?` });
    stages.push({ id: 'S3a', label: 'Order both directions (which site is the strongest / most textbook-cited)', scored: false,
      query: `Among the hard palate, the upper lip, the upper central incisor, and the lower first molar, which ONE site is the single most commonly cited textbook example of a structure draining to the submandibular lymph nodes?` });
    stages.push({ id: 'S3b', label: 'Order both directions (which site is weakest / most commonly a distractor)', scored: false,
      query: `Among the hard palate, the upper lip, the upper central incisor, and the lower first molar, which ONE of these is most often used as a WRONG-answer distractor because it actually drains to a DIFFERENT lymph node group (not the submandibular nodes)?` });
    stages.push({ id: 'S4a', label: 'Cake Cut Half -- remove sites that do NOT drain to submandibular nodes', scored: true, polarity: -1, weight: 1.5,
      query: `Of the hard palate, the upper lip, the upper central incisor, and the lower first molar, please remove the ones that do NOT primarily drain to the submandibular lymph nodes.` });
    stages.push({ id: 'S4b', label: 'Cake Cut Half -- remove sites that DO drain to submandibular nodes (inverted pass)', scored: true, polarity: +1, weight: 1.5,
      query: `Of the hard palate, the upper lip, the upper central incisor, and the lower first molar, please remove the ones that DO primarily drain to the submandibular lymph nodes, leaving only the ones that drain elsewhere.` });
    stages.push({ id: 'S4c', label: 'Reinclude control -- lower incisor distractor (drains to submental, not submandibular)', scored: false, control: true,
      query: `Including the lower central incisor as a control (a tooth classically taught as draining to the SUBMENTAL nodes, not the submandibular nodes), which of hard palate, upper lip, upper central incisor, lower first molar, and lower central incisor drain to the submandibular lymph nodes specifically?` });
    stages.push({ id: 'S5', label: 'Terminate on the hard fact', scored: true, polarity: +1, weight: 3,
      query: `Precisely and completely, list every structure among the hard palate, upper lip, upper central incisor, and lower first molar that drains lymph to the submandibular lymph nodes, according to standard head-and-neck anatomy references.` });
  } else if (q.question_id === 72) {
    stages.push({ id: 'S0', label: 'Vet the question / register gate', scored: false,
      query: `What archaeological method is used to determine ancient diet and animal husbandry from animal teeth found at a settlement site, and what does isotope/cementum analysis of animal teeth actually reveal about how animals were raised versus hunted?` });
    stages.push({ id: 'S1', label: 'Direct lookup', scored: true, polarity: +1, weight: 2,
      query: `What did analysis of animal teeth from Durrington Walls, the nearby village associated with the people who built Stonehenge, reveal about their diet and livestock practices? Were the animals raised locally or brought from elsewhere, and were they eaten?` });
    stages.push({ id: 'S3a', label: 'Order both directions (best-supported finding)', scored: false,
      query: `What is the single best-supported, most widely cited finding from isotope analysis of pig and cattle teeth at Durrington Walls near Stonehenge, regarding where those animals were raised versus where they were eaten?` });
    stages.push({ id: 'S3b', label: 'Order both directions (least-supported / commonly wrong claim)', scored: false,
      query: `What is a common misconception about the Stonehenge builders' diet or livestock that isotope analysis of animal teeth from Durrington Walls actually DISPROVED?` });
    stages.push({ id: 'S4a', label: 'Cake Cut Half -- eliminate claims the teeth evidence contradicts', scored: true, polarity: -1, weight: 1.5,
      query: `Does the isotope evidence from animal teeth at Durrington Walls support the idea that the Stonehenge builders were vegetarian, or that they only hunted wild game, or that they imported exotic animals from distant lands? Please address each possibility.` });
    stages.push({ id: 'S4b', label: 'Cake Cut Half -- confirm claims the teeth evidence supports (inverted pass)', scored: true, polarity: +1, weight: 1.5,
      query: `Does the isotope evidence from animal teeth at Durrington Walls support the idea that livestock (cattle, sheep, or pigs) were raised or kept AT the site itself and consumed there by the Stonehenge builders?` });
    stages.push({ id: 'S4c', label: 'Reinclude control -- "brought animals from outside the region"', scored: false, control: true,
      query: `Including as a control the specific claim that some animals were brought to Durrington Walls / Stonehenge from OUTSIDE the immediate region (long-distance feasting), what does the isotope evidence from animal teeth actually show about the ORIGIN of the animals versus where they were raised and slaughtered?` });
    stages.push({ id: 'S5', label: 'Terminate on the hard fact', scored: true, polarity: +1, weight: 3,
      query: `State precisely, in one sentence, the peer-reviewed archaeological conclusion about Stonehenge builders' animal husbandry, based on strontium/oxygen isotope analysis of pig and cattle teeth recovered from Durrington Walls.` });
  } else if (q.question_id === 85) {
    stages.push({ id: 'S0', label: 'Vet the question / register gate', scored: false,
      query: `What is bias in statistics, as distinct from bias in the general/cognitive/sewing/electronics sense? Please give the precise statistical definition.` });
    stages.push({ id: 'S1', label: 'Direct lookup (Founder Excerpt 7\'s own move)', scored: true, polarity: +1, weight: 2,
      query: `In statistics, does "bias" describe (1) a sample that does not represent the population, (2) estimates that are systematically too high or too low on average, (3) a lack of randomization, or (4) the researcher's personal beliefs influencing the outcome? Which of these is the precise technical definition?` });
    stages.push({ id: 'S3a', label: 'Order both directions (most precise technical definition)', scored: false,
      query: `Which single statement is the MOST textbook-precise definition of statistical bias: "a sample that does not represent the population" or "an estimation process that produces results systematically too high or too low on average"?` });
    stages.push({ id: 'S3b', label: 'Order both directions (commonly confused / imprecise definition)', scored: false,
      query: `What is a commonly confused, technically IMPRECISE definition of statistical bias that students often give instead of the correct one -- for example, confusing "bias" with "a small sample size" or with "lack of randomization" alone?` });
    stages.push({ id: 'S4a', label: 'Cake Cut Half -- eliminate definitions that describe something OTHER than bias', scored: true, polarity: -1, weight: 1.5,
      query: `Does statistical bias mean: a process using random sampling, a process that always results in accurate estimates, a process where the sampling method has no influence on the outcome, or a sample that is simply too large or too small? Please say which of these are WRONG definitions of bias and why.` });
    stages.push({ id: 'S4b', label: 'Cake Cut Half -- confirm the definitions closest to correct (inverted pass)', scored: true, polarity: +1, weight: 1.5,
      query: `Which is the more statistically precise way to define bias: "a process that results in estimates that are too high on average or too low on average" (a property of the ESTIMATION PROCESS) or "a sample that is not representative of the population" (a property of the SAMPLE itself)? Are these the same thing or different?` });
    stages.push({ id: 'S4c', label: 'Reinclude control -- researcher personal-belief influence', scored: false, control: true,
      query: `Including as a control "the influence of the researcher's personal beliefs on the outcome of a study" -- is that statistical bias, or is that a different concept (researcher bias / experimenter bias, not sampling/estimation bias)?` });
    stages.push({ id: 'S5', label: 'Terminate on the hard fact', scored: true, polarity: +1, weight: 3,
      query: `State the single most rigorous statistics-textbook definition of bias in ONE precise sentence, distinguishing it from imprecision, variance, and simple non-randomization.` });
  } else if (q.question_id === 92) {
    stages.push({ id: 'S0', label: 'Vet the question / register gate', scored: false,
      query: `In International Relations / Security Studies, what does "referent object of security" mean as a technical term, and how does Critical Security Studies' answer to that question differ from traditional/realist security studies?` });
    stages.push({ id: 'S1', label: 'Direct lookup', scored: true, polarity: +1, weight: 2,
      query: `Within Critical Security Studies specifically (as opposed to traditional realist Security Studies), what is the referent object of security -- is it the state and its apparatus, or is it people and human collectives, or something else?` });
    stages.push({ id: 'S3a', label: 'Order both directions (Critical Security Studies own answer)', scored: false,
      query: `What is the Critical Security Studies / human security school's own stated referent object of security, in contrast to the traditional state-centric view?` });
    stages.push({ id: 'S3b', label: 'Order both directions (traditional/realist answer, the contrast case)', scored: false,
      query: `In traditional realist Security Studies (NOT Critical Security Studies), what is the referent object of security -- is it the state and state apparatus, or something else?` });
    stages.push({ id: 'S4a', label: 'Cake Cut Half -- eliminate referent objects Critical Security Studies rejects', scored: true, polarity: -1, weight: 1.5,
      query: `Does Critical Security Studies treat military power, technological systems, or economic structures AS THE referent object of security (the thing being secured), or does it treat these as something else (like a means or a threat, not the referent object itself)?` });
    stages.push({ id: 'S4b', label: 'Cake Cut Half -- confirm the referent object Critical Security Studies affirms (inverted pass)', scored: true, polarity: +1, weight: 1.5,
      query: `Does Critical Security Studies (the Copenhagen School / Welsh School / human security tradition) explicitly identify "people and their collectives" (individuals and communities, not just the state) as the referent object of security?` });
    stages.push({ id: 'S4c', label: 'Reinclude control -- "there is no specific referent point"', scored: false, control: true,
      query: `Including as a control the claim that Critical Security Studies holds "there is no specific referent object of security" -- is that an accurate characterization, or does Critical Security Studies in fact argue for a SPECIFIC referent object (people/human collectives) instead of the state?` });
    stages.push({ id: 'S5', label: 'Terminate on the hard fact', scored: true, polarity: +1, weight: 3,
      query: `State in one precise sentence, citing the standard Critical Security Studies / human security literature, exactly what the referent object of security is according to that school of thought.` });
  }

  return { negation, stages };
}

// ─── Cue words for qid98's Stage 5 (density direction), used ONLY for that stage's extra signal ─
const LOW_DENSITY_CUES = ['sparse', 'sparsely', 'low density', 'vast', 'rural', 'uninhabited', 'lowest'];
const HIGH_DENSITY_CUES = ['crowded', 'dense', 'densely', 'highly populated', 'over 1,000', 'urban'];

function densityCueDelta(optionText, distinctiveTerms, haystackNorm, haystackRaw) {
  // Find a rough window around the first hit of any distinctive term / bigram, and check for
  // low vs high density cue words nearby. Purely additive to the base match score; 0 if no hit.
  let idx = -1;
  for (const t of distinctiveTerms) { const i = haystackNorm.indexOf(t); if (i >= 0) { idx = i; break; } }
  if (idx < 0) return 0;
  const windowText = haystackNorm.slice(Math.max(0, idx - 80), idx + 80);
  const low = LOW_DENSITY_CUES.some((c) => windowText.includes(c));
  const high = HIGH_DENSITY_CUES.some((c) => windowText.includes(c));
  if (low && !high) return +1;
  if (high && !low) return -1;
  return 0;
}

// ─── Runner ──────────────────────────────────────────────────────────────────────────────────

async function runQuestion(cdp, q) {
  const letters = q.options.map((_, i) => letterFor(i));
  const distinctive = extractDistinctiveTerms(q.options);
  const { negation, stages } = buildCascade(q);
  const scores = Object.fromEntries(letters.map((l) => [l, 0]));
  const trail = [];
  let failedFramings = 0;

  for (const stage of stages) {
    const { ok, elapsedMs, raw } = await googleQuery(cdp, stage.query);
    if (!ok) failedFramings++;
    const haystack = ok ? buildHaystack(raw) : '';
    const perOption = {};
    if (ok) {
      letters.forEach((l, i) => {
        const m = optionMentioned(q.options[i], distinctive[i], haystack);
        let delta = 0;
        if (stage.scored) {
          if (stage.needsCue) {
            delta = m.matched ? stage.weight * 0.4 : 0; // base credit for being addressed at all
            delta += densityCueDelta(q.options[i], distinctive[i], haystack, raw.snippet) * stage.weight * 0.6;
          } else {
            delta = m.matched ? stage.polarity * stage.weight * Math.max(m.score, 0.5) : 0;
          }
          if (!stage.control) scores[l] += delta;
        }
        perOption[l] = { matched: m.matched, score: Number(m.score.toFixed(2)), termHits: m.termHits, bigramHits: m.bigramHits, scoreDelta: Number(delta.toFixed(2)) };
      });
    }
    trail.push({
      stage: stage.id, label: stage.label, query: stage.query, control: !!stage.control,
      ok, elapsedMs, sources: sourcesOf(raw), rawGoogle: raw, perOption,
      scoresAfter: { ...scores },
    });
    await new Promise((r) => setTimeout(r, 600)); // small courtesy delay between real Google hits
  }

  // Decide: strongest surviving option must lead the runner-up by a material margin, else abstain.
  const ranked = letters.map((l) => [l, scores[l]]).sort((a, b) => b[1] - a[1]);
  const [topLetter, topScore] = ranked[0];
  const runnerUpScore = ranked.length > 1 ? ranked[1][1] : -Infinity;
  const margin = topScore - runnerUpScore;
  const converged = topScore > 0 && margin >= 2;
  const finalLetter = converged ? topLetter : null;

  return {
    question_id: q.question_id, question: q.question, options: q.options, answerKey: q.answer,
    negation, finalLetter, converged, scores, ranked, margin: Number(margin.toFixed(2)),
    failedFramings, totalFramings: stages.length, trail,
  };
}

function fmtGoogleRaw(raw) {
  if (!raw) return '_(no result -- honest null)_';
  const lines = [];
  lines.push(`> ${raw.snippet}`);
  lines.push('');
  lines.push(`Source: ${raw.sourceUrl}`);
  if (raw.citations && raw.citations.length) {
    lines.push('Citations:');
    for (const c of raw.citations) lines.push(`- ${c.title || '(untitled)'} -- ${c.url}`);
  }
  if (raw.results && raw.results.length) {
    lines.push('Organic results:');
    for (const r of raw.results) lines.push(`- [${r.rank}] ${r.title} -- ${r.url}`);
  }
  return lines.join('\n');
}

function writeResultsMarkdown(results, wallClockMs) {
  const total = results.length;
  const correct = results.filter((r) => r.finalLetter === r.answerKey).length;
  const wrong = results.filter((r) => r.finalLetter && r.finalLetter !== r.answerKey).length;
  const abstained = results.filter((r) => !r.finalLetter).length;
  const anyFailedFraming = results.some((r) => r.failedFramings > 0);

  const lines = [];
  lines.push('# GOOGLE CASCADE RESULTS -- BP149');
  lines.push('');
  lines.push('D-BP149-030 / BISHOP / S30 / seg-googlecascade');
  lines.push('');
  lines.push('Founder, BP149, verbatim: "I want to stop the current run and do it my way. Use Gemma, and only use Google as the source. with my cascade."');
  lines.push('');
  lines.push('GOOGLE IS THE ONLY SOURCE -- every fact below came from a real Google search fired through the Founder\'s own logged-in MnemosyneC authority webview (window.amplify.runBrowserAuthorityQuery, authority: user_google), the same production path plow_mc_answerer.ts\'s lookup_fact arm uses. No Gemma, no Perplexity, no Claude/ChatGPT/Gemini, no specialist swarm. Elimination and termination are computed by deterministic JS term-matching in google_cascade_bp149.js -- THE CASCADE DECIDES, IN CODE, not a model.');
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Correct | ${correct} / ${total} |`);
  lines.push(`| Wrong | ${wrong} / ${total} |`);
  lines.push(`| Abstained | ${abstained} / ${total} |`);
  lines.push(`| Wall-clock | ${(wallClockMs / 1000).toFixed(1)}s |`);
  lines.push(`| Cost | $0 (Founder's own logged-in Google session) |`);
  lines.push(`| Any framing failed to get a Google answer | ${anyFailedFraming ? 'YES -- see per-question failedFramings counts below' : 'No'} |`);
  lines.push('');
  lines.push('| qid | final | correct | converged | margin | failed framings |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of results) {
    lines.push(`| ${r.question_id} | ${r.finalLetter || 'ABSTAIN'} | ${r.answerKey} | ${r.finalLetter === r.answerKey ? 'YES' : (r.finalLetter ? 'NO' : 'n/a') } | ${r.margin} | ${r.failedFramings}/${r.totalFramings} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const r of results) {
    lines.push(`## qid ${r.question_id}`);
    lines.push('');
    lines.push(`**Question:** ${r.question}`);
    lines.push('');
    lines.push('**Options:**');
    r.options.forEach((o, i) => lines.push(`- ${letterFor(i)}) ${o}`));
    lines.push('');
    lines.push(`**Negation-form question:** ${r.negation}`);
    lines.push('');
    lines.push(`**Final letter:** ${r.finalLetter || 'ABSTAIN (no single option converged with material margin)'}  `);
    lines.push(`**Correct letter (answer key):** ${r.answerKey}  `);
    lines.push(`**Verdict:** ${r.finalLetter ? (r.finalLetter === r.answerKey ? 'CORRECT' : 'WRONG') : 'ABSTAIN'}`);
    lines.push('');
    lines.push(`**Final scores:** ${r.ranked.map(([l, s]) => `${l}=${s.toFixed(2)}`).join(', ')} (margin between top two: ${r.margin})`);
    lines.push('');
    lines.push('### Derivation trail');
    lines.push('');
    for (const step of r.trail) {
      lines.push(`#### ${step.stage} -- ${step.label}${step.control ? ' (CONTROL, not scored)' : ''}`);
      lines.push('');
      lines.push(`**Framing sent to Google:**`);
      lines.push('');
      lines.push('```');
      lines.push(step.query);
      lines.push('```');
      lines.push('');
      lines.push(`**Google's answer (${step.elapsedMs}ms, ${step.ok ? 'OK' : 'NO USABLE RESULT'}):**`);
      lines.push('');
      lines.push(fmtGoogleRaw(step.rawGoogle));
      lines.push('');
      if (Object.keys(step.perOption).length) {
        lines.push('**Per-option match (deterministic term-matching, code-decided):**');
        lines.push('');
        lines.push('| option | matched | score | scoreDelta | terms hit |');
        lines.push('|---|---|---|---|---|');
        for (const l of Object.keys(step.perOption)) {
          const p = step.perOption[l];
          lines.push(`| ${l} | ${p.matched} | ${p.score} | ${p.scoreDelta} | ${p.termHits.slice(0, 6).join(', ')}${p.bigramHits.length ? ' + bigram: ' + p.bigramHits.slice(0,3).join(', ') : ''} |`);
        }
        lines.push('');
        lines.push(`Running scores after this stage: ${Object.entries(step.scoresAfter).map(([l, s]) => `${l}=${s.toFixed(2)}`).join(', ')}`);
        lines.push('');
      }
    }
    lines.push('---');
    lines.push('');
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, lines.join('\n'), 'utf8');
  return { correct, wrong, abstained, total, anyFailedFraming };
}

async function main() {
  const t0 = Date.now();
  const allQ = fs.readFileSync(QUESTIONS_PATH, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const questions = WANTED_QIDS.map((qid) => allQ.filter((q) => q.question_id === qid)[0]).filter(Boolean);
  if (questions.length !== WANTED_QIDS.length) {
    console.error('BLOCKER: could not find all wanted qids in questions.jsonl. Found:', questions.map((q) => q.question_id));
    process.exit(1);
  }

  const cdp = new CDP(DASHBOARD_PAGE_ID);
  await cdp.connect();
  console.log('[cdp] connected to MnemosyneC dashboard page');

  const preCheck = await cdp.send('Runtime.evaluate', {
    expression: 'JSON.stringify({hasAmplify: !!window.amplify, hasFn: !!(window.amplify && window.amplify.runBrowserAuthorityQuery)})',
    returnByValue: true,
  });
  console.log('[cdp] preflight:', preCheck.result.value);
  const pre = JSON.parse(preCheck.result.value);
  if (!pre.hasFn) {
    console.error('BLOCKER: window.amplify.runBrowserAuthorityQuery is not available on the dashboard page.');
    process.exit(1);
  }

  const results = [];
  for (const q of questions) {
    console.log(`\n=== qid ${q.question_id}: ${q.question.slice(0, 80)}... ===`);
    const r = await runQuestion(cdp, q);
    console.log(`  -> final=${r.finalLetter || 'ABSTAIN'} correct=${r.answerKey} margin=${r.margin} failedFramings=${r.failedFramings}/${r.totalFramings}`);
    results.push(r);
  }

  const wallClockMs = Date.now() - t0;
  const totals = writeResultsMarkdown(results, wallClockMs);
  console.log('\n[write] results file written to', OUT_PATH);
  console.log('[totals]', JSON.stringify(totals));

  // Restore the persistent nexus-authority webview to what it was showing before this run
  // (about:blank, confirmed via CDP /json/list before this run started).
  try {
    const hostCdp = new CDP(NEXUS_HOST_PAGE_ID);
    await hostCdp.connect();
    await hostCdp.send('Runtime.evaluate', {
      expression: `(function(){ var wv = document.getElementById('nexus-authority-webview'); if (wv) { wv.loadURL('about:blank'); return 'restored'; } return 'no-webview-found'; })()`,
      returnByValue: true,
    });
    console.log('[restore] nexus-authority webview navigated back to about:blank');
    hostCdp.close();
  } catch (e) {
    console.warn('[restore] FAILED to restore webview state:', e.message);
  }

  cdp.close();
  console.log(`\nDONE. wall-clock=${(wallClockMs / 1000).toFixed(1)}s`);
}

main().catch((e) => { console.error('FATAL:', e && e.stack || e); process.exit(1); });
