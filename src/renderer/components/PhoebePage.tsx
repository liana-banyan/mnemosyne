// PhoebePage™ — Idea Storage with IPC
// SAGA-45 · BP054 close-stretch canon mint
// C.17 · BP055: IPC layer wired (save-idea + get-ideas handlers in src/main/index.ts)
// Integration note: wire as a new tab in MnemosyneTabView (TabId: 'phoebe') or
// as a new View in App.tsx (View: 'phoebe') with hash '#/phoebe'.

import React, { useState, useEffect, useCallback } from 'react';

interface Idea {
  id: string;
  title: string;
  content: string;
  timestamp: string;
}

declare global {
  interface Window {
    amplify?: {
      saveIdea?: (idea: { title: string; content: string; timestamp: string }) => Promise<{ ok: boolean; id: string }>;
      getIdeas?: () => Promise<{ ok: boolean; ideas: Idea[] }>;
    };
  }
}

export function PhoebePage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadIdeas = useCallback(async () => {
    if (!window.amplify?.getIdeas) return;
    const result = await window.amplify.getIdeas();
    if (result.ok) setIdeas(result.ideas);
  }, []);

  useEffect(() => { loadIdeas(); }, [loadIdeas]);

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) return;
    if (!window.amplify?.saveIdea) {
      setStatus('IPC bridge not available — run in Electron');
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const result = await window.amplify.saveIdea({
        title: title.trim(),
        content: content.trim(),
        timestamp: new Date().toISOString(),
      });
      if (result.ok) {
        setTitle('');
        setContent('');
        setStatus('Idea saved.');
        await loadIdeas();
      }
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(110,231,183,0.2)',
    borderRadius: 6,
    padding: '8px 12px',
    color: '#e2e8f0',
    fontSize: 13,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 320,
        padding: 24,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#0a0f1a',
        gap: 16,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 24, lineHeight: 1 }}>🪶</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.3px' }}>
            Phoebe™ — Idea Storage
          </div>
          <div style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 500 }}>
            Your ideas, preserved. Forever.
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(110,231,183,0.15)' }} />

      {/* Input form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Idea title (optional)"
          style={inputStyle}
        />
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write your idea here..."
          rows={4}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleSave}
            disabled={saving || (!title.trim() && !content.trim())}
            style={{
              padding: '7px 18px',
              background: saving ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.7)',
              border: '1px solid rgba(99,102,241,0.5)',
              borderRadius: 6,
              color: '#e2e8f0',
              fontSize: 12,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              letterSpacing: '0.03em',
            }}
          >
            {saving ? 'Saving…' : 'Save Idea'}
          </button>
          {status && (
            <span style={{ fontSize: 11, color: '#6ee7b7' }}>{status}</span>
          )}
        </div>
      </div>

      {/* Saved ideas list */}
      {ideas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Saved Ideas ({ideas.length})
          </div>
          {ideas.map(idea => (
            <div
              key={idea.id}
              style={{
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(110,231,183,0.1)',
                borderRadius: 6,
              }}
            >
              {idea.title && (
                <div style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
                  {idea.title}
                </div>
              )}
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {idea.content}
              </div>
              <div style={{ fontSize: 10, color: '#334155', marginTop: 6 }}>
                {new Date(idea.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {ideas.length === 0 && (
        <div style={{ fontSize: 11, color: '#334155', textAlign: 'center', marginTop: 16, lineHeight: 1.8 }}>
          No ideas saved yet. Your ideas are stored locally — no cloud required.
        </div>
      )}
    </div>
  );
}

export default PhoebePage;
