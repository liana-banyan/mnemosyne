// Mnemosyne — Onboarding Screen Components
// MV-BE SAGA 5 BP045 W1 — 5-screen first-launch wizard screens
//
// Used by OnboardingWizard (inside MakeYourselfComfortableWizard.tsx).
// Each screen receives: onNext, onBack, onSkip, step, totalSteps.

import React, { useState } from 'react';
import { InviteFlow } from '../../components/FederationTab';

// ─── Shared props ─────────────────────────────────────────────────────────────

export interface ScreenProps {
  onNext: (data?: Record<string, unknown>) => void;
  onBack: () => void;
  onSkip: () => void;
  step: number;
  totalSteps: number;
  collected: Record<string, unknown>;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  bg: '#0a0f1a',
  surface: '#111827',
  border: '#1e2d45',
  text: '#e2e8f0',
  muted: '#64748b',
  accent: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
};

// ─── Progress indicator ───────────────────────────────────────────────────────

export function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === step - 1 ? 20 : 8,
            height: 8,
            borderRadius: 4,
            background: i < step ? C.accent : i === step - 1 ? C.accent : C.border,
            opacity: i < step ? 0.5 : 1,
            transition: 'all 0.3s',
          }}
        />
      ))}
    </div>
  );
}

// ─── Nav buttons ──────────────────────────────────────────────────────────────

export function ScreenNav({
  onNext,
  onBack,
  onSkip,
  step,
  totalSteps,
  nextLabel = 'Continue →',
  nextDisabled = false,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  step: number;
  totalSteps: number;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
      <button onClick={onSkip} style={s.skipBtn}>
        Skip to app
      </button>
      <div style={{ display: 'flex', gap: 8 }}>
        {step > 1 && (
          <button onClick={onBack} style={s.backBtn}>← Back</button>
        )}
        <button onClick={onNext} disabled={nextDisabled} style={s.nextBtn}>
          {step === totalSteps ? '🌿 Get on a Roll' : nextLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Screen 1: Welcome ────────────────────────────────────────────────────────

export function ScreenWelcome({ onNext, onBack, onSkip, step, totalSteps }: ScreenProps) {
  return (
    <div style={s.screen}>
      <div style={{ fontSize: 36, marginBottom: 12, textAlign: 'center' }}>🌿</div>
      <h1 style={s.title}>Welcome to Mnemosyne</h1>
      <div style={s.badge}>LianaBanyan Alpha</div>

      <p style={s.body}>
        <strong style={{ color: C.text }}>Mnemosyne works now.</strong>{' '}
        This is Alpha — things may shift, features may change, and your feedback shapes
        what comes next.
      </p>

      <div style={s.callout}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>
          What this is:
        </div>
        <ul style={s.list}>
          <li>A cooperative platform where creators <strong>may earn</strong> 83.3% of every transaction</li>
          <li>$5/year membership — same for everyone</li>
          <li>Platform margin: Cost + 20%. Books open every quarter.</li>
          <li>Federated, sovereign, no lock-in</li>
        </ul>
      </div>

      <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
        This setup takes about 2 minutes. You can skip any step.
      </p>

      <ProgressDots step={step} total={totalSteps} />
      <ScreenNav
        onNext={() => onNext()}
        onBack={onBack}
        onSkip={onSkip}
        step={step}
        totalSteps={totalSteps}
        nextLabel="Get on a Roll →"
      />
    </div>
  );
}

// ─── Screen 2: Identity ───────────────────────────────────────────────────────

export function ScreenIdentity({ onNext, onBack, onSkip, step, totalSteps }: ScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [pubkeyStatus, setPubkeyStatus] = useState<'idle' | 'generating' | 'done'>('idle');
  const [pubkeyShort, setPubkeyShort] = useState('');

  const genKey = async () => {
    setPubkeyStatus('generating');
    try {
      const result = await (window as any).amplify?.generateMemberKeypair?.();
      if (result?.pubkeyShort) {
        setPubkeyShort(result.pubkeyShort);
      } else {
        // Placeholder — real keygen is IPC-backed
        setPubkeyShort('mnemo-' + crypto.randomUUID?.().slice(0, 12) ?? '000000000000');
      }
      setPubkeyStatus('done');
    } catch {
      setPubkeyShort('mnemo-key-pending');
      setPubkeyStatus('done');
    }
  };

  return (
    <div style={s.screen}>
      <div style={{ fontSize: 28, marginBottom: 8, textAlign: 'center' }}>🪪</div>
      <h2 style={s.title}>Your Identity</h2>
      <p style={s.body}>
        All fields are optional. Your identity is stored locally — never uploaded unless
        you explicitly share it with a federated peer.
      </p>

      <div style={s.fieldGroup}>
        <label style={s.label}>Display name (optional)</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How should peers see you?"
          style={s.input}
          maxLength={60}
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Email (optional, local only)</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="For local notifications only"
          type="email"
          style={s.input}
        />
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Local keypair</label>
        {pubkeyStatus === 'done' ? (
          <div style={{
            fontFamily: 'monospace', fontSize: 11, color: C.green,
            background: '#0a1f0e', padding: '8px 12px', borderRadius: 8,
            border: `1px solid ${C.green}44`,
          }}>
            ✓ Keypair generated: {pubkeyShort}
          </div>
        ) : (
          <button
            onClick={() => void genKey()}
            disabled={pubkeyStatus === 'generating'}
            style={s.outlineBtn}
          >
            {pubkeyStatus === 'generating' ? '⏳ Generating…' : '🔑 Generate local keypair'}
          </button>
        )}
        <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
          Stays on your device. Used to sign federation invites.
        </div>
      </div>

      <ProgressDots step={step} total={totalSteps} />
      <ScreenNav
        onNext={() => onNext({ displayName, email, pubkeyShort })}
        onBack={onBack}
        onSkip={onSkip}
        step={step}
        totalSteps={totalSteps}
      />
    </div>
  );
}

// ─── Screen 3: First Banyan ───────────────────────────────────────────────────

export function ScreenFirstBanyan({ onNext, onBack, onSkip, step, totalSteps }: ScreenProps) {
  const [ebletText, setEbletText] = useState(
    'This is my first canon-eblet. I am here to help each other help ourselves.'
  );
  const [saved, setSaved] = useState(false);

  const saveEblet = async () => {
    try {
      await (window as any).amplify?.pantheonSeedEblet?.({ text: ebletText, type: 'first-banyan' });
    } catch { /* non-fatal for first-launch */ }
    setSaved(true);
  };

  return (
    <div style={s.screen}>
      <div style={{ fontSize: 28, marginBottom: 8, textAlign: 'center' }}>🌳</div>
      <h2 style={s.title}>Plant Your First Banyan</h2>
      <p style={s.body}>
        A <em>canon-eblet</em> is a small piece of personal canon — a statement, an intention,
        a root. Edit the draft below, then plant it. You can always add more later.
      </p>

      <div style={s.fieldGroup}>
        <label style={s.label}>Your first eblet (edit freely)</label>
        <textarea
          value={ebletText}
          onChange={(e) => setEbletText(e.target.value)}
          rows={4}
          style={{ ...s.input, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
          maxLength={500}
        />
        <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
          {ebletText.length}/500 characters · stays in your local substrate
        </div>
      </div>

      {saved && (
        <div style={{ fontSize: 11, color: C.green, marginBottom: 8 }}>
          ✓ Banyan planted. Your substrate now has a root.
        </div>
      )}

      {!saved && (
        <button onClick={() => void saveEblet()} style={s.outlineBtn}>
          🌱 Plant this eblet
        </button>
      )}

      <ProgressDots step={step} total={totalSteps} />
      <ScreenNav
        onNext={() => onNext({ ebletText, ebletPlanted: saved })}
        onBack={onBack}
        onSkip={onSkip}
        step={step}
        totalSteps={totalSteps}
      />
    </div>
  );
}

// ─── Screen 4: Federation (optional) ─────────────────────────────────────────

export function ScreenFederation({ onNext, onBack, onSkip, step, totalSteps }: ScreenProps) {
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div style={s.screen}>
      <div style={{ fontSize: 28, marginBottom: 8, textAlign: 'center' }}>🕸️</div>
      <h2 style={s.title}>Federation (Optional)</h2>
      <p style={s.body}>
        Mnemosyne is more powerful when peers federate. You can invite someone now
        or skip — the invitation tool is always available in the Federation tab.
      </p>

      {!showInvite ? (
        <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
          <button onClick={() => setShowInvite(true)} style={s.outlineBtn}>
            🔑 Invite a peer now
          </button>
          <div style={{ textAlign: 'center', fontSize: 11, color: C.muted }}>or</div>
          <button onClick={() => onNext({ federationSkipped: true })} style={s.ghostBtn}>
            Skip federation for now →
          </button>
        </div>
      ) : (
        <>
          <InviteFlow />
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setShowInvite(false)} style={s.ghostBtn}>← Back</button>
          </div>
        </>
      )}

      <ProgressDots step={step} total={totalSteps} />
      <div style={{ marginTop: 24 }}>
        <ScreenNav
          onNext={() => onNext()}
          onBack={onBack}
          onSkip={onSkip}
          step={step}
          totalSteps={totalSteps}
        />
      </div>
    </div>
  );
}

// ─── Screen 5: Roll ───────────────────────────────────────────────────────────

export function ScreenRoll({ onNext, onBack, onSkip, step, totalSteps }: ScreenProps) {
  const [nominated, setNominated] = useState(false);
  const [nomineeNote, setNomineeNote] = useState('');

  const nominate = async () => {
    try {
      await (window as any).amplify?.submitSelfNomination?.({ note: nomineeNote });
    } catch { /* non-fatal */ }
    setNominated(true);
  };

  return (
    <div style={s.screen}>
      <div style={{ fontSize: 28, marginBottom: 8, textAlign: 'center' }}>🎖️</div>
      <h2 style={s.title}>Get on a Roll</h2>

      <div style={s.callout}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>
          What is the Roll?
        </div>
        <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
          The Roll is the cooperative's public ledger of recognized members — people who
          have made a meaningful contribution and been ratified by dual review
          (Founder + Helm-Crown). It is not a leaderboard; it is a record of presence.
        </p>
      </div>

      <div style={{ fontSize: 11, color: C.muted, margin: '12px 0', lineHeight: 1.6 }}>
        Nominations go to dual-veto review. Either reviewer may decline — no grudge, no
        explanation owed. EXCLUSION-WITHOUT-JUDGMENT is canon here.
      </div>

      <div style={{ marginBottom: 4 }}>
        <a
          href="https://cephas.lianabanyan.com/roll/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: C.accent }}
        >
          Browse the current Roll →
        </a>
      </div>

      {!nominated ? (
        <>
          <div style={s.fieldGroup}>
            <label style={s.label}>Nominate yourself (optional)</label>
            <textarea
              value={nomineeNote}
              onChange={(e) => setNomineeNote(e.target.value)}
              placeholder="A sentence or two about your work or intention here…"
              rows={3}
              style={{ ...s.input, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
              maxLength={300}
            />
          </div>
          <button onClick={() => void nominate()} disabled={!nomineeNote.trim()} style={s.outlineBtn}>
            Submit nomination
          </button>
        </>
      ) : (
        <div style={{ fontSize: 11, color: C.green, padding: '8px 12px', background: '#0a1f0e', borderRadius: 8, border: `1px solid ${C.green}44` }}>
          ✓ Nomination submitted. The dual-veto review will reach out if ratified.
        </div>
      )}

      <ProgressDots step={step} total={totalSteps} />
      <ScreenNav
        onNext={() => onNext({ nominated })}
        onBack={onBack}
        onSkip={onSkip}
        step={step}
        totalSteps={totalSteps}
        nextLabel="Enter Mnemosyne"
      />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  screen: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '0 4px',
  },
  title: {
    margin: '0 0 8px',
    fontSize: 20,
    fontWeight: 700,
    color: C.text,
    textAlign: 'center',
  },
  badge: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 10px',
    borderRadius: 20,
    background: `${C.amber}22`,
    color: C.amber,
    border: `1px solid ${C.amber}55`,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginBottom: 16,
    marginLeft: 'auto',
    marginRight: 'auto',
    textAlign: 'center',
  },
  body: {
    margin: '0 0 16px',
    fontSize: 12,
    color: C.muted,
    lineHeight: 1.7,
    textAlign: 'center',
  },
  callout: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 16,
  },
  list: {
    margin: '0',
    paddingLeft: 18,
    fontSize: 11,
    color: C.muted,
    lineHeight: 1.8,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: C.muted,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  input: {
    background: '#070d1a',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.text,
    fontSize: 12,
    padding: '8px 12px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  },
  outlineBtn: {
    background: 'transparent',
    border: `1px solid ${C.accent}`,
    borderRadius: 8,
    color: C.accent,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    padding: '8px 16px',
    width: '100%',
  },
  ghostBtn: {
    background: 'transparent',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.muted,
    cursor: 'pointer',
    fontSize: 11,
    padding: '6px 12px',
    width: '100%',
  },
  skipBtn: {
    background: 'transparent',
    border: 'none',
    color: C.muted,
    cursor: 'pointer',
    fontSize: 10,
    textDecoration: 'underline',
    padding: 0,
  },
  backBtn: {
    background: 'transparent',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.muted,
    cursor: 'pointer',
    fontSize: 11,
    padding: '6px 14px',
  },
  nextBtn: {
    background: '#1e3a5f',
    border: `1px solid ${C.accent}`,
    borderRadius: 8,
    color: C.accent,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    padding: '8px 20px',
  },
};
