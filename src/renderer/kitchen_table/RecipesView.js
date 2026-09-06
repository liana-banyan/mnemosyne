import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Recipes™ module — MnemosyneC™ v0.1.8 · SEG-FT-2 · BP052 NOVACULA
// Browse · create · AI-assist · photo handling
// ℃ = CAI symbol badge for AI-suggested recipes
import { useState, useEffect, useCallback } from 'react';
// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function emptyRecipe() {
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
    },
    left: {
        width: 220,
        minWidth: 180,
        borderRight: '1px solid rgba(100,116,139,0.2)',
        display: 'flex',
        flexDirection: 'column',
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
        boxSizing: 'border-box',
    },
    recipeList: {
        flex: 1,
        overflowY: 'auto',
        padding: '4px 0',
    },
    recipeItem: (active) => ({
        padding: '8px 10px',
        cursor: 'pointer',
        background: active ? 'rgba(110,231,183,0.06)' : 'transparent',
        borderLeft: active ? '2px solid #6ee7b7' : '2px solid transparent',
        transition: 'all 0.12s',
    }),
    recipeItemTitle: (active) => ({
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
        flexWrap: 'wrap',
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
        textAlign: 'center',
    },
    right: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    detailArea: {
        flex: 1,
        overflowY: 'auto',
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
        textTransform: 'uppercase',
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
        objectFit: 'cover',
        borderRadius: 6,
        border: '1px solid rgba(100,116,139,0.2)',
    },
    photoStrip: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 10,
        color: '#475569',
        fontSize: 12,
        textAlign: 'center',
    },
    actionBar: {
        display: 'flex',
        gap: 6,
        padding: '6px 16px',
        borderTop: '1px solid rgba(100,116,139,0.12)',
        background: 'rgba(10,15,26,0.5)',
    },
    btn: (variant = 'secondary') => ({
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
        boxSizing: 'border-box',
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
        resize: 'vertical',
        boxSizing: 'border-box',
        minHeight: 60,
    },
};
// ─── Component ────────────────────────────────────────────────────────────────
// ─── Starter recipes seed data ────────────────────────────────────────────────
const STARTER_RECIPES = [
    {
        title: "Grandma's Pasta",
        description: 'Simple, hearty tomato pasta the whole family loves. Ready in 25 minutes.',
        ingredients: [
            { name: 'Spaghetti', amount: '400', unit: 'g', optional: false },
            { name: 'Crushed tomatoes', amount: '400', unit: 'ml', optional: false },
            { name: 'Garlic', amount: '3', unit: 'cloves', optional: false },
            { name: 'Olive oil', amount: '2', unit: 'tbsp', optional: false },
            { name: 'Fresh basil', amount: 'handful', unit: '', optional: true },
        ],
        steps: [
            { stepNumber: 1, instruction: 'Boil pasta in salted water per package instructions.', durationMinutes: 12, photoRef: null },
            { stepNumber: 2, instruction: 'Sauté garlic in olive oil 2 min, add tomatoes, simmer 10 min.', durationMinutes: 12, photoRef: null },
            { stepNumber: 3, instruction: 'Drain pasta, toss with sauce. Top with fresh basil.', durationMinutes: 2, photoRef: null },
        ],
        photos: [],
        aiSuggested: false,
        authorId: 'local',
        tags: ['pasta', 'family', 'quick'],
    },
    {
        title: 'Tuesday Soup',
        description: 'Use whatever vegetables are in the fridge. Nourishing and zero-waste.',
        ingredients: [
            { name: 'Mixed vegetables (carrots, celery, onion)', amount: '4', unit: 'cups chopped', optional: false },
            { name: 'Chicken or vegetable broth', amount: '6', unit: 'cups', optional: false },
            { name: 'Garlic', amount: '2', unit: 'cloves', optional: false },
            { name: 'Salt and pepper', amount: 'to taste', unit: '', optional: false },
        ],
        steps: [
            { stepNumber: 1, instruction: 'Sauté onion and garlic in a pot until soft, ~3 min.', durationMinutes: 3, photoRef: null },
            { stepNumber: 2, instruction: 'Add remaining vegetables and broth. Bring to boil.', durationMinutes: 5, photoRef: null },
            { stepNumber: 3, instruction: 'Simmer 20 minutes until vegetables are tender. Season and serve.', durationMinutes: 20, photoRef: null },
        ],
        photos: [],
        aiSuggested: false,
        authorId: 'local',
        tags: ['soup', 'vegetables', 'healthy', 'zero-waste'],
    },
    {
        title: 'Saturday Pancakes',
        description: 'Weekend morning staple. Fluffy, golden, done in 20 minutes.',
        ingredients: [
            { name: 'All-purpose flour', amount: '1.5', unit: 'cups', optional: false },
            { name: 'Milk', amount: '1.25', unit: 'cups', optional: false },
            { name: 'Egg', amount: '1', unit: 'large', optional: false },
            { name: 'Baking powder', amount: '2', unit: 'tsp', optional: false },
            { name: 'Butter', amount: '2', unit: 'tbsp melted', optional: false },
            { name: 'Sugar', amount: '1', unit: 'tbsp', optional: false },
            { name: 'Salt', amount: '0.5', unit: 'tsp', optional: false },
        ],
        steps: [
            { stepNumber: 1, instruction: 'Whisk dry ingredients (flour, baking powder, sugar, salt).', durationMinutes: 2, photoRef: null },
            { stepNumber: 2, instruction: 'Mix wet ingredients (milk, egg, butter) separately, then combine. Do not overmix — lumps are fine.', durationMinutes: 2, photoRef: null },
            { stepNumber: 3, instruction: 'Cook on a buttered griddle over medium heat. Flip when bubbles form on surface.', durationMinutes: 10, photoRef: null },
        ],
        photos: [],
        aiSuggested: false,
        authorId: 'local',
        tags: ['breakfast', 'family', 'weekend'],
    },
];
export function RecipesView({ onScheduleMeal } = {}) {
    const [recipes, setRecipes] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState(emptyRecipe());
    const [aiLoading, setAiLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const load = useCallback(async () => {
        try {
            const data = await window.amplify?.kitchenTable?.listRecipes?.();
            const loaded = data ?? [];
            // Seed starter recipes if list is empty on first load
            if (loaded.length === 0) {
                const seeded = [];
                for (const r of STARTER_RECIPES) {
                    try {
                        const created = await window.amplify?.kitchenTable?.createRecipe?.(r);
                        if (created)
                            seeded.push(created);
                    }
                    catch { /* non-fatal */ }
                }
                setRecipes(seeded);
            }
            else {
                setRecipes(loaded);
            }
        }
        catch {
            setRecipes([]);
        }
        finally {
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
        if (!form.title.trim())
            return;
        try {
            const created = await window.amplify?.kitchenTable?.createRecipe?.(form);
            setRecipes((prev) => [...prev, created]);
            setSelectedId(created.id);
            setIsCreating(false);
            setForm(emptyRecipe());
        }
        catch (e) {
            console.error('[RecipesView] create failed', e);
        }
    }
    async function handleDelete(id) {
        try {
            await window.amplify?.kitchenTable?.deleteRecipe?.(id);
            setRecipes((prev) => prev.filter((r) => r.id !== id));
            if (selectedId === id)
                setSelectedId(null);
        }
        catch (e) {
            console.error('[RecipesView] delete failed', e);
        }
    }
    async function handleAiAssist() {
        if (!form.title.trim())
            return;
        setAiLoading(true);
        try {
            const prompt = `Suggest ingredients and steps for a recipe called "${form.title}". Format as JSON: { ingredients: [{name,amount,unit,optional}], steps: [{stepNumber,instruction,durationMinutes}] }`;
            const result = await window.amplify?.ai?.({ prompt });
            if (result?.text) {
                const match = result.text.match(/\{[\s\S]*\}/);
                if (match) {
                    const parsed = JSON.parse(match[0]);
                    setForm((f) => ({
                        ...f,
                        ingredients: parsed.ingredients ?? f.ingredients,
                        steps: (parsed.steps ?? []).map((s, i) => ({ ...s, stepNumber: i + 1, photoRef: null })),
                        aiSuggested: true,
                    }));
                }
            }
        }
        catch {
            // AI unavailable — fail gracefully
        }
        finally {
            setAiLoading(false);
        }
    }
    async function handleAddPhoto() {
        try {
            const path = await window.amplify?.kitchenTable?.openPhotoDialog?.();
            if (path) {
                const photo = { id: generateId(), localPath: path, caption: null, takenAt: new Date().toISOString() };
                setForm((f) => ({ ...f, photos: [...f.photos, photo] }));
            }
        }
        catch {
            // dialog unavailable
        }
    }
    if (loading) {
        return (_jsx("div", { style: { ...S.root, alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12 }, children: "Loading Recipes\u2122\u2026" }));
    }
    return (_jsxs("div", { style: S.root, children: [_jsxs("div", { style: S.left, children: [_jsx("div", { style: S.searchBar, children: _jsx("input", { style: S.searchInput, placeholder: "Search recipes or tags\u2026", value: search, onChange: (e) => setSearch(e.target.value) }) }), _jsxs("div", { style: S.recipeList, children: [filtered.length === 0 && (_jsx("div", { style: { padding: '12px 10px', fontSize: 10, color: '#475569', textAlign: 'center' }, children: search ? 'No matches' : 'No recipes yet' })), filtered.map((r) => (_jsxs("div", { style: S.recipeItem(selectedId === r.id && !isCreating), onClick: () => { setSelectedId(r.id); setIsCreating(false); }, children: [_jsxs("div", { style: S.recipeItemTitle(selectedId === r.id && !isCreating), children: [r.aiSuggested && _jsx("span", { title: "AI-suggested", style: { color: '#6ee7b7', fontSize: 10 }, children: "\u2103" }), r.title] }), _jsx("div", { style: S.recipeItemTags, children: r.tags.slice(0, 3).map((t) => _jsx("span", { style: S.tag, children: t }, t)) })] }, r.id)))] }), _jsx("button", { style: S.newBtn, onClick: () => { setIsCreating(true); setSelectedId(null); setForm(emptyRecipe()); }, children: "+ New Recipe" })] }), _jsx("div", { style: S.right, children: isCreating ? (_jsx(CreateForm, { form: form, setForm: setForm, aiLoading: aiLoading, onAiAssist: handleAiAssist, onAddPhoto: handleAddPhoto, onSave: handleCreate, onCancel: () => setIsCreating(false) })) : selected ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: S.detailArea, children: [_jsx("div", { style: S.detailHeader, children: _jsxs("div", { style: S.detailTitle, children: [selected.aiSuggested && _jsx("span", { style: S.aisBadge, children: "\u2103 AI" }), selected.title] }) }), selected.description && (_jsx("div", { style: { fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 1.6 }, children: selected.description })), selected.tags.length > 0 && (_jsx("div", { style: { display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }, children: selected.tags.map((t) => _jsx("span", { style: S.tag, children: t }, t)) })), selected.ingredients.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { style: S.sectionLabel, children: "Ingredients" }), selected.ingredients.map((ing, i) => (_jsxs("div", { style: S.ingredientRow, children: [_jsx("span", { style: { flex: 1, color: '#e2e8f0' }, children: ing.name }), _jsxs("span", { style: { color: '#64748b' }, children: [ing.amount, " ", ing.unit] }), ing.optional && _jsx("span", { style: { fontSize: 9, color: '#475569' }, children: "optional" })] }, i)))] })), selected.steps.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { style: S.sectionLabel, children: "Steps" }), selected.steps.map((step) => (_jsxs("div", { style: S.stepRow, children: [_jsx("div", { style: S.stepNum, children: step.stepNumber }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 11, color: '#e2e8f0', lineHeight: 1.6 }, children: step.instruction }), step.durationMinutes && (_jsxs("div", { style: { fontSize: 9, color: '#475569', marginTop: 2 }, children: ["\u23F1 ", step.durationMinutes, " min"] }))] })] }, step.stepNumber)))] })), selected.photos.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { style: S.sectionLabel, children: "Photos" }), _jsx("div", { style: S.photoStrip, children: selected.photos.map((p) => (_jsx("img", { src: `file://${p.localPath}`, alt: p.caption ?? 'Recipe photo', style: S.photoThumb, onError: (e) => { e.currentTarget.style.display = 'none'; } }, p.id))) })] }))] }), _jsxs("div", { style: S.actionBar, children: [onScheduleMeal && (_jsx("button", { style: { ...S.btn('primary'), flex: 1 }, onClick: () => onScheduleMeal(selected.title), title: "Open Atlas and schedule this meal", children: "\uD83D\uDCC5 Schedule this meal \u2192" })), _jsx("button", { style: S.btn('danger'), onClick: () => handleDelete(selected.id), children: "Delete" })] })] })) : (_jsxs("div", { style: S.emptyState, children: [_jsx("div", { style: { fontSize: 28 }, children: "\uD83C\uDF7D\uFE0F" }), _jsx("div", { style: { fontWeight: 600, color: '#64748b' }, children: "Recipes\u2122" }), _jsx("div", { style: { fontSize: 10, color: '#334155', maxWidth: 200, lineHeight: 1.6 }, children: "Select a recipe or create one with the Kitchen Table\u2122 AI assist" })] })) })] }));
}
// ─── Create Form ──────────────────────────────────────────────────────────────
function CreateForm({ form, setForm, aiLoading, onAiAssist, onAddPhoto, onSave, onCancel, }) {
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [_jsxs("div", { style: { flex: 1, overflowY: 'auto', padding: '14px 16px' }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#6ee7b7', marginBottom: 12 }, children: "New Recipe\u2122" }), _jsxs("div", { style: S.formField, children: [_jsx("label", { style: S.formLabel, children: "Title *" }), _jsx("input", { style: S.formInput, value: form.title, onChange: (e) => setForm((f) => ({ ...f, title: e.target.value })), placeholder: "e.g. Grandma's Lasagna" })] }), _jsxs("div", { style: S.formField, children: [_jsx("label", { style: S.formLabel, children: "Description" }), _jsx("textarea", { style: S.formTextarea, value: form.description, onChange: (e) => setForm((f) => ({ ...f, description: e.target.value })), placeholder: "A short description of this recipe\u2026" })] }), _jsxs("div", { style: S.formField, children: [_jsx("label", { style: S.formLabel, children: "Tags (comma-separated)" }), _jsx("input", { style: S.formInput, value: form.tags.join(', '), onChange: (e) => setForm((f) => ({ ...f, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })), placeholder: "e.g. Italian, family, dinner" })] }), _jsxs("div", { style: { display: 'flex', gap: 6, marginBottom: 10 }, children: [_jsx("button", { style: { ...S.btn('primary'), opacity: aiLoading ? 0.6 : 1 }, onClick: onAiAssist, disabled: aiLoading || !form.title.trim(), title: "Let CAI suggest ingredients and steps based on the title", children: aiLoading ? '℃ Suggesting…' : '℃ AI Assist' }), _jsx("button", { style: S.btn('secondary'), onClick: onAddPhoto, title: "Attach a photo", children: "\uD83D\uDCF7 Photo" })] }), form.aiSuggested && (_jsx("div", { style: { fontSize: 9, color: '#6ee7b7', marginBottom: 8 }, children: "\u2103 AI-suggested content added below" })), form.photos.length > 0 && (_jsx("div", { style: { ...S.photoStrip, marginBottom: 10 }, children: form.photos.map((p) => (_jsx("img", { src: `file://${p.localPath}`, alt: "Recipe", style: S.photoThumb, onError: (e) => { e.currentTarget.style.display = 'none'; } }, p.id))) })), form.ingredients.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { style: S.sectionLabel, children: "Ingredients (AI-suggested)" }), form.ingredients.map((ing, i) => (_jsxs("div", { style: S.ingredientRow, children: [_jsx("span", { style: { flex: 1, color: '#e2e8f0' }, children: ing.name }), _jsxs("span", { style: { color: '#64748b' }, children: [ing.amount, " ", ing.unit] })] }, i)))] })), form.steps.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { style: S.sectionLabel, children: "Steps (AI-suggested)" }), form.steps.map((step) => (_jsxs("div", { style: S.stepRow, children: [_jsx("div", { style: S.stepNum, children: step.stepNumber }), _jsx("div", { style: { fontSize: 11, color: '#e2e8f0', lineHeight: 1.6 }, children: step.instruction })] }, step.stepNumber)))] }))] }), _jsxs("div", { style: S.actionBar, children: [_jsx("button", { style: S.btn('secondary'), onClick: onCancel, children: "Cancel" }), _jsx("button", { style: { ...S.btn('primary'), opacity: form.title.trim() ? 1 : 0.5 }, onClick: onSave, disabled: !form.title.trim(), children: "Save Recipe\u2122" })] })] }));
}
