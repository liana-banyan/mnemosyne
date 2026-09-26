// ipc.ts -- D-BP223-BM04-X033S3-009 STEP 1e
//
// registerProveItIPC(): wires the six IPC handlers the brief's STEP 1d names (ask, addToSubstrate,
// listSomebodyElse, askThisOne, vote, categories) plus suggestCategory and getFlags, and forwards
// every ticker event to every open renderer window on PROVEIT_CHANNELS.ticker. Same registration
// convention as ai_dispatch_ipc.ts's registerAiDispatchIPC() / scavenger_hunt's handlers
// (ipcMain.handle per channel, called once from index.ts's registerIPCHandlers()).

import { ipcMain, BrowserWindow } from 'electron';
import {
  PROVEIT_CHANNELS,
  isKnownProveItCategory,
  type ProveItAskRequest,
  type ProveItAskResponse,
  type ProveItAskThisOneRequest,
  type ProveItAskThisOneResponse,
  type ProveItAddToSubstrateRequest,
  type ProveItAddToSubstrateResponse,
  type ProveItListRequest,
  type ProveItListResponse,
  type ProveItVoteRequest,
  type ProveItVoteResponse,
  type ProveItCategoriesResponse,
  type ProveItAskedBy,
  type ProveItListPersonasResponse,
  type ProveItTakeBackRequest,
  type ProveItTakeBackResponse,
} from '../../shared/proveit_contract';
import { buildAndWriteCard } from './card_writer';
import { askThisOne as askThisOneImpl } from './ask_this_one';
import { addCardToSubstrate, listMyPersonasLive, takeBackCard } from './substrate_publish';
import { listSomebodyElseCards } from './list_somebody_else';
import { castVote } from './votes';
import { listSeedCategories, suggestCategory, listCategorySuggestions } from './categories';
import { loadProveItSettings } from './settings';
import { ensureSeedCardsLoadedOnce } from './seed_loader';
import { setTickerSink } from './ticker';

function resolveAskedBy(asker: ProveItAskRequest['asker'] | undefined): ProveItAskedBy {
  if (asker?.memberDisplay) {
    return { kind: 'member', display: asker.memberDisplay, stamped: true, id: asker.memberId ?? null };
  }
  if (asker?.guestDisplay) {
    return { kind: 'guest', display: asker.guestDisplay, stamped: false, id: asker.guestWalletId ?? null };
  }
  return { kind: 'guest', display: 'Guest', stamped: false, id: null };
}

export function registerProveItIPC(): void {
  // Broadcast every ticker event to every open window -- mirrors ai_dispatch_ipc.ts's own
  // 'ask-token-progress'/'ask-engine-progress' broadcast convention (send on every BrowserWindow,
  // not just the one that made the request, since Prove It's ticker is meant to be watched live).
  setTickerSink((event) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(PROVEIT_CHANNELS.ticker, event);
    }
  });

  // Seed cards materialize on first IPC registration (app start), once, idempotently -- spec
  // Section 6 "day one, region D is pre-loaded". Never blocks registration on failure.
  try {
    ensureSeedCardsLoadedOnce();
  } catch (err) {
    console.warn('[ProveIt] seed load on startup failed (non-fatal):', err);
  }

  ipcMain.handle(PROVEIT_CHANNELS.ask, (_event, req: ProveItAskRequest): ProveItAskResponse => {
    try {
      if (!isKnownProveItCategory(req.category)) {
        return { ok: false, runId: '', error: `unknown category "${req.category}"` };
      }
      const answerText = req.method === 'by_hand' ? (req.pastedAnswer ?? '') : (req.answerText ?? '');
      const { runId, card } = buildAndWriteCard({
        question: req.question,
        category: req.category,
        method: req.method,
        answer: answerText,
        sources: req.sources,
        askedBy: resolveAskedBy(req.asker),
      });
      if (!card) return { ok: false, runId, error: 'no answer text -- try the by-hand path' };
      return { ok: true, runId, card };
    } catch (err) {
      return { ok: false, runId: '', error: String(err) };
    }
  });

  ipcMain.handle(PROVEIT_CHANNELS.askThisOne, (_event, req: ProveItAskThisOneRequest): ProveItAskThisOneResponse => {
    try {
      const result = askThisOneImpl(req.address);
      if (!result.card) return { ok: false, runId: result.runId, error: `no card found at address hex:${req.address}` };
      return { ok: true, runId: result.runId, card: result.card, stale: result.stale, staleLabel: result.staleLabel };
    } catch (err) {
      return { ok: false, runId: '', error: String(err) };
    }
  });

  ipcMain.handle(PROVEIT_CHANNELS.addToSubstrate, async (_event, req: ProveItAddToSubstrateRequest): Promise<ProveItAddToSubstrateResponse> => {
    try {
      const result = await addCardToSubstrate(req.address, { memberDisplay: req.asker?.memberDisplay, guestDisplay: req.asker?.guestDisplay }, { personaId: req.personaId });
      return { ok: result.ok, card: result.card ?? undefined, queued: result.queued, error: result.error };
    } catch (err) {
      return { ok: false, queued: false, error: String(err) };
    }
  });

  ipcMain.handle(PROVEIT_CHANNELS.listSomebodyElse, (_event, req: ProveItListRequest | undefined): ProveItListResponse => {
    try {
      const { cards, unlocked } = listSomebodyElseCards({ category: req?.category, sortBy: req?.sortBy });
      return { ok: true, cards, unlocked };
    } catch (err) {
      return { ok: false, cards: [], unlocked: false, error: String(err) };
    }
  });

  ipcMain.handle(PROVEIT_CHANNELS.vote, (_event, req: ProveItVoteRequest): ProveItVoteResponse => {
    try {
      const result = castVote(req.address, req.isGhost, req.voter);
      return { ok: result.ok, voteCount: result.voteCount, credited: result.credited, creditNote: result.creditNote, error: result.error };
    } catch (err) {
      return { ok: false, credited: false, creditNote: '', error: String(err) };
    }
  });

  ipcMain.handle(PROVEIT_CHANNELS.categories, (): ProveItCategoriesResponse => {
    try {
      return { ok: true, categories: listSeedCategories(), suggestions: listCategorySuggestions() };
    } catch {
      return { ok: false, categories: [], suggestions: [] };
    }
  });

  ipcMain.handle(PROVEIT_CHANNELS.suggestCategory, (_event, text: string) => {
    try {
      return { ok: true, suggestion: suggestCategory(String(text ?? '')) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle(PROVEIT_CHANNELS.getFlags, () => {
    try {
      return { ok: true, settings: loadProveItSettings() };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // X039 (D-BP223-PQ004-006): the persona picker and "Take it back", both through the substrate RPCs.
  ipcMain.handle(PROVEIT_CHANNELS.listMyPersonas, async (): Promise<ProveItListPersonasResponse> => {
    try {
      return await listMyPersonasLive();
    } catch (err) {
      return { ok: false, signedIn: false, personas: [], error: String(err) };
    }
  });

  ipcMain.handle(PROVEIT_CHANNELS.takeBack, async (_event, req: ProveItTakeBackRequest): Promise<ProveItTakeBackResponse> => {
    try {
      return await takeBackCard(String(req?.address ?? ''));
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}
