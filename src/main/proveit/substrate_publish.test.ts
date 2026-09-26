// substrate_publish.test.ts -- D-BP223-BM04-X033S3-009 STEP 3; live path tests added by X039, D-BP223-PQ004-006
//
// Outbox path (flag off), the 10-minute unpublish window, and the LIVE path through
// public.publish_question with injected dependencies: no network, no electron, no real session.
// The live RPC itself was tested end to end against the real project with a disposable user
// (BISHOP_DROPZONE\D-BP223-PQ004-006-THREE-PROOFS-E2E\X039\e2e_publish.cjs, 2026-09-25T22:43Z).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { _setProveItRootForTests } from './userdata_paths';
import { buildAndWriteCard } from './card_writer';
import { addCardToSubstrate, unpublishOwnCard, listMyPersonasLive, takeBackCard, _setLivePublishDepsForTests, type LivePublishDeps } from './substrate_publish';
import { readOutbox } from './outbox';
import { loadProveItSettings, saveProveItSettings } from './settings';
import { findCardByAddress, updateCard } from './card_store';

let dir: string;
let calls: Array<{ fn: string; body: any; auth: string }>;

/** A fake Supabase: records every RPC call and answers from the given table. */
function fakeDeps(opts: { session?: boolean; personas?: Array<{ id: string; display_name?: string; slug?: string }>; publish?: (body: any) => { status: number; data: any }; unpublish?: (body: any) => { status: number; data: any } }): LivePublishDeps {
  return {
    getSession: async () => (opts.session === false ? null : { access_token: 'test-token-not-real' }),
    supabaseUrl: () => 'https://example.invalid',
    anonKey: () => 'anon-not-real',
    fetchFn: (async (url: string, init: any) => {
      const fn = String(url).split('/rpc/')[1];
      const body = JSON.parse(init.body);
      calls.push({ fn, body, auth: init.headers.Authorization });
      let res: { status: number; data: any };
      if (fn === 'list_my_personas') res = { status: 200, data: opts.personas ?? [{ id: 'persona-1' }] };
      else if (fn === 'publish_question') res = opts.publish ? opts.publish(body) : { status: 200, data: [{ id: 'sq-1', address: body.p_address, persona_slug: 'night-owl', published_at: '2026-09-25T23:00:00.000+00:00' }] };
      else if (fn === 'unpublish_own_substrate_question') res = opts.unpublish ? opts.unpublish(body) : { status: 200, data: true };
      else res = { status: 404, data: { message: 'unknown rpc' } };
      return { status: res.status, text: async () => JSON.stringify(res.data) } as any;
    }) as any,
  };
}

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'proveit-publish-'));
  _setProveItRootForTests(dir);
  calls = [];
});

afterEach(() => {
  _setLivePublishDepsForTests(null);
  _setProveItRootForTests(null);
  rmSync(dir, { recursive: true, force: true });
});

const ASKER = { kind: 'member' as const, display: 'J.Jones', stamped: true, id: 'user-1' };
const newCard = () =>
  buildAndWriteCard({ question: 'How many moons does Mars have?', category: 'physics', method: 'user_claude', answer: 'Two: Phobos and Deimos.', askedBy: ASKER,
    sources: [{ label: 'https://science.nasa.gov/mars/moons/', url: 'https://science.nasa.gov/mars/moons/' }, { label: 'bad', url: 'javascript:alert(1)' }] }).card!;

describe('proveit.substrateLive defaults true (Founder 2026-09-20T20:31Z "make substrate live the default")', () => {
  it('is true on a fresh install', () => {
    expect(loadProveItSettings().substrateLive).toBe(true);
  });
});

describe('addCardToSubstrate, flag off', () => {
  it('writes to the local outbox instead of any Supabase call, and marks the card queued', async () => {
    saveProveItSettings({ substrateLive: false });
    _setLivePublishDepsForTests(fakeDeps({}));
    const card = newCard();
    const result = await addCardToSubstrate(card.address, { memberDisplay: 'J.Jones' });

    expect(result.ok).toBe(true);
    expect(result.queued).toBe(true);
    expect(result.card?.queuedForSubstrate).toBe(true);
    expect(result.card?.publishedAt).not.toBeNull();
    expect(calls).toHaveLength(0);

    const outbox = readOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].kind).toBe('add_to_substrate');
    expect(outbox[0].address).toBe(card.address);
    expect(findCardByAddress(card.address)?.queuedForSubstrate).toBe(true);
  });

  it('refuses to add a nonexistent address', async () => {
    const result = await addCardToSubstrate('deadbeefdeadbeefdeadbeefdeadbeef', {});
    expect(result.ok).toBe(false);
    expect(result.queued).toBe(false);
  });
});

describe('addCardToSubstrate, live (flag on) through publish_question', () => {
  it('publishes with the member session, the only persona, and the card exactly as addressed', async () => {
    _setLivePublishDepsForTests(fakeDeps({}));
    const card = newCard();
    const result = await addCardToSubstrate(card.address, { memberDisplay: 'J.Jones' });

    expect(result.ok).toBe(true);
    expect(result.queued).toBe(false);
    expect(result.substrateId).toBe('sq-1');
    expect(findCardByAddress(card.address)?.queuedForSubstrate).toBe(false);
    expect(findCardByAddress(card.address)?.substrateId).toBe('sq-1');
    expect(readOutbox()).toHaveLength(0);

    expect(calls.map((c) => c.fn)).toEqual(['list_my_personas', 'publish_question']);
    const pub = calls[1];
    expect(pub.auth).toBe('Bearer test-token-not-real');
    expect(pub.body).toMatchObject({
      p_persona_id: 'persona-1', p_category: 'physics', p_question: card.question, p_answer: card.answer,
      p_answered_by: card.answeredBy, p_made_at: card.madeAt, p_address: card.address,
    });
    expect(pub.body.p_sources).toEqual([{ label: 'https://science.nasa.gov/mars/moons/', url: 'https://science.nasa.gov/mars/moons/' }]);
  });

  it('uses the persona the request names and skips the lookup', async () => {
    _setLivePublishDepsForTests(fakeDeps({ personas: [{ id: 'a' }, { id: 'b' }] }));
    const card = newCard();
    const result = await addCardToSubstrate(card.address, {}, { personaId: 'b' });
    expect(result.queued).toBe(false);
    expect(calls.map((c) => c.fn)).toEqual(['publish_question']);
    expect(calls[0].body.p_persona_id).toBe('b');
  });

  it('not signed in: queues to the outbox with the reason, never claims a publish', async () => {
    _setLivePublishDepsForTests(fakeDeps({ session: false }));
    const card = newCard();
    const result = await addCardToSubstrate(card.address, {});
    expect(result.ok).toBe(true);
    expect(result.queued).toBe(true);
    expect(result.error).toMatch(/NOT_SIGNED_IN/);
    expect(calls).toHaveLength(0);
    expect(readOutbox()[0].payload).toMatchObject({ liveAttemptError: expect.stringMatching(/NOT_SIGNED_IN/) });
  });

  it('no persona, or several: refuses with the reason and queues', async () => {
    _setLivePublishDepsForTests(fakeDeps({ personas: [] }));
    const r0 = await addCardToSubstrate(newCard().address, {});
    expect(r0.queued).toBe(true);
    expect(r0.error).toMatch(/NO_PERSONA/);

    _setLivePublishDepsForTests(fakeDeps({ personas: [{ id: 'a' }, { id: 'b' }] }));
    const card2 = buildAndWriteCard({ question: 'Second question here', category: 'other', method: 'user_claude', answer: 'b', askedBy: ASKER }).card!;
    const r2 = await addCardToSubstrate(card2.address, {});
    expect(r2.queued).toBe(true);
    expect(r2.error).toMatch(/CHOOSE_PERSONA/);
  });

  it('a refusal from the substrate is reported and the card stays queued', async () => {
    _setLivePublishDepsForTests(fakeDeps({ publish: () => ({ status: 400, data: { message: 'this card is already published' } }) }));
    const card = newCard();
    const result = await addCardToSubstrate(card.address, {});
    expect(result.queued).toBe(true);
    expect(result.error).toMatch(/REFUSED_BY_SUBSTRATE: this card is already published/);
    expect(findCardByAddress(card.address)?.queuedForSubstrate).toBe(true);
  });

  it('a card edited after it was addressed is refused locally, before any network call', async () => {
    _setLivePublishDepsForTests(fakeDeps({}));
    const card = newCard();
    updateCard(card.address, { answer: 'Three.' } as any);
    const result = await addCardToSubstrate(card.address, {});
    expect(result.queued).toBe(true);
    expect(result.error).toMatch(/no longer matches its content/);
    expect(calls).toHaveLength(0);
  });

  it('a network failure never loses the card', async () => {
    const deps = fakeDeps({});
    deps.fetchFn = (async () => { throw new Error('offline'); }) as any;
    _setLivePublishDepsForTests(deps);
    const card = newCard();
    const result = await addCardToSubstrate(card.address, {});
    expect(result.queued).toBe(true);
    expect(result.error).toMatch(/NETWORK/);
    expect(readOutbox()).toHaveLength(1);
  });
});

describe('listMyPersonasLive (the renderer persona picker)', () => {
  it('signed out: ok, signedIn false, no personas, no network call', async () => {
    _setLivePublishDepsForTests(fakeDeps({ session: false }));
    const res = await listMyPersonasLive();
    expect(res).toEqual({ ok: true, signedIn: false, personas: [] });
    expect(calls).toHaveLength(0);
  });

  it('signed in: maps the rows to id, displayName, slug and nothing else', async () => {
    _setLivePublishDepsForTests(fakeDeps({ personas: [{ id: 'a', display_name: 'Night Owl', slug: 'night-owl' }, { id: 'b', display_name: 'Day Lark', slug: 'day-lark' }] }));
    const res = await listMyPersonasLive();
    expect(res.signedIn).toBe(true);
    expect(res.personas).toEqual([{ id: 'a', displayName: 'Night Owl', slug: 'night-owl' }, { id: 'b', displayName: 'Day Lark', slug: 'day-lark' }]);
    expect(calls[0].auth).toBe('Bearer test-token-not-real');
  });
});

describe('takeBackCard ("Take it back" from the app)', () => {
  it('a live card is taken back on the substrate by its id, then marked locally', async () => {
    _setLivePublishDepsForTests(fakeDeps({}));
    const card = newCard();
    await addCardToSubstrate(card.address, {});
    calls = [];
    const res = await takeBackCard(card.address);
    expect(res.ok).toBe(true);
    expect(calls.map((c) => c.fn)).toEqual(['unpublish_own_substrate_question']);
    expect(calls[0].body).toEqual({ p_question_id: 'sq-1' });
    expect(findCardByAddress(card.address)?.unpublishedAt).not.toBeNull();
  });

  it('when the substrate refuses (window closed), the local card is left as it was', async () => {
    _setLivePublishDepsForTests(fakeDeps({ unpublish: () => ({ status: 400, data: { message: 'the 10-minute self-unpublish window has closed; this card can only be superseded now' } }) }));
    const card = newCard();
    await addCardToSubstrate(card.address, {});
    const res = await takeBackCard(card.address);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/10-minute/);
    expect(findCardByAddress(card.address)?.unpublishedAt).toBeNull();
  });

  it('the substrate answering false is not reported as taken back', async () => {
    _setLivePublishDepsForTests(fakeDeps({ unpublish: () => ({ status: 200, data: false }) }));
    const card = newCard();
    await addCardToSubstrate(card.address, {});
    const res = await takeBackCard(card.address);
    expect(res.ok).toBe(false);
    expect(findCardByAddress(card.address)?.unpublishedAt).toBeNull();
  });

  it('a card that was only queued is taken back locally, with no network call', async () => {
    _setLivePublishDepsForTests(fakeDeps({ session: false }));
    const card = newCard();
    await addCardToSubstrate(card.address, {});
    calls = [];
    const res = await takeBackCard(card.address);
    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(0);
    expect(findCardByAddress(card.address)?.unpublishedAt).not.toBeNull();
  });

  it('refuses a card that was never published, or was already taken back', async () => {
    _setLivePublishDepsForTests(fakeDeps({}));
    const card = newCard();
    expect((await takeBackCard(card.address)).error).toBe('not published');
    await addCardToSubstrate(card.address, {});
    await takeBackCard(card.address);
    expect((await takeBackCard(card.address)).error).toBe('already taken back');
  });
});

describe('unpublishOwnCard (spec Section 5, 10-minute window)', () => {
  it('succeeds within the window', async () => {
    _setLivePublishDepsForTests(fakeDeps({}));
    const card = newCard();
    await addCardToSubstrate(card.address, {});
    const result = unpublishOwnCard(card.address);
    expect(result.ok).toBe(true);
    expect(findCardByAddress(card.address)?.unpublishedAt).not.toBeNull();
  });

  it('refuses after the window has closed', async () => {
    _setLivePublishDepsForTests(fakeDeps({}));
    const card = newCard();
    const published = (await addCardToSubstrate(card.address, {})).card!;
    const elevenMinAgo = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    updateCard(published.address, { publishedAt: elevenMinAgo });
    const result = unpublishOwnCard(published.address);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/10-minute/);
  });
});
