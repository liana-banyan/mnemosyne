// MnemosyneC · v0.1.51 · BP080 · 2026-06-11
// §2 Truth-Always · §3 Sonnet 4.6 · Founder-ratified DRAFT
//
// LeanHomeTab — Home tab for the 3-tab LeanShell.
// Proof table values sourced verbatim from:
//   librarian-mcp/r10_cross_vendor/results/CADRE_BENCHMARK_RESULTS_BP067.md
//   Big-4 Baseline, BP063 · 2026-05-30 · Haiku-graded · kappa=0.936

import React, { useState } from 'react';

interface LeanHomeTabProps {
  onSwitchTab: (tab: 'home' | 'gauntlet' | 'ask') => void;
}

// ─── Benchmark data (Truth-Always: sourced from CADRE_BENCHMARK_RESULTS_BP067.md) ──

const PROOF_TABLE = [
  { model: 'Claude Opus 4.8',  without: '6.0%',  with: '89.3%', lift: '+83.3pp' },
  { model: 'GPT-5.5',          without: '19.3%', with: '93.3%', lift: '+74.0pp' },
  { model: 'Gemini 3.5 Flash', without: '8.0%',  with: '90.7%', lift: '+82.7pp' },
  { model: 'Llama 3.1 8b',     without: '6.0%',  with: '78.0%', lift: '+72.0pp' },
];

// ─── Six Pillars card (verbatim Founder copy — Yoke addendum A1.2) ──────────

const SIX_PILLARS = [
  {
    label: 'Good',
    detail: 'Every AI we tested got smarter on a shared memory: +72 to +83 points of accuracy across four model families. A free, local model jumped from 6% to 78%. ✔',
  },
  {
    label: 'Fast',
    detail: 'Answers resolve against your own memory in milliseconds. A hash-verified mesh measured 16.6 ms median instead of a metered round-trip to someone else\'s server. ✔',
  },
  {
    label: 'Cheap',
    detail: 'That free local model answers at $0 a call. Everything else runs at cost plus 20%, on hardware you already own. No new data center. ✔',
  },
  {
    label: 'Private',
    detail: 'Runs entirely on your machine. No account, no upload, no telemetry, no phone-home. ✔',
  },
  {
    label: 'Free',
    detail: 'SSPL Free Forever, Pledge #2260. No ads. No strings. No subscription. Patent-pending, 21 provisional filings, pledged to the member commons, never sold for extraction. ✔',
  },
  {
    label: 'Yours',
    detail: 'Storm-proof immutability. Three infrastructure failures hit at once. The substrate held. Every fact is sha256-stamped, content-addressed, append-only. Nothing can be overwritten. Uninstall anytime; your originals are untouched and independently verifiable. ✔',
  },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  container: {
    height: '100%',
    overflowY: 'auto' as const,
    padding: '32px 24px 48px',
    maxWidth: 760,
    margin: '0 auto',
  },
  hero: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
    gap: 12,
    marginBottom: 32,
  },
  h1First: {
    fontSize: 28,
    fontWeight: 700,
    color: '#f8fafc',
    margin: 0,
    lineHeight: 1.25,
  },
  h1Second: {
    fontSize: 28,
    fontWeight: 700,
    color: '#6ee7b7',
    margin: 0,
    lineHeight: 1.25,
  },
  subhead: {
    fontSize: 14,
    color: '#94a3b8',
    margin: 0,
    lineHeight: 1.6,
    maxWidth: 520,
  },
  tableSection: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    marginBottom: 10,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
  },
  th: {
    textAlign: 'left' as const,
    padding: '8px 12px',
    background: '#111827',
    color: '#6ee7b7',
    fontWeight: 700,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    borderBottom: '1px solid #1e2a38',
  },
  td: {
    padding: '9px 12px',
    color: '#cbd5e1',
    borderBottom: '1px solid #1a2332',
    fontSize: 13,
  },
  tdLift: {
    padding: '9px 12px',
    color: '#6ee7b7',
    borderBottom: '1px solid #1a2332',
    fontSize: 13,
    fontWeight: 600,
  },
  tableNote: {
    fontSize: 11,
    color: '#475569',
    marginTop: 8,
    lineHeight: 1.6,
  },
  ctaButton: {
    display: 'inline-block',
    padding: '12px 28px',
    background: 'linear-gradient(135deg, #059669, #10b981)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 8,
    marginBottom: 32,
    outline: 'none',
    transition: 'opacity 0.15s',
    fontFamily: 'system-ui, sans-serif',
  },
  pillarsTitle: {
    fontSize: 17,
    fontWeight: 700,
    marginBottom: 4,
  },
  pillarsSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
  },
  pillarRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start' as const,
  },
  pillarLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#6ee7b7',
    width: 54,
    flexShrink: 0,
    paddingTop: 2,
  },
  pillarDetail: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 1.55,
  },
};

// ─── SixPillarsFlipCard ───────────────────────────────────────────────────────

const CARD_HEIGHT = 520;

function SixPillarsFlipCard() {
  const [flipped, setFlipped] = useState(false);
  const [frontFlipActive, setFrontFlipActive] = useState(false);
  const [backFlipActive, setBackFlipActive] = useState(false);
  const [proveActive, setProveActive] = useState(false);

  const faceBase: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    borderRadius: 10,
    boxSizing: 'border-box',
    overflowY: 'auto',
  };

  const flipBtnStyle = (active: boolean): React.CSSProperties => ({
    position: 'absolute',
    bottom: 12,
    right: 12,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    color: '#6ee7b7',
    padding: '4px 6px',
    borderRadius: 4,
    lineHeight: 1,
    fontFamily: 'system-ui, sans-serif',
    outline: 'none',
    opacity: active ? 0.4 : 0.75,
    transform: active ? 'scale(0.88)' : 'scale(1)',
    transition: 'opacity 0.12s, transform 0.12s',
  });

  return (
    <div
      style={{
        perspective: '800px',
        height: CARD_HEIGHT,
        marginBottom: 32,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.45s ease',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ── Front face ── */}
        <div
          style={{
            ...faceBase,
            background: '#0d1117',
            border: '1px solid #1e2a38',
            padding: '20px 20px 12px',
          }}
        >
          <p style={s.pillarsTitle}>Good. Fast. Cheap.</p>
          <p style={s.pillarsSub}>MnemosyneC gives you all six. Can't we all just get along?</p>
          {SIX_PILLARS.map((p) => (
            <div key={p.label} style={s.pillarRow}>
              <span style={s.pillarLabel}>{p.label}</span>
              <span style={s.pillarDetail}>{p.detail}</span>
            </div>
          ))}
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                color: '#6ee7b7',
                textDecoration: 'underline',
                padding: 0,
                fontFamily: 'system-ui, sans-serif',
                outline: 'none',
                opacity: proveActive ? 0.45 : 0.7,
                transform: proveActive ? 'scale(0.97)' : 'scale(1)',
                transition: 'opacity 0.12s, transform 0.12s',
              }}
              onClick={() => setFlipped(true)}
              onMouseDown={() => setProveActive(true)}
              onMouseUp={() => setProveActive(false)}
              onMouseLeave={() => setProveActive(false)}
            >
              Every figure is reproducible — Prove It · Run your own cabinet
            </button>
          </div>
          <button
            style={flipBtnStyle(frontFlipActive)}
            aria-label="Flip card"
            onClick={() => setFlipped(true)}
            onMouseDown={() => setFrontFlipActive(true)}
            onMouseUp={() => setFrontFlipActive(false)}
            onMouseLeave={() => setFrontFlipActive(false)}
          >
            ↻
          </button>
        </div>

        {/* ── Back face ── */}
        <div
          style={{
            ...faceBase,
            background: '#0a0f1a',
            border: '1px solid #6ee7b7',
            padding: '20px 20px 16px',
            transform: 'rotateY(180deg)',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 700, color: '#6ee7b7', margin: '0 0 12px', lineHeight: 1.4 }}>
            Prove It — How to verify every figure yourself
          </p>
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 10px' }}>
              <span style={{ color: '#6ee7b7' }}>✓ Benchmark data:</span>{' '}
              CADRE_BENCHMARK_RESULTS_BP067.md<br />
              75 questions · 4 vendors · 2026-05-30<br />
              Cohen's kappa 0.936 (grader agreement)<br />
              Hash-verified — all 20/20 mesh rounds matched
            </p>
            <p style={{ margin: '0 0 10px' }}>
              <span style={{ color: '#6ee7b7' }}>✓ Run your own cabinet:</span><br />
              1. Install MnemosyneC (free)<br />
              2. Open Gauntlet tab → Run Test<br />
              3. Results appear live — your machine, your numbers
            </p>
            <p style={{ margin: '0 0 10px' }}>
              <span style={{ color: '#6ee7b7' }}>✓ Source:</span>{' '}
              Asteroid-ProofVault/BP067_MARATHON_COMPLETION_RECEIPT.md<br />
              pearl_241641f4 · SID 3ed52d5f
            </p>
            <p style={{ margin: 0 }}>
              All figures are sha256-stamped, content-addressed, append-only.<br />
              Nothing can be overwritten. Independently verifiable.
            </p>
          </div>
          <button
            style={flipBtnStyle(backFlipActive)}
            aria-label="Flip card back"
            onClick={() => setFlipped(false)}
            onMouseDown={() => setBackFlipActive(true)}
            onMouseUp={() => setBackFlipActive(false)}
            onMouseLeave={() => setBackFlipActive(false)}
          >
            ↻
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LeanHomeTab({ onSwitchTab }: LeanHomeTabProps) {
  const [ctaLabel, setCtaLabel] = useState('See it work yourself →');

  const handleCta = () => {
    setCtaLabel('Opening Gauntlet…');
    setTimeout(() => {
      onSwitchTab('gauntlet');
      setCtaLabel('See it work yourself →');
    }, 300);
  };

  return (
    <div style={s.container}>
      {/* ── Hero section ───────────────────────────────────────────────── */}
      <div style={s.hero}>
        <img
          src="icons/mnemosynec-mark.png"
          alt="Dr. MnemosyneC"
          style={{ width: 96, height: 96 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div>
          <p style={s.h1First}>Your AI has Amnesia.</p>
          <p style={s.h1Second}>Dr. MnemosyneC has the Cure.</p>
        </div>
        <p style={s.subhead}>
          Every AI forgets everything when you start a new session.<br />
          MnemosyneC gives it a permanent, private memory that stays.
        </p>
      </div>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <button
          style={s.ctaButton}
          onClick={handleCta}
          onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.opacity = '0.88'; }}
          onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.opacity = '1'; }}
        >
          {ctaLabel}
        </button>
      </div>

      {/* ── Proof table ────────────────────────────────────────────────── */}
      <div style={s.tableSection}>
        <p style={s.sectionLabel}>Does it work? Proof.</p>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>AI Model</th>
              <th style={s.th}>WITHOUT MnemosyneC</th>
              <th style={s.th}>WITH MnemosyneC</th>
              <th style={s.th}>Lift</th>
            </tr>
          </thead>
          <tbody>
            {PROOF_TABLE.map((row) => (
              <tr key={row.model}>
                <td style={s.td}>{row.model}</td>
                <td style={{ ...s.td, color: '#ef4444' }}>{row.without}</td>
                <td style={{ ...s.td, color: '#22c55e', fontWeight: 600 }}>{row.with}</td>
                <td style={s.tdLift}>{row.lift}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={s.tableNote}>
          The Banyan Metric™ measures memory accuracy: does the AI recall facts from a prior session?
          All data stays on your computer. Cohen's kappa 0.936 (grader agreement). 75 questions · 4 vendors · 2026-05-30.
        </p>
      </div>

      {/* ── Six Pillars flip card ─────────────────────────────────────────── */}
      <SixPillarsFlipCard />
    </div>
  );
}
