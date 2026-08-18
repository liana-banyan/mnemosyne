/**
 * addressee_registry.ts
 * SEG: D-BP148-001/KNIGHT/M1/seg-m1x9k
 *
 * M1 -- THE ADDRESSEE REGISTRY.
 *
 * mnemosynec_message_store.ts's `to`/`from` fields are free strings with no
 * registry behind them (verified 2026-08-06: no prior AddresseeRegistry or
 * equivalent construct exists anywhere in this tree). This module defines the
 * minimal, fixed, typed set of valid addressee ids and the lookup/validate
 * functions other modules need to address a message safely.
 *
 * No UI, no IPC, no wiring into the bridge -- that is a follow-on ticket.
 * This module is intentionally standalone: it does not import from and is
 * not imported by mnemosynec_message_store.ts, bridge_ipc.ts, or preload.ts.
 */
/** The fixed set of valid addressee ids. */
export const ADDRESSEE_IDS = ['bishop', 'knight', 'founder'];
const REGISTRY = {
    bishop: { id: 'bishop', displayName: 'Bishop' },
    knight: { id: 'knight', displayName: 'Knight' },
    founder: { id: 'founder', displayName: 'Founder' },
};
/** Type guard: does `value` name a registered addressee id? */
export function isAddresseeId(value) {
    return Object.prototype.hasOwnProperty.call(REGISTRY, value);
}
/** Look up an addressee by id, or `undefined` if `id` is not registered. */
export function getAddressee(id) {
    return isAddresseeId(id) ? REGISTRY[id] : undefined;
}
/** Validate `id`, throwing if it does not name a registered addressee. */
export function assertAddresseeId(id) {
    if (!isAddresseeId(id)) {
        throw new Error(`Invalid addressee id: ${JSON.stringify(id)}. Valid ids: ${ADDRESSEE_IDS.join(', ')}`);
    }
    return id;
}
/** All registered addressees, in a stable, defined order. */
export function listAddressees() {
    return ADDRESSEE_IDS.map((id) => REGISTRY[id]);
}
