import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * SubstratedFoldersPanel™ — MnemosyneC™ v0.1.10
 * Renders in Developer Tab → Substrate panel.
 * Live IPC: watcher:list-folders, watcher:add-folder, watcher:eblet-minted
 */
import { useState, useEffect } from 'react';
export function SubstratedFoldersPanel() {
    const [folders, setFolders] = useState([]);
    const [recentEblets, setRecentEblets] = useState([]);
    const [stats, setStats] = useState({ foldersWatched: 0, ebletsMinted: 0, lastEventAt: null, errors: [] });
    useEffect(() => {
        const w = window.amplify?.watcher;
        if (!w)
            return;
        w.listFolders?.().then((f) => setFolders(f)).catch(console.error);
        w.getStats?.().then((s) => setStats(s)).catch(console.error);
        w.onEbletMinted?.((eblet) => {
            const e = eblet;
            setRecentEblets((prev) => [...prev.slice(-49), e]);
            setStats((prev) => ({ ...prev, ebletsMinted: prev.ebletsMinted + 1, lastEventAt: e.mintedAt }));
        });
    }, []);
    const handleAddFolder = async () => {
        const w = window.amplify?.watcher;
        if (!w)
            return;
        const result = await w.openFolderDialog?.();
        if (!result || result.canceled || !result.filePaths?.[0])
            return;
        const added = await w.addFolder?.(result.filePaths[0]);
        if (!added)
            return;
        if (added.error) {
            alert(added.error);
            return;
        }
        setFolders((prev) => [...prev, added]);
        setStats((prev) => ({ ...prev, foldersWatched: prev.foldersWatched + 1 }));
    };
    const handleRemoveFolder = async (folderId) => {
        const ok = await window.amplify?.watcher?.removeFolder?.(folderId);
        if (ok) {
            setFolders((prev) => prev.filter((f) => f.id !== folderId));
            setStats((prev) => ({ ...prev, foldersWatched: Math.max(0, prev.foldersWatched - 1) }));
        }
    };
    return (_jsxs("div", { style: { padding: 16, color: '#e2e8f0', fontFamily: 'monospace' }, children: [_jsxs("div", { style: { fontSize: 14, fontWeight: 700, color: '#f59e0b', marginBottom: 12 }, children: ["Substrated Folders\u2122", _jsx("span", { style: { fontSize: 11, color: '#64748b', marginLeft: 8 }, children: "v0.1.10" })] }), _jsxs("div", { style: { display: 'flex', gap: 24, marginBottom: 16, fontSize: 12, color: '#94a3b8' }, children: [_jsxs("span", { children: ["\uD83D\uDCC1 Folders: ", _jsx("strong", { style: { color: '#60a5fa' }, children: stats.foldersWatched })] }), _jsxs("span", { children: ["\uD83D\uDCC4 Eblets\u2122 minted: ", _jsx("strong", { style: { color: '#34d399' }, children: stats.ebletsMinted })] }), _jsxs("span", { children: ["\uD83D\uDD52 Last event: ", _jsx("strong", { children: stats.lastEventAt ? new Date(stats.lastEventAt).toLocaleTimeString() : '—' })] })] }), _jsx("div", { style: { marginBottom: 12 }, children: folders.length === 0 ? (_jsx("div", { style: { color: '#475569', fontSize: 12, fontStyle: 'italic' }, children: "No Substrated folders yet. Add a folder to begin mining Eblet\u2122 records." })) : (folders.map(f => (_jsxs("div", { style: { background: '#1e293b', borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("span", { children: [_jsx("span", { style: { color: '#34d399' }, children: "\u2713" }), " ", f.absolutePath, _jsx("span", { style: { color: '#475569', marginLeft: 8 }, children: new Date(f.addedAt).toLocaleDateString() })] }), _jsx("button", { onClick: () => handleRemoveFolder(f.id), style: { background: 'none', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', borderRadius: 4, padding: '2px 7px', fontSize: 10, cursor: 'pointer' }, children: "\u2715" })] }, f.id)))) }), _jsx("button", { onClick: handleAddFolder, style: { background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 12 }, children: "+ Add Folder" }), recentEblets.length > 0 && (_jsxs("div", { style: { marginTop: 16 }, children: [_jsx("div", { style: { fontSize: 12, color: '#64748b', marginBottom: 6 }, children: "Recent Eblet\u2122 Mints" }), recentEblets.slice(-10).reverse().map(e => (_jsxs("div", { style: { fontSize: 11, color: '#94a3b8', marginBottom: 4 }, children: [_jsx("span", { style: { color: e.event === 'deleted' ? '#f87171' : '#34d399' }, children: e.event === 'created' ? '✚' : e.event === 'changed' ? '✎' : '✕' }), ' ', e.sourceFilePath.split('\\').pop(), " \u2014 ", new Date(e.mintedAt).toLocaleTimeString()] }, e.id)))] }))] }));
}
