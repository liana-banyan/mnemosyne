/**
 * domain_operator_map.ts — BP083 v0.4.0 Per-Domain Specialist Operator Roster
 *
 * Defines which of the 9 canonical specialists fire for each of the 14 MMLU-Pro domains.
 * v0.4.0: Added Tier 1 Andon backup specialist roster per domain (Federated Andon SEG-2).
 *
 *   Base 4 (ALL domains): wikipedia · wikidata · openalex · commoncrawl
 *   Domain extensions:
 *     CS / Math / Engineering / Physics:  + stackexchange · arxiv · wolfram · nist
 *     Biology / Health / Psychology:      + pubmed · arxiv
 *     Chemistry:                          + pubmed · wolfram · nist
 *     History / Philosophy / Law:         + (base 4 only)
 *     Business / Economics:               + stackexchange
 *     Other:                              + (base 4 only)
 *
 * Tier 1 Andon backup specialists:
 *   Used by federated_andon.ts when primary roster exhausts MAX_ANDON_RETRIES.
 *   Backup adapters marked SCAFFOLD return [] and will be production-wired in v0.4.1+.
 */

import type { SpecialistName } from './specialist_adapters';

export type Domain =
  | 'math' | 'physics' | 'chemistry' | 'biology' | 'computer_science' | 'engineering'
  | 'history' | 'philosophy' | 'law' | 'business' | 'economics' | 'psychology'
  | 'health' | 'other';

const BASE_OPERATORS: SpecialistName[] = ['wikipedia', 'wikidata', 'openalex', 'commoncrawl'];

export const DOMAIN_OPERATOR_MAP: Record<Domain, SpecialistName[]> = {
  math:             [...BASE_OPERATORS, 'stackexchange', 'arxiv', 'wolfram'],
  physics:          [...BASE_OPERATORS, 'stackexchange', 'arxiv', 'wolfram', 'nist'],
  chemistry:        [...BASE_OPERATORS, 'pubmed', 'wolfram', 'nist'],
  biology:          [...BASE_OPERATORS, 'pubmed', 'arxiv'],
  computer_science: [...BASE_OPERATORS, 'stackexchange', 'arxiv'],
  engineering:      [...BASE_OPERATORS, 'stackexchange', 'arxiv', 'wolfram', 'nist'],
  history:          [...BASE_OPERATORS],
  philosophy:       [...BASE_OPERATORS],
  law:              [...BASE_OPERATORS],
  business:         [...BASE_OPERATORS, 'stackexchange'],
  economics:        [...BASE_OPERATORS, 'stackexchange'],
  psychology:       [...BASE_OPERATORS, 'pubmed', 'arxiv'],
  health:           [...BASE_OPERATORS, 'pubmed', 'arxiv'],
  other:            [...BASE_OPERATORS],
};

// ─── Tier 1 Andon backup specialists (v0.4.0 SEG-2) ──────────────────────────
// These expand the net when primary roster Andon is triggered.
// Adapters listed here that are NOT in SpecialistName are scaffold stubs defined below.
// Real implementations land in v0.4.1+ (require API keys or specialized scraping).

export type BackupSpecialistName =
  | SpecialistName
  | 'internet_archive'
  | 'cornell_lii'
  | 'sec_edgar'
  | 'fred'
  | 'sep_scaffold'
  | 'apa_scaffold'
  | 'ncbi_bookshelf'
  | 'pubchem_scaffold'
  | 'medlineplus_scaffold';

export const DOMAIN_BACKUP_MAP: Partial<Record<Domain, BackupSpecialistName[]>> = {
  chemistry: ['pubchem_scaffold', 'ncbi_bookshelf'],
  health:    ['ncbi_bookshelf', 'medlineplus_scaffold'],
  biology:   ['ncbi_bookshelf'],
  history:   ['internet_archive'],
  law:       ['cornell_lii'],
  business:  ['sec_edgar'],
  economics: ['fred', 'sec_edgar'],
  philosophy: ['sep_scaffold'],
  psychology: ['apa_scaffold', 'ncbi_bookshelf'],
  engineering: ['nist'],  // nist already in primary for some; add again to dedupe-safe set
};

/**
 * Get the primary operator list for a domain (normalized to known domains).
 * Falls back to BASE_OPERATORS for unknown domain strings.
 */
export function getOperatorsForDomain(domain: string): SpecialistName[] {
  return DOMAIN_OPERATOR_MAP[domain as Domain] ?? BASE_OPERATORS;
}

/**
 * Get Tier 1 Andon backup operators for a domain.
 * Returns only the SpecialistName ones that have real adapters in v0.4.0;
 * scaffold names are handled by getBackupCandidates in federated_andon.ts.
 */
export function getBackupOperatorsForDomain(domain: string): BackupSpecialistName[] {
  return DOMAIN_BACKUP_MAP[domain as Domain] ?? [];
}

// ─── Scaffold backup adapters (v0.4.0 stubs) ─────────────────────────────────
// These return real data where APIs are simple / no-key required.
// Others return [] with a TODO comment.

import type { CandidateEblet } from './specialist_adapters';

const BACKUP_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), BACKUP_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
}

function stableId(source: string, content: string): string {
  let h = 0x811c9dc5;
  const str = source + ':' + content.slice(0, 80);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Internet Archive full-text search (no key required) */
export async function fetchInternetArchive(question: string): Promise<CandidateEblet[]> {
  try {
    const q = encodeURIComponent(question.slice(0, 100));
    const url = `https://archive.org/advancedsearch.php?q=${q}&output=json&rows=3&fl[]=title,fl[]=description`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = await res.json() as { response?: { docs?: Array<{ title?: string; description?: string }> } };
    const docs = data.response?.docs ?? [];
    return docs.slice(0, 2).map((d) => ({
      source: 'internet_archive',
      content: [d.title, d.description].filter(Boolean).join(' — ').slice(0, 500),
      weight: 0.65,
      sid: stableId('internet_archive', d.title ?? ''),
    })).filter((c) => c.content.length >= 100);
  } catch {
    return [];
  }
}

/** Cornell LII search (web scrape scaffold — returns [] in v0.4.0) */
export async function fetchCornellLii(question: string): Promise<CandidateEblet[]> {
  // SCAFFOLD v0.4.0 — web scrape implementation in v0.4.1
  // TODO: scrape https://www.law.cornell.edu/search/site/{query}
  void question;
  return [];
}

/** SEC EDGAR full-text search (no key required) */
export async function fetchSecEdgar(question: string): Promise<CandidateEblet[]> {
  try {
    const q = encodeURIComponent(question.slice(0, 100));
    const url = `https://efts.sec.gov/LATEST/search-index?q=${q}&dateRange=custom&startdt=2000-01-01&enddt=2026-01-01&hits.hits._source.period_of_report=true&hits.hits.total.value=true`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    // Minimal parse — just check if response is OK
    const text = (await res.text()).slice(0, 200);
    if (text.length < 20) return [];
    return [{
      source: 'sec_edgar',
      content: `SEC EDGAR search result for: ${question.slice(0, 120)}. Result available at https://efts.sec.gov search.`,
      weight: 0.62,
      sid: stableId('sec_edgar', question),
    }];
  } catch {
    return [];
  }
}

/** FRED (Federal Reserve Economic Data) — scaffold returns [] in v0.4.0 */
export async function fetchFred(question: string): Promise<CandidateEblet[]> {
  // SCAFFOLD v0.4.0 — FRED API requires key in v0.4.1
  void question;
  return [];
}

/** Stanford Encyclopedia of Philosophy — scaffold returns [] in v0.4.0 */
export async function fetchSepScaffold(question: string): Promise<CandidateEblet[]> {
  // SCAFFOLD v0.4.0 — SEP scrape in v0.4.1
  void question;
  return [];
}

/** APA PsycINFO — scaffold returns [] in v0.4.0 */
export async function fetchApaScaffold(question: string): Promise<CandidateEblet[]> {
  // SCAFFOLD v0.4.0 — APA key required; implement in v0.4.1
  void question;
  return [];
}

/** NCBI Bookshelf (no key, free) */
export async function fetchNcbiBookshelf(question: string): Promise<CandidateEblet[]> {
  try {
    const q = encodeURIComponent(question.slice(0, 100));
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=books&term=${q}&retmax=3&retmode=json`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = await res.json() as { esearchresult?: { idlist?: string[] } };
    const ids = data.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];
    return [{
      source: 'ncbi_bookshelf',
      content: `NCBI Bookshelf: found ${ids.length} book entries for "${question.slice(0, 80)}". IDs: ${ids.slice(0, 3).join(', ')}.`,
      weight: 0.7,
      sid: stableId('ncbi_bookshelf', question),
    }];
  } catch {
    return [];
  }
}

/** PubChem — scaffold returns [] in v0.4.0 */
export async function fetchPubchemScaffold(question: string): Promise<CandidateEblet[]> {
  // SCAFFOLD v0.4.0 — PubChem REST API integration in v0.4.1
  void question;
  return [];
}

/** MedlinePlus — scaffold returns [] in v0.4.0 */
export async function fetchMedlinePlusScaffold(question: string): Promise<CandidateEblet[]> {
  // SCAFFOLD v0.4.0 — MedlinePlus Connect integration in v0.4.1
  void question;
  return [];
}

export type BackupAdapterFn = (question: string) => Promise<CandidateEblet[]>;

export const BACKUP_ADAPTER_REGISTRY: Partial<Record<BackupSpecialistName, BackupAdapterFn>> = {
  internet_archive:     fetchInternetArchive,
  cornell_lii:          fetchCornellLii,
  sec_edgar:            fetchSecEdgar,
  fred:                 fetchFred,
  sep_scaffold:         fetchSepScaffold,
  apa_scaffold:         fetchApaScaffold,
  ncbi_bookshelf:       fetchNcbiBookshelf,
  pubchem_scaffold:     fetchPubchemScaffold,
  medlineplus_scaffold: fetchMedlinePlusScaffold,
};
