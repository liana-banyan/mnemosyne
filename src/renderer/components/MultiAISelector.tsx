// MultiAISelector — BP060 Application 002 Step 1 v3 · UI-8
//
// §4.1 Quick-Pick Dropdown: chat input top area · Ctrl+Shift+A shortcut
// §4.2 Court Preset Management: named role→AI mappings · default "Solo Ollama"
// §4.3 On-the-fly Single-Use: one-shot override · auto-revert after
// §4.4 User-Defined Rules: IF-THEN form · opt-in · default no rules
// §4.5 Multi-Select Parallel Cathedrals: checkbox list · cost warning
// §4.6 Default Discipline (DOCTRINE-CLASS): Ollama ALWAYS default
//      Cloud-AI = explicit opt-in. Cost transparency displayed.
//      NO silent cloud default. This is DOCTRINE not UX preference.
//
// Court mappings (Founder-verbatim — exact strings):
//   Bishop = Anthropic Claude Opus 4.7 (1M context)
//   Rook   = GPT 5.5 (or lower fallback)
//   Knight = Gemini 3.1 Pro OR Sonnet 5.6 (current)
//   Pawn   = Comet Perplexity "Best" available model
//   Red Queen = "Founder ratify pending" (placeholder — DO NOT assume)
//
// decay_class: BETWEEN on substrate emissions. DOCTRINE on §4.6.

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AIModelId =
  | 'ollama-local'
  | 'claude-opus-47'
  | 'gpt-55'
  | 'gemini-31-pro'
  | 'sonnet-56'
  | 'perplexity-best'
  | 'founder-ratify-pending';

type CourtRole = 'Bishop' | 'Knight' | 'Rook' | 'Pawn' | 'RedQueen';

interface AIModel {
  id: AIModelId;
  name: string;
  provider: 'local' | 'cloud';
  badge: string;
  cost: string;
  note?: string;
}

interface CourtPreset {
  id: string;
  name: string;
  mappings: Record<CourtRole, AIModelId>;
  isDefault?: boolean;
}

interface UserRule {
  id: string;
  condition: string;
  thenModel: AIModelId;
  enabled: boolean;
}

// ─── Available models ─────────────────────────────────────────────────────────

const MODELS: AIModel[] = [
  {
    id: 'ollama-local',
    name: 'Ollama (Local)',
    provider: 'local',
    badge: 'LOCAL',
    cost: '$0.00 / query',
    note: 'Default — DOCTRINE class. No cloud. No data egress.',
  },
  {
    id: 'claude-opus-47',
    name: 'Anthropic Claude Opus 4.7 (1M context)',
    provider: 'cloud',
    badge: 'CLOUD',
    cost: 'Anthropic pricing',
    note: 'Court role: Bishop',
  },
  {
    id: 'gpt-55',
    name: 'GPT 5.5 (or lower fallback)',
    provider: 'cloud',
    badge: 'CLOUD',
    cost: 'OpenAI pricing',
    note: 'Court role: Rook',
  },
  {
    id: 'gemini-31-pro',
    name: 'Gemini 3.1 Pro',
    provider: 'cloud',
    badge: 'CLOUD',
    cost: 'Google pricing',
    note: 'Court role: Knight (option A)',
  },
  {
    id: 'sonnet-56',
    name: 'Sonnet 5.6 (current)',
    provider: 'cloud',
    badge: 'CLOUD',
    cost: 'Anthropic pricing',
    note: 'Court role: Knight (option B)',
  },
  {
    id: 'perplexity-best',
    name: 'Comet Perplexity "Best" available model',
    provider: 'cloud',
    badge: 'CLOUD',
    cost: 'Perplexity pricing',
    note: 'Court role: Pawn',
  },
  {
    id: 'founder-ratify-pending',
    name: 'Founder ratify pending',
    provider: 'cloud',
    badge: 'PENDING',
    cost: 'TBD',
    note: 'Court role: Red Queen — placeholder, DO NOT assume',
  },
];

// ─── Default Court Preset: "Solo Ollama" ─────────────────────────────────────

const SOLO_OLLAMA_PRESET: CourtPreset = {
  id: 'solo-ollama',
  name: 'Solo Ollama',
  isDefault: true,
  mappings: {
    Bishop: 'ollama-local',
    Knight: 'ollama-local',
    Rook: 'ollama-local',
    Pawn: 'ollama-local',
    RedQueen: 'ollama-local',
  },
};

const COURT_PRESET: CourtPreset = {
  id: 'court',
  name: 'Court (Multi-Cloud)',
  mappings: {
    Bishop: 'claude-opus-47',
    Knight: 'gemini-31-pro',
    Rook: 'gpt-55',
    Pawn: 'perplexity-best',
    RedQueen: 'founder-ratify-pending',
  },
};

const DEFAULT_PRESETS: CourtPreset[] = [SOLO_OLLAMA_PRESET, COURT_PRESET];

const LS_PRESET = 'mnemo_ai_active_preset';
const LS_RULES = 'mnemo_ai_user_rules';
const LS_PARALLEL = 'mnemo_ai_parallel_selected';

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span>{icon}</span> {title}
      </div>
      {subtitle && <div style={{ fontSize: 8, color: '#334155', marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

// ─── Model badge ─────────────────────────────────────────────────────────────

function ModelBadge({ model }: { model: AIModel }) {
  return (
    <span style={{
      fontSize: 7, padding: '1px 4px', borderRadius: 3, fontWeight: 700,
      background: model.provider === 'local' ? 'rgba(110,231,183,0.12)' : 'rgba(251,191,36,0.1)',
      border: model.provider === 'local' ? '1px solid rgba(110,231,183,0.3)' : '1px solid rgba(251,191,36,0.25)',
      color: model.provider === 'local' ? '#6ee7b7' : '#fbbf24',
    }}>
      {model.badge}
    </span>
  );
}

// ─── §4.6 Doctrine Banner ─────────────────────────────────────────────────────

function DoctrineBanner({ activeIsLocal }: { activeIsLocal: boolean }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 7, marginBottom: 12,
      background: activeIsLocal ? 'rgba(110,231,183,0.06)' : 'rgba(251,191,36,0.08)',
      border: `1px solid ${activeIsLocal ? 'rgba(110,231,183,0.25)' : 'rgba(251,191,36,0.35)'}`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: activeIsLocal ? '#6ee7b7' : '#fbbf24', marginBottom: 3 }}>
        {activeIsLocal
          ? '✓ §4.6 DOCTRINE — Ollama Local active. No cloud cost.'
          : '⚠ §4.6 DOCTRINE — Cloud AI active. Explicit opt-in confirmed.'}
      </div>
      <div style={{ fontSize: 8, color: '#64748b', lineHeight: 1.5 }}>
        Ollama is always default. Cloud AI requires explicit opt-in.
        {!activeIsLocal && ' Cloud cost incurred per query — see model pricing above.'}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MultiAISelector() {
  const [activeSection, setActiveSection] = useState<'quick' | 'court' | 'single-use' | 'rules' | 'parallel' | 'local'>('quick');

  // §4.6 — active model (default: Ollama local, DOCTRINE)
  const [activeModel, setActiveModel] = useState<AIModelId>(() => {
    const saved = localStorage.getItem(LS_PRESET);
    return (saved as AIModelId | null) ?? 'ollama-local';
  });

  // §4.2 Court presets
  const [presets] = useState<CourtPreset[]>(DEFAULT_PRESETS);
  const [activePresetId, setActivePresetId] = useState('solo-ollama');

  // §4.3 Single-use override
  const [singleUseModel, setSingleUseModel] = useState<AIModelId | null>(null);
  const [singleUseActive, setSingleUseActive] = useState(false);

  // §4.4 User rules
  const [rules, setRules] = useState<UserRule[]>(() => {
    try {
      const saved = localStorage.getItem(LS_RULES);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [newCondition, setNewCondition] = useState('');
  const [newRuleModel, setNewRuleModel] = useState<AIModelId>('ollama-local');

  // §4.5 Parallel selection
  const [parallelSelected, setParallelSelected] = useState<AIModelId[]>(() => {
    try {
      const saved = localStorage.getItem(LS_PARALLEL);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Keyboard shortcut Ctrl+Shift+A
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setActiveSection((prev) => prev === 'quick' ? 'court' : 'quick');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Persist
  useEffect(() => { localStorage.setItem(LS_PRESET, activeModel); }, [activeModel]);
  useEffect(() => { localStorage.setItem(LS_RULES, JSON.stringify(rules)); }, [rules]);
  useEffect(() => { localStorage.setItem(LS_PARALLEL, JSON.stringify(parallelSelected)); }, [parallelSelected]);

  const effectiveModel = singleUseActive && singleUseModel ? singleUseModel : activeModel;
  const effectiveModelObj = MODELS.find((m) => m.id === effectiveModel) ?? MODELS[0];
  const activeIsLocal = effectiveModelObj.provider === 'local';
  const hasCloudInParallel = parallelSelected.some((id) => MODELS.find((m) => m.id === id)?.provider === 'cloud');

  const revertSingleUse = useCallback(() => {
    setSingleUseModel(null);
    setSingleUseActive(false);
  }, []);

  const addRule = useCallback(() => {
    if (!newCondition.trim()) return;
    setRules((prev) => [
      ...prev,
      { id: `rule-${Date.now()}`, condition: newCondition.trim(), thenModel: newRuleModel, enabled: true },
    ]);
    setNewCondition('');
  }, [newCondition, newRuleModel]);

  const removeRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // §4.6 Local LLM Engine settings state
  const [localRuntimeUrl, setLocalRuntimeUrl] = useState('http://localhost:11434');
  const [localTestResult, setLocalTestResult] = useState<{ ok?: boolean; models?: string[]; error?: string } | null>(null);
  const [localTestLoading, setLocalTestLoading] = useState(false);
  const [localSaveMsg, setLocalSaveMsgRaw] = useState<string | null>(null);

  // Load persisted LOCAL_RUNTIME_URL on mount
  useEffect(() => {
    window.amplify?.aiDispatch?.getSettings?.().then((s) => {
      if (s?.local_runtime_url) setLocalRuntimeUrl(s.local_runtime_url);
    }).catch(() => {/* ignore */});
  }, []);

  const testLocalConnection = useCallback(async () => {
    setLocalTestLoading(true);
    setLocalTestResult(null);
    try {
      const result = await window.amplify?.aiDispatch?.testConnection?.();
      setLocalTestResult(result ?? { ok: false, models: [], error: 'IPC not available' });
    } catch (err) {
      setLocalTestResult({ ok: false, models: [], error: String(err) });
    } finally {
      setLocalTestLoading(false);
    }
  }, []);

  const saveLocalUrl = useCallback(async () => {
    try {
      await window.amplify?.aiDispatch?.saveSettings?.({ local_runtime_url: localRuntimeUrl });
      setLocalSaveMsgRaw('Saved.');
      setTimeout(() => setLocalSaveMsgRaw(null), 2000);
    } catch (err) {
      setLocalSaveMsgRaw('Error: ' + String(err));
    }
  }, [localRuntimeUrl]);

  const sectionBtn = (id: typeof activeSection, label: string): React.CSSProperties => ({
    padding: '5px 10px', fontSize: 9, fontWeight: 600, cursor: 'pointer',
    background: activeSection === id ? 'rgba(167,139,250,0.12)' : 'transparent',
    border: activeSection === id ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(100,116,139,0.15)',
    borderRadius: 5, color: activeSection === id ? '#a78bfa' : '#475569', transition: 'all 0.1s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '8px 14px 6px', borderBottom: '1px solid rgba(100,116,139,0.15)', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 1 }}>
          Multi-AI Selector
        </div>
        <div style={{ fontSize: 8, color: '#334155' }}>
          Ctrl+Shift+A to toggle · BP060 Application 002 Step 1 v3 · UI-8 · §4.6 Ollama Default DOCTRINE
        </div>
      </div>

      {/* Current model pill */}
      <div style={{
        padding: '6px 14px', borderBottom: '1px solid rgba(100,116,139,0.1)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: '#64748b' }}>Active:</span>
        <span style={{
          fontSize: 9, fontWeight: 700, color: effectiveModelObj.provider === 'local' ? '#6ee7b7' : '#fbbf24',
          padding: '2px 8px', borderRadius: 10,
          background: effectiveModelObj.provider === 'local' ? 'rgba(110,231,183,0.1)' : 'rgba(251,191,36,0.1)',
          border: effectiveModelObj.provider === 'local' ? '1px solid rgba(110,231,183,0.3)' : '1px solid rgba(251,191,36,0.3)',
        }}>
          {effectiveModelObj.name}
        </span>
        {singleUseActive && (
          <span style={{ fontSize: 8, color: '#f87171' }}>
            ONE-SHOT ·{' '}
            <button onClick={revertSingleUse}
              style={{ fontSize: 8, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
              revert
            </button>
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 7, color: '#334155' }}>
          {effectiveModelObj.cost}
        </span>
      </div>

      {/* Section nav */}
      <div style={{
        padding: '6px 12px', display: 'flex', gap: 5, flexWrap: 'wrap',
        borderBottom: '1px solid rgba(100,116,139,0.1)', flexShrink: 0,
      }}>
        <button style={sectionBtn('quick', 'Quick-Pick')} onClick={() => setActiveSection('quick')}>§4.1 Quick-Pick</button>
        <button style={sectionBtn('court', 'Court')} onClick={() => setActiveSection('court')}>§4.2 Court</button>
        <button style={sectionBtn('single-use', 'Single-Use')} onClick={() => setActiveSection('single-use')}>§4.3 Single-Use</button>
        <button style={sectionBtn('rules', 'Rules')} onClick={() => setActiveSection('rules')}>§4.4 Rules</button>
        <button style={sectionBtn('parallel', 'Parallel')} onClick={() => setActiveSection('parallel')}>§4.5 Parallel</button>
        <button style={sectionBtn('local', 'Local Engine')} onClick={() => setActiveSection('local')}>§4.6 Local Engine</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
        {/* §4.6 Doctrine banner always visible */}
        <DoctrineBanner activeIsLocal={activeIsLocal} />

        {/* ── §4.1 Quick-Pick ────────────────────────────────────────────── */}
        {activeSection === 'quick' && (
          <div>
            <SectionHeader icon="⚡" title="§4.1 Quick-Pick" subtitle="Select active AI model · Ctrl+Shift+A to focus" />
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => { setActiveModel(m.id); setSingleUseActive(false); }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'left',
                  width: '100%', marginBottom: 5,
                  padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                  background: activeModel === m.id ? 'rgba(167,139,250,0.1)' : 'rgba(100,116,139,0.04)',
                  border: activeModel === m.id ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(100,116,139,0.12)',
                  transition: 'all 0.1s',
                }}
              >
                <div style={{ paddingTop: 1 }}><ModelBadge model={m} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 10, fontWeight: activeModel === m.id ? 700 : 500,
                    color: activeModel === m.id ? '#e2e8f0' : '#94a3b8',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    {m.name}
                    {activeModel === m.id && <span style={{ fontSize: 8, color: '#a78bfa' }}>✓ active</span>}
                  </div>
                  <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>{m.note}</div>
                  <div style={{ fontSize: 7, color: '#334155', marginTop: 1 }}>{m.cost}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── §4.2 Court Presets ─────────────────────────────────────────── */}
        {activeSection === 'court' && (
          <div>
            <SectionHeader icon="♟" title="§4.2 Court Presets" subtitle="Named role→AI mappings · Default: Solo Ollama" />
            {presets.map((preset) => (
              <div key={preset.id} style={{
                marginBottom: 10, padding: '8px 10px', borderRadius: 6,
                background: activePresetId === preset.id ? 'rgba(110,231,183,0.06)' : 'rgba(100,116,139,0.04)',
                border: activePresetId === preset.id ? '1px solid rgba(110,231,183,0.25)' : '1px solid rgba(100,116,139,0.12)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: activePresetId === preset.id ? '#6ee7b7' : '#94a3b8' }}>
                    {preset.name}
                  </span>
                  {preset.isDefault && (
                    <span style={{
                      fontSize: 7, padding: '1px 4px', borderRadius: 3, fontWeight: 700,
                      background: 'rgba(110,231,183,0.12)', border: '1px solid rgba(110,231,183,0.3)', color: '#6ee7b7',
                    }}>DEFAULT</span>
                  )}
                  <button
                    onClick={() => {
                      setActivePresetId(preset.id);
                      // Apply Bishop mapping as active model
                      setActiveModel(preset.mappings.Bishop ?? 'ollama-local');
                    }}
                    style={{
                      marginLeft: 'auto', fontSize: 8, padding: '2px 8px',
                      background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.2)',
                      borderRadius: 4, color: '#94a3b8', cursor: 'pointer',
                    }}
                  >
                    {activePresetId === preset.id ? '✓ Active' : 'Apply'}
                  </button>
                </div>
                {(Object.entries(preset.mappings) as [CourtRole, AIModelId][]).map(([role, modelId]) => {
                  const m = MODELS.find((x) => x.id === modelId);
                  return (
                    <div key={role} style={{ display: 'flex', gap: 8, fontSize: 9, marginBottom: 3, alignItems: 'center' }}>
                      <span style={{ color: '#475569', width: 70, flexShrink: 0 }}>{role}:</span>
                      <span style={{ color: '#e2e8f0' }}>{m?.name ?? modelId}</span>
                      {m && <ModelBadge model={m} />}
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={{ fontSize: 8, color: '#334155', marginTop: 4 }}>
              Court mappings per Founder-verbatim canon. Red Queen = placeholder, Founder ratify pending.
            </div>
          </div>
        )}

        {/* ── §4.3 Single-Use Override ───────────────────────────────────── */}
        {activeSection === 'single-use' && (
          <div>
            <SectionHeader icon="🎯" title="§4.3 Single-Use Override" subtitle="One-shot model · auto-reverts after use" />
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 9, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                Select model for one-shot override:
              </label>
              <select
                value={singleUseModel ?? ''}
                onChange={(e) => setSingleUseModel(e.target.value as AIModelId)}
                style={{
                  width: '100%', padding: '6px 8px', fontSize: 9,
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(100,116,139,0.3)',
                  borderRadius: 5, color: '#e2e8f0',
                }}
              >
                <option value="">— select model —</option>
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} [{m.badge}]</option>
                ))}
              </select>
            </div>
            {singleUseModel && (
              <div style={{ marginBottom: 10, padding: '6px 8px', borderRadius: 5, background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <div style={{ fontSize: 8, color: '#fbbf24' }}>
                  {MODELS.find((m) => m.id === singleUseModel)?.provider === 'cloud'
                    ? `⚠ Cloud AI — ${MODELS.find((m) => m.id === singleUseModel)?.cost}`
                    : `✓ Local — ${MODELS.find((m) => m.id === singleUseModel)?.cost}`}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => { if (singleUseModel) setSingleUseActive(true); }}
                disabled={!singleUseModel}
                style={{
                  flex: 1, padding: '7px', fontSize: 10, fontWeight: 700,
                  background: singleUseModel ? 'rgba(167,139,250,0.12)' : 'rgba(100,116,139,0.06)',
                  border: `1px solid ${singleUseModel ? 'rgba(167,139,250,0.35)' : 'rgba(100,116,139,0.15)'}`,
                  borderRadius: 5, color: singleUseModel ? '#a78bfa' : '#334155', cursor: singleUseModel ? 'pointer' : 'not-allowed',
                }}
              >
                Activate One-Shot
              </button>
              {singleUseActive && (
                <button onClick={revertSingleUse} style={{
                  padding: '7px 12px', fontSize: 9, background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)', borderRadius: 5, color: '#f87171', cursor: 'pointer',
                }}>
                  Revert
                </button>
              )}
            </div>
            {singleUseActive && (
              <div style={{ marginTop: 8, fontSize: 9, color: '#fbbf24' }}>
                ONE-SHOT ACTIVE — will auto-revert when you click Revert or change preset
              </div>
            )}
          </div>
        )}

        {/* ── §4.4 User Rules ────────────────────────────────────────────── */}
        {activeSection === 'rules' && (
          <div>
            <SectionHeader icon="📋" title="§4.4 User-Defined Rules" subtitle="IF-THEN routing · opt-in · default: no rules" />
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Add rule</div>
              <input
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                placeholder='IF condition (e.g. "query contains code")'
                style={{
                  width: '100%', padding: '5px 8px', marginBottom: 5, fontSize: 9, boxSizing: 'border-box',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(100,116,139,0.25)',
                  borderRadius: 4, color: '#e2e8f0',
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  value={newRuleModel}
                  onChange={(e) => setNewRuleModel(e.target.value as AIModelId)}
                  style={{
                    flex: 1, padding: '5px 6px', fontSize: 9,
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(100,116,139,0.25)',
                    borderRadius: 4, color: '#e2e8f0',
                  }}
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>THEN use: {m.name}</option>
                  ))}
                </select>
                <button onClick={addRule} style={{
                  padding: '5px 12px', fontSize: 9, fontWeight: 700,
                  background: 'rgba(110,231,183,0.1)', border: '1px solid rgba(110,231,183,0.25)',
                  borderRadius: 4, color: '#6ee7b7', cursor: 'pointer',
                }}>
                  + Add
                </button>
              </div>
            </div>
            {rules.length === 0 ? (
              <div style={{ fontSize: 9, color: '#334155', textAlign: 'center', padding: 16 }}>No rules defined (default — opt-in only)</div>
            ) : (
              rules.map((rule) => (
                <div key={rule.id} style={{
                  padding: '6px 8px', marginBottom: 5, borderRadius: 5,
                  background: rule.enabled ? 'rgba(110,231,183,0.04)' : 'rgba(100,116,139,0.04)',
                  border: `1px solid ${rule.enabled ? 'rgba(110,231,183,0.15)' : 'rgba(100,116,139,0.1)'}`,
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 8, color: '#64748b' }}>IF: <span style={{ color: '#94a3b8' }}>{rule.condition}</span></div>
                    <div style={{ fontSize: 8, color: '#64748b' }}>THEN: <span style={{ color: '#e2e8f0' }}>{MODELS.find((m) => m.id === rule.thenModel)?.name}</span></div>
                  </div>
                  <button
                    onClick={() => setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))}
                    style={{ fontSize: 8, padding: '2px 6px', background: 'none', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 3, color: rule.enabled ? '#6ee7b7' : '#475569', cursor: 'pointer' }}
                  >
                    {rule.enabled ? 'ON' : 'OFF'}
                  </button>
                  <button onClick={() => removeRule(rule.id)}
                    style={{ fontSize: 8, padding: '2px 6px', background: 'none', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 3, color: '#f87171', cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── §4.5 Multi-Select Parallel Cathedrals ─────────────────────── */}
        {activeSection === 'parallel' && (
          <div>
            <SectionHeader icon="⚡⚡" title="§4.5 Multi-Select Parallel Cathedrals" subtitle="Side-by-side results · cost warning for cloud" />
            {hasCloudInParallel && (
              <div style={{
                padding: '7px 10px', marginBottom: 10, borderRadius: 6,
                background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24' }}>
                  ⚠ Cloud AI in parallel selection — cost per query per model
                </div>
                <div style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>
                  Each selected cloud model incurs its own API cost per query.
                </div>
              </div>
            )}
            {MODELS.filter((m) => m.id !== 'founder-ratify-pending').map((m) => {
              const selected = parallelSelected.includes(m.id);
              return (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5,
                  padding: '6px 8px', borderRadius: 5,
                  background: selected ? `${m.provider === 'local' ? 'rgba(110,231,183,0.06)' : 'rgba(251,191,36,0.06)'}` : 'rgba(100,116,139,0.03)',
                  border: `1px solid ${selected ? (m.provider === 'local' ? 'rgba(110,231,183,0.2)' : 'rgba(251,191,36,0.2)') : 'rgba(100,116,139,0.1)'}`,
                  cursor: 'pointer',
                }}
                  onClick={() => setParallelSelected((prev) => selected ? prev.filter((id) => id !== m.id) : [...prev, m.id])}
                >
                  <div style={{
                    width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                    background: selected ? (m.provider === 'local' ? '#6ee7b7' : '#fbbf24') : 'transparent',
                    border: `1px solid ${selected ? (m.provider === 'local' ? '#6ee7b7' : '#fbbf24') : 'rgba(100,116,139,0.3)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#0a0f1a',
                  }}>
                    {selected ? '✓' : ''}
                  </div>
                  <ModelBadge model={m} />
                  <span style={{ fontSize: 9, color: selected ? '#e2e8f0' : '#64748b' }}>{m.name}</span>
                  <span style={{ fontSize: 7, color: '#334155', marginLeft: 'auto' }}>{m.cost}</span>
                </div>
              );
            })}
            {parallelSelected.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 9, color: '#94a3b8' }}>
                {parallelSelected.length} model{parallelSelected.length !== 1 ? 's' : ''} selected for parallel dispatch
                {hasCloudInParallel && <span style={{ color: '#fbbf24' }}> · cloud cost applies</span>}
              </div>
            )}
          </div>
        )}

        {/* ── §4.6 Local LLM Engine Settings ────────────────────────────── */}
        {activeSection === 'local' && (
          <div>
            <SectionHeader
              icon="⚙️"
              title="§4.6 Local LLM Engine"
              subtitle="Runtime-agnostic · NOT Ollama-hardcoded · any OpenAI-compatible server"
            />

            {/* Doctrine reminder */}
            <div style={{
              padding: '7px 10px', marginBottom: 12, borderRadius: 6,
              background: 'rgba(110,231,183,0.05)', border: '1px solid rgba(110,231,183,0.2)',
              fontSize: 8, color: '#6ee7b7', lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>§4.6 DOCTRINE — Default = Local LLM Engine</div>
              <div style={{ color: '#64748b' }}>
                Mnemosyne defaults to your local runtime. Compatible: Ollama · llama.cpp · vLLM · LM Studio · any OpenAI-compatible server.
              </div>
            </div>

            {/* URL field */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
                Local LLM Engine URL
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="text"
                  value={localRuntimeUrl}
                  onChange={(e) => setLocalRuntimeUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  style={{
                    flex: 1, padding: '5px 8px', fontSize: 9, borderRadius: 5,
                    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(100,116,139,0.3)',
                    color: '#e2e8f0', outline: 'none', fontFamily: 'monospace',
                  }}
                />
                <button
                  onClick={saveLocalUrl}
                  style={{
                    padding: '5px 10px', fontSize: 9, background: 'rgba(110,231,183,0.1)',
                    border: '1px solid rgba(110,231,183,0.3)', borderRadius: 5,
                    color: '#6ee7b7', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                  }}
                >
                  Save
                </button>
              </div>
              {localSaveMsg && (
                <div style={{ fontSize: 8, color: '#6ee7b7', marginTop: 3 }}>{localSaveMsg}</div>
              )}
              <div style={{ fontSize: 8, color: '#475569', marginTop: 4 }}>
                Default: http://localhost:11434 (Ollama) · Change to llama.cpp / vLLM / LM Studio URL as needed
              </div>
            </div>

            {/* Test connection */}
            <div>
              <button
                onClick={testLocalConnection}
                disabled={localTestLoading}
                style={{
                  padding: '6px 14px', fontSize: 9, background: 'rgba(56,189,248,0.08)',
                  border: '1px solid rgba(56,189,248,0.25)', borderRadius: 5,
                  color: '#38bdf8', cursor: localTestLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {localTestLoading ? '⟳ Testing…' : '⚡ Test Connection'}
              </button>

              {localTestResult && (
                <div style={{
                  marginTop: 8, padding: '8px 10px', borderRadius: 6,
                  background: localTestResult.ok ? 'rgba(110,231,183,0.05)' : 'rgba(248,113,113,0.05)',
                  border: `1px solid ${localTestResult.ok ? 'rgba(110,231,183,0.2)' : 'rgba(248,113,113,0.2)'}`,
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: localTestResult.ok ? '#6ee7b7' : '#f87171', marginBottom: 4 }}>
                    {localTestResult.ok ? '✓ Connected' : '✗ Connection failed'}
                  </div>
                  {localTestResult.error && (
                    <div style={{ fontSize: 8, color: '#f87171', marginBottom: 4 }}>{localTestResult.error}</div>
                  )}
                  {localTestResult.ok && localTestResult.models && localTestResult.models.length > 0 && (
                    <div>
                      <div style={{ fontSize: 8, color: '#94a3b8', marginBottom: 3 }}>
                        Models available ({localTestResult.models.length}):
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {localTestResult.models.slice(0, 12).map((m) => (
                          <span key={m} style={{
                            fontSize: 7, padding: '1px 5px', borderRadius: 3,
                            background: 'rgba(110,231,183,0.08)', border: '1px solid rgba(110,231,183,0.2)',
                            color: '#6ee7b7', fontFamily: 'monospace',
                          }}>
                            {m}
                          </span>
                        ))}
                        {localTestResult.models.length > 12 && (
                          <span style={{ fontSize: 7, color: '#475569' }}>+{localTestResult.models.length - 12} more</span>
                        )}
                      </div>
                    </div>
                  )}
                  {localTestResult.ok && (!localTestResult.models || localTestResult.models.length === 0) && (
                    <div style={{ fontSize: 8, color: '#94a3b8' }}>No models listed by runtime.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
