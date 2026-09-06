import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// BrainSwapSelector.tsx -- MnemosyneC Brain Swap UI
// Pluggable cognitive core hot-swappable selector per canon_mnemo_brain_swap_pluggable_cognitive_core_hot_swappable_bp085
// No em-dashes. TypeScript strict. Matches existing component conventions.
import { useState, useEffect } from 'react';
function formatCost(cost) {
    if (cost === 0)
        return '$0.00/1k (free)';
    return `$${cost.toFixed(4)}/1k tokens`;
}
export const BrainSwapSelector = () => {
    const [brains, setBrains] = useState([]);
    const [activeBrainId, setActiveBrainId] = useState('claude-sonnet-4-6');
    const [runtimeBrainId, setRuntimeBrainId] = useState('claude-sonnet-4-6');
    const [selectedBrainId, setSelectedBrainId] = useState('claude-sonnet-4-6');
    const [smokeResult, setSmokeResult] = useState(null);
    const [smokeRunning, setSmokeRunning] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [loading, setLoading] = useState(true);
    // BP132 Yoke #21 C7: user-facing Anthropic API key state (never holds the raw key
    // after a successful save -- only a presence flag comes back from main).
    const [hasAnthropicKey, setHasAnthropicKey] = useState(false);
    const [keyInput, setKeyInput] = useState('');
    const [keyStatusMsg, setKeyStatusMsg] = useState(null);
    const [keySaving, setKeySaving] = useState(false);
    const refreshKeyStatus = async () => {
        try {
            const result = await window.amplify.aiDispatch?.getAnthropicKeyStatus?.();
            if (result?.ok)
                setHasAnthropicKey(result.hasKey);
        }
        catch {
            // Non-fatal -- UI just shows "not set" state
        }
    };
    useEffect(() => {
        void (async () => {
            try {
                const registry = window.amplify.brainRegistry;
                if (!registry) {
                    setLoading(false);
                    return;
                }
                const result = await registry.list();
                if (result.ok && Array.isArray(result.brains)) {
                    setBrains(result.brains);
                }
                const activeResult = await registry.getActive();
                if (activeResult.ok && activeResult.brain_id) {
                    setActiveBrainId(activeResult.brain_id);
                    setRuntimeBrainId(activeResult.brain_id);
                    setSelectedBrainId(activeResult.brain_id);
                }
                await refreshKeyStatus();
            }
            catch (err) {
                console.error('[BrainSwapSelector] Load error:', err);
            }
            finally {
                setLoading(false);
            }
        })();
    }, []);
    const selectedBrain = brains.find((b) => b.brain_id === selectedBrainId);
    const handleSaveKey = async () => {
        if (!keyInput.trim())
            return;
        setKeySaving(true);
        setKeyStatusMsg(null);
        try {
            const result = await window.amplify.aiDispatch?.setAnthropicKey?.(keyInput.trim());
            if (result?.ok) {
                setKeyInput('');
                setKeyStatusMsg('Key saved securely.');
                await refreshKeyStatus();
            }
            else {
                setKeyStatusMsg(result?.error ?? 'Failed to save key');
            }
        }
        catch (err) {
            setKeyStatusMsg(String(err));
        }
        finally {
            setKeySaving(false);
        }
    };
    const handleClearKey = async () => {
        try {
            await window.amplify.aiDispatch?.clearAnthropicKey?.();
            setKeyStatusMsg('Key removed.');
            await refreshKeyStatus();
        }
        catch (err) {
            setKeyStatusMsg(String(err));
        }
    };
    const handleSelect = async (brain_id) => {
        setSelectedBrainId(brain_id);
        setSaveError(null);
        setSmokeResult(null);
        try {
            const registry = window.amplify.brainRegistry;
            if (!registry) {
                setSaveError('Brain registry not available');
                return;
            }
            const result = await registry.setActive(brain_id);
            if (result.ok) {
                setActiveBrainId(brain_id);
            }
            else {
                setSaveError(result.error ?? 'Failed to save brain selection');
            }
        }
        catch (err) {
            setSaveError(String(err));
        }
    };
    const handleSmokeTest = async () => {
        if (!selectedBrainId)
            return;
        setSmokeRunning(true);
        setSmokeResult(null);
        try {
            const registry = window.amplify.brainRegistry;
            if (!registry) {
                setSmokeResult('ERROR: Brain registry not available');
                setSmokeRunning(false);
                return;
            }
            const result = await registry.smokeTest(selectedBrainId);
            if (result.ok && result.content) {
                setSmokeResult(`[${result.brain_id} / ${result.kind} / ${result.latency_ms}ms]\n${result.content}`);
            }
            else {
                setSmokeResult(`ERROR: ${result.error ?? 'No response'}`);
            }
        }
        catch (err) {
            setSmokeResult(`ERROR: ${String(err)}`);
        }
        finally {
            setSmokeRunning(false);
        }
    };
    const swapPending = activeBrainId !== runtimeBrainId;
    if (loading) {
        return (_jsx("div", { style: styles.container, children: _jsx("p", { style: styles.loadingText, children: "Loading brain registry..." }) }));
    }
    return (_jsxs("div", { style: styles.container, children: [_jsx("h3", { style: styles.heading, children: "Orchestrator Brain" }), _jsx("p", { style: styles.subheading, children: "Hot-swappable cognitive core. Changes persist on next session start." }), _jsxs("div", { style: styles.dropdownRow, children: [_jsx("select", { style: styles.select, value: selectedBrainId, onChange: (e) => { void handleSelect(e.target.value); }, children: brains.map((b) => (_jsxs("option", { value: b.brain_id, children: [b.brain_id, " [", b.kind, "] -- ", formatCost(b.cost_per_1k_tokens)] }, b.brain_id))) }), activeBrainId === selectedBrainId && (_jsx("span", { style: styles.activeBadge, children: "Active" }))] }), selectedBrain && (_jsxs("div", { style: styles.costLine, children: [_jsx("span", { style: styles.costLabel, children: "Cost per 1k tokens:" }), _jsx("span", { style: styles.costValue, children: formatCost(selectedBrain.cost_per_1k_tokens) }), _jsxs("span", { style: styles.tierLabel, children: ["Tier ", selectedBrain.capability_tier, "/5"] }), _jsx("span", { style: styles.vendorLabel, children: selectedBrain.vendor }), _jsx("span", { style: selectedBrain.status === 'available'
                            ? styles.statusGreen
                            : selectedBrain.status === 'unavailable'
                                ? styles.statusRed
                                : styles.statusAmber, children: selectedBrain.status })] })), swapPending && (_jsx("div", { style: styles.swapBanner, children: "Brain swap takes effect on your next question." })), selectedBrain?.vendor === 'anthropic' && (_jsxs("div", { style: styles.keyPanel, children: [_jsxs("div", { style: styles.keyPanelHeading, children: ["Anthropic API key", hasAnthropicKey
                                ? _jsx("span", { style: styles.keySetBadge, children: "configured" })
                                : _jsx("span", { style: styles.keyUnsetBadge, children: "not set" })] }), _jsx("p", { style: styles.keyPanelSub, children: "Your key is encrypted at rest on this machine and never leaves it except in direct calls to Anthropic's API. It is never logged." }), _jsxs("div", { style: styles.keyInputRow, children: [_jsx("input", { type: "password", value: keyInput, onChange: (e) => setKeyInput(e.target.value), placeholder: "sk-ant-...", style: styles.keyInput, autoComplete: "off" }), _jsx("button", { type: "button", style: keySaving ? styles.testButtonDisabled : styles.testButton, onClick: () => { void handleSaveKey(); }, disabled: keySaving || !keyInput.trim(), children: keySaving ? 'Saving...' : 'Save' }), hasAnthropicKey && (_jsx("button", { type: "button", style: styles.clearKeyButton, onClick: () => { void handleClearKey(); }, children: "Remove" }))] }), keyStatusMsg && _jsx("div", { style: styles.keyStatusMsg, children: keyStatusMsg })] })), saveError && (_jsx("div", { style: styles.errorBanner, children: saveError })), _jsx("button", { style: smokeRunning ? styles.testButtonDisabled : styles.testButton, onClick: () => { void handleSmokeTest(); }, disabled: smokeRunning, children: smokeRunning ? 'Testing...' : 'Test this brain' }), smokeResult !== null && (_jsx("pre", { style: styles.smokeResult, children: smokeResult }))] }));
};
const styles = {
    container: {
        padding: '16px',
        background: '#1a1a2e',
        borderRadius: '8px',
        border: '1px solid #2d2d4e',
        maxWidth: '560px',
        fontFamily: 'system-ui, sans-serif',
        color: '#e0e0f0',
    },
    heading: {
        margin: '0 0 4px 0',
        fontSize: '15px',
        fontWeight: 600,
        color: '#c0c8ff',
    },
    subheading: {
        margin: '0 0 12px 0',
        fontSize: '12px',
        color: '#888aaa',
    },
    dropdownRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
    },
    select: {
        flex: 1,
        background: '#12121e',
        color: '#e0e0f0',
        border: '1px solid #3a3a5e',
        borderRadius: '4px',
        padding: '6px 8px',
        fontSize: '13px',
        cursor: 'pointer',
    },
    activeBadge: {
        background: '#1e3a1e',
        color: '#4cde4c',
        borderRadius: '4px',
        padding: '3px 8px',
        fontSize: '11px',
        fontWeight: 600,
        border: '1px solid #2e5a2e',
        whiteSpace: 'nowrap',
    },
    costLine: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '8px',
        fontSize: '12px',
        flexWrap: 'wrap',
    },
    costLabel: { color: '#888aaa' },
    costValue: { color: '#e0e0f0', fontWeight: 500 },
    tierLabel: {
        background: '#2a2a4e',
        padding: '2px 6px',
        borderRadius: '3px',
        color: '#aac0ff',
    },
    vendorLabel: {
        background: '#2a2a4e',
        padding: '2px 6px',
        borderRadius: '3px',
        color: '#c0aaff',
    },
    statusGreen: { color: '#4cde4c', fontWeight: 600 },
    statusRed: { color: '#de4c4c', fontWeight: 600 },
    statusAmber: { color: '#deaa4c', fontWeight: 600 },
    swapBanner: {
        background: '#2e2a10',
        border: '1px solid #5a4a10',
        color: '#deaa4c',
        borderRadius: '4px',
        padding: '6px 10px',
        fontSize: '12px',
        marginBottom: '8px',
    },
    errorBanner: {
        background: '#2e1010',
        border: '1px solid #5a1010',
        color: '#de6c6c',
        borderRadius: '4px',
        padding: '6px 10px',
        fontSize: '12px',
        marginBottom: '8px',
    },
    testButton: {
        background: '#2a3a6e',
        color: '#c0d0ff',
        border: '1px solid #3a4a8e',
        borderRadius: '4px',
        padding: '7px 14px',
        fontSize: '13px',
        cursor: 'pointer',
        marginBottom: '8px',
    },
    testButtonDisabled: {
        background: '#1a1a3e',
        color: '#666888',
        border: '1px solid #2a2a4e',
        borderRadius: '4px',
        padding: '7px 14px',
        fontSize: '13px',
        cursor: 'not-allowed',
        marginBottom: '8px',
    },
    smokeResult: {
        background: '#12121e',
        border: '1px solid #2d2d4e',
        borderRadius: '4px',
        padding: '10px',
        fontSize: '12px',
        color: '#c0d0c0',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: '200px',
        overflowY: 'auto',
        margin: 0,
    },
    loadingText: {
        color: '#888aaa',
        fontSize: '13px',
    },
    keyPanel: {
        background: '#12121e',
        border: '1px solid #2d2d4e',
        borderRadius: '6px',
        padding: '10px 12px',
        marginBottom: '10px',
    },
    keyPanelHeading: {
        fontSize: '12px',
        fontWeight: 600,
        color: '#c0c8ff',
        marginBottom: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    keyPanelSub: {
        fontSize: '11px',
        color: '#888aaa',
        margin: '0 0 8px 0',
        lineHeight: 1.4,
    },
    keySetBadge: {
        background: '#1e3a1e',
        color: '#4cde4c',
        borderRadius: '4px',
        padding: '2px 6px',
        fontSize: '10px',
        fontWeight: 600,
    },
    keyUnsetBadge: {
        background: '#3a2a1e',
        color: '#deaa4c',
        borderRadius: '4px',
        padding: '2px 6px',
        fontSize: '10px',
        fontWeight: 600,
    },
    keyInputRow: {
        display: 'flex',
        gap: '6px',
    },
    keyInput: {
        flex: 1,
        background: '#0a0a14',
        color: '#e0e0f0',
        border: '1px solid #3a3a5e',
        borderRadius: '4px',
        padding: '6px 8px',
        fontSize: '12px',
    },
    clearKeyButton: {
        background: 'none',
        color: '#de6c6c',
        border: '1px solid #5a1010',
        borderRadius: '4px',
        padding: '7px 10px',
        fontSize: '12px',
        cursor: 'pointer',
    },
    keyStatusMsg: {
        marginTop: '6px',
        fontSize: '11px',
        color: '#94a3b8',
    },
};
