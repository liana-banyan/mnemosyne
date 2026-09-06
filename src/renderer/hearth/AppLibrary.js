import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// AMPLIFY Computer — Hearth App Builder — App Library
// B69b — Lists member's installed Hearth apps.
// Actions: Run / Uninstall / View Spec / Re-Generate (re-run codegen with edited spec).
import { useState, useEffect } from 'react';
export function AppLibrary({ onReGenerate }) {
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSpec, setSelectedSpec] = useState(null);
    const [uninstalling, setUninstalling] = useState(null);
    const [launching, setLaunching] = useState(null);
    async function loadLibrary() {
        setLoading(true);
        try {
            const result = await window.amplify.hearthLibraryQuery?.();
            setApps(result ?? []);
        }
        catch {
            setApps([]);
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        loadLibrary();
    }, []);
    async function handleRun(app) {
        if (launching)
            return;
        setLaunching(app.uuid);
        try {
            await window.amplify.hearthInstall?.({
                uuid: app.uuid,
                appName: app.appName,
                description: app.description,
                appDir: app.appDir,
                installerPath: app.installerPath ?? '',
                spec: app.spec,
            });
        }
        finally {
            setLaunching(null);
        }
    }
    async function handleUninstall(app) {
        if (!confirm(`Remove "${app.appName}" from your Hearth Library?\n\nYour data will remain at: ${app.appDir}`))
            return;
        setUninstalling(app.uuid);
        try {
            await window.amplify.hearthUninstall?.(app.uuid);
            await loadLibrary();
        }
        finally {
            setUninstalling(null);
        }
    }
    if (loading) {
        return _jsx("div", { style: styles.empty, children: _jsx("div", { style: styles.spinner, children: "Loading your apps\u2026" }) });
    }
    if (apps.length === 0) {
        return (_jsxs("div", { style: styles.empty, children: [_jsx("div", { style: styles.emptyIcon, children: "\uD83D\uDCE6" }), _jsx("div", { style: styles.emptyTitle, children: "No apps built yet" }), _jsx("div", { style: styles.emptySubtext, children: "Chat with Hearth to build your first app!" })] }));
    }
    return (_jsxs("div", { style: styles.container, children: [_jsxs("div", { style: styles.header, children: [_jsx("h2", { style: styles.headerTitle, children: "Your App Library" }), _jsx("button", { style: styles.refreshBtn, onClick: loadLibrary, children: "Refresh" })] }), _jsx("div", { style: styles.grid, children: apps.map((app) => (_jsxs("div", { style: styles.card, children: [_jsxs("div", { style: styles.cardHeader, children: [_jsx("div", { style: styles.appIcon, children: "\uD83D\uDD25" }), _jsxs("div", { style: styles.appInfo, children: [_jsx("div", { style: styles.appName, children: app.appName }), _jsxs("div", { style: styles.appMeta, children: [new Date(app.installedAt).toLocaleDateString(), " \u00B7 ", app.os, ' · ', _jsx("span", { style: app.buildStatus === 'installed' ? styles.statusInstalled : styles.statusBuilt, children: app.buildStatus === 'installed' ? 'Installed' : 'Built' })] })] })] }), _jsx("div", { style: styles.appDesc, children: app.description }), _jsx("div", { style: styles.entityList, children: app.spec.entities.map((e) => (_jsx("span", { style: styles.entityTag, children: e.name }, e.name))) }), _jsxs("div", { style: styles.actions, children: [_jsx("button", { style: { ...styles.actionBtn, ...styles.runBtn }, onClick: () => handleRun(app), disabled: launching === app.uuid || !app.installerPath, title: !app.installerPath ? 'No installer — build again to generate installer' : 'Launch this app', children: launching === app.uuid ? 'Launching…' : '▶ Run' }), _jsx("button", { style: { ...styles.actionBtn, ...styles.specBtn }, onClick: () => setSelectedSpec(app), children: "\uD83D\uDCCB Spec" }), _jsx("button", { style: { ...styles.actionBtn, ...styles.regenBtn }, onClick: () => onReGenerate?.(app), title: "Re-generate this app with a new description", children: "\u21BA Re-Gen" }), _jsx("button", { style: { ...styles.actionBtn, ...styles.uninstallBtn }, onClick: () => handleUninstall(app), disabled: uninstalling === app.uuid, children: uninstalling === app.uuid ? 'Removing…' : '✕ Remove' })] })] }, app.uuid))) }), selectedSpec && (_jsx("div", { style: styles.modalOverlay, onClick: () => setSelectedSpec(null), children: _jsxs("div", { style: styles.modal, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: styles.modalHeader, children: [_jsxs("h3", { style: styles.modalTitle, children: [selectedSpec.appName, " \u2014 App Spec"] }), _jsx("button", { style: styles.modalClose, onClick: () => setSelectedSpec(null), children: "\u2715" })] }), _jsx("div", { style: styles.modalBody, children: _jsx("pre", { style: styles.specPre, children: JSON.stringify(selectedSpec.spec, null, 2) }) })] }) }))] }));
}
const styles = {
    container: {
        padding: '1rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
    },
    headerTitle: {
        fontSize: '1.1rem',
        fontWeight: 700,
        color: '#2c3e50',
        margin: 0,
    },
    refreshBtn: {
        background: 'none',
        border: '1px solid #ced4da',
        borderRadius: '4px',
        padding: '0.25rem 0.75rem',
        cursor: 'pointer',
        fontSize: '0.85rem',
        color: '#495057',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem',
    },
    card: {
        background: 'white',
        border: '1px solid #dee2e6',
        borderRadius: '10px',
        padding: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    },
    cardHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '0.5rem',
    },
    appIcon: {
        fontSize: '1.5rem',
        flexShrink: 0,
    },
    appInfo: {
        flex: 1,
        minWidth: 0,
    },
    appName: {
        fontWeight: 700,
        fontSize: '0.95rem',
        color: '#212529',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    appMeta: {
        fontSize: '0.75rem',
        color: '#6c757d',
        marginTop: '0.1rem',
    },
    statusInstalled: {
        color: '#28a745',
        fontWeight: 600,
    },
    statusBuilt: {
        color: '#e67e22',
        fontWeight: 600,
    },
    appDesc: {
        fontSize: '0.85rem',
        color: '#495057',
        marginBottom: '0.75rem',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
    },
    entityList: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.25rem',
        marginBottom: '0.75rem',
    },
    entityTag: {
        background: '#e9ecef',
        color: '#495057',
        fontSize: '0.72rem',
        padding: '0.1rem 0.4rem',
        borderRadius: '3px',
        fontFamily: 'monospace',
    },
    actions: {
        display: 'flex',
        gap: '0.4rem',
        flexWrap: 'wrap',
    },
    actionBtn: {
        border: 'none',
        borderRadius: '5px',
        padding: '0.3rem 0.6rem',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: 600,
        transition: 'opacity 0.15s',
    },
    runBtn: {
        background: '#28a745',
        color: 'white',
    },
    specBtn: {
        background: '#6c757d',
        color: 'white',
    },
    regenBtn: {
        background: '#e67e22',
        color: 'white',
    },
    uninstallBtn: {
        background: '#f8d7da',
        color: '#721c24',
    },
    empty: {
        textAlign: 'center',
        padding: '3rem 1rem',
        color: '#6c757d',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    emptyIcon: {
        fontSize: '2.5rem',
        marginBottom: '0.75rem',
    },
    emptyTitle: {
        fontSize: '1rem',
        fontWeight: 600,
        color: '#495057',
        marginBottom: '0.25rem',
    },
    emptySubtext: {
        fontSize: '0.85rem',
        color: '#adb5bd',
    },
    spinner: {
        color: '#6c757d',
        fontSize: '0.95rem',
        fontStyle: 'italic',
        fontFamily: 'inherit',
    },
    modalOverlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
    },
    modal: {
        background: 'white',
        borderRadius: '10px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.25rem',
        borderBottom: '1px solid #dee2e6',
    },
    modalTitle: {
        margin: 0,
        fontSize: '1rem',
        fontWeight: 700,
        color: '#2c3e50',
    },
    modalClose: {
        background: 'none',
        border: 'none',
        fontSize: '1rem',
        cursor: 'pointer',
        color: '#6c757d',
        padding: '0.25rem 0.5rem',
    },
    modalBody: {
        flex: 1,
        overflowY: 'auto',
        padding: '1rem 1.25rem',
    },
    specPre: {
        fontSize: '0.75rem',
        fontFamily: 'monospace',
        color: '#212529',
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    },
};
