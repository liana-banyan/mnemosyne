import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Layer2UseIt.tsx -- SEG-U-6 BP078 v0.1.36
// Layer 2 surface for "Just Use It" doorway.
// 4 AI mode choices; choice 4 shows Ollama model dropdown + cloud provider entries.
// Static placeholder replaced with animated ModelSetupProgress (SEG-U-6).
import { useState, useEffect, useCallback } from 'react';
import { WelcomeCueCard } from './WelcomeCueCard';
import { useLifecycleStage } from '../hooks/useLifecycleStage';
import { ModelSetupProgress } from './ModelSetupProgress';
const CLOUD_PROVIDERS = ['Anthropic', 'OpenAI', 'Google', 'Mistral'];
// Shared style tokens matching WelcomeView dark theme
const S = {
    overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 9600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d1117',
        fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    card: {
        width: '100%',
        maxWidth: 480,
        padding: '36px 32px',
        background: '#111827',
        border: '1px solid rgba(100, 116, 139, 0.2)',
        borderRadius: 12,
        margin: '0 16px',
    },
    brandLine: {
        fontSize: 11,
        fontWeight: 700,
        color: '#60a5fa',
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        marginBottom: 20,
    },
    heading: {
        fontSize: 16,
        fontWeight: 800,
        color: '#e2e8f0',
        lineHeight: 1.3,
        margin: '0 0 20px',
    },
    backBtn: {
        background: 'none',
        border: 'none',
        color: '#475569',
        fontSize: 11,
        cursor: 'pointer',
        padding: '0 0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
    },
    cardStack: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    placeholderBox: {
        padding: '18px 20px',
        background: 'rgba(30, 64, 175, 0.08)',
        border: '1px solid rgba(96, 165, 250, 0.25)',
        borderRadius: 10,
        color: '#94a3b8',
        fontSize: 13,
        lineHeight: 1.6,
        marginBottom: 16,
    },
    backLink: {
        background: 'none',
        border: 'none',
        color: '#475569',
        fontSize: 12,
        cursor: 'pointer',
        textDecoration: 'underline',
        padding: 0,
    },
    dropdownWrap: {
        marginTop: 10,
        padding: '14px 16px',
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(96, 165, 250, 0.2)',
        borderRadius: 10,
    },
    select: {
        width: '100%',
        padding: '8px 10px',
        background: '#1e293b',
        border: '1px solid rgba(100, 116, 139, 0.35)',
        borderRadius: 7,
        color: '#e2e8f0',
        fontSize: 13,
        cursor: 'pointer',
    },
    selectLabel: {
        fontSize: 11,
        color: '#475569',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    confirmBtn: {
        marginTop: 12,
        width: '100%',
        padding: '10px 0',
        background: 'rgba(30, 64, 175, 0.25)',
        border: '1px solid rgba(96, 165, 250, 0.40)',
        borderRadius: 8,
        color: '#60a5fa',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background 0.15s',
    },
};
// Ollama model tags for the built-in choices
const CHOICE2_MODEL = 'mistral'; // lightweight / fast
const CHOICE3_MODEL = 'gemma4:12b'; // heavy-duty
function extractPullModelName(selection) {
    // "Ollama: modelname" -> "modelname"; cloud provider -> '' (no local pull needed)
    if (selection.startsWith('Ollama: '))
        return selection.slice(8);
    return '';
}
export function Layer2UseIt({ onBack, onDone }) {
    const { advanceTo } = useLifecycleStage();
    const [screenMode, setScreenMode] = useState('picking');
    const [chosenModel, setChosenModel] = useState('');
    const [choice4Open, setChoice4Open] = useState(false);
    const [models, setModels] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState('');
    const [setupError, setSetupError] = useState(null);
    // Fetch Ollama models when choice 4 is expanded
    useEffect(() => {
        if (!choice4Open)
            return;
        setModelsLoading(true);
        window.amplify.listOllamaModels()
            .then((list) => setModels(list))
            .catch(() => setModels([]))
            .finally(() => setModelsLoading(false));
    }, [choice4Open]);
    const enterSetup = useCallback((modelTag) => {
        setChosenModel(modelTag);
        setSetupError(null);
        setScreenMode('confirming');
    }, []);
    // Choice 1: No AI -- skip model pull entirely
    const handleNoAiChoice = useCallback(() => {
        enterSetup('');
    }, [enterSetup]);
    // Choices 2 and 3: specific Ollama models
    const handleChoice4Click = useCallback(() => {
        setChoice4Open((prev) => !prev);
    }, []);
    const handleModelConfirm = useCallback(() => {
        if (!selectedModel)
            return;
        enterSetup(extractPullModelName(selectedModel));
    }, [enterSetup, selectedModel]);
    // Called by ModelSetupProgress when all phases complete
    const handleSetupComplete = useCallback(() => {
        advanceTo('D');
        onDone?.();
    }, [advanceTo, onDone]);
    // Called by ModelSetupProgress on error -- stay on confirming screen but show error inline
    const handleSetupError = useCallback((err) => {
        setSetupError(err);
    }, []);
    const handleBackFromSetup = useCallback(() => {
        setScreenMode('picking');
        setChoice4Open(false);
        setSetupError(null);
    }, []);
    // Build dropdown options: local Ollama models + cloud providers
    const allOptions = [
        ...(models.length > 0 ? models.map((m) => `Ollama: ${m}`) : []),
        ...CLOUD_PROVIDERS.map((p) => `${p} (API key required)`),
    ];
    // ── Confirming: live animated setup (no static text) ───────────────────────
    if (screenMode === 'confirming') {
        return (_jsx("div", { style: S.overlay, children: _jsxs("div", { style: S.card, children: [_jsx("div", { style: S.brandLine, children: "Just Use It" }), _jsx(ModelSetupProgress, { modelName: chosenModel, onComplete: handleSetupComplete, onError: handleSetupError }), setupError && (_jsx("button", { type: "button", style: { ...S.backLink, marginTop: 16 }, onClick: handleBackFromSetup, children: '< back to choices' }))] }) }));
    }
    // ── Picking: 4 choice cards ─────────────────────────────────────────────────
    return (_jsx("div", { style: S.overlay, children: _jsxs("div", { style: S.card, children: [_jsx("button", { type: "button", style: S.backBtn, onClick: onBack, children: '< back' }), _jsx("div", { style: S.brandLine, children: "Just Use It" }), _jsx("h2", { style: S.heading, children: "How do you want to use AI?" }), _jsxs("div", { style: S.cardStack, children: [_jsx(WelcomeCueCard, { label: "No AI, search and organize with your own computer only.", size: "choice", variant: "neutral", onClick: handleNoAiChoice }), _jsx(WelcomeCueCard, { label: "Free lightweight AI, fast local helper using Ollama plus Mistral.", size: "choice", variant: "blue", onClick: () => enterSetup(CHOICE2_MODEL) }), _jsx(WelcomeCueCard, { label: "Free heavy-duty AI, stronger local model using Google's Gemma 4 12B.", size: "choice", variant: "blue", onClick: () => enterSetup(CHOICE3_MODEL) }), _jsx(WelcomeCueCard, { label: "Use another AI already on this machine or add a new one.", size: "choice", variant: "blue", onClick: handleChoice4Click }), choice4Open && (_jsxs("div", { style: S.dropdownWrap, children: [_jsx("div", { style: S.selectLabel, children: modelsLoading ? 'Detecting models...' : 'Select a model or provider' }), _jsxs("select", { style: S.select, value: selectedModel, onChange: (e) => setSelectedModel(e.target.value), disabled: modelsLoading, children: [_jsx("option", { value: "", children: "-- choose one --" }), allOptions.length === 0 && !modelsLoading && (
                                        // No local Ollama models found; cloud providers still listed below
                                        _jsx("option", { value: "", disabled: true, children: "No local Ollama models detected" })), allOptions.map((opt) => (_jsx("option", { value: opt, children: opt }, opt)))] }), _jsx("button", { type: "button", style: {
                                        ...S.confirmBtn,
                                        opacity: selectedModel ? 1 : 0.45,
                                        cursor: selectedModel ? 'pointer' : 'default',
                                    }, onClick: handleModelConfirm, disabled: !selectedModel, children: "Use this model" })] }))] })] }) }));
}
export default Layer2UseIt;
