/**
 * mic_ipc.ts — MIC IPC handlers v0.4.0 BP083
 *
 * Registers IPC handlers:
 *   mic:start-distributed-plow  → starts MIC orchestration
 *   mic:cancel                  → cancels running MIC plow
 *   mic:status                  → get current workload status
 *   mic:get-peers               → list known Constellation peers
 *   mic:add-peer                → add/update a peer (manual registration)
 *   mic:remove-peer             → remove a peer
 *   mic:discover-peers          → trigger discovery + heartbeat check
 *   mic:estimate-wallclock      → get estimated wall-clock for given domains + peer count
 *
 * Status events are pushed to renderer via mainWindow.webContents.send('mic:status-event', event)
 */

import { ipcMain, BrowserWindow } from 'electron';
import type { MicStartPayload, MicStatusEvent } from './mic_types';
import {
  runMicPlow,
  partitionWorkload,
  estimateWallClockMs,
} from './mic_dispatcher';
import {
  discoverPeers,
  addOrUpdatePeer,
  removePeer,
  loadSavedPeers,
} from './constellation_discovery';
import type { ConstellationPeer } from './mic_types';

let _cancelToken: { cancelled: boolean } = { cancelled: false };
let _currentWorkload: unknown = null;

// Self peer ID — stable per-machine ID (reuse from federation/peer-discovery if available)
let _selfId = 'self-m0';
export function setMicSelfId(id: string): void { _selfId = id; }

function broadcastEvent(event: MicStatusEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('mic:status-event', event);
    }
  }
}

export function registerMicIpc(): void {
  // ── mic:start-distributed-plow ──────────────────────────────────────────────
  ipcMain.handle('mic:start-distributed-plow', async (_evt, payload: MicStartPayload) => {
    _cancelToken = { cancelled: false };

    // Build question banks from domain list
    // Lazy import to avoid circular dependency
    let sampleQuestionsForDomain: (domain: string, n: number) => string[] = () => [];
    try {
      const bnk = await import('../plow/per_domain_q_banks');
      // Use loadDomainBank + slice to get n questions per domain
      sampleQuestionsForDomain = (domain: string, n: number) => {
        try {
          const bank = bnk.loadDomainBank(domain as Parameters<typeof bnk.loadDomainBank>[0]);
          return bank.slice(0, n).map((q) => q.question);
        } catch { return []; }
      };
    } catch { /* non-fatal */ }

    const questionBanks: Record<string, string[]> = {};
    for (const domain of payload.domains) {
      questionBanks[domain] = sampleQuestionsForDomain(domain, payload.questionsPerDomain);
    }

    // Self-domain runner: runs canonical pipeline locally for one domain
    async function runSelfDomain(domain: string, questions: string[]) {
      try {
        const { runCanonicalPlow } = await import('../plow/canonical_pipeline');
        const { writeVerifiedEblet } = await import('../mnem_eblet_store');

        let ebletsWritten = 0;
        let quarantined = 0;
        let andonEvents = 0;

        const result = await runCanonicalPlow(
          {
            domains: [domain],
            questionsPerDomain: questions.length,
            ollamaBaseUrl: payload.ollamaBaseUrl,
            model: payload.model,
          },
          async (eblet) => { await writeVerifiedEblet(eblet as Parameters<typeof writeVerifiedEblet>[0]); },
          (evt) => {
            if (evt.type === 'andon-trigger') andonEvents++;
            if (evt.type === 'scribe-done') ebletsWritten += evt.ebletsWrittenThisQuestion ?? 0;
            broadcastEvent({ type: 'self-progress', domain, message: evt.type });
          },
          _cancelToken,
          (d, n) => {
            // Use provided questions slice
            return questions.slice(0, n);
          },
        );

        const dr = result.domainResults[0];
        ebletsWritten = dr?.totalEbletsWritten ?? ebletsWritten;
        quarantined = dr?.quarantinedCount ?? quarantined;
        andonEvents = dr?.andonEvents ?? andonEvents;

        return {
          peerId: _selfId,
          domain,
          ebletsWritten,
          quarantined,
          andonEvents,
          status: (dr?.status?.toLowerCase() ?? 'yellow') as 'green' | 'yellow' | 'red',
        };
      } catch (err) {
        return { peerId: _selfId, domain, ebletsWritten: 0, quarantined: questions.length, andonEvents: 0, status: 'red' as const, error: String(err) };
      }
    }

    try {
      const result = await runMicPlow(
        payload,
        _selfId,
        questionBanks,
        broadcastEvent,
        _cancelToken,
        runSelfDomain,
      );
      return { ok: true, result };
    } catch (err) {
      broadcastEvent({ type: 'error', message: String(err) });
      return { ok: false, error: String(err) };
    }
  });

  // ── mic:cancel ───────────────────────────────────────────────────────────────
  ipcMain.handle('mic:cancel', async () => {
    _cancelToken.cancelled = true;
    return { ok: true };
  });

  // ── mic:status ────────────────────────────────────────────────────────────────
  ipcMain.handle('mic:status', async () => {
    return { workload: _currentWorkload };
  });

  // ── mic:get-peers ─────────────────────────────────────────────────────────────
  ipcMain.handle('mic:get-peers', async () => {
    return loadSavedPeers();
  });

  // ── mic:add-peer ──────────────────────────────────────────────────────────────
  ipcMain.handle('mic:add-peer', async (_evt, peer: ConstellationPeer) => {
    addOrUpdatePeer(peer);
    return { ok: true };
  });

  // ── mic:remove-peer ───────────────────────────────────────────────────────────
  ipcMain.handle('mic:remove-peer', async (_evt, peerId: string) => {
    removePeer(peerId);
    return { ok: true };
  });

  // ── mic:discover-peers ────────────────────────────────────────────────────────
  ipcMain.handle('mic:discover-peers', async () => {
    const peers = await discoverPeers();
    return peers;
  });

  // ── mic:estimate-wallclock ────────────────────────────────────────────────────
  ipcMain.handle('mic:estimate-wallclock', async (_evt, { domains, questionsPerDomain }: { domains: string[]; questionsPerDomain: number }) => {
    const peers = await discoverPeers();
    const questionBanks: Record<string, string[]> = {};
    for (const d of domains) questionBanks[d] = new Array(questionsPerDomain).fill('');
    const units = partitionWorkload(domains, questionBanks, peers, _selfId);
    const ms = estimateWallClockMs(units, peers, _selfId);
    return { estimatedMs: ms, onlinePeers: peers.filter((p) => p.online).length };
  });

  console.log('[MicIPC] v0.4.0 handlers registered');
}
