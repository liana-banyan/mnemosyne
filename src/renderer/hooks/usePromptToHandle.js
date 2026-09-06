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
import { assertAddresseeId } from '../../main/addressee_registry';
function getBridge() {
    return window.amplify.bridge;
}
/**
 * usePromptToHandle -- mints a prompt into a Crystal handle, then sends that handle (not
 * the raw prose) to `to` over the message bridge. Returns the handle and send status.
 */
export function usePromptToHandle() {
    const [status, setStatus] = useState('idle');
    const [lastResult, setLastResult] = useState(null);
    const [error, setError] = useState(null);
    const sendPrompt = useCallback(async (prompt, to) => {
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
            const result = { handle: '', sendStatus: 'failed', sendError: msg };
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
                const result = { handle, sendStatus: 'failed', sendError: msg };
                setLastResult(result);
                return result;
            }
            setStatus('sent');
            const result = {
                handle,
                sendStatus: 'sent',
                messageId: sendResult.pearl_id ?? sendResult.message_id,
            };
            setLastResult(result);
            return result;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setStatus('error');
            setError(msg);
            const result = { handle, sendStatus: 'failed', sendError: msg };
            setLastResult(result);
            return result;
        }
    }, []);
    return { sendPrompt, status, lastResult, error };
}
