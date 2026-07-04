/**
 * pearl_listener.ts -- Pearl subscription stub
 *
 * BP089 · Mountain 2
 * Thin wrapper around PearlEmitter static event bus.
 * Scribes use PearlListener.on() to register for inbound pearl events.
 */

import { PearlEmitter } from './pearl_emitter';

type PearlHandler = (payload: unknown) => void;

export class PearlListener {
  /** Subscribe to a named pearl channel. */
  static on(channel: string, handler: PearlHandler): void {
    PearlEmitter.on(channel, handler);
  }

  /** Unsubscribe from a channel. */
  static off(channel: string): void {
    PearlEmitter.off(channel);
  }
}
