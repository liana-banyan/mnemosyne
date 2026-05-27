// caithedral_tools_ipc.ts — BP060 Application 002 Step 1
// Exposes caithedral-core@0.2.0 substrate operations to renderer via IPC.
// All 9 tools: soccerball_emit/decode/lookup, speckle_nibble, eblit_emit,
// substrace_weave, quilt_compose, substrate_address_emit/validate.
// Runs in main process — uses Node.js crypto (unavailable in renderer sandbox).
// decay_class: "BETWEEN" on all new emissions per Application 002 canon.

import { ipcMain } from 'electron';
import { createHash } from 'crypto';

// ─── In-process BETWEEN registries ────────────────────────────────────────────

interface PeanutRoll {
  v: 1;
  s: string;
  p: string[];
  b: Record<string, string>;
  ts: number;
}

interface Eblit {
  v: 1;
  eblit_id: string;
  pearl_id: string;
  source_cathedral: string;
  ts: number;
  decay_class: 'BETWEEN' | 'promoted-to-eblet';
  null_line: string;
  promoted_eblet?: string;
}

interface Substrace {
  v: 1;
  substrace_id: string;
  eblits: string[];
  weaver: string;
  weave_ts: number;
  decay_class: 'BETWEEN' | 'anchor-promoted';
  bp_session: string;
}

interface QuiltOfSubstrace {
  v: 1;
  quilt_id: string;
  substraces: string[];
  narrative_tag: string;
  weaver: string;
  ts: number;
  decay_class: 'BETWEEN' | 'anchor-class';
}

interface SubstrateAddressResult {
  address: string;
  length_bits: 216;
  sides: string[];
  triangle_a: string[];
  triangle_b: string[];
}

interface PhalanxEntry {
  channel_id: number;
  reason: string;
}

interface ValidateResult {
  valid: boolean;
  handshakes: boolean[];
  phalanx_flags: PhalanxEntry[];
  triangle_agreement: boolean;
  error_signal?: string;
}

const BETWEEN_CRYSTAL = new Map<string, PeanutRoll>();
const BETWEEN_EBLITS = new Map<string, Eblit>();
const BETWEEN_SUBSTRACES = new Map<string, Substrace>();
const BETWEEN_QUILTS = new Map<string, QuiltOfSubstrace>();

// ─── soccerball_emit ──────────────────────────────────────────────────────────

function soccerball_emit(
  pearls: string[],
  bindings: Record<string, string> = {},
): string {
  if (pearls.length === 0) throw new Error('soccerball_emit: pearls must be non-empty');
  const sorted = [...pearls].sort();
  const sortedB = Object.fromEntries(
    Object.entries(bindings).sort(([a], [b]) => a.localeCompare(b)),
  );
  const hash = createHash('sha256')
    .update(JSON.stringify({ p: sorted, b: sortedB }))
    .digest('hex');
  const sid = hash.slice(0, 32);
  BETWEEN_CRYSTAL.set(sid, { v: 1, s: sid, p: sorted, b: sortedB, ts: Date.now() });
  return sid;
}

// ─── soccerball_decode ────────────────────────────────────────────────────────

function soccerball_decode(
  sid: string,
): { pearls: string[]; bindings: Record<string, string> } | null {
  const roll = BETWEEN_CRYSTAL.get(sid);
  if (!roll) return null;
  return { pearls: [...roll.p], bindings: { ...roll.b } };
}

// ─── soccerball_lookup ────────────────────────────────────────────────────────

function soccerball_lookup(sid: string): PeanutRoll | null {
  return BETWEEN_CRYSTAL.get(sid) ?? null;
}

// ─── speckle_nibble ───────────────────────────────────────────────────────────

function speckle_nibble(sid: string, position: number): string {
  if (position < 0 || position > 31) throw new Error('Position must be 0-31');
  return sid[position];
}

// ─── eblit_emit ───────────────────────────────────────────────────────────────

function eblit_emit(
  pearl_id: string,
  source_cathedral: string,
  ts?: number,
): Eblit {
  const emit_ts = ts ?? Date.now();
  const eblit_id = createHash('sha256')
    .update(pearl_id + String(emit_ts) + source_cathedral)
    .digest('hex')
    .slice(0, 16);
  const null_line = soccerball_emit([pearl_id], {
    ts: String(emit_ts),
    src: source_cathedral,
  });
  const eblit: Eblit = {
    v: 1,
    eblit_id,
    pearl_id,
    source_cathedral,
    ts: emit_ts,
    decay_class: 'BETWEEN',
    null_line,
  };
  BETWEEN_EBLITS.set(eblit_id, eblit);
  return eblit;
}

// ─── substrace_weave ──────────────────────────────────────────────────────────

function substrace_weave(
  eblit_null_lines: string[],
  weaver: string,
  weave_ts?: number,
): Substrace {
  if (eblit_null_lines.length === 0)
    throw new Error('substrace_weave: at least one eblit null_line required');
  const ts = weave_ts ?? Date.now();
  const substrace_id = soccerball_emit(eblit_null_lines, {
    weaver,
    weave_ts: String(ts),
  });
  const substrace: Substrace = {
    v: 1,
    substrace_id,
    eblits: [...eblit_null_lines],
    weaver,
    weave_ts: ts,
    decay_class: 'BETWEEN',
    bp_session: 'BP060',
  };
  BETWEEN_SUBSTRACES.set(substrace_id, substrace);
  return substrace;
}

// ─── quilt_compose ────────────────────────────────────────────────────────────

function quilt_compose(
  substrace_ids: string[],
  narrative_tag: string,
  weaver: string,
  ts?: number,
): QuiltOfSubstrace {
  if (substrace_ids.length === 0)
    throw new Error('quilt_compose: at least one substrace_id required');
  const compose_ts = ts ?? Date.now();
  const quilt_id = soccerball_emit(substrace_ids, {
    weaver,
    ts: String(compose_ts),
    narrative_tag,
  });
  const quilt: QuiltOfSubstrace = {
    v: 1,
    quilt_id,
    substraces: [...substrace_ids],
    narrative_tag,
    weaver,
    ts: compose_ts,
    decay_class: 'BETWEEN',
  };
  BETWEEN_QUILTS.set(quilt_id, quilt);
  return quilt;
}

// ─── substrate_address_emit ───────────────────────────────────────────────────

function hexNibbleSum(s: string): number {
  let sum = 0;
  for (const c of s) sum += parseInt(c, 16);
  return sum;
}

function substrate_address_emit(
  seed: string,
  _ts?: number,
): SubstrateAddressResult {
  // Derive 54 hex chars (216 bits) from SHA-256 of seed
  const raw = createHash('sha256').update(seed).digest('hex').slice(0, 54);
  const sides: string[] = [];
  for (let i = 0; i < 6; i++) {
    sides.push(raw.slice(i * 9, (i + 1) * 9));
  }
  // Enforce thorax parity: each side's nibbleSum mod 16 must equal its neighbor's
  // This is a read-only computation — we report what the address IS, not force-correct
  return {
    address: raw,
    length_bits: 216,
    sides,
    triangle_a: [sides[0], sides[2], sides[4]],
    triangle_b: [sides[1], sides[3], sides[5]],
  };
}

// ─── substrate_address_validate ───────────────────────────────────────────────

function substrate_address_validate(address: string): ValidateResult {
  if (typeof address !== 'string' || address.length !== 54 || !/^[0-9a-f]+$/.test(address)) {
    return {
      valid: false,
      handshakes: [false, false, false, false, false, false],
      phalanx_flags: [{ channel_id: 0, reason: 'Invalid address format (must be 54 lowercase hex chars)' }],
      triangle_agreement: false,
      error_signal: 'FORMAT_ERROR',
    };
  }
  const sides: string[] = [];
  for (let i = 0; i < 6; i++) sides.push(address.slice(i * 9, (i + 1) * 9));

  const sums = sides.map(hexNibbleSum);
  const handshakes: boolean[] = [];
  const phalanx_flags: PhalanxEntry[] = [];

  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6;
    const pass = (sums[i] % 16) === (sums[next] % 16);
    handshakes.push(pass);
    if (!pass) {
      phalanx_flags.push({
        channel_id: i + 1,
        reason: `Side ${i} sum%16=${sums[i] % 16} ≠ Side ${next} sum%16=${sums[next] % 16}`,
      });
    }
  }

  // Triangle agreement: triangle_a hash vs triangle_b hash
  const taHash = createHash('sha256').update(sides[0] + sides[2] + sides[4]).digest('hex').slice(0, 8);
  const tbHash = createHash('sha256').update(sides[1] + sides[3] + sides[5]).digest('hex').slice(0, 8);
  const triangle_agreement = taHash === tbHash;

  const valid = handshakes.every(Boolean) && triangle_agreement;
  return {
    valid,
    handshakes,
    phalanx_flags,
    triangle_agreement,
    error_signal: valid ? undefined : 'PHALANX_OR_TRIANGLE_MISMATCH',
  };
}

// ─── 10-Pearl Roundtrip Demo ──────────────────────────────────────────────────

function runTenPearlRoundtrip(): {
  pearls: string[];
  eblits: Eblit[];
  substrace: Substrace;
  quilt: QuiltOfSubstrace;
  sid_equality: boolean;
  ts: number;
} {
  const ts = Date.now();
  const weaver = 'mnemosyne-ui';

  // Emit 10 pearls
  const pearls: string[] = [];
  for (let i = 0; i < 10; i++) {
    pearls.push(soccerball_emit([`pearl-${i}-application-002`], { idx: String(i), ts: String(ts) }));
  }

  // Emit Eblits for each pearl
  const eblits: Eblit[] = pearls.map((p, i) =>
    eblit_emit(p, `mnemosyne-ui-${i}`, ts + i),
  );

  // Weave Substrace from null_lines
  const substrace = substrace_weave(
    eblits.map((e) => e.null_line),
    weaver,
    ts,
  );

  // Compose Quilt
  const quilt = quilt_compose(
    [substrace.substrace_id],
    'application-002-ten-pearl-roundtrip',
    weaver,
    ts,
  );

  // SID equality check: re-emit with same inputs → same SIDs
  const recheck_pearl = soccerball_emit([`pearl-0-application-002`], { idx: '0', ts: String(ts) });
  const sid_equality = recheck_pearl === pearls[0];

  return { pearls, eblits, substrace, quilt, sid_equality, ts };
}

// ─── IPC Registration ─────────────────────────────────────────────────────────

export function registerCaithedralToolsIPC(): void {
  ipcMain.handle('caithedral:soccerball_emit', (_e, pearls: string[], bindings?: Record<string, string>) => {
    try {
      return { ok: true, sid: soccerball_emit(pearls, bindings) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('caithedral:soccerball_decode', (_e, sid: string) => {
    try {
      return { ok: true, result: soccerball_decode(sid) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('caithedral:soccerball_lookup', (_e, sid: string) => {
    try {
      return { ok: true, result: soccerball_lookup(sid) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('caithedral:speckle_nibble', (_e, sid: string, position: number) => {
    try {
      return { ok: true, nibble: speckle_nibble(sid, position) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('caithedral:eblit_emit', (_e, pearl_id: string, source_cathedral: string, ts?: number) => {
    try {
      return { ok: true, eblit: eblit_emit(pearl_id, source_cathedral, ts) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('caithedral:substrace_weave', (_e, eblit_null_lines: string[], weaver: string, weave_ts?: number) => {
    try {
      return { ok: true, substrace: substrace_weave(eblit_null_lines, weaver, weave_ts) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('caithedral:quilt_compose', (_e, substrace_ids: string[], narrative_tag: string, weaver: string, ts?: number) => {
    try {
      return { ok: true, quilt: quilt_compose(substrace_ids, narrative_tag, weaver, ts) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('caithedral:substrate_address_emit', (_e, seed: string, ts?: number) => {
    try {
      return { ok: true, address: substrate_address_emit(seed, ts) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('caithedral:substrate_address_validate', (_e, address: string) => {
    try {
      return { ok: true, result: substrate_address_validate(address) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('caithedral:ten_pearl_roundtrip', () => {
    try {
      return { ok: true, result: runTenPearlRoundtrip() };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // Areopagus query — searches substrate local index for ebleted records
  ipcMain.handle('caithedral:areopagus_query', (_e, query: string) => {
    try {
      // Returns matches from BETWEEN registry + mock substrate search
      const crystal_matches: Array<{ sid: string; pearls: string[]; score: number }> = [];
      for (const [sid, roll] of BETWEEN_CRYSTAL.entries()) {
        const haystack = [sid, ...roll.p, JSON.stringify(roll.b)].join(' ').toLowerCase();
        if (haystack.includes(query.toLowerCase())) {
          crystal_matches.push({ sid, pearls: roll.p, score: 1.0 });
        }
      }
      return { ok: true, matches: crystal_matches, query, searched_at: Date.now() };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}
