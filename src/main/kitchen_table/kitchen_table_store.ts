// Kitchen Table™ main-process store — Mnemosyne™ v0.1.8 · SEG-FT-1 · BP052 NOVACULA
// JSON file persistence via app.getPath('userData')/kitchen_table_data.json
// No SQLite dependency — simple, portable, v0.1.8-ready.

import { app, ipcMain } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import type {
  KitchenTableSession,
  Recipe,
  AtlasEvent,
  P2PDiscoveryPeer,
} from '../../shared/kitchen_table_types';

// ─── Storage ──────────────────────────────────────────────────────────────────

interface KitchenTableData {
  sessions: KitchenTableSession[];
  recipes: Recipe[];
  atlasEvents: AtlasEvent[];
}

const EMPTY_DATA: KitchenTableData = {
  sessions: [],
  recipes: [],
  atlasEvents: [],
};

function getDataPath(): string {
  return join(app.getPath('userData'), 'kitchen_table_data.json');
}

function loadData(): KitchenTableData {
  const path = getDataPath();
  if (!existsSync(path)) return { ...EMPTY_DATA, sessions: [], recipes: [], atlasEvents: [] };
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as KitchenTableData;
  } catch {
    return { ...EMPTY_DATA, sessions: [], recipes: [], atlasEvents: [] };
  }
}

function saveData(data: KitchenTableData): void {
  const path = getDataPath();
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

function now(): string {
  return new Date().toISOString();
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

function listSessions(): KitchenTableSession[] {
  return loadData().sessions;
}

function getSession(id: string): KitchenTableSession | null {
  return loadData().sessions.find((s) => s.id === id) ?? null;
}

function createSession(data: Omit<KitchenTableSession, 'id' | 'createdAt' | 'updatedAt'>): KitchenTableSession {
  const db = loadData();
  const ts = now();
  const session: KitchenTableSession = { ...data, id: randomUUID(), createdAt: ts, updatedAt: ts };
  db.sessions.push(session);
  saveData(db);
  return session;
}

function updateSession(id: string, data: Partial<KitchenTableSession>): KitchenTableSession | null {
  const db = loadData();
  const idx = db.sessions.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  db.sessions[idx] = { ...db.sessions[idx], ...data, id, updatedAt: now() };
  saveData(db);
  return db.sessions[idx];
}

function deleteSession(id: string): boolean {
  const db = loadData();
  const before = db.sessions.length;
  db.sessions = db.sessions.filter((s) => s.id !== id);
  if (db.sessions.length === before) return false;
  saveData(db);
  return true;
}

// ─── Recipes™ ─────────────────────────────────────────────────────────────────

function listRecipes(): Recipe[] {
  return loadData().recipes;
}

function getRecipe(id: string): Recipe | null {
  return loadData().recipes.find((r) => r.id === id) ?? null;
}

function createRecipe(data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>): Recipe {
  const db = loadData();
  const ts = now();
  const recipe: Recipe = { ...data, id: randomUUID(), createdAt: ts, updatedAt: ts };
  db.recipes.push(recipe);
  saveData(db);
  return recipe;
}

function updateRecipe(id: string, data: Partial<Recipe>): Recipe | null {
  const db = loadData();
  const idx = db.recipes.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  db.recipes[idx] = { ...db.recipes[idx], ...data, id, updatedAt: now() };
  saveData(db);
  return db.recipes[idx];
}

function deleteRecipe(id: string): boolean {
  const db = loadData();
  const before = db.recipes.length;
  db.recipes = db.recipes.filter((r) => r.id !== id);
  if (db.recipes.length === before) return false;
  saveData(db);
  return true;
}

// ─── Atlas™ Events ────────────────────────────────────────────────────────────

function listAtlasEvents(): AtlasEvent[] {
  return loadData().atlasEvents;
}

function getAtlasEvent(id: string): AtlasEvent | null {
  return loadData().atlasEvents.find((e) => e.id === id) ?? null;
}

function createAtlasEvent(data: Omit<AtlasEvent, 'id' | 'createdAt'>): AtlasEvent {
  const db = loadData();
  const event: AtlasEvent = { ...data, id: randomUUID(), createdAt: now() };
  db.atlasEvents.push(event);
  saveData(db);
  return event;
}

function updateAtlasEvent(id: string, data: Partial<AtlasEvent>): AtlasEvent | null {
  const db = loadData();
  const idx = db.atlasEvents.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  db.atlasEvents[idx] = { ...db.atlasEvents[idx], ...data, id };
  saveData(db);
  return db.atlasEvents[idx];
}

function deleteAtlasEvent(id: string): boolean {
  const db = loadData();
  const before = db.atlasEvents.length;
  db.atlasEvents = db.atlasEvents.filter((e) => e.id !== id);
  if (db.atlasEvents.length === before) return false;
  saveData(db);
  return true;
}

// ─── IPC Registration ─────────────────────────────────────────────────────────

import { registerP2PIPC } from './p2p_discovery';

export function registerKitchenTableIpc(ipc: typeof ipcMain): void {
  // P2P Discovery IPC
  registerP2PIPC();
  // Sessions
  ipc.handle('kitchen-table:list-sessions', () => listSessions());
  ipc.handle('kitchen-table:get-session', (_e, { id }: { id: string }) => getSession(id));
  ipc.handle('kitchen-table:create-session', (_e, data: Omit<KitchenTableSession, 'id' | 'createdAt' | 'updatedAt'>) => createSession(data));
  ipc.handle('kitchen-table:update-session', (_e, { id, data }: { id: string; data: Partial<KitchenTableSession> }) => updateSession(id, data));
  ipc.handle('kitchen-table:delete-session', (_e, { id }: { id: string }) => deleteSession(id));

  // Recipes™
  ipc.handle('kitchen-table:list-recipes', () => listRecipes());
  ipc.handle('kitchen-table:get-recipe', (_e, { id }: { id: string }) => getRecipe(id));
  ipc.handle('kitchen-table:create-recipe', (_e, data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) => createRecipe(data));
  ipc.handle('kitchen-table:update-recipe', (_e, { id, data }: { id: string; data: Partial<Recipe> }) => updateRecipe(id, data));
  ipc.handle('kitchen-table:delete-recipe', (_e, { id }: { id: string }) => deleteRecipe(id));

  // Atlas™ Events
  ipc.handle('kitchen-table:list-atlas-events', () => listAtlasEvents());
  ipc.handle('kitchen-table:get-atlas-event', (_e, { id }: { id: string }) => getAtlasEvent(id));
  ipc.handle('kitchen-table:create-atlas-event', (_e, data: Omit<AtlasEvent, 'id' | 'createdAt'>) => createAtlasEvent(data));
  ipc.handle('kitchen-table:update-atlas-event', (_e, { id, data }: { id: string; data: Partial<AtlasEvent> }) => updateAtlasEvent(id, data));
  ipc.handle('kitchen-table:delete-atlas-event', (_e, { id }: { id: string }) => deleteAtlasEvent(id));

  // Photo dialog
  ipc.handle('kitchen-table:open-photo-dialog', async () => {
    const { dialog } = await import('electron');
    const result = await dialog.showOpenDialog({
      title: 'Select Photo',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'] }],
      properties: ['openFile'],
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });
}
