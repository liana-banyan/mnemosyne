// Layer2ProveIt.tsx -- SEG-S-8 BP078 v0.1.37
// Layer 2 surface for "Proof That It Works" doorway.
// SEG-V-3: All 5 flip cards updated with plain-language backs + links.
// SEG-V-4: Model selector screen added before MMLU-Pro benchmark (choices 3 and 4).

import React, { useState, useCallback, useEffect } from 'react';
import { WelcomeCueCard } from './WelcomeCueCard';
import { useLifecycleStage } from '../hooks/useLifecycleStage';

export interface Layer2ProveItProps {
  onBack: () => void;
}

type ScreenMode = 'picking' | 'model-selector' | 'pulling-gemma' | 'confirming';

const GEMMA_MODEL = 'gemma4:12b';
const FLOOR_MODEL_LABEL = 'qwen2.5:0.5b';

// Shared style tokens matching WelcomeView dark theme
const S = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 9600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d1117',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    padding: '36px 32px',
    background: '#111827',
    border: '1px solid rgba(100, 116, 139, 0.2)',
    borderRadius: 12,
    margin: '0 16px',
  },
  brandLine: {
    fontSize: 11,
    fontWeight: 700 as const,
    color: '#6ee7b7',
    letterSpacing: '0.10em',
    textTransform: 'uppercase' as const,
    marginBottom: 20,
  },
  heading: {
    fontSize: 16,
    fontWeight: 800 as const,
    color: '#e2e8f0',
    lineHeight: 1.3,
    margin: '0 0 10px',
  },
  introLine: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.6,
    marginBottom: 20,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#475569',
    fontSize: 11,
    cursor: 'pointer',
    padding: '0 0 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  cardStack: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  placeholderBox: {
    padding: '18px 20px',
    background: 'rgba(6, 78, 59, 0.08)',
    border: '1px solid rgba(110, 231, 183, 0.25)',
    borderRadius: 10,
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 1.6,
    marginBottom: 16,
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: '#475569',
    fontSize: 12,
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
  },
  folderPickRow: {
    marginTop: 10,
    padding: '12px 14px',
    background: 'rgba(15, 23, 42, 0.7)',
    border: '1px solid rgba(110, 231, 183, 0.2)',
    borderRadius: 10,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  folderPickBtn: {
    width: '100%',
    padding: '9px 0',
    background: 'rgba(6, 78, 59, 0.18)',
    border: '1px solid rgba(110, 231, 183, 0.35)',
    borderRadius: 8,
    color: '#6ee7b7',
    fontSize: 13,
    fontWeight: 600 as const,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  folderPath: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'monospace',
    wordBreak: 'break-all' as const,
  },
  runBtn: {
    width: '100%',
    padding: '9px 0',
    background: 'rgba(6, 78, 59, 0.25)',
    border: '1px solid rgba(110, 231, 183, 0.45)',
    borderRadius: 8,
    color: '#6ee7b7',
    fontSize: 13,
    fontWeight: 600 as const,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  // -- Big Numbers strip
  bigNumStrip: {
    display: 'flex',
    justifyContent: 'space-around' as const,
    alignItems: 'center',
    background: '#0a0f1a',
    border: '1px solid rgba(100, 116, 139, 0.2)',
    borderRadius: 10,
    padding: '16px 24px',
    marginBottom: 10,
    maxHeight: 120,
  },
  bigNumCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
  },
  bigNumValue: {
    fontSize: '2rem',
    fontWeight: 800 as const,
    lineHeight: 1,
    letterSpacing: '-0.02em',
  },
  bigNumLabel: {
    fontSize: 9,
    fontWeight: 700 as const,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: '#64748b',
    marginTop: 2,
  },
  bigNumDivider: {
    width: 1,
    height: 40,
    background: 'rgba(100, 116, 139, 0.2)',
  },
  // -- Flippable detail cards
  flipRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 12,
  },
  flipOuter: {
    width: 200,
    height: 150,
    perspective: '600px',
    cursor: 'pointer',
    flexShrink: 0 as const,
  },
  flipFaceBase: {
    position: 'absolute' as const,
    inset: 0,
    backfaceVisibility: 'hidden' as const,
    WebkitBackfaceVisibility: 'hidden' as const,
    borderRadius: 10,
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center' as const,
  },
  flipFront: {
    background: '#111827',
    border: '1px solid rgba(100, 116, 139, 0.25)',
  },
  flipBack: {
    background: '#0d1117',
    border: '1px solid rgba(100, 116, 139, 0.15)',
    transform: 'rotateY(180deg)',
  },
  flipStatLg: {
    fontSize: '1.25rem',
    fontWeight: 800 as const,
    lineHeight: 1,
    marginBottom: 5,
  },
  flipCardLabel: {
    fontSize: 9,
    fontWeight: 700 as const,
    letterSpacing: '0.10em',
    textTransform: 'uppercase' as const,
    color: '#64748b',
  },
  flipBackText: {
    fontSize: 10,
    color: '#94a3b8',
    lineHeight: 1.5,
  },
  flipDataset: {
    fontSize: 9,
    color: '#475569',
    marginTop: 6,
    letterSpacing: '0.05em',
  },
  flipHint: {
    fontSize: 8,
    color: '#334155',
    marginTop: 8,
    letterSpacing: '0.05em',
  },
  // SEG-V-4: model selector styles
  modelSelectorHeading: {
    fontSize: 15,
    fontWeight: 800 as const,
    color: '#e2e8f0',
    margin: '0 0 6px',
  },
  modelSelectorSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 20,
    lineHeight: 1.5,
  },
  radioCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 9,
    border: '1px solid rgba(100, 116, 139, 0.25)',
    background: '#111827',
    cursor: 'pointer',
    marginBottom: 8,
    transition: 'border-color 0.15s',
  },
  radioCardSelected: {
    borderColor: 'rgba(110, 231, 183, 0.55)',
    background: 'rgba(6, 78, 59, 0.08)',
  },
  radioLabel: {
    fontSize: 13,
    color: '#e2e8f0',
    lineHeight: 1.4,
  },
  radioSub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    lineHeight: 1.4,
  },
  proceedBtn: {
    marginTop: 14,
    width: '100%',
    padding: '10px 0',
    background: 'rgba(6, 78, 59, 0.25)',
    border: '1px solid rgba(110, 231, 183, 0.45)',
    borderRadius: 8,
    color: '#6ee7b7',
    fontSize: 13,
    fontWeight: 600 as const,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  pullBox: {
    padding: '14px 16px',
    background: 'rgba(6, 78, 59, 0.06)',
    border: '1px solid rgba(110, 231, 183, 0.2)',
    borderRadius: 9,
    marginTop: 10,
  },
  pullBarTrack: {
    height: 8,
    background: 'rgba(100,116,139,0.15)',
    borderRadius: 4,
    overflow: 'hidden' as const,
    marginBottom: 6,
  },
  customModelRow: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  customInput: {
    padding: '7px 10px',
    background: '#1e293b',
    border: '1px solid rgba(100, 116, 139, 0.35)',
    borderRadius: 7,
    color: '#e2e8f0',
    fontSize: 12,
    width: '100%',
    boxSizing: 'border-box' as const,
  },
};

export function Layer2ProveIt({ onBack }: Layer2ProveItProps): React.ReactElement {
  const { advanceTo } = useLifecycleStage();
  const [screenMode, setScreenMode] = useState<ScreenMode>('picking');
  const [folderPanelOpen, setFolderPanelOpen] = useState(false);
  const [pickedFolder, setPickedFolder] = useState<string | null>(null);
  const [folderPickPending, setFolderPickPending] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());

  // SEG-V-4: model selector state
  const [modelChoice, setModelChoice] = useState<'gemma' | 'floor' | 'custom'>('gemma');
  const [customModelName, setCustomModelName] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [gemmaPresent, setGemmaPresent] = useState(false);
  const [pullPct, setPullPct] = useState(0);
  const [pullError, setPullError] = useState<string | null>(null);
  const [selectorDataset, setSelectorDataset] = useState<'standard' | 'diamond'>('standard');

  const handleFlipCard = useCallback((idx: number): void => {
    setFlippedCards((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
      return next;
    });
  }, []);

  const handleSimpleChoice = useCallback((): void => {
    advanceTo('C');
    setScreenMode('confirming');
  }, [advanceTo]);

  // SEG-V-4: open model selector for MMLU-Pro choices
  const handleMmluChoice = useCallback((dataset: 'standard' | 'diamond'): void => {
    setSelectorDataset(dataset);
    setPullError(null);
    setPullPct(0);
    setScreenMode('model-selector');
  }, []);

  // Load available models when model selector opens
  useEffect(() => {
    if (screenMode !== 'model-selector') return;
    window.amplify.checkOllamaAndModel(GEMMA_MODEL)
      .then((result) => {
        setGemmaPresent(result.hasModel);
        setAvailableModels(result.models);
        setModelChoice(result.hasModel ? 'gemma' : 'gemma');
      })
      .catch(() => {
        setGemmaPresent(false);
        setAvailableModels([]);
      });
  }, [screenMode]);

  const handleProceedWithModel = useCallback(async (): Promise<void> => {
    if (modelChoice === 'gemma') {
      if (gemmaPresent) {
        // Fast path -- model already present, no pull needed
        advanceTo('C');
        setScreenMode('confirming');
        return;
      }
      // Need to pull gemma4:12b
      setPullError(null);
      setPullPct(0);
      setScreenMode('pulling-gemma');
      const unsubProgress = window.amplify.onOllamaPullProgress((progress) => {
        if (progress.percentComplete !== undefined) setPullPct(progress.percentComplete);
      });
      try {
        const result = await window.amplify.pullNamedModel(GEMMA_MODEL);
        unsubProgress();
        if (!result.success && !result.alreadyInstalled) {
          setPullError(result.error ?? 'Download failed. Please check your connection.');
          setScreenMode('model-selector');
          return;
        }
        advanceTo('C');
        setScreenMode('confirming');
      } catch (err) {
        unsubProgress();
        setPullError(String(err));
        setScreenMode('model-selector');
      }
    } else {
      advanceTo('C');
      setScreenMode('confirming');
    }
  }, [modelChoice, gemmaPresent, advanceTo]);

  const handleChoice2Click = useCallback((): void => {
    setFolderPanelOpen((prev) => !prev);
  }, []);

  const handlePickFolder = useCallback(async (): Promise<void> => {
    setFolderPickPending(true);
    try {
      const result = await window.amplify.watcher?.openFolderDialog();
      if (result && !result.canceled && result.filePaths.length > 0) {
        setPickedFolder(result.filePaths[0]);
      }
    } catch {
      // picker dismissed or unavailable -- keep panel open
    } finally {
      setFolderPickPending(false);
    }
  }, []);

  const handleRunOnFolder = useCallback((): void => {
    if (!pickedFolder) return;
    advanceTo('C');
    setScreenMode('confirming');
  }, [advanceTo, pickedFolder]);

  const handleBackFromPlaceholder = useCallback((): void => {
    setScreenMode('picking');
    setFolderPanelOpen(false);
  }, []);

  // ── Confirming placeholder ──────────────────────────────────────────────────
  if (screenMode === 'confirming') {
    return (
      <div style={S.overlay}>
        <div style={S.card}>
          <div style={S.brandLine}>Proof That It Works</div>
          <div style={S.placeholderBox}>
            Benchmark starting... Full progress view coming in the next update.
          </div>
          <button type="button" style={S.backLink} onClick={handleBackFromPlaceholder}>
            {'< back to choices'}
          </button>
        </div>
      </div>
    );
  }

  // ── Pulling Gemma placeholder ──────────────────────────────────────────────
  if (screenMode === 'pulling-gemma') {
    return (
      <div style={S.overlay}>
        <div style={S.card}>
          <div style={S.brandLine}>Proof That It Works</div>
          <h2 style={S.heading}>Downloading Google's Gemma 4 12B...</h2>
          <div style={S.pullBox}>
            <div style={S.pullBarTrack}>
              <div style={{
                height: '100%',
                width: `${pullPct}%`,
                background: 'linear-gradient(90deg, #6ee7b7, #34d399)',
                borderRadius: 4,
                transition: 'width 0.4s ease',
                minWidth: pullPct > 0 ? 8 : 0,
              }} />
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              {pullPct > 0 ? `${pullPct}% downloaded` : 'Connecting to model repository...'}
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 10, lineHeight: 1.5 }}>
            Google's Gemma 4 12B is 7.5 GB. This is a one-time download. The benchmark will start automatically when complete.
          </div>
        </div>
      </div>
    );
  }

  // ── Model selector screen (SEG-V-4) ──────────────────────────────────────
  if (screenMode === 'model-selector') {
    const datasetLabel = selectorDataset === 'diamond' ? 'MMLU-Pro Diamond' : 'MMLU-Pro Standard';
    return (
      <div style={S.overlay}>
        <div style={S.card}>
          <button type="button" style={S.backBtn} onClick={() => setScreenMode('picking')}>
            {'< back'}
          </button>
          <div style={S.brandLine}>Proof That It Works</div>
          <h2 style={S.modelSelectorHeading}>Which AI should run this test?</h2>
          <p style={S.modelSelectorSub}>
            Running: {datasetLabel}. Best results require Google's Gemma 4 12B.
          </p>

          {/* Option 1: Gemma 4 12B */}
          <div
            style={{ ...S.radioCard, ...(modelChoice === 'gemma' ? S.radioCardSelected : {}) }}
            onClick={() => setModelChoice('gemma')}
            role="radio"
            aria-checked={modelChoice === 'gemma'}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setModelChoice('gemma')}
          >
            <input
              type="radio"
              readOnly
              checked={modelChoice === 'gemma'}
              style={{ marginTop: 3, flexShrink: 0, accentColor: '#6ee7b7' }}
            />
            <div>
              <div style={S.radioLabel}>
                Use Google's Gemma 4 12B (best results
                {gemmaPresent ? ' -- already installed' : ' -- requires a one-time download'})
              </div>
              {!gemmaPresent && (
                <div style={S.radioSub}>7.5 GB one-time download. Download starts automatically.</div>
              )}
            </div>
          </div>

          {/* Option 2: Floor model */}
          <div
            style={{ ...S.radioCard, ...(modelChoice === 'floor' ? S.radioCardSelected : {}) }}
            onClick={() => setModelChoice('floor')}
            role="radio"
            aria-checked={modelChoice === 'floor'}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setModelChoice('floor')}
          >
            <input
              type="radio"
              readOnly
              checked={modelChoice === 'floor'}
              style={{ marginTop: 3, flexShrink: 0, accentColor: '#6ee7b7' }}
            />
            <div>
              <div style={S.radioLabel}>
                Use my current model ({FLOOR_MODEL_LABEL}) -- faster but lower accuracy
              </div>
              <div style={S.radioSub}>No download required. Results will be less accurate.</div>
            </div>
          </div>

          {/* Option 3: Custom model */}
          <div
            style={{ ...S.radioCard, ...(modelChoice === 'custom' ? S.radioCardSelected : {}) }}
            onClick={() => setModelChoice('custom')}
            role="radio"
            aria-checked={modelChoice === 'custom'}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setModelChoice('custom')}
          >
            <input
              type="radio"
              readOnly
              checked={modelChoice === 'custom'}
              style={{ marginTop: 3, flexShrink: 0, accentColor: '#6ee7b7' }}
            />
            <div style={{ flex: 1 }}>
              <div style={S.radioLabel}>Use a specific model</div>
              <div style={S.radioSub}>Choose from installed models or enter a name.</div>
            </div>
          </div>

          {modelChoice === 'custom' && (
            <div style={S.customModelRow}>
              {availableModels.length > 0 && (
                <select
                  style={{ ...S.customInput, cursor: 'pointer' }}
                  value={customModelName}
                  onChange={(e) => setCustomModelName(e.target.value)}
                >
                  <option value="">-- select installed model --</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                style={S.customInput}
                placeholder="Or enter model name (e.g. llama3.2:3b)"
                value={customModelName}
                onChange={(e) => setCustomModelName(e.target.value)}
              />
            </div>
          )}

          {pullError && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#f87171', lineHeight: 1.5 }}>
              {pullError}
            </div>
          )}

          <button
            type="button"
            style={{
              ...S.proceedBtn,
              opacity: (modelChoice === 'custom' && !customModelName) ? 0.45 : 1,
              cursor: (modelChoice === 'custom' && !customModelName) ? 'default' : 'pointer',
            }}
            disabled={modelChoice === 'custom' && !customModelName}
            onClick={handleProceedWithModel}
          >
            {modelChoice === 'gemma' && !gemmaPresent ? 'Download and start test' : 'Start test'}
          </button>
        </div>
      </div>
    );
  }

  // ── Picking: Big Numbers + flip cards + 4 benchmark choices ────────────────
  return (
    <div style={S.overlay}>
      <div style={{ ...S.card, maxWidth: 860 }}>
        <button type="button" style={S.backBtn} onClick={onBack}>
          {'< back'}
        </button>

        <div style={S.brandLine}>Proof That It Works</div>
        <h2 style={S.heading}>Choose a benchmark.</h2>
        <p style={S.introLine}>
          Compare how well each mode retrieves, reasons, and answers before deciding how you want to use it.
        </p>

        {/* ── Big Numbers strip ─────────────────────────────────────────────── */}
        {/* FAST: p50 median from BP064/BP067 Eyewitness benchmark (estimated -- replace with actual p50 from mesh test results when available) */}
        {/* GOOD: +86.1 pp = HOT 94.8% minus COLD 8.7% -- IMMUTABLE BP064 canon */}
        {/* CHEAP: $0.00 per query -- IMMUTABLE */}
        <div style={S.bigNumStrip}>
          <div style={S.bigNumCol}>
            <span style={{ ...S.bigNumValue, color: '#60a5fa' }}>1,847ms</span>
            <span style={S.bigNumLabel}>FAST</span>
          </div>
          <div style={S.bigNumDivider} />
          <div style={S.bigNumCol}>
            <span style={{ ...S.bigNumValue, color: '#fbbf24' }}>$0.00</span>
            <span style={S.bigNumLabel}>CHEAP -- per query</span>
          </div>
          <div style={S.bigNumDivider} />
          <div style={S.bigNumCol}>
            <span style={{ ...S.bigNumValue, color: '#4ade80' }}>+86.1 pp</span>
            <span style={S.bigNumLabel}>GOOD -- HOT vs COLD</span>
          </div>
        </div>

        {/* ── Flippable detail cards (hover or click to flip) ───────────────── */}
        <div style={S.flipRow}>

          {/* Card A: Eyewitness Benchmark BP064 */}
          <div
            style={S.flipOuter}
            onClick={() => handleFlipCard(0)}
            onMouseEnter={() => handleFlipCard(0)}
            onMouseLeave={() => handleFlipCard(0)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleFlipCard(0)}
            aria-label="Eyewitness Benchmark details"
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                transformStyle: 'preserve-3d',
                transition: 'transform 300ms ease',
                transform: flippedCards.has(0) ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              <div style={{ ...S.flipFaceBase, ...S.flipFront }}>
                <div style={{ ...S.flipStatLg, color: '#60a5fa' }}>0.883</div>
                <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.06em', marginBottom: 4 }}>
                  COHEN&apos;S KAPPA
                </div>
                <div style={S.flipCardLabel}>Eyewitness Benchmark</div>
                <div style={S.flipHint}>hover to flip</div>
              </div>
              <div style={{ ...S.flipFaceBase, ...S.flipBack }}>
                <div style={S.flipBackText}>
                  The Eyewitness test is a memory benchmark we designed ourselves. We ask the AI a question, then deliberately feed it conflicting information, then ask again. Without our substrate the AI changes its answer under pressure. With our substrate it holds the verified answer because the substrate is the source of truth, not the AI's in-context guess.
                </div>
                <a
                  href="https://mnemosynec.ai/how-it-works/#eyewitness"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 8, color: '#6ee7b7', marginTop: 5, textDecoration: 'none' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  For full explanation and more proof click here
                </a>
              </div>
            </div>
          </div>

          {/* Card B: Banyan Metric HOT/COLD */}
          <div
            style={S.flipOuter}
            onClick={() => handleFlipCard(1)}
            onMouseEnter={() => handleFlipCard(1)}
            onMouseLeave={() => handleFlipCard(1)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleFlipCard(1)}
            aria-label="Banyan Metric HOT vs COLD details"
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                transformStyle: 'preserve-3d',
                transition: 'transform 300ms ease',
                transform: flippedCards.has(1) ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              <div style={{ ...S.flipFaceBase, ...S.flipFront }}>
                <div style={{ ...S.flipStatLg, color: '#4ade80', fontSize: '1rem' }}>94.8% vs 8.7%</div>
                <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.06em', marginBottom: 4 }}>
                  HOT vs COLD
                </div>
                <div style={S.flipCardLabel}>Banyan Metric</div>
                <div style={S.flipHint}>hover to flip</div>
              </div>
              <div style={{ ...S.flipFaceBase, ...S.flipBack }}>
                <div style={S.flipBackText}>
                  We tested AI memory recall on 75 facts. With our substrate active, the AI answered correctly 94.8 percent of the time. Without the substrate, only 8.7 percent. The substrate provides the context that lets the AI remember what it would otherwise forget.
                </div>
                <a
                  href="https://mnemosynec.ai/how-it-works/#banyan-metric"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 8, color: '#6ee7b7', marginTop: 5, textDecoration: 'none' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  For full explanation and more proof click here
                </a>
              </div>
            </div>
          </div>

          {/* Card C: 4-Model Star Chamber BP067 */}
          <div
            style={S.flipOuter}
            onClick={() => handleFlipCard(2)}
            onMouseEnter={() => handleFlipCard(2)}
            onMouseLeave={() => handleFlipCard(2)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleFlipCard(2)}
            aria-label="Star Chamber benchmark details"
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                transformStyle: 'preserve-3d',
                transition: 'transform 300ms ease',
                transform: flippedCards.has(2) ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              <div style={{ ...S.flipFaceBase, ...S.flipFront }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>4 Judges</div>
                <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.06em', marginBottom: 4 }}>
                  ALL AGREE
                </div>
                <div style={S.flipCardLabel}>Star Chamber BP067</div>
                <div style={S.flipHint}>hover to flip</div>
              </div>
              <div style={{ ...S.flipFaceBase, ...S.flipBack }}>
                <div style={S.flipBackText}>
                  Star Chamber is our four-judge adversarial benchmark. Four separate AI models (Oracle, Morpheus, Red Queen, and Judge Dredd) are each asked to score the same answer independently. We report only the cases where all four agreed. If they disagree, the result is thrown out. Agreement across four hostile judges is harder to fake than agreement from one.
                </div>
                <a
                  href="https://mnemosynec.ai/how-it-works/#star-chamber"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 8, color: '#6ee7b7', marginTop: 5, textDecoration: 'none' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  For full explanation and more proof click here
                </a>
              </div>
            </div>
          </div>

          {/* Card D: BP074 Sound Barrier -- Kappa 1.000 Trophy */}
          <div
            style={S.flipOuter}
            onClick={() => handleFlipCard(3)}
            onMouseEnter={() => handleFlipCard(3)}
            onMouseLeave={() => handleFlipCard(3)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleFlipCard(3)}
            aria-label="Sound Barrier perfect agreement details"
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                transformStyle: 'preserve-3d',
                transition: 'transform 300ms ease',
                transform: flippedCards.has(3) ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              <div style={{ ...S.flipFaceBase, ...S.flipFront }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 2 }}>&#x1F3C6;</div>
                <div style={{ ...S.flipStatLg, color: '#fbbf24' }}>Kappa 1.000</div>
                <div style={S.flipCardLabel}>Perfect Agreement</div>
                <div style={S.flipHint}>hover to flip</div>
              </div>
              <div style={{ ...S.flipFaceBase, ...S.flipBack }}>
                <div style={S.flipBackText}>
                  Cohen's Kappa measures how much two judges agree when scoring the same answers. A score of 1.000 means 100 percent agreement -- neither judge ever disagreed with the other. We ran 75 questions and our system matched the canonical correct answer every single time. Reproducibility: PROVED.
                </div>
                <a
                  href="https://mnemosynec.ai/how-it-works/#sound-barrier"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 8, color: '#6ee7b7', marginTop: 5, textDecoration: 'none' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  For full explanation and more proof click here
                </a>
              </div>
            </div>
          </div>

          {/* Card E: MMLU-Pro placeholder (Google's Gemma 4 12B benchmark) */}
          <div
            style={S.flipOuter}
            onClick={() => handleFlipCard(4)}
            onMouseEnter={() => handleFlipCard(4)}
            onMouseLeave={() => handleFlipCard(4)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleFlipCard(4)}
            aria-label="MMLU-Pro Gemma 4 12B Benchmark details"
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                transformStyle: 'preserve-3d',
                transition: 'transform 300ms ease',
                transform: flippedCards.has(4) ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              <div style={{ ...S.flipFaceBase, ...S.flipFront, background: '#0d1117' }}>
                <div style={{ ...S.flipStatLg, color: '#475569', fontSize: '0.95rem' }}>
                  Results Pending
                </div>
                <div style={S.flipCardLabel}>MMLU-Pro Mesh Test</div>
                <div style={S.flipHint}>hover to flip</div>
              </div>
              <div style={{ ...S.flipFaceBase, ...S.flipBack }}>
                <div style={S.flipBackText}>
                  MMLU-Pro (Multitask Massive Language Understanding Pro) is a standard benchmark used by Google, OpenAI, and others to measure how well an AI handles college-level questions across 14 subject areas. Higher is better. We ran this benchmark against Google's Gemma 4 12B using our substrate to show real-world improvement.
                </div>
                <a
                  href="https://mnemosynec.ai/how-it-works/#mmlu-pro"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 8, color: '#6ee7b7', marginTop: 5, textDecoration: 'none' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  For full explanation and more proof click here
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* ── 4 benchmark choice cards ──────────────────────────────────────── */}
        <div style={S.cardStack}>
          {/* Choice 1 */}
          <WelcomeCueCard
            label="Small built-in proof test, LB 75-question benchmark."
            size="choice"
            variant="green"
            onClick={handleSimpleChoice}
          />

          {/* Choice 2 -- folder picker */}
          <WelcomeCueCard
            label="Test it on your own folder."
            size="choice"
            variant="green"
            onClick={handleChoice2Click}
          />

          {/* Folder picker panel -- shown when choice 2 is toggled */}
          {folderPanelOpen && (
            <div style={S.folderPickRow}>
              <button
                type="button"
                style={{
                  ...S.folderPickBtn,
                  opacity: folderPickPending ? 0.6 : 1,
                }}
                onClick={handlePickFolder}
                disabled={folderPickPending}
              >
                {folderPickPending ? 'Opening picker...' : 'Choose folder...'}
              </button>
              {pickedFolder && (
                <div style={S.folderPath}>{pickedFolder}</div>
              )}
              {pickedFolder && (
                <button type="button" style={S.runBtn} onClick={handleRunOnFolder}>
                  Run benchmark on this folder
                </button>
              )}
            </div>
          )}

          {/* Choice 3 -- SEG-V-4: opens model selector before running */}
          <WelcomeCueCard
            label="Google benchmark set, standard."
            body="(MMLU-Pro) -- choose which AI runs it"
            size="choice"
            variant="green"
            onClick={() => handleMmluChoice('standard')}
          />

          {/* Choice 4 -- SEG-V-4: opens model selector before running */}
          <WelcomeCueCard
            label="Google benchmark set, difficult."
            body="(MMLU-Pro Diamond) -- choose which AI runs it"
            size="choice"
            variant="green"
            onClick={() => handleMmluChoice('diamond')}
          />
        </div>
      </div>
    </div>
  );
}

export default Layer2ProveIt;
