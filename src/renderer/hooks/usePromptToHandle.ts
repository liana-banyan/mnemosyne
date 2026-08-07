// usePromptToHandle.ts
// SEG: D-BP148-001/KNIGHT/M2/seg-m2v7q
//
// M2 -- THE PROMPT-TO-HANDLE HOOK (dispatch D-BP148-001, THE HEX TERMINAL).
//
// Takes a typed prompt string, mints it into a hex content-address handle via
// `window.amplify.crystal.mint` (main-process crystal_store.ts's `mintChonk`, reached
// through the `crystal:mint` IPC channel -- src/main/index.ts:6789, preload.ts:2177),
// then carries that HANDLE (never the raw prose) to a target addressee via
// `window.amplify.bridge.sendMessage` (mnemosynec_message_store.ts's `sendMessage`,
// reached through `bridge:send-message` -- bridge_ipc.ts:38-96, preload.ts:1037-1038).
//
// ADDRESS ALGORITHM IS SETTLED ESTATE LAW, NOT OPEN TO REDESIGN (HARDWIRE-00,
// D-BP147-006 UPDATE-02): pearls-only, sorted but NOT deduped --
// sha256(JSON.stringify([...pearls].sort())).slice(0,32). This hook does not
// reimplement that algorithm; it calls the one real implementation
// (crystal_store.ts's `mintChonk` -> `deriveMintAddress`) through the IPC surface and
// trusts its output as the handle.
//
// Does not touch LeanAskTab.tsx or AskHomeTab.tsx (M3's exclusive files) and does not
// touch src/main/addressee_registry.ts (M1's landed file, commit c593f6b6) -- only
// imports its exported type/constant for compile-time typing of the target addressee.

import { useCallback, useState } from 'react';
import { assertAddresseeId, type AddresseeId } from '../../main/addressee_registry';

// ─── The bridge surface, typed locally ─────────────────────────────────────────
//
// Premise re-verification finding: `window.amplify.bridge` is real and wired at runtime
// (bridge_ipc.ts registers 'bridge:send-message'; preload.ts:1034-1039 exposes it as
// `window.amplify.bridge.{sendMessage,checkMessages}`), but the RENDERER's own ambient
// type declaration file, src/renderer/amplify.d.ts (the only `declare global { interface
// Window }` augmentation inside tsconfig.renderer.json's `include`; preload.ts's own
// matching declaration lives under src/main and is outside that compilation), declares
// `window.amplify.crystal` but never declares `window.amplify.bridge` at all. A direct
// `window.amplify.bridge.sendMessage(...)` reference therefore fails to type-check under
// `tsconfig.renderer.json` today, even though the call succeeds at runtime.
//
// Fixing that gap by editing amplify.d.ts would widen this ticket's OWNS block past "one
// new renderer hook file only," so instead the surface this hook needs is declared
// locally, once, and read off `window` through a single narrow cast confined to this
// file. This does not change what ships at runtime; it only supplies, inside this file's
// own scope, the ambient type amplify.d.ts is missing.
interface AmplifyBridgeSendArgs {
  to: string;
  type: string;
  content: string;
  from?: string;
}

// preload.ts's own declared return type (line 2424) is
// `{ ok: boolean; message_id?: string; error?: string }`, but the real handler
// (bridge_ipc.ts:94 -> mnemosynec_message_store.ts:73-92's `sendMessage`) actually
// resolves `{ pearl_id, ok }` at runtime -- `message_id` is never present. Both fields
// are declared optional here so this hook reads whichever one is actually there without
// assuming either is guaranteed, and without silently "fixing" a preload.ts type that is
// not this ticket's file to edit.
interface AmplifyBridgeSendResult {
  ok: boolean;
  message_id?: string;
  pearl_id?: string;
  error?: string;
}

interface AmplifyBridgeSurface {
  sendMessage: (args: AmplifyBridgeSendArgs) => Promise<AmplifyBridgeSendResult>;
}

function getBridge(): AmplifyBridgeSurface {
  return (window as unknown as { amplify: { bridge: AmplifyBridgeSurface } }).amplify.bridge;
}

export type PromptToHandleStatus = 'idle' | 'minting' | 'sending' | 'sent' | 'error';

export interface PromptToHandleResult {
  /** The 32-hex-char handle minted for this prompt (empty string if minting itself failed). */
  handle: string;
  sendStatus: 'sent' | 'failed';
  sendError?: string;
  /** The store's own message id for the sent carrier message, when available. */
  messageId?: string;
}

/**
 * usePromptToHandle -- mints a prompt into a Crystal handle, then sends that handle (not
 * the raw prose) to `to` over the message bridge. Returns the handle and send status.
 */
export function usePromptToHandle() {
  const [status, setStatus] = useState<PromptToHandleStatus>('idle');
  const [lastResult, setLastResult] = useState<PromptToHandleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendPrompt = useCallback(
    async (prompt: string, to: AddresseeId): Promise<PromptToHandleResult> => {
      // Throws if `to` is not a registered addressee id -- reuses M1's own validator
      // rather than re-deriving the check, per the ticket's import instruction.
      assertAddresseeId(to);

      setError(null);
      setStatus('minting');

      // Pearls-only, per the ruled algorithm: the prompt is the sole pearl. Sorting and
      // hashing happen inside mintChonk()/deriveMintAddress(), not here.
      const pearls = [prompt];
      const mintResult = await window.amplify.crystal.mint(pearls);
      if (!mintResult.ok || !mintResult.sid) {
        const msg = mintResult.error ?? 'crystal:mint returned ok:false with no error message';
        setStatus('error');
        setError(msg);
        const result: PromptToHandleResult = { handle: '', sendStatus: 'failed', sendError: msg };
        setLastResult(result);
        return result;
      }
      const handle = mintResult.sid;

      setStatus('sending');
      try {
        const sendResult = await getBridge().sendMessage({
          to,
          type: 'prompt-handle',
          content: handle,
        });
        if (!sendResult.ok) {
          const msg = sendResult.error ?? 'bridge:send-message returned ok:false with no error message';
          setStatus('error');
          setError(msg);
          const result: PromptToHandleResult = { handle, sendStatus: 'failed', sendError: msg };
          setLastResult(result);
          return result;
        }
        setStatus('sent');
        const result: PromptToHandleResult = {
          handle,
          sendStatus: 'sent',
          messageId: sendResult.pearl_id ?? sendResult.message_id,
        };
        setLastResult(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus('error');
        setError(msg);
        const result: PromptToHandleResult = { handle, sendStatus: 'failed', sendError: msg };
        setLastResult(result);
        return result;
      }
    },
    [],
  );

  return { sendPrompt, status, lastResult, error };
}
