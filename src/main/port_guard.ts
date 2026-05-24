// AMPLIFY Computer — Frame-Boilerplate Port Guard (BP038)
//
// Implements the port-collision auto-detect-and-reuse pattern Founder ratified BP038.
// Mirrors Vite's :5173→:5174 auto-shift UX, but for AMPLIFY's substrate-api :11480.
//
// Behavior:
//   1. Before substrate-api binds :11480, probe the port (TCP-level).
//   2. If free → proceed normally (return { occupied: false }).
//   3. If occupied → follow up with HTTP GET /health to identify the holder.
//        - If it's another AMPLIFY instance (matches signature {"ok":true,"port":...})
//          → log clean reuse message + signal caller to exit gracefully.
//        - If it's an unknown service → log warning + signal caller; caller may abort
//          to avoid EADDRINUSE crash.
//
// Future enhancement (BP039+): auto-shift to API_PORT+2 (skip API_PORT+1 which is
// Federation) instead of clean exit. For now the conservative behavior is reuse:
// keep the existing AMPLIFY as singleton; new instance exits with informative log.
//
// Canon refs:
//   project_lb_frame_boilerplate_amplify_port_collision_auto.md
//   bishop_coffee_blood_rules_section_mandate_canon_bp038.eblet.md

import { createConnection } from 'node:net';
import { request as httpRequest } from 'node:http';

export interface PortProbeResult {
  occupied: boolean;
  holder: 'another_amplify' | 'unknown_service' | 'none';
  health_summary?: string;
}

/**
 * TCP-level probe: returns true if the port accepts a connection (occupied),
 * false if ECONNREFUSED or timeout (free).
 */
function tcpProbe(port: number, host: string, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const sock = createConnection({ host, port });
    let settled = false;
    const settle = (occupied: boolean) => {
      if (settled) return;
      settled = true;
      try { sock.destroy(); } catch { /* noop */ }
      resolve(occupied);
    };
    sock.once('connect', () => settle(true));
    sock.once('error', () => settle(false));
    sock.setTimeout(timeoutMs, () => settle(false));
  });
}

/**
 * HTTP /health probe: returns whether the responder looks like an AMPLIFY substrate-api.
 */
function httpHealthProbe(port: number, host: string, timeoutMs: number): Promise<{ isAmplify: boolean; bodySummary: string }> {
  return new Promise((resolve) => {
    const req = httpRequest(
      { host, port, path: '/health', method: 'GET', timeout: timeoutMs },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk.toString();
          if (body.length > 8192) {
            try { req.destroy(); } catch { /* noop */ }
          }
        });
        res.on('end', () => {
          const isAmplify =
            res.statusCode === 200 &&
            /"ok"\s*:\s*true/.test(body) &&
            /"port"\s*:\s*\d+/.test(body);
          resolve({ isAmplify, bodySummary: body.slice(0, 200) });
        });
      }
    );
    req.on('timeout', () => { try { req.destroy(); } catch { /* noop */ } resolve({ isAmplify: false, bodySummary: '<timeout>' }); });
    req.on('error', (err) => { resolve({ isAmplify: false, bodySummary: `<error: ${err.message}>` }); });
    req.end();
  });
}

/**
 * Pre-bind probe to be called before SubstrateAPIServer.start().
 * Logs cleanly. Returns whether the port is free for our bind attempt.
 */
export async function probeSubstrateApiPort(
  port: number,
  host: string = '127.0.0.1'
): Promise<PortProbeResult> {
  const occupied = await tcpProbe(port, host, 800);
  if (!occupied) {
    console.log(`[LB Frame port-guard] :${port} free — proceeding with bind.`);
    return { occupied: false, holder: 'none' };
  }

  // Port is occupied — identify the holder.
  const { isAmplify, bodySummary } = await httpHealthProbe(port, host, 1200);
  if (isAmplify) {
    console.warn(
      `[LB Frame port-guard] :${port} occupied by another AMPLIFY instance (singleton reuse). ` +
      `Existing /health: ${bodySummary}`
    );
    return { occupied: true, holder: 'another_amplify', health_summary: bodySummary };
  }

  console.error(
    `[LB Frame port-guard] :${port} occupied by an UNKNOWN service (not AMPLIFY). ` +
    `Response sample: ${bodySummary}. ` +
    `Substrate-api bind will fail with EADDRINUSE if attempted.`
  );
  return { occupied: true, holder: 'unknown_service', health_summary: bodySummary };
}
