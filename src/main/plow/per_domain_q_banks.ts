/**
 * Per-domain Q bank loader for MMLU-Pro question banks.
 * BP081 Wave B · used by v0.1.59 Spider fan-out + v0.1.60 Deep Test tab
 *
 * Compiled output: dist/main/plow/per_domain_q_banks.js
 * At runtime __dirname = dist/main/plow/
 * Data root:  ../../../lb-reproducibility-pack/datasets/mmlu_pro_per_domain/
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Question {
  question: string;
  options: string[];
  correct_answer: string;
  source_id: string;
  source_category: string;
}

export interface DomainStats {
  qCount: number;
  lastSealHash: string; // from SEAL.sha256
  domain: Domain;
}

export type Domain =
  | 'math'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'computer_science'
  | 'engineering'
  | 'history'
  | 'philosophy'
  | 'law'
  | 'business'
  | 'economics'
  | 'psychology'
  | 'health'
  | 'other';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const ALL_DOMAINS: Domain[] = [
  'math',
  'physics',
  'chemistry',
  'biology',
  'computer_science',
  'engineering',
  'history',
  'philosophy',
  'law',
  'business',
  'economics',
  'psychology',
  'health',
  'other',
];

/**
 * Resolve the MMLU-Pro data root.
 *
 * Packaged Electron app: data is bundled to {resources}/mmlu_pro/
 *   (extraResources in package.json maps lb-reproducibility-pack/... → mmlu_pro)
 * Dev mode: __dirname = dist/main/plow/ → three levels up hits the repo root.
 *
 * We try the packaged path first (it won't exist in dev, so existsSync falls
 * through to the dev path).
 */
function resolveDataRoot(): string {
  // process.resourcesPath is set by Electron in both modes but in dev it points
  // to the Electron binary's resources — the mmlu_pro subdir won't exist there.
  const packedPath = path.join(process.resourcesPath ?? '', 'mmlu_pro');
  if (fs.existsSync(packedPath)) {
    console.log('[per_domain_q_banks] DATA_ROOT → packed:', packedPath);
    return packedPath;
  }
  const devPath = path.join(__dirname, '../../../lb-reproducibility-pack/datasets/mmlu_pro_per_domain');
  console.log('[per_domain_q_banks] DATA_ROOT → dev fallback:', devPath);
  return devPath;
}

const DATA_ROOT = resolveDataRoot();

function domainDir(domain: Domain): string {
  return path.join(DATA_ROOT, domain);
}

// In-memory cache with 5-minute TTL
interface CacheEntry {
  questions: Question[];
  loadedAt: number; // Date.now()
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const bankCache = new Map<Domain, CacheEntry>();

function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.loadedAt < CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all 14 domain names.
 */
export function getDomainList(): Domain[] {
  return [...ALL_DOMAINS];
}

/**
 * Resolve the MMLU-Pro original answer key (option letter A–J) for grading.
 *
 * BP083 SEG-5: Founder-attested substrate seeds store full answer *text* in
 * `correct_answer` (e.g. "False, True"). The grader must NOT strip non-letters
 * from that string — it must match against the bundled option list, the same
 * key MMLU-Pro uses. Substrate seed eblets are for B/C retrieval only.
 */
export function resolveMMLUProAnswerLetter(question: Question): string | null {
  const raw = question.correct_answer.trim();
  if (!raw) return null;

  if (/^[A-J]$/i.test(raw)) {
    return raw.toUpperCase();
  }

  const normalizedAnswer = raw.toLowerCase();
  for (let i = 0; i < question.options.length; i++) {
    const opt = question.options[i]?.trim().toLowerCase() ?? '';
    if (opt === normalizedAnswer) {
      return OPTION_LABELS[i] ?? null;
    }
  }

  for (let i = 0; i < question.options.length; i++) {
    const opt = question.options[i]?.trim().toLowerCase() ?? '';
    if (!opt) continue;
    if (opt.includes(normalizedAnswer) || normalizedAnswer.includes(opt)) {
      return OPTION_LABELS[i] ?? null;
    }
  }

  console.warn(
    `[resolveMMLUProAnswerLetter] Could not resolve letter — answer="${raw.slice(0, 60)}"`,
  );
  return null;
}

/**
 * Loads and parses the sealed question bank for a domain.
 * Results are cached for 5 minutes. Throws if the file is missing or malformed.
 */
export function loadDomainBank(domain: Domain): Question[] {
  const cached = bankCache.get(domain);
  if (cached && isCacheValid(cached)) {
    console.log(`[PlowDiag][BankLoad] domain=${domain} cache=HIT count=${cached.questions.length}`);
    return cached.questions;
  }

  const filePath = path.join(domainDir(domain), 'questions.json');
  console.log(`[PlowDiag][BankLoad] domain=${domain} cache=MISS path=${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`[PlowDiag][BankLoad] MISSING questions.json domain=${domain} path=${filePath}`);
    throw new Error(
      `[per_domain_q_banks] Missing questions.json for domain '${domain}' at ${filePath}`
    );
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  let questions: Question[];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new TypeError('questions.json must be a JSON array at top level');
    }
    questions = parsed as Question[];
  } catch (err) {
    throw new Error(
      `[per_domain_q_banks] Failed to parse questions.json for domain '${domain}': ${(err as Error).message}`
    );
  }

  bankCache.set(domain, { questions, loadedAt: Date.now() });
  console.log(`[PlowDiag][BankLoad] domain=${domain} loaded count=${questions.length}`);
  return questions;
}

/**
 * Reads META.json + SEAL.sha256 for a domain and returns stats.
 * Does NOT use the cache (meta reads are cheap and infrequent).
 */
export function getDomainStats(domain: Domain): DomainStats {
  const metaPath = path.join(domainDir(domain), 'META.json');
  const sealPath = path.join(domainDir(domain), 'SEAL.sha256');

  if (!fs.existsSync(metaPath)) {
    throw new Error(
      `[per_domain_q_banks] Missing META.json for domain '${domain}' at ${metaPath}`
    );
  }
  if (!fs.existsSync(sealPath)) {
    throw new Error(
      `[per_domain_q_banks] Missing SEAL.sha256 for domain '${domain}' at ${sealPath}`
    );
  }

  const metaRaw = fs.readFileSync(metaPath, 'utf-8');
  let meta: { curation_pass_count: number; [key: string]: unknown };
  try {
    meta = JSON.parse(metaRaw) as { curation_pass_count: number; [key: string]: unknown };
  } catch (err) {
    throw new Error(
      `[per_domain_q_banks] Failed to parse META.json for domain '${domain}': ${(err as Error).message}`
    );
  }

  const sealLine = fs.readFileSync(sealPath, 'utf-8').trim();
  // Format: "sha256:<hash>  questions.json"
  const sealMatch = sealLine.match(/^sha256:([a-f0-9]{64})/);
  const lastSealHash = sealMatch ? sealMatch[1] : sealLine;

  return {
    qCount: meta.curation_pass_count as number,
    lastSealHash,
    domain,
  };
}
