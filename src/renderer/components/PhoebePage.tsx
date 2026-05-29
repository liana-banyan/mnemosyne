// PhoebePage™ — Idea Storage
// Phoebe™ is the Mnemosyne sub-component for Idea Storage / inspiration boards.
// Named after the Greek Titaness. Zero ads. Member IP retained.
// IPC stubs: window.amplify.phoebe?.save() and window.amplify.phoebe?.list()
// Cooperative-class alternative to Pinterest / Are.na.

import React, { useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IdeaItem {
  id: string | number;
  title: string;
  body?: string;
  url?: string;
  tags?: string[];
  saved_at: string;
}

interface SaveForm {
  title: string;
  body: string;
  url: string;
  tags: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PhoebePage() {
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [form, setForm] = useState<SaveForm>({ title: '', body: '', url: '', tags: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [ipcAvailable, setIpcAvailable] = useState<boolean | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<IdeaItem | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const api = (window.amplify as any)?.phoebe;
    setIpcAvailable(!!api?.save && !!api?.list);
    if (api?.list) {
      api.list().then((items: IdeaItem[]) => setIdeas(items ?? [])).catch(() => {});
    }
  }, []);

  function handleField(field: keyof SaveForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const api = (window.amplify as any)?.phoebe;
      const tagsArr = form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : undefined;
      const payload = {
        title: form.title.trim(),
        body: form.body.trim() || undefined,
        url: form.url.trim() || undefined,
        tags: tagsArr,
      };
      if (api?.save) {
        const result = await api.save(payload);
        const newItem: IdeaItem = {
          id: (result as any)?.id ?? Date.now(),
          ...payload,
          saved_at: new Date().toISOString(),
        };
        setIdeas((prev) => [newItem, ...prev]);
      } else {
        const newItem: IdeaItem = {
          id: Date.now(),
          ...payload,
          saved_at: new Date().toISOString(),
        };
        setIdeas((prev) => [newItem, ...prev]);
      }
      setForm({ title: '', body: '', url: '', tags: '' });
      setSaveMsg({ type: 'ok', text: 'Idea saved.' });
      titleRef.current?.focus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveMsg({ type: 'error', text: msg });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px', flexShrink: 0,
        borderBottom: '1px solid rgba(100,116,139,0.12)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.3px' }}>
          Idea Storage™
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
          Collect articles, URLs, and inspiration — your IP retained, zero ads
        </div>
      </div>

      {/* IPC unavailable banner */}
      {ipcAvailable === false && (
        <div style={{
          margin: '8px 20px 0', padding: '8px 12px',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 8, fontSize: 10, color: '#fbbf24',
          flexShrink: 0,
        }}>
          Idea Storage coming soon — infrastructure connecting…
        </div>
      )}

      {/* Body: two-pane layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left pane — saved ideas list (1/3) */}
        <div style={{
          width: '33%', borderRight: '1px solid rgba(100,116,139,0.12)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}>
          <div style={{
            padding: '10px 14px 6px', fontSize: 10, fontWeight: 600, color: '#475569',
            textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
          }}>
            Saved Ideas ({ideas.length})
          </div>

          {ideas.length === 0 && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '20px 14px', gap: 8, textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, opacity: 0.3 }}>💡</div>
              <div style={{ fontSize: 10, color: '#334155', lineHeight: 1.6 }}>
                No ideas saved yet
              </div>
              <div style={{ fontSize: 9, color: '#1e293b', lineHeight: 1.6 }}>
                Use the form on the right to save your first idea.
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 16px' }}>
            {ideas.map((idea) => {
              const isSelected = selectedIdea?.id === idea.id;
              return (
                <button
                  key={idea.id}
                  onClick={() => setSelectedIdea(isSelected ? null : idea)}
                  style={{
                    width: '100%', textAlign: 'left',
                    background: isSelected ? 'rgba(110,231,183,0.07)' : 'transparent',
                    border: `1px solid ${isSelected ? 'rgba(110,231,183,0.2)' : 'rgba(100,116,139,0.1)'}`,
                    borderRadius: 8, padding: '9px 10px', cursor: 'pointer',
                    marginBottom: 5, transition: 'all 0.12s',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.3 }}>
                    {idea.title}
                  </div>
                  {idea.url && (
                    <div style={{
                      fontSize: 9, color: '#6ee7b7', marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      🔗 {idea.url}
                    </div>
                  )}
                  {idea.tags && idea.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                      {idea.tags.map((tag) => (
                        <span key={tag} style={{
                          fontSize: 8, background: 'rgba(110,231,183,0.08)',
                          border: '1px solid rgba(110,231,183,0.15)',
                          color: '#6ee7b7', borderRadius: 6, padding: '1px 5px',
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 8, color: '#334155', marginTop: 4 }}>
                    {new Date(idea.saved_at).toLocaleDateString()}
                  </div>

                  {isSelected && idea.body && (
                    <div style={{
                      marginTop: 8, padding: '7px 9px',
                      background: 'rgba(100,116,139,0.06)',
                      border: '1px solid rgba(100,116,139,0.12)',
                      borderRadius: 6, fontSize: 10, color: '#94a3b8', lineHeight: 1.6,
                    }}>
                      {idea.body}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right pane — save form (2/3) */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 20px 24px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
            Save an idea
          </div>

          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
              Title <span style={{ color: '#475569' }}>*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={form.title}
              onChange={(e) => handleField('title', e.target.value)}
              placeholder="Name this idea…"
              style={{
                background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)',
                borderRadius: 7, padding: '8px 10px', color: '#e2e8f0', fontSize: 11,
                outline: 'none',
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave(); }}
            />
          </div>

          {/* Body / Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
              Notes <span style={{ color: '#334155' }}>(optional)</span>
            </label>
            <textarea
              value={form.body}
              onChange={(e) => handleField('body', e.target.value)}
              placeholder="Write notes, paste a snippet, or describe the idea…"
              rows={5}
              style={{
                background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)',
                borderRadius: 7, padding: '8px 10px', color: '#e2e8f0', fontSize: 11,
                outline: 'none', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
              URL <span style={{ color: '#334155' }}>(optional)</span>
            </label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => handleField('url', e.target.value)}
              placeholder="https://…"
              style={{
                background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)',
                borderRadius: 7, padding: '8px 10px', color: '#6ee7b7', fontSize: 11,
                outline: 'none',
              }}
            />
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
              Tags <span style={{ color: '#334155' }}>(optional, comma-separated)</span>
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => handleField('tags', e.target.value)}
              placeholder="inspiration, article, research…"
              style={{
                background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.2)',
                borderRadius: 7, padding: '8px 10px', color: '#e2e8f0', fontSize: 11,
                outline: 'none',
              }}
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            style={{
              background: form.title.trim()
                ? 'rgba(110,231,183,0.12)'
                : 'rgba(100,116,139,0.08)',
              border: `1px solid ${form.title.trim() ? 'rgba(110,231,183,0.35)' : 'rgba(100,116,139,0.15)'}`,
              color: form.title.trim() ? '#6ee7b7' : '#334155',
              borderRadius: 8, padding: '9px 0',
              fontSize: 12, fontWeight: 700, cursor: saving || !form.title.trim() ? 'not-allowed' : 'pointer',
              width: '100%', transition: 'all 0.15s',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : '💾 Save Idea'}
          </button>

          {/* Feedback message */}
          {saveMsg && (
            <div style={{
              padding: '7px 10px', borderRadius: 7, fontSize: 10, fontWeight: 600,
              background: saveMsg.type === 'ok' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${saveMsg.type === 'ok' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              color: saveMsg.type === 'ok' ? '#4ade80' : '#f87171',
            }}>
              {saveMsg.text}
            </div>
          )}

          <div style={{ fontSize: 9, color: '#1e293b', marginTop: 4 }}>
            ⌘+Enter or Ctrl+Enter to save quickly
          </div>
        </div>
      </div>
    </div>
  );
}
