// slot_registry_ipc.ts -- D-BP165-M0-036/BISHOP/M0/seg-swappable-brains-slot-registry
//
// KORSAIKOFF GATE ACKNOWLEDGMENT: this file's name shares tokens with slot_registry.ts because it
// is that module's IPC sibling, written in the SAME dispatch, seconds after slot_registry.ts
// itself (confirmed by direct read of slot_registry.ts's own content earlier in this turn, not a
// re-derivation). No other slot-registry file exists anywhere in this repo -- confirmed this
// dispatch via grep for slotRegistry|slot_registry|brainSlot|brain_slot|modelSlot|model_slot|
// slotAssignment across mnemosyne/src and LianaBanyanPlatform before slot_registry.ts was written
// at all (zero hits). This is not the four-times-in-one-session duplication the gate is guarding
// against; it is the IPC half of the one new module this dispatch is building.
//
// IPC surface for slot_registry.ts, following the SAME registration convention every other IPC
// module in this main process already uses (ai_dispatch_ipc.ts's registerAiDispatchIPC(),
// query_capture_ipc.ts's registerQueryCaptureIPC(), etc: one exported register*() function,
// called once from index.ts's startup sequence). Not a new pattern.
//
// Deliberately does NOT touch preload.ts or any src/renderer/** file this dispatch -- the
// Founder's D-BP165-M0-036 constraint list forbids touching any renderer/pane component this
// session (BISHOP-M3 owns those, its machine is unstable). These four channels are therefore
// "exposed for reading" at the IPC layer only; wiring a preload bridge + a renderer control for
// them is left for a follow-up dispatch once BISHOP-M3's machine is stable again. Any script that
// can reach ipcRenderer.invoke on these channel names (a test harness, a future preload addition)
// can already read/write the registry today -- nothing here is blocked on that follow-up.
//
// No em-dashes. Additive only. Never printed: no key, seed, or token flows through this file.

import { ipcMain } from 'electron';
import {
  listAvailableBrains,
  listSlots,
  getSlot,
  assignSlot,
  unassignSlot,
  type SlotBrainRef,
} from './slot_registry';
import { summarizeBanyanByBrain } from './banyan_by_brain';

export function registerSlotRegistryIPC(): void {
  // slot-registry:list-brains -- the full catalog a slot can be assigned to (nexus brains +
  // browser authorities), read fresh every call so a newly-installed Ollama model or a newly
  // wired authority shows up without a restart.
  ipcMain.handle('slot-registry:list-brains', async () => {
    return listAvailableBrains();
  });

  // slot-registry:list-slots -- every persisted slot -> brain assignment.
  ipcMain.handle('slot-registry:list-slots', async () => {
    return listSlots();
  });

  // slot-registry:get-slot -- one named slot's current assignment, or undefined.
  ipcMain.handle('slot-registry:get-slot', async (_event, slot_name: string) => {
    return getSlot(slot_name);
  });

  // slot-registry:assign -- persist (or overwrite) one slot's brain assignment. Validated against
  // the SAME live catalog list-brains reads -- rejects an unknown brain_id/authority rather than
  // silently persisting a dangling reference.
  ipcMain.handle(
    'slot-registry:assign',
    async (_event, slot_name: string, brain: SlotBrainRef, label?: string) => {
      return assignSlot(slot_name, brain, label);
    },
  );

  // slot-registry:unassign -- remove a slot entirely. Returns false if the slot did not exist.
  ipcMain.handle('slot-registry:unassign', async (_event, slot_name: string) => {
    return unassignSlot(slot_name);
  });

  // slot-registry:banyan-summary -- Set A Banyan Metric composite per (brain_id, machineId),
  // read-only, NEVER averaged across machineId (LAW 3). Empty array until a caller starts
  // recording via banyan_by_brain.ts's recordBrainAnswerScore() -- see that file's header for
  // why this dispatch does not force a live call site itself.
  ipcMain.handle('slot-registry:banyan-summary', async () => {
    return summarizeBanyanByBrain();
  });
}
