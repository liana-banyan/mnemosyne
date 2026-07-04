/**
 * federated_andon.ts — 3-tier Federated Andon Cord v0.4.0 BP083
 *
 * Replaces v0.3.x "3 retries → quarantine" with 3-tier ESCALATE pattern.
 * Founder direct: "The goal is the right answer. We don't give up on a question."
 *
 * Tier 1 — Wider local specialist roster (backup adapters from DOMAIN_BACKUP_MAP)
 * Tier 2 — Federation query: broadcast to online Constellation peers (scaffold)
 * Tier 3 — The Diagnosis: post to human Members via diagnosis_engine (async, non-blocking)
 *
 * Tier 3 returns IMMEDIATELY (async). The answer arrives later and is written
 * as a diagnosis_verified_* eblet when the human responds.
 *
 * Status written to substrate as:
 *   - Tiers 1/2 resolved: 'verified_eblet'
 *   - Tier 3 pending:     'pending_human' (NOT quarantined)
 */

import type { CandidateEblet } from '../plow/specialist_adapters';
import type { SpecialistName } from '../plow/specialist_adapters';
import {
  getBackupOperatorsForDomain,
  BACKUP_ADAPTER_REGISTRY,
} from '../plow/domain_operator_map';
import { discoverPeers } from './constellation_discovery';

export type AndonTier = 1 | 2 | 3;

export type AndonResolution =
  | { status: 'resolved'; candidates: CandidateEblet[]; tier: AndonTier }
  | { status: 'pending_human'; diagnosisId: string; tier: 3 }
  | { status: 'no_answer'; tier: AndonTier };

export interface AndonEscalationState {
  domain: string;
  question: string;
  currentTier: AndonTier;
  retriesOnCurrentTier: number;
  resolved: boolean;
  answer: CandidateEblet[] | null;
  diagnosisId: string | null;
}

// ─── Tier 1: wider local specialist roster ────────────────────────────────────

async function tryTier1(
  domain: string,
  question: string,
  onProgress: (msg: string) => void,
): Promise<CandidateEblet[]> {
  const backupNames = getBackupOperatorsForDomain(domain);
  if (backupNames.length === 0) {
    onProgress(`[FederatedAndon] Tier 1: no backup specialists configured for ${domain}`);
    return [];
  }

  onProgress(`[FederatedAndon] Tier 1: trying ${backupNames.length} backup specialist(s) for ${domain}`);

  const results: CandidateEblet[] = [];
  for (const name of backupNames) {
    const fn = BACKUP_ADAPTER_REGISTRY[name];
    if (!fn) continue;
    try {
      const candidates = await fn(question);
      results.push(...candidates);
      if (results.length > 0) {
        onProgress(`[FederatedAndon] Tier 1: ${name} returned ${candidates.length} candidates`);
      }
    } catch {
      // Non-fatal — try next backup
    }
  }

  return results;
}

// ─── Tier 2: Federation query (cross-machine Constellation) ───────────────────

async function tryTier2(
  domain: string,
  question: string,
  onProgress: (msg: string) => void,
): Promise<CandidateEblet[]> {
  onProgress(`[FederatedAndon] Tier 2: querying Constellation peers for ${domain}…`);

  let peers: Awaited<ReturnType<typeof discoverPeers>> = [];
  try {
    peers = await discoverPeers();
  } catch {
    return [];
  }

  const onlinePeers = peers.filter((p) => p.online);
  if (onlinePeers.length === 0) {
    onProgress(`[FederatedAndon] Tier 2: no online peers — escalating to Tier 3`);
    return [];
  }

  // SCAFFOLD v0.4.0: query each peer for the specific question
  // Production: use Thorax-encrypted Socceri transport in v0.4.1
  const peerResults = await Promise.allSettled(
    onlinePeers.map(async (peer) => {
      const url = `http://${peer.address}/api/plow-domain`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          questions: [question],
          ollamaBaseUrl: 'http://127.0.0.1:11434',
          model: 'gemma4:12b',
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) return [];
      const data = await res.json() as { candidates?: CandidateEblet[]; ebletsWritten?: number };
      return data.candidates ?? [];
    }),
  );

  const allCandidates: CandidateEblet[] = [];
  for (const result of peerResults) {
    if (result.status === 'fulfilled') {
      allCandidates.push(...result.value);
    }
  }

  if (allCandidates.length > 0) {
    onProgress(`[FederatedAndon] Tier 2: ${allCandidates.length} candidates from Constellation`);
  } else {
    onProgress(`[FederatedAndon] Tier 2: no candidates from ${onlinePeers.length} peer(s) — escalating to Tier 3`);
  }

  return allCandidates;
}

// ─── Tier 3: The Diagnosis (human network broadcast) ─────────────────────────

async function tryTier3(
  domain: string,
  question: string,
  onProgress: (msg: string) => void,
): Promise<string | null> {
  onProgress(`[FederatedAndon] Tier 3: posting to The Diagnosis for ${domain}: "${question.slice(0, 80)}…"`);

  try {
    const { createDiagnosis } = await import('../diagnosis/diagnosis_engine');
    const diagnosisId = await createDiagnosis({
      question,
      domain: domain as import('../diagnosis/diagnosis_types').DiagnosisDomain,
      context: `Auto-escalated from Federated Andon after Tiers 1+2 exhausted. Domain: ${domain}.`,
      priorAttempts: 'Local specialists + Constellation peers queried — no verified answer found.',
      bounty: { rail: 'marks', amount: 5 },
      visibility: 'constellation',
      source: 'andon_auto_escalation',
    });
    onProgress(`[FederatedAndon] Tier 3: Diagnosis posted (id=${diagnosisId}) — pending human response`);
    return diagnosisId;
  } catch (err) {
    onProgress(`[FederatedAndon] Tier 3: Diagnosis post failed — ${String(err)}`);
    return null;
  }
}

// ─── Main escalation entry point ──────────────────────────────────────────────

export async function escalateAndon(
  domain: string,
  question: string,
  onProgress: (msg: string) => void,
): Promise<AndonResolution> {
  // Tier 1: wider local roster
  const tier1Candidates = await tryTier1(domain, question, onProgress);
  if (tier1Candidates.length > 0) {
    return { status: 'resolved', candidates: tier1Candidates, tier: 1 };
  }

  // Tier 2: Constellation peers
  const tier2Candidates = await tryTier2(domain, question, onProgress);
  if (tier2Candidates.length > 0) {
    return { status: 'resolved', candidates: tier2Candidates, tier: 2 };
  }

  // Tier 3: The Diagnosis
  const diagnosisId = await tryTier3(domain, question, onProgress);
  if (diagnosisId) {
    return { status: 'pending_human', diagnosisId, tier: 3 };
  }

  return { status: 'no_answer', tier: 3 };
}
