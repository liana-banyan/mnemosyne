// modemHandshakeSound.ts
// SEG: D-BP148-001/KNIGHT/M3/seg-m3t4r
//
// M3 -- OPTIONAL DIAL-UP MODEM HANDSHAKE SOUND (Founder request, BP148 release pass).
//
// Purely cosmetic. Synthesized entirely with the Web Audio API (oscillators + filtered noise)
// -- no recording, no bundled/downloaded audio file, per the ticket's explicit constraint
// ("synthesize the tone with the Web Audio API ... do NOT download, bundle, or embed any
// recording of a real modem or any third-party audio file"). Zero dependency, same choice
// already made for speech (SpeechSynthesisUtterance, browser-native).
//
// HARD CONTRACT: this module must never block, gate, or delay anything. `playModemHandshakeSound`
// is fire-and-forget -- it schedules audio nodes and returns; callers must not (and do not)
// await it before proceeding with the real connection/request. If the Web Audio API is
// unavailable, or anything throws, this degrades to a silent no-op rather than surfacing an
// error to the chat flow.

// Reused across calls so rapid successive sends don't leak AudioContexts (browsers cap how many
// can exist concurrently). Created lazily, only on first actual play request -- never at module
// load / import time, so merely importing this file never touches audio hardware.
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new Ctor();
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

/** Feature-detect without allocating an AudioContext -- lets callers hide/disable the checkbox honestly on an unsupported runtime, without side effects. */
export function isModemHandshakeSoundSupported(): boolean {
  return typeof window !== 'undefined' &&
    !!(window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
}

function scheduleTone(ctx: AudioContext, startAt: number, freq: number, durationSec: number, gainPeak: number, type: OscillatorType = 'sine'): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.01);
  gain.gain.linearRampToValueAtTime(0, startAt + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + durationSec + 0.02);
}

function scheduleSweep(ctx: AudioContext, startAt: number, fromFreq: number, toFreq: number, durationSec: number, gainPeak: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(fromFreq, startAt);
  osc.frequency.linearRampToValueAtTime(toFreq, startAt + durationSec);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.015);
  gain.gain.linearRampToValueAtTime(0, startAt + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + durationSec + 0.02);
}

function scheduleNoiseBurst(ctx: AudioContext, startAt: number, durationSec: number, gainPeak: number): void {
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(1800, startAt);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.01);
  gain.gain.linearRampToValueAtTime(0, startAt + durationSec);
  src.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(ctx.destination);
  src.start(startAt);
  src.stop(startAt + durationSec + 0.02);
}

/**
 * playModemHandshakeSound -- synthesizes a short, stylized dial-up modem handshake (dial tone,
 * a few DTMF-ish digit blips, a rising/falling carrier sweep, then a filtered-noise handshake
 * burst). Fire-and-forget: schedules Web Audio nodes on their own timeline and returns
 * immediately. Never throws; never awaited by callers; never gates the real connection.
 */
export function playModemHandshakeSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    // Autoplay-policy resume is itself async; intentionally not awaited -- if it doesn't
    // resolve in time for the first scheduled node, later nodes still play, and if it never
    // resolves at all, that is a silent no-op, exactly as this module's contract requires.
    void ctx.resume().catch(() => { /* non-fatal */ });

    const t0 = ctx.currentTime + 0.02;
    // Dial tone
    scheduleTone(ctx, t0, 350, 0.3, 0.05);
    scheduleTone(ctx, t0, 440, 0.3, 0.05);
    // A few DTMF-ish digit blips
    const digits = [697, 1336, 770, 1477, 852, 1209];
    let t = t0 + 0.35;
    for (let i = 0; i < digits.length; i += 2) {
      scheduleTone(ctx, t, digits[i], 0.09, 0.06, 'square');
      scheduleTone(ctx, t, digits[i + 1], 0.09, 0.06, 'square');
      t += 0.13;
    }
    // Carrier negotiation sweep (the classic "warble")
    scheduleSweep(ctx, t, 1200, 2400, 0.35, 0.05);
    t += 0.4;
    scheduleSweep(ctx, t, 2400, 1000, 0.3, 0.05);
    t += 0.35;
    // Final handshake noise burst
    scheduleNoiseBurst(ctx, t, 0.4, 0.04);
  } catch {
    // Cosmetic feature -- any failure here must never surface to the chat flow.
  }
}
