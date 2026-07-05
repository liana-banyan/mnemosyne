// BP080 · SEG-WAN-2 · wan-relay-publish
// BP084 · SEG-2 · extends to write peer_presence + capabilities (2026-06-15)
// ============================================================
// POST /functions/v1/wan-relay-publish
// Accepts a PeanutRoll JSON body (extended with optional presence fields),
// validates SID (32-char hex), upserts into wan_relay_records keyed by
// SID + cooperative_epoch AND upserts peer_presence for NAT traversal.
// --no-verify-jwt: SID is the auth token (intentionally anonymous).
//
// Rate limits (in-process per Deno isolate):
//   - 10 publishes per IP per hour
//   - 3 publishes per SID per hour
//
// Request: PeanutRoll extended {
//   v:1, s:string, p:string[], b:Record<string,string>, ts:number,
//   // BP084 SEG-2 extensions (all optional):
//   peer_id?: string,
//   email_hash?: string,
//   lan_addresses?: string[],
//   relay_session_id?: string,
//   capabilities?: Record<string,unknown>
// }
// Response 202: { ok:true, sid:string }
// Response 400: { ok:false, error:string }
// Response 429: { ok:false, error:string }
// Response 500: { ok:false, error:string }
//
// Authored: 2026-06-11 · Bishop SEG-WAN-2 (Option A ratify)
// Extended: 2026-06-15 · Knight BP084 SEG-2
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// ── CORS ─────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wan-sid",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── PeanutRoll validation ─────────────────────────────────────
const SID_RE = /^[0-9a-f]{32}$/;

function isValidSid(sid: string): boolean {
  return sid.length === 32 && SID_RE.test(sid);
}

interface PeanutRoll {
  v: 1;
  s: string;
  p: string[];
  b: Record<string, string>;
  ts: number;
  // BP084 SEG-2 extensions — optional presence fields
  peer_id?: string;
  email_hash?: string | null;
  lan_addresses?: string[];
  relay_session_id?: string;
  capabilities?: Record<string, unknown>;
  // K-D6-6-13 D5 fields
  version?: string | null;
  machine_label?: string | null;
}

function isValidPeanutRoll(body: unknown): body is PeanutRoll {
  if (!body || typeof body !== "object") return false;
  const roll = body as Record<string, unknown>;
  return (
    roll.v === 1 &&
    typeof roll.s === "string" &&
    isValidSid(roll.s) &&
    Array.isArray(roll.p) &&
    (roll.p as unknown[]).every((x) => typeof x === "string") &&
    roll.b !== null &&
    typeof roll.b === "object" &&
    !Array.isArray(roll.b) &&
    Object.values(roll.b as Record<string, unknown>).every((x) => typeof x === "string") &&
    typeof roll.ts === "number"
  );
}

// ── Epoch helpers ─────────────────────────────────────────────
const EPOCH_ORIGIN_MS = new Date("2026-01-01T00:00:00Z").getTime();
const MS_PER_DAY = 86_400_000;

function getCooperativeEpoch(nowMs: number = Date.now()): number {
  return Math.floor((nowMs - EPOCH_ORIGIN_MS) / MS_PER_DAY);
}

function getExpiresAt(nowMs: number = Date.now()): Date {
  const epoch = getCooperativeEpoch(nowMs);
  return new Date(EPOCH_ORIGIN_MS + (epoch + 1) * MS_PER_DAY);
}

// ── In-process rate limiter ───────────────────────────────────
// NOTE: per-isolate; resets on cold-start. Sufficient for DoS protection.
interface WindowEntry {
  count: number;
  resetAt: number;
}
const ipWindows = new Map<string, WindowEntry>();
const sidWindows = new Map<string, WindowEntry>();

function checkWindow(
  map: Map<string, WindowEntry>,
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || now >= entry.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Handler ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method not allowed" }, 405);
  }

  // IP rate limit: 10 publishes per IP per hour
  const ip = getClientIp(req);
  if (!checkWindow(ipWindows, `publish:ip:${ip}`, 10, 60 * 60 * 1000)) {
    return json({ ok: false, error: "rate limited: too many publishes from this IP" }, 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid JSON body" }, 400);
  }

  if (!isValidPeanutRoll(body)) {
    return json(
      { ok: false, error: "invalid PeanutRoll: v must be 1, s must be 32-char hex" },
      400,
    );
  }

  const roll = body as PeanutRoll;

  // BP086: determine tier — anon is 'base', authenticated JWT is 'member'
  // Service role handles DB write; tier is metadata for the client UI
  const authHeader = req.headers.get('authorization');
  const presenceTier = authHeader && authHeader.startsWith('Bearer ') ? 'member' : 'base';

  // SID rate limit: 3 publishes per SID per hour
  if (!checkWindow(sidWindows, `publish:sid:${roll.s}`, 3, 60 * 60 * 1000)) {
    return json({ ok: false, error: "rate limited: too many publishes for this SID" }, 429);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("[wan-relay-publish] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return json({ ok: false, error: "server configuration error" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const nowMs = Date.now();
  const cooperativeEpoch = getCooperativeEpoch(nowMs);
  const expiresAt = getExpiresAt(nowMs);
  const ipHash = await sha256hex(ip);

  const { error } = await supabase.from("wan_relay_records").upsert(
    {
      sid: roll.s,
      peanut_roll: roll,
      cooperative_epoch: cooperativeEpoch,
      expires_at: expiresAt.toISOString(),
      published_at: new Date(nowMs).toISOString(),
      ip_hash: ipHash,
    },
    { onConflict: "sid" },
  );

  if (error) {
    console.error("[wan-relay-publish] supabase error:", error.message);
    return json({ ok: false, error: "storage error" }, 500);
  }

  // BP084 SEG-2: upsert peer_presence if presence fields are included
  // K-D6-6-13: access raw body for D5 fields not in typed PeanutRoll interface
  const rawBody = body as Record<string, unknown>;
  if (roll.peer_id) {
    const presencePayload: Record<string, unknown> = {
      peer_id: roll.peer_id,
      wan_soccerball_id: roll.s,
      last_seen_at: new Date(nowMs).toISOString(),
      tier: presenceTier,
    };
    // K-D6-6-13 Fix A: version — read from top-level field (not from capabilities JSONB)
    if ('version' in rawBody) presencePayload.version = rawBody.version ?? null;
    // K-D6-6-13 Fix B: machine_label — extract from top-level body field
    if ('machine_label' in rawBody) presencePayload.machine_label = rawBody.machine_label ?? null;
    // K-D6-6-13 Fix C: email_hash — use 'in' check so explicit null clears the column (never fall back to peer_id)
    if ('email_hash' in rawBody) presencePayload.email_hash = rawBody.email_hash ?? null;
    if (roll.lan_addresses) presencePayload.lan_addresses = roll.lan_addresses;
    if (roll.relay_session_id) presencePayload.relay_session_id = roll.relay_session_id;
    if (roll.capabilities) presencePayload.capabilities = roll.capabilities;

    const { error: presenceError } = await supabase
      .from("peer_presence")
      .upsert(presencePayload, { onConflict: "peer_id" });

    if (presenceError) {
      console.error("[wan-relay-publish] peer_presence upsert FAILED:", presenceError.message, presenceError.details ?? "");
      return json({ ok: false, error: "peer_presence storage error" }, 500);
    }
  }

  return json({ ok: true, sid: roll.s, tier: presenceTier, peer_id: roll.peer_id ?? null, last_seen_at: new Date(nowMs).toISOString() }, 202);
});
