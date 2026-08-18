/**
 * diagnosis_engine.ts — The Diagnosis core logic v0.4.1 BP083
 *
 * createDiagnosis  → saves to %APPDATA%/MnemosyneC/substrate/diagnosis_{id}.json
 * broadcastDiagnosis → sends to Constellation peers via peer_server
 * receiveDiagnosis → handler for incoming Diagnoses from peers
 * submitAnswer     → saves answer, broadcasts to poster
 * acceptAnswer     → marks resolved, triggers bounty payout
 * writeVerifiedEblet → writes resolved Q+A as substrate eblet
 *
 * Cooperative-class (Heart of Peace BP051): no extractive patterns.
 * "Just Add Salt" — Human Salt is the 3rd layer.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { randomBytes, createHash } from 'crypto';
import type {
  DiagnosisPost,
  DiagnosisAnswer,
  DiagnosisCreateInput,
  DiagnosisDomain,
} from './diagnosis_types';
import { SALT_LEVEL_CONFIGS } from './diagnosis_types';

// ─── Storage paths ────────────────────────────────────────────────────────────

function diagnosisDir(): string {
  const d = join(app.getPath('appData'), 'MnemosyneC', 'substrate', 'diagnosis');
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

function diagnosisPath(id: string): string {
  return join(diagnosisDir(), `diagnosis_${id}.json`);
}

function verifiedEbletPath(id: string): string {
  const d = join(app.getPath('appData'), 'MnemosyneC', 'substrate');
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return join(d, `diagnosis_verified_${id}.json`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateDiagnosisId(): string {
  return randomBytes(8).toString('hex');
}

function sha256hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

// ─── Core CRUD ────────────────────────────────────────────────────────────────

export async function createDiagnosis(input: DiagnosisCreateInput): Promise<string> {
  const id = generateDiagnosisId();
  const posterId = getUserId();

  const saltLevel = input.saltLevel ?? 'preserved_open';
  const saltCfg = SALT_LEVEL_CONFIGS[saltLevel];
  const noAutoExpiry = saltLevel === 'preserved_forever';

  const post: DiagnosisPost = {
    id,
    question: input.question,
    domain: input.domain,
    context: input.context,
    priorAttempts: input.priorAttempts,
    bounty: input.bounty,
    visibility: input.visibility,
    saltLevel,
    noAutoExpiry,
    posterId,
    posterName: input.posterName ?? 'Anonymous',
    timestamp: Date.now(),
    status: 'open',
    answers: [],
    source: input.source ?? 'manual',
  };

  writeFileSync(diagnosisPath(id), JSON.stringify(post, null, 2), 'utf8');
  console.log(`[DiagnosisEngine] Created diagnosis id=${id} domain=${input.domain} saltLevel=${saltLevel}`);

  // v0.4.1: schedule Catacomb relocation for preserved_forever
  if (saltLevel === 'preserved_forever' && saltCfg.autoExpiry) {
    import('./catacomb_migrator').then(({ scheduleCatacombRelocation }) => {
      scheduleCatacombRelocation(id, saltCfg.autoExpiry!).catch((err) =>
        console.error('[DiagnosisEngine] Catacomb schedule error:', err),
      );
    }).catch(() => { /* non-fatal */ });
  }

  // Broadcast to Constellation peers (non-blocking)
  broadcastDiagnosis(post).catch((err) =>
    console.error('[DiagnosisEngine] Broadcast error:', err),
  );

  return id;
}

export async function loadDiagnosis(id: string): Promise<DiagnosisPost | null> {
  try {
    const path = diagnosisPath(id);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8')) as DiagnosisPost;
  } catch {
    return null;
  }
}

export async function listDiagnoses(filter?: { status?: string; domain?: DiagnosisDomain }): Promise<DiagnosisPost[]> {
  try {
    const dir = diagnosisDir();
    const files = readdirSync(dir).filter((f) => f.startsWith('diagnosis_') && f.endsWith('.json'));
    const posts: DiagnosisPost[] = [];
    for (const f of files) {
      try {
        const post = JSON.parse(readFileSync(join(dir, f), 'utf8')) as DiagnosisPost;
        if (filter?.status && post.status !== filter.status) continue;
        if (filter?.domain && post.domain !== filter.domain) continue;
        posts.push(post);
      } catch { /* skip corrupted file */ }
    }
    return posts.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

export async function saveDiagnosis(post: DiagnosisPost): Promise<void> {
  writeFileSync(diagnosisPath(post.id), JSON.stringify(post, null, 2), 'utf8');
}

// ─── Answer submission ────────────────────────────────────────────────────────

export async function submitAnswer(
  diagnosisId: string,
  answerText: string,
  sources: string[],
  credentials?: string,
): Promise<string | null> {
  const post = await loadDiagnosis(diagnosisId);
  if (!post) return null;

  const answerId = generateDiagnosisId();
  const responderId = getUserId();

  const answer: DiagnosisAnswer = {
    id: answerId,
    diagnosisId,
    responderId,
    answerText,
    sources,
    credentials,
    timestamp: Date.now(),
    upvotes: 0,
  };

  post.answers.push(answer);
  if (post.status === 'open') post.status = 'answered';
  await saveDiagnosis(post);

  // Broadcast answer back to poster (non-blocking)
  broadcastAnswer(post, answer).catch((err) =>
    console.error('[DiagnosisEngine] Answer broadcast error:', err),
  );

  return answerId;
}

export async function upvoteAnswer(diagnosisId: string, answerId: string): Promise<void> {
  const post = await loadDiagnosis(diagnosisId);
  if (!post) return;
  const answer = post.answers.find((a) => a.id === answerId);
  if (answer) {
    answer.upvotes++;
    await saveDiagnosis(post);
  }
}

// ─── Accept answer + bounty + substrate write ─────────────────────────────────

export async function acceptAnswer(diagnosisId: string, answerId: string): Promise<boolean> {
  const post = await loadDiagnosis(diagnosisId);
  if (!post) return false;

  const answer = post.answers.find((a) => a.id === answerId);
  if (!answer) return false;

  post.acceptedAnswerId = answerId;
  post.status = 'resolved';
  await saveDiagnosis(post);

  // Write verified eblet to substrate
  await writeVerifiedEblet(post, answer);

  // Payout bounty
  const { payoutBounty } = await import('./bounty_substitution');
  await payoutBounty(post.bounty, post.posterId, answer.responderId);

  console.log(`[DiagnosisEngine] Accepted answer=${answerId} for diagnosis=${diagnosisId}`);
  return true;
}

// ─── Substrate write-back ─────────────────────────────────────────────────────

export async function writeVerifiedEblet(post: DiagnosisPost, answer: DiagnosisAnswer): Promise<void> {
  const content = {
    diagnosisId: post.id,
    question: post.question,
    domain: post.domain,
    answer: answer.answerText,
    sources: answer.sources,
    credentials: answer.credentials ?? null,
    resolvedAt: Date.now(),
    provenance: `diagnosis_verified:${post.id}:${answer.responderId}:bp083`,
    verified: true,
    sha256: sha256hex(post.question + answer.answerText),
  };

  writeFileSync(verifiedEbletPath(post.id), JSON.stringify(content, null, 2), 'utf8');

  // Also write to substrate API if available
  try {
    const { writeVerifiedEblet } = await import('../mnem_eblet_store');
    const { createHash } = await import('crypto');
    const q = `[Diagnosis:${post.domain}] ${post.question.slice(0, 120)}`;
    const a = answer.answerText.slice(0, 600);
    await writeVerifiedEblet({
      question: q,
      answer: a,
      provenance: `diagnosis:${post.id}`,
      verified: true,
      sha256: createHash('sha256').update(q + a).digest('hex'),
      timestamp: Date.now(),
    });
  } catch { /* non-fatal */ }

  console.log(`[DiagnosisEngine] Verified eblet written for diagnosis=${post.id}`);
}

// ─── Federation: broadcast/receive ───────────────────────────────────────────

export async function broadcastDiagnosis(post: DiagnosisPost): Promise<void> {
  if (post.visibility === 'lan') return; // LAN-only: don't broadcast

  // SCAFFOLD v0.4.0: broadcast to Constellation peers via peer_server HTTP
  try {
    const { discoverPeers } = await import('../federation/constellation_discovery');
    const peers = await discoverPeers();
    const onlinePeers = peers.filter((p) => p.online);

    await Promise.allSettled(
      onlinePeers.map((peer) =>
        fetch(`http://${peer.address}/api/diagnosis/post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(post),
          signal: AbortSignal.timeout(5000),
        }),
      ),
    );
  } catch { /* non-fatal */ }
}

export async function receiveDiagnosis(post: DiagnosisPost): Promise<void> {
  // Received from a Constellation peer — save locally
  const existing = await loadDiagnosis(post.id);
  if (existing) return; // Already have it

  writeFileSync(diagnosisPath(post.id), JSON.stringify(post, null, 2), 'utf8');
  console.log(`[DiagnosisEngine] Received diagnosis id=${post.id} from peer`);
}

async function broadcastAnswer(post: DiagnosisPost, answer: DiagnosisAnswer): Promise<void> {
  // SCAFFOLD v0.4.0: send answer back to poster's peer
  // In production: Thorax-encrypted Socceri transport
  try {
    const { discoverPeers } = await import('../federation/constellation_discovery');
    const peers = await discoverPeers();
    const posterPeer = peers.find((p) => p.id === post.posterId);
    if (!posterPeer?.online) return;

    await fetch(`http://${posterPeer.address}/api/diagnosis/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagnosisId: post.id, answer }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* non-fatal */ }
}

export async function receiveAnswer(diagnosisId: string, answer: DiagnosisAnswer): Promise<void> {
  const post = await loadDiagnosis(diagnosisId);
  if (!post) return;
  if (post.answers.some((a) => a.id === answer.id)) return; // Deduplicate

  post.answers.push(answer);
  if (post.status === 'open') post.status = 'answered';
  await saveDiagnosis(post);
}

// ─── Helper: get local user ID ────────────────────────────────────────────────

function getUserId(): string {
  try {
    const id = localStorage?.getItem?.('mnemo_lb_user_id');
    if (id) return id;
  } catch { /* renderer context only */ }
  // Main process fallback: use machine-stable ID from federation peer-discovery
  return 'local-user';
}
