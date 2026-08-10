// query_capture_ipc.ts -- D-BP151-037/BISHOP/seg-query-capture-archive
//
// IPC surface for the renderer's Query Capture Archive panel. LOCAL ONLY, same machine,
// same user, main<->renderer -- never reaches federation/relay_server.ts, never attached to a
// SEG-style receipt, never sent to a peer. That boundary is deliberate: per the Founder's
// BP151 addition to this ticket, the Substrate Processing switch state "must not be
// observable" by anything OTHER than the Founder's own local control surface -- "no exported
// field, no IPC readback that a page or a peer can query, no reflection of it in any receipt."
// This file's handlers are reachable only from this app's own renderer via contextBridge
// (preload.ts); nothing here is exposed over ws/HTTP/federation.

import { ipcMain } from 'electron';
import {
  captureQuery,
  listQueries,
  findQueries,
  setQueryStatus,
  deleteQuery,
  type QueryCaptureStatus,
} from './query_capture_store';
import { isQueryCaptureEnabled, setQueryCaptureEnabled } from './query_capture_settings';

export function registerQueryCaptureIPC(): void {
  ipcMain.handle('query-capture:get-enabled', () => {
    return { ok: true, enabled: isQueryCaptureEnabled() };
  });

  ipcMain.handle('query-capture:set-enabled', (_event, enabled: boolean) => {
    const result = setQueryCaptureEnabled(enabled === true);
    if (!result.ok) return { ok: false, error: result.reason };
    return { ok: true, enabled: enabled === true };
  });

  ipcMain.handle('query-capture:list', (_event, status?: QueryCaptureStatus) => {
    try {
      return { ok: true, entries: listQueries(status) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('query-capture:find', (_event, searchText: string) => {
    if (typeof searchText !== 'string') return { ok: false, error: 'searchText must be a string' };
    try {
      return { ok: true, entries: findQueries(searchText) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('query-capture:set-status', (_event, id: string, status: QueryCaptureStatus) => {
    if (typeof id !== 'string' || !id) return { ok: false, error: 'id must be a non-empty string' };
    const result = setQueryStatus(id, status);
    return result.ok ? { ok: true } : { ok: false, error: result.reason };
  });

  ipcMain.handle('query-capture:delete', (_event, id: string) => {
    if (typeof id !== 'string' || !id) return { ok: false, error: 'id must be a non-empty string' };
    const result = deleteQuery(id);
    return result.ok ? { ok: true } : { ok: false, error: result.reason };
  });

  // Exposed for completeness (e.g. a future main-process caller that wants to mint a capture
  // directly rather than via one of the two wired call sites) -- the renderer's own Ask-tab
  // flow does not call this directly; capture happens server-side at the two instrumented
  // call sites (ai_dispatch_ipc.ts's 'ai-dispatch:query' handler, index.ts's askGoogle path).
  ipcMain.handle('query-capture:capture', (_event, params: { question: string; source: 'ask_tab' | 'ask_google'; authority?: string }) => {
    if (!params || typeof params.question !== 'string' || (params.source !== 'ask_tab' && params.source !== 'ask_google')) {
      return { ok: false, error: 'invalid params' };
    }
    return captureQuery(params);
  });
}
