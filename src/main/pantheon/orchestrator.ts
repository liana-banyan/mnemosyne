// Pantheon Orchestrator — dispatches 6 personas in parallel, collects Tablets
// BP041: "Miners and Fates and Foragers and Pixies and Shadow E-Spiders and Shadow E-Sprites
//         would descend upon that data and make Eblets"
// Architecture: v1 uses async Promise.all (Pod-G worker promotion in Phase B+).
// Fates run LAST (pattern-detection requires Iron Tablets from the other 5).

import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { PANTHEON_SESSIONS_DIR } from './types';
import type {
  PantheonDispatchRequest,
  PantheonDispatchReceipt,
  PantheonPersonaResult,
  PantheonIpcProgress,
  PersonaId,
} from './types';
import { writeIronTablet, writeStoneTablet, countTablets } from './tablet_store';
import { updateTabletCounts } from './folder_prefs';

// Persona imports
import { MinerPersona } from './personas/miner';
import { ForagerPersona } from './personas/forager';
import { PixiesPersona } from './personas/pixies';
import { ShadowSpritesPersona } from './personas/shadow_sprites';
import { ShadowSpidersPersona } from './personas/shadow_spiders';
import { FatesPersona } from './personas/fates';

// ─── In-flight session registry ───────────────────────────────────────────────

interface ActiveSession {
  session_id: string;
  started_at: string;
  folder_path: string;
  member_id: string;
  total_tablets_so_far: number;
}

const activeSessions = new Map<string, ActiveSession>();

export function getActiveSessions(): ActiveSession[] {
  return Array.from(activeSessions.values());
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export async function dispatchPantheon(
  req: PantheonDispatchRequest,
  onProgress?: (evt: PantheonIpcProgress) => void,
): Promise<PantheonDispatchReceipt> {
  if (!existsSync(PANTHEON_SESSIONS_DIR)) {
    mkdirSync(PANTHEON_SESSIONS_DIR, { recursive: true });
  }

  const sessionId = `pdm_${randomUUID()}`;
  const startedAt = new Date().toISOString();

  const session: ActiveSession = {
    session_id: sessionId,
    started_at: startedAt,
    folder_path: req.folder_path,
    member_id: req.member_id,
    total_tablets_so_far: 0,
  };
  activeSessions.set(sessionId, session);

  const personasToRun: PersonaId[] = req.personas ?? [
    'shadow_sprite',  // fastest — runs first for immediate feedback
    'forager',
    'miner',
    'pixies',
    'shadow_spider',
    // Fates runs last — needs Iron Tablets from the above 5
  ];

  const errors: string[] = [];
  const personaResults: PantheonPersonaResult[] = [];

  // Phase 1: Run all non-Fates personas in parallel
  const phase1Personas = [
    ShadowSpritesPersona,
    ForagerPersona,
    MinerPersona,
    PixiesPersona,
    ShadowSpidersPersona,
  ].filter((p) => personasToRun.includes(p.id));

  const phase1Start = Date.now();

  const phase1Results = await Promise.allSettled(
    phase1Personas.map(async (persona) => {
      const tStart = Date.now();
      const personaErrors: string[] = [];

      try {
        const eblets = await persona.scan(req.folder_path, req.member_id, {
          sharingScope: req.sharing_scope,
          onProgress: (evt) => {
            session.total_tablets_so_far += evt.tablets_written ?? 0;
            onProgress?.({
              session_id: sessionId,
              persona: evt.persona,
              persona_label: evt.persona,
              persona_icon: persona.icon,
              phase: evt.phase,
              message: evt.message,
              tablets_written: evt.tablets_written,
              total_so_far: session.total_tablets_so_far,
            });
          },
        });

        let ironCount = 0;
        let stoneCount = 0;

        for (const eblet of eblets) {
          try {
            if (eblet.tablet_grade === 'stone') {
              writeStoneTablet(req.member_id, eblet);
              stoneCount++;
            } else {
              writeIronTablet(req.member_id, eblet);
              ironCount++;
            }
          } catch (err) {
            personaErrors.push(`write_failed: ${(err as Error).message}`);
          }
        }

        return {
          persona: persona.id,
          tablets_written: ironCount + stoneCount,
          iron_count: ironCount,
          stone_count: stoneCount,
          duration_ms: Date.now() - tStart,
          errors: personaErrors,
        } as PantheonPersonaResult;
      } catch (err) {
        const msg = `${persona.id}_failed: ${(err as Error).message}`;
        errors.push(msg);
        onProgress?.({
          session_id: sessionId,
          persona: persona.id,
          persona_label: persona.displayName,
          persona_icon: persona.icon,
          phase: 'error',
          message: msg,
        });
        return {
          persona: persona.id,
          tablets_written: 0,
          iron_count: 0,
          stone_count: 0,
          duration_ms: Date.now() - tStart,
          errors: [msg],
        } as PantheonPersonaResult;
      }
    }),
  );

  for (const result of phase1Results) {
    personaResults.push(result.status === 'fulfilled' ? result.value : {
      persona: 'miner',
      tablets_written: 0,
      iron_count: 0,
      stone_count: 0,
      duration_ms: 0,
      errors: [result.reason as string],
    });
  }

  void phase1Start;

  // Phase 2: Fates — runs after Iron Tablets are written
  if (personasToRun.includes('fates')) {
    const fatesStart = Date.now();
    try {
      const fatesEblets = await FatesPersona.scan(req.folder_path, req.member_id, {
        sharingScope: req.sharing_scope,
        onProgress: (evt) => {
          session.total_tablets_so_far += evt.tablets_written ?? 0;
          onProgress?.({
            session_id: sessionId,
            persona: evt.persona,
            persona_label: 'Fates',
            persona_icon: FatesPersona.icon,
            phase: evt.phase,
            message: evt.message,
            tablets_written: evt.tablets_written,
            total_so_far: session.total_tablets_so_far,
          });
        },
      });

      let ironCount = 0;
      let stoneCount = 0;
      const fatesErrors: string[] = [];

      for (const eblet of fatesEblets) {
        try {
          if (eblet.tablet_grade === 'stone') {
            writeStoneTablet(req.member_id, eblet);
            stoneCount++;
          } else {
            writeIronTablet(req.member_id, eblet);
            ironCount++;
          }
        } catch (err) {
          fatesErrors.push(`write_failed: ${(err as Error).message}`);
        }
      }

      personaResults.push({
        persona: 'fates',
        tablets_written: ironCount + stoneCount,
        iron_count: ironCount,
        stone_count: stoneCount,
        duration_ms: Date.now() - fatesStart,
        errors: fatesErrors,
      });
    } catch (err) {
      const msg = `fates_failed: ${(err as Error).message}`;
      errors.push(msg);
      personaResults.push({
        persona: 'fates',
        tablets_written: 0,
        iron_count: 0,
        stone_count: 0,
        duration_ms: Date.now() - fatesStart,
        errors: [msg],
      });
    }
  }

  const counts = countTablets(req.member_id);
  updateTabletCounts(req.member_id, req.folder_path, { iron: counts.iron, stone: counts.stone });

  const completedAt = new Date().toISOString();
  const totalTablets = personaResults.reduce((s, r) => s + r.tablets_written, 0);
  const totalIron = personaResults.reduce((s, r) => s + r.iron_count, 0);
  const totalStone = personaResults.reduce((s, r) => s + r.stone_count, 0);

  const receipt: PantheonDispatchReceipt = {
    session_id: sessionId,
    member_id: req.member_id,
    folder_path: req.folder_path,
    sharing_scope: req.sharing_scope,
    started_at: startedAt,
    completed_at: completedAt,
    total_tablets: totalTablets,
    iron_tablets: totalIron,
    stone_tablets: totalStone,
    persona_results: personaResults,
    errors,
  };

  // Persist receipt
  writeFileSync(
    resolve(PANTHEON_SESSIONS_DIR, `${sessionId}.receipt.json`),
    JSON.stringify(receipt, null, 2),
    'utf-8',
  );

  activeSessions.delete(sessionId);
  return receipt;
}
