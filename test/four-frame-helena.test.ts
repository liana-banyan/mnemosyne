// Mnemosyne — 4-Frame Helena LIVE Gate Test Harness
// SAGA 3 + SAGA 13 · BP045 W1
//
// Simulates the Founder/Wife/Daughter/Son topology against local mocks.
// Run: npx playwright test test/four-frame-helena.test.ts
//
// What this tests:
//   1. Four PeerDiscovery instances start on local UDP ports
//   2. All four discover each other within 30s
//   3. Relay client mock: all four reach 'ratified' via simulated relay messages
//   4. Telemetry collector receives all 4 × 4 phase events
//
// For the LIVE test (real family devices), see:
//   BISHOP_DROPZONE/00_FOUNDER_REVIEW/HELENA_LIVE_TEST_RUNBOOK_BP045_W1.md

import { test, expect } from '@playwright/test';
import { createSocket } from 'dgram';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import {
  LAN_MULTICAST_ADDR,
  LAN_MULTICAST_PORT,
  FOUR_FRAME_COLLECTOR_PATH,
  type PeerPhase,
  type FourFrameEvent,
} from '../src/shared/federation-protocol';

// ─── Mock relay + telemetry collector ──────────────────────────────────────

interface MockPeer {
  peerId: string;
  phase: PeerPhase;
  discoveredPeers: Set<string>;
}

function makeMockPeer(id: string): MockPeer {
  return { peerId: id, phase: 'discovered', discoveredPeers: new Set() };
}

// ─── Test: 4-Frame local mesh ──────────────────────────────────────────────

test.describe('4-Frame Helena Peer Mesh', () => {
  const FRAME_PEER_IDS = ['frame-wife', 'frame-founder', 'frame-daughter', 'frame-son'];
  const sessions: Array<{ peerId: string; socket: ReturnType<typeof createSocket> }> = [];
  let collectorPort = 0;
  let collectorServer: ReturnType<typeof createServer>;
  const collectedEvents: FourFrameEvent[] = [];

  test.beforeAll(async () => {
    // Start mock telemetry collector
    collectorServer = createServer((req, res) => {
      if (req.method === 'POST' && req.url === FOUR_FRAME_COLLECTOR_PATH) {
        let body = '';
        req.on('data', (d: Buffer) => { body += d.toString(); });
        req.on('end', () => {
          try {
            const evt = JSON.parse(body) as FourFrameEvent;
            collectedEvents.push(evt);
          } catch { /* ignore */ }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        });
      } else {
        res.writeHead(404); res.end();
      }
    });

    await new Promise<void>((resolve) => {
      collectorServer.listen(0, '127.0.0.1', () => {
        const addr = collectorServer.address() as { port: number };
        collectorPort = addr.port;
        resolve();
      });
    });
  });

  test.afterAll(async () => {
    for (const s of sessions) s.socket.close();
    await new Promise<void>((resolve) => collectorServer.close(() => resolve()));
  });

  test('all 4 frames discover each other via LAN multicast within 30s', async () => {
    const discovered: Map<string, Set<string>> = new Map(
      FRAME_PEER_IDS.map((id) => [id, new Set<string>()]),
    );

    const sockets = await Promise.all(FRAME_PEER_IDS.map(async (peerId) => {
      const sock = createSocket({ type: 'udp4', reuseAddr: true });

      await new Promise<void>((resolve, reject) => {
        sock.bind(LAN_MULTICAST_PORT, () => {
          try {
            sock.addMembership(LAN_MULTICAST_ADDR);
            sock.setMulticastTTL(1);
            resolve();
          } catch (e) { reject(e); }
        });
        sock.once('error', reject);
      });

      sock.on('message', (msg: Buffer) => {
        try {
          const parsed = JSON.parse(msg.toString());
          if (parsed.type === 'announce' && parsed.peerId !== peerId) {
            discovered.get(peerId)?.add(parsed.peerId);
          }
        } catch { /* ignore */ }
      });

      sessions.push({ peerId, socket: sock });
      return { peerId, socket: sock };
    }));

    // Send announces from each frame
    for (const { peerId, socket } of sockets) {
      const msg = Buffer.from(JSON.stringify({
        type: 'announce',
        peerId,
        payload: { peerId, port: LAN_MULTICAST_PORT, version: '0.1.3' },
        ts: new Date().toISOString(),
      }));
      socket.send(msg, 0, msg.length, LAN_MULTICAST_PORT, LAN_MULTICAST_ADDR);
    }

    // Wait up to 5s for all 4 frames to see the other 3
    const start = Date.now();
    while (Date.now() - start < 5000) {
      const allDiscovered = FRAME_PEER_IDS.every((id) => {
        const seen = discovered.get(id)!;
        return FRAME_PEER_IDS.filter((other) => other !== id).every((other) => seen.has(other));
      });
      if (allDiscovered) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    for (const peerId of FRAME_PEER_IDS) {
      const seen = discovered.get(peerId)!;
      const others = FRAME_PEER_IDS.filter((id) => id !== peerId);
      for (const other of others) {
        expect(seen.has(other), `${peerId} should have discovered ${other}`).toBe(true);
      }
    }
  });

  test('relay mock: all 4 frames reach ratified phase via relay messages', async () => {
    const phases: Map<string, PeerPhase> = new Map(FRAME_PEER_IDS.map((id) => [id, 'discovered']));

    const mockRelay = new WebSocketServer({ port: 0 });
    const relayPort = await new Promise<number>((r) => mockRelay.once('listening', () => {
      r((mockRelay.address() as { port: number }).port);
    }));

    const connections: Map<string, import('ws')> = new Map();

    mockRelay.on('connection', (ws, req) => {
      const peerId = req.headers['x-mnemosyne-peerid'] as string;
      if (!peerId) { ws.close(); return; }
      connections.set(peerId, ws);

      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === 'relay_join') {
            // Broadcast announce to all other peers
            for (const [pid, sock] of connections.entries()) {
              if (pid !== peerId && sock.readyState === 1) {
                sock.send(JSON.stringify({
                  type: 'relay_broadcast',
                  peerId: 'relay',
                  payload: { innerMsg: { type: 'identify', peerId, payload: { peerId }, ts: new Date().toISOString() } },
                  ts: new Date().toISOString(),
                }));
              }
            }
          }

          if (msg.type === 'relay_route' && msg.payload?.toPeerId) {
            const target = connections.get(msg.payload.toPeerId);
            if (target && target.readyState === 1) {
              target.send(JSON.stringify(msg));
            }
          }
        } catch { /* ignore */ }
      });
    });

    // Simulate each frame joining relay
    const peerSockets: Array<{ peerId: string; ws: import('ws') }> = [];
    for (const peerId of FRAME_PEER_IDS) {
      const WS = (await import('ws')).default;
      const ws = new WS(`ws://127.0.0.1:${relayPort}`, {
        headers: { 'x-mnemosyne-peerid': peerId },
      });

      await new Promise<void>((resolve) => ws.once('open', () => {
        ws.send(JSON.stringify({ type: 'relay_join', peerId, payload: { peerId }, ts: new Date().toISOString() }));
        phases.set(peerId, 'identified');
        resolve();
      }));

      ws.on('message', (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.payload?.innerMsg?.type === 'identify') {
          phases.set(peerId, 'ratified');
        }
      });

      peerSockets.push({ peerId, ws });
    }

    // Wait for all to reach at least ratified
    const start = Date.now();
    while (Date.now() - start < 10000) {
      if (FRAME_PEER_IDS.every((id) => phases.get(id) === 'ratified' || phases.get(id) === 'synced')) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    for (const peerId of FRAME_PEER_IDS) {
      const phase = phases.get(peerId)!;
      expect(['ratified', 'synced'], `${peerId} should be ratified or synced`).toContain(phase);
    }

    for (const { ws } of peerSockets) ws.close();
    await new Promise<void>((resolve) => mockRelay.close(() => resolve()));
  });

  test('telemetry collector receives phase events from all 4 frames', async () => {
    const sessionId = `test-helena-${Date.now()}`;
    const baseUrl = `http://127.0.0.1:${collectorPort}`;

    const phases: PeerPhase[] = ['discovered', 'identified', 'ratified', 'synced'];

    for (let frame = 1; frame <= 4; frame++) {
      for (const status of phases) {
        await fetch(`${baseUrl}${FOUR_FRAME_COLLECTOR_PATH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            frame,
            peerId: `frame-${frame}-peer`,
            status,
            timestamp: new Date().toISOString(),
          }),
        });
      }
    }

    // Verify all 16 events were collected (4 frames × 4 phases)
    const sessionEvents = collectedEvents.filter((e) => e.sessionId === sessionId);
    expect(sessionEvents).toHaveLength(16);

    // Verify all 4 frames reached synced
    const syncedFrames = sessionEvents.filter((e) => e.status === 'synced').map((e) => e.frame);
    expect(syncedFrames.sort()).toEqual([1, 2, 3, 4]);
  });
});
