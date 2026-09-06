import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SEG-K23-D — The Kitchen: recipes + Node Captain bounties
import { useState, useEffect, useCallback } from 'react';
import { BountyPoster } from './BountyPoster';
export function TheKitchenTab(_props) {
    const [recipes, setRecipes] = useState([]);
    const [recipesLoaded, setRecipesLoaded] = useState(false);
    const [toast, setToast] = useState(null);
    useEffect(() => {
        let cancelled = false;
        async function fetchRecipes() {
            try {
                const res = await fetch('http://localhost:11480/yoke/recipes');
                if (res.status === 404) {
                    if (!cancelled) {
                        setRecipes([]);
                        setRecipesLoaded(true);
                    }
                    return;
                }
                if (!res.ok) {
                    if (!cancelled)
                        setRecipesLoaded(true);
                    return;
                }
                const data = await res.json();
                if (!cancelled) {
                    const list = Array.isArray(data) ? data : data?.recipes ?? [];
                    setRecipes(list);
                    setRecipesLoaded(true);
                }
            }
            catch {
                if (!cancelled)
                    setRecipesLoaded(true);
            }
        }
        void fetchRecipes();
        return () => { cancelled = true; };
    }, []);
    useEffect(() => {
        if (!toast)
            return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);
    const handleClaim = useCallback(async (posterId) => {
        try {
            const res = await fetch('http://localhost:11480/yoke/ip_ledger/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    registered_by: 'anonymous',
                    claim: 'BOUNTY_CLAIM',
                    claim_body: posterId,
                    category: 'other',
                }),
            });
            if (res.ok) {
                setToast('Claimed! Check your IP Ledger.');
            }
        }
        catch {
            /* silent — endpoint may be offline */
        }
    }, []);
    return (_jsxs("div", { style: { padding: 16, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }, children: [toast && (_jsx("div", { style: {
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    marginBottom: 12,
                    padding: '8px 12px',
                    backgroundColor: 'rgba(100, 200, 150, 0.15)',
                    border: '1px solid rgba(100, 200, 150, 0.4)',
                    borderRadius: 4,
                    fontSize: 12,
                    color: '#8bc8a0',
                }, children: toast })), _jsx("div", { style: { fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }, children: "The Kitchen" }), _jsx("div", { style: { fontSize: 11, color: '#707070', marginBottom: 20, lineHeight: 1.5 }, children: "Recipe Repository \u00B7 Cooperative meal planning \u00B7 Let's Make Dinner + Let's Get Groceries" }), _jsxs("div", { style: { marginBottom: 24 }, children: [_jsx("div", { style: { fontSize: 12, color: '#7a9b8a', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }, children: "Recipe Repository" }), recipesLoaded && recipes.length === 0 && (_jsx("div", { style: { fontSize: 12, color: '#606060', fontStyle: 'italic' }, children: "No recipes yet. Be the first to add one!" })), recipes.length > 0 && (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: recipes.slice(0, 5).map((recipe, i) => (_jsx("div", { style: {
                                padding: '10px 12px',
                                backgroundColor: 'rgba(30, 40, 50, 0.6)',
                                border: '1px solid rgba(100, 200, 150, 0.2)',
                                borderRadius: 4,
                                fontSize: 12,
                                color: '#a0b0a8',
                            }, children: recipe.name ?? recipe.title ?? `Recipe ${i + 1}` }, recipe.id ?? recipe.name ?? i))) }))] }), _jsx("button", { type: "button", disabled: true, title: "Recipe submission coming in next update.", style: {
                    marginBottom: 24,
                    padding: '6px 14px',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(100, 100, 100, 0.3)',
                    borderRadius: 4,
                    color: '#505050',
                    fontSize: 12,
                    cursor: 'not-allowed',
                    opacity: 0.6,
                }, children: "Add a Recipe (coming soon)" }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 16 }, children: [_jsx(BountyPoster, { posterId: "node-captain-groceries", headline: "Node Captain \u2014 Take the Wheel: Let's Get Groceries", whatIsNeeded: "A Node Captain to champion the Let's Get Groceries initiative in your city \u2014 coordinating group grocery procurement and bulk purchasing.", whyItMatters: "Group buying power reduces food costs for cooperative members. The platform handles splits, payments, and fulfillment coordination.", memberGets: "Marks + naming credit as city chapter Node Captain + patent floater eligibility", onClaim: handleClaim }), _jsx(BountyPoster, { posterId: "node-captain-dinner", headline: "Node Captain \u2014 Take the Wheel: Let's Make Dinner", whatIsNeeded: "A Node Captain for Let's Make Dinner in your city \u2014 home-chef coordination, shared cooking resources, cooperative meal-planning.", whyItMatters: "Home chefs on the cooperative earn on every meal-prep session. A Node Captain seeds the local chapter and earns founding attribution.", memberGets: "Marks + naming credit + patent floater eligibility", onClaim: handleClaim })] })] }));
}
