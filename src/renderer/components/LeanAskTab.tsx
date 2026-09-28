// MnemosyneC · v0.4.1 · BP083 · 2026-06-15
// §2 Truth-Always · §3 Sonnet 4.6 · Founder-ratified
//
// LeanAskTab — Ask A Question tab for the 3-tab LeanShell.
// Model: gemma4:12b — LOCAL BY DEFAULT. D-BP148-024 AMENDMENT (see handleSend's own header note
// near its ai-dispatch:query call site for the full writeup): the A1.1 "no cloud exposure" framing
// above predates BP132 Yoke #21 C5's flagship-brain-swap feature and is no longer strictly true --
// this tab now runs through ai-dispatch:query's real escalation ladder (BP145-M4 Slice 2) and the
// pre-existing explicit-flagship-brain-pick branch, both of which CAN reach a paid Anthropic call.
// Both are money-gated behind isPaidEscalationEnabled() (ai_dispatch_ipc.ts, main-process-only,
// cannot be bypassed from this file) which DEFAULTS OFF and requires an explicit opt-in plus a
// real configured credential -- with no settings UI wired to that flag yet, this tab is local-only
// in practice today, but it is no longer local-only by hard binding in the code.
// SEG-1 v0.1.57: routes through ai-dispatch:query IPC (substrate HOT retrieve active).
// v0.1.57.1 (BP081): token streaming + cold-start heartbeat.
// v0.1.62 (BP082): Clear + Save & Clear buttons in header. Save uses Blob download (path-b).
// Persistent history in localStorage key 'mnemo_ask_history' (max 200 msgs).
// Membership CTA banner pinned at bottom, never dismissible.
//
// SEG: D-BP148-001/KNIGHT/M3/seg-m3t4r -- THE HEX TERMINAL, UI SURFACE AND SPEECH.
// Mounts M2's usePromptToHandle hook: the user's prompt is minted into a Crystal handle and
// carried (not the raw prose) to Knight over the real message bridge, fired in parallel with
// (never gating) the real engine call below. On reply, HARDWIRE-09 Law 1 governs: the reply is
// rendered/spoken as a CELPANE by default, with full content behind an explicit second fetch.
// See the "Hex Terminal" block below handleSend for the full disclosed design and the honest
// gaps (no real celpane-authoring or mode-telemetry exists yet upstream of this ticket).

import React, { useState, useEffect, useRef, useCallback } from 'react';
// SEG-1 v0.1.57: direct Ollama fetch replaced by window.amplify.aiDispatch.query IPC.
import { ModelPullProgress } from './ModelPullProgress';
// v0.4.1 BP083: Salt Level selector + upgrade suggestion
import { SaltLevelSelector, type SaltLevel } from './SaltLevelSelector';
// BP132 Yoke #21 C6: BrainSwapSelector was fully built but orphaned (imported nowhere in
// src/renderer -- confirmed by repo-wide search). Mounted here, collapsible, rather than
// repurposing the upgradeSuggestion footer buttons (those are the Ask+Linger/Post-as-Diagnosis
// Constellation-broadcast feature -- a different concern; relabeling them for brain-swap would
// be confusing given their existing copy).
import { BrainSwapSelector } from './BrainSwapSelector';
// BP138 Yoke 0.9.15 FIX 4: reuses the EXISTING Nexus authority settings store (renderer-side
// localStorage, see that file's own header) to check researchArmMode/researchArmBrowserAuthority
// -- do not reinvent this check, per the Yoke's explicit instruction.
import { loadNexusAuthoritySettings } from '../settings/nexus_authority_settings_store';
// KN-BP143-3 D5 (amended, scoped to real data): per-message live engine view -- token-stream
// terminal + real completion/nexus badges, addressable stage ids. Absorbs the three
// pre-existing badges below (self-context, answer-cache, browser-authority provenance) into
// this one per-message surface -- see this file's own header note near their old call sites
// for why (they were global/last-message-only; this fixes that).
import { AskEngineView, type AskEngineState } from './AskEngineView';
// D-BP148-001/KNIGHT/M3: M2's hook (landed aca2a047, does not touch this file) -- mints a
// prompt into a Crystal handle and carries it to an addressee over the real bridge.
import { usePromptToHandle } from '../hooks/usePromptToHandle';
// M1's landed registry (c593f6b6) -- imported for typing only, per this ticket's instruction.
import type { AddresseeId } from '../../main/addressee_registry';
import { playModemHandshakeSound } from '../lib/modemHandshakeSound';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'user' | 'assistant' | 'system';

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  ts: number;
  /** KN-BP143-3 D5: per-message live-engine-view state, accumulated live as real
   *  onAskTokenProgress/onAskTokenComplete/nexusAskLookupFact events arrive for THIS message,
   *  then frozen (replay-able) once the turn concludes. Replaces the old standalone
   *  `provenance` field below (folded into `engine.nexus`) and the old global
   *  selfCtxStatus/lastServedFromSubstrate header state (folded into `engine.completion`). */
  engine?: AskEngineState;
  /** SEG D-BP148-001/KNIGHT/M3: set on the OUTGOING user message once usePromptToHandle's
   *  mint+send resolves (fired in parallel with the real engine call, never gating it). */
  sentHandle?: SentHandleState;
  /** SEG D-BP148-001/KNIGHT/M3: set on the assistant reply once the Hex Terminal celpane/
   *  transparent-mode decision has been made for that reply -- see buildCelpane/shouldUseHandleMode. */
  celpane?: CelpaneState;
}

/** SEG D-BP148-001/KNIGHT/M3 -- outbound mint+send result, attached to the user's own bubble. */
interface SentHandleState {
  addressee: AddresseeId;
  handle: string;
  sendStatus: 'sent' | 'failed';
  sendError?: string;
}

/**
 * SEG D-BP148-001/KNIGHT/M3 -- per-reply Hex Terminal state.
 * mode 'handle': a real Crystal handle was minted for this reply; `lines` is the celpane
 *   rendered/spoken by default; `fullContent` is revealed only after an explicit second fetch
 *   (crystal.resolve), tracked by `fullRevealed`.
 * mode 'transparent': v.42bis fallback -- either the reply was already cheaper than the
 *   celpane+handle overhead, or minting produced no handle. Prose is shown/spoken directly;
 *   there is nothing further to fetch, so `fullRevealed` is always true.
 */
interface CelpaneState {
  mode: 'handle' | 'transparent';
  handle?: string;
  lines?: string[];
  fullContent: string;
  fullRevealed: boolean;
  resolving?: boolean;
}

const LS_HISTORY_KEY = 'mnemo_ask_history';
const MAX_HISTORY = 200;
const MODEL = 'gemma4:12b';

// ─── v0.4.1: Upgrade suggestion classifier (renderer-side heuristics) ─────────

const DIAGNOSTIC_PATTERNS = [
  /\bmy\s+\w+/i,
  /\bthis\s+(rash|pain|issue|problem|error)\b/i,
  /\bby\s+(friday|monday|today|tomorrow|tonight)\b/i,
  /\bit'?s\s+doing\b/i,
  /\bi\s+have\b/i,
  /\bin\s+[A-Z][a-z]+/,
  /\bdiagnos/i,
  /\bundiagnosed\b/i,
  /\bwhy\s+(won't|doesn't|isn't|can't)\b/i,
];

const BMV_UPGRADE_THRESHOLD = 70;

function classifyForUpgrade(question: string, bmv: number): { show: boolean; reason: string | null; bmv?: number } {
  if (bmv < BMV_UPGRADE_THRESHOLD) {
    return { show: true, reason: 'low_bmv', bmv };
  }
  const isDiagnostic = DIAGNOSTIC_PATTERNS.some((p) => p.test(question));
  if (isDiagnostic) {
    return { show: true, reason: 'diagnostic_shape' };
  }
  return { show: false, reason: null };
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(LS_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(msgs: ChatMessage[]): void {
  const trimmed = msgs.slice(-MAX_HISTORY);
  try {
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(trimmed));
  } catch { /* non-fatal */ }
}

// ─── Cold-start / warm timer text helpers ────────────────────────────────────

function coldStartText(secs: number): string {
  return `🧠 Gemma is loading into memory (first run, ~30–90s)... (${secs}s)`;
}

function thinkingText(secs: number): string {
  return `Thinking... (${secs}s)`;
}

// ─── SEG D-BP148-001/KNIGHT/M3: THE HEX TERMINAL -- celpane + transparent-mode helpers ──────
//
// HARDWIRE-09 Law 1 (binding, not a suggestion this ticket invents): "a handle resolves to a
// celpane, five short strings, a 10 to 50 token payload... full content requires a SECOND
// EXPLICIT FETCH." DISCLOSED GAP, found while implementing this ticket, not papered over:
// crystal_store.ts's resolveChonk() (src/main/crystal/crystal_store.ts) returns back EXACTLY
// the pearls it was minted with -- i.e. the full original text -- not a compressed digest.
// Nothing in M1's registry or M2's hook produces a celpane either. HARDWIRE-11's 5-field
// (soul/heart/hands/hull/service) celpane is a human-authored artifact from a different system
// entirely (librarian-mcp's pearl_emit/soccerball_emit, for SEG-return reporting to a
// dispatcher) and is not wired to this chat surface. buildCelpane() below is therefore a
// minimal, deterministic, CLIENT-SIDE heuristic digest (extractive, not LLM- or human-authored)
// built here so this UI has something real to render/speak by default, per Law 1, pending a
// real celpane-authoring mechanism upstream. This is disclosed in the SEG return, not invented
// as if it were already-shipped machinery.

const CELPANE_LINE_COUNT = 5;
const CELPANE_MAX_WORDS_PER_LINE = 9;

/** Rough words/0.75 token estimate -- same class of renderer-side heuristic already used by
 *  classifyForUpgrade() above; not a real tokenizer, never claimed as one. */
function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / 0.75);
}

/** Extractive, deterministic 5-line digest -- see the disclosed-gap note above. */
function buildCelpane(fullText: string): string[] {
  const sentences = fullText.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  const source = sentences.length > 0 ? sentences : [fullText];
  const lines: string[] = [];
  for (let i = 0; i < source.length && lines.length < CELPANE_LINE_COUNT; i++) {
    const words = source[i].trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    const truncated = words.slice(0, CELPANE_MAX_WORDS_PER_LINE).join(' ');
    const line = words.length > CELPANE_MAX_WORDS_PER_LINE ? `${truncated}…` : truncated;
    lines.push(line);
  }
  return lines.length > 0 ? lines : [fullText.slice(0, 60)];
}

// v.42bis transparent-mode threshold, carried forward per this ticket's instruction: "if
// addressing (minting and resolving a handle) would cost more than simply sending the prose,
// send the prose." HONEST GAP: HARDWIRE-11's (M + H) >= P inequality is measured for
// agent-to-dispatcher MCP wire exchanges; M4's telemetry module (hex_terminal_telemetry.ts, not
// this ticket's file) owns the real paired cost measurement for THIS connector, and it is not
// wired into this UI. This constant is a disclosed, simplified stand-in: M (the one-time local
// IPC mint round trip) is treated as ~0 here (crystal:mint is a same-machine IPC call, not an
// agent reading a wire payload the way HARDWIRE-11's measurement was), and H is approximated
// from the celpane this file itself builds. If the reply is already shorter than what the
// celpane+handle would cost to show, minting buys nothing, so send the prose directly.
const HANDLE_MODE_OVERHEAD_TOKENS_ESTIMATE = 40;

/** Per this ticket's explicit instruction: "if M2's hook ... does not yet expose a mode/
 *  cost-comparison signal ... treat 'no handle produced' as transparent-mode." Checked both
 *  before minting (Crystal unavailable) and after (mint call failed / returned no sid). */
function shouldAttemptHandleMode(fullText: string): boolean {
  if (!window.amplify?.crystal?.mint) return false;
  return estimateTokens(fullText) > HANDLE_MODE_OVERHEAD_TOKENS_ESTIMATE;
}

/** Speaks the celpane (handle mode) or the prose (transparent mode) by default, per Law 1.
 *  Feature-detected, best-effort, and never allowed to throw into the chat flow. */
function speakAloud(text: string): void {
  try {
    if (!('speechSynthesis' in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  } catch {
    // Speech is a Law 1 requirement but never allowed to break the chat flow if unsupported.
  }
}

// ─── IPC-based chat via ai-dispatch:query (SEG-1 v0.1.57) ───────────────────
// Routes through main-process IPC → queryVerifiedEblets HOT retrieve → Ollama /api/chat.
// Non-streaming; substrate eblet context is injected server-side before LLM call.

// ─── Message bubbles ─────────────────────────────────────────────────────────

function MsgBubble({ msg, onRevealFullContent }: { msg: ChatMessage; onRevealFullContent: (msgId: string, handle: string) => void }) {
  const isUser = msg.role === 'user';
  // SEG D-BP148-001/KNIGHT/M3: HARDWIRE-09 Law 1 -- while a celpane decision exists for this
  // reply, the bubble shows the CELPANE (handle mode, not yet revealed) or the prose
  // (transparent mode, or handle mode after the explicit reveal) -- never full content
  // automatically in handle mode.
  const celpane = msg.celpane;
  const showingCelpaneOnly = !isUser && celpane?.mode === 'handle' && !celpane.fullRevealed;
  const displayContent = showingCelpaneOnly ? (celpane!.lines ?? []).join('\n') : msg.content;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 10,
    }}>
      <div style={{
        maxWidth: '78%',
        background: isUser ? '#0f4c35' : '#111827',
        border: `1px solid ${isUser ? '#16533c' : '#1e2a38'}`,
        borderRadius: 10,
        padding: '9px 13px',
        fontSize: 13,
        color: '#e2e8f0',
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {displayContent}
        {msg.content === '' && <span style={{ opacity: 0.4 }}>▌</span>}
      </div>

      {/* SEG D-BP148-001/KNIGHT/M3: outbound mint+send badge on the user's own bubble --
          proof that this prompt crossed as a handle (M2's hook), not the raw prose. */}
      {isUser && msg.sentHandle && (
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 3, fontFamily: 'monospace' }}>
          {msg.sentHandle.sendStatus === 'sent'
            ? `→ sent to ${msg.sentHandle.addressee} as handle ${msg.sentHandle.handle.slice(0, 12)}…`
            : `⚠ handle send to ${msg.sentHandle.addressee} failed: ${msg.sentHandle.sendError ?? 'unknown error'}`}
        </div>
      )}

      {/* SEG D-BP148-001/KNIGHT/M3: celpane / transparent-mode badge + explicit reveal control. */}
      {!isUser && celpane?.mode === 'handle' && (
        <div style={{
          fontSize: 10, color: '#818cf8', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: 'monospace' }}>
            🔑 celpane · handle {celpane.handle?.slice(0, 12)}…
          </span>
          {!celpane.fullRevealed && (
            <button
              type="button"
              onClick={() => onRevealFullContent(msg.id, celpane.handle!)}
              disabled={celpane.resolving}
              style={{
                background: 'none', border: '1px solid #4c1d95', borderRadius: 4, color: '#c4b5fd',
                fontSize: 10, padding: '2px 7px', cursor: celpane.resolving ? 'wait' : 'pointer',
                fontFamily: 'system-ui, sans-serif', outline: 'none',
              }}
            >
              {celpane.resolving ? 'Fetching full content…' : 'Read full content →'}
            </button>
          )}
          {celpane.fullRevealed && <span style={{ color: '#475569' }}>(full content fetched via a second, explicit crystal.resolve)</span>}
        </div>
      )}
      {!isUser && celpane?.mode === 'transparent' && (
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
          💬 transparent mode -- sent as prose, no handle minted (v.42bis: minting would not have paid for itself)
        </div>
      )}

      {/* KN-BP143-3 D5 (amended, scoped to real data): per-message live engine view --
          absorbs the old inline browser-authority source link that used to render here
          (msg.provenance) into the `nexus:authority` badge below, since re-showing the same
          authority+sourceUrl fact twice in two different styles would be a duplicate. */}
      {!isUser && (
        <AskEngineView
          messageId={msg.id}
          liveText={msg.content}
          engine={msg.engine}
          onOpenExternal={(url) => window.amplify?.openExternal?.(url)}
        />
      )}
    </div>
  );
}

// ─── Membership CTA Banner ───────────────────────────────────────────────────

function MembershipBanner() {
  const handleJoin = () => {
    window.amplify?.openExternal?.('https://lianabanyan.com/join');
    window.amplify?.authOpenJoin?.();
  };

  return (
    <div style={{
      background: '#0d1117',
      borderTop: '1px solid #1e2a38',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6ee7b7' }}>
          Join Liana Banyan — Better, Faster, Cheaper · $5/year
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          Workers, Builders, and Creators keep 83.3%. No ads. No VC.
        </div>
      </div>
      <button
        onClick={handleJoin}
        style={{
          background: 'linear-gradient(135deg, #059669, #10b981)',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'system-ui, sans-serif',
          outline: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Join Now →
      </button>
    </div>
  );
}

// ─── LeanAskTab ──────────────────────────────────────────────────────────────

interface LeanAskTabProps {
  onSwitchToHome?: () => void;
  /** SEG D-BP148-001/KNIGHT/M3: dial-up modem handshake sound, OFF BY DEFAULT. Owned/persisted
   *  by the parent (AskHomeTab) so the setting is a single home-tab-level control rather than
   *  re-declared per shell; defaults to false here too so any OTHER caller of LeanAskTab that
   *  does not pass this prop (CleanShell, LeanShell -- neither is the shipping front door, see
   *  App.tsx CompassShell) gets the same off-by-default behavior. */
  handshakeSoundEnabled?: boolean;
}

export function LeanAskTab({ onSwitchToHome, handshakeSoundEnabled = false }: LeanAskTabProps) {
  // D-BP148-001/KNIGHT/M3: M2's hook, mounted into this real chat flow.
  const { sendPrompt } = usePromptToHandle();
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  // v0.4.1: Salt Level persistence selector
  const [saltLevel, setSaltLevel] = useState<SaltLevel>('pinch');
  // v0.4.1: upgrade suggestion — shown inline below last response when BMV < 70 or diagnostic shape
  const [upgradeSuggestion, setUpgradeSuggestion] = useState<{ show: boolean; reason: string | null; bmv?: number } | null>(null);
  const lastUserQuestionRef = useRef<string>('');
  const [modelMissing, setModelMissing] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  // SEG-2 v0.1.56: show pull progress UI when gemma4:12b is missing
  const [showPullProgress, setShowPullProgress] = useState(false);
  // v0.1.62 BP082: toast state for Clear / Save & Clear feedback
  const [toast, setToast] = useState<string | null>(null);
  // BP-UX-fix: visible focus affordance for the Ask textarea (no native outline was replacing
  // the outline:none below, so the field looked "dead" even while focused -- see focus ring fix).
  const [inputFocused, setInputFocused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // BP132 Yoke #21 C6: brain-swap panel toggle + live active-brain label. The active brain
  // is read fresh from disk (brain_registry.json) on load and after each swap so the header
  // line ("Powered by...") never lies about which model is actually answering.
  const [showBrainSelector, setShowBrainSelector] = useState(false);
  // BP134 Task C/D: modelId added -- brain_id is a slug (e.g. "gemma2-9b"); modelId is the
  // real installed Ollama tag (e.g. "gemma2:9b") that should drive both the header copy and
  // the Ollama-reachability check below, since the free-local default is no longer hardcoded
  // to gemma4:12b.
  const [activeBrainLabel, setActiveBrainLabel] = useState<{ id: string; kind: 'flagship' | 'local'; modelId: string } | null>(null);

  const refreshActiveBrainLabel = useCallback(() => {
    void (async () => {
      try {
        const registry = window.amplify?.brainRegistry;
        if (!registry) return;
        const [listRes, activeRes] = await Promise.all([registry.list(), registry.getActive()]);
        if (activeRes.ok && activeRes.brain_id && listRes.ok && Array.isArray(listRes.brains)) {
          const active = listRes.brains.find((b) => (b as { brain_id: string }).brain_id === activeRes.brain_id) as
            { brain_id: string; kind: 'flagship' | 'local'; model_id: string } | undefined;
          if (active) setActiveBrainLabel({ id: active.brain_id, kind: active.kind, modelId: active.model_id });
        }
      } catch {
        // Non-fatal — header falls back to the static "gemma4:12b" copy below.
      }
    })();
  }, []);

  useEffect(() => {
    refreshActiveBrainLabel();
  }, [refreshActiveBrainLabel]);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // v0.1.62: Clear all message history after confirm
  const handleClear = useCallback(() => {
    if (messages.length === 0) return;
    const ok = window.confirm(
      `Clear ${messages.length} message${messages.length === 1 ? '' : 's'} and start fresh? This cannot be undone.`
    );
    if (!ok) return;
    setMessages([]);
    localStorage.removeItem(LS_HISTORY_KEY);
    showToast('Cleared. Ready for a fresh question.');
  }, [messages, showToast]);

  // v0.1.62: Save conversation to .md via Blob download (path-b), then clear
  const handleSaveAndClear = useCallback(() => {
    if (messages.length === 0) return;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const md = [
      '# MnemosyneC Ask — Saved Conversation',
      '',
      `**Saved:** ${new Date().toLocaleString()}`,
      `**Model:** ${activeBrainLabel ? activeBrainLabel.modelId : MODEL}`,
      `**Messages:** ${messages.length}`,
      '',
      '---',
      '',
      ...messages.map(m => {
        const who = m.role === 'user' ? '**You:**' : '**Gemma:**';
        return `${who}\n\n${m.content}\n\n---\n`;
      }),
    ].join('\n');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mnemo-ask-${ts}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setMessages([]);
    localStorage.removeItem(LS_HISTORY_KEY);
    showToast('Saved to your Downloads folder. Ready for a fresh question.');
  }, [messages, showToast, activeBrainLabel]);

  // KN-BP143-3 D5: the old global selfCtxStatus/lastServedFromSubstrate header badges (SEG-2
  // v0.3.7 / BP136 Yoke) are REMOVED here -- they only ever reflected the LAST message's
  // completion payload (stale/wrong once you scroll up to an older message), which is exactly
  // the flaw this Yoke's per-message live-engine-view fixes. Both facts now render per-message
  // via AskEngineView's `completion:self-context` / `completion:served-from-substrate` badges
  // (see updateMsgEngine calls in handleSend below), attached to the specific message they
  // describe instead of floating in the header describing only "whatever happened most recently".

  // v0.1.57.1 (BP081): streaming state — refs only (no extra React state for per-second ticks)
  const currentAiIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubProgressRef = useRef<(() => void) | null>(null);
  const unsubCompleteRef = useRef<(() => void) | null>(null);
  // KN-BP144-8 Phase 1: the free-text engine's own stage-progress subscription, separate
  // from unsubProgressRef above (which is the plain-chat token-delta stream and is not used
  // on the engine path -- the engine has no token-by-token text to stream, only discrete
  // stage events, until its one final answer arrives).
  const unsubEngineProgressRef = useRef<(() => void) | null>(null);
  const elapsedRef = useRef(0);
  const isColdRef = useRef(false);
  const isStreamingRef = useRef(false);

  // BP134 Task D: check against the ACTIVE local model (activeBrainLabel.modelId once resolved
  // from brain_registry) rather than the hardcoded MODEL constant. Without this, a box that only
  // has gemma2:9b pulled (no gemma4:12b) would permanently show the "still setting up / download
  // now" banner even though a free local model is already answering questions.
  const runCheck = useCallback(async (modelName: string = MODEL) => {
    setRetrying(true);
    try {
      const res = await window.amplify?.checkOllamaAndModel?.(modelName);
      if (!res) { setCheckFailed(true); setModelMissing(false); setShowPullProgress(false); }
      else if (!res.reachable) { setCheckFailed(true); setModelMissing(false); setShowPullProgress(false); }
      else {
        setCheckFailed(false);
        const missing = !res.hasModel;
        setModelMissing(missing);
        // SEG-2: auto-launch pull UI when model is absent and Ollama is reachable
        if (missing) setShowPullProgress(true);
        else setShowPullProgress(false);
      }
    } catch {
      setCheckFailed(true);
      setShowPullProgress(false);
    } finally {
      setRetrying(false);
    }
  }, []);

  useEffect(() => { runCheck(); }, [runCheck]);

  // BP134 Task D: once the real active local model resolves (may differ from the hardcoded
  // MODEL constant), re-run the presence check against it instead.
  useEffect(() => {
    if (activeBrainLabel && activeBrainLabel.kind === 'local' && activeBrainLabel.modelId && activeBrainLabel.modelId !== MODEL) {
      void runCheck(activeBrainLabel.modelId);
    }
  }, [activeBrainLabel, runCheck]);

  // A-3 BP081 v0.1.59.1: Prune error-class messages from history on app version change
  useEffect(() => {
    const unsub = window.amplify?.onAppVersionCheck?.(({ version }) => {
      const storedVersion = localStorage.getItem('mnemo_ask_history_version');
      if (storedVersion && storedVersion !== version) {
        try {
          const raw = localStorage.getItem(LS_HISTORY_KEY);
          if (raw) {
            const history = JSON.parse(raw) as ChatMessage[];
            const pruned = history.filter((msg) => {
              const text = (msg.content || '').toLowerCase();
              return (
                !text.includes('error') &&
                !text.includes('failed') &&
                !text.includes('exception') &&
                !text.includes('timeout')
              );
            });
            localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(pruned));
            if (history.length !== pruned.length) {
              setMessages(pruned);
              console.log(
                `[VersionCheck] Pruned ${history.length - pruned.length} error-class messages on upgrade ${storedVersion} → ${version}`,
              );
            }
          }
        } catch { /* non-fatal */ }
      }
      localStorage.setItem('mnemo_ask_history_version', version);
    });
    return () => { unsub?.(); };
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // BP-UX-fix: focus the Ask textarea when this tab mounts (both LeanShell and CleanShell
  // conditionally render <LeanAskTab /> only while the Ask tab is active, so a mount-time
  // focus here never steals focus from another tab -- it only fires when this one becomes
  // visible). Previously nothing ever set initial focus, so the field could look inactive
  // (no caret) until the user happened to click directly inside it.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const appendMsg = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, msg];
      saveHistory(next);
      return next;
    });
  }, []);

  // Update message content in-memory only (no localStorage write — used during streaming)
  const updateMsgInMemory = useCallback((id: string, content: string) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content } : m));
  }, []);

  // Update message content and persist to localStorage (used on stream complete)
  const updateMsgAndSave = useCallback((id: string, content: string) => {
    setMessages((prev) => {
      const next = prev.map((m) => m.id === id ? { ...m, content } : m);
      saveHistory(next);
      return next;
    });
  }, []);

  // KN-BP143-3 D5: merge a partial patch into a message's per-message live-engine-view
  // state (AskEngineView). In-memory only during streaming (mirrors updateMsgInMemory's
  // no-localStorage-write-mid-stream contract) -- the completion patch's caller below
  // additionally calls saveHistory so the finished engine state persists to history.
  const updateMsgEngine = useCallback((id: string, patch: AskEngineState) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, engine: { ...m.engine, ...patch } } : m));
  }, []);

  // SEG D-BP148-001/KNIGHT/M3: the "read the full content" control -- HARDWIRE-09 Law 1's
  // SECOND, EXPLICIT fetch. Only ever called from a user click (see MsgBubble); never
  // automatic. Performs a real crystal:resolve IPC round trip rather than just flipping a flag
  // to reveal the copy already held in memory, so this is a genuine second fetch, not a UI-only
  // reveal of data that was already fully present.
  const handleRevealFullContent = useCallback((msgId: string, handle: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId && m.celpane ? { ...m, celpane: { ...m.celpane, resolving: true } } : m)));
    void (async () => {
      try {
        const res = await window.amplify.crystal.resolve(handle);
        const full = res.ok && res.resolved
          ? res.resolved.pearls.join('\n\n')
          : `⚠ Could not resolve handle ${handle}: ${res.error ?? 'not found'}`;
        setMessages((prev) => {
          const next = prev.map((m) => (m.id === msgId && m.celpane ? {
            ...m,
            celpane: { ...m.celpane, fullContent: full, fullRevealed: true, resolving: false },
          } : m));
          saveHistory(next);
          return next;
        });
      } catch (err) {
        console.warn('[LeanAskTab] crystal.resolve threw on explicit full-content fetch:', err);
        setMessages((prev) => prev.map((m) => (m.id === msgId && m.celpane ? { ...m, celpane: { ...m.celpane, resolving: false } } : m)));
      }
    })();
  }, []);

  // v0.1.57.1: tear down streaming subscriptions and timer
  const clearStream = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (unsubProgressRef.current) { unsubProgressRef.current(); unsubProgressRef.current = null; }
    if (unsubCompleteRef.current) { unsubCompleteRef.current(); unsubCompleteRef.current = null; }
    if (unsubEngineProgressRef.current) { unsubEngineProgressRef.current(); unsubEngineProgressRef.current = null; }
    elapsedRef.current = 0;
    isColdRef.current = false;
    isStreamingRef.current = false;
    currentAiIdRef.current = null;
  }, []);

  const handleUpgrade = useCallback((level: SaltLevel) => {
    setSaltLevel(level);
    setUpgradeSuggestion(null);
    // Auto-scroll to input
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setUpgradeSuggestion(null); // clear prior suggestion on new question
    lastUserQuestionRef.current = text;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text, ts: Date.now() };
    const aiId = `a-${Date.now() + 1}`;
    // v0.1.57.1: start bubble with immediate "Thinking... (0s)" — every-click feedback canon
    const aiMsg: ChatMessage = { id: aiId, role: 'assistant', content: thinkingText(0), ts: Date.now() + 1 };

    setInput('');
    setThinking(true);
    appendMsg(userMsg);
    appendMsg(aiMsg);

    // SEG D-BP148-001/KNIGHT/M3: optional dial-up handshake sound, fired at "connect" (the
    // moment a new exchange starts). HARD CONTRACT from the ticket: purely cosmetic, must
    // NEVER gate/block/delay the real connection -- not awaited, and the real engine call
    // below proceeds on its own timeline regardless of whether this plays, finishes, or the
    // Web Audio API even exists on this runtime.
    if (handshakeSoundEnabled) {
      playModemHandshakeSound();
    }

    // SEG D-BP148-001/KNIGHT/M3: mount M2's usePromptToHandle hook -- mint this prompt into a
    // Crystal handle and carry the HANDLE (not the raw prose) to Knight over the real bridge.
    // Fired in parallel and never awaited before the real engine call below: a slow or failed
    // mint+send must never delay or gate the actual chat reply, mirroring the handshake-sound
    // contract above. Result is attached to the user's own bubble once it resolves (see
    // MsgBubble's sentHandle badge). Addressee is fixed to 'knight' -- this UI has no
    // addressee picker (out of this ticket's OWNS block); 'knight' is used as the dispatcher
    // context this ticket itself was fanned under, not a fabricated multi-recipient feature.
    void (async () => {
      try {
        const handleResult = await sendPrompt(text, 'knight' as AddresseeId);
        setMessages((prev) => {
          const next = prev.map((m) => (m.id === userMsg.id ? {
            ...m,
            sentHandle: {
              addressee: 'knight' as AddresseeId,
              handle: handleResult.handle,
              sendStatus: handleResult.sendStatus,
              sendError: handleResult.sendError,
            },
          } : m));
          saveHistory(next);
          return next;
        });
      } catch (err) {
        console.warn('[LeanAskTab] usePromptToHandle.sendPrompt threw (non-fatal, chat flow unaffected):', err);
      }
    })();

    // v0.1.57.1: initialise streaming refs for this query
    currentAiIdRef.current = aiId;
    elapsedRef.current = 0;
    isColdRef.current = false;
    isStreamingRef.current = false;

    // v0.1.57.1: heartbeat counter — increments every 1s until first token arrives
    intervalRef.current = setInterval(() => {
      if (isStreamingRef.current) return;
      elapsedRef.current += 1;
      const id = currentAiIdRef.current;
      if (!id) return;
      const txt = isColdRef.current ? coldStartText(elapsedRef.current) : thinkingText(elapsedRef.current);
      updateMsgInMemory(id, txt);
    }, 1000);

    // KN-BP144-8 Phase 1: subscribe to the free-text ENGINE's stage progress BEFORE calling
    // queryEngine (avoid race, same discipline as the old onAskTokenProgress subscription
    // this replaces). The engine has no token-by-token delta stream -- it emits discrete
    // CanonicalPlowProgressEvent stage events instead, so the live bubble text and the
    // AskEngineView stage list are both driven from this one subscription.
    if (window.amplify?.aiDispatch?.onAskEngineProgress) {
      const specialistStages = new Map<string, { name: string; status: 'pending' | 'firing' | 'done'; candidateCount?: number }>();
      unsubEngineProgressRef.current = window.amplify.aiDispatch.onAskEngineProgress((ev) => {
        const id = currentAiIdRef.current;
        if (!id) return;

        if (!isStreamingRef.current) {
          // First real engine event: stop heartbeat timer, same discipline as first-token.
          isStreamingRef.current = true;
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        }

        if (ev.type === 'substrate-check-start') {
          updateMsgEngine(id, { substrateChecking: true, streaming: true });
          updateMsgInMemory(id, 'Checking substrate…');
          return;
        }
        if (ev.type === 'substrate-miss') {
          updateMsgEngine(id, { substrateChecking: false });
          updateMsgInMemory(id, 'No rooted substrate hit — querying specialists…');
          return;
        }
        if (ev.type === 'substrate-hit-rooted') {
          updateMsgEngine(id, { substrateChecking: false });
          return;
        }
        if (ev.type === 'specialist-fire' && ev.specialistName) {
          specialistStages.set(ev.specialistName, { name: ev.specialistName, status: 'firing' });
          updateMsgEngine(id, { stages: Array.from(specialistStages.values()) });
          updateMsgInMemory(id, `Querying ${ev.specialistName}…`);
          return;
        }
        if (ev.type === 'specialist-done' && ev.specialistName) {
          specialistStages.set(ev.specialistName, {
            name: ev.specialistName, status: 'done', candidateCount: ev.specialistCandidates ?? 0,
          });
          updateMsgEngine(id, { stages: Array.from(specialistStages.values()) });
          return;
        }
        if (ev.type === 'saladin-done') { updateMsgInMemory(id, 'Adversarial fence (Saladin) checking candidates…'); return; }
        if (ev.type === 'furnace-done') { updateMsgInMemory(id, 'Furnace burning weak/challenged candidates…'); return; }
        if (ev.type === 'three-fates-done') { updateMsgInMemory(id, 'Three Fates arbitrating…'); return; }
      });
    }

    // v0.1.57.1: subscribe to stream complete
    if (window.amplify?.aiDispatch?.onAskTokenComplete) {
      unsubCompleteRef.current = window.amplify.aiDispatch.onAskTokenComplete((data) => {
        const id = currentAiIdRef.current;
        if (!id) return;

        // v0.1.57.1 differentiated error
        // KN-BP144-8 Phase 1, ticket 1.5: an engine abstention is real and honest, not an
        // error -- render it as a plain-language notice in the bubble itself (the Engine
        // View banner below carries the full reason), never a silently empty bubble and
        // never a plain-model guess dressed up as if the engine had answered.
        const finalContent = data.error
          ? `⚠ Ask threw: ${data.error}. See Diagnostic.`
          : data.engine?.abstained === true
          ? '(The engine could not produce an honest answer to this question — see Engine View below.)'
          : (data.content || '');

        // KN-BP143-3 D5: fold every real completion field (including the two additive,
        // untyped-in-amplify.d.ts-but-real-at-runtime fields, selfContextLoaded + bmv) into
        // this message's engine.completion, in place of the old global selfCtxStatus /
        // lastServedFromSubstrate header state. AskEngineView renders one badge per truthy
        // field -- absent/false-non-meaningful fields simply produce no badge.
        const rawData = data as Record<string, unknown>;
        const selfContextLoaded = typeof rawData.selfContextLoaded === 'boolean' ? rawData.selfContextLoaded as boolean : undefined;
        // D-BP148-024/BISHOP (Ask Tab Ladder Wiring): escalationTier/brainId/flagship are real
        // fields ai-dispatch:query's ladder emits (see ai_dispatch_ipc.ts's "EscalationLadder"
        // block) but are not part of the typed onAskTokenComplete payload in preload.ts -- same
        // additive-but-untyped convention as selfContextLoaded/bmv above, read the same way.
        // "Do not invent a new UI surface" per this ticket: this reuses the EXISTING
        // completion:provenance badge (AskEngineView.tsx already renders `Provenance: {text}`)
        // as the one place the user sees which tier answered, rather than adding a new badge.
        // Real substrate provenance (data.provenance, e.g. a rooted eblet's source) always wins
        // when present -- the tier label is only synthesized as a fallback when there is no more
        // specific provenance string already on this completion.
        const escalationTier = typeof rawData.escalationTier === 'number' ? rawData.escalationTier as number : undefined;
        const brainId = typeof rawData.brainId === 'string' ? rawData.brainId as string : undefined;
        const flagshipTierLabel = brainId
          ? `flagship brain "${brainId}" (paid cloud)`
          : 'flagship (paid cloud)';
        const tierLabel = escalationTier === 1
          ? 'escalation ladder — TIER 1 (local model, free)'
          : escalationTier === 3
          ? `escalation ladder — TIER 3 (cheap cloud${brainId ? `: ${brainId}` : ''}, paid)`
          : escalationTier === 4
          ? `escalation ladder — TIER 4 (${flagshipTierLabel})`
          : rawData.flagship === true
          ? flagshipTierLabel
          : undefined;
        updateMsgEngine(id, {
          streaming: false,
          substrateChecking: false,
          completion: {
            hotHits: data.hotHits,
            servedFromSubstrate: data.servedFromSubstrate,
            cost_usd: data.cost_usd,
            latency_ms: data.latency_ms,
            provenance: data.provenance ?? tierLabel,
            verified: data.verified,
            selfContextLoaded,
          },
          // KN-BP144-8 Phase 1, ADDITIVE: only present when this completion came from either
          // engine path -- ai-dispatch:query-engine (now orphaned, see this file's header), or
          // D-BP148-024's ai-dispatch:query ladder (a real local-model abstain, OR the
          // money-safety-gate's own honest-abstain-instead-of-paid-call event) -- absent
          // entirely on a served/non-abstained plain-chat or ladder-TIER-1 turn.
          ...(data.engine ? { receipt: data.engine as AskEngineState['receipt'] } : {}),
        });

        updateMsgAndSave(id, finalContent);
        clearStream();
        setThinking(false);
        textareaRef.current?.focus();

        // SEG D-BP148-001/KNIGHT/M3: HARDWIRE-09 Law 1 -- celpane by default, full content
        // only via a second explicit fetch. Only a real, successful, non-abstained reply goes
        // through this: an error message or an honest abstention notice is not "content" to
        // compress or speak as if it were an answer.
        const isRealAnswer = !data.error && data.engine?.abstained !== true && finalContent.trim().length > 0;
        if (isRealAnswer) {
          void (async () => {
            if (shouldAttemptHandleMode(finalContent)) {
              try {
                const mintRes = await window.amplify.crystal.mint([finalContent]);
                if (mintRes.ok && mintRes.sid) {
                  const lines = buildCelpane(finalContent);
                  setMessages((prev) => {
                    const next = prev.map((m) => (m.id === id ? {
                      ...m,
                      celpane: { mode: 'handle' as const, handle: mintRes.sid, lines, fullContent: finalContent, fullRevealed: false },
                    } : m));
                    saveHistory(next);
                    return next;
                  });
                  speakAloud(lines.join('. '));
                  return;
                }
                console.warn('[LeanAskTab] crystal.mint returned ok:false or no sid for this reply -- degrading to transparent mode:', mintRes.error);
              } catch (err) {
                console.warn('[LeanAskTab] crystal.mint threw for this reply -- degrading to transparent mode:', err);
              }
            }
            // Transparent mode: either the estimate said the prose already wins, or minting
            // was attempted and failed/produced no handle ("no handle produced" -> transparent,
            // per this ticket's explicit instruction). Prose renders/speaks directly; there is
            // no further fetch because nothing was ever minted for this reply.
            setMessages((prev) => {
              const next = prev.map((m) => (m.id === id ? {
                ...m,
                celpane: { mode: 'transparent' as const, fullContent: finalContent, fullRevealed: true },
              } : m));
              saveHistory(next);
              return next;
            });
            speakAloud(finalContent);
          })();
        }

        // v0.4.1: check upgrade suggestion on Pinch Ask (inline footer, NOT popup)
        // Only suggest when salt level is pinch and answer was successfully returned
        if (saltLevel === 'pinch' && !data.error) {
          const bmv = (data as Record<string, unknown>).bmv as number | undefined;
          const question = lastUserQuestionRef.current;
          const suggestion = classifyForUpgrade(question, bmv ?? 85);
          if (suggestion.show) {
            setUpgradeSuggestion(suggestion);
          }
        }
      });
    }

    // BP138 Yoke 0.9.15 FIX 4: Research Arm + Browser Session raw-fact path -- FLAG-GUARDED,
    // ADDITIVE, checked BEFORE the existing local-Ollama call below. When
    // researchArmMode/researchArmBrowserAuthority are OFF (the default), loadNexusAuthoritySettings()
    // returns both false, this whole `if` is skipped, and every line from here down runs
    // EXACTLY as it did before this Yoke -- byte-unchanged for that (default) case, provable by
    // this single guard.
    //
    // When both flags are ON: nexusAskLookupFact() (main process) classifies the question via
    // the SAME classifyAnswerType() plow_mc_answerer.ts already uses; only a genuine
    // 'lookup_fact' question ever attempts a browser-authority call. On a real hit, this answers
    // directly from the user's own logged-in Google/Perplexity session with a visible,
    // clickable source link (KN-BP143-3 D5: now the engine-view's `nexus:authority` badge,
    // which absorbed the old inline provenance render that used to live in MsgBubble) --
    // the local-Ollama call below never fires for that question. On anything else (not
    // lookup_fact, flags say on but the browser authority genuinely returned nothing usable,
    // or the IPC call itself throws), this falls through HONESTLY to the exact same
    // local-Ollama path below -- never a fabricated answer, never a fake source.
    const nexusSettings = loadNexusAuthoritySettings();
    if (nexusSettings.researchArmMode && nexusSettings.researchArmBrowserAuthority && window.amplify?.nexusAskLookupFact) {
      try {
        const lookup = await window.amplify.nexusAskLookupFact(text);
        if (lookup?.usable && lookup.fact && lookup.sourceUrl && lookup.authority) {
          const fact = lookup.fact;
          // KN-BP143-3 D5: real nexus short-circuit result -> engine.nexus (absorbs the old
          // standalone `provenance` field on ChatMessage; also carries confidence, which the
          // old field never had).
          const nexus: AskEngineState['nexus'] = { authority: lookup.authority, sourceUrl: lookup.sourceUrl, confidence: lookup.confidence };
          setMessages((prev) => {
            const next = prev.map((m) => m.id === aiId ? { ...m, content: fact, engine: { ...m.engine, nexus } } : m);
            saveHistory(next);
            return next;
          });
          clearStream();
          setThinking(false);
          textareaRef.current?.focus();
          return;
        }
        // Honest fallthrough -- not a lookup_fact question, flag_off (shouldn't happen given
        // the outer check, but defense in depth), or the browser authority returned nothing
        // usable. Proceed to the local-Ollama path below exactly as if this block never ran.
        //
        // BP139: `lookup.reason` now distinguishes these three cases (see preload.ts's
        // nexusAskLookupFact contract). Diagnostic-only -- a console.debug breadcrumb, never a
        // user-facing change -- so future diagnosis of a "no source" answer never has to guess
        // again whether it was "not lookup_fact" vs "authority genuinely returned nothing".
        console.debug('[LeanAskTab] nexusAskLookupFact not usable:', lookup?.reason ?? '(no reason field)');
      } catch (err) {
        console.warn('[LeanAskTab] nexusAskLookupFact threw (non-fatal, falling through to local Ollama):', err);
      }
    }

    // D-BP148-024/BISHOP (Ask Tab Ladder Wiring), SUPERSEDING the KN-BP144-8 Phase 1 note this
    // replaces: the Ask tab previously called ai-dispatch:query-engine directly -- always-local,
    // NO escalation, and a real abstain from canonical_pipeline.ts rendered as an EMPTY bubble
    // (content: '' with no further attempt). A correctly-shaped escalation ladder already existed
    // on the SEPARATE ai-dispatch:query channel (BP145-M4 Slice 2: TIER 1 local honest-abstain ->
    // TIER 2 deterministic solver, honestly skipped -> TIER 3 cheap cloud -> TIER 4 flagship,
    // triggered by a real `abstained` field, never a timer) but no renderer file called it, so it
    // was dead code. TIER 1 of that ladder IS canonical_pipeline.ts's runCanonicalFreeTextQuestion
    // -- the SAME engine query-engine called directly, so this is not a behavior regression for a
    // genuine local abstain; the real gain is TIER 0 (answer-cache exact-match serve, checked
    // before TIER 1) and TIER 1 now preferring the stronger llama3.3:70b over the settings/floor
    // model (D-BP148-022) when no explicit model pick exists, plus the ladder framework being in
    // place at all so a real abstain climbs instead of dying once paid escalation is enabled.
    //
    // MONEY CONSTRAINT (not optional, see D-BP148-024 ticket): TIER 3/4 are real paid Anthropic
    // calls, and the Founder's budget is frozen until 2026-09-02. ai_dispatch_ipc.ts's
    // isPaidEscalationEnabled() gate (checked server-side, main-process-only, cannot be bypassed
    // from here) requires BOTH an explicit settings opt-in AND a real configured Anthropic
    // credential before TIER 3/4 -- or the pre-existing explicit-flagship-brain-pick branch this
    // same channel also reaches -- are ever allowed to fire. Neither is wired to any settings UI
    // yet (out of this ticket's scope), so today this always, honestly, stops at the free TIER 1
    // rung and reports an abstain via the SAME `data.engine.abstained` surface a genuine local
    // abstain already uses (see onAskTokenComplete above) -- this file never has to know or care
    // which of "local model abstained" vs "paid tier declined" happened; both render identically,
    // honestly, as an abstention, never a fabricated answer and never a silently empty bubble.
    //
    // KNOWN SCOPE LIMIT (reported honestly, not silently): same as before this ticket -- the
    // engine takes a single free-text question, not this tab's multi-turn message history;
    // `messages` below carries only the current turn. Every question is answered fresh, exactly
    // as the benchmark harness itself answers each question fresh.
    if (!window.amplify?.aiDispatch?.query) {
      updateMsgAndSave(aiId, '⚠ Preload bridge missing (ai-dispatch:query) · reinstall MnemosyneC.');
      clearStream();
      setThinking(false);
      textareaRef.current?.focus();
      return;
    }

    try {
      const result = await window.amplify.aiDispatch.query({
        court_member: 'ask_tab',
        messages: [{ role: 'user', content: text }],
      });

      if (!result?.ok) {
        // Pre-stream error — no events will fire; handle synchronously
        const errMsg = result?.error ?? 'Unknown error from the local AI runtime.';
        const displayMsg = errMsg.includes('No compatible model') || errMsg.includes('not reachable')
          ? '⚠ Your local AI runtime is still setting up. Check the Home tab.'
          : `⚠ Ask threw: ${errMsg}. See Diagnostic.`;
        updateMsgAndSave(aiId, displayMsg);
        clearStream();
        setThinking(false);
        textareaRef.current?.focus();
      }
      // If result.streaming === true: ask-engine-progress / ask-token-complete events drive
      // the rest — do NOT call setThinking(false) here.

    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      updateMsgAndSave(aiId, `⚠ Ask threw: ${errMsg}. See Diagnostic.`);
      console.warn('[LeanAskTab] aiDispatch.query threw:', e);
      clearStream();
      setThinking(false);
      textareaRef.current?.focus();
    }
  }, [input, thinking, appendMsg, updateMsgInMemory, updateMsgAndSave, updateMsgEngine, clearStream, sendPrompt, handshakeSoundEnabled]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 4px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f0fdf4', flex: 1, minWidth: 120 }}>
            Ask A Question
          </h2>
          {/* KN-BP143-3 D5: old global self-context + answer-cache header badges removed --
              now rendered per-message via AskEngineView (see MsgBubble above). */}
          {/* BP132 Yoke #21 C6: Brain-swap toggle -- surfaces + controls which cognitive
              core actually answers (previously invisible; brain_registry.json defaults
              to a flagship brain_id even though every Ask silently ran on Gemma before C5). */}
          <button
            type="button"
            onClick={() => {
              setShowBrainSelector((v) => {
                if (v) refreshActiveBrainLabel();
                return !v;
              });
            }}
            title="Choose which cognitive core answers your questions"
            style={{
              background: 'none',
              border: `1px solid ${activeBrainLabel?.kind === 'flagship' ? '#818cf8' : '#334155'}`,
              borderRadius: 5,
              color: activeBrainLabel?.kind === 'flagship' ? '#c7d2fe' : '#94a3b8',
              fontSize: 11,
              padding: '3px 9px',
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
              outline: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            🧠 {activeBrainLabel ? activeBrainLabel.modelId : MODEL} {showBrainSelector ? '▲' : '▼'}
          </button>
          {/* v0.1.62: Clear + Save & Clear buttons */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleClear}
              disabled={messages.length === 0}
              aria-label={`Clear ${messages.length} messages`}
              title="Clear all messages"
              style={{
                background: 'none',
                border: '1px solid #334155',
                borderRadius: 5,
                color: messages.length === 0 ? '#334155' : '#94a3b8',
                fontSize: 11,
                padding: '3px 9px',
                cursor: messages.length === 0 ? 'default' : 'pointer',
                opacity: messages.length === 0 ? 0.4 : 1,
                fontFamily: 'system-ui, sans-serif',
                outline: 'none',
                transition: 'background 0.12s, color 0.12s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (messages.length > 0) (e.currentTarget as HTMLButtonElement).style.background = '#1e2a38'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            >
              🧹 Clear
            </button>
            <button
              type="button"
              onClick={handleSaveAndClear}
              disabled={messages.length === 0}
              aria-label={`Save and clear ${messages.length} messages`}
              title="Save conversation to a file, then clear"
              style={{
                background: 'none',
                border: '1px solid #334155',
                borderRadius: 5,
                color: messages.length === 0 ? '#334155' : '#94a3b8',
                fontSize: 11,
                padding: '3px 9px',
                cursor: messages.length === 0 ? 'default' : 'pointer',
                opacity: messages.length === 0 ? 0.4 : 1,
                fontFamily: 'system-ui, sans-serif',
                outline: 'none',
                transition: 'background 0.12s, color 0.12s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (messages.length > 0) (e.currentTarget as HTMLButtonElement).style.background = '#1e2a38'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            >
              💾 Save &amp; Clear
            </button>
          </div>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#475569' }}>
          {activeBrainLabel?.kind === 'flagship'
            ? `Powered by ${activeBrainLabel.id} (cloud flagship brain -- your message leaves this machine).`
            : `Powered by ${activeBrainLabel ? activeBrainLabel.modelId : MODEL} running on your own computer. Free and private by default.`}
        </p>
        {showBrainSelector && (
          <div style={{ marginTop: 8 }}>
            <BrainSwapSelector />
          </div>
        )}
        {/* Toast feedback pill */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginTop: 6,
              background: '#064e3b',
              border: '1px solid #059669',
              borderRadius: 5,
              padding: '5px 10px',
              fontSize: 11,
              color: '#6ee7b7',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            {toast}
          </div>
        )}
      </div>

      {/* SEG-2: Full-screen pull progress UI when gemma4:12b is missing */}
      {modelMissing && !checkFailed && showPullProgress && (
        <ModelPullProgress
          onComplete={() => {
            setShowPullProgress(false);
            setModelMissing(false);
            void runCheck();
          }}
          onSkip={() => {
            setShowPullProgress(false);
          }}
        />
      )}

      {/* Model-missing banner (fallback when pull UI is dismissed / Ollama not reachable) */}
      {modelMissing && !checkFailed && !showPullProgress && (
        <div style={{
          margin: '8px 16px 0',
          background: '#1c1200',
          border: '1px solid #3d2e00',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 12,
          color: '#fbbf24',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ flex: 1 }}>Your AI model is still setting up. Usually 2–5 minutes.</span>
          <button
            onClick={() => setShowPullProgress(true)}
            style={{
              background: 'none',
              border: '1px solid #f59e0b',
              borderRadius: 4,
              color: '#fbbf24',
              fontSize: 11,
              padding: '2px 8px',
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Download now
          </button>
          <button
            onClick={() => { void runCheck(); }}
            disabled={retrying}
            style={{
              background: 'none',
              border: '1px solid #f59e0b',
              borderRadius: 4,
              color: '#fbbf24',
              fontSize: 11,
              padding: '2px 8px',
              cursor: retrying ? 'wait' : 'pointer',
              outline: 'none',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {retrying ? '…' : 'Retry ↺'}
          </button>
        </div>
      )}

      {/* Check-failed banner (Ollama not reachable) */}
      {checkFailed && (
        <div style={{
          margin: '8px 16px 0',
          background: '#1a0a0a',
          border: '1px solid #4a1515',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 12,
          color: '#f87171',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <span style={{ flex: 1 }}>Could not reach your local AI. Is Ollama running?</span>
          <button
            onClick={() => { void runCheck(); }}
            disabled={retrying}
            style={{
              background: 'none',
              border: '1px solid #ef4444',
              borderRadius: 4,
              color: '#f87171',
              fontSize: 11,
              padding: '2px 8px',
              cursor: retrying ? 'wait' : 'pointer',
              outline: 'none',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {retrying ? '…' : 'Retry ↺'}
          </button>
          {onSwitchToHome && (
            <button
              onClick={onSwitchToHome}
              style={{
                background: 'none',
                border: '1px solid #334155',
                borderRadius: 4,
                color: '#94a3b8',
                fontSize: 11,
                padding: '2px 8px',
                cursor: 'pointer',
                outline: 'none',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              Open Home tab →
            </button>
          )}
        </div>
      )}

      {/* Message history */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
      }}>
        {messages.length === 0 && !modelMissing && !checkFailed && (
          <div style={{
            textAlign: 'center',
            color: '#475569',
            fontSize: 13,
            marginTop: 48,
          }}>
            Ask anything. Your AI is private and local.
          </div>
        )}
        {messages.map((m) => <MsgBubble key={m.id} msg={m} onRevealFullContent={handleRevealFullContent} />)}
        <div ref={bottomRef} />
      </div>

      {/* v0.4.1: Inline upgrade suggestion footer (NOT a popup — per BP078 every-click-feedback) */}
      {upgradeSuggestion?.show && (
        <div
          role="note"
          style={{
            margin: '0 16px 4px',
            background: 'rgba(99,102,241,0.07)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 12,
            color: '#94a3b8',
            lineHeight: 1.6,
            flexShrink: 0,
          }}
        >
          <div style={{ marginBottom: 8, color: '#a5b4fc', fontWeight: 600 }}>
            💡 This question may benefit from the cooperative-class network.
            {upgradeSuggestion.reason === 'low_bmv' && upgradeSuggestion.bmv !== undefined && (
              <span style={{ color: '#64748b', fontWeight: 400 }}> (BMV: {upgradeSuggestion.bmv.toFixed(0)})</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleUpgrade('seasoning')}
              style={{
                background: 'rgba(134,239,172,0.1)',
                border: '1px solid rgba(134,239,172,0.3)',
                borderRadius: 6,
                color: '#86efac',
                fontSize: 11,
                padding: '5px 10px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            >
              🌿 Ask + Linger (24h · Constellation keeps working) — free
            </button>
            <button
              type="button"
              onClick={() => handleUpgrade('preserved_open')}
              style={{
                background: 'rgba(110,231,183,0.08)',
                border: '1px solid rgba(110,231,183,0.3)',
                borderRadius: 6,
                color: '#6ee7b7',
                fontSize: 11,
                padding: '5px 10px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            >
              🫙 Post as Diagnosis (open until answered · optional bounty) — free or add Marks for glow
            </button>
            <button
              type="button"
              onClick={() => setUpgradeSuggestion(null)}
              style={{
                background: 'none',
                border: '1px solid rgba(100,116,139,0.2)',
                borderRadius: 6,
                color: '#475569',
                fontSize: 11,
                padding: '5px 8px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* v0.4.1: Salt Level selector + Input row */}
      <div style={{ padding: '4px 12px 0', flexShrink: 0 }}>
        <SaltLevelSelector value={saltLevel} onChange={setSaltLevel} compact />
      </div>

      {/* Input row */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid #1e2a38',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
        flexShrink: 0,
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="Type a question and press Enter…"
          // BP-UX-fix (queue-while-busy): the textarea must NEVER be disabled -- the Founder
          // can always type/paste the next question and edit freely while the current answer
          // streams back. Only the Send button gates on `thinking` (below); disabling it here
          // used to lock the whole box for the full 8-15s "Thinking..." window (and on every
          // boot/clear cycle before the first answer), which is the bug this fixes.
          rows={1}
          style={{
            flex: 1,
            background: '#111827',
            border: `1px solid ${inputFocused ? '#10b981' : '#1e2a38'}`,
            borderRadius: 6,
            color: '#f0fdf4',
            // BP-UX-fix: explicit caret-color so the blinking text cursor is always visible
            // against the dark input background, instead of relying on an inherited default.
            caretColor: '#6ee7b7',
            fontSize: 13,
            padding: '8px 10px',
            resize: 'none',
            fontFamily: 'system-ui, sans-serif',
            outline: 'none',
            // BP-UX-fix: outline was suppressed with no replacement, so a focused-but-empty
            // field gave zero visual "this is active" feedback. Replace it with a visible
            // focus ring (glow) that appears the moment the field is focused, before typing.
            boxShadow: inputFocused ? '0 0 0 2px rgba(16,185,129,0.35)' : 'none',
            transition: 'border-color 0.12s, box-shadow 0.12s',
            overflowY: 'auto',
            maxHeight: 100,
            lineHeight: 1.4,
          }}
        />
        <button
          onClick={handleSend}
          disabled={thinking || !input.trim()}
          style={{
            background: thinking || !input.trim() ? '#1e2a38' : '#10b981',
            color: thinking || !input.trim() ? '#475569' : '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 700,
            cursor: thinking || !input.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'system-ui, sans-serif',
            outline: 'none',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          {thinking ? 'Thinking…' : 'Send'}
        </button>
      </div>

      {/* Membership CTA — pinned bottom, never dismissible */}
      <MembershipBanner />
    </div>
  );
}
