/**
 * diagnosis_ipc.ts — The Diagnosis IPC handlers v0.4.0 BP083
 *
 * Registers IPC handlers:
 *   diagnosis:post        → create + broadcast a Diagnosis
 *   diagnosis:list        → list Diagnoses (local + received from peers)
 *   diagnosis:get         → get single Diagnosis by id
 *   diagnosis:answer      → submit an answer
 *   diagnosis:upvote      → upvote an answer
 *   diagnosis:accept      → accept answer + payout bounty
 *   diagnosis:marks-balance → get Marks balance for current user
 *
 * Peer server hooks for incoming Diagnoses are registered here too.
 */

import { ipcMain, BrowserWindow } from 'electron';
import {
  createDiagnosis,
  loadDiagnosis,
  listDiagnoses,
  submitAnswer,
  upvoteAnswer,
  acceptAnswer,
  receiveDiagnosis,
  receiveAnswer,
} from './diagnosis_engine';
import { getMarksBalance } from './bounty_substitution';
import { registerPeerServerHooks } from '../federation/peer_server';
import type { DiagnosisCreateInput, DiagnosisDomain } from './diagnosis_types';

function broadcastDiagnosisEvent(event: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(event, data);
    }
  }
}

export function registerDiagnosisIpc(): void {
  // ── diagnosis:post ───────────────────────────────────────────────────────────
  ipcMain.handle('diagnosis:post', async (_evt, input: DiagnosisCreateInput) => {
    try {
      const id = await createDiagnosis(input);
      return { ok: true, id };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ── diagnosis:list ───────────────────────────────────────────────────────────
  ipcMain.handle('diagnosis:list', async (_evt, filter?: { status?: string; domain?: DiagnosisDomain }) => {
    try {
      const posts = await listDiagnoses(filter);
      return { ok: true, posts };
    } catch (err) {
      return { ok: false, error: String(err), posts: [] };
    }
  });

  // ── diagnosis:get ────────────────────────────────────────────────────────────
  ipcMain.handle('diagnosis:get', async (_evt, id: string) => {
    try {
      const post = await loadDiagnosis(id);
      return { ok: !!post, post };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ── diagnosis:answer ─────────────────────────────────────────────────────────
  ipcMain.handle('diagnosis:answer', async (_evt, { diagnosisId, answerText, sources, credentials }: {
    diagnosisId: string;
    answerText: string;
    sources: string[];
    credentials?: string;
  }) => {
    try {
      const answerId = await submitAnswer(diagnosisId, answerText, sources, credentials);
      if (answerId) {
        // Notify renderer about new answer
        broadcastDiagnosisEvent('diagnosis:answer-received', { diagnosisId, answerId });
      }
      return { ok: !!answerId, answerId };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ── diagnosis:upvote ─────────────────────────────────────────────────────────
  ipcMain.handle('diagnosis:upvote', async (_evt, { diagnosisId, answerId }: { diagnosisId: string; answerId: string }) => {
    try {
      await upvoteAnswer(diagnosisId, answerId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ── diagnosis:accept ─────────────────────────────────────────────────────────
  ipcMain.handle('diagnosis:accept', async (_evt, { diagnosisId, answerId }: { diagnosisId: string; answerId: string }) => {
    try {
      const ok = await acceptAnswer(diagnosisId, answerId);
      if (ok) {
        broadcastDiagnosisEvent('diagnosis:resolved', { diagnosisId, answerId });
      }
      return { ok };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ── diagnosis:marks-balance ───────────────────────────────────────────────────
  ipcMain.handle('diagnosis:marks-balance', async () => {
    try {
      const balance = await getMarksBalance('local-user');
      return { ok: true, balance };
    } catch (err) {
      return { ok: false, balance: 0, error: String(err) };
    }
  });

  // ── Register peer_server hooks for incoming Diagnosis objects ─────────────────
  registerPeerServerHooks({
    onDiagnosisPost: async (data) => {
      try {
        await receiveDiagnosis(data as import('./diagnosis_types').DiagnosisPost);
        broadcastDiagnosisEvent('diagnosis:incoming', data);
      } catch (err) {
        console.error('[DiagnosisIPC] receiveDiagnosis error:', err);
      }
    },
    onDiagnosisAnswer: async (data) => {
      try {
        const { diagnosisId, answer } = data as { diagnosisId: string; answer: import('./diagnosis_types').DiagnosisAnswer };
        await receiveAnswer(diagnosisId, answer);
        broadcastDiagnosisEvent('diagnosis:answer-received', { diagnosisId, answerId: answer.id });
      } catch (err) {
        console.error('[DiagnosisIPC] receiveAnswer error:', err);
      }
    },
    onDiagnosisUpvote: async (data) => {
      try {
        const { diagnosisId, answerId } = data as { diagnosisId: string; answerId: string };
        await upvoteAnswer(diagnosisId, answerId);
      } catch (err) {
        console.error('[DiagnosisIPC] upvote error:', err);
      }
    },
  });

  console.log('[DiagnosisIPC] v0.4.0 handlers registered');
}
