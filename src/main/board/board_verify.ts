// board_verify.ts -- BP148 D-BP148-028: read-only "Verify" evidence lookup for an ORPHANED
// Grand Central ticket.
//
// The board tells the user "Verify before believing it" and, until this ticket, gave them no
// way to do that -- the only answer was a terminal. The Founder asked, correctly: "HOW do I
// verify the commits? As a user?" This module is that answer, wired to a button in
// BoardPanel.tsx via the 'board-verify-orphan' IPC channel (see board_ipc.ts).
//
// Searches BOTH repos this codebase's tickets can land in -- LianaBanyanPlatform and mnemosyne
// -- by TWO independent signals, because id alone is insufficient:
//   1. the ticket id appearing in a commit subject, anywhere in either repo's full history
//      (all branches, not just HEAD's ancestry -- a real commit sitting on an unmerged branch
//      is still real evidence, not nothing).
//   2. the report's OWN claimed target/secondary file paths having any commit history at all,
//      even one that never mentions the ticket id -- BP143/BP144 tickets predate the commit-
//      trailer discipline (see board_state_reader.ts's own header note on that), so a real
//      commit for one of these tickets can easily carry a subject line that never says the id.
//
// Every git call here is a read (`log`, `show`, `status`) -- this module never writes to git,
// board_state.json, or any report. On-demand only (a button click), never on the 15s poll, so
// it can afford to do more work per call than gitCommitsById() can: full uncapped history scan
// per repo, plus one `git show --name-only` per matched commit to list its real files.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getTicketRecord, REPO } from './board_state_reader';

const execFileAsync = promisify(execFile);
const VERIFY_GIT_TIMEOUT_MS = 8000;

// The second repo tickets can land in. mnemosyne's own REPO constant is imported, not
// duplicated, from board_state_reader.ts.
const LIANA_REPO = 'C:\\Users\\Administrator\\Documents\\LianaBanyanPlatform';

export interface VerifyCommitHit {
  sha: string;
  iso: string;
  subj: string;
  files: string[];
  matchedBy: 'ticket-id' | 'file-path';
  matchedFile?: string;
}

export interface VerifyRepoResult {
  repo: string;
  repoPath: string;
  commits: VerifyCommitHit[];
  /** Real `git status --porcelain` lines for the ticket's claimed files in this repo -- the
   *  "uncommitted in the working tree" evidence, not a guess. */
  dirty: string[];
  error: string | null;
}

export interface VerifyOrphanResult {
  id: string;
  claimedTarget: string | null;
  claimedSecondary: string[];
  repos: VerifyRepoResult[];
  /** 'found': at least one real commit turned up in either repo (id match or file match).
   *  'uncommitted': no commit anywhere, but the claimed file(s) show real uncommitted changes.
   *  'not_found': no commit, no uncommitted change -- the report is genuinely unbacked.
   *  'unknown-ticket': the id doesn't resolve to any ticket in the dropzone at all. */
  verdict: 'found' | 'uncommitted' | 'not_found' | 'unknown-ticket';
  computedAt: string;
  error: string | null;
}

async function commitFiles(repoPath: string, sha: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['show', '--name-only', '--format=', sha],
      { cwd: repoPath, encoding: 'utf8', timeout: VERIFY_GIT_TIMEOUT_MS },
    );
    return stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    // A commit that resolved by hash/log but whose `show` failed still gets reported (empty
    // file list) rather than dropped -- an incomplete file list is not the same claim as "no
    // commit exists", and T5-style (see board_state_reader.ts) nothing here is fabricated to
    // paper over the gap.
    return [];
  }
}

/** Ticket-id match: full uncapped history, all branches, filtered in JS with a real word
 *  boundary (`\bID\b`) -- NOT git's own --grep, because a plain-text --grep for "KN-BP144-1"
 *  also matches inside "KN-BP144-11"; a JS regex boundary does not, and this is a correctness-
 *  sensitive one-off lookup where getting that wrong would show the wrong ticket's commits as
 *  this ticket's evidence. */
async function searchByTicketId(repoPath: string, id: string): Promise<VerifyCommitHit[]> {
  const { stdout } = await execFileAsync(
    'git',
    ['log', '--all', '--format=%H%x1f%cI%x1f%s'],
    { cwd: repoPath, encoding: 'utf8', timeout: VERIFY_GIT_TIMEOUT_MS },
  );
  const idPattern = new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  const matched: Array<{ sha: string; iso: string; subj: string }> = [];
  for (const line of stdout.split('\n').filter(Boolean)) {
    const [sha, iso, ...rest] = line.split('\x1f');
    const subj = rest.join(' ');
    if (idPattern.test(subj)) matched.push({ sha, iso, subj });
  }
  const hits = await Promise.all(
    matched.map(async (m) => ({ ...m, files: await commitFiles(repoPath, m.sha), matchedBy: 'ticket-id' as const })),
  );
  return hits;
}

/** File-path match: real path history for one claimed file, all branches. Bounded to the 10
 *  most recent touches -- evidence, not a full audit; a heavily-touched shared file (e.g. this
 *  very module's sibling board_state_reader.ts) doesn't need every historical touch listed to
 *  prove "yes, this file has commits." */
async function searchByFile(repoPath: string, file: string): Promise<VerifyCommitHit[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['log', '--all', '--format=%H%x1f%cI%x1f%s', '-10', '--', file],
      { cwd: repoPath, encoding: 'utf8', timeout: VERIFY_GIT_TIMEOUT_MS },
    );
    const lines = stdout.split('\n').filter(Boolean);
    const hits = await Promise.all(
      lines.map(async (line) => {
        const [sha, iso, ...rest] = line.split('\x1f');
        const subj = rest.join(' ');
        return { sha, iso, subj, files: await commitFiles(repoPath, sha), matchedBy: 'file-path' as const, matchedFile: file };
      }),
    );
    return hits;
  } catch {
    return [];
  }
}

async function dirtyForFile(repoPath: string, file: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['status', '--porcelain', '--', file],
      { cwd: repoPath, encoding: 'utf8', timeout: VERIFY_GIT_TIMEOUT_MS },
    );
    return stdout.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

async function verifyInRepo(repoLabel: string, repoPath: string, id: string, files: string[]): Promise<VerifyRepoResult> {
  try {
    const [idHits, fileHitsArrays, dirtyArrays] = await Promise.all([
      searchByTicketId(repoPath, id),
      Promise.all(files.map((f) => searchByFile(repoPath, f))),
      Promise.all(files.map((f) => dirtyForFile(repoPath, f))),
    ]);
    const seen = new Set<string>();
    const commits: VerifyCommitHit[] = [];
    for (const h of [...idHits, ...fileHitsArrays.flat()]) {
      if (seen.has(h.sha)) continue;
      seen.add(h.sha);
      commits.push(h);
    }
    commits.sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0));
    return { repo: repoLabel, repoPath, commits, dirty: dirtyArrays.flat(), error: null };
  } catch (e) {
    return { repo: repoLabel, repoPath, commits: [], dirty: [], error: `git failed: ${String((e as Error)?.message ?? e)}` };
  }
}

/** The one entry point BoardPanel.tsx's Verify button calls (via 'board-verify-orphan' IPC).
 *  Never modifies board state, git, or any report -- every call this module makes is `log`,
 *  `show`, or `status`. */
export async function verifyOrphanTicket(id: string): Promise<VerifyOrphanResult> {
  const ticket = getTicketRecord(id);
  const files = [ticket?.target ?? null, ...(ticket?.secondary ?? [])].filter((f): f is string => Boolean(f));

  if (!ticket) {
    return {
      id,
      claimedTarget: null,
      claimedSecondary: [],
      repos: [],
      verdict: 'unknown-ticket',
      computedAt: new Date().toISOString(),
      error: `no ticket found in the dropzone with id ${id}`,
    };
  }

  const [mnemo, liana] = await Promise.all([
    verifyInRepo('mnemosyne', REPO, id, files),
    verifyInRepo('LianaBanyanPlatform', LIANA_REPO, id, files),
  ]);
  const repos = [mnemo, liana];

  const anyCommit = repos.some((r) => r.commits.length > 0);
  const anyDirty = repos.some((r) => r.dirty.length > 0);
  const gitError = repos.map((r) => r.error).filter(Boolean).join('; ') || null;

  const verdict: VerifyOrphanResult['verdict'] = anyCommit ? 'found' : anyDirty ? 'uncommitted' : 'not_found';

  return {
    id,
    claimedTarget: ticket.target,
    claimedSecondary: ticket.secondary,
    repos,
    verdict,
    computedAt: new Date().toISOString(),
    error: gitError,
  };
}
