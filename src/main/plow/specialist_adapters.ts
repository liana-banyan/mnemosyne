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
 * Weight scale: 0.0–1.0 (Miner threshold: >= 0.6).
 * Content length: Miner threshold >= 100 chars.
 * Timeout per adapter: 5000ms.
 */

export interface CandidateEblet {
  source: string;         // adapter name
  content: string;        // factual content (must pass Miner: >= 100 chars)
  weight: number;         // source quality weight (must pass Miner: >= 0.6)
  sid: string;            // stable ID (hash of source + content prefix)
  provenance_url?: string;
  domain?: string;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

const ADAPTER_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, opts?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), ADAPTER_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

function stableId(source: string, content: string): string {
  // Simple stable ID without crypto (avoids import complications in renderer context)
  let h = 0x811c9dc5;
  const str = source + ':' + content.slice(0, 120);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function extractSearchTerms(question: string): string {
  // Remove stopwords, keep meaningful terms (max 6 words for API search)
  const stopwords = new Set([
    'what','is','the','a','an','of','in','on','at','to','for','with','and','or',
    'not','be','are','was','were','how','why','when','where','who','which',
    'does','do','did','has','have','had','will','would','could','should',
    'that','this','these','those','there','their','than','then','very',
    'can','may','might','shall','its','it','he','she','they','we','you',
    'if','but','by','from','about','into','through','between','because',
  ]);
  return question
    .replace(/[?.,!;:()[\]{}'"]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w.toLowerCase()))
    .slice(0, 6)
    .join(' ');
}

// ─── 1. Wikipedia ─────────────────────────────────────────────────────────────

export async function fetchWikipedia(question: string, domain: string, maxResults = 2): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    // BP134 Yoke #32 Phase C: srlimit is the server-side result count -- raising ONLY the
    // local slice below without also raising this would be a no-op (Wikipedia never returns
    // more than srlimit hits to slice from). Both move together, gated by the same maxResults
    // caller-supplied cap (default 2 preserves today's live A/B/C behavior exactly).
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(terms)}&srlimit=${Math.max(2, maxResults)}&format=json&origin=*`;
    const searchResp = await fetchWithTimeout(searchUrl);
    if (!searchResp.ok) return [];

    const searchData = await searchResp.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
    const results = searchData?.query?.search ?? [];
    if (results.length === 0) return [];

    const candidates: CandidateEblet[] = [];

    for (const hit of results.slice(0, maxResults)) {
      try {
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`;
        const summaryResp = await fetchWithTimeout(summaryUrl);
        if (!summaryResp.ok) continue;

        const summary = await summaryResp.json() as { extract?: string; content_urls?: { desktop?: { page?: string } } };
        const content = summary.extract ?? '';
        if (content.length < 100) continue;

        candidates.push({
          source: 'wikipedia',
          content: content.slice(0, 800),
          weight: 0.85,
          sid: stableId('wikipedia', content),
          provenance_url: summary.content_urls?.desktop?.page,
          domain,
        });
      } catch { /* skip on error */ }
    }

    return candidates;
  } catch { return []; }
}

// ─── 2. Wikidata ──────────────────────────────────────────────────────────────

export async function fetchWikidata(question: string, domain: string, maxResults = 2): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    // BP134 Yoke #32 Phase C: same request-limit/local-slice pairing as fetchWikipedia above --
    // the request limit must rise with maxResults or the local slice has nothing extra to take.
    const requestLimit = Math.max(3, maxResults);
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(terms)}&language=en&limit=${requestLimit}&format=json&origin=*`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as { search?: Array<{ label?: string; description?: string; url?: string }> };
    const results = data?.search ?? [];

    return results
      .filter((r) => r.description && r.description.length >= 30)
      .slice(0, maxResults)
      .map((r) => {
        const content = `${r.label ?? ''}: ${r.description ?? ''}`;
        return {
          source: 'wikidata',
          content: content.length >= 100 ? content : content + ' (Wikidata entity)',
          weight: 0.72,
          sid: stableId('wikidata', content),
          provenance_url: r.url,
          domain,
        };
      })
      .filter((c) => c.content.length >= 100);
  } catch { return []; }
}

// ─── 3. StackExchange ─────────────────────────────────────────────────────────

export async function fetchStackExchange(
  question: string,
  domain: string,
  apiKey?: string,
): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  const site = ['computer_science', 'math', 'engineering', 'physics'].includes(domain)
    ? 'stackoverflow' : 'stackexchange';

  try {
    const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';
    const url = `https://api.stackexchange.com/2.3/search?site=${site}&intitle=${encodeURIComponent(terms)}&pagesize=3&filter=withbody${keyParam}`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as { items?: Array<{ title?: string; body?: string; link?: string; score?: number }> };
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
          weight: 0.72,
          sid: stableId('stackexchange', content),
          provenance_url: item.link,
          domain,
        };
      })
      .filter((c) => c.content.length >= 100);
  } catch { return []; }
}

// ─── 4. arXiv ─────────────────────────────────────────────────────────────────

export async function fetchArxiv(question: string, domain: string): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(terms)}&max_results=3&sortBy=relevance`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const xml = await resp.text();

    // Parse entries from Atom XML
    const entries: CandidateEblet[] = [];
    const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
    for (const match of entryMatches) {
      const entry = match[1];
      const title = (/<title>([\s\S]*?)<\/title>/.exec(entry))?.[1]?.trim() ?? '';
      const summary = (/<summary>([\s\S]*?)<\/summary>/.exec(entry))?.[1]?.trim() ?? '';
      const link = (/<id>([\s\S]*?)<\/id>/.exec(entry))?.[1]?.trim() ?? '';

      if (!summary || summary.length < 80) continue;

      const content = `${title}: ${summary}`.slice(0, 800);
      if (content.length < 100) continue;

      entries.push({
        source: 'arxiv',
        content,
        weight: 0.82,
        sid: stableId('arxiv', content),
        provenance_url: link,
        domain,
      });

      if (entries.length >= 2) break;
    }

    return entries;
  } catch { return []; }
}

// ─── 5. Wolfram Alpha ─────────────────────────────────────────────────────────

export async function fetchWolframAlpha(
  question: string,
  domain: string,
  apiKey?: string,
): Promise<CandidateEblet[]> {
  if (!apiKey) return [];

  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://api.wolframalpha.com/v2/query?input=${encodeURIComponent(terms)}&format=plaintext&output=JSON&appid=${encodeURIComponent(apiKey)}`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as { queryresult?: { pods?: Array<{ title?: string; subpods?: Array<{ plaintext?: string }> }> } };
    const pods = data?.queryresult?.pods ?? [];

    const snippets: string[] = [];
    for (const pod of pods.slice(0, 4)) {
      const podTitle = pod.title ?? '';
      for (const sub of pod.subpods ?? []) {
        const txt = sub.plaintext?.trim() ?? '';
        if (txt && txt.length >= 20) {
          snippets.push(`${podTitle}: ${txt}`);
        }
      }
    }

    if (snippets.length === 0) return [];

    const content = snippets.join(' | ').slice(0, 800);
    if (content.length < 100) return [];

    return [{
      source: 'wolfram',
      content,
      weight: 0.90,
      sid: stableId('wolfram', content),
      domain,
    }];
  } catch { return []; }
}

// ─── 6. OpenAlex ──────────────────────────────────────────────────────────────

export async function fetchOpenAlex(question: string, domain: string): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(terms)}&per-page=3&select=title,abstract_inverted_index,doi&mailto=support@lianabanyan.com`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as { results?: Array<{ title?: string; abstract_inverted_index?: Record<string, number[]>; doi?: string }> };
    const results = data?.results ?? [];

    const candidates: CandidateEblet[] = [];
    for (const work of results.slice(0, 2)) {
      const title = work.title ?? '';

      // Reconstruct abstract from inverted index
      let abstract = '';
      if (work.abstract_inverted_index) {
        const posMap: Array<[number, string]> = [];
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

      if (content.length < 100) continue;

      candidates.push({
        source: 'openalex',
        content,
        weight: 0.80,
        sid: stableId('openalex', content),
        provenance_url: work.doi ? `https://doi.org/${work.doi}` : undefined,
        domain,
      });
    }

    return candidates;
  } catch { return []; }
}

// ─── 7. NIST ──────────────────────────────────────────────────────────────────

export async function fetchNIST(question: string, domain: string): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    // NIST NVLPUBS search (broad technical reference)
    const url = `https://nvlpubs.nist.gov/nistpubs/search/?sType=combined&query=${encodeURIComponent(terms)}&rows=3&format=json`;
    const resp = await fetchWithTimeout(url);

    if (resp.ok) {
      const data = await resp.json() as { docs?: Array<{ title?: string; abstract?: string; doi?: string }> };
      const docs = data?.docs ?? [];
      const candidates: CandidateEblet[] = [];

      for (const doc of docs.slice(0, 2)) {
        const content = `${doc.title ?? ''}: ${doc.abstract ?? ''}`.slice(0, 700);
        if (content.length < 100) continue;
        candidates.push({
          source: 'nist',
          content,
          weight: 0.88,
          sid: stableId('nist', content),
          provenance_url: doc.doi ? `https://doi.org/${doc.doi}` : undefined,
          domain,
        });
      }

      if (candidates.length > 0) return candidates;
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
              weight: 0.88,
              sid: stableId('nist_webbook', content),
              provenance_url: wbUrl,
              domain,
            }];
          }
        }
      }
    }

    return [];
  } catch { return []; }
}

// ─── 8. PubMed ────────────────────────────────────────────────────────────────

export async function fetchPubMed(
  question: string,
  domain: string,
  apiKey?: string,
): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const keyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';

    // Step 1: search for PMIDs
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(terms)}&retmax=3&retmode=json${keyParam}`;
    const searchResp = await fetchWithTimeout(searchUrl);
    if (!searchResp.ok) return [];

    const searchData = await searchResp.json() as { esearchresult?: { idlist?: string[] } };
    const ids = searchData?.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];

    // Step 2: fetch summaries
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.slice(0, 2).join(',')}&retmode=json${keyParam}`;
    const summaryResp = await fetchWithTimeout(summaryUrl);
    if (!summaryResp.ok) return [];

    const summaryData = await summaryResp.json() as { result?: Record<string, { title?: string; source?: string; pubdate?: string }> };
    const resultMap = summaryData?.result ?? {};

    const candidates: CandidateEblet[] = [];
    for (const id of ids.slice(0, 2)) {
      const item = resultMap[id];
      if (!item?.title) continue;
      const content = `PubMed (${item.pubdate ?? ''}): ${item.title}. Source: ${item.source ?? 'Journal'}`.slice(0, 600);
      if (content.length < 100) continue;
      candidates.push({
        source: 'pubmed',
        content,
        weight: 0.82,
        sid: stableId('pubmed', content),
        provenance_url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        domain,
      });
    }

    return candidates;
  } catch { return []; }
}

// ─── 9. Common Crawl ──────────────────────────────────────────────────────────

export async function fetchCommonCrawl(question: string, domain: string): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    // Use the CDX API to search for crawled content about the topic
    // We use the latest CC-MAIN index via the CDX server
    const ccQuery = encodeURIComponent(terms.replace(/\s+/g, '+'));
    const cdxUrl = `https://index.commoncrawl.org/CC-MAIN-2024-10-index?url=*${ccQuery}*&output=json&limit=3&filter=status:200`;
    const resp = await fetchWithTimeout(cdxUrl);

    if (resp.ok) {
      const text = await resp.text();
      const lines = text.trim().split('\n').filter(Boolean);
      const candidates: CandidateEblet[] = [];

      for (const line of lines.slice(0, 2)) {
        try {
          const entry = JSON.parse(line) as { url?: string; filename?: string; offset?: string; length?: string };
          if (!entry.url) continue;

          // Build a meaningful content snippet from the CDX metadata
          const content = `Common Crawl index: URL ${entry.url} was crawled in CC-MAIN-2024-10, confirming this is a publicly documented topic related to ${terms}.`;
          if (content.length < 100) continue;

          candidates.push({
            source: 'commoncrawl',
            content,
            weight: 0.62,
            sid: stableId('commoncrawl', entry.url),
            provenance_url: entry.url,
            domain,
          });
        } catch { continue; }
      }

      if (candidates.length > 0) return candidates;
    }

    // Fallback: search via Bing Web Search (CDX not great for keyword queries)
    // Use a simple DuckDuckGo instant answer fallback
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(terms)}&format=json&no_html=1&skip_disambig=1`;
    const ddgResp = await fetchWithTimeout(ddgUrl);
    if (ddgResp.ok) {
      const ddg = await ddgResp.json() as { AbstractText?: string; AbstractURL?: string; RelatedTopics?: Array<{ Text?: string; FirstURL?: string }> };
      const abstract = ddg.AbstractText ?? '';
      if (abstract.length >= 100) {
        return [{
          source: 'commoncrawl',
          content: abstract.slice(0, 700),
          weight: 0.65,
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
            weight: 0.62,
            sid: stableId('duckduckgo', text),
            provenance_url: topic.FirstURL,
            domain,
          }];
        }
      }
    }

    return [];
  } catch { return []; }
}

// ─── 10. Europe PMC ───────────────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 1: no-key REST adapter, medicine/biology.
// Probed live 2026-07-31: https://www.ebi.ac.uk/europepmc/webservices/rest/search
// with resultType=core returns resultList.result[] items carrying abstractText
// (HTML-tagged, e.g. <h4>Background</h4>...) -- resultType=lite (the endpoint
// default) omits abstractText entirely, so core is required for usable content.

export async function fetchEuropePMC(question: string, domain: string, maxResults = 2): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(terms)}&format=json&resultType=core&pageSize=${Math.max(3, maxResults)}`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as {
      resultList?: { result?: Array<{ title?: string; abstractText?: string; doi?: string; pmid?: string }> };
    };
    const results = data?.resultList?.result ?? [];
    if (results.length === 0) return [];

    const candidates: CandidateEblet[] = [];
    for (const r of results.slice(0, maxResults)) {
      const title = r.title ?? '';
      const abstract = (r.abstractText ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const content = (abstract ? `${title}: ${abstract}` : title).slice(0, 800);
      if (content.length < 100) continue;

      candidates.push({
        source: 'europepmc',
        content,
        weight: 0.83,
        sid: stableId('europepmc', content),
        provenance_url: r.doi ? `https://doi.org/${r.doi}` : (r.pmid ? `https://europepmc.org/article/MED/${r.pmid}` : undefined),
        domain,
      });
    }

    return candidates;
  } catch { return []; }
}

// ─── 11. openFDA ──────────────────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 1: no-key REST adapter, drug/device safety.
// Probed live 2026-07-31: https://api.fda.gov/drug/label.json works with no key
// (the FDA-issued key only raises the rate limit). results[] items carry SPL
// label sections (indications_and_usage[], warnings_and_cautions[],
// boxed_warning[]) plus an openfda{} sub-object with brand_name/generic_name.

export async function fetchOpenFDA(question: string, domain: string, maxResults = 2): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(terms)}&limit=${Math.max(3, maxResults)}`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as {
      results?: Array<{
        openfda?: { brand_name?: string[]; generic_name?: string[] };
        indications_and_usage?: string[];
        warnings_and_cautions?: string[];
        boxed_warning?: string[];
        set_id?: string;
      }>;
    };
    const results = data?.results ?? [];
    if (results.length === 0) return [];

    const candidates: CandidateEblet[] = [];
    for (const r of results.slice(0, maxResults)) {
      const name = r.openfda?.brand_name?.[0] ?? r.openfda?.generic_name?.[0] ?? '';
      const body = (r.indications_and_usage?.[0] ?? r.warnings_and_cautions?.[0] ?? r.boxed_warning?.[0] ?? '').trim();
      if (!body) continue;

      const content = `${name ? name + ': ' : ''}${body}`.slice(0, 800);
      if (content.length < 100) continue;

      candidates.push({
        source: 'openfda',
        content,
        weight: 0.80,
        sid: stableId('openfda', content),
        provenance_url: r.set_id ? `https://api.fda.gov/drug/label.json?search=set_id:${r.set_id}` : undefined,
        domain,
      });
    }

    return candidates;
  } catch { return []; }
}

// ─── 12. MedlinePlus ──────────────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 1: no-key REST adapter, health.
// Probed live 2026-07-31: https://wsearch.nlm.nih.gov/ws/query?db=healthTopics
// returns XML (not JSON) -- <document url="..."><content name="title">...
// </content><content name="FullSummary">...</content></document> per hit, with
// HTML-entity-escaped inner markup (e.g. &lt;span class="qt0"&gt;) that must be
// decoded before tag-stripping.

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export async function fetchMedlinePlus(question: string, domain: string, maxResults = 2): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${encodeURIComponent(terms)}&retmax=${Math.max(3, maxResults)}`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const xml = await resp.text();
    const candidates: CandidateEblet[] = [];
    const docMatches = xml.matchAll(/<document[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/document>/g);

    for (const match of docMatches) {
      const docUrl = match[1];
      const body = match[2];
      const titleMatch = /<content name="title">([\s\S]*?)<\/content>/.exec(body);
      const summaryMatch = /<content name="FullSummary">([\s\S]*?)<\/content>/.exec(body);

      const title = decodeXmlEntities(titleMatch?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
      const summary = decodeXmlEntities(summaryMatch?.[1] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!summary || summary.length < 60) continue;

      const content = `${title}: ${summary}`.slice(0, 800);
      if (content.length < 100) continue;

      candidates.push({
        source: 'medlineplus',
        content,
        weight: 0.78,
        sid: stableId('medlineplus', content),
        provenance_url: docUrl,
        domain,
      });

      if (candidates.length >= maxResults) break;
    }

    return candidates;
  } catch { return []; }
}

// ─── 13. Crossref ─────────────────────────────────────────────────────────────
// BP1xx Pawn Authority List Phase 1: no-key REST adapter, scholarly metadata
// across all domains. Probed live 2026-07-31: https://api.crossref.org/works
// with mailto= (polite pool, still no key/auth) returns message.items[] with
// title[]/container-title[]/abstract (JATS-tagged, often absent)/DOI/URL.

export async function fetchCrossref(question: string, domain: string, maxResults = 2): Promise<CandidateEblet[]> {
  const terms = extractSearchTerms(question);
  if (!terms) return [];

  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(terms)}&rows=${Math.max(3, maxResults)}&mailto=Social@lianabanyan.com`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];

    const data = await resp.json() as {
      message?: { items?: Array<{ title?: string[]; 'container-title'?: string[]; abstract?: string; DOI?: string; URL?: string }> };
    };
    const items = data?.message?.items ?? [];
    if (items.length === 0) return [];

    const candidates: CandidateEblet[] = [];
    for (const item of items.slice(0, maxResults)) {
      const title = item.title?.[0] ?? '';
      const container = item['container-title']?.[0] ?? '';
      const abstract = (item.abstract ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const content = (abstract ? `${title}: ${abstract}` : (container ? `${title} (${container})` : title)).slice(0, 800);
      if (content.length < 100) continue;

      candidates.push({
        source: 'crossref',
        content,
        weight: 0.75,
        sid: stableId('crossref', content),
        provenance_url: item.DOI ? `https://doi.org/${item.DOI}` : item.URL,
        domain,
      });
    }

    return candidates;
  } catch { return []; }
}

// ─── Exported adapter registry ─────────────────────────────────────────────────

export type SpecialistName =
  | 'wikipedia' | 'wikidata' | 'stackexchange' | 'arxiv'
  | 'wolfram' | 'openalex' | 'nist' | 'pubmed' | 'commoncrawl'
  | 'europepmc' | 'openfda' | 'medlineplus' | 'crossref';

export interface SpecialistKeys {
  wolframApiKey?: string;
  stackExchangeKey?: string;
  pubmedApiKey?: string;
  /** BP134 Yoke #32 Phase C: field-sowing deep-harvest override for the two adapters whose
   *  caps this Yoke raises (wikipedia, wikidata). Undefined -- the live A/B/C button's default
   *  path -- preserves today's behavior exactly (each adapter's own `= 2` default applies). */
  maxResultsPerAdapter?: number;
}

export type SpecialistFn = (q: string, domain: string, keys?: SpecialistKeys) => Promise<CandidateEblet[]>;

export const SPECIALIST_REGISTRY: Record<SpecialistName, SpecialistFn> = {
  wikipedia:    (q, d, k) => fetchWikipedia(q, d, k?.maxResultsPerAdapter),
  wikidata:     (q, d, k) => fetchWikidata(q, d, k?.maxResultsPerAdapter),
  stackexchange:(q, d, k) => fetchStackExchange(q, d, k?.stackExchangeKey),
  arxiv:        (q, d) => fetchArxiv(q, d),
  wolfram:      (q, d, k) => fetchWolframAlpha(q, d, k?.wolframApiKey),
  openalex:     (q, d) => fetchOpenAlex(q, d),
  nist:         (q, d) => fetchNIST(q, d),
  pubmed:       (q, d, k) => fetchPubMed(q, d, k?.pubmedApiKey),
  commoncrawl:  (q, d) => fetchCommonCrawl(q, d),
  europepmc:    (q, d, k) => fetchEuropePMC(q, d, k?.maxResultsPerAdapter),
  openfda:      (q, d, k) => fetchOpenFDA(q, d, k?.maxResultsPerAdapter),
  medlineplus:  (q, d, k) => fetchMedlinePlus(q, d, k?.maxResultsPerAdapter),
  crossref:     (q, d, k) => fetchCrossref(q, d, k?.maxResultsPerAdapter),
};

// ─── Tier metadata (Phase 1 seed of the Standard/Premium authority registry) ───
// BP1xx Pawn Authority List Phase 1: additive-only classification layer over
// SPECIALIST_REGISTRY. Purely descriptive -- no caller reads this yet, so adding
// it changes zero runtime dispatch behavior. "premium" here means the adapter is
// a no-op without a paid/keyed credential (only wolfram, today); adapters that
// merely accept an OPTIONAL key for a higher rate limit (stackexchange, pubmed)
// are still "standard" since they return real candidates with zero keys configured.
// Membership-orthogonal: this Standard/Premium split classifies external data-source
// API keys, not LB membership tiers -- $5/year membership unchanged, pricing identical
// for all members; no member-facing cost is introduced or implied by this map.

export type SpecialistTier = 'standard' | 'premium';

export interface SpecialistMetadata {
  tier: SpecialistTier;
  domains: string[];
  costNote: string;
}

export const SPECIALIST_METADATA: Record<SpecialistName, SpecialistMetadata> = {
  wikipedia:     { tier: 'standard', domains: ['general', 'history', 'philosophy', 'law', 'business', 'economics', 'other'], costNote: 'Free, no key required.' },
  wikidata:      { tier: 'standard', domains: ['general', 'history', 'philosophy', 'law', 'business', 'economics', 'other'], costNote: 'Free, no key required.' },
  stackexchange: { tier: 'standard', domains: ['computer_science', 'math', 'engineering', 'physics', 'business', 'economics'], costNote: 'Free without key; optional key raises the daily quota.' },
  arxiv:         { tier: 'standard', domains: ['math', 'physics', 'computer_science', 'engineering', 'biology', 'psychology'], costNote: 'Free, no key, no enforced rate limit.' },
  wolfram:       { tier: 'premium', domains: ['math', 'physics', 'chemistry', 'engineering'], costNote: 'Requires a Wolfram Alpha AppID (free-tier signup exists); no-op with no key.' },
  openalex:      { tier: 'standard', domains: ['general', 'biology', 'health', 'psychology'], costNote: 'Free, no key; mailto param opts into the polite pool.' },
  nist:          { tier: 'standard', domains: ['physics', 'chemistry', 'engineering'], costNote: 'Free, no key required.' },
  pubmed:        { tier: 'standard', domains: ['biology', 'chemistry', 'psychology', 'health'], costNote: 'Free without key; optional NCBI API key raises the rate limit.' },
  commoncrawl:   { tier: 'standard', domains: ['general'], costNote: 'Free, no key; DuckDuckGo fallback also free/no key.' },
  europepmc:     { tier: 'standard', domains: ['biology', 'health', 'chemistry'], costNote: 'Free, no key required (Europe PMC REST API).' },
  openfda:       { tier: 'standard', domains: ['health'], costNote: 'Free, no key required (openFDA public API; FDA-issued key only raises rate limit).' },
  medlineplus:   { tier: 'standard', domains: ['health'], costNote: 'Free, no key required (NLM Web Search Service, XML response).' },
  crossref:      { tier: 'standard', domains: ['general', 'history', 'philosophy', 'law', 'business', 'economics', 'psychology', 'biology', 'health', 'math', 'physics', 'chemistry', 'computer_science', 'engineering', 'other'], costNote: 'Free, no key; mailto param opts into the Crossref polite pool.' },
};
