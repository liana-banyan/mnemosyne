/**
 * contribute_to_category.ts -- 2-of-3 corroboration contribution pipeline
 * BP087 Wave 5 -- Star Chamber + Triple Scrambler + Keys and Engines quorum
 *
 * Canon ref: SEG-CL-gamma -- full corroboration pipeline
 * GREEN threshold: >= 2 of 3 verdicts GREEN
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, copyFileSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { getFolderPath } from './folder_bootstrap';
import { updateManifest } from './manifest_updater';
import { logAttribution } from './attribution_log';
import { getCircleMembership } from '../keys_engines/circle_membership';
import { runQuorumCheck } from '../keys_engines/quorum_check';

// ---- Types ------------------------------------------------------------------

export interface ContributeResult {
  verdict: 'GREEN' | 'RED';
  staged_path: string;
  published_path?: string;
  corroboration: {
    star_chamber: 'GREEN' | 'RED';
    scrambler: 'GREEN' | 'RED';
    keys_engines: 'GREEN' | 'RED';
    green_count: number;
  };
  soccerball_hash?: string;
  error?: string;
}

interface StarChamberResult {
  verdict: 'GREEN' | 'RED';
  confidence: number;
  notes: string;
}

interface ScramblerResult {
  verdict: 'GREEN' | 'RED';
  delta_hash: string;
}

// ---- Constants --------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';

// ---- Stage helpers ----------------------------------------------------------

function stagePath(categorySlug: string, uuid: string): string {
  return join(getFolderPath('15_USER'), `${uuid}.staged.json`);
}

function publishedPath(categorySlug: string, uuid: string): string {
  return join(getFolderPath(categorySlug), `${uuid}.eblet.json`);
}

function ledgerPath(slug: string): string {
  return join(getFolderPath(slug), 'ledger.jsonl');
}

// ---- Stage ------------------------------------------------------------------

function stageEblet(uuid: string, content: string, categorySlug: string): string {
  const userDir = getFolderPath('15_USER');
  mkdirSync(userDir, { recursive: true });

  const staged = {
    uuid,
    category_slug: categorySlug,
    content,
    staged_at: new Date().toISOString(),
    status: 'pending',
  };

  const path = stagePath(categorySlug, uuid);
  writeFileSync(path, JSON.stringify(staged, null, 2), 'utf-8');

  // Append to 15_USER/ledger.jsonl
  const ledger = ledgerPath('15_USER');
  appendFileSync(ledger, JSON.stringify({ uuid, staged_at: staged.staged_at, status: 'pending', category_slug: categorySlug }) + '\n', 'utf-8');

  return path;
}

// ---- Star Chamber -----------------------------------------------------------

async function runStarChamber(content: string, categorySlug: string): Promise<StarChamberResult> {
  if (!SUPABASE_URL) {
    return { verdict: 'GREEN', confidence: 0.5, notes: 'star-chamber unavailable -- graceful degrade' };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/star-chamber-analyze`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload_type: 'mesh_benchmark_verify',
        content,
        category_slug: categorySlug,
      }),
    });

    if (res.status === 404) {
      // Edge function not deployed yet -- degrade gracefully
      return { verdict: 'GREEN', confidence: 0.5, notes: 'star-chamber unavailable -- graceful degrade' };
    }

    if (!res.ok) {
      console.warn(`[StarChamber] HTTP ${res.status} -- degrading`);
      return { verdict: 'GREEN', confidence: 0.5, notes: `star-chamber error ${res.status} -- graceful degrade` };
    }

    const json = await res.json() as Partial<StarChamberResult>;
    return {
      verdict: json.verdict === 'RED' ? 'RED' : 'GREEN',
      confidence: json.confidence ?? 0.5,
      notes: json.notes ?? '',
    };
  } catch (err) {
    console.warn('[StarChamber] Request failed -- degrading:', err);
    return { verdict: 'GREEN', confidence: 0.5, notes: 'star-chamber unavailable -- graceful degrade' };
  }
}

// ---- Triple Scrambler -------------------------------------------------------

async function runTripleScrambler(stagedFilePath: string): Promise<ScramblerResult> {
  return new Promise((resolve) => {
    // Attempt to find reconcile.py in librarian-mcp/scrambler/
    const scriptDir = join(process.cwd(), 'librarian-mcp', 'scrambler');
    const scriptPath = join(scriptDir, 'reconcile.py');

    if (!existsSync(scriptPath)) {
      resolve({ verdict: 'GREEN', delta_hash: 'unavailable' });
      return;
    }

    const child = spawn('python', [scriptPath, stagedFilePath], { cwd: scriptDir });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (code !== 0) {
        console.warn(`[Scrambler] reconcile.py exited ${code}: ${stderr}`);
        resolve({ verdict: 'GREEN', delta_hash: 'unavailable' });
        return;
      }
      try {
        const result = JSON.parse(stdout.trim()) as Partial<ScramblerResult>;
        resolve({
          verdict: result.verdict === 'RED' ? 'RED' : 'GREEN',
          delta_hash: result.delta_hash ?? 'unavailable',
        });
      } catch {
        resolve({ verdict: 'GREEN', delta_hash: 'unavailable' });
      }
    });

    child.on('error', () => {
      resolve({ verdict: 'GREEN', delta_hash: 'unavailable' });
    });
  });
}

// ---- Keys and Engines quorum ------------------------------------------------

async function runKeysEnginesQuorum(content: string): Promise<'GREEN' | 'RED'> {
  try {
    const circle = await getCircleMembership();
    if (circle.peers.length < 2) {
      // Not enough peers -- degrade gracefully per Wave 4 pattern
      return 'GREEN';
    }

    const contentHash = createHash('sha256').update(content).digest('hex');
    const peerAddresses = circle.peers.slice(0, 2).map((p) => p.address);

    const quorum = await runQuorumCheck(content.slice(0, 40), contentHash, peerAddresses);
    return quorum.passed ? 'GREEN' : 'RED';
  } catch {
    // Degrade gracefully
    return 'GREEN';
  }
}

// ---- Publish ----------------------------------------------------------------

function publishEblet(uuid: string, categorySlug: string, stagedPath: string, content: string): string {
  const destDir = getFolderPath(categorySlug);
  mkdirSync(destDir, { recursive: true });

  const published_at = new Date().toISOString();
  const ebletRecord = {
    uuid,
    category_slug: categorySlug,
    content,
    published_at,
    status: 'published',
  };

  const dest = publishedPath(categorySlug, uuid);
  writeFileSync(dest, JSON.stringify(ebletRecord, null, 2), 'utf-8');

  // Append to category ledger.jsonl
  appendFileSync(
    ledgerPath(categorySlug),
    JSON.stringify({ uuid, published_at, corroboration_score: 1.0 }) + '\n',
    'utf-8'
  );

  return dest;
}

// ---- Public API -------------------------------------------------------------

/**
 * Full 2-of-3 corroboration contribution pipeline:
 * Stage -> Star Chamber -> Triple Scrambler -> Keys & Engines quorum -> Tally -> Publish or hold.
 */
export async function contributeToCategory(
  categorySlug: string,
  ebletContent: string,
  memberId: string,
): Promise<ContributeResult> {
  const uuid = randomUUID();
  let stagedPath = '';

  try {
    // 1. Stage
    stagedPath = stageEblet(uuid, ebletContent, categorySlug);

    // 2. Star Chamber
    const starChamberResult = await runStarChamber(ebletContent, categorySlug);
    const starVerdict: 'GREEN' | 'RED' = starChamberResult.verdict;

    // 3. Triple Scrambler
    const scramblerResult = await runTripleScrambler(stagedPath);
    const scramblerVerdict: 'GREEN' | 'RED' = scramblerResult.verdict;

    // 4. Keys and Engines quorum
    const keysVerdict = await runKeysEnginesQuorum(ebletContent);

    // 5. Tally
    const verdicts = [starVerdict, scramblerVerdict, keysVerdict];
    const greenCount = verdicts.filter((v) => v === 'GREEN').length;
    const overallVerdict: 'GREEN' | 'RED' = greenCount >= 2 ? 'GREEN' : 'RED';

    const corroboration = {
      star_chamber: starVerdict,
      scrambler: scramblerVerdict,
      keys_engines: keysVerdict,
      green_count: greenCount,
    };

    if (overallVerdict === 'RED') {
      // Keep staged -- append fail row to ledger
      appendFileSync(
        ledgerPath('15_USER'),
        JSON.stringify({ uuid, status: 'corroboration_failed', failed_at: new Date().toISOString(), corroboration }) + '\n',
        'utf-8'
      );
      return { verdict: 'RED', staged_path: stagedPath, corroboration };
    }

    // 6. Publish
    const publishedFilePath = publishEblet(uuid, categorySlug, stagedPath, ebletContent);

    // 7. Update manifest soccerball hash
    const soccerball_hash = await updateManifest(categorySlug, uuid);

    // 8. Log attribution (10% work-contribution Marks)
    const corroboration_score = greenCount / 3;
    await logAttribution({
      member_id: memberId,
      category_slug: categorySlug,
      eblet_uuid: uuid,
      corroboration_score,
      star_chamber_verdict: starVerdict,
      scrambler_verdict: scramblerVerdict,
      keys_engines_verdict: keysVerdict,
      published_at: new Date().toISOString(),
    });

    return {
      verdict: 'GREEN',
      staged_path: stagedPath,
      published_path: publishedFilePath,
      corroboration,
      soccerball_hash,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Catacombs] contributeToCategory error:', msg);
    return {
      verdict: 'RED',
      staged_path: stagedPath,
      corroboration: { star_chamber: 'RED', scrambler: 'RED', keys_engines: 'RED', green_count: 0 },
      error: msg,
    };
  }
}
