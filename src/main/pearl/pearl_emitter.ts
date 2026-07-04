/**
 * pearl_emitter.ts -- Pearl emission stub
 *
 * BP089 · Mountain 2
 * Provides PearlEmitter class and static event bus for scribe pearl emissions.
 * Full wire-up requires Supabase pearl_share table + MIC broadcast (see pearl_mesh_sync.ts).
 * Scribes call PearlEmitter.emit() and PearlEmitter.on() for pub/sub.
 */

type PearlHandler = (payload: unknown) => void;

const _handlers: Map<string, PearlHandler[]> = new Map();

export interface PearlEmitArgs {
  channel: string;
  payload: Record<string, unknown>;
}

export class PearlEmitter {
  /**
   * Emit a pearl on a named channel.
   * Returns a generated pearl id (timestamp-based until Supabase wire-up).
   */
  static async emit(channelOrArgs: string | PearlEmitArgs, payload?: Record<string, unknown>): Promise<string> {
    let channel: string;
    let data: Record<string, unknown>;

    if (typeof channelOrArgs === 'string') {
      channel = channelOrArgs;
      data = payload ?? {};
    } else {
      channel = channelOrArgs.channel;
      data = channelOrArgs.payload;
    }

    const pearlId = `pearl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Invoke registered handlers synchronously
    const handlers = _handlers.get(channel) ?? [];
    for (const h of handlers) {
      try {
        h({ ...data, _pearlId: pearlId, _channel: channel });
      } catch (_err) {
        // Handler errors must not crash the emitter
      }
    }

    return pearlId;
  }

  /** Register a handler for a named channel (static event bus). */
  static on(channel: string, handler: PearlHandler): void {
    const existing = _handlers.get(channel) ?? [];
    _handlers.set(channel, [...existing, handler]);
  }

  /** Remove all handlers for a channel. */
  static off(channel: string): void {
    _handlers.delete(channel);
  }

  /** Instance emit (delegates to static). */
  async emit(args: PearlEmitArgs): Promise<string> {
    return PearlEmitter.emit(args);
  }
}
