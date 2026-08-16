// auth_manager_membership.test.ts -- D-BP155-025/BISHOP/seg-member-recognition
//
// Test harness for AuthManager's D-BP155-025 membership-lookup logic. Follows this
// tree's own established prior-art convention for same-domain main-module tests
// (cdp_guard.test.ts, mnem_eblet_store.test.ts): manual assert() + console output +
// process.exit(1) on failure, no test-framework dependency (this repo has no vitest
// config wired to a run script) -- and require.cache injection to fake `electron`,
// `./lb_auth`, and `./membership_lookup` around a FRESH require of the compiled
// auth_manager module per test, exactly like cdp_guard.test.ts's freshCdpGuardWithFakeApp().
//
// Requires the COMPILED output (`npm run build:main` first) -- same reason as the
// prior art: `import { app } from 'electron'` resolves to a plain path string outside a
// real Electron process, so the fake must be injected via require.cache, not vi.mock().
//
// Run (after `npm run build:main`):
//   node -e "require('ts-node/register'); require('./src/main/auth_manager_membership.test.ts')"
// or simply run the compiled dist copy directly:
//   node dist/main/auth_manager_membership.test.js
//
// What this proves (this ticket's PROVE IT items b, c, and the offline-safety half of
// the honesty contract -- item a is proven separately, live, against the real database):
//   1. (b) An unreachable/failed membership lookup with NO prior cache resolves to the
//      named 'unknown' status -- NEVER trial_expired, even when the local trial timer
//      has long since expired (the exact defect class this dispatch exists to prevent).
//   2. Offline-safety: an unreachable lookup with an EXISTING verified cache leaves the
//      user at 'member' -- a network blip never revokes a real membership.
//   3. (c) A live-confirmed non-member (lookupMembership succeeds, row is null) still
//      resolves through the ordinary trial-timer logic -- trial_expired + degraded:true
//      once the trial window has passed, unauthenticated before a trial is started.
//      isDegraded()/isMember() are asserted directly: these are the exact two calls
//      index.ts's substrate-write and Ollama gates read (see index.ts's
//      `authManager?.isDegraded()` in the substrate-write and substrate-query handlers).
//   4. A live-confirmed active member resolves to 'member', degraded:false,
//      membershipSource:'live', and carries member_number through untouched.

(async function main(): Promise<void> {

const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` -- ${detail}` : ''}`);
    failed++;
  }
}

const DIST_DIR = path.join(__dirname, '..', '..', 'dist', 'main');
const AUTH_MANAGER_PATH = path.join(DIST_DIR, 'auth_manager');
const LB_AUTH_PATH = path.join(DIST_DIR, 'lb_auth');
const MEMBERSHIP_LOOKUP_PATH = path.join(DIST_DIR, 'membership_lookup');

if (!fs.existsSync(AUTH_MANAGER_PATH + '.js')) {
  console.error(`FATAL: ${AUTH_MANAGER_PATH}.js does not exist. Run \`npm run build:main\` first.`);
  process.exit(2);
}

// Isolate auth.json to a scratch temp dir for the whole run -- NEVER touch the real
// %APPDATA%\AMPLIFY Computer\auth.json. DATA_DIR is computed once at auth_manager
// module-load time from process.env.APPDATA, so this must be set before the first require.
const scratchAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'auth_manager_test_'));
process.env.APPDATA = scratchAppData;

function authFilePath(): string {
  return path.join(scratchAppData, 'AMPLIFY Computer', 'auth.json');
}

function seedPersisted(data: Record<string, unknown>): void {
  const dir = path.join(scratchAppData, 'AMPLIFY Computer');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(authFilePath(), JSON.stringify(data, null, 2), 'utf8');
}

const electronResolvedPath = require.resolve('electron');
const authManagerResolvedPath = require.resolve(AUTH_MANAGER_PATH);
const lbAuthResolvedPath = require.resolve(LB_AUTH_PATH);
const membershipLookupResolvedPath = require.resolve(MEMBERSHIP_LOOKUP_PATH);

interface FreshOpts {
  getLBSession: () => any;
  getValidLBSession: () => Promise<any>;
  lookupMembership: (session: any) => Promise<any>;
}

/** Same technique as cdp_guard.test.ts's freshCdpGuardWithFakeApp(), extended to fake
 *  three modules at once (electron, lb_auth, membership_lookup) around a fresh require
 *  of the compiled auth_manager module. Always restores all four cache entries. */
function freshAuthManager(opts: FreshOpts): { mod: any; restore: () => void } {
  const saved = {
    electron: require.cache[electronResolvedPath],
    authManager: require.cache[authManagerResolvedPath],
    lbAuth: require.cache[lbAuthResolvedPath],
    membershipLookup: require.cache[membershipLookupResolvedPath],
  };

  delete require.cache[authManagerResolvedPath];

  require.cache[electronResolvedPath] = {
    id: electronResolvedPath,
    filename: electronResolvedPath,
    loaded: true,
    exports: {
      app: { whenReady: () => Promise.resolve() },
      protocol: { handle: () => {} },
      shell: { openExternal: async () => {} },
      BrowserWindow: class {},
      ipcMain: { handle: () => {}, on: () => {} },
      session: {},
    },
  } as any;

  require.cache[lbAuthResolvedPath] = {
    id: lbAuthResolvedPath,
    filename: lbAuthResolvedPath,
    loaded: true,
    exports: {
      getLBSession: opts.getLBSession,
      getValidLBSession: opts.getValidLBSession,
      revokeDevice: async () => ({ ok: true }),
      startLBAuthFlow: async () => ({ ok: true }),
      completeLBAuth: async () => ({ ok: true }),
    },
  } as any;

  require.cache[membershipLookupResolvedPath] = {
    id: membershipLookupResolvedPath,
    filename: membershipLookupResolvedPath,
    loaded: true,
    exports: { lookupMembership: opts.lookupMembership },
  } as any;

  const mod = require(AUTH_MANAGER_PATH);

  const restore = () => {
    delete require.cache[authManagerResolvedPath];
    if (saved.electron) require.cache[electronResolvedPath] = saved.electron; else delete require.cache[electronResolvedPath];
    if (saved.lbAuth) require.cache[lbAuthResolvedPath] = saved.lbAuth; else delete require.cache[lbAuthResolvedPath];
    if (saved.membershipLookup) require.cache[membershipLookupResolvedPath] = saved.membershipLookup; else delete require.cache[membershipLookupResolvedPath];
    if (saved.authManager) require.cache[authManagerResolvedPath] = saved.authManager;
  };

  return { mod, restore };
}

const FAKE_SESSION = {
  access_token: 'fake.access.token',
  refresh_token: 'fake-refresh',
  user_id: 'test-user-id',
  email: 'test@example.com',
  peer_id: 'test-peer',
  linked_at: new Date().toISOString(),
};

const LONG_AGO = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days ago -- well past the 30-day trial

console.log('\n=== auth_manager_membership harness (D-BP155-025) ===\n');

// -- 1: (b) Linked, NO cache, live lookup fails -> 'unknown', NEVER trial_expired -----------
{
  seedPersisted({ first_launch_ts: LONG_AGO, trial_started_ts: LONG_AGO });
  const { mod, restore } = freshAuthManager({
    getLBSession: () => FAKE_SESSION,
    getValidLBSession: async () => FAKE_SESSION,
    lookupMembership: async () => ({ ok: false, reason: 'network' }),
  });
  const mgr = new mod.AuthManager();
  mgr.init();
  await mgr.refreshMembership();
  const state = mgr.getState();
  restore();

  assert(state.status === 'unknown', "status is 'unknown', not 'trial_expired', despite a 90-day-old trial timer", JSON.stringify(state));
  assert(state.status !== 'trial_expired', 'never silently reports trial_expired for a failed lookup');
  assert(state.degraded === false, "'unknown' does not itself degrade the user (a network blip doesn't punish them)", String(state.degraded));
  assert(state.membershipSource === 'unreachable', "membershipSource is 'unreachable'", state.membershipSource);
}

// -- 2: Offline-safety -- EXISTING verified cache + failed live lookup -> stays 'member' ----
{
  seedPersisted({
    first_launch_ts: LONG_AGO,
    trial_started_ts: LONG_AGO,
    lb_membership: {
      membership_status: 'active',
      membership_expires_at: '2099-12-31',
      member_number: 1,
      tags: ['founder'],
      username: 'founder',
      display_name: 'Founder',
      avatar_url: null,
      checked_at: LONG_AGO, // old -- proves membershipSource downgrades to 'cached', not status
    },
  });
  const { mod, restore } = freshAuthManager({
    getLBSession: () => FAKE_SESSION,
    getValidLBSession: async () => FAKE_SESSION,
    lookupMembership: async () => ({ ok: false, reason: 'network' }),
  });
  const mgr = new mod.AuthManager();
  mgr.init();
  await mgr.refreshMembership();
  const state = mgr.getState();
  restore();

  assert(state.status === 'member', 'a previously-verified member is NOT revoked by a failed live lookup', JSON.stringify(state));
  assert(state.degraded === false, 'stays non-degraded while using the cached-verified result');
  assert(state.membershipSource === 'cached', "membershipSource is 'cached' (honest: not verified just now)", state.membershipSource);
  assert(mgr.isMember() === true, 'isMember() true -- what index.ts reads for gating');
  assert(mgr.isDegraded() === false, 'isDegraded() false -- substrate-write and Ollama stay UNBLOCKED');
}

// -- 3: (a)-equivalent -- live lookup confirms active membership -> 'member' ----------------
{
  seedPersisted({ first_launch_ts: LONG_AGO });
  const { mod, restore } = freshAuthManager({
    getLBSession: () => FAKE_SESSION,
    getValidLBSession: async () => FAKE_SESSION,
    lookupMembership: async () => ({
      ok: true,
      row: {
        membership_status: 'active',
        membership_expires_at: '2099-12-31',
        member_number: 1,
        tags: ['founder', 'founding_member'],
        username: 'founder',
        display_name: null,
        avatar_url: null,
      },
    }),
  });
  const mgr = new mod.AuthManager();
  mgr.init();
  await mgr.refreshMembership();
  const state = mgr.getState();
  restore();

  assert(state.status === 'member', 'live-confirmed active membership resolves to member', JSON.stringify(state));
  assert(state.degraded === false, 'degraded is false for a real member');
  assert(state.membershipSource === 'live', "membershipSource is 'live' (checked just now)", state.membershipSource);
  assert(state.member?.member_number === 1, 'member_number passed through untouched', String(state.member?.member_number));
  assert(mgr.isDegraded() === false, 'isDegraded() false -- substrate-write and Ollama UNBLOCKED (PROVE IT d)');
}

// -- 4: (c) Genuine non-member, live-confirmed, trial expired -> trial_expired + degraded ---
{
  seedPersisted({ first_launch_ts: LONG_AGO, trial_started_ts: LONG_AGO });
  const { mod, restore } = freshAuthManager({
    getLBSession: () => FAKE_SESSION,
    getValidLBSession: async () => FAKE_SESSION,
    lookupMembership: async () => ({ ok: true, row: null }), // confirmed: no member_profiles row
  });
  const mgr = new mod.AuthManager();
  mgr.init();
  await mgr.refreshMembership();
  const state = mgr.getState();
  restore();

  assert(state.status === 'trial_expired', 'a genuine, live-confirmed non-member past the trial window is refused', JSON.stringify(state));
  assert(state.degraded === true, 'degraded is true -- the gate still says no');
  assert(mgr.isDegraded() === true, 'isDegraded() true -- substrate-write and Ollama STAY BLOCKED for a real non-member');
  assert(mgr.isMember() === false, 'isMember() false');
}

// -- 5: (c) Genuine non-member, no trial started yet -> unauthenticated (AuthGate) ----------
{
  seedPersisted({ first_launch_ts: Date.now() });
  const { mod, restore } = freshAuthManager({
    getLBSession: () => FAKE_SESSION,
    getValidLBSession: async () => FAKE_SESSION,
    lookupMembership: async () => ({ ok: true, row: null }),
  });
  const mgr = new mod.AuthManager();
  mgr.init();
  await mgr.refreshMembership();
  const state = mgr.getState();
  restore();

  assert(state.status === 'unauthenticated', 'a confirmed non-member who never started a trial sees AuthGate, not member', JSON.stringify(state));
  assert(mgr.isMember() === false, 'isMember() false');
}

// -- 6: No LB account linked at all -- unaffected by any of this (pre-existing behavior) ----
{
  seedPersisted({ first_launch_ts: LONG_AGO, trial_started_ts: LONG_AGO });
  const { mod, restore } = freshAuthManager({
    getLBSession: () => null,
    getValidLBSession: async () => null,
    lookupMembership: async () => { throw new Error('must not be called when no session is linked'); },
  });
  const mgr = new mod.AuthManager();
  mgr.init();
  await mgr.refreshMembership();
  const state = mgr.getState();
  restore();

  assert(state.status === 'trial_expired', 'no LB account linked: ordinary trial-expiry behavior is unchanged', JSON.stringify(state));
  assert(state.membershipSource === 'unchecked', "membershipSource is 'unchecked' when nothing is linked", state.membershipSource);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
try { fs.rmSync(scratchAppData, { recursive: true, force: true }); } catch {}
if (failed > 0) process.exit(1);

})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
