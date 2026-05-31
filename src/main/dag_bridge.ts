// dag_bridge.ts — Folder→DAG bridge · BP067 Correction 2
//
// Emits folder-index EbletMintRecords into the soccerball-DAG substrate so that
// user-picked local folders become peer-resolvable banks (MESH-6 SID-fetch).
//
// Design:
//   - Best-effort: errors are logged and swallowed — watcher never crashes.
//   - Tombstones (source_deleted=true) are skipped; only file content is emitted.
//   - Each entry is represented as a DAG node with pearls = [sha256, path, tag]
//     and bindings carrying metadata (type, path, hash, event, minted_at, summary).
//   - After emission, _meshPointerAdvanceHook (injected by index.ts) broadcasts
//     the new dag_id to all connected peers, making the node fetchable via
//     /dag/fetch_from_peer (MESH-6 Option-B).

import { dag_soccerball_emit_reexport } from './caithedral_tools_ipc';
import type { EbletMintRecord } from './services/SubstratedFolderWatcher';

// ─── State ───────────────────────────────────────────────────────────────────

let _emitCount = 0;
let _meshPointerAdvanceHook: ((dagId: string) => void) | null = null;

// ─── Public API ──────────────────────────────────────────────────────────────

/** Inject the mesh pointer-advance hook from index.ts (avoids circular import). */
export function setDagBridgeMeshHook(fn: (dagId: string) => void): void {
  _meshPointerAdvanceHook = fn;
}

/**
 * Emit a folder-index EbletMintRecord into the soccerball-DAG substrate.
 * Skips deleted files. Best-effort — never throws.
 */
export function emitFolderEntryToDAG(eblet: EbletMintRecord): void {
  try {
    if (eblet.source_deleted) return;

    // pearls: deterministic identity for this file at this sha256
    const pearls: string[] = [
      eblet.sourceSha256,
      eblet.sourceFilePath,
      `folder_index_entry:${eblet.mintedAt}`,
    ];

    // bindings: metadata accessible via SID lookup
    const bindings: Record<string, string> = {
      type: 'folder_index_entry',
      path: eblet.sourceFilePath,
      hash: eblet.sourceSha256,
      event: eblet.event,
      minted_at: eblet.mintedAt,
    };
    if (eblet.contentExcerpt) {
      bindings.summary = eblet.contentExcerpt.slice(0, 200);
    }

    const dagId = dag_soccerball_emit_reexport(pearls, bindings, {});
    _emitCount++;

    // Broadcast pointer advance to mesh peers so they can replicate this node
    _meshPointerAdvanceHook?.(dagId);

    console.log(`[dag_bridge] emitted dag_id=${dagId} path=${eblet.sourceFilePath}`);
  } catch (err) {
    console.log('[dag_bridge] emit error (non-fatal):', err instanceof Error ? err.message : String(err));
  }
}

/** Returns the total count of DAG entries emitted this session. */
export function getDagEmitCount(): number {
  return _emitCount;
}
