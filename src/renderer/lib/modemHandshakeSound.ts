// modemHandshakeSound.ts
// SEG: D-BP148-001/KNIGHT/M3/seg-m3t4r
// SEG: D-BP148-007/BISHOP/M2/seg-bishop-m2-graceful -- hoisted the 9 hardcoded duration
//   literals into one exported named constant (HANDSHAKE_TOTAL_MS) so total length is tunable
//   by ear from a single knob. Duration only; timbre/frequencies/ordering untouched.
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
//
// TUNING: HANDSHAKE_TOTAL_MS below is the single knob for the whole handshake's length. Every
// stage duration and inter-stage gap is derived from it proportionally, so changing that one
// number rescales the entire sound coherently while preserving the original rhythm between
// stages (dial tone -> digit blips -> up-sweep -> down-sweep -> noise burst).

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

/**
 * HANDSHAKE_TOTAL_MS -- the single tunable knob for total handshake length, in milliseconds.
 * Every stage duration and inter-stage gap below is derived from this value proportionally
 * (same ratios as the original hand-authored ~1930ms assembly from SEG m3t4r / commit
 * `55cfbcc2`), so changing this one number rescales the whole sound coherently and preserves
 * the relative rhythm between stages. Exported so it can be retuned without reading the rest
 * of this file.
 *
 * Default 3200ms is a STARTING VALUE chosen to be tuned by ear -- NOT a claim about what is
 * correct. The Founder's live report on the original ~1930ms assembly was that it "sounds like
 * a sneeze." To retune: change this one number and rebuild (`npm run build:renderer`); nothing
 * else in this file needs to change.
 */
export const HANDSHAKE_TOTAL_MS = 3200;

// Reference baseline (not exported, internal to the proportional-scaling math below): the
// original hand-authored assembly totalled ~1930ms = 20ms pre-roll (t0 offset, an audio-engine
// scheduling margin, not a perceptual stage) + 1890ms of stage/gap literals + a 20ms per-node
// stop-scheduling tail (also an engine margin). Only the 1890ms of actual stage/gap literals is
// rescaled; the two 20ms engine margins stay fixed regardless of HANDSHAKE_TOTAL_MS.
const ORIGINAL_STAGE_SPAN_MS = 1890;
const ENGINE_MARGIN_MS = 40; // 20ms pre-roll + 20ms stop-tail, held fixed, not part of the knob
const HANDSHAKE_SCALE = (HANDSHAKE_TOTAL_MS - ENGINE_MARGIN_MS) / ORIGINAL_STAGE_SPAN_MS;

/**
 * The nine literals the Founder's ground truth identified (BP148), now expressed as
 * `<original ms> * HANDSHAKE_SCALE / 1000` seconds instead of bare hardcoded numbers. Comment
 * on each marks its role: which of the three schedule* helpers it feeds, or which inter-stage
 * timeline-cursor advance it drives.
 */
const DIAL_TONE_DURATION_SEC = (300 * HANDSHAKE_SCALE) / 1000; // scheduleTone x2, 350Hz + 440Hz (dial tone)
const DIGIT_START_GAP_SEC = (350 * HANDSHAKE_SCALE) / 1000; // cursor advance before digit blips start
const DIGIT_BLIP_DURATION_SEC = (90 * HANDSHAKE_SCALE) / 1000; // scheduleTone x2 per pair, square wave
const DIGIT_PAIR_GAP_SEC = (130 * HANDSHAKE_SCALE) / 1000; // cursor advance per digit pair (looped x3)
const SWEEP_UP_DURATION_SEC = (350 * HANDSHAKE_SCALE) / 1000; // scheduleSweep 1200Hz -> 2400Hz
const SWEEP_UP_GAP_SEC = (400 * HANDSHAKE_SCALE) / 1000; // cursor advance after the up-sweep
const SWEEP_DOWN_DURATION_SEC = (300 * HANDSHAKE_SCALE) / 1000; // scheduleSweep 2400Hz -> 1000Hz
const SWEEP_DOWN_GAP_SEC = (350 * HANDSHAKE_SCALE) / 1000; // cursor advance after the down-sweep
const NOISE_BURST_DURATION_SEC = (400 * HANDSHAKE_SCALE) / 1000; // scheduleNoiseBurst, final stage

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
    scheduleTone(ctx, t0, 350, DIAL_TONE_DURATION_SEC, 0.05);
    scheduleTone(ctx, t0, 440, DIAL_TONE_DURATION_SEC, 0.05);
    // A few DTMF-ish digit blips
    const digits = [697, 1336, 770, 1477, 852, 1209];
    let t = t0 + DIGIT_START_GAP_SEC;
    for (let i = 0; i < digits.length; i += 2) {
      scheduleTone(ctx, t, digits[i], DIGIT_BLIP_DURATION_SEC, 0.06, 'square');
      scheduleTone(ctx, t, digits[i + 1], DIGIT_BLIP_DURATION_SEC, 0.06, 'square');
      t += DIGIT_PAIR_GAP_SEC;
    }
    // Carrier negotiation sweep (the classic "warble")
    scheduleSweep(ctx, t, 1200, 2400, SWEEP_UP_DURATION_SEC, 0.05);
    t += SWEEP_UP_GAP_SEC;
    scheduleSweep(ctx, t, 2400, 1000, SWEEP_DOWN_DURATION_SEC, 0.05);
    t += SWEEP_DOWN_GAP_SEC;
    // Final handshake noise burst
    scheduleNoiseBurst(ctx, t, NOISE_BURST_DURATION_SEC, 0.04);
  } catch {
    // Cosmetic feature -- any failure here must never surface to the chat flow.
  }
}
