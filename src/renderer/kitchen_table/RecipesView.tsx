// Recipes™ module — Mnemosyne™ v0.1.8 · SEG-FT-2 · BP052 NOVACULA
// Browse · create · AI-assist · photo handling
// ℃ = CAI symbol badge for AI-suggested recipes

import React, { useState, useEffect, useCallback } from 'react';
import type { Recipe, Ingredient, RecipeStep, PhotoRef } from '../../shared/kitchen_table_types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function emptyRecipe(): Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: '',
    description: '',
    ingredients: [],
    steps: [],
    photos: [],
    aiSuggested: false,
    authorId: 'local',
    tags: [],
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,
  left: {
    width: 220,
    minWidth: 180,
    borderRight: '1px solid rgba(100,116,139,0.2)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  searchBar: {
    padding: '10px 10px 6px',
    borderBottom: '1px solid rgba(100,116,139,0.12)',
  },
  searchInput: {
    width: '100%',
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: 11,
    padding: '5px 8px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  recipeList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '4px 0',
  },
  recipeItem: (active: boolean): React.CSSProperties => ({
    padding: '8px 10px',
    cursor: 'pointer',
    background: active ? 'rgba(110,231,183,0.06)' : 'transparent',
    borderLeft: active ? '2px solid #6ee7b7' : '2px solid transparent',
    transition: 'all 0.12s',
  }),
  recipeItemTitle: (active: boolean): React.CSSProperties => ({
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    color: active ? '#e2e8f0' : '#94a3b8',
    marginBottom: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  }),
  recipeItemTags: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 3,
  },
  tag: {
    fontSize: 8,
    background: 'rgba(100,116,139,0.12)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 8,
    color: '#64748b',
    padding: '1px 5px',
  },
  newBtn: {
    margin: '8px 10px',
    padding: '6px 0',
    background: 'rgba(110,231,183,0.08)',
    border: '1px solid rgba(110,231,183,0.2)',
    borderRadius: 6,
    color: '#6ee7b7',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center' as const,
  },
  right: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  detailArea: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '14px 16px',
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  aisBadge: {
    fontSize: 10,
    color: '#6ee7b7',
    background: 'rgba(110,231,183,0.1)',
    border: '1px solid rgba(110,231,183,0.2)',
    borderRadius: 10,
    padding: '1px 6px',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 6,
    marginTop: 14,
  },
  ingredientRow: {
    display: 'flex',
    gap: 6,
    fontSize: 11,
    color: '#94a3b8',
    padding: '4px 0',
    borderBottom: '1px solid rgba(100,116,139,0.08)',
    alignItems: 'center',
  },
  stepRow: {
    display: 'flex',
    gap: 10,
    padding: '6px 0',
    borderBottom: '1px solid rgba(100,116,139,0.08)',
    alignItems: 'flex-start',
  },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'rgba(110,231,183,0.1)',
    border: '1px solid rgba(110,231,183,0.2)',
    color: '#6ee7b7',
    fontSize: 9,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  photoThumb: {
    width: 60,
    height: 60,
    objectFit: 'cover' as const,
    borderRadius: 6,
    border: '1px solid rgba(100,116,139,0.2)',
  },
  photoStrip: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 10,
    color: '#475569',
    fontSize: 12,
    textAlign: 'center' as const,
  },
  actionBar: {
    display: 'flex',
    gap: 6,
    padding: '6px 16px',
    borderTop: '1px solid rgba(100,116,139,0.12)',
    background: 'rgba(10,15,26,0.5)',
  },
  btn: (variant: 'primary' | 'secondary' | 'danger' = 'secondary'): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
    border: variant === 'primary'
      ? '1px solid rgba(110,231,183,0.35)'
      : variant === 'danger'
      ? '1px solid rgba(248,113,113,0.35)'
      : '1px solid rgba(100,116,139,0.2)',
    background: variant === 'primary'
      ? 'rgba(110,231,183,0.1)'
      : variant === 'danger'
      ? 'rgba(248,113,113,0.08)'
      : 'rgba(100,116,139,0.06)',
    color: variant === 'primary' ? '#6ee7b7' : variant === 'danger' ? '#f87171' : '#94a3b8',
  }),
  formField: {
    marginBottom: 10,
  },
  formLabel: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 3,
    display: 'block',
  },
  formInput: {
    width: '100%',
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: 11,
    padding: '5px 8px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  formTextarea: {
    width: '100%',
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(100,116,139,0.2)',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: 11,
    padding: '5px 8px',
    outline: 'none',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    minHeight: 60,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function RecipesView() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(emptyRecipe());
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await window.amplify?.kitchenTable?.listRecipes?.() as Recipe[];
      setRecipes(data ?? []);
    } catch {
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = recipes.filter((r) => {
    const q = search.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q));
  });

  const selected = recipes.find((r) => r.id === selectedId) ?? null;

  async function handleCreate() {
    if (!form.title.trim()) return;
    try {
      const created = await window.amplify?.kitchenTable?.createRecipe?.(form) as Recipe;
      setRecipes((prev) => [...prev, created]);
      setSelectedId(created.id);
      setIsCreating(false);
      setForm(emptyRecipe());
    } catch (e) {
      console.error('[RecipesView] create failed', e);
    }
  }

  async function handleDelete(id: string) {
    try {
      await window.amplify?.kitchenTable?.deleteRecipe?.(id);
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (e) {
      console.error('[RecipesView] delete failed', e);
    }
  }

  async function handleAiAssist() {
    if (!form.title.trim()) return;
    setAiLoading(true);
    try {
      const prompt = `Suggest ingredients and steps for a recipe called "${form.title}". Format as JSON: { ingredients: [{name,amount,unit,optional}], steps: [{stepNumber,instruction,durationMinutes}] }`;
      const result = await (window.amplify as any)?.ai?.({ prompt }) as { text?: string } | null;
      if (result?.text) {
        const match = result.text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as { ingredients?: Ingredient[]; steps?: RecipeStep[] };
          setForm((f) => ({
            ...f,
            ingredients: parsed.ingredients ?? f.ingredients,
            steps: (parsed.steps ?? []).map((s, i) => ({ ...s, stepNumber: i + 1, photoRef: null })),
            aiSuggested: true,
          }));
        }
      }
    } catch {
      // AI unavailable — fail gracefully
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAddPhoto() {
    try {
      const path = await window.amplify?.kitchenTable?.openPhotoDialog?.() as string | null;
      if (path) {
        const photo: PhotoRef = { id: generateId(), localPath: path, caption: null, takenAt: new Date().toISOString() };
        setForm((f) => ({ ...f, photos: [...f.photos, photo] }));
      }
    } catch {
      // dialog unavailable
    }
  }

  if (loading) {
    return (
      <div style={{ ...S.root, alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12 }}>
        Loading Recipes™…
      </div>
    );
  }

  return (
    <div style={S.root}>
      {/* Left panel — recipe list */}
      <div style={S.left}>
        <div style={S.searchBar}>
          <input
            style={S.searchInput}
            placeholder="Search recipes or tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={S.recipeList}>
          {filtered.length === 0 && (
            <div style={{ padding: '12px 10px', fontSize: 10, color: '#475569', textAlign: 'center' }}>
              {search ? 'No matches' : 'No recipes yet'}
            </div>
          )}
          {filtered.map((r) => (
            <div
              key={r.id}
              style={S.recipeItem(selectedId === r.id && !isCreating)}
              onClick={() => { setSelectedId(r.id); setIsCreating(false); }}
            >
              <div style={S.recipeItemTitle(selectedId === r.id && !isCreating)}>
                {r.aiSuggested && <span title="AI-suggested" style={{ color: '#6ee7b7', fontSize: 10 }}>℃</span>}
                {r.title}
              </div>
              <div style={S.recipeItemTags}>
                {r.tags.slice(0, 3).map((t) => <span key={t} style={S.tag}>{t}</span>)}
              </div>
            </div>
          ))}
        </div>
        <button style={S.newBtn} onClick={() => { setIsCreating(true); setSelectedId(null); setForm(emptyRecipe()); }}>
          + New Recipe
        </button>
      </div>

      {/* Right panel — detail or creation form */}
      <div style={S.right}>
        {isCreating ? (
          <CreateForm
            form={form}
            setForm={setForm}
            aiLoading={aiLoading}
            onAiAssist={handleAiAssist}
            onAddPhoto={handleAddPhoto}
            onSave={handleCreate}
            onCancel={() => setIsCreating(false)}
          />
        ) : selected ? (
          <>
            <div style={S.detailArea}>
              <div style={S.detailHeader}>
                <div style={S.detailTitle}>
                  {selected.aiSuggested && <span style={S.aisBadge}>℃ AI</span>}
                  {selected.title}
                </div>
              </div>
              {selected.description && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.6 }}>
                  {selected.description}
                </div>
              )}
              {selected.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                  {selected.tags.map((t) => <span key={t} style={S.tag}>{t}</span>)}
                </div>
              )}
              {selected.ingredients.length > 0 && (
                <>
                  <div style={S.sectionLabel}>Ingredients</div>
                  {selected.ingredients.map((ing, i) => (
                    <div key={i} style={S.ingredientRow}>
                      <span style={{ flex: 1, color: '#e2e8f0' }}>{ing.name}</span>
                      <span style={{ color: '#64748b' }}>{ing.amount} {ing.unit}</span>
                      {ing.optional && <span style={{ fontSize: 9, color: '#475569' }}>optional</span>}
                    </div>
                  ))}
                </>
              )}
              {selected.steps.length > 0 && (
                <>
                  <div style={S.sectionLabel}>Steps</div>
                  {selected.steps.map((step) => (
                    <div key={step.stepNumber} style={S.stepRow}>
                      <div style={S.stepNum}>{step.stepNumber}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: '#e2e8f0', lineHeight: 1.6 }}>{step.instruction}</div>
                        {step.durationMinutes && (
                          <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>⏱ {step.durationMinutes} min</div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
              {selected.photos.length > 0 && (
                <>
                  <div style={S.sectionLabel}>Photos</div>
                  <div style={S.photoStrip}>
                    {selected.photos.map((p) => (
                      <img
                        key={p.id}
                        src={`file://${p.localPath}`}
                        alt={p.caption ?? 'Recipe photo'}
                        style={S.photoThumb}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            <div style={S.actionBar}>
              <button style={S.btn('danger')} onClick={() => handleDelete(selected.id)}>Delete</button>
            </div>
          </>
        ) : (
          <div style={S.emptyState}>
            <div style={{ fontSize: 28 }}>🍽️</div>
            <div style={{ fontWeight: 600, color: '#64748b' }}>Recipes™</div>
            <div style={{ fontSize: 10, color: '#334155', maxWidth: 200, lineHeight: 1.6 }}>
              Select a recipe or create one with the Kitchen Table™ AI assist
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Form ──────────────────────────────────────────────────────────────

function CreateForm({
  form,
  setForm,
  aiLoading,
  onAiAssist,
  onAddPhoto,
  onSave,
  onCancel,
}: {
  form: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>;
  setForm: React.Dispatch<React.SetStateAction<Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>>>;
  aiLoading: boolean;
  onAiAssist: () => void;
  onAddPhoto: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#6ee7b7', marginBottom: 12 }}>New Recipe™</div>

        <div style={S.formField}>
          <label style={S.formLabel}>Title *</label>
          <input
            style={S.formInput}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Grandma's Lasagna"
          />
        </div>

        <div style={S.formField}>
          <label style={S.formLabel}>Description</label>
          <textarea
            style={S.formTextarea}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="A short description of this recipe…"
          />
        </div>

        <div style={S.formField}>
          <label style={S.formLabel}>Tags (comma-separated)</label>
          <input
            style={S.formInput}
            value={form.tags.join(', ')}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }))}
            placeholder="e.g. Italian, family, dinner"
          />
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            style={{ ...S.btn('primary'), opacity: aiLoading ? 0.6 : 1 }}
            onClick={onAiAssist}
            disabled={aiLoading || !form.title.trim()}
            title="Let CAI suggest ingredients and steps based on the title"
          >
            {aiLoading ? '℃ Suggesting…' : '℃ AI Assist'}
          </button>
          <button style={S.btn('secondary')} onClick={onAddPhoto} title="Attach a photo">
            📷 Photo
          </button>
        </div>

        {form.aiSuggested && (
          <div style={{ fontSize: 9, color: '#6ee7b7', marginBottom: 8 }}>℃ AI-suggested content added below</div>
        )}

        {form.photos.length > 0 && (
          <div style={{ ...S.photoStrip, marginBottom: 10 }}>
            {form.photos.map((p) => (
              <img key={p.id} src={`file://${p.localPath}`} alt="Recipe" style={S.photoThumb}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            ))}
          </div>
        )}

        {form.ingredients.length > 0 && (
          <>
            <div style={S.sectionLabel}>Ingredients (AI-suggested)</div>
            {form.ingredients.map((ing, i) => (
              <div key={i} style={S.ingredientRow}>
                <span style={{ flex: 1, color: '#e2e8f0' }}>{ing.name}</span>
                <span style={{ color: '#64748b' }}>{ing.amount} {ing.unit}</span>
              </div>
            ))}
          </>
        )}

        {form.steps.length > 0 && (
          <>
            <div style={S.sectionLabel}>Steps (AI-suggested)</div>
            {form.steps.map((step) => (
              <div key={step.stepNumber} style={S.stepRow}>
                <div style={S.stepNum}>{step.stepNumber}</div>
                <div style={{ fontSize: 11, color: '#e2e8f0', lineHeight: 1.6 }}>{step.instruction}</div>
              </div>
            ))}
          </>
        )}
      </div>

      <div style={S.actionBar}>
        <button style={S.btn('secondary')} onClick={onCancel}>Cancel</button>
        <button
          style={{ ...S.btn('primary'), opacity: form.title.trim() ? 1 : 0.5 }}
          onClick={onSave}
          disabled={!form.title.trim()}
        >
          Save Recipe™
        </button>
      </div>
    </div>
  );
}
