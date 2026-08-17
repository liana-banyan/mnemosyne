// index.relay_route_race_guard.test.ts — D-BP156-M0-016, HARDWIRE-24 mesh, Defect 2.
//
// OFFLINE, SOURCE-LEVEL. index.ts is a 10,000+ line Electron main-process "registration
// surface" (its own header rule) that imports 'electron' at module scope -- importing it
// directly into a vitest run would require mocking a large, non-exhaustively-known surface of
// Electron APIs it touches at load time, which is exactly the kind of large/fragile footprint
// this dispatch's own hard constraints warn against ("change nothing else"). Instead of that,
// this test locks in the ONE property that actually matters for the race this dispatch fixes:
// that startRelayRoutePoll's row loop checks isBishopDispatchPayload(route.payload_json) and
// `continue`s BEFORE the "mark processing" PATCH that claims a row for the Ollama MC-answer
// pipeline. The discriminator itself (isBishopDispatchPayload) is unit-tested exhaustively in
// bishop_dispatch_relay_listener.test.ts -- this file only proves it is wired into
// startRelayRoutePoll in the right place and that the pre-existing claiming code for an
// ordinary row is untouched (still present, unconditional, immediately after the guard).
//
// Run: npx vitest run src/main/index.relay_route_race_guard.test.ts

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_TS_PATH = join(__dirname, 'index.ts');

function readStartRelayRoutePollBody(): string {
  const src = readFileSync(INDEX_TS_PATH, 'utf8');
  const startIdx = src.indexOf('function startRelayRoutePoll(peerId: string)');
  expect(startIdx, 'startRelayRoutePoll not found in index.ts').toBeGreaterThan(-1);
  // Bounded slice: from the function declaration to the next top-level "function " declaration
  // (startRelayRoutePoll is followed by other module-scope functions -- this is a coarse but
  // sufficient bound for a source-order assertion, not a parser).
  const nextFnIdx = src.indexOf('\nfunction ', startIdx + 1);
  expect(nextFnIdx, 'could not find the end boundary of startRelayRoutePoll').toBeGreaterThan(startIdx);
  return src.slice(startIdx, nextFnIdx);
}

describe('startRelayRoutePoll (index.ts) — bishop_dispatch skip-guard, D-BP156-M0-016 Defect 2', () => {
  const body = readStartRelayRoutePollBody();

  test('imports isBishopDispatchPayload from the dedicated bishop-dispatch listener module ' +
    '(reused discriminator, not re-implemented)', () => {
    const src = readFileSync(INDEX_TS_PATH, 'utf8');
    expect(src).toMatch(
      /isBishopDispatchPayload[\s\S]{0,80}from '\.\/federation\/bishop_dispatch_relay_listener'/,
    );
  });

  test('the guard calls isBishopDispatchPayload(route.payload_json) inside the row loop', () => {
    expect(body).toContain('for (const route of routes)');
    expect(body).toContain('isBishopDispatchPayload(route.payload_json)');
  });

  test('the guard appears BEFORE the "mark processing" claim PATCH, so a matching row is ' +
    'skipped before this poller ever claims it', () => {
    const forLoopIdx = body.indexOf('for (const route of routes)');
    const guardIdx = body.indexOf('isBishopDispatchPayload(route.payload_json)');
    const markProcessingIdx = body.indexOf('// Mark processing');

    expect(forLoopIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(markProcessingIdx).toBeGreaterThan(-1);

    expect(guardIdx).toBeGreaterThan(forLoopIdx);
    expect(markProcessingIdx).toBeGreaterThan(guardIdx);
  });

  test('the guard is a `continue`, not a return or throw -- it skips only the matched row, ' +
    'the loop keeps processing the remaining rows in the same tick', () => {
    const guardIdx = body.indexOf('isBishopDispatchPayload(route.payload_json)');
    const nextBrace = body.indexOf('{', guardIdx);
    const guardBlock = body.slice(nextBrace, body.indexOf('}', nextBrace) + 1);
    expect(guardBlock).toContain('continue');
  });

  test('the pre-existing claim PATCH for an ordinary (non-bishop_dispatch) row is still ' +
    'present, unconditional, and unchanged in shape (status:\'processing\')', () => {
    expect(body).toContain("status: 'processing'");
    expect(body).toContain('/rest/v1/relay_routes?id=eq.${route.id}');
  });

  test('the pre-existing MC-answer machinery (eblet_topical / plow branches) is still present ' +
    'downstream of the guard, i.e. the fix did not delete or refactor any inference-path logic', () => {
    expect(body).toContain("payload.query_type === 'eblet_topical'");
  });
});
