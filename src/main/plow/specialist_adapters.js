/**
 * specialist_adapters.ts — BP1xx Pawn Authority List Phase 1 · 13 External Specialist API Adapters
 *
 * Implements the Founder-Invented 14-Domain Looping Methodology external data layer.
 * Each adapter: accepts question text + domain → returns CandidateEblet[].
 * FireGuard 1.0s stagger between adapter dispatches per question (upstream caller).
 *
 * Adapter roster:
 *   1. Wikipedia    — en.wikipedia.org/api/rest_v1
 *   2. Wikidata     — www.wikidata.org/w/api.php
 *   3. StackExchange — api.stackexchange.com/2.3
 *   4. arXiv        — export.arxiv.org/api/query
 *   5. Wolfram Alpha — api.wolframalpha.com/v2/query  (key from env)
 *   6. OpenAlex     — api.openalex.org
 *   7. NIST         — webbook.nist.gov (chem/phys) + nvlpubs.nist.gov
 *   8. PubMed       — eutils.ncbi.nlm.nih.gov/entrez/eutils
 *   9. Common Crawl — index.commoncrawl.org CDX
 *  10. Europe PMC   — www.ebi.ac.uk/europepmc/webservices/rest  (BP1xx Phase 1, no key)
 *  11. openFDA      — api.fda.gov/drug/label.json  (BP1xx Phase 1, no key)
 *  12. MedlinePlus  — wsearch.nlm.nih.gov/ws/query  (BP1xx Phase 1, no key, XML)
 *  13. Crossref     — api.crossref.org/works  (BP1xx Phase 1, no key, polite pool)
 *
 * SPECIALIST_METADATA (below the registry) carries the Phase 1 Standard/Premium
 * tier + domain-affinity + cost seed for the Pawn authority list. Descriptive only.
 *
 * Weight scale: 0.0-1.0 (Miner threshold: >= 0.6).
 * Content length: Miner threshold >= 100 chars.
 * Timeout per adapter: 5000ms.
 *
 * KN-BP145-C (BP145): the per-adapter `weight` value below is no longer a hand-typed
 * constant. It is resolved per call, per (source, domain), through resolveSourceWeight()
 * (see the SourceCredibilityLedger section below), which returns UNMEASURED_PASSTHROUGH_WEIGHT
 * until a real outcome-attributed observation exists for that exact (source, domain) pair and
 * clears MIN_SAMPLE_SIZE_FOR_GATING. No observation-writer exists anywhere in this codebase yet
 * (attribution is blocked on KN-BP144-14 Phase 1, per SPEC_THE_BANYAN_METRIC_FOR_SOURCES_BP144.md
 * Section 1), so today every call resolves to UNMEASURED_PASSTHROUGH_WEIGHT -- honestly absent,
 * not the old 0.62-0.90 hand-typed guesses this replaces.
 */
// No observation-writer exists anywhere in this codebase yet: per SPEC Section 1, per-claim
// attribution (which specific source's content a scored answer's final letter actually rested
// on) is blocked on KN-BP144-14 Phase 1 landing. The ledger therefore starts, and today stays,
// EMPTY. This is intentional -- seeding it with anything, including the same 0.62-0.90 numbers
// under a new name, is exactly the fabrication this ticket exists to kill. In-memory only (a
// Map, not a file or DB table): nothing persists it across process restarts yet, because nothing
// writes to it yet either. Flagged as a known gap in the KN-BP145-C report, not papered over.
const sourceCredibilityLedger = new Map();
function sourceCredibilityKey(sourceId, domainId) {
    return `${sourceId}::${domainId}`;
}
/**
 * Minimum number of real, outcome-attributed observations a (source, domain) pair must carry
 * before its empirical score is allowed to gate, rank, or otherwise influence anything. Fixed
 * here, before any observation exists, and must not be adjusted later after seeing what some
 * source's score would look like at a different threshold (SPEC Section 2: "a minimum-n
 * threshold picked after seeing which sources look good or bad at various candidate thresholds
 * is not a threshold, it is the desired conclusion wearing a number").
 *
 * Rationale for 30: a conventional statistical floor for treating a binomial proportion's normal
 * approximation as reasonable (the "np >= 5 and n(1-p) >= 5" rule of thumb implies n >= 20 at the
 * worst case p = 0.5; 30 is the more common textbook rounding of that floor, sometimes called the
 * "n >= 30" rule for the sampling distribution of a mean/proportion to be treated as approximately
 * normal). At n = 30 and the worst-case true rate p = 0.5, the two-sided 95% Wald interval
 * half-width is 1.96 * sqrt(0.5*0.5/30) ~= 0.179 -- under 18 points, tight enough that a score
 * crossing this floor says something, not nothing. No source has any observations yet, so there
 * was nothing to tune this number against when it was picked; it is a textbook floor, not a
 * fitted one.
 */
export const MIN_SAMPLE_SIZE_FOR_GATING = 30;
/**
 * A record whose most recent observation (vintageDate) is older than this is treated as
 * UNMEASURED for gating/ranking purposes -- never as BAD (SPEC Section 4, "Source BM must decay
 * toward UNMEASURED, never toward BAD"). The underlying record (observedN, scoreValue,
 * vintageDate) is never deleted, decremented, or zeroed by this check; the vintage stamp is
 * exactly what lets a later reader see "this was true on this date" even after the score has
 * stopped gating anything (SPEC Section 4's "unmeasured-but-dated" fourth state). 180 days is a
 * deliberately generous idle window -- long enough that a source already cleared to gate is not
 * punished for a short quiet spell, short enough that a truly stale measurement stops being
 * trusted as current. Decay is evaluated lazily, at read time in resolveSourceWeight() below, not
 * by any background timer that mutates stored records.
 */
export const STALE_AFTER_MS = 180 * 24 * 60 * 60 * 1000;
/**
 * The value CandidateEblet.weight resolves to for any (source, domain) pair with no record, a
 * record below MIN_SAMPLE_SIZE_FOR_GATING, or a record older than STALE_AFTER_MS -- i.e., every
 * pair today, since the ledger starts empty and nothing writes to it yet.
 *
 * `weight` is a required `number` field (not optional) because three files this ticket does not
 * own read it via numeric threshold comparisons that must keep compiling and behaving sanely
 * without being touched: plow_mc_answerer.ts (`c.weight >= MINER_MIN_WEIGHT` at its Miner gate,
 * `b.weight - a.weight` at its Furnace sort), canonical_pipeline.ts (the same Miner-gate/Furnace-
 * sort pair, plus runSaladin()'s own `candidate.weight >= 0.7` / `candidate.weight >= 0.75`
 * heuristic-fallback thresholds), and csia_research.ts (the same Miner-gate pattern). All three
 * import MINER_MIN_WEIGHT = 0.6 from canonical_pipeline.ts.
 *
 * This constant is deliberately set to that same 0.6 -- not imported (canonical_pipeline.ts
 * already imports from this file, so importing back would create a circular module dependency;
 * the literal is duplicated intentionally, with this comment as the tie between them) -- so that
 * "unmeasured" is mathematically guaranteed to clear the Miner content-quality gate (neither
 * privileged nor penalized by it) while ALSO failing runSaladin's higher 0.7/0.75 skip-challenge
 * thresholds. That second effect is an intended, honest consequence, not an oversight: every
 * candidate from every adapter in this file now receives Saladin's full adversarial challenge
 * instead of the automatic pass the old fabricated high weights (0.80-0.90) used to buy it. More
 * scrutiny for an unmeasured source is the safe direction -- "gates nothing" must never be read
 * as "assume good."
 */
export const UNMEASURED_PASSTHROUGH_WEIGHT = 0.6;
/**
 * Resolves the effective CandidateEblet.weight for one (source, domain) pair. Returns the real
 * empirical score only when a record exists, has cleared MIN_SAMPLE_SIZE_FOR_GATING, and is not
 * stale (per STALE_AFTER_MS); otherwise returns UNMEASURED_PASSTHROUGH_WEIGHT. Every adapter
 * function below calls this in place of the hand-typed literal it used to return.
 */
export function resolveSourceWeight(sourceId, domainId) {
    const record = sourceCredibilityLedger.get(sourceCredibilityKey(sourceId, domainId));
    if (!record)
        return UNMEASURED_PASSTHROUGH_WEIGHT;
    if (record.observedN < MIN_SAMPLE_SIZE_FOR_GATING)
        return UNMEASURED_PASSTHROUGH_WEIGHT;
    const ageMs = Date.now() - Date.parse(record.vintageDate);
    if (!Number.isFinite(ageMs) || ageMs > STALE_AFTER_MS)
        return UNMEASURED_PASSTHROUGH_WEIGHT;
    return record.scoreValue;
}
/**
 * Records one real, outcome-attributed observation for a (source, domain) pair and returns the
 * updated record. Not called anywhere in this codebase yet -- no consumer currently attributes a
 * scored answer's correctness back to a specific source's claim (SPEC Section 1: per-claim
 * attribution is "currently absent" for both the specialist adapters and the browser
 * authorities). Exported now so the write side of the ledger exists and is ready the moment
 * per-claim attribution lands (KN-BP144-14 Phase 1), rather than being invented twice. A caller
 * that has not yet verified attribution has no business calling this -- recording an observation
 * against the wrong source is worse than recording nothing.
 */
export function recordSourceObservation(sourceId, domainId, wasCorrect, observedAt = new Date().toISOString()) {
    const key = sourceCredibilityKey(sourceId, domainId);
    const existing = sourceCredibilityLedger.get(key);
    const priorN = existing ? existing.observedN : 0;
    const priorScore = existing ? existing.scoreValue : 0;
    const newN = priorN + 1;
    const newScore = (priorScore * priorN + (wasCorrect ? 1 : 0)) / newN;
    const record = {
        sourceId,
        domainId,
        observedN: newN,
        scoreValue: newScore,
        vintageDate: observedAt,
    };
    sourceCredibilityLedger.set(key, record);
    return record;
}
/** Inspection/test hook only -- not a gating call site. Returns the raw stored record (if any),
 *  with no staleness or minimum-sample resolution applied (that logic lives in
 *  resolveSourceWeight() above). */
export function getSourceCredibilityRecord(sourceId, domainId) {
    return sourceCredibilityLedger.get(sourceCredibilityKey(sourceId, domainId));
}
const sourceAppearanceLog = new Map();
/**
 * Records ONE raw appearance, keyed by the citation's own hostname (`appearance.sourceDomain`):
 * creates that domain's appearance list if it does not exist yet, appends to it if it does --
 * exactly the Founder's "make a new source if not in there already, and add to the existing if it
 * is," scoped to appearances only. Returns whether this was a brand-new domain (for the "N new
 * vs. M existing" report the Founder's own ticket asked for) and the domain's running appearance
 * count. NEVER touches sourceCredibilityLedger, scoreValue, or observedN -- see this section's
 * header.
 */
export function recordSourceAppearance(appearance) {
    const key = appearance.sourceDomain;
    const existing = sourceAppearanceLog.get(key);
    const isNewDomain = !existing;
    const list = existing ? existing.slice() : [];
    list.push(appearance);
    sourceAppearanceLog.set(key, list);
    return { isNewDomain, appearanceCountForDomain: list.length };
}
/** Inspection/test hook -- every appearance recorded so far for one source domain, oldest first. */
export function getSourceAppearances(sourceDomain) {
    return sourceAppearanceLog.get(sourceDomain) ?? [];
}
/**
 * BP149 D-BP149-016 (Founder ruling R1, verbatim: "per-claim attribution" -- "A source earns or
 * loses standing on EACH FACT it supplies, never on the answer the fact fed into. ... the
 * observation record must carry the *claim* as its unit, not the *question*.") and R2 ("Make
 * sure recordSourceObservation() IS wired.").
 *
 * THE SIGNATURE QUESTION THIS TICKET WAS ASKED TO SETTLE: recordSourceObservation() above
 * already takes exactly one (sourceId, domainId, wasCorrect) event per call -- it was never
 * incapable of per-claim granularity, it simply had zero callers. No signature change was
 * needed; what was missing was a caller that loops per CLAIM instead of collapsing to one call
 * per QUESTION. This is that loop: one recordSourceObservation() call per receipt in `receipts`
 * (plow_mc_answerer.ts's ProvenanceReceipt[] -- the codebase's own existing claim unit, one per
 * candidate fact a voter actually saw), rather than a single call keyed on whichever authority
 * "won" the question. A source cited on 4 receipts across 4 questions earns 4 independent
 * (source, domain) observations here, never 1.
 *
 * DISCLOSED LIMITATION, not smoothed over: `wasCorrect` is the graded correctness of the FINAL
 * ANSWER the receipt contributed to, applied per-claim -- this codebase has no independent
 * per-fact truth check (no mechanism verifies "was THIS specific claim, on its own, true"). This
 * is the per-claim ATTRIBUTION unit R1 requires (each source's claim is scored separately from
 * every other source's claim on the same question), but it is not yet per-claim GROUND-TRUTH
 * verification (a source that supplied one correct and one incorrect fact to the SAME correct
 * answer still gets both scored as correct here). Closing that second gap needs a real fact-level
 * verifier, which does not exist anywhere in this repo today -- named as a follow-on, not invented
 * here to avoid it landing as a second half-built mechanism (R5's own defect class).
 *
 * When a receipt carries `citations` (BP149 R4's type-boundary fix -- see
 * BrowserAuthorityLookupResult.citations / ProvenanceReceipt.citations), each citation is ALSO
 * recorded as its own, finer-grained claim under the `citation:<hostname>` sourceId -- this is
 * how an individual citation the scraper collected actually reaches the ledger, not just the
 * coarser adapter/authority-name receipt it was attached to.
 */
export function recordSourceObservationsForClaims(receipts, domainId, wasCorrect, observedAt) {
    const out = [];
    for (const receipt of receipts) {
        out.push(recordSourceObservation(receipt.source, domainId, wasCorrect, observedAt));
        if (receipt.citations) {
            for (const citation of receipt.citations) {
                out.push(recordSourceObservation(`citation:${citation.category}`, domainId, wasCorrect, observedAt));
            }
        }
    }
    return out;
}
// ─── Internal helpers ──────────────────────────────────────────────────────────
const ADAPTER_TIMEOUT_MS = 5000;
async function fetchWithTimeout(url, opts) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), ADAPTER_TIMEOUT_MS);
    try {
        return await fetch(url, { ...opts, signal: controller.signal });
    }
    finally {
        clearTimeout(tid);
    }
}
function stableId(source, content) {
    // Simple stable ID without crypto (avoids import complications in renderer context)
    let h = 0x811c9dc5;
    const str = source + ':' + content.slice(0, 120);
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}
function extractSearchTerms(question) {
    // Remove stopwords, keep meaningful terms (max 6 words for API search)
    const stopwords = new Set([
        'what', 'is', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'and', 'or',
        'not', 'be', 'are', 'was', 'were', 'how', 'why', 'when', 'where', 'who', 'which',
        'does', 'do', 'did', 'has', 'have', 'had', 'will', 'would', 'could', 'should',
        'that', 'this', 'these', 'those', 'there', 'their', 'than', 'then', 'very',
        'can', 'may', 'might', 'shall', 'its', 'it', 'he', 'she', 'they', 'we', 'you',
        'if', 'but', 'by', 'from', 'about', 'into', 'through', 'between', 'because',
    ]);
    return question
        .replace(/[?.,!;:()[\]{}'"]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopwords.has(w.toLowerCase()))
        .slice(0, 6)
        .join(' ');
}
// ─── 1. Wikipedia ─────────────────────────────────────────────────────────────
export async function fetchWikipedia(question, domain, maxResults = 2) {
    const terms = extractSearchTerms(question);
    if (!terms)
        return [];
    try {
        // BP134 Yoke #32 Phase C: srlimit is the server-side result count -- raising ONLY the
        // local slice below without also raising this would be a no-op (Wikipedia never returns
        // more than srlimit hits to slice from). Both move together, gated by the same maxResults
        // caller-supplied cap (default 2 preserves today's live A/B/C behavior exactly).
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(terms)}&srlimit=${Math.max(2, maxResults)}&format=json&origin=*`;
        const searchResp = await fetchWithTimeout(searchUrl);
        if (!searchResp.ok)
            return [];
        const searchData = await searchResp.json();
        const results = searchData?.query?.search ?? [];
        if (results.length === 0)
            return [];
        const candidates = [];
        for (const hit of results.slice(0, maxResults)) {
            try {
                const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`;
                const summaryResp = await fetchWithTimeout(summaryUrl);
                if (!summaryResp.ok)
                    continue;
                const summary = await summaryResp.json();
                const content = summary.extract ?? '';
                if (content.length < 100)
                    continue;
                candidates.push({
                    source: 'wikipedia',
                    content: content.slice(0, 800),
                    weight: resolveSourceWeight('wikipedia', domain),
                    sid: stableId('wikipedia', content),
                    provenance_url: summary.content_urls?.desktop?.page,
                    domain,
                });
            }
            catch { /* skip on error */ }
        }
        return candidates;
    }
    catch {
        return [];
    }
}
// ─── 2. Wikidata ──────────────────────────────────────────────────────────────
export async function fetchWikidata(question, domain, maxResults = 2) {
    const terms = extractSearchTerms(question);
    if (!terms)
        return [];
    try {
        // BP134 Yoke #32 Phase C: same request-limit/local-slice pairing as fetchWikipedia above --
        // the request limit must rise with maxResults or the local slice has nothing extra to take.
        const requestLimit = Math.max(3, maxResults);
        const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(terms)}&language=en&limit=${requestLimit}&format=json&origin=*`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok)
            return [];
        const data = await resp.json();
        const results = data?.search ?? [];
        return results
            .filter((r) => r.description && r.description.length >= 30)
            .slice(0, maxResults)
            .map((r) => {
            const content = `${r.label ?? ''}: ${r.description ?? ''}`;
            return {
                source: 'wikidata',
                content: content.length >= 100 ? content : content + ' (Wikidata entity)',
                weight: resolveSourceWeight('wikidata', domain),
                sid: stableId('wikidata', content),
                provenance_url: r.url,
                domain,
            };
        })
            .filter((c) => c.content.length >= 100);
    }
    catch {
        return [];
    }
}
// ─── 3. StackExchange ─────────────────────────────────────────────────────────
export async function fetchStackExchange(question, domain, apiKey) {
    const terms = extractSearchTerms(question);
    if (!terms)
        return [];
    const site = ['computer_science', 'math', 'engineering', 'physics'].includes(domain)
        ? 'stackoverflow' : 'stackexchange';
    try {
        const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';
        const url = `https://api.stackexchange.com/2.3/search?site=${site}&intitle=${encodeURIComponent(terms)}&pagesize=3&filter=withbody${keyParam}`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok)
            return [];
        const data = await resp.json();
        const items = data?.items ?? [];
        return items
            .filter((item) => (item.score ?? 0) >= 0)
            .slice(0, 2)
            .map((item) => {
            const rawBody = (item.body ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const content = `${item.title ?? ''}: ${rawBody.slice(0, 600)}`;
            return {
                source: 'stackexchange',
                content: content.slice(0, 700),
                weight: resolveSourceWeight('stackexchange', domain),
                sid: stableId('stackexchange', content),
                provenance_url: item.link,
                domain,
            };
        })
            .filter((c) => c.content.length >= 100);
    }
    catch {
        return [];
    }
}
// ─── 4. arXiv ─────────────────────────────────────────────────────────────────
export async function fetchArxiv(question, domain) {
    const terms = extractSearchTerms(question);
    if (!terms)
        return [];
    try {
        const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(terms)}&max_results=3&sortBy=relevance`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok)
            return [];
        const xml = await resp.text();
        // Parse entries from Atom XML
        const entries = [];
        const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
        for (const match of entryMatches) {
            const entry = match[1];
            const title = (/<title>([\s\S]*?)<\/title>/.exec(entry))?.[1]?.trim() ?? '';
            const summary = (/<summary>([\s\S]*?)<\/summary>/.exec(entry))?.[1]?.trim() ?? '';
            const link = (/<id>([\s\S]*?)<\/id>/.exec(entry))?.[1]?.trim() ?? '';
            if (!summary || summary.length < 80)
                continue;
            const content = `${title}: ${summary}`.slice(0, 800);
            if (content.length < 100)
                continue;
            entries.push({
                source: 'arxiv',
                content,
                weight: resolveSourceWeight('arxiv', domain),
                sid: stableId('arxiv', content),
                provenance_url: link,
                domain,
            });
            if (entries.length >= 2)
                break;
        }
        return entries;
    }
    catch {
        return [];
    }
}
// ─── 5. Wolfram Alpha ─────────────────────────────────────────────────────────
export async function fetchWolframAlpha(question, domain, apiKey) {
    if (!apiKey)
        return [];
    const terms = extractSearchTerms(question);
    if (!terms)
        return [];
    try {
        const url = `https://api.wolframalpha.com/v2/query?input=${encodeURIComponent(terms)}&format=plaintext&output=JSON&appid=${encodeURIComponent(apiKey)}`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok)
            return [];
        const data = await resp.json();
        const pods = data?.queryresult?.pods ?? [];
        const snippets = [];
        for (const pod of pods.slice(0, 4)) {
            const podTitle = pod.title ?? '';
            for (const sub of pod.subpods ?? []) {
                const txt = sub.plaintext?.trim() ?? '';
                if (txt && txt.length >= 20) {
                    snippets.push(`${podTitle}: ${txt}`);
                }
            }
        }
        if (snippets.length === 0)
            return [];
        const content = snippets.join(' | ').slice(0, 800);
        if (content.length < 100)
            return [];
        return [{
                source: 'wolfram',
                content,
                weight: resolveSourceWeight('wolfram', domain),
                sid: stableId('wolfram', content),
                domain,
            }];
    }
    catch {
        return [];
    }
}
// ─── 6. OpenAlex ──────────────────────────────────────────────────────────────
export async function fetchOpenAlex(question, domain) {
    const terms = extractSearchTerms(question);
    if (!terms)
        return [];
    try {
        const url = `https://api.openalex.org/works?search=${encodeURIComponent(terms)}&per-page=3&select=title,abstract_inverted_index,doi&mailto=support@lianabanyan.com`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok)
            return [];
        const data = await resp.json();
        const results = data?.results ?? [];
        const candidates = [];
        for (const work of results.slice(0, 2)) {
            const title = work.title ?? '';
            // Reconstruct abstract from inverted index
            let abstract = '';
            if (work.abstract_inverted_index) {
                const posMap = [];
                for (const [word, positions] of Object.entries(work.abstract_inverted_index)) {
                    for (const pos of positions) {
                        posMap.push([pos, word]);
                    }
                }
                posMap.sort((a, b) => a[0] - b[0]);
                abstract = posMap.map((p) => p[1]).join(' ');
            }
            const content = abstract
                ? `${title}: ${abstract}`.slice(0, 700)
                : title.length >= 100 ? title : '';
            if (content.length < 100)
                continue;
            candidates.push({
                source: 'openalex',
                content,
                weight: resolveSourceWeight('openalex', domain),
                sid: stableId('openalex', content),
                provenance_url: work.doi ? `https://doi.org/${work.doi}` : undefined,
                domain,
            });
        }
        return candidates;
    }
    catch {
        return [];
    }
}
// ─── 7. NIST ──────────────────────────────────────────────────────────────────
export async function fetchNIST(question, domain) {
    const terms = extractSearchTerms(question);
    if (!terms)
        return [];
    try {
        // NIST NVLPUBS search (broad technical reference)
        const url = `https://nvlpubs.nist.gov/nistpubs/search/?sType=combined&query=${encodeURIComponent(terms)}&rows=3&format=json`;
        const resp = await fetchWithTimeout(url);
        if (resp.ok) {
            const data = await resp.json();
            const docs = data?.docs ?? [];
            const candidates = [];
            for (const doc of docs.slice(0, 2)) {
                const content = `${doc.title ?? ''}: ${doc.abstract ?? ''}`.slice(0, 700);
                if (content.length < 100)
                    continue;
                candidates.push({
                    source: 'nist',
                    content,
                    weight: resolveSourceWeight('nist', domain),
                    sid: stableId('nist', content),
                    provenance_url: doc.doi ? `https://doi.org/${doc.doi}` : undefined,
                    domain,
                });
            }
            if (candidates.length > 0)
                return candidates;
        }
        // Fallback: NIST WebBook for chemistry/physics constants
        if (['chemistry', 'physics', 'engineering'].includes(domain)) {
            const wbUrl = `https://webbook.nist.gov/cgi/cbook.cgi?Name=${encodeURIComponent(terms.split(' ')[0])}&Units=SI&cTG=on&cSA=on&sType=Name`;
            const wbResp = await fetchWithTimeout(wbUrl);
            if (wbResp.ok) {
                const html = await wbResp.text();
                const titleMatch = /<title>(.*?)<\/title>/i.exec(html);
                const descMatch = /<p[^>]*>([^<]{80,400})<\/p>/i.exec(html);
                if (titleMatch && descMatch) {
                    const content = `NIST WebBook: ${titleMatch[1].replace(' - NIST WebBook', '').trim()}: ${descMatch[1].trim()}`.slice(0, 600);
                    if (content.length >= 100) {
                        return [{
                                source: 'nist',
                                content,
                                weight: resolveSourceWeight('nist', domain),
                                sid: stableId('nist_webbook', content),
                                provenance_url: wbUrl,
                                domain,
                            }];
                    }
                }
            }
        }
        return [];
    }
    catch {
        return [];
    }
}
// ─── 8. PubMed ────────────────────────────────────────────────────────────────
export async function fetchPubMed(question, domain, apiKey) {
    const terms = extractSearchTerms(question);
    if (!terms)
        return [];
    try {
        const keyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';
        // Step 1: search for PMIDs
        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(terms)}&retmax=3&retmode=json${keyParam}`;
        const searchResp = await fetchWithTimeout(searchUrl);
        if (!searchResp.ok)
            return [];
        const searchData = await searchResp.json();
        const ids = searchData?.esearchresult?.idlist ?? [];
        if (ids.length === 0)
            return [];
        // Step 2: fetch summaries
        const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.slice(0, 2).join(',')}&retmode=json${keyParam}`;
        const summaryResp = await fetchWithTimeout(summaryUrl);
        if (!summaryResp.ok)
            return [];
        const summaryData = await summaryResp.json();
        const resultMap = summaryData?.result ?? {};
        const candidates = [];
        for (const id of ids.slice(0, 2)) {
            const item = resultMap[id];
            if (!item?.title)
                continue;
            const content = `PubMed (${item.pubdate ?? ''}): ${item.title}. Source: ${item.source ?? 'Journal'}`.slice(0, 600);
            if (content.length < 100)
                continue;
            candidates.push({
                source: 'pubmed',
                content,
                weight: resolveSourceWeight('pubmed', domain),
                sid: stableId('pubmed', content),
                provenance_url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
                domain,
            });
        }
        return candidates;
    }
    catch {
        return [];
    }
}
// ─── 9. Common Crawl ──────────────────────────────────────────────────────────
export async function fetchCommonCrawl(question, domain) {
    const terms = extractSearchTerms(question);
    if (!terms)
        return [];
    try {
        // Use the CDX API to search for crawled content about the topic
        // We use the latest CC-MAIN index via the CDX server
        const ccQuery = encodeURIComponent(terms.replace(/\s+/g, '+'));
        const cdxUrl = `https://index.commoncrawl.org/CC-MAIN-2024-10-index?url=*${ccQuery}*&output=json&limit=3&filter=status:200`;
        const resp = await fetchWithTimeout(cdxUrl);
        if (resp.ok) {
            const text = await resp.text();
            const lines = text.trim().split('\n').filter(Boolean);
            const candidates = [];
            for (const line of lines.slice(0, 2)) {
                try {
                    const entry = JSON.parse(line);
                    if (!entry.url)
                        continue;
                    // Build a meaningful content snippet from the CDX metadata
                    const content = `Common Crawl index: URL ${entry.url} was crawled in CC-MAIN-2024-10, confirming this is a publicly documented topic related to ${terms}.`;
                    if (content.length < 100)
                        continue;
                    candidates.push({
                        source: 'commoncrawl',
                        content,
                        weight: resolveSourceWeight('commoncrawl', domain),
                        sid: stableId('commoncrawl', entry.url),
                        provenance_url: entry.url,
                        domain,
                    });
                }
                catch {
                    continue;
                }
            }
            if (candidates.length > 0)
                return candidates;
        }
        // Fallback: search via Bing Web Search (CDX not great for keyword queries)
        // Use a simple DuckDuckGo instant answer fallback
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(terms)}&format=json&no_html=1&skip_disambig=1`;
        const ddgResp = await fetchWithTimeout(ddgUrl);
        if (ddgResp.ok) {
            const ddg = await ddgResp.json();
            const abstract = ddg.AbstractText ?? '';
            if (abstract.length >= 100) {
                return [{
                        source: 'commoncrawl',
                        content: abstract.slice(0, 700),
                        weight: resolveSourceWeight('commoncrawl', domain),
                        sid: stableId('duckduckgo', abstract),
                        provenance_url: ddg.AbstractURL,
                        domain,
                    }];
            }
            const related = ddg.RelatedTopics ?? [];
            for (const topic of related.slice(0, 2)) {
                const text = topic.Text ?? '';
                if (text.length >= 100) {
                    return [{
                            source: 'commoncrawl',
                            content: text.slice(0, 600),
                            weight: resolveSourceWeight('commoncrawl', domain),
                            sid: stableId('duckduckgo', text),
                            provenance_url: topic.FirstURL,
                            domain,
                        }];
                }
            }
        }
        return [];
    }
    catch {
        return [];
    }
}
// ─── 10. Europe PMC ───────────────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 1: no-key REST adapter, medicine/biology.
// Probed live 2026-07-31: https://www.ebi.ac.uk/europepmc/webservices/rest/search
// with resultType=core returns resultList.result[] items carrying abstractText
// (HTML-tagged, e.g. <h4>Background</h4>...) -- resultType=lite (the endpoint
// default) omits abstractText entirely, so core is required for usable content.
export async function fetchEuropePMC(question, domain, maxResults = 2) {
    const terms = extractSearchTerms(question);
    if (!terms)
        return [];
    try {
        const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(terms)}&format=json&resultType=core&pageSize=${Math.max(3, maxResults)}`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok)
            return [];
        const data = await resp.json();
        const results = data?.resultList?.result ?? [];
        if (results.length === 0)
            return [];
        const candidates = [];
        for (const r of results.slice(0, maxResults)) {
            const title = r.title ?? '';
            const abstract = (r.abstractText ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const content = (abstract ? `${title}: ${abstract}` : title).slice(0, 800);
            if (content.length < 100)
                continue;
            candidates.push({
                source: 'europepmc',
                content,
                weight: resolveSourceWeight('europepmc', domain),
                sid: stableId('europepmc', content),
                provenance_url: r.doi ? `https://doi.org/${r.doi}` : (r.pmid ? `https://europepmc.org/article/MED/${r.pmid}` : undefined),
                domain,
            });
        }
        return candidates;
    }
    catch {
        return [];
    }
}
// ─── 11. openFDA ──────────────────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 1: no-key REST adapter, drug/device safety.
// Probed live 2026-07-31: https://api.fda.gov/drug/label.json works with no key
// (the FDA-issued key only raises the rate limit). results[] items carry SPL
// label sections (indications_and_usage[], warnings_and_cautions[],
// boxed_warning[]) plus an openfda{} sub-object with brand_name/generic_name.
export async function fetchOpenFDA(question, domain, maxResults = 2) {
    const terms = extractSearchTerms(question);
    if (!terms)
        return [];
    try {
        const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(terms)}&limit=${Math.max(3, maxResults)}`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok)
            return [];
        const data = await resp.json();
        const results = data?.results ?? [];
        if (results.length === 0)
            return [];
        const candidates = [];
        for (const r of results.slice(0, maxResults)) {
            const name = r.openfda?.brand_name?.[0] ?? r.openfda?.generic_name?.[0] ?? '';
            const body = (r.indications_and_usage?.[0] ?? r.warnings_and_cautions?.[0] ?? r.boxed_warning?.[0] ?? '').trim();
            if (!body)
                continue;
            const content = `${name ? name + ': ' : ''}${body}`.slice(0, 800);
            if (content.length < 100)
                continue;
            candidates.push({
                source: 'openfda',
                content,
                weight: resolveSourceWeight('openfda', domain),
                sid: stableId('openfda', content),
                provenance_url: r.set_id ? `https://api.fda.gov/drug/label.json?search=set_id:${r.set_id}` : undefined,
                domain,
            });
        }
        return candidates;
    }
    catch {
        return [];
    }
}
// ─── 12. MedlinePlus ──────────────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 1: no-key REST adapter, health.
// Probed live 2026-07-31: https://wsearch.nlm.nih.gov/ws/query?db=healthTopics
// returns XML (not JSON) -- <document url="..."><content name="title">...
// </content><content name="FullSummary">...</content></document> per hit, with
// HTML-entity-escaped inner markup (e.g. &lt;span class="qt0"&gt;) that must be
// decoded before tag-stripping.
function decodeXmlEntities(s) {
    return s
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}
export async function fetchMedlinePlus(question, domain, maxResults = 2) {
    const terms = extractSearchTerms(question);
    if (!terms)
        return [];
    try {
        const url = `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${encodeURIComponent(terms)}&retmax=${Math.max(3, maxResults)}`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok)
            return [];
        const xml = await resp.text();
        const candidates = [];
        const docMatches = xml.matchAll(/<document[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/document>/g);
        for (const match of docMatches) {
            const docUrl = match[1];
            const body = match[2];
            const titleMatch = /<content name="title">([\s\S]*?)<\/content>/.exec(body);
            const summaryMatch = /<content name="FullSummary">([\s\S]*?)<\/content>/.exec(body);
            const title = decodeXmlEntities(titleMatch?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
            const summary = decodeXmlEntities(summaryMatch?.[1] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (!summary || summary.length < 60)
                continue;
            const content = `${title}: ${summary}`.slice(0, 800);
            if (content.length < 100)
                continue;
            candidates.push({
                source: 'medlineplus',
                content,
                weight: resolveSourceWeight('medlineplus', domain),
                sid: stableId('medlineplus', content),
                provenance_url: docUrl,
                domain,
            });
            if (candidates.length >= maxResults)
                break;
        }
        return candidates;
    }
    catch {
        return [];
    }
}
// ─── 13. Crossref ─────────────────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 1: no-key REST adapter, scholarly metadata
// across all domains. Probed live 2026-07-31: https://api.crossref.org/works
// with mailto= (polite pool, still no key/auth) returns message.items[] with
// title[]/container-title[]/abstract (JATS-tagged, often absent)/DOI/URL.
export async function fetchCrossref(question, domain, maxResults = 2) {
    const terms = extractSearchTerms(question);
    if (!terms)
        return [];
    try {
        const url = `https://api.crossref.org/works?query=${encodeURIComponent(terms)}&rows=${Math.max(3, maxResults)}&mailto=Social@lianabanyan.com`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok)
            return [];
        const data = await resp.json();
        const items = data?.message?.items ?? [];
        if (items.length === 0)
            return [];
        const candidates = [];
        for (const item of items.slice(0, maxResults)) {
            const title = item.title?.[0] ?? '';
            const container = item['container-title']?.[0] ?? '';
            const abstract = (item.abstract ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const content = (abstract ? `${title}: ${abstract}` : (container ? `${title} (${container})` : title)).slice(0, 800);
            if (content.length < 100)
                continue;
            candidates.push({
                source: 'crossref',
                content,
                weight: resolveSourceWeight('crossref', domain),
                sid: stableId('crossref', content),
                provenance_url: item.DOI ? `https://doi.org/${item.DOI}` : item.URL,
                domain,
            });
        }
        return candidates;
    }
    catch {
        return [];
    }
}
// ─── 14. ClinicalTrials.gov ───────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 2: no-key REST adapter, medicine/health.
// Probed live 2026-07-31: https://clinicaltrials.gov/api/v2/studies?query.term=...
// (v2 API -- the classic v1 /api/query API was retired) returns HTTP 200 with
// studies[] items carrying protocolSection.identificationModule.{nctId,briefTitle},
// .descriptionModule.briefSummary, .statusModule.overallStatus,
// .conditionsModule.conditions[].
export async function fetchClinicalTrials(question, domain, maxResults = 2) {
    const terms = extractSearchTerms(question);
    if (!terms)
        return [];
    try {
        const url = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(terms)}&pageSize=${Math.max(3, maxResults)}`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok)
            return [];
        const data = await resp.json();
        const studies = data?.studies ?? [];
        if (studies.length === 0)
            return [];
        const candidates = [];
        for (const s of studies.slice(0, maxResults)) {
            const ps = s.protocolSection;
            const nctId = ps?.identificationModule?.nctId;
            const title = ps?.identificationModule?.briefTitle ?? '';
            const summary = (ps?.descriptionModule?.briefSummary ?? '').replace(/\s+/g, ' ').trim();
            const status = ps?.statusModule?.overallStatus ?? '';
            const conditions = (ps?.conditionsModule?.conditions ?? []).join(', ');
            const body = summary || conditions;
            if (!body)
                continue;
            const content = `${title}${status ? ` (${status})` : ''}: ${body}`.slice(0, 800);
            if (content.length < 100)
                continue;
            candidates.push({
                source: 'clinicaltrials',
                content,
                weight: resolveSourceWeight('clinicaltrials', domain),
                sid: stableId('clinicaltrials', content),
                provenance_url: nctId ? `https://clinicaltrials.gov/study/${nctId}` : undefined,
                domain,
            });
        }
        return candidates;
    }
    catch {
        return [];
    }
}
// ─── 15. World Bank Indicators ────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 2: no-key REST adapter, economics/business.
// Probed live 2026-07-31: https://api.worldbank.org/v2/country/WLD/indicator/<code>
// ?format=json&mrv=1 returns HTTP 200 with a [meta, rows[]] tuple; rows[0] carries
// {indicator:{id,value}, country:{id,value}, countryiso3code, date, value}. The
// World Bank Indicators API has no free-text search over indicator content (only
// exact indicator codes / dataset browsing), so this adapter maps a curated set of
// common economics keywords found in the question to a known indicator code
// (defaulting to the World aggregate, most-recent-value via mrv=1) instead of
// attempting arbitrary full-text search. Returns [] (honest no-op) when no
// keyword in the question matches the curated table.
const WORLD_BANK_INDICATORS = [
    { keywords: ['gdp', 'gross domestic product'], code: 'NY.GDP.MKTP.CD', label: 'GDP (current US$)' },
    { keywords: ['inflation', 'consumer price', 'cpi'], code: 'FP.CPI.TOTL.ZG', label: 'Inflation, consumer prices (annual %)' },
    { keywords: ['unemployment'], code: 'SL.UEM.TOTL.ZS', label: 'Unemployment, total (% of total labor force)' },
    { keywords: ['population'], code: 'SP.POP.TOTL', label: 'Population, total' },
    { keywords: ['life expectancy'], code: 'SP.DYN.LE00.IN', label: 'Life expectancy at birth, total (years)' },
    { keywords: ['export'], code: 'NE.EXP.GNFS.CD', label: 'Exports of goods and services (current US$)' },
    { keywords: ['import'], code: 'NE.IMP.GNFS.CD', label: 'Imports of goods and services (current US$)' },
    { keywords: ['government debt', 'national debt', 'public debt'], code: 'GC.DOD.TOTL.GD.ZS', label: 'Central government debt, total (% of GDP)' },
    { keywords: ['poverty'], code: 'SI.POV.DDAY', label: 'Poverty headcount ratio at $2.15 a day (% of population)' },
    { keywords: ['interest rate'], code: 'FR.INR.RINR', label: 'Real interest rate (%)' },
    { keywords: ['trade'], code: 'NE.TRD.GNFS.ZS', label: 'Trade (% of GDP)' },
    { keywords: ['foreign direct investment', 'fdi'], code: 'BX.KLT.DINV.WD.GD.ZS', label: 'Foreign direct investment, net inflows (% of GDP)' },
];
const WORLD_BANK_COUNTRIES = [
    { keywords: ['united states', 'u.s.', 'usa', 'america'], code: 'US', name: 'United States' },
    { keywords: ['china'], code: 'CN', name: 'China' },
    { keywords: ['india'], code: 'IN', name: 'India' },
    { keywords: ['japan'], code: 'JP', name: 'Japan' },
    { keywords: ['germany'], code: 'DE', name: 'Germany' },
    { keywords: ['united kingdom', 'britain', 'u.k.'], code: 'GB', name: 'United Kingdom' },
    { keywords: ['world'], code: 'WLD', name: 'World' },
];
export async function fetchWorldBank(question, domain) {
    const qLower = question.toLowerCase();
    const indicator = WORLD_BANK_INDICATORS.find((i) => i.keywords.some((k) => qLower.includes(k)));
    if (!indicator)
        return [];
    const country = WORLD_BANK_COUNTRIES.find((c) => c.keywords.some((k) => qLower.includes(k)))
        ?? { keywords: [], code: 'WLD', name: 'World' };
    try {
        const url = `https://api.worldbank.org/v2/country/${country.code}/indicator/${indicator.code}?format=json&mrv=1`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok)
            return [];
        const data = await resp.json();
        const rows = data?.[1] ?? [];
        const row = rows[0];
        if (!row || row.value === null || row.value === undefined)
            return [];
        const countryName = row.country?.value ?? country.name;
        const content = `${indicator.label} — ${countryName}, ${row.date}: ${row.value} (World Bank Indicators, World Development Indicators source).`.slice(0, 500);
        if (content.length < 100)
            return [];
        return [{
                source: 'worldbank',
                content,
                weight: resolveSourceWeight('worldbank', domain),
                sid: stableId('worldbank', content),
                provenance_url: `https://data.worldbank.org/indicator/${indicator.code}?locations=${country.code}`,
                domain,
            }];
    }
    catch {
        return [];
    }
}
// ─── 16. Semantic Scholar Graph API ────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 2: keyless REST adapter (works without a key at
// a lower shared rate limit), broad multi-disciplinary scholarly coverage.
// Probed live 2026-07-31: https://api.semanticscholar.org/graph/v1/paper/search
// ?query=...&fields=title,abstract,url -- first burst attempt returned HTTP 429
// (shared keyless quota), retry after backoff returned HTTP 200 with
// { data: [{ paperId, title, abstract, url }] }. A 429 is treated the same as any
// other non-ok response here (silent []); the plow's staggered per-question
// dispatch already spaces adapter calls, and no key is available to raise the quota.
export async function fetchSemanticScholar(question, domain, maxResults = 2) {
    const terms = extractSearchTerms(question);
    if (!terms)
        return [];
    try {
        const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(terms)}&limit=${Math.max(3, maxResults)}&fields=title,abstract,url`;
        const resp = await fetchWithTimeout(url);
        if (!resp.ok)
            return [];
        const data = await resp.json();
        const results = data?.data ?? [];
        if (results.length === 0)
            return [];
        const candidates = [];
        for (const r of results.slice(0, maxResults)) {
            const title = r.title ?? '';
            const abstract = (r.abstract ?? '').replace(/\s+/g, ' ').trim();
            const content = (abstract ? `${title}: ${abstract}` : title).slice(0, 800);
            if (content.length < 100)
                continue;
            candidates.push({
                source: 'semanticscholar',
                content,
                weight: resolveSourceWeight('semanticscholar', domain),
                sid: stableId('semanticscholar', content),
                provenance_url: r.url,
                domain,
            });
        }
        return candidates;
    }
    catch {
        return [];
    }
}
export const SPECIALIST_REGISTRY = {
    wikipedia: (q, d, k) => fetchWikipedia(q, d, k?.maxResultsPerAdapter),
    wikidata: (q, d, k) => fetchWikidata(q, d, k?.maxResultsPerAdapter),
    stackexchange: (q, d, k) => fetchStackExchange(q, d, k?.stackExchangeKey),
    arxiv: (q, d) => fetchArxiv(q, d),
    wolfram: (q, d, k) => fetchWolframAlpha(q, d, k?.wolframApiKey),
    openalex: (q, d) => fetchOpenAlex(q, d),
    nist: (q, d) => fetchNIST(q, d),
    pubmed: (q, d, k) => fetchPubMed(q, d, k?.pubmedApiKey),
    commoncrawl: (q, d) => fetchCommonCrawl(q, d),
    europepmc: (q, d, k) => fetchEuropePMC(q, d, k?.maxResultsPerAdapter),
    openfda: (q, d, k) => fetchOpenFDA(q, d, k?.maxResultsPerAdapter),
    medlineplus: (q, d, k) => fetchMedlinePlus(q, d, k?.maxResultsPerAdapter),
    crossref: (q, d, k) => fetchCrossref(q, d, k?.maxResultsPerAdapter),
    clinicaltrials: (q, d, k) => fetchClinicalTrials(q, d, k?.maxResultsPerAdapter),
    worldbank: (q, d) => fetchWorldBank(q, d),
    semanticscholar: (q, d, k) => fetchSemanticScholar(q, d, k?.maxResultsPerAdapter),
};
export const SPECIALIST_METADATA = {
    wikipedia: { tier: 'standard', domains: ['general', 'history', 'philosophy', 'law', 'business', 'economics', 'other'], costNote: 'Free, no key required.' },
    wikidata: { tier: 'standard', domains: ['general', 'history', 'philosophy', 'law', 'business', 'economics', 'other'], costNote: 'Free, no key required.' },
    stackexchange: { tier: 'standard', domains: ['computer_science', 'math', 'engineering', 'physics', 'business', 'economics'], costNote: 'Free without key; optional key raises the daily quota.' },
    arxiv: { tier: 'standard', domains: ['math', 'physics', 'computer_science', 'engineering', 'biology', 'psychology'], costNote: 'Free, no key, no enforced rate limit.' },
    wolfram: { tier: 'premium', domains: ['math', 'physics', 'chemistry', 'engineering'], costNote: 'Requires a Wolfram Alpha AppID (free-tier signup exists); no-op with no key.' },
    openalex: { tier: 'standard', domains: ['general', 'biology', 'health', 'psychology'], costNote: 'Free, no key; mailto param opts into the polite pool.' },
    nist: { tier: 'standard', domains: ['physics', 'chemistry', 'engineering'], costNote: 'Free, no key required.' },
    pubmed: { tier: 'standard', domains: ['biology', 'chemistry', 'psychology', 'health'], costNote: 'Free without key; optional NCBI API key raises the rate limit.' },
    commoncrawl: { tier: 'standard', domains: ['general'], costNote: 'Free, no key; DuckDuckGo fallback also free/no key.' },
    europepmc: { tier: 'standard', domains: ['biology', 'health', 'chemistry'], costNote: 'Free, no key required (Europe PMC REST API).' },
    openfda: { tier: 'standard', domains: ['health'], costNote: 'Free, no key required (openFDA public API; FDA-issued key only raises rate limit).' },
    medlineplus: { tier: 'standard', domains: ['health'], costNote: 'Free, no key required (NLM Web Search Service, XML response).' },
    crossref: { tier: 'standard', domains: ['general', 'history', 'philosophy', 'law', 'business', 'economics', 'psychology', 'biology', 'health', 'math', 'physics', 'chemistry', 'computer_science', 'engineering', 'other'], costNote: 'Free, no key; mailto param opts into the Crossref polite pool.' },
    clinicaltrials: { tier: 'standard', domains: ['health'], costNote: 'Free, no key required (ClinicalTrials.gov API v2; the classic v1 API was retired).' },
    worldbank: { tier: 'standard', domains: ['economics', 'business'], costNote: 'Free, no key required (World Bank Indicators API; curated keyword-to-indicator lookup, not full-text search).' },
    semanticscholar: { tier: 'standard', domains: ['computer_science', 'economics', 'philosophy', 'law', 'biology', 'math', 'physics', 'chemistry', 'engineering', 'psychology', 'health', 'business', 'history'], costNote: 'Free without key; keyless calls share a lower rate limit (observed HTTP 429 under burst, recovers on backoff).' },
};
/** Pure resolver: explicit override wins, else default-by-tier (standard=on, premium=off). */
export function isAuthorityEnabled(name, overrides) {
    const override = overrides?.[name];
    if (override !== undefined)
        return override;
    return SPECIALIST_METADATA[name].tier === 'standard';
}
/**
 * Settings-read hook (main-process only). Reads ai_dispatch_settings.json's
 * `mnem_drt_specialists` object from userData and returns it as
 * AuthorityEnableOverrides. Electron/fs/path are require()'d lazily inside the
 * function body (not at module scope) so this file stays importable from a plain
 * Node context -- e.g. a compiled-output smoke test run outside Electron -- without
 * throwing at import time. Any failure (no Electron app, missing file, bad JSON)
 * yields {} (i.e. every specialist falls back to its tier default), never a throw.
 */
export function readAuthorityEnableOverridesFromSettings() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { app } = require('electron');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { readFileSync, existsSync } = require('fs');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { join } = require('path');
        const p = join(app.getPath('userData'), 'ai_dispatch_settings.json');
        if (!existsSync(p))
            return {};
        const parsed = JSON.parse(readFileSync(p, 'utf-8'));
        return parsed?.mnem_drt_specialists ?? {};
    }
    catch {
        return {};
    }
}
export const BROWSER_LLM_AUTHORITY_METADATA = {
    // BP140-K4: WIRED. Free, rate-limited: uses chatgpt.com's own logged-in free web UI via
    // MnemosyneC's embedded nexus browser -- an interactive type/submit/wait/scrape flow
    // (webview_preload.ts's CHATGPT_DRIVER_CONFIG), never the metered OpenAI API and never a
    // ChatGPT Plus subscription requirement. Still opt-in only (see isBrowserLlmAuthorityEnabled
    // below) -- a shared free-tier quota should never be spent without the user explicitly
    // turning it on.
    user_chatgpt: {
        tier: 'free',
        domains: ['all'],
        costNote: "Uses your own logged-in chatgpt.com session (free plan; ChatGPT Plus also works if you have it) via MnemosyneC's own embedded nexus browser -- an interactive type/submit/wait/scrape flow, not the metered OpenAI API.",
    },
    // BP140-K4: WIRED. Same free/opt-in contract as user_chatgpt above, against
    // gemini.google.com's own logged-in free web UI (webview_preload.ts's GEMINI_DRIVER_CONFIG).
    user_gemini: {
        tier: 'free',
        domains: ['all'],
        costNote: "Uses your own logged-in gemini.google.com session (free plan; Gemini Advanced also works if you have it) via MnemosyneC's own embedded nexus browser -- an interactive type/submit/wait/scrape flow, not the metered Google AI API.",
    },
    user_claude: {
        // (this build pass) relabeled premium -> free: wired against claude.ai's FREE, logged-in
        // web UI (claude.ai/new on the free plan), not a paid Claude Pro subscription and never the
        // metered Anthropic API (ai-providers/anthropic-client.ts is a separate, unrelated path and
        // is never used here). Still opt-in/default-OFF (see isBrowserLlmAuthorityEnabled below) --
        // "free" describes cost, not default-on-ness -- because the free plan is rate-limited and an
        // always-on second opinion could burn the user's daily/hourly message quota unexpectedly.
        tier: 'free',
        domains: ['all'],
        costNote: 'Uses your own logged-in claude.ai session (free plan; Claude Pro also works if you have it) via MnemosyneC\'s own embedded nexus browser -- an interactive type/submit/wait/scrape flow, not the metered Anthropic API. Rate-limited by claude.ai\'s own free-tier message caps; opt-in only because a shared free-plan quota should never be spent without you explicitly turning it on.',
    },
};
/** Pure resolver, same override-wins-else-tier-default contract as isAuthorityEnabled() above.
 *  Neither 'premium' nor 'free' (the only two BROWSER_LLM_AUTHORITY_METADATA tiers as of this
 *  build pass) is ever 'standard', so the tier-default branch is ALWAYS false here -- there is no
 *  code path in this function that can return true without an explicit `overrides[name] ===
 *  true`. This is the "default OFF, opt-in only" guarantee for every browser-LLM authority
 *  (including user_claude after its free-tier relabel above), provable by inspection of this one
 *  function. */
export function isBrowserLlmAuthorityEnabled(name, overrides) {
    const override = overrides?.[name];
    if (override !== undefined)
        return override;
    return BROWSER_LLM_AUTHORITY_METADATA[name].tier === 'standard'; // always false today
}
/**
 * Settings-read hook, main-process only. Reads the SAME ai_dispatch_settings.json /
 * mnem_drt_specialists object readAuthorityEnableOverridesFromSettings() already reads (no new
 * file, no new IPC channel) -- the renderer's SettingsTab.tsx AUTHORITY_SOURCES list writes
 * PREMIUM rows into this same `Record<string, boolean>` keyed by `src.key`, and since the file is
 * plain untyped JSON, adding 'user_chatgpt'/'user_gemini'/'user_claude' keys there is read here
 * without any schema change. Any failure (no Electron app, missing file, bad JSON) yields {}
 * (every browser-LLM authority falls back to its always-false tier default), never a throw.
 */
export function readBrowserLlmAuthorityEnableOverridesFromSettings() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { app } = require('electron');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { readFileSync, existsSync } = require('fs');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { join } = require('path');
        const p = join(app.getPath('userData'), 'ai_dispatch_settings.json');
        if (!existsSync(p))
            return {};
        const parsed = JSON.parse(readFileSync(p, 'utf-8'));
        return parsed?.mnem_drt_specialists ?? {};
    }
    catch {
        return {};
    }
}
const CONCORDANCE_STRICTNESS_VALUES = ['lenient', 'require_two', 'require_majority'];
/**
 * Settings-read hook, main-process only, same "read once, resolve per-call, fail-closed-to-
 * default" convention as readAuthorityEnableOverridesFromSettings()/
 * readBrowserLlmAuthorityEnableOverridesFromSettings() above -- reads the SAME
 * ai_dispatch_settings.json (userData dir) under a new top-level `concordance_strictness` key
 * (mirrors the existing `answer_cache_mode`/`csia_mode`/`csia_research` flat-key convention in
 * ai_dispatch_ipc.ts's AiDispatchSettings). Any failure (no Electron app, missing file, bad
 * JSON, or a value outside the 3-member union) yields 'lenient' -- the safe, behavior-preserving
 * default -- never a throw and never a guessed stricter mode.
 */
export function readConcordanceStrictnessFromSettings() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { app } = require('electron');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { readFileSync, existsSync } = require('fs');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { join } = require('path');
        const p = join(app.getPath('userData'), 'ai_dispatch_settings.json');
        if (!existsSync(p))
            return 'lenient';
        const parsed = JSON.parse(readFileSync(p, 'utf-8'));
        const raw = parsed?.concordance_strictness;
        if (raw && CONCORDANCE_STRICTNESS_VALUES.includes(raw)) {
            return raw;
        }
        return 'lenient';
    }
    catch {
        return 'lenient';
    }
}
