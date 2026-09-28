// flagship_authorities_ipc.ts -- D-BP223-BM0-X029-019 (round 2). Registers the four IPC channels the Settings
// "Nexus Authorities: how each flagship is reached" panel calls. See flagship_authorities_store.ts's header for what is
// stored and why no channel ever returns a key.
import { ipcMain } from 'electron';
import { listAuthorities, removeKey, saveKey, setAutomatic } from './flagship_authorities_store';

export function registerFlagshipAuthoritiesIpc(): void {
  ipcMain.handle('flagship-authorities:list', () => ({ ok: true, authorities: listAuthorities() }));
  ipcMain.handle('flagship-authorities:set-automatic', (_evt, providerId: string, on: boolean) => setAutomatic(String(providerId), on === true));
  ipcMain.handle('flagship-authorities:save-key', (_evt, providerId: string, rawKey: string) => saveKey(String(providerId), String(rawKey || '')));
  ipcMain.handle('flagship-authorities:remove-key', (_evt, providerId: string) => removeKey(String(providerId)));
}
