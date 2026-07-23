// Mnemosyne -- Beacons Lit IPC Channel Registration
// BP098 M43
//
// Registers two IPC channels:
//   bonfire_lit:status  -- returns BeaconsLitStatus (renderer polls this)
//   bonfire_lit:toggle  -- { enabled: boolean } -- enable or disable Beacons Lit
//
// These channels are exposed to the renderer via preload.ts contextBridge.

import { ipcMain } from 'electron';
import { getStatus, enable, disable } from './index';

export function registerBeaconsLitIpc(): void {
  ipcMain.handle('bonfire_lit:status', () => {
    return getStatus();
  });

  ipcMain.handle('bonfire_lit:toggle', async (_event, payload: { enabled: boolean }) => {
    if (payload?.enabled) {
      await enable();
    } else {
      disable();
    }
    return getStatus();
  });

  console.log('[BeaconsLit] IPC channels registered: bonfire_lit:status + bonfire_lit:toggle');
}
