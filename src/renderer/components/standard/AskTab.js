import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SEG-K23-D — Ask tab: marketplace shelf + Areopagus query + membership link
import { useState, useEffect } from 'react';
import { AreopagusQueryPane } from '../AreopagusQueryPane';
function ChocolatesShelf() {
    const [plugins, setPlugins] = useState([]);
    useEffect(() => {
        let cancelled = false;
        async function fetchPlugins() {
            try {
                const res = await fetch('http://localhost:11480/yoke/marketplace/plugins');
                if (!res.ok)
                    return;
                const data = await res.json();
                if (!cancelled && Array.isArray(data) && data.length > 0) {
                    setPlugins(data);
                }
                else if (!cancelled && data?.plugins && Array.isArray(data.plugins) && data.plugins.length > 0) {
                    setPlugins(data.plugins);
                }
            }
            catch {
                /* silent — empty or unavailable */
            }
        }
        void fetchPlugins();
        return () => { cancelled = true; };
    }, []);
    if (plugins.length === 0)
        return null;
    return (_jsxs("div", { style: { marginBottom: 8, flexShrink: 0 }, children: [_jsx("div", { style: { fontSize: 10, color: '#606060', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }, children: "Active Packages" }), _jsx("ul", { style: { margin: 0, padding: '0 0 0 16px', fontSize: 11, color: '#707070', lineHeight: 1.6 }, children: plugins.map((p, i) => (_jsx("li", { children: p.name ?? p.id ?? 'Unknown plugin' }, p.id ?? p.name ?? i))) })] }));
}
export function AskTab(_props) {
    return (_jsxs("div", { style: {
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: 8,
        }, children: [_jsx(ChocolatesShelf, {}), _jsx("div", { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }, children: _jsx(AreopagusQueryPane, {}) }), _jsx("button", { type: "button", onClick: () => window.amplify?.openExternal?.('https://mnemosynec.org'), style: {
                    position: 'absolute',
                    bottom: 16,
                    right: 16,
                    fontSize: 12,
                    opacity: 0.6,
                    padding: '4px 10px',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(100, 200, 150, 0.4)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: '#8bc8a0',
                }, children: "Join \u2014 $5/year" })] }));
}
