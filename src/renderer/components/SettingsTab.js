import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// SettingsTab -- MnemosyneC CAI Amplifier Settings
// Tab 4 (always visible) -- BP047 W1
// SEG-R-2/3/4/5/6/7/12: restructured -- new top-level cards, AI Power Tier, Memory Depth Tier, Advanced collapsible
// Order: App Version | AI Capability | Cooperative Membership | AI Power Tier (+ model assign) | Memory Depth Tier | Advanced | Appearance | Substrate | Developer | Research | Contribution | Folders | Grand Projects
// KniPr034: My Contribution panel added -- read-only scaffold, data binding next wave
// BP077 v0.1.27: Mnem-DRT panel added (MnemosyneC Mnem-as-interface)
// BP078: SkuUpgradePanel wired into AI Power Tier section
import React, { useState, useEffect, useRef } from 'react';
import { LocFaqModal } from './LocFaqPanel';
import { SkuUpgradePanel } from './SkuUpgradePanel';
import { useLifecycleStage } from '../hooks/useLifecycleStage';
import { ShareMnemosyneC } from './ShareMnemosyneC';
import { SubstrateAwakensJoinPanel } from './SubstrateAwakensJoinPanel';
// BP137 Yoke v2b Stage C ("Chrome-MCP Nexus Authority") -- new, self-contained settings
// section (own state, own persistence via nexus_authority_settings_store.ts). See that
// component's file header for the full Bishop-audit rationale.
import { NexusAuthoritySettings } from '../settings/NexusAuthoritySettings';
import { NexusAuthoritySignInPanel } from '../settings/NexusAuthoritySignInPanel';
// D-BP151-037/BISHOP/seg-query-capture-archive -- new section, self-contained (own state,
// own IPC calls), same mounting convention as NexusAuthoritySettings above.
import { QueryCaptureArchivePanel } from './QueryCaptureArchivePanel';
const DEFAULT_CHRONOS_CONSENT = {
    enabled: false,
    actionClasses: {
        stamping: false,
        voting: false,
        recipeCompose: false,
        puddingPublish: false,
        crownLetterDraft: false,
    },
    revocationAvailable: true,
};
const ACTION_CLASS_LABELS = [
    { key: 'stamping', label: 'Stamping & attestation' },
    { key: 'voting', label: 'Voting & signal actions' },
    { key: 'recipeCompose', label: 'Recipe composition' },
    { key: 'puddingPublish', label: 'Content publishing' },
    { key: 'crownLetterDraft', label: 'Crown letter drafting' },
];
function loadChronosConsent() {
    try {
        const raw = localStorage.getItem('mnemo_chronos_consent');
        if (raw)
            return { ...DEFAULT_CHRONOS_CONSENT, ...JSON.parse(raw) };
    }
    catch { /* fall through */ }
    return { ...DEFAULT_CHRONOS_CONSENT };
}
function saveChronosConsent(c) {
    localStorage.setItem('mnemo_chronos_consent', JSON.stringify(c));
}
function ChronosResearchPanel() {
    const [consent, setConsent] = useState(loadChronosConsent);
    const [showModal, setShowModal] = useState(false);
    const [revoking, setRevoking] = useState(false);
    const [writeError, setWriteError] = useState(null);
    async function handleMasterToggle() {
        const next = !consent.enabled;
        const ts = new Date().toISOString();
        if (next) {
            // Turn ON — write signed consent Eblet via IPC
            const updated = {
                ...consent,
                enabled: true,
                consentTimestamp: ts,
            };
            setWriteError(null);
            try {
                const result = await window.amplify?.writeChronosConsent?.({
                    consent: updated,
                    timestamp: ts,
                });
                if (result?.ok) {
                    updated.consentEbletPath = result.ebletPath;
                }
            }
            catch (e) {
                setWriteError('Could not write consent Eblet · check permissions.');
            }
            setConsent(updated);
            saveChronosConsent(updated);
        }
        else {
            // Turn OFF — just disable in localStorage (use Revoke for full retraction)
            const updated = { ...consent, enabled: false };
            setConsent(updated);
            saveChronosConsent(updated);
        }
    }
    async function handleRevoke() {
        setRevoking(true);
        setWriteError(null);
        try {
            await window.amplify?.revokeChronosConsent?.({
                originalConsentTs: consent.consentTimestamp,
            });
        }
        catch (e) {
            setWriteError('Revocation write failed · check permissions.');
        }
        const cleared = {
            ...DEFAULT_CHRONOS_CONSENT,
            revocationAvailable: true,
        };
        setConsent(cleared);
        saveChronosConsent(cleared);
        setRevoking(false);
    }
    function handleActionClass(key, val) {
        const updated = {
            ...consent,
            actionClasses: { ...consent.actionClasses, [key]: val },
        };
        setConsent(updated);
        saveChronosConsent(updated);
    }
    const s = styles;
    const cs = chronosStyles;
    return (_jsxs("section", { style: s.section, children: [_jsx("div", { style: s.sectionHeader, children: "\uD83D\uDD2C Research Participation" }), _jsxs("div", { style: s.card, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }, children: "Chronos Research" }), _jsxs("div", { style: cs.desc, children: ["Chronos Research lets your MnemosyneC help everyone \u00B7 anonymously. You keep control. The cooperative gets smarter.", ' ', _jsx("button", { onClick: () => setShowModal(true), style: { ...cs.learnMoreBtn, display: 'inline' }, children: "[Learn more]" }), _jsx("br", {}), _jsx("span", { style: cs.kNote, children: "Your data only joins the pool when at least 10 other members took the same action." })] })] }), _jsx("button", { onClick: handleMasterToggle, style: {
                                    ...s.chip,
                                    minWidth: 38,
                                    ...(consent.enabled ? { ...s.chipActive, color: '#6ee7b7', borderColor: 'rgba(110,231,183,0.4)' } : {}),
                                }, children: consent.enabled ? 'ON' : 'OFF' })] }), writeError && (_jsx("div", { style: { fontSize: 9, color: '#f87171', marginTop: 6 }, children: writeError })), consent.enabled && (_jsxs(_Fragment, { children: [_jsx("div", { style: cs.divider }), _jsx("div", { style: { fontSize: 10, color: '#64748b', marginBottom: 6 }, children: "Choose which action types to include:" }), ACTION_CLASS_LABELS.map(({ key, label }) => (_jsxs("label", { style: cs.checkRow, children: [_jsx("input", { type: "checkbox", checked: consent.actionClasses[key], onChange: (e) => handleActionClass(key, e.target.checked), style: cs.checkbox }), _jsx("span", { style: cs.checkLabel, children: label })] }, key)))] })), _jsx("div", { style: cs.divider }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }, children: [_jsx("button", { onClick: handleRevoke, disabled: revoking, style: { ...cs.revokeBtn, opacity: revoking ? 0.6 : 1 }, children: revoking ? 'Revoking…' : 'Revoke participation' }), _jsx("button", { onClick: () => setShowModal(true), style: cs.learnMoreBtn, children: "What is Chronos? \u2192" })] }), consent.enabled && consent.consentTimestamp && (_jsxs("div", { style: { fontSize: 9, color: '#475569', marginTop: 6 }, children: ["Opted in: ", new Date(consent.consentTimestamp).toLocaleDateString(), consent.consentEbletPath && (_jsx("span", { style: { marginLeft: 6 }, children: "\u00B7 Eblet written" }))] }))] }), _jsx("div", { style: cs.revokeNote, children: "[Revoke participation] removes your consent Eblet and clears future data collection. Prior anonymized data cannot be recalled from the aggregation corpus." }), showModal && (_jsx("div", { style: cs.modalOverlay, onClick: () => setShowModal(false), children: _jsxs("div", { style: cs.modal, onClick: (e) => e.stopPropagation(), children: [_jsx("div", { style: cs.modalTitle, children: "What is Chronos?" }), _jsxs("div", { style: cs.modalBody, children: [_jsxs("p", { children: [_jsx("strong", { children: "Chronos" }), " is the Liana Banyan cooperative's research telemetry layer. Every action you take (stamping, voting, composing recipes, etc.) carries a timestamped, sha256-signed observation \u00B7 the Chronos tab."] }), _jsx("p", { children: "When you opt in, anonymized versions of these observations are contributed to the cooperative's research corpus. Academic institutions, policy bodies, and cooperative-class research projects may license this aggregated data." }), _jsxs("p", { children: [_jsx("strong", { children: "k-anonymity = 10:" }), " your data only enters an aggregation when at least 10 other members performed the same action class. Your identity is never linkable across queries \u2014 member IDs rotate per query family."] }), _jsxs("p", { children: ["Revenue from data licensing returns to opted-in members as ", _jsx("strong", { children: "Banyan Mark dividends" }), ", distributed quarterly through the cooperative treasury."] }), _jsx("p", { children: "You may revoke at any time. Future emissions stop immediately. The cooperative cannot recall prior anonymized contributions from the aggregation corpus, but your revocation Eblet is sha256-logged as a cryptographic commitment." })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }, children: [_jsx("button", { onClick: () => window.amplify?.openExternal?.('https://cephas.lianabanyan.com/chronos'), style: cs.learnMoreBtn, children: "Full Chronos docs \u2192" }), _jsx("button", { onClick: () => setShowModal(false), style: { ...s.btn }, children: "Close" })] })] }) }))] }));
}
const chronosStyles = {
    desc: {
        fontSize: 9,
        color: '#64748b',
        lineHeight: 1.6,
        marginBottom: 4,
    },
    kNote: {
        color: '#475569',
        fontStyle: 'italic',
    },
    divider: {
        height: 1,
        background: 'rgba(100,116,139,0.12)',
        margin: '8px 0',
    },
    checkRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        marginBottom: 5,
        cursor: 'pointer',
    },
    checkbox: {
        width: 12,
        height: 12,
        accentColor: '#6ee7b7',
        cursor: 'pointer',
    },
    checkLabel: {
        fontSize: 10,
        color: '#94a3b8',
    },
    revokeBtn: {
        background: 'none',
        border: '1px solid rgba(248,113,113,0.25)',
        borderRadius: 5,
        color: '#f87171',
        fontSize: 9,
        fontWeight: 500,
        padding: '3px 9px',
        cursor: 'pointer',
    },
    learnMoreBtn: {
        background: 'none',
        border: 'none',
        color: '#6ee7b7',
        fontSize: 9,
        cursor: 'pointer',
        padding: 0,
        fontWeight: 500,
        textDecoration: 'underline',
        textDecorationColor: 'rgba(110,231,183,0.35)',
    },
    revokeNote: {
        fontSize: 9,
        color: '#475569',
        marginTop: 5,
        fontStyle: 'italic',
        lineHeight: 1.5,
    },
    modalOverlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modal: {
        background: 'rgba(15,23,42,0.98)',
        border: '1px solid rgba(100,116,139,0.3)',
        borderRadius: 10,
        padding: '18px 20px',
        maxWidth: 360,
        width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    },
    modalTitle: {
        fontSize: 13,
        fontWeight: 700,
        color: '#e2e8f0',
        marginBottom: 10,
    },
    modalBody: {
        fontSize: 10,
        color: '#94a3b8',
        lineHeight: 1.7,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
};
// KN-BP143-3 D4: the ContributionStats interface, PLACEHOLDER_STATS, computeTier, and the whole
// Code Breaker Guild weighted-Marks calculator that used to live below were CUT, not wired. There
// is no Chronos aggregation IPC channel anywhere in preload.ts/amplify.d.ts (checked -- zero
// hits) to back Eblets-contributed, Marks-earned, patronage projection, or guild-tier progress,
// so this panel was permanently rendering a hardcoded all-zero ContributionStats object dressed
// up with a "Numbers grow as you contribute" promise it structurally could never keep -- a
// meter with no data source, exactly what this ticket exists to remove. Reported per the
// ticket's "report anything you cut" rule. Re-add the real thing once KniPr034-next's Chronos
// aggregation IPC exists.
function MyContributionPanel() {
    const s = styles;
    return (_jsxs("section", { style: s.section, children: [_jsx("div", { style: s.sectionHeader, children: "\u2605 My Contribution" }), _jsxs("div", { style: s.card, children: [_jsx("div", { style: { fontSize: 10, color: '#64748b', fontStyle: 'italic', lineHeight: 1.7 }, children: "Not yet tracked. Eblets contributed, weighted Marks earned, quarterly patronage projection, and Code Breaker Guild tier progress all require a Chronos aggregation channel (KniPr034-next) that does not exist in the engine yet. Honestly empty here, not a fabricated running total." }), _jsx("div", { style: contribStyles.divider }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsx("span", { style: contribStyles.rowLabel, children: "Revocation control" }), _jsx("button", { style: contribStyles.linkBtn, onClick: () => window.amplify?.openExternal?.('https://lianabanyan.com/privacy'), children: "Manage privacy settings \u2192" })] })] })] }));
}
const contribStyles = {
    row: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 6,
        flexWrap: 'wrap',
        gap: 4,
    },
    rowLabel: {
        fontSize: 10,
        color: '#64748b',
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
    },
    rowValue: {
        fontSize: 11,
        fontWeight: 600,
        color: '#e2e8f0',
    },
    dimNote: {
        fontSize: 9,
        fontWeight: 400,
        color: '#475569',
    },
    infoIcon: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 13,
        height: 13,
        borderRadius: '50%',
        background: 'rgba(100,116,139,0.2)',
        border: '1px solid rgba(100,116,139,0.3)',
        color: '#94a3b8',
        fontSize: 8,
        fontWeight: 700,
        cursor: 'default',
        userSelect: 'none',
        lineHeight: 1,
    },
    tooltip: {
        position: 'absolute',
        bottom: '110%',
        left: 0,
        width: 200,
        background: 'rgba(15,23,42,0.97)',
        border: '1px solid rgba(100,116,139,0.3)',
        borderRadius: 6,
        padding: '7px 9px',
        fontSize: 9,
        color: '#94a3b8',
        lineHeight: 1.5,
        zIndex: 100,
        pointerEvents: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    },
    divider: {
        height: 1,
        background: 'rgba(100,116,139,0.12)',
        margin: '8px 0',
    },
    progressTrack: {
        height: 6,
        background: 'rgba(100,116,139,0.15)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        background: 'linear-gradient(90deg, #6ee7b7 0%, #34d399 100%)',
        borderRadius: 3,
        transition: 'width 0.4s ease',
        minWidth: 0,
    },
    breakdownRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 3,
        alignItems: 'center',
    },
    breakdownItem: {
        fontSize: 9,
        color: '#64748b',
    },
    breakdownDot: {
        fontSize: 9,
        color: '#334155',
    },
    linkBtn: {
        background: 'none',
        border: 'none',
        color: '#6ee7b7',
        fontSize: 10,
        cursor: 'pointer',
        padding: 0,
        fontWeight: 500,
        textDecoration: 'underline',
        textDecorationColor: 'rgba(110,231,183,0.35)',
    },
    zeroNote: {
        fontSize: 9,
        color: '#475569',
        marginTop: 5,
        fontStyle: 'italic',
    },
};
const AUTHORITY_SOURCES = [
    { key: 'wikipedia', label: 'Wikipedia', tier: 'standard', domains: ['general', 'history', 'philosophy', 'law', 'business', 'economics', 'other'], costNote: 'Free, no key required.' },
    { key: 'wikidata', label: 'Wikidata', tier: 'standard', domains: ['general', 'history', 'philosophy', 'law', 'business', 'economics', 'other'], costNote: 'Free, no key required.' },
    { key: 'stackexchange', label: 'StackExchange', tier: 'standard', domains: ['computer_science', 'math', 'engineering', 'physics', 'business', 'economics'], costNote: 'Free without key; optional key raises the daily quota.' },
    { key: 'arxiv', label: 'arXiv', tier: 'standard', domains: ['math', 'physics', 'computer_science', 'engineering', 'biology', 'psychology'], costNote: 'Free, no key, no enforced rate limit.' },
    { key: 'openalex', label: 'OpenAlex', tier: 'standard', domains: ['general', 'biology', 'health', 'psychology'], costNote: 'Free, no key; mailto param opts into the polite pool.' },
    { key: 'nist', label: 'NIST', tier: 'standard', domains: ['physics', 'chemistry', 'engineering'], costNote: 'Free, no key required.' },
    { key: 'pubmed', label: 'PubMed', tier: 'standard', domains: ['biology', 'chemistry', 'psychology', 'health'], costNote: 'Free without key; optional NCBI API key raises the rate limit.' },
    { key: 'commoncrawl', label: 'Common Crawl', tier: 'standard', domains: ['general'], costNote: 'Free, no key; DuckDuckGo fallback also free/no key.' },
    { key: 'europepmc', label: 'Europe PMC', tier: 'standard', domains: ['biology', 'health', 'chemistry'], costNote: 'Free, no key required (Europe PMC REST API).' },
    { key: 'openfda', label: 'openFDA', tier: 'standard', domains: ['health'], costNote: 'Free, no key required (FDA-issued key only raises the rate limit).' },
    { key: 'medlineplus', label: 'MedlinePlus', tier: 'standard', domains: ['health'], costNote: 'Free, no key required (NLM Web Search Service).' },
    { key: 'crossref', label: 'Crossref', tier: 'standard', domains: ['general', 'history', 'philosophy', 'law', 'business', 'economics', 'psychology', 'biology', 'health', 'math', 'physics', 'chemistry', 'computer_science', 'engineering', 'other'], costNote: 'Free, no key; mailto param opts into the Crossref polite pool.' },
    // BP1xx Pawn Authority List Phase 2 (mirrors specialist_adapters.ts SPECIALIST_METADATA).
    { key: 'clinicaltrials', label: 'ClinicalTrials.gov', tier: 'standard', domains: ['health'], costNote: 'Free, no key required (ClinicalTrials.gov API v2; classic v1 API retired).' },
    { key: 'worldbank', label: 'World Bank Indicators', tier: 'standard', domains: ['economics', 'business'], costNote: 'Free, no key required (curated keyword-to-indicator lookup, not full-text search).' },
    { key: 'semanticscholar', label: 'Semantic Scholar', tier: 'standard', domains: ['computer_science', 'economics', 'philosophy', 'law', 'biology', 'math', 'physics', 'chemistry', 'engineering', 'psychology', 'health', 'business', 'history'], costNote: 'Free without key; keyless calls share a lower rate limit than a registered API key.' },
    { key: 'wolfram', label: 'Wolfram Alpha', tier: 'premium', domains: ['math', 'physics', 'chemistry', 'engineering'], costNote: 'Requires a Wolfram Alpha AppID (free-tier signup exists); no-op with no key.' },
    // BP139 browser-LLM authorities: general second-opinion authorities (mirrors
    // src/main/plow/specialist_adapters.ts's BROWSER_LLM_AUTHORITY_METADATA -- keep both in sync).
    // Keys match BrowserLlmAuthorityName, NOT SpecialistName (these are not REST specialist
    // adapters) -- they reuse this SAME mnem_drt_specialists Record<string, boolean> purely as a
    // generic string-keyed enable-override map, which is all isBrowserLlmAuthorityEnabled() /
    // readBrowserLlmAuthorityEnableOverridesFromSettings() ever needed from it.
    // BP140-K4: ChatGPT/Gemini are now WIRED (queryChatGptBrowserAuthority/
    // queryGeminiBrowserAuthority in plow_mc_answerer.ts, driven through webview_preload.ts's
    // generic interactive driver) and relabeled premium -> free, same rationale as user_claude's
    // own relabel below -- both run against chatgpt.com's/gemini.google.com's FREE, logged-in web
    // UIs, never a metered API key and never a paid-subscription requirement. ALL THREE default
    // OFF regardless of tier -- fires only once the user explicitly opts in below (see
    // authorityDefaultEnabled()).
    { key: 'user_chatgpt', label: 'ChatGPT (browser)', tier: 'free', domains: ['all'], costNote: "Free, rate-limited: uses your own logged-in chatgpt.com session (free plan; ChatGPT Plus also works if you have it) via the embedded nexus browser. Not the metered OpenAI API." },
    { key: 'user_gemini', label: 'Gemini (browser)', tier: 'free', domains: ['all'], costNote: "Free, rate-limited: uses your own logged-in gemini.google.com session (free plan; Gemini Advanced also works if you have it) via the embedded nexus browser. Not the metered Google AI API." },
    // (this build pass) relabeled premium -> free: mirrors specialist_adapters.ts's
    // BROWSER_LLM_AUTHORITY_METADATA.user_claude, which was widened from 'premium' to 'free' now
    // that it has a real live bridge (queryClaudeBrowserAuthority) running against the user's FREE,
    // rate-limited claude.ai/new web session -- never the paid Claude Pro tier and never the
    // metered Anthropic API. Still default OFF/opt-in (authorityDefaultEnabled() only returns true
    // for 'standard'); "free" describes cost, not default-on-ness.
    { key: 'user_claude', label: 'Claude (browser)', tier: 'free', domains: ['all'], costNote: 'Free, rate-limited: uses your own logged-in claude.ai session (free plan; Claude Pro also works if you have it) via the embedded nexus browser. Not the paid Anthropic API.' },
];
/** Mirrors isAuthorityEnabled()'s default-by-tier rule: standard=on, premium=off. */
function authorityDefaultEnabled(tier) {
    return tier === 'standard';
}
const DEFAULT_MNEM_DRT = {
    sku: 'core',
    mnem_drt_enabled: false,
    mnem_drt_specialists: {},
    filtration_pipeline_enabled: false,
    eblet_store_quota: '100mb',
    federation_exchange_enabled: false,
    concordance_strictness: 'lenient',
};
const EBLET_QUOTA_OPTIONS = [
    { id: '10mb', label: '10 MB' },
    { id: '100mb', label: '100 MB' },
    { id: '1gb', label: '1 GB' },
    { id: 'unlimited', label: 'Unlimited' },
];
const CONCORDANCE_STRICTNESS_OPTIONS = [
    { id: 'lenient', label: 'Lenient (default)' },
    { id: 'require_two', label: 'Require 2 to agree' },
    { id: 'require_majority', label: 'Require majority' },
];
export function loadMnemDrt() {
    try {
        const raw = localStorage.getItem('mnemo_mnem_drt');
        if (raw)
            return { ...DEFAULT_MNEM_DRT, ...JSON.parse(raw) };
    }
    catch { /* fall through */ }
    return { ...DEFAULT_MNEM_DRT };
}
export function saveMnemDrt(s) {
    localStorage.setItem('mnemo_mnem_drt', JSON.stringify(s));
}
export async function persistMnemDrtToBackend(s) {
    try {
        // BP1xx Pawn Authority List Phase 1 UI fix: the previous call here targeted
        // `amplify.saveAiDispatchSettings`, which is not exposed anywhere in preload.ts (the real
        // channel is `amplify.aiDispatch.saveSettings`, see src/main/preload.ts's `aiDispatch`
        // bridge object, wired to the `ai-dispatch:save-settings` IPC handler in
        // src/main/ai_dispatch_ipc.ts). Under optional chaining that silently no-op'd every call --
        // mnem_drt_specialists (including every existing wikipedia/wikidata/arxiv/wolfram toggle)
        // was NEVER actually reaching ai_dispatch_settings.json, only localStorage. Fixed to call
        // the real, already-existing bridge method so isAuthorityEnabled()'s override-read
        // (readAuthorityEnableOverridesFromSettings() in specialist_adapters.ts) actually sees user
        // toggles. Local storage remains the renderer's own source of truth for UI state either way.
        await window.amplify?.aiDispatch?.saveSettings?.({
            sku: s.sku,
            mnem_drt_enabled: s.mnem_drt_enabled,
            mnem_drt_specialists: s.mnem_drt_specialists,
            filtration_pipeline_enabled: s.filtration_pipeline_enabled,
            eblet_store_quota: s.eblet_store_quota,
            federation_exchange_enabled: s.federation_exchange_enabled,
            // BP139 Concordance Gate: additive, mirrors the fields above -- reaches
            // ai_dispatch_settings.json's `concordance_strictness` key via the SAME already-wired
            // ai-dispatch:save-settings IPC round-trip (src/main/ai_dispatch_ipc.ts).
            concordance_strictness: s.concordance_strictness,
        });
    }
    catch {
        // IPC channel may not be wired yet -- local storage is source of truth for now
    }
}
function MnemDrtPanel() {
    const [drt, setDrt] = useState(loadMnemDrt);
    function update(patch) {
        const next = { ...drt, ...patch };
        setDrt(next);
        saveMnemDrt(next);
        void persistMnemDrtToBackend(next);
    }
    function updateSpecialist(key, val) {
        update({ mnem_drt_specialists: { ...drt.mnem_drt_specialists, [key]: val } });
    }
    const isNano = drt.sku === 'nano';
    const isFull = drt.sku === 'full';
    const s = styles;
    return (_jsxs("section", { style: s.section, children: [_jsx("div", { style: s.sectionHeader, children: "\uD83E\uDDE0 Memory Depth Tier" }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginBottom: 6, lineHeight: 1.5 }, children: "Mnem-DRT retrieval install type. Sets corpus depth and specialist count." }), _jsxs("div", { style: s.card, children: [_jsx("div", { style: s.label, children: "Install type (SKU)" }), _jsx("div", { style: s.toggleRow, children: ['nano', 'core', 'lite', 'full'].map((sku) => (_jsx("button", { onClick: () => update({ sku }), style: { ...s.chip, ...(drt.sku === sku ? s.chipActive : {}) }, title: sku === 'nano' ? 'BYO Ollama -- minimal Mnem' :
                                sku === 'core' ? 'Bundled Ollama -- opt-in Mnem-DRT' :
                                    sku === 'lite' ? 'Bundled Ollama + gemma2:2b -- opt-in Mnem-DRT' :
                                        'Full suite -- Mnem-DRT always on', children: sku.toUpperCase() }, sku))) }), isNano && (_jsx("div", { style: { fontSize: 9, color: '#94a3b8', marginTop: 6, lineHeight: 1.6 }, children: "NANO: minimal Mnem posture. r10v3 substrate is still injected on every query. Upgrade to CORE or LITE to enable Mnem-DRT retrieval." })), isFull && (_jsx("div", { style: { fontSize: 9, color: '#6ee7b7', marginTop: 6, lineHeight: 1.6 }, children: "FULL: Mnem-DRT is always on. Wikipedia specialist enabled by default." }))] }), !isNano && (_jsx("div", { style: s.card, children: _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }, children: "Enable Mnem retrieval for this session" }), _jsxs("div", { style: { fontSize: 9, color: '#64748b', lineHeight: 1.6 }, children: ["When on, MnemosyneC queries its substrate before every AI answer.", isFull ? ' Always active for FULL SKU.' : ' Opt-in for CORE and LITE.'] })] }), _jsx("button", { onClick: () => !isFull && update({ mnem_drt_enabled: !drt.mnem_drt_enabled }), disabled: isFull, style: {
                                ...s.chip,
                                minWidth: 38,
                                ...(isFull || drt.mnem_drt_enabled
                                    ? { ...s.chipActive, color: '#6ee7b7', borderColor: 'rgba(110,231,183,0.4)' }
                                    : {}),
                                opacity: isFull ? 0.75 : 1,
                            }, children: isFull || drt.mnem_drt_enabled ? 'ON' : 'OFF' })] }) })), !isNano && (isFull || drt.mnem_drt_enabled) && (_jsxs("div", { style: s.card, children: [_jsx("div", { style: s.label, children: "Source specialists" }), _jsx("div", { style: { fontSize: 9, color: '#64748b', marginBottom: 8, lineHeight: 1.5 }, children: "Standard sources are free and on by default. Premium sources require a paid or keyed credential and are off by default -- opt in below." }), _jsx("div", { style: { fontSize: 9, fontWeight: 700, color: '#6ee7b7', marginBottom: 4, letterSpacing: 0.4 }, children: "STANDARD (FREE) -- ON BY DEFAULT" }), AUTHORITY_SOURCES.filter((src) => src.tier === 'standard' || src.tier === 'free').map((src) => {
                        const forceOn = isFull && src.key === 'wikipedia';
                        const checked = forceOn
                            ? true
                            : (drt.mnem_drt_specialists[src.key] ?? authorityDefaultEnabled(src.tier));
                        return (_jsxs("label", { style: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, cursor: forceOn ? 'default' : 'pointer' }, children: [_jsx("input", { type: "checkbox", checked: checked, disabled: forceOn, onChange: (e) => updateSpecialist(src.key, e.target.checked), style: { width: 13, height: 13, marginTop: 1, accentColor: '#6ee7b7', cursor: forceOn ? 'default' : 'pointer' } }), _jsxs("span", { style: { fontSize: 10, color: '#94a3b8' }, children: [src.label, forceOn ? _jsx("span", { style: { fontSize: 9, color: '#475569', marginLeft: 4 }, children: "(always on for FULL)" }) : null, !forceOn && src.tier === 'free' ? _jsx("span", { style: { fontSize: 9, color: '#475569', marginLeft: 4 }, children: "(opt-in -- off by default)" }) : null, _jsx("span", { style: { display: 'block', fontSize: 9, color: '#475569' }, children: src.domains.join(', ') }), src.tier === 'free' ? _jsx("span", { style: { display: 'block', fontSize: 9, color: '#64748b', fontStyle: 'italic' }, children: src.costNote }) : null] })] }, src.key));
                    }), _jsx("div", { style: { fontSize: 9, fontWeight: 700, color: '#fbbf24', marginTop: 10, marginBottom: 4, letterSpacing: 0.4 }, children: "PREMIUM (PAID) -- OPT IN" }), AUTHORITY_SOURCES.filter((src) => src.tier === 'premium').map((src) => {
                        const checked = drt.mnem_drt_specialists[src.key] ?? authorityDefaultEnabled(src.tier);
                        return (_jsxs("label", { style: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, cursor: 'pointer' }, children: [_jsx("input", { type: "checkbox", checked: checked, onChange: (e) => updateSpecialist(src.key, e.target.checked), style: { width: 13, height: 13, marginTop: 1, accentColor: '#fbbf24', cursor: 'pointer' } }), _jsxs("span", { style: { fontSize: 10, color: '#94a3b8' }, children: [src.label, " ", _jsx("span", { style: { fontSize: 9, color: '#fbbf24', marginLeft: 4, fontWeight: 700 }, children: "PAID" }), _jsx("span", { style: { display: 'block', fontSize: 9, color: '#475569' }, children: src.domains.join(', ') }), _jsx("span", { style: { display: 'block', fontSize: 9, color: '#64748b', fontStyle: 'italic' }, children: src.costNote })] })] }, src.key));
                    }), _jsx("div", { style: { fontSize: 9, color: '#334155', marginTop: 8, fontStyle: 'italic' }, children: "W1 scope: specialist network calls are stubs -- full bridge lands in Week 1 build." })] })), !isNano && (_jsx("div", { style: s.card, children: _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }, children: "Filtration Pipeline" }), _jsxs("div", { style: { fontSize: 9, color: '#64748b', lineHeight: 1.6 }, children: ["Recommended on for best results. May slow first query by 2-5 seconds.", isFull ? ' Always active for FULL SKU.' : ''] })] }), _jsx("button", { onClick: () => !isFull && update({ filtration_pipeline_enabled: !drt.filtration_pipeline_enabled }), disabled: isFull, style: {
                                ...s.chip,
                                minWidth: 38,
                                ...(isFull || drt.filtration_pipeline_enabled
                                    ? { ...s.chipActive, color: '#6ee7b7', borderColor: 'rgba(110,231,183,0.4)' }
                                    : {}),
                                opacity: isFull ? 0.75 : 1,
                            }, children: isFull || drt.filtration_pipeline_enabled ? 'ON' : 'OFF' })] }) })), _jsxs("div", { style: s.card, children: [_jsx("div", { style: s.label, children: "Eblet store quota" }), _jsx("div", { style: s.toggleRow, children: EBLET_QUOTA_OPTIONS.map((q) => (_jsx("button", { onClick: () => update({ eblet_store_quota: q.id }), style: { ...s.chip, ...(drt.eblet_store_quota === q.id ? s.chipActive : {}) }, children: q.label }, q.id))) }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 4, lineHeight: 1.5 }, children: "Maximum local disk space for your sovereign eblet knowledge base." })] }), _jsxs("div", { style: s.card, children: [_jsx("div", { style: s.label, children: "Concordance strictness" }), _jsx("div", { style: s.toggleRow, children: CONCORDANCE_STRICTNESS_OPTIONS.map((opt) => (_jsx("button", { onClick: () => update({ concordance_strictness: opt.id }), style: { ...s.chip, ...(drt.concordance_strictness === opt.id ? s.chipActive : {}) }, children: opt.label }, opt.id))) }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 4, lineHeight: 1.5 }, children: "For conceptual/knowledge questions (never math or unit calculations), how many independent sources must agree before an answer is trusted. Lenient accepts a single source, matching today's default. Require 2 / Require majority ask for real corroboration first, and honestly abstain rather than accept an uncorroborated answer." })] }), _jsx("div", { style: s.card, children: _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }, children: "Federation eblet exchange" }), _jsx("div", { style: { fontSize: 9, color: '#64748b', lineHeight: 1.6 }, children: "Share substrate with trusted peers (opt-in). Your data leaves your computer only to peers you explicitly add. Default off across all SKUs." })] }), _jsx("button", { onClick: () => update({ federation_exchange_enabled: !drt.federation_exchange_enabled }), style: {
                                ...s.chip,
                                minWidth: 38,
                                ...(drt.federation_exchange_enabled
                                    ? { ...s.chipActive, color: '#6ee7b7', borderColor: 'rgba(110,231,183,0.4)' }
                                    : {}),
                            }, children: drt.federation_exchange_enabled ? 'ON' : 'OFF' })] }) }), _jsx("div", { style: { fontSize: 9, color: '#334155', marginTop: 4, fontStyle: 'italic', lineHeight: 1.5 }, children: "r10v3 substrate is injected on every query for all SKUs -- no configuration needed." })] }));
}
// ─── BP140-K3 — Homework: idle-time, AC-power, $0 local-Ollama-only background worker ────────
// Master toggle + idle-threshold picker. Round-trips through the SAME
// ai-dispatch:get-settings / ai-dispatch:save-settings IPC pair ProveItWorksTab.tsx's Answer
// Cache toggle uses (ai_dispatch_ipc.ts's homework_enabled / homework_idle_threshold_seconds
// fields) — no new IPC channel needed. OFF by default: getSettings() omits the field entirely
// on every settings file written before this Yoke, so `=== true` below is the honest default.
function HomeworkPanel() {
    const [enabled, setEnabled] = React.useState(false);
    const [idleMinutes, setIdleMinutes] = React.useState(5);
    const [loaded, setLoaded] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const s = styles;
    React.useEffect(() => {
        void (async () => {
            try {
                const res = await window.amplify?.aiDispatch?.getSettings?.();
                const settings = res?.settings;
                if (res?.ok && settings) {
                    setEnabled(settings.homework_enabled === true);
                    const secs = settings.homework_idle_threshold_seconds;
                    if (typeof secs === 'number' && secs > 0)
                        setIdleMinutes(Math.round(secs / 60));
                }
            }
            catch {
                // non-fatal -- defaults to OFF/5min, which matches the real defaults
            }
            setLoaded(true);
        })();
    }, []);
    const toggleEnabled = React.useCallback(async () => {
        const next = !enabled;
        setSaving(true);
        setEnabled(next);
        try {
            await window.amplify?.aiDispatch?.saveSettings?.({ homework_enabled: next });
        }
        catch {
            // non-fatal -- UI stays optimistic; next getSettings() read reconciles
        }
        setSaving(false);
    }, [enabled]);
    const updateIdleMinutes = React.useCallback(async (minutes) => {
        setIdleMinutes(minutes);
        try {
            await window.amplify?.aiDispatch?.saveSettings?.({ homework_idle_threshold_seconds: minutes * 60 });
        }
        catch {
            // non-fatal -- UI stays optimistic
        }
    }, []);
    return (_jsxs("section", { style: s.section, children: [_jsx("div", { style: s.sectionHeader, children: "\uD83C\uDF92 Homework (free background work)" }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginBottom: 6, lineHeight: 1.5 }, children: "When your computer is idle and plugged into AC power, MnemosyneC can do small substrate chores -- like cataloging an archive file into your Vault -- for free on your local AI model. Never the paid cloud. Never while you're asking a question or running a test." }), _jsx("div", { style: s.card, children: _jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }, children: "Enable Homework" }), _jsxs("div", { style: { fontSize: 9, color: '#64748b', lineHeight: 1.6 }, children: ["Off by default. Runs one job at a time, only on AC power, only after ", idleMinutes, ' ', "idle minute", idleMinutes === 1 ? '' : 's', "."] })] }), _jsx("button", { type: "button", onClick: () => void toggleEnabled(), disabled: saving || !loaded, style: {
                                ...s.chip,
                                minWidth: 44,
                                ...(enabled ? { ...s.chipActive } : {}),
                                cursor: saving ? 'wait' : 'pointer',
                            }, children: enabled ? 'ON' : 'OFF' })] }) }), enabled && (_jsxs("div", { style: { ...s.card, marginTop: 8 }, children: [_jsx("div", { style: s.label, children: "Idle threshold before Homework starts" }), _jsx("div", { style: s.toggleRow, children: [5, 10, 15, 30].map((m) => (_jsxs("button", { type: "button", onClick: () => void updateIdleMinutes(m), style: { ...s.chip, ...(idleMinutes === m ? s.chipActive : {}) }, children: [m, " min"] }, m))) })] }))] }));
}
const MODEL_OPTIONS = [
    { id: 'ollama_local', label: 'Ollama (local)', desc: 'Free · runs on your hardware · no API key needed' },
    { id: 'anthropic_cloud', label: 'Anthropic (cloud)', desc: 'Claude family · requires API key' },
    { id: 'manual', label: 'Manual / Other', desc: 'Enter endpoint + key yourself' },
];
const THEME_OPTIONS = [
    { id: 'dark', label: 'Dark', icon: '🌑' },
    { id: 'light', label: 'Light', icon: '☀️' },
    { id: 'system', label: 'System', icon: '💻' },
];
const ZOOM_OPTIONS = [
    { value: 1.0, label: '100%' },
    { value: 1.1, label: '110%' },
    { value: 1.15, label: '115% (default)' },
    { value: 1.2, label: '120%' },
    { value: 1.25, label: '125%' },
];
const MODE_OPTIONS = [
    { id: 'ai_burst', label: '🔥 AI Burst', desc: 'Claude AI for enhanced analysis · free API key from console.anthropic.com · pay-per-token' },
    { id: 'normal', label: '🪵 Normal', desc: 'Balanced · Ollama local AI · recommended for most tasks · zero marginal cost' },
    { id: 'fallback', label: '❄️ Fallback', desc: 'Substrate-only · no AI required · Stage 2 mode · always offline-capable' },
];
export function SettingsTab({ authState, onDevModeToggle, devEnabled = false, scrollTo, onScrollConsumed, }) {
    const isMember = authState?.status === 'member' || authState?.status === 'trial_active';
    const isFounder = authState?.member?.is_founder === true;
    const [showLocFaq, setShowLocFaq] = useState(false);
    const [showShare, setShowShare] = useState(false);
    // SEG-UX-3: current SKU tier for persistent tier text row
    const [currentSkuTier, setCurrentSkuTier] = useState(null);
    // SEG-UX-4: settings quick-jump search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    // SEG-R-5: Advanced collapsible -- resets to collapsed on every reload
    const [advancedOpen, setAdvancedOpen] = useState(false);
    // SEG-S-1: lifecycle stage hook (foundation for welcome tour, onboarding gates)
    const { resetToWelcome } = useLifecycleStage();
    // SEG-Q-13 BP078 / SEG-R-13: diagnostic state
    const [diagLogPath, setDiagLogPath] = React.useState(null);
    const [diagRunning, setDiagRunning] = React.useState(false);
    const [diagError, setDiagError] = React.useState(null);
    // v0.4.2 BP083 SEG-3: Hardware tier detection + model selection
    const [hwTier, setHwTier] = React.useState(null);
    const [hwModelSaving, setHwModelSaving] = React.useState(false);
    const handleRunDiagnostic = React.useCallback(async () => {
        setDiagRunning(true);
        setDiagError(null);
        setDiagLogPath(null);
        try {
            const result = await window.amplify?.runDiagnostic?.();
            if (result?.ok) {
                setDiagLogPath(result.logPath);
            }
            else {
                setDiagError('Diagnostic returned no result. Check main process log.');
            }
        }
        catch (err) {
            setDiagError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setDiagRunning(false);
        }
    }, []);
    // Section refs for scroll-to-anchor
    const sectionRefs = useRef(new Map());
    // SEG-UX-3: load current SKU tier on mount + subscribe to upgrade completion
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const result = (await window.amplify?.sku?.currentTier?.()) ?? { tier: 'nano' };
                if (!cancelled)
                    setCurrentSkuTier(result.tier);
            }
            catch {
                if (!cancelled)
                    setCurrentSkuTier('nano');
            }
        })();
        // SEG-UX-7: refresh tier text after upgrade completes (handles upgrade from pill modal)
        const unsubComplete = window.amplify?.sku?.onPullComplete?.(() => {
            if (!cancelled)
                setCurrentSkuTier('full');
        }) ?? (() => { });
        return () => {
            cancelled = true;
            unsubComplete();
        };
    }, []);
    // SEG-UX-2: scroll to target section when prop changes
    useEffect(() => {
        if (!scrollTo)
            return;
        const el = sectionRefs.current.get(scrollTo);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        onScrollConsumed?.();
    }, [scrollTo, onScrollConsumed]);
    // v0.4.2 BP083 SEG-3: Load hardware tier info on mount
    useEffect(() => {
        void (async () => {
            try {
                const result = await window.amplify?.hardwareGetTier?.();
                if (result)
                    setHwTier(result);
            }
            catch {
                // Non-fatal — hardware tier is best-effort
            }
        })();
    }, []);
    const [updateStatus, setUpdateStatus] = useState({
        checking: false,
        upToDate: null,
        currentVersion: '',
        latestVersion: null,
        error: null,
    });
    // G.2 KniPr011: Subscribe to electron-updater state changes for proper install button state machine.
    // Status machine: idle/not-available → "Check for update"; checking → "Checking…";
    // available → show available version; downloading → show progress; downloaded → "Restart to update"
    const [liveUpdateState, setLiveUpdateState] = useState(null);
    useEffect(() => {
        if (!window.amplify)
            return;
        window.amplify.getUpdateState?.().then(setLiveUpdateState).catch(() => { });
        const cleanup = window.amplify.onUpdateStateChanged?.((s) => setLiveUpdateState(s));
        return cleanup ?? undefined;
    }, []);
    const [theme, setTheme] = useState(() => localStorage.getItem('mnemo_theme') ?? 'dark');
    const [zoomFactor, setZoomFactor] = useState(() => {
        const stored = localStorage.getItem('ui.zoomFactor');
        return stored ? parseFloat(stored) : 1.15;
    });
    const [substrateMode, setSubstrateMode] = useState(() => localStorage.getItem('mnemo_default_mode') ?? 'normal');
    const [pieceModels, setPieceModels] = useState(() => {
        const saved = localStorage.getItem('mnemo_piece_models');
        if (saved) {
            try {
                return JSON.parse(saved);
            }
            catch { /* fall through */ }
        }
        return { bishop: 'ollama_local', knight: 'ollama_local', pawn: 'ollama_local', rook: 'ollama_local' };
    });
    useEffect(() => {
        const ver = window.amplify?.getVersion?.();
        if (ver) {
            setUpdateStatus((s) => ({ ...s, currentVersion: ver }));
        }
    }, []);
    async function handleCheckForUpdate() {
        setUpdateStatus((s) => ({ ...s, checking: true, upToDate: null, error: null }));
        try {
            window.amplify?.checkForUpdates?.();
            // State arrives via onUpdateStateChanged / liveUpdateState — brief checking window
            setTimeout(() => {
                setUpdateStatus((s) => ({ ...s, checking: false }));
            }, 2500);
        }
        catch {
            setUpdateStatus((s) => ({ ...s, checking: false, error: 'Update check failed · try again later.' }));
        }
    }
    function handleThemeChange(t) {
        setTheme(t);
        localStorage.setItem('mnemo_theme', t);
    }
    function handleZoomChange(factor) {
        setZoomFactor(factor);
        localStorage.setItem('ui.zoomFactor', String(factor));
        window.amplify?.setZoomFactor?.(factor);
    }
    function handleModeChange(m) {
        setSubstrateMode(m);
        localStorage.setItem('mnemo_default_mode', m);
    }
    function handleModelChange(piece, model) {
        const updated = { ...pieceModels, [piece]: model };
        setPieceModels(updated);
        localStorage.setItem('mnemo_piece_models', JSON.stringify(updated));
    }
    const s = styles;
    // Section header search data (SEG-R-4, SEG-R-6 renames applied)
    const SECTION_HEADERS = [
        { key: 'update', label: 'App Version', keywords: ['update', 'version', 'download', 'install', 'app version'] },
        { key: 'ai-capability', label: 'AI Capability', keywords: ['ai capability', 'activate full', 'upgrade', 'tier'] },
        { key: 'membership', label: 'Cooperative Membership', keywords: ['membership', 'cooperative', '$5', 'mirror clause', 'incentive'] },
        { key: 'ai-tier', label: 'AI Power Tier', keywords: ['ai power tier', 'ai tier', 'gemma', 'model', 'full', 'nano', 'upgrade', 'sku'] },
        { key: 'ai-model', label: 'AI Model Assignment', keywords: ['ai model', 'ollama', 'bishop', 'knight', 'pawn', 'rook', 'orchestrator', 'builder', 'researcher', 'primary assistant'] },
        { key: 'hardware-tier', label: 'Hardware Tier & Plow Model', keywords: ['hardware', 'ram', 'plow model', 'gemma2', 'qwen', 'lightweight', 'standard', 'premium', 'heavy', 'model select'] },
        { key: 'mnem-drt', label: 'Memory Depth Tier', keywords: ['mnem', 'drt', 'retrieval', 'specialist', 'wikipedia', 'wikidata', 'arxiv', 'wolfram', 'memory depth'] },
        { key: 'homework', label: 'Homework (free background work)', keywords: ['homework', 'idle', 'background', 'free', 'ollama', 'battery', 'ac power', 'forage'] },
        { key: 'advanced', label: 'Advanced', keywords: ['devtools', 'developer tools', 'debugging', 'remote-debugging', 'advanced', 'inspect', 'diagnostic'] },
        { key: 'appearance', label: 'Appearance', keywords: ['appearance', 'theme', 'dark', 'light', 'zoom', 'interface zoom', 'scale'] },
        { key: 'substrate', label: 'Substrate Mode', keywords: ['substrate', 'mode', 'burst', 'normal', 'fallback'] },
        { key: 'developer', label: 'Developer Mode', keywords: ['developer', 'dev mode', 'devmode'] },
        { key: 'research', label: 'Research Participation', keywords: ['chronos', 'research', 'consent'] },
        { key: 'contribution', label: 'My Contribution', keywords: ['contribution', 'marks', 'stamps'] },
        { key: 'grand-projects', label: 'Grand Projects', keywords: ['grand projects', 'project'] },
        { key: 'substrate-folders', label: 'Substrate Folders', keywords: ['folders', 'index', 'watcher'] },
    ];
    const searchResults = searchQuery.trim().length > 0
        ? SECTION_HEADERS.filter((sec) => {
            const q = searchQuery.toLowerCase();
            return (sec.label.toLowerCase().includes(q) ||
                sec.keywords.some((k) => k.includes(q)));
        })
        : [];
    function scrollToSection(key) {
        const el = sectionRefs.current.get(key);
        if (el)
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setSearchQuery('');
        setSearchOpen(false);
    }
    function setSectionRef(key) {
        return (el) => {
            if (el)
                sectionRefs.current.set(key, el);
        };
    }
    return (_jsxs("div", { style: s.container, children: [_jsxs("div", { style: { borderBottom: '1px solid #2a2a2a', paddingBottom: 16, marginBottom: 16 }, children: [_jsx("div", { style: { fontWeight: 600, color: '#eee', marginBottom: 4 }, children: "Run Diagnostic" }), _jsx("div", { style: { fontSize: '0.82rem', color: '#888', marginBottom: 8 }, children: "Check your AI engine and memory system health." }), _jsx("button", { disabled: diagRunning, onClick: handleRunDiagnostic, style: {
                            ...s.btn,
                            background: diagRunning ? 'rgba(148,163,184,0.04)' : 'rgba(148,163,184,0.08)',
                            borderColor: 'rgba(148,163,184,0.25)',
                            color: diagRunning ? '#475569' : '#94a3b8',
                            cursor: diagRunning ? 'not-allowed' : 'pointer',
                            opacity: diagRunning ? 0.6 : 1,
                        }, children: diagRunning ? 'Running diagnostic...' : 'Run Diagnostic' })] }), _jsxs("div", { style: { position: 'relative', marginBottom: 12 }, children: [_jsx("input", { type: "search", placeholder: "Search settings... (e.g. AI Power Tier, retrieval)", value: searchQuery, onChange: (e) => { setSearchQuery(e.target.value); setSearchOpen(true); }, onFocus: () => setSearchOpen(true), onBlur: () => setTimeout(() => setSearchOpen(false), 150), role: "combobox", "aria-expanded": searchOpen && searchResults.length > 0, "aria-autocomplete": "list", "aria-controls": "settings-search-results", "aria-label": "Search settings sections", style: {
                            width: '100%',
                            padding: '7px 12px',
                            background: 'rgba(15,23,42,0.7)',
                            border: '1px solid rgba(100,116,139,0.25)',
                            borderRadius: 7,
                            color: '#e2e8f0',
                            fontSize: 11,
                            outline: 'none',
                            boxSizing: 'border-box',
                            fontFamily: 'inherit',
                        } }), searchOpen && searchResults.length > 0 && (_jsx("ul", { id: "settings-search-results", role: "listbox", "aria-label": "Search results", style: {
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#111827',
                            border: '1px solid rgba(100,116,139,0.25)',
                            borderRadius: '0 0 7px 7px',
                            zIndex: 100,
                            margin: 0,
                            padding: '4px 0',
                            listStyle: 'none',
                            boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                        }, children: searchResults.map((sec) => (_jsx("li", { role: "option", "aria-selected": false, onMouseDown: () => scrollToSection(sec.key), style: {
                                padding: '7px 14px',
                                cursor: 'pointer',
                                fontSize: 11,
                                color: '#94a3b8',
                            }, onMouseEnter: (e) => { e.currentTarget.style.background = 'rgba(110,231,183,0.07)'; e.currentTarget.style.color = '#6ee7b7'; }, onMouseLeave: (e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }, children: sec.label }, sec.key))) }))] }), _jsx("div", { style: {
                    fontSize: 9,
                    color: '#475569',
                    marginBottom: 10,
                    lineHeight: 1.6,
                    padding: '5px 10px',
                    background: 'rgba(100,116,139,0.05)',
                    borderRadius: 6,
                    border: '1px solid rgba(100,116,139,0.1)',
                }, children: "App updates change software. AI upgrades add model capability. Membership supports cooperative benefits." }), _jsxs("section", { style: s.section, children: [_jsx("div", { style: s.sectionHeader, children: "Interface Mode" }), _jsx("div", { style: s.card, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { children: [_jsx("div", { style: s.label, children: "Advanced mode (shows all tabs)" }), _jsx("div", { style: { fontSize: 11, color: '#475569', marginTop: 2 }, children: "Switch between the simplified 3-tab view and the full multi-tab shell." })] }), _jsx("button", { onClick: () => {
                                        const current = localStorage.getItem('mnemoUiMode') ?? 'lean';
                                        const next = current === 'advanced' ? 'lean' : 'advanced';
                                        localStorage.setItem('mnemoUiMode', next);
                                        // Trigger storage event for LeanShell cross-window sync
                                        window.dispatchEvent(new StorageEvent('storage', { key: 'mnemoUiMode', newValue: next, storageArea: localStorage }));
                                    }, style: {
                                        ...s.btn,
                                        background: localStorage.getItem('mnemoUiMode') === 'advanced' ? '#10b981' : '#1e2a38',
                                        color: '#fff',
                                        minWidth: 64,
                                    }, children: localStorage.getItem('mnemoUiMode') === 'advanced' ? 'ON' : 'OFF' })] }) })] }), _jsxs("section", { ref: setSectionRef('update'), style: s.section, id: "settings-section-update", children: [_jsx("div", { style: s.sectionHeader, children: "App Version" }), _jsxs("div", { style: s.card, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }, children: [_jsxs("div", { children: [_jsx("div", { style: s.label, children: "Current version" }), _jsx("div", { style: s.value, children: updateStatus.currentVersion || liveUpdateState?.version || '\u2014' })] }), liveUpdateState?.status === 'available' && liveUpdateState.version && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }, children: [_jsxs("div", { children: [_jsx("div", { style: s.label, children: "Available" }), _jsxs("div", { style: { ...s.value, color: '#6ee7b7' }, children: ["v", liveUpdateState.version] })] }), _jsx("button", { onClick: () => window.amplify?.downloadUpdate?.(), style: { ...s.btn, background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)', color: '#fbbf24', fontWeight: 700 }, children: "Install Now" })] })), (!liveUpdateState || liveUpdateState.status === 'idle' || liveUpdateState.status === 'not-available' || liveUpdateState.status === 'error') && (_jsx("button", { onClick: handleCheckForUpdate, disabled: updateStatus.checking, style: { ...s.btn, opacity: updateStatus.checking ? 0.6 : 1 }, children: updateStatus.checking ? 'Checking...' : 'Check for Updates' })), liveUpdateState?.status === 'checking' && (_jsx("button", { disabled: true, style: { ...s.btn, opacity: 0.5 }, children: "Checking..." })), liveUpdateState?.status === 'downloading' && (_jsxs("div", { style: { fontSize: 10, color: '#6ee7b7' }, children: ["Downloading... ", liveUpdateState.downloadProgress ?? 0, "%"] })), liveUpdateState?.status === 'downloaded' && (_jsx("button", { onClick: () => window.amplify?.installUpdate?.(), style: { ...s.btn, background: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.4)', color: '#22c55e', fontWeight: 700 }, children: "Restart to update" }))] }), liveUpdateState?.status === 'downloading' && (_jsx("div", { style: { marginTop: 8, height: 4, background: 'rgba(100,116,139,0.2)', borderRadius: 2, overflow: 'hidden' }, children: _jsx("div", { style: {
                                        height: '100%',
                                        width: `${liveUpdateState.downloadProgress ?? 0}%`,
                                        background: 'linear-gradient(90deg, #6ee7b7, #22c55e)',
                                        borderRadius: 2,
                                        transition: 'width 0.3s ease',
                                    } }) })), liveUpdateState?.status === 'not-available' && (_jsx("div", { style: s.successMsg, children: "You are on the latest version" })), (!liveUpdateState || liveUpdateState.status === 'idle') && updateStatus.upToDate === true && (_jsx("div", { style: s.successMsg, children: "You are on the latest version" })), updateStatus.error && (_jsx("div", { style: { fontSize: 10, color: '#f87171', marginTop: 6 }, children: updateStatus.error })), _jsx(AutoInstallToggle, {})] })] }), _jsx(AutomaticUpdatesSection, {}), _jsx(NexusAuthoritySettings, {}), _jsx(NexusAuthoritySignInPanel, {}), _jsx(QueryCaptureArchivePanel, {}), _jsxs("section", { ref: setSectionRef('ai-capability'), style: s.section, id: "settings-section-ai-capability", children: [_jsx("div", { style: s.sectionHeader, children: "AI Capability" }), _jsxs("div", { style: s.card, children: [currentSkuTier && (_jsxs("div", { style: { marginBottom: 8 }, children: [_jsx("div", { style: s.label, children: "Current AI Power Tier" }), _jsxs("div", { style: {
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: currentSkuTier === 'full' ? '#4ade80' : '#94a3b8',
                                            marginTop: 2,
                                        }, children: [currentSkuTier.toUpperCase(), currentSkuTier === 'full' && (_jsx("span", { style: { fontSize: 10, fontWeight: 400, marginLeft: 6, color: '#6ee7b7' }, children: "Google's Gemma 4 12B" }))] })] })), _jsx("div", { style: { fontSize: 10, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }, children: "Upgrade to FULL for maximum reasoning power" }), _jsx("button", { disabled: currentSkuTier === 'full', onClick: () => {
                                    const el = sectionRefs.current.get('ai-tier');
                                    if (el)
                                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, style: {
                                    ...s.btn,
                                    background: currentSkuTier === 'full' ? 'rgba(74,222,128,0.08)' : 'rgba(110,231,183,0.1)',
                                    borderColor: currentSkuTier === 'full' ? 'rgba(74,222,128,0.3)' : 'rgba(110,231,183,0.3)',
                                    color: currentSkuTier === 'full' ? '#4ade80' : '#6ee7b7',
                                    opacity: currentSkuTier === 'full' ? 0.7 : 1,
                                }, children: currentSkuTier === 'full' ? 'FULL active' : 'Activate FULL' })] })] }), _jsxs("section", { style: s.section, id: "settings-section-membership", children: [_jsx("div", { style: s.sectionHeader, children: "Cooperative Membership" }), _jsxs("div", { style: s.card, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }, children: [_jsx("span", { style: { fontSize: 18, fontWeight: 700, color: '#6ee7b7' }, children: "$5" }), _jsx("span", { style: { fontSize: 10, color: '#64748b' }, children: "/year" })] }), _jsx("div", { style: { fontSize: 10, color: '#94a3b8', marginBottom: 6, lineHeight: 1.5 }, children: "Mirror Clause + Incentive to Hire benefits" }), _jsx("div", { style: { fontSize: 9, color: '#64748b', lineHeight: 1.5 }, children: "Earn and spend within the cooperative" })] })] }), _jsxs("section", { ref: setSectionRef('ai-tier'), style: s.section, id: "settings-section-ai-tier", children: [_jsx("div", { style: s.sectionHeader, children: "AI Power Tier" }), _jsx("div", { style: { fontSize: 10, color: '#475569', marginBottom: 6, lineHeight: 1.5 }, children: "AI model tier. Sets the local model used for answers." }), currentSkuTier && (_jsxs("p", { style: {
                            fontSize: 11,
                            fontWeight: 600,
                            color: currentSkuTier === 'full' ? '#4ade80' : '#94a3b8',
                            margin: '0 0 10px',
                            padding: '6px 10px',
                            background: currentSkuTier === 'full'
                                ? 'rgba(74,222,128,0.07)'
                                : 'rgba(100,116,139,0.07)',
                            border: currentSkuTier === 'full'
                                ? '1px solid rgba(74,222,128,0.2)'
                                : '1px solid rgba(100,116,139,0.15)',
                            borderRadius: 6,
                        }, children: ["Current AI tier: ", currentSkuTier === 'full'
                                ? "FULL (Google's Gemma 4 12B)"
                                : currentSkuTier.toUpperCase()] })), _jsx(SkuUpgradePanel, { analytics: undefined }), _jsx("div", { style: { ...s.sectionHeader, marginTop: 14, marginBottom: 6 }, children: "AI Model Assignment" }), _jsx("div", { style: s.note, children: "FREE AI: Ollama (onboard by default) -- no cloud account, no API key, no cost" }), _jsx("div", { ref: setSectionRef('ai-model'), id: "settings-section-ai-model", children: ([
                            {
                                piece: 'pawn',
                                functional: 'Primary Assistant',
                                canon: 'Pawn',
                                job: 'Handles everyday chat and quick questions.',
                                recommended: true,
                            },
                            {
                                piece: 'bishop',
                                functional: 'Orchestrator',
                                canon: 'Bishop',
                                job: 'Foreman -- plans the work and manages agents.',
                                recommended: false,
                            },
                            {
                                piece: 'knight',
                                functional: 'Builder',
                                canon: 'Knight',
                                job: 'Writes code and ships releases.',
                                recommended: false,
                            },
                            {
                                piece: 'rook',
                                functional: 'Researcher',
                                canon: 'Rook',
                                job: 'Deep architecture reviews. Currently paused.',
                                recommended: false,
                            },
                        ]).map(({ piece, functional, canon, job, recommended }) => (_jsxs("div", { style: { ...s.card, marginBottom: 6, position: 'relative' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }, children: [_jsxs("div", { style: { ...s.label, marginBottom: 0 }, title: job, children: [functional, " (", canon, ")"] }), recommended && (_jsx("span", { style: {
                                                fontSize: 8,
                                                fontWeight: 700,
                                                color: '#6ee7b7',
                                                background: 'rgba(110,231,183,0.12)',
                                                border: '1px solid rgba(110,231,183,0.3)',
                                                borderRadius: 4,
                                                padding: '1px 5px',
                                                letterSpacing: '0.03em',
                                            }, children: "Recommended" }))] }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginBottom: 6, lineHeight: 1.4 }, children: job }), _jsx("div", { style: s.toggleRow, children: MODEL_OPTIONS.map((m) => (_jsx("button", { onClick: () => handleModelChange(piece, m.id), style: {
                                            ...s.chip,
                                            ...(pieceModels[piece] === m.id ? s.chipActive : {}),
                                        }, title: m.desc, children: m.label }, m.id))) })] }, piece))) })] }), _jsxs("section", { style: s.section, id: "settings-section-hardware-tier", children: [_jsx("div", { style: s.sectionHeader, children: "Hardware Tier & Plow Model" }), _jsx("div", { style: { fontSize: 10, color: '#475569', marginBottom: 10, lineHeight: 1.5 }, children: "MnemosyneC detects your system RAM and recommends the best local model for the Canonical Plow. Lightweight machines (\u226411 GB) default to gemma2:2b \u00B7 no more failed Plows on low-RAM hardware." }), !hwTier ? (_jsx("div", { style: { fontSize: 11, color: '#475569', padding: '8px 0' }, children: "Detecting hardware\u2026" })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(100,116,139,0.15)',
                                    borderRadius: 8, padding: '10px 14px', marginBottom: 10,
                                }, children: [_jsx("div", { style: { fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }, children: "Detected" }), _jsxs("div", { style: { fontSize: 12, color: '#e2e8f0', marginBottom: 2 }, children: [hwTier.effectiveModelResult?.overrideActive
                                                ? `${hwTier.effectiveModelResult.tier} (Override: ${hwTier.effectiveModelResult.model})`
                                                : hwTier.tier.displayName, " \u00B7 ", hwTier.tier.ramGb, " GB RAM"] }), _jsx("div", { style: { fontSize: 10, color: '#94a3b8', marginBottom: 4 }, children: hwTier.tier.description }), _jsxs("div", { style: { fontSize: 10, color: '#64748b' }, children: ["Active Plow model: ", _jsx("span", { style: { color: '#a78bfa', fontFamily: 'monospace' }, children: hwTier.activeModel })] })] }), _jsx("div", { style: { fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }, children: "Override Model" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: hwTier.allTiers.map((t) => {
                                    const isActive = hwTier.activeModel === t.recommendedModel;
                                    const isRecommended = hwTier.tier.tier === t.tier;
                                    return (_jsx("button", { type: "button", disabled: hwModelSaving, onClick: async () => {
                                            setHwModelSaving(true);
                                            try {
                                                await window.amplify?.hardwareSetModel?.(t.recommendedModel, t.tier);
                                                setHwTier((prev) => prev ? { ...prev, activeModel: t.recommendedModel } : prev);
                                            }
                                            finally {
                                                setHwModelSaving(false);
                                            }
                                        }, style: {
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            background: isActive ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${isActive ? 'rgba(167,139,250,0.35)' : 'rgba(100,116,139,0.15)'}`,
                                            borderRadius: 7, padding: '8px 12px', cursor: hwModelSaving ? 'not-allowed' : 'pointer',
                                            textAlign: 'left', width: '100%',
                                        }, children: _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { fontSize: 11, color: isActive ? '#a78bfa' : '#e2e8f0', fontWeight: isActive ? 600 : 400 }, children: [t.displayName, isRecommended && !isActive && (_jsx("span", { style: { marginLeft: 6, fontSize: 9, color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '1px 5px', borderRadius: 3 }, children: "RECOMMENDED" })), isActive && (_jsx("span", { style: { marginLeft: 6, fontSize: 9, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '1px 5px', borderRadius: 3 }, children: "ACTIVE" }))] }), _jsx("div", { style: { fontSize: 9, color: '#64748b', marginTop: 2 }, children: t.description })] }) }, t.tier));
                                }) }), _jsxs("button", { type: "button", disabled: hwModelSaving, onClick: async () => {
                                    setHwModelSaving(true);
                                    try {
                                        const result = await window.amplify?.hardwareResetModel?.();
                                        if (result?.ok) {
                                            setHwTier((prev) => prev ? { ...prev, activeModel: result.model } : prev);
                                        }
                                    }
                                    finally {
                                        setHwModelSaving(false);
                                    }
                                }, style: {
                                    marginTop: 8, fontSize: 10, color: '#64748b',
                                    background: 'none', border: '1px solid rgba(100,116,139,0.2)',
                                    borderRadius: 5, padding: '4px 10px', cursor: hwModelSaving ? 'not-allowed' : 'pointer',
                                }, children: ["Reset to auto-detected (", hwTier.tier.recommendedModel, ")"] })] }))] }), _jsx("div", { ref: setSectionRef('mnem-drt'), id: "settings-section-mnem-drt", children: _jsx(MnemDrtPanel, {}) }), _jsx("div", { ref: setSectionRef('homework'), id: "settings-section-homework", children: _jsx(HomeworkPanel, {}) }), _jsxs("section", { style: s.section, id: "settings-section-advanced", children: [_jsxs("button", { onClick: () => setAdvancedOpen((o) => !o), "aria-expanded": advancedOpen, "aria-controls": "advanced-panel-content", style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0 0 6px',
                            width: '100%',
                            textAlign: 'left',
                        }, children: [_jsx("span", { style: { ...s.sectionHeader, marginBottom: 0 }, children: "Advanced" }), _jsx("span", { style: { fontSize: 10, color: '#475569', marginLeft: 'auto' }, children: advancedOpen ? '\u25b2' : '\u25bc' })] }), advancedOpen && (_jsx("div", { id: "advanced-panel-content", children: _jsxs("div", { style: s.card, children: [_jsxs("div", { style: { marginBottom: 12 }, children: [_jsx("div", { style: s.label, children: "Developer Tools" }), _jsxs("div", { style: { fontSize: 9, color: '#475569', marginTop: 2, marginBottom: 8 }, children: ["Open the Chromium DevTools panel for this window. Keyboard shortcut: Ctrl+Shift+D (may conflict on some machines). Right-click the window title bar and choose \"Toggle Developer Tools\". Power-user path: launch with ", _jsx("code", { style: { fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }, children: "--remote-debugging-port=9222" }), " and connect via Chrome at ", _jsx("code", { style: { fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }, children: "chrome://inspect" }), "."] }), _jsx("button", { onClick: () => window.amplify?.toggleDevTools?.(), style: {
                                                ...s.btn,
                                                background: 'rgba(148,163,184,0.08)',
                                                borderColor: 'rgba(148,163,184,0.25)',
                                                color: '#94a3b8',
                                            }, children: "Toggle DevTools" })] }), _jsxs("div", { style: { marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }, children: [_jsx("div", { style: s.label, children: "Diagnostic Log" }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 2, marginBottom: 8 }, children: "Runs a probe of app state (Ollama, SKU tier, disk, windows) and writes a log file to your userData folder. Share with Bishop or Knight for debugging. No DevTools required." }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, children: [_jsx("button", { disabled: diagRunning, onClick: handleRunDiagnostic, style: {
                                                        ...s.btn,
                                                        background: diagRunning ? 'rgba(148,163,184,0.04)' : 'rgba(148,163,184,0.08)',
                                                        borderColor: 'rgba(148,163,184,0.25)',
                                                        color: diagRunning ? '#475569' : '#94a3b8',
                                                        cursor: diagRunning ? 'not-allowed' : 'pointer',
                                                        opacity: diagRunning ? 0.6 : 1,
                                                    }, children: diagRunning ? 'Running diagnostic...' : 'Run Diagnostic' }), diagError && (_jsx("button", { onClick: () => {
                                                        setDiagError(null);
                                                        setDiagLogPath(null);
                                                    }, style: {
                                                        ...s.btn,
                                                        background: 'rgba(239,68,68,0.08)',
                                                        borderColor: 'rgba(239,68,68,0.3)',
                                                        color: '#f87171',
                                                        cursor: 'pointer',
                                                    }, children: "Retry" }))] }), diagLogPath && (_jsxs("div", { style: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsxs("div", { style: { fontSize: 9, color: '#6ee7b7' }, children: ["Log saved to: ", diagLogPath] }), _jsx("button", { onClick: () => window.amplify?.openDiagFolder?.(diagLogPath), style: {
                                                        ...s.btn,
                                                        alignSelf: 'flex-start',
                                                        background: 'rgba(110,231,183,0.08)',
                                                        borderColor: 'rgba(110,231,183,0.25)',
                                                        color: '#6ee7b7',
                                                        cursor: 'pointer',
                                                    }, children: "Open log folder" })] })), diagError && !diagRunning && (_jsxs("div", { style: { marginTop: 6, fontSize: 9, color: '#f87171' }, children: ["Error: ", diagError] }))] }), _jsxs("div", { style: { marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }, children: [_jsx("div", { style: s.label, children: "Welcome Tour" }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 2, marginBottom: 8 }, children: "Returns to the welcome screen. Your AI settings and memory are preserved." }), _jsx("button", { onClick: resetToWelcome, style: {
                                                ...s.btn,
                                                background: 'rgba(248,113,113,0.08)',
                                                borderColor: 'rgba(248,113,113,0.25)',
                                                color: '#f87171',
                                            }, children: "Reset to Welcome Tour" })] })] }) }))] }), _jsxs("section", { ref: setSectionRef('appearance'), style: s.section, id: "settings-section-appearance", children: [_jsx("div", { style: s.sectionHeader, children: "Appearance" }), _jsxs("div", { style: s.card, children: [_jsx("div", { style: s.label, children: "Theme" }), _jsx("div", { style: s.toggleRow, children: THEME_OPTIONS.map((t) => (_jsxs("button", { onClick: () => handleThemeChange(t.id), style: {
                                        ...s.chip,
                                        ...(theme === t.id ? s.chipActive : {}),
                                    }, children: [t.icon, " ", t.label] }, t.id))) })] }), _jsxs("div", { style: { ...s.card, marginTop: 6 }, children: [_jsx("div", { style: s.label, children: "Interface Zoom" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("select", { value: zoomFactor, onChange: (e) => handleZoomChange(parseFloat(e.target.value)), style: {
                                            background: 'rgba(15,23,42,0.8)',
                                            border: '1px solid rgba(100,116,139,0.25)',
                                            borderRadius: 6,
                                            color: '#e2e8f0',
                                            fontSize: 11,
                                            padding: '4px 8px',
                                            cursor: 'pointer',
                                            outline: 'none',
                                            fontFamily: 'inherit',
                                        }, children: ZOOM_OPTIONS.map((z) => (_jsx("option", { value: z.value, children: z.label }, z.value))) }), _jsx("span", { style: { fontSize: 9, color: '#475569' }, children: "Applied to all windows immediately" })] })] }), _jsx("div", { style: { ...s.card, marginTop: 6 }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }, children: "Share MnemosyneC" }), _jsx("div", { style: { fontSize: 9, color: '#475569', lineHeight: 1.5 }, children: "Send a download link with your referral ID. You may earn cooperative credit." })] }), _jsx("button", { onClick: () => setShowShare(true), style: {
                                        ...s.btn,
                                        background: 'rgba(110,231,183,0.08)',
                                        borderColor: 'rgba(110,231,183,0.25)',
                                        color: '#6ee7b7',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                    }, children: "Share \u2192" })] }) })] }), showShare && _jsx(ShareMnemosyneC, { onClose: () => setShowShare(false) }), _jsx(AutoPreparePullPanel, {}), _jsx(SubstrateCounterPanel, {}), _jsx(McpSubstrateBridgePanel, {}), _jsx(SubstrateAwakensJoinPanel, {}), _jsxs("section", { ref: setSectionRef('substrate'), style: s.section, id: "settings-section-substrate", children: [_jsx("div", { style: s.sectionHeader, children: "Substrate Mode" }), _jsxs("div", { style: s.card, children: [_jsx("div", { style: s.toggleRow, children: MODE_OPTIONS.map((m) => (_jsx("button", { onClick: () => handleModeChange(m.id), style: {
                                        ...s.chip,
                                        ...(substrateMode === m.id ? s.chipActive : {}),
                                    }, title: m.desc, children: m.label }, m.id))) }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 6 }, children: MODE_OPTIONS.find((m) => m.id === substrateMode)?.desc }), substrateMode === 'ai_burst' && (_jsxs("div", { style: { fontSize: 9, color: '#fbbf24', marginTop: 6, lineHeight: 1.6 }, children: ["AI Burst uses Anthropic's Claude AI.", ' ', _jsx("button", { onClick: () => window.amplify?.openExternal?.('https://console.anthropic.com'), style: { background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontSize: 9, padding: 0, textDecoration: 'underline' }, children: "Get your free API key \u2192" })] }))] })] }), (isMember || isFounder) && (_jsxs("section", { ref: setSectionRef('developer'), style: s.section, id: "settings-section-developer", children: [_jsx("div", { style: s.sectionHeader, children: "Developer Mode" }), _jsx("div", { style: s.card, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { children: [_jsx("div", { style: s.label, children: "Cooperative Defensive Patent Pledge #2260" }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 2 }, children: devEnabled ? 'Developer mode active -- submit variants -- fork strains -- SEG controls' : 'Requires membership + Pledge #2260 agreement' })] }), _jsx("button", { onClick: () => onDevModeToggle?.(!devEnabled), style: {
                                        ...s.chip,
                                        ...(devEnabled ? { ...s.chipActive, color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)' } : {}),
                                    }, children: devEnabled ? 'ON' : 'OFF' })] }) })] })), _jsx(ChronosResearchPanel, {}), _jsx(MyContributionPanel, {}), _jsx(FolderManagerPanel, {}), _jsxs("section", { ref: setSectionRef('grand-projects'), style: s.section, id: "settings-section-grand-projects", children: [_jsx("div", { style: s.sectionHeader, children: "Grand Projects" }), _jsx("div", { style: s.card, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }, children: "Library of Congress Grand Project" }), _jsx("div", { style: { fontSize: 9, color: '#64748b', lineHeight: 1.5 }, children: "10,000-node cooperative network -- digitizing human knowledge -- free forever" })] }), _jsx("button", { onClick: () => setShowLocFaq(true), style: {
                                        ...s.btn,
                                        background: 'rgba(110,231,183,0.08)',
                                        borderColor: 'rgba(110,231,183,0.25)',
                                        color: '#6ee7b7',
                                        whiteSpace: 'nowrap',
                                    }, children: "Library of Congress FAQ" })] }) })] }), showLocFaq && _jsx(LocFaqModal, { onClose: () => setShowLocFaq(false) })] }));
}
function FolderManagerPanel() {
    const [folders, setFolders] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [picking, setPicking] = React.useState(false);
    React.useEffect(() => {
        (async () => {
            try {
                const data = await window.amplify?.watcher?.listFolders?.();
                setFolders(data ?? []);
            }
            catch { /* watcher unavailable */ }
        })();
    }, []);
    async function pick() {
        setPicking(true);
        try {
            const result = await window.amplify?.watcher?.openFolderDialog?.();
            if (result && !result.canceled && result.filePaths.length > 0) {
                const path = result.filePaths[0];
                await window.amplify?.watcher?.addFolder?.(path);
                const data = await window.amplify?.watcher?.listFolders?.();
                setFolders(data ?? []);
                // Record that N=3 prompt 1 was shown (first-run already handles this)
                const n = Number(localStorage.getItem('mnemo_folder_prompt_count') ?? 0);
                if (n < 1)
                    localStorage.setItem('mnemo_folder_prompt_count', '1');
            }
        }
        catch { /* dialog unavailable */ }
        finally {
            setPicking(false);
        }
    }
    return (_jsxs("section", { style: { margin: '0 0 8px', padding: '0 0 8px' }, children: [_jsx("div", { style: { fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '6px 0 4px', marginBottom: 4 }, children: "\uD83D\uDCC2 Managed Folders" }), _jsxs("div", { style: { background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(100,116,139,0.15)', borderRadius: 8, padding: '10px 12px' }, children: [_jsx("div", { style: { fontSize: 10, color: '#64748b', marginBottom: 8, lineHeight: 1.5 }, children: "Folders your AI indexes for memory. Add more to improve recall." }), folders.length === 0 ? (_jsx("div", { style: { fontSize: 10, color: '#334155', marginBottom: 8 }, children: "No folders indexed yet." })) : (_jsx("div", { style: { marginBottom: 8 }, children: folders.map((f) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 10, color: '#94a3b8' }, children: [_jsx("span", { style: { color: '#6ee7b7', fontSize: 10 }, children: "\u2713" }), _jsx("span", { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 9 }, children: f.path })] }, f.id))) })), _jsx("button", { onClick: pick, disabled: picking, style: { padding: '5px 12px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: picking ? 'not-allowed' : 'pointer', border: '1px solid rgba(59,130,246,0.35)', background: 'rgba(59,130,246,0.08)', color: '#60a5fa', opacity: picking ? 0.6 : 1 }, children: picking ? 'Opening…' : '+ Add Folder' })] })] }));
}
// ─── 1D-FIX: Auto-install on quit toggle ─────────────────────────────────────
function AutoInstallToggle() {
    const [enabled, setEnabled] = React.useState(() => localStorage.getItem('mnemo_auto_install_on_quit') !== 'false');
    function toggle() {
        const next = !enabled;
        setEnabled(next);
        localStorage.setItem('mnemo_auto_install_on_quit', next ? 'true' : 'false');
        window.amplify?.setAutoInstallOnQuit?.(next);
    }
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(100,116,139,0.12)' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 10, fontWeight: 600, color: '#94a3b8' }, children: "Auto-install on quit" }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 2 }, children: "When a downloaded update is ready, install it automatically when the app closes. Turn off to control when updates apply." })] }), _jsx("button", { onClick: toggle, style: {
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: enabled ? '1px solid rgba(110,231,183,0.4)' : '1px solid rgba(100,116,139,0.3)',
                    background: enabled ? 'rgba(110,231,183,0.1)' : 'rgba(100,116,139,0.06)',
                    color: enabled ? '#6ee7b7' : '#64748b',
                    marginLeft: 12,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                }, children: enabled ? 'ON' : 'OFF' })] }));
}
// ─── M21: Update History Modal ────────────────────────────────────────────────
function UpdateHistoryModal({ onClose }) {
    const [entries, setEntries] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    React.useEffect(() => {
        window.amplify?.getUpdateHistory?.()
            .then((rows) => { setEntries(rows); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);
    const EVENT_COLORS = {
        check: '#60a5fa',
        download_started: '#fb923c',
        download_complete: '#4ade80',
        install_scheduled: '#a78bfa',
        check_error: '#f87171',
        download_error: '#f87171',
        install_error: '#f87171',
        'n/a': '#64748b',
    };
    return (_jsx("div", { style: {
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }, children: _jsxs("div", { style: {
                background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(100,116,139,0.25)',
                borderRadius: 10, padding: '16px 20px', width: 520, maxHeight: '70vh',
                display: 'flex', flexDirection: 'column', gap: 12,
            }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.04em' }, children: "UPDATE HISTORY" }), _jsx("button", { onClick: onClose, style: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }, children: "\u2715" })] }), loading ? (_jsx("div", { style: { fontSize: 10, color: '#64748b', fontStyle: 'italic' }, children: "Loading\u2026" })) : entries.length === 0 ? (_jsx("div", { style: { fontSize: 10, color: '#64748b' }, children: "No history yet \u2014 history is recorded once automatic updates are active." })) : (_jsx("div", { style: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }, children: [...entries].reverse().map((entry, i) => {
                        const event = String(entry.event ?? '');
                        const color = EVENT_COLORS[event] ?? '#94a3b8';
                        const ts = typeof entry.ts === 'string' ? new Date(entry.ts).toLocaleString() : '';
                        const extra = Object.entries(entry)
                            .filter(([k]) => k !== 'ts' && k !== 'event')
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(' · ');
                        return (_jsxs("div", { style: {
                                display: 'flex', gap: 10, padding: '5px 8px',
                                background: 'rgba(30,41,59,0.5)', borderRadius: 5,
                                borderLeft: `3px solid ${color}`,
                            }, children: [_jsx("div", { style: { fontSize: 9, color: '#64748b', whiteSpace: 'nowrap', minWidth: 120 }, children: ts }), _jsx("div", { style: { fontSize: 9, fontWeight: 700, color, whiteSpace: 'nowrap', minWidth: 110 }, children: event }), _jsx("div", { style: { fontSize: 9, color: '#94a3b8', wordBreak: 'break-all' }, children: extra })] }, i));
                    }) }))] }) }));
}
const DEFAULT_AU_CONFIG = {
    autoUpdates: false,
    installTiming: 'quit',
    scheduledTime: '03:00',
    majorVersionRequiresApproval: true,
};
function AutomaticUpdatesSection() {
    const [cfg, setCfg] = React.useState(DEFAULT_AU_CONFIG);
    const [loaded, setLoaded] = React.useState(false);
    const [showConsentModal, setShowConsentModal] = React.useState(false);
    const [showHistoryModal, setShowHistoryModal] = React.useState(false);
    const [pendingApproveVersion, setPendingApproveVersion] = React.useState(null);
    // Load config from main process on mount + migrate legacy key
    React.useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const remote = await window.amplify?.getAutoUpdateConfig?.();
                if (!mounted)
                    return;
                if (remote) {
                    // Block 6: migrate legacy 'mnemo_auto_install_on_quit' if new config is at default
                    const legacyOnQuit = localStorage.getItem('mnemo_auto_install_on_quit');
                    if (legacyOnQuit === 'true' && !remote.autoUpdates && remote.installTiming === 'quit') {
                        // Already correct default — no migration action needed
                    }
                    setCfg({ ...DEFAULT_AU_CONFIG, ...remote });
                }
            }
            catch { /* not available in web / dev */ }
            if (mounted)
                setLoaded(true);
        })();
        return () => { mounted = false; };
    }, []);
    // Subscribe to approve-required events from main
    React.useEffect(() => {
        const cleanup = window.amplify?.onAutoUpdateApproveRequired?.((data) => {
            setPendingApproveVersion(data);
        });
        return cleanup ?? undefined;
    }, []);
    async function persistCfg(updates) {
        const next = { ...cfg, ...updates };
        setCfg(next);
        try {
            await window.amplify?.setAutoUpdateConfig?.(updates);
        }
        catch { /* dev mode noop */ }
    }
    function handleToggle1Click() {
        if (cfg.autoUpdates) {
            // Turn OFF — no modal needed
            persistCfg({ autoUpdates: false });
        }
        else {
            // Turn ON — show consent modal first
            setShowConsentModal(true);
        }
    }
    async function handleEnableConfirm() {
        setShowConsentModal(false);
        // Block 6: read legacy toggle before enabling
        const legacyOnQuit = localStorage.getItem('mnemo_auto_install_on_quit');
        const timing = legacyOnQuit === 'false' ? cfg.installTiming : 'quit';
        await persistCfg({ autoUpdates: true, installTiming: timing });
    }
    function handleEnableCancel() {
        setShowConsentModal(false);
        // Toggle stays OFF — no state change
    }
    const s = styles;
    const timingOptions = [
        { value: 'launch', label: 'On next launch' },
        { value: 'quit', label: 'On quit (default)' },
        { value: 'scheduled', label: 'At a scheduled time' },
        { value: 'approve', label: 'Approve each update' },
    ];
    if (!loaded)
        return null;
    return (_jsxs(_Fragment, { children: [_jsxs("section", { style: s.section, id: "settings-section-automatic-updates", children: [_jsx("div", { style: s.sectionHeader, children: "Automatic Updates" }), _jsxs("div", { style: s.card, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#cbd5e1' }, children: "Automatic Updates" }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 2, lineHeight: 1.5 }, children: cfg.autoUpdates
                                                    ? 'MnemosyneC checks for new versions every 6 hours and downloads them in the background. All updates are signed by Liana Banyan Corporation.'
                                                    : 'Enable to let MnemosyneC check and download updates automatically. You control the install schedule.' })] }), _jsx("button", { onClick: handleToggle1Click, style: {
                                            padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                                            border: cfg.autoUpdates ? '1px solid rgba(110,231,183,0.4)' : '1px solid rgba(100,116,139,0.3)',
                                            background: cfg.autoUpdates ? 'rgba(110,231,183,0.1)' : 'rgba(100,116,139,0.06)',
                                            color: cfg.autoUpdates ? '#6ee7b7' : '#64748b',
                                        }, children: cfg.autoUpdates ? 'ON' : 'OFF' })] }), cfg.autoUpdates && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(100,116,139,0.12)' }, children: [_jsx("div", { style: { fontSize: 10, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }, children: "Install timing" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 5 }, children: timingOptions.map(({ value, label }) => (_jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }, children: [_jsx("input", { type: "radio", name: "install-timing", value: value, checked: cfg.installTiming === value, onChange: () => persistCfg({ installTiming: value }), style: { accentColor: '#6ee7b7' } }), _jsx("span", { style: { fontSize: 10, color: cfg.installTiming === value ? '#e2e8f0' : '#64748b', fontWeight: cfg.installTiming === value ? 600 : 400 }, children: label })] }, value))) }), cfg.installTiming === 'scheduled' && (_jsxs("div", { style: { marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("span", { style: { fontSize: 10, color: '#64748b' }, children: "Daily at" }), _jsx("input", { type: "time", value: cfg.scheduledTime, onChange: (e) => persistCfg({ scheduledTime: e.target.value }), style: {
                                                            background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(100,116,139,0.25)',
                                                            borderRadius: 4, color: '#e2e8f0', fontSize: 10, padding: '2px 6px',
                                                        } })] }))] }), _jsx("div", { style: { marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(100,116,139,0.12)' }, children: _jsxs("label", { style: { display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }, children: [_jsx("input", { type: "checkbox", checked: cfg.majorVersionRequiresApproval, onChange: (e) => persistCfg({ majorVersionRequiresApproval: e.target.checked }), style: { accentColor: '#6ee7b7', marginTop: 1 } }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 10, fontWeight: 600, color: '#cbd5e1' }, children: "Major version jumps (e.g. v0.5 \u2192 v1.0) always require approval" }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 2, lineHeight: 1.5 }, children: "When enabled, major version updates are announced but not downloaded automatically \u2014 you approve each one." })] })] }) }), cfg.installTiming === 'approve' && pendingApproveVersion && (_jsxs("div", { style: { marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }, children: [_jsxs("div", { style: { fontSize: 10, color: '#fbbf24', fontWeight: 600, marginBottom: 4 }, children: ["Update v", pendingApproveVersion.version, " ready to install"] }), _jsx("button", { onClick: () => {
                                                    window.amplify?.approveAutoUpdateInstall?.(pendingApproveVersion.readyPath);
                                                    setPendingApproveVersion(null);
                                                }, style: { ...s.btn, background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)', color: '#fbbf24', fontWeight: 700 }, children: "Install Now" })] })), _jsx("div", { style: { marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(100,116,139,0.12)' }, children: _jsx("button", { onClick: () => setShowHistoryModal(true), style: { ...s.btn }, children: "View Update History" }) })] }))] })] }), showConsentModal && (_jsx("div", { style: {
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }, children: _jsxs("div", { style: {
                        background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(100,116,139,0.25)',
                        borderRadius: 10, padding: '20px 24px', width: 420, display: 'flex', flexDirection: 'column', gap: 14,
                    }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: '#e2e8f0' }, children: "Enable Automatic Updates?" }), _jsx("p", { style: { fontSize: 10, color: '#94a3b8', lineHeight: 1.65, margin: 0 }, children: "MnemosyneC will check for new versions every 6 hours and download them in the background. Updates will install on your chosen schedule. All updates are cryptographically signed by Liana Banyan Corporation \u2014 no third party can push updates to your machine. You can disable this at any time." }), _jsxs("div", { style: { display: 'flex', gap: 10, justifyContent: 'flex-end' }, children: [_jsx("button", { onClick: handleEnableCancel, style: { ...s.btn, color: '#64748b' }, children: "Cancel" }), _jsx("button", { onClick: handleEnableConfirm, style: { ...s.btn, background: 'rgba(110,231,183,0.12)', borderColor: 'rgba(110,231,183,0.4)', color: '#6ee7b7', fontWeight: 700 }, children: "Enable" })] })] }) })), showHistoryModal && _jsx(UpdateHistoryModal, { onClose: () => setShowHistoryModal(false) })] }));
}
const styles = {
    container: {
        padding: '12px 16px',
        overflowY: 'auto',
        height: '100%',
        boxSizing: 'border-box',
    },
    section: {
        marginBottom: 16,
    },
    sectionHeader: {
        fontSize: 11,
        fontWeight: 700,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 6,
    },
    card: {
        background: 'rgba(15,23,42,0.6)',
        border: '1px solid rgba(100,116,139,0.15)',
        borderRadius: 8,
        padding: '10px 12px',
    },
    label: {
        fontSize: 10,
        color: '#64748b',
        marginBottom: 4,
    },
    value: {
        fontSize: 12,
        fontWeight: 600,
        color: '#e2e8f0',
    },
    toggleRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
    },
    chip: {
        background: 'rgba(100,116,139,0.08)',
        border: '1px solid rgba(100,116,139,0.2)',
        borderRadius: 6,
        color: '#64748b',
        fontSize: 10,
        fontWeight: 500,
        padding: '4px 10px',
        cursor: 'pointer',
        transition: 'all 0.15s',
    },
    chipActive: {
        background: 'rgba(110,231,183,0.1)',
        borderColor: 'rgba(110,231,183,0.35)',
        color: '#6ee7b7',
        fontWeight: 700,
    },
    btn: {
        background: 'rgba(100,116,139,0.1)',
        border: '1px solid rgba(100,116,139,0.25)',
        borderRadius: 6,
        color: '#94a3b8',
        fontSize: 10,
        fontWeight: 600,
        padding: '5px 12px',
        cursor: 'pointer',
    },
    note: {
        fontSize: 10,
        color: '#6ee7b7',
        background: 'rgba(110,231,183,0.06)',
        border: '1px solid rgba(110,231,183,0.15)',
        borderRadius: 6,
        padding: '5px 10px',
        marginBottom: 6,
    },
    successMsg: {
        fontSize: 10,
        color: '#22c55e',
        marginTop: 6,
        fontWeight: 600,
    },
};
// ─── SEG-Q-4 BP078: Auto-Prepare FULL Upgrade Panel ──────────────────────────
function AutoPreparePullPanel() {
    const [enabled, setEnabled] = React.useState(false);
    const [modelReady, setModelReady] = React.useState(false);
    const [pulling, setPulling] = React.useState(false);
    React.useEffect(() => {
        (async () => {
            try {
                const s = await window.amplify?.getAutoPrepare?.();
                if (s) {
                    setEnabled(s.enabled);
                    setModelReady(s.modelReady);
                    setPulling(s.pulling);
                }
            }
            catch { /* not available */ }
        })();
        const unsub = window.amplify?.onAutoPrepareReady?.(() => {
            setModelReady(true);
            setPulling(false);
        });
        return () => unsub?.();
    }, []);
    function toggle() {
        const next = !enabled;
        setEnabled(next);
        window.amplify?.setAutoPrepare?.(next);
        if (next && !modelReady)
            setPulling(true);
    }
    return (_jsxs("section", { style: styles.section, id: "settings-section-auto-prepare", children: [_jsx("div", { style: styles.sectionHeader, children: "Auto-Prepare FULL Upgrade" }), _jsxs("div", { style: styles.card, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: styles.label, children: ["Download Google's Gemma 4 12B in background", modelReady && _jsx("span", { style: { marginLeft: 8, color: '#4ade80', fontWeight: 700, fontSize: 10 }, children: "READY" }), pulling && !modelReady && _jsx("span", { style: { marginLeft: 8, color: '#fbbf24', fontWeight: 700, fontSize: 10 }, children: "Pulling..." })] }), _jsx("div", { style: { fontSize: 9, color: '#475569', marginTop: 2, lineHeight: 1.5 }, children: "When ON, MnemosyneC silently pulls the Google's Gemma 4 12B model on launch and every 30 min while idle. When the download completes, you will receive a notification asking to activate. You must click Activate to switch to FULL tier. Nothing activates automatically." })] }), _jsx("button", { onClick: toggle, style: {
                                    ...styles.chip,
                                    flexShrink: 0,
                                    ...(enabled ? { ...styles.chipActive, color: '#4ade80', borderColor: 'rgba(74,222,128,0.4)' } : {}),
                                }, children: enabled ? 'ON' : 'OFF' })] }), modelReady && (_jsx("div", { style: { marginTop: 8, fontSize: 10, color: '#4ade80', fontWeight: 600 }, children: "Google's Gemma 4 12B is ready on this machine. Open AI Tier above to activate it." }))] })] }));
}
function McpSubstrateBridgePanel() {
    const [status, setStatus] = React.useState(null);
    const [tokenPreview, setTokenPreview] = React.useState(null);
    const [copied, setCopied] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    React.useEffect(() => {
        let mounted = true;
        async function fetchStatus() {
            try {
                const s = await window.amplify?.mcpGetStatus?.();
                if (mounted && s)
                    setStatus(s);
            }
            catch { /* not available */ }
            if (mounted)
                setLoading(false);
        }
        async function fetchToken() {
            try {
                const t = await window.amplify?.mcpGetAuthToken?.();
                if (mounted && typeof t === 'string' && t.length > 0) {
                    setTokenPreview(t.slice(0, 8) + '...');
                }
            }
            catch { /* not available */ }
        }
        fetchStatus();
        fetchToken();
        const interval = setInterval(fetchStatus, 5000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);
    function handleCopyToken() {
        (async () => {
            try {
                const t = await window.amplify?.mcpGetAuthToken?.();
                if (typeof t === 'string') {
                    await navigator.clipboard.writeText(t);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                }
            }
            catch { /* noop */ }
        })();
    }
    const dotStyle = {
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        marginRight: 6,
        background: status?.running ? '#4ade80' : '#ef4444',
        boxShadow: status?.running ? '0 0 6px #4ade80' : 'none',
        verticalAlign: 'middle',
    };
    return (_jsxs("section", { style: styles.section, id: "settings-section-mcp-bridge", children: [_jsx("div", { style: styles.sectionHeader, children: "MCP Substrate Bridge" }), _jsx("div", { style: styles.card, children: loading ? (_jsx("div", { style: { fontSize: 10, color: '#64748b' }, children: "Loading MCP status..." })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 16 }, children: [_jsxs("div", { style: { fontSize: 11, color: '#cbd5e1', display: 'flex', alignItems: 'center' }, children: [_jsx("span", { style: dotStyle }), _jsx("span", { style: { fontWeight: 600, marginRight: 4 }, children: status?.running ? 'Running' : 'Offline' })] }), status?.running && (_jsxs("div", { style: { fontSize: 10, color: '#64748b' }, children: ["Port: ", _jsx("span", { style: { color: '#93c5fd', fontFamily: 'monospace' }, children: status.port ?? 11456 })] })), _jsxs("div", { style: { fontSize: 10, color: '#64748b' }, children: ["Clients: ", _jsx("span", { style: { color: '#93c5fd' }, children: status?.connectedClients ?? 0 })] })] }), _jsx("div", { style: { fontSize: 9, color: '#475569', fontStyle: 'italic' }, children: "5 tools registered" })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }, children: [_jsxs("div", { style: { fontSize: 10, color: '#94a3b8', flex: 1 }, children: ["Bearer token:", ' ', _jsx("span", { style: { fontFamily: 'monospace', color: '#e2e8f0', letterSpacing: 1 }, children: tokenPreview ?? '—' })] }), _jsx("button", { onClick: handleCopyToken, style: {
                                        fontSize: 9,
                                        padding: '3px 10px',
                                        borderRadius: 4,
                                        border: '1px solid rgba(148,163,184,0.3)',
                                        background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(51,65,85,0.6)',
                                        color: copied ? '#4ade80' : '#94a3b8',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        fontWeight: copied ? 700 : 400,
                                        minWidth: 54,
                                        textAlign: 'center',
                                    }, children: copied ? 'Copied!' : 'Copy' })] }), _jsx("div", { style: { fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }, children: "Recent Calls" }), !status?.recentCalls?.length ? (_jsxs("div", { style: { fontSize: 10, color: '#475569', fontStyle: 'italic' }, children: ["No calls yet \u2014 connect a client to /mcp on port ", status?.port ?? 11456] })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 3 }, children: status.recentCalls.map((call, i) => (_jsxs("div", { style: {
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: 9,
                                    padding: '3px 6px',
                                    borderRadius: 4,
                                    background: 'rgba(30,41,59,0.6)',
                                    border: '1px solid rgba(51,65,85,0.4)',
                                }, children: [_jsx("span", { style: { fontFamily: 'monospace', color: '#93c5fd' }, children: call.tool }), _jsx("span", { style: { color: '#475569' }, children: new Date(call.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })] }, i))) })), _jsxs("div", { style: {
                                marginTop: 10,
                                fontSize: 9,
                                color: '#334155',
                                padding: '5px 8px',
                                borderRadius: 4,
                                background: 'rgba(15,23,42,0.4)',
                                fontFamily: 'monospace',
                                letterSpacing: 0.3,
                            }, children: ["http://127.0.0.1:", status?.port ?? 11456, "/mcp \u2014 add to Claude Desktop or Cursor MCP config"] })] })) })] }));
}
function SubstrateCounterPanel() {
    const [stats, setStats] = React.useState(null);
    const [verifiedCount, setVerifiedCount] = React.useState(0);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    React.useEffect(() => {
        let mounted = true;
        async function fetchStats() {
            try {
                const result = await window.amplify?.ipcInvoke?.('ai-dispatch:eblet-index-stats');
                if (!mounted)
                    return;
                if (result?.ok && result.stats) {
                    setStats(result.stats);
                    setVerifiedCount(result.verifiedCount ?? 0);
                    setError(null);
                }
                else if (result?.error) {
                    setError(result.error);
                }
            }
            catch (e) {
                if (mounted)
                    setError(String(e));
            }
            finally {
                if (mounted)
                    setLoading(false);
            }
        }
        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);
    const lastRefresh = stats?.lastRefreshTimestamp
        ? new Date(stats.lastRefreshTimestamp).toLocaleString()
        : 'not yet indexed';
    const canonCount = stats?.byCategory?.['canon'] ?? 0;
    const activeCount = stats?.byCategory?.['active'] ?? 0;
    const pixieCount = stats?.byCategory?.['pixie-dust'] ?? 0;
    const snapshotCount = stats?.byCategory?.['snapshot-canon'] ?? 0;
    const totalCanon = canonCount + snapshotCount;
    return (_jsxs("section", { style: { marginBottom: 16 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }, children: "Substrate Index" }), _jsx("div", { style: {
                    background: 'rgba(15,23,42,0.7)',
                    border: '1px solid rgba(51,65,85,0.5)',
                    borderRadius: 8,
                    padding: '12px 14px',
                }, children: loading ? (_jsx("div", { style: { fontSize: 10, color: '#64748b', fontStyle: 'italic' }, children: "Loading index stats\u2026" })) : error ? (_jsxs("div", { style: { fontSize: 10, color: '#f87171' }, children: ["Index unavailable: ", error] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { fontSize: 12, color: '#e2e8f0', fontWeight: 600, marginBottom: 6 }, children: [totalCanon.toLocaleString(), " canon eblets", verifiedCount > 0 && (_jsxs("span", { style: { color: '#34d399', marginLeft: 6 }, children: ["+ ", verifiedCount.toLocaleString(), " verified-runtime eblets"] })), ' ', "indexed."] }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }, children: [
                                { label: 'canon', value: canonCount, color: '#818cf8' },
                                { label: 'active', value: activeCount, color: '#38bdf8' },
                                { label: 'snapshot', value: snapshotCount, color: '#a78bfa' },
                                { label: 'pixie-dust', value: pixieCount, color: '#fb923c' },
                                { label: 'verified', value: verifiedCount, color: '#34d399' },
                            ].filter((b) => b.value > 0).map((badge) => (_jsxs("span", { style: {
                                    fontSize: 9,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    background: 'rgba(30,41,59,0.8)',
                                    border: `1px solid ${badge.color}44`,
                                    color: badge.color,
                                    fontWeight: 600,
                                }, children: [badge.label, ": ", badge.value.toLocaleString()] }, badge.label))) }), _jsxs("div", { style: { fontSize: 9, color: '#475569' }, children: ["Last refresh: ", lastRefresh] }), _jsxs("div", { style: { fontSize: 9, color: '#334155', marginTop: 4 }, children: ["BM25 priority: verified \u203A canon \u203A active \u203A snapshot \u203A trail \u203A pixie-dust.", ' ', "Use ", _jsx("code", { style: { color: '#7dd3fc' }, children: "category:pixie-dust" }), " prefix to query historical-mine."] })] })) })] }));
}
