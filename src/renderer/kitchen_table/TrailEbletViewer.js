import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Trail Eblet Viewer — KniPr035 · Pawn Phase 3 output renderer
// Renders .eblet.md files from ~/.claude/state/eblets/TRAILS/
// Displays: YAML header card · path fingerprint · bounty proposal · link check table · screenshots · markdown body
import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match)
        return { meta: {}, body: content };
    const meta = {};
    for (const line of match[1].split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
            meta[key] = val;
        }
    }
    return { meta, body: match[2].trimStart() };
}
const DIFFICULTY_PALETTE = {
    easy: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.35)', text: '#4ade80' },
    moderate: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.35)', text: '#60a5fa' },
    strenuous: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.35)', text: '#fbbf24' },
    'very strenuous': { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.35)', text: '#f87171' },
    extreme: { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.35)', text: '#c084fc' },
};
function getDifficultyStyle(difficulty = '') {
    return DIFFICULTY_PALETTE[difficulty.toLowerCase()] ?? DIFFICULTY_PALETTE['moderate'];
}
/** Extract waypoints: numbered list items under any "Waypoint" heading */
function extractWaypoints(body) {
    const waypointSection = body.match(/##\s+[^\n]*[Ww]aypoint[^\n]*([\s\S]*?)(?=\n##|\n---|$)/);
    if (!waypointSection)
        return [];
    return [...waypointSection[1].matchAll(/^\d+\.\s+(.+)/gm)].map((m) => m[1].trim());
}
// ─── Sub-components ───────────────────────────────────────────────────────────
function HeaderCard({ meta, fileName }) {
    const diff = meta.difficulty ?? 'Moderate';
    const ds = getDifficultyStyle(diff);
    const trailLabel = fileName.replace('.eblet.md', '').replace(/_/g, ' ').replace(/^trail\s+/i, 'Trail ');
    return (_jsxs("div", { style: {
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(100,116,139,0.18)',
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#e2e8f0' }, children: trailLabel }), _jsx("span", { style: {
                            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                            background: ds.bg, border: `1px solid ${ds.border}`, borderRadius: 6,
                            color: ds.text, padding: '2px 8px',
                        }, children: diff })] }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 4 }, children: [
                    ['Surface', meta.surface],
                    ['Priority', meta.priority],
                    ['Locale', meta.locale],
                    ['Walker', meta.walker_id],
                    ['Dispatch', meta.dispatch_id],
                    ['Mark Weight', meta.mark_weight ? `${meta.mark_weight} marks` : undefined],
                ].filter(([, v]) => v).map(([k, v]) => (_jsxs("div", { style: { fontSize: 10, color: '#94a3b8' }, children: [_jsxs("span", { style: { color: '#475569' }, children: [k, ": "] }), _jsx("span", { style: { color: '#cbd5e1' }, children: v })] }, k))) })] }));
}
function BountyCard({ meta }) {
    const diff = meta.difficulty ?? 'Moderate';
    const marks = meta.mark_weight ?? '—';
    const ds = getDifficultyStyle(diff);
    return (_jsxs("div", { style: {
            background: ds.bg, border: `1px solid ${ds.border}`, borderRadius: 8,
            padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 10, fontWeight: 700, color: ds.text, textTransform: 'uppercase', letterSpacing: '0.06em' }, children: "Bounty Proposal" }), _jsxs("div", { style: { fontSize: 9, color: '#94a3b8', marginTop: 2 }, children: ["Difficulty: ", _jsx("span", { style: { color: ds.text }, children: diff })] })] }), _jsxs("div", { style: { textAlign: 'right' }, children: [_jsx("div", { style: { fontSize: 22, fontWeight: 800, color: ds.text, lineHeight: 1 }, children: marks }), _jsx("div", { style: { fontSize: 8, color: '#64748b', marginTop: 1 }, children: "marks" })] })] }));
}
function PathFingerprint({ waypoints }) {
    if (waypoints.length === 0)
        return null;
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 0 }, children: [_jsxs("div", { style: { fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }, children: ["Path Fingerprint \u2014 ", waypoints.length, " waypoints"] }), waypoints.map((wp, i) => (_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: 8 }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 16 }, children: [_jsx("div", { style: {
                                    width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                                    background: i === 0 ? 'rgba(110,231,183,0.3)' : i === waypoints.length - 1 ? 'rgba(251,191,36,0.3)' : 'rgba(100,116,139,0.15)',
                                    border: `1px solid ${i === 0 ? 'rgba(110,231,183,0.5)' : i === waypoints.length - 1 ? 'rgba(251,191,36,0.5)' : 'rgba(100,116,139,0.3)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 7, fontWeight: 700, color: '#94a3b8',
                                }, children: i + 1 }), i < waypoints.length - 1 && (_jsx("div", { style: { width: 1, height: 10, background: 'rgba(100,116,139,0.2)', margin: '1px 0' } }))] }), _jsx("div", { style: { fontSize: 10, color: '#94a3b8', lineHeight: 1.5, paddingBottom: i < waypoints.length - 1 ? 2 : 0 }, children: wp })] }, i)))] }));
}
function ScreenshotsGrid({ ebletPath }) {
    const [screenshots, setScreenshots] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (!ebletPath)
            return;
        setLoading(true);
        window.amplify?.trailEblet?.listScreenshots?.({ ebletPath })
            .then(async ({ files, dir }) => {
            const loaded = [];
            for (const f of files.slice(0, 12)) {
                try {
                    const res = await window.amplify.trailEblet.readScreenshot({ filePath: `${dir}\\${f}`.replace(/\//g, '\\') });
                    if (res?.ok)
                        loaded.push({ name: f, dataUrl: res.dataUrl });
                }
                catch { /* skip */ }
            }
            setScreenshots(loaded);
        })
            .catch(() => setScreenshots([]))
            .finally(() => setLoading(false));
    }, [ebletPath]);
    if (loading || screenshots.length === 0)
        return null;
    return (_jsxs("div", { children: [_jsxs("div", { style: { fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }, children: ["Screenshots (", screenshots.length, ")"] }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6 }, children: screenshots.map((s) => (_jsxs("div", { style: { border: '1px solid rgba(100,116,139,0.2)', borderRadius: 6, overflow: 'hidden', width: 100, flexShrink: 0 }, children: [_jsx("img", { src: s.dataUrl, alt: s.name, style: { width: '100%', height: 60, objectFit: 'cover', display: 'block' } }), _jsx("div", { style: { fontSize: 7, color: '#475569', padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: s.name })] }, s.name))) })] }));
}
// ─── Markdown Renderer ────────────────────────────────────────────────────────
const mdStyles = {
    wrapper: {
        fontSize: 11,
        color: '#94a3b8',
        lineHeight: 1.75,
        fontFamily: 'system-ui, -apple-system, sans-serif',
    },
};
function MarkdownBody({ content }) {
    return (_jsx("div", { style: mdStyles.wrapper, children: _jsx(ReactMarkdown, { components: {
                h1: ({ children }) => _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#e2e8f0', margin: '14px 0 6px' }, children: children }),
                h2: ({ children }) => _jsx("div", { style: { fontSize: 11, fontWeight: 700, color: '#cbd5e1', margin: '12px 0 4px', borderBottom: '1px solid rgba(100,116,139,0.12)', paddingBottom: 4 }, children: children }),
                h3: ({ children }) => _jsx("div", { style: { fontSize: 10, fontWeight: 700, color: '#94a3b8', margin: '10px 0 4px' }, children: children }),
                p: ({ children }) => _jsx("div", { style: { margin: '4px 0', color: '#94a3b8' }, children: children }),
                li: ({ children }) => _jsxs("div", { style: { margin: '2px 0 2px 12px', color: '#94a3b8', position: 'relative' }, children: [_jsx("span", { style: { position: 'absolute', left: -10, color: '#475569' }, children: "\u00B7" }), children] }),
                ol: ({ children }) => _jsx("div", { style: { margin: '4px 0', paddingLeft: 4 }, children: children }),
                ul: ({ children }) => _jsx("div", { style: { margin: '4px 0', paddingLeft: 4 }, children: children }),
                code: ({ children, className }) => {
                    const isBlock = className?.startsWith('language-');
                    return isBlock
                        ? _jsx("pre", { style: { background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(100,116,139,0.15)', borderRadius: 6, padding: '8px 10px', overflowX: 'auto', fontSize: 10, color: '#6ee7b7', margin: '6px 0' }, children: _jsx("code", { children: children }) })
                        : _jsx("code", { style: { background: 'rgba(100,116,139,0.12)', borderRadius: 3, padding: '0 4px', fontSize: 10, color: '#6ee7b7', fontFamily: 'monospace' }, children: children });
                },
                table: ({ children }) => _jsx("table", { style: { borderCollapse: 'collapse', width: '100%', fontSize: 10, margin: '8px 0' }, children: children }),
                th: ({ children }) => _jsx("th", { style: { background: 'rgba(100,116,139,0.1)', padding: '4px 8px', textAlign: 'left', color: '#cbd5e1', borderBottom: '1px solid rgba(100,116,139,0.2)', fontWeight: 700, fontSize: 9 }, children: children }),
                td: ({ children }) => _jsx("td", { style: { padding: '3px 8px', color: '#94a3b8', borderBottom: '1px solid rgba(100,116,139,0.08)' }, children: children }),
                blockquote: ({ children }) => _jsx("div", { style: { borderLeft: '2px solid rgba(110,231,183,0.3)', paddingLeft: 10, color: '#64748b', margin: '6px 0', fontStyle: 'italic' }, children: children }),
                a: ({ href, children }) => _jsx("a", { href: href, onClick: (e) => { e.preventDefault(); if (href)
                        window.amplify?.openExternal?.(href); }, style: { color: '#60a5fa', textDecoration: 'underline', cursor: 'pointer' }, children: children }),
                strong: ({ children }) => _jsx("strong", { style: { color: '#e2e8f0', fontWeight: 700 }, children: children }),
                hr: () => _jsx("hr", { style: { border: 'none', borderTop: '1px solid rgba(100,116,139,0.15)', margin: '10px 0' } }),
            }, children: content }) }));
}
// ─── Main Component ───────────────────────────────────────────────────────────
export function TrailEbletViewer() {
    const [files, setFiles] = useState([]);
    const [trailsDir, setTrailsDir] = useState('');
    const [selectedPath, setSelectedPath] = useState(null);
    const [rawContent, setRawContent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [listLoading, setListLoading] = useState(true);
    const [error, setError] = useState(null);
    const loadList = useCallback(async () => {
        setListLoading(true);
        try {
            const res = await window.amplify?.trailEblet?.list?.();
            if (res) {
                setTrailsDir(res.dir);
                setFiles(res.files.map((name) => ({ name, path: `${res.dir}\\${name}` })));
            }
        }
        catch { /* IPC not wired yet — show empty state */ }
        setListLoading(false);
    }, []);
    const loadFile = useCallback(async (filePath) => {
        setLoading(true);
        setError(null);
        setRawContent(null);
        try {
            const res = await window.amplify?.trailEblet?.read?.({ filePath });
            if (res?.ok && res.content) {
                setRawContent(res.content);
                setSelectedPath(filePath);
            }
            else {
                setError(res?.error ?? 'Failed to read file');
            }
        }
        catch (e) {
            setError(String(e));
        }
        setLoading(false);
    }, []);
    useEffect(() => { void loadList(); }, [loadList]);
    const parsed = rawContent ? parseFrontmatter(rawContent) : null;
    const waypoints = parsed ? extractWaypoints(parsed.body) : [];
    const selectedFile = files.find((f) => f.path === selectedPath);
    const PANEL_BG = 'rgba(10,15,26,0.95)';
    return (_jsxs("div", { style: { display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }, children: [_jsxs("div", { style: {
                    width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column',
                    borderRight: '1px solid rgba(100,116,139,0.12)', background: PANEL_BG, overflow: 'hidden',
                }, children: [_jsxs("div", { style: { padding: '8px 10px 6px', borderBottom: '1px solid rgba(100,116,139,0.1)', flexShrink: 0 }, children: [_jsx("div", { style: { fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }, children: "Trail Eblets" }), _jsx("div", { style: { fontSize: 8, color: '#334155', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: trailsDir, children: trailsDir || '~/.claude/state/eblets/TRAILS' })] }), _jsx("div", { style: { flex: 1, overflowY: 'auto', padding: '4px 0' }, children: listLoading ? (_jsx("div", { style: { fontSize: 9, color: '#334155', padding: '10px 12px' }, children: "Loading\u2026" })) : files.length === 0 ? (_jsx("div", { style: { fontSize: 9, color: '#334155', padding: '10px 12px', lineHeight: 1.6 }, children: "No trails yet \u2014 your cooperative history will appear here." })) : (files.map((f) => (_jsx("div", { onClick: () => void loadFile(f.path), style: {
                                padding: '5px 10px', cursor: 'pointer', fontSize: 9,
                                color: selectedPath === f.path ? '#e2e8f0' : '#94a3b8',
                                background: selectedPath === f.path ? 'rgba(99,102,241,0.12)' : 'transparent',
                                borderLeft: selectedPath === f.path ? '2px solid rgba(99,102,241,0.5)' : '2px solid transparent',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                transition: 'background 0.1s',
                            }, title: f.name, children: f.name.replace('.eblet.md', '') }, f.path)))) }), _jsx("div", { style: { padding: '6px 10px', borderTop: '1px solid rgba(100,116,139,0.1)', flexShrink: 0 }, children: _jsx("button", { onClick: () => void loadList(), style: {
                                width: '100%', padding: '4px 0', fontSize: 9, fontWeight: 600,
                                background: 'rgba(100,116,139,0.06)', border: '1px solid rgba(100,116,139,0.2)',
                                borderRadius: 5, color: '#64748b', cursor: 'pointer',
                            }, children: "\u21BA Refresh" }) })] }), _jsxs("div", { style: { flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }, children: [loading && (_jsx("div", { style: { color: '#475569', fontSize: 11, padding: '20px 0', textAlign: 'center' }, children: "Loading trail\u2026" })), error && (_jsx("div", { style: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '10px 12px', color: '#f87171', fontSize: 10 }, children: error })), !loading && !error && !rawContent && (_jsx("div", { style: { color: '#334155', fontSize: 11, padding: '40px 0', textAlign: 'center', lineHeight: 1.8 }, children: files.length === 0
                            ? 'No Trail Eblets found in TRAILS directory.'
                            : 'Select a Trail Eblet from the list to view it.' })), parsed && selectedFile && (_jsxs(_Fragment, { children: [_jsx(HeaderCard, { meta: parsed.meta, fileName: selectedFile.name }), _jsx(BountyCard, { meta: parsed.meta }), waypoints.length > 0 && _jsx(PathFingerprint, { waypoints: waypoints }), selectedPath && _jsx(ScreenshotsGrid, { ebletPath: selectedPath }), _jsx("div", { style: { borderTop: '1px solid rgba(100,116,139,0.1)', paddingTop: 12 }, children: _jsx(MarkdownBody, { content: parsed.body }) })] }))] })] }));
}
