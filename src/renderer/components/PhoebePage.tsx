// PhoebePage™ — Idea Storage scaffold
// SAGA-45 · BP054 close-stretch canon mint
// G.13 BP055 W3: basic save/get idea flow + IPC stubs
// New App Tab umbrella sub-service: Phoebe™ preserves your ideas locally, forever.

import React, { useState, useEffect, useCallback } from 'react';

interface IdeaEntry {
  id: string;
  title: string;
  body: string;
  savedAt: string;
}

interface PhoebeIpcResult {
  ok: boolean;
  ideas?: IdeaEntry[];
  idea?: IdeaEntry;
  error?: string;
}

export function PhoebePage() {
  const [ideas, setIdeas] = useState<IdeaEntry[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<IdeaEntry | null>(null);

  const loadIdeas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await (window.amplify as any)?.phoebe?.list?.() as PhoebeIpcResult | null;
      if (res?.ok && res.ideas) {
        setIdeas(res.ideas);
      }
    } catch {
      // IPC not wired yet — silently show empty state
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadIdeas(); }, [loadIdeas]);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await (window.amplify as any)?.phoebe?.save?.({
        title: title.trim(),
        body: body.trim(),
      }) as PhoebeIpcResult | null;
      if (res?.ok) {
        setSaveMsg('Idea saved ✓');
        setTitle('');
        setBody('');
        await loadIdeas();
      } else {
        setSaveMsg(res?.error ?? 'Save failed — IPC not yet wired');
      }
    } catch {
      setSaveMsg('Save failed — IPC not yet wired (coming next session)');
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(null), 3000);
  }

  const baseStyle: React.CSSProperties = {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    background: '#0a0f1a',
    color: '#e2e8f0',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  return (
    <div style={baseStyle}>
      {/* Header */}
      <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid rgba(100,116,139,0.15)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>🪶</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.3px' }}>
              Phoebe™ — Idea Storage
            </div>
            <div style={{ fontSize: 10, color: '#6ee7b7', marginTop: 1 }}>
              Your ideas, preserved. Forever.
            </div>
          </div>
        </div>
        <div style={{
          display: 'inline-block',
          padding: '2px 10px',
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 20,
          fontSize: 9,
          color: '#818cf8',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          BP055 W3 · IPC Scaffold
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: saved ideas list */}
        <div style={{
          width: 200, flexShrink: 0, borderRight: '1px solid rgba(100,116,139,0.12)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid rgba(100,116,139,0.1)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Saved Ideas
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {loading ? (
              <div style={{ fontSize: 9, color: '#334155', padding: '10px 12px' }}>Loading…</div>
            ) : ideas.length === 0 ? (
              <div style={{ fontSize: 9, color: '#334155', padding: '10px 12px', lineHeight: 1.6 }}>
                No ideas saved yet.<br />Write your first one →
              </div>
            ) : ideas.map((idea) => (
              <div
                key={idea.id}
                onClick={() => setSelectedIdea(selectedIdea?.id === idea.id ? null : idea)}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: 10,
                  color: selectedIdea?.id === idea.id ? '#e2e8f0' : '#94a3b8',
                  background: selectedIdea?.id === idea.id ? 'rgba(99,102,241,0.12)' : 'transparent',
                  borderLeft: selectedIdea?.id === idea.id ? '2px solid rgba(99,102,241,0.5)' : '2px solid transparent',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  transition: 'background 0.1s',
                }}
                title={idea.title}
              >
                {idea.title}
              </div>
            ))}
          </div>
        </div>

        {/* Right: save form or idea detail */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {selectedIdea ? (
            // Idea detail view
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{selectedIdea.title}</div>
                <button
                  onClick={() => setSelectedIdea(null)}
                  style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}
                >✕</button>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {selectedIdea.body || <span style={{ color: '#334155', fontStyle: 'italic' }}>No body text.</span>}
              </div>
              <div style={{ fontSize: 9, color: '#334155', marginTop: 10 }}>
                Saved: {new Date(selectedIdea.savedAt).toLocaleString()}
              </div>
            </div>
          ) : (
            // Save new idea form
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Save a New Idea
              </div>
              <input
                type="text"
                placeholder="Idea title…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(15,23,42,0.8)',
                  border: '1px solid rgba(100,116,139,0.3)',
                  borderRadius: 6, padding: '8px 12px',
                  color: '#e2e8f0', fontSize: 12,
                  outline: 'none',
                }}
              />
              <textarea
                placeholder="Your idea, in as much detail as you want…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(15,23,42,0.8)',
                  border: '1px solid rgba(100,116,139,0.3)',
                  borderRadius: 6, padding: '8px 12px',
                  color: '#e2e8f0', fontSize: 11,
                  outline: 'none', resize: 'vertical',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                  style={{
                    padding: '7px 16px',
                    background: 'rgba(110,231,183,0.1)',
                    border: '1px solid rgba(110,231,183,0.35)',
                    borderRadius: 6,
                    color: '#6ee7b7',
                    fontSize: 11, fontWeight: 700,
                    cursor: title.trim() ? 'pointer' : 'not-allowed',
                    opacity: (saving || !title.trim()) ? 0.5 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {saving ? 'Saving…' : '🪶 Save idea'}
                </button>
                {saveMsg && (
                  <span style={{ fontSize: 10, color: saveMsg.includes('✓') ? '#6ee7b7' : '#f87171' }}>
                    {saveMsg}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 9, color: '#334155', lineHeight: 1.6, marginTop: 4 }}>
                Ideas are saved locally, cryptographically signed via the substrate.
                IPC backend connection is scaffolded — full persistence wired next session.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PhoebePage;
