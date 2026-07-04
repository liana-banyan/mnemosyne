// Renderer-side Supabase client -- BP087 Wave 3 SEG-F2/G2 (P0 white-screen fix BP087)
// LAZY INIT: createClient called on first use, NOT at module-load time.
// Prevents renderer white-screen on Node.js 20 (no native WebSocket) when
// VITE_SUPABASE_URL is empty at build time.
// Auth tokens persist via localStorage (same as platform SPA pattern).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  const url = import.meta.env.VITE_SUPABASE_URL ?? '';
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
  if (!url || !key) {
    console.warn('[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY not set -- Supabase features disabled');
    return null;
  }
  try {
    _client = createClient(url, key, {
      auth: {
        storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  } catch (err) {
    console.error('[supabase] createClient failed:', (err as Error).message);
    return null;
  }
  return _client;
}

// Backward-compat named export: callers that do `import { supabase }` get
// a Proxy that lazily calls getSupabase() on first property access.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      console.warn(`[supabase] client unavailable -- prop "${String(prop)}" accessed before init`);
      return undefined;
    }
    return (client as any)[prop];
  },
});
