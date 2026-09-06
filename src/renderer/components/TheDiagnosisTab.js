import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// TheDiagnosisTab.tsx — The Diagnosis v0.4.1 BP083
// NYT-column model: broadcast unresolved questions to human Members.
// "🧂 Just Add Salt · Ask the Network" — Human Salt is the 3rd layer.
//
// REGULATORY HYGIENE (BP051 NON-NEGOTIABLE):
//   medical/legal/financial domains show informational-only disclaimer.
// SUBSTITUTION CANON: Marks bounties only in v0.4.0 (Fiat deferred to v0.4.1).
import { useState, useEffect, useCallback } from 'react';
import { SaltLevelSelector, SALT_LEVEL_CONFIGS } from './SaltLevelSelector';
import { getGlowTier, getGlowClass } from '../utils/glow_tier';
export const DOMAIN_DISCLAIMERS = {
    medical: '⚠️ INFORMATIONAL ONLY — not medical advice. Responses from peers are not from licensed medical professionals unless explicitly disclosed. Consult a licensed healthcare provider for all medical decisions. In an emergency, call 911.',
    legal: '⚠️ INFORMATIONAL ONLY — not legal advice. Responses are not from licensed attorneys unless explicitly disclosed. Consult a licensed attorney for all legal matters.',
    financial: '⚠️ INFORMATIONAL ONLY — not financial advice. Responses are not from licensed financial advisors unless explicitly disclosed. Consult a licensed financial professional for all financial decisions.',
    mechanical: 'ℹ️ Information shared by cooperative peers. Verify with a qualified mechanic or engineer before acting on any mechanical advice.',
    practical: '',
    scientific: '',
    historical: '',
    other: '',
};
export const DOMAIN_LABELS = {
    medical: '🏥 Medical',
    mechanical: '🔧 Mechanical',
    practical: '🛠️ Practical',
    legal: '⚖️ Legal',
    financial: '💰 Financial',
    scientific: '🔬 Scientific',
    historical: '📜 Historical',
    other: '💬 Other',
};
// ─── Styles ────────────────────────────────────────────────────────────────────
const S = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        padding: '20px 20px 32px',
        background: '#0a0f1a',
        color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        gap: 16,
    },
    header: { display: 'flex', flexDirection: 'column', gap: 4 },
    title: { fontSize: 18, fontWeight: 700, color: '#6ee7b7', margin: 0 },
    tagline: { fontSize: 12, color: '#64748b', margin: 0 },
    modeToggle: { display: 'flex', gap: 8 },
    modeBtn: (active) => ({
        padding: '7px 18px',
        background: active ? 'rgba(110,231,183,0.13)' : 'none',
        border: active ? '1px solid rgba(110,231,183,0.4)' : '1px solid rgba(100,116,139,0.3)',
        borderRadius: 8,
        color: active ? '#6ee7b7' : '#94a3b8',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        fontFamily: 'inherit',
    }),
    card: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(100,116,139,0.2)',
        borderRadius: 10,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    label: { fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' },
    input: {
        width: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(100,116,139,0.3)',
        borderRadius: 6,
        color: '#e2e8f0',
        fontSize: 13,
        padding: '9px 12px',
        fontFamily: 'inherit',
        resize: 'vertical',
        boxSizing: 'border-box',
    },
    select: {
        background: 'rgba(15,23,42,0.9)',
        border: '1px solid rgba(100,116,139,0.3)',
        borderRadius: 6,
        color: '#e2e8f0',
        fontSize: 13,
        padding: '9px 12px',
        fontFamily: 'inherit',
        width: '100%',
    },
    disclaimer: {
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 6,
        padding: '10px 14px',
        fontSize: 12,
        color: '#fca5a5',
        lineHeight: 1.6,
    },
    submitBtn: (disabled) => ({
        padding: '10px 22px',
        background: disabled ? 'rgba(110,231,183,0.04)' : 'rgba(110,231,183,0.13)',
        border: disabled ? '1px solid rgba(110,231,183,0.15)' : '1px solid rgba(110,231,183,0.4)',
        borderRadius: 8,
        color: disabled ? '#475569' : '#6ee7b7',
        fontSize: 14,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        alignSelf: 'flex-start',
    }),
    diagnosisItem: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(100,116,139,0.2)',
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: 'pointer',
    },
    tag: (color) => ({
        display: 'inline-block',
        background: `rgba(${color}, 0.1)`,
        border: `1px solid rgba(${color}, 0.3)`,
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 11,
        color: `rgb(${color})`,
        fontWeight: 600,
    }),
    answerCard: {
        background: 'rgba(110,231,183,0.04)',
        border: '1px solid rgba(110,231,183,0.15)',
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    emptyState: { color: '#475569', fontSize: 13, textAlign: 'center', padding: '32px 0' },
};
const DOMAIN_OPTIONS = [
    { value: 'medical', label: '🏥 Medical' },
    { value: 'mechanical', label: '🔧 Mechanical' },
    { value: 'practical', label: '🛠️ Practical' },
    { value: 'legal', label: '⚖️ Legal' },
    { value: 'financial', label: '💰 Financial' },
    { value: 'scientific', label: '🔬 Scientific' },
    { value: 'historical', label: '📜 Historical' },
    { value: 'other', label: '💬 Other' },
];
// ─── PostDiagnosisForm ────────────────────────────────────────────────────────
function PostDiagnosisForm() {
    const [question, setQuestion] = useState('');
    const [domain, setDomain] = useState('other');
    const [context, setContext] = useState('');
    const [priorAttempts, setPriorAttempts] = useState('');
    const [bountyAmount, setBountyAmount] = useState(5);
    const [bountyRail, setBountyRail] = useState('marks');
    const [barterDesc, setBarterDesc] = useState('');
    const [visibility, setVisibility] = useState('constellation');
    // v0.4.1: Salt Level — default preserved_open for Diagnosis form
    const [saltLevel, setSaltLevel] = useState('preserved_open');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);
    const disclaimer = DOMAIN_DISCLAIMERS[domain];
    const canSubmit = question.trim().length >= 10 && !submitting;
    const handleSubmit = useCallback(async () => {
        if (!canSubmit)
            return;
        setSubmitting(true);
        setError(null);
        try {
            const result = await window.amplify?.diagnosisPost?.({
                question: question.trim(),
                domain,
                context: context.trim(),
                priorAttempts: priorAttempts.trim(),
                bounty: {
                    rail: bountyRail,
                    amount: bountyAmount,
                    barterDescription: bountyRail === 'barter' ? barterDesc : undefined,
                },
                visibility,
                saltLevel,
                source: 'manual',
            });
            if (result?.ok) {
                setSubmitted(true);
            }
            else {
                setError(result?.error ?? 'Unknown error');
            }
        }
        catch (err) {
            setError(String(err));
        }
        finally {
            setSubmitting(false);
        }
    }, [question, domain, context, priorAttempts, bountyRail, bountyAmount, barterDesc, visibility, canSubmit]);
    if (submitted) {
        return (_jsxs("div", { style: S.card, children: [_jsx("p", { style: { color: '#6ee7b7', fontSize: 14, margin: 0 }, children: "\u2705 Your Diagnosis has been posted to the Constellation." }), _jsx("p", { style: { color: '#94a3b8', fontSize: 12, margin: 0 }, children: "\uD83E\uDDC2 Just Add Salt \u2014 your question is now circulating to peers who may have the answer. You'll be notified when someone responds." }), _jsx("button", { style: S.submitBtn(false), onClick: () => { setSubmitted(false); setQuestion(''); setContext(''); setPriorAttempts(''); }, children: "Post another" })] }));
    }
    return (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 14 }, children: _jsxs("div", { style: S.card, children: [_jsxs("div", { children: [_jsxs("div", { style: S.label, children: ["Question ", _jsx("span", { style: { color: '#ef4444' }, children: "*" })] }), _jsx("textarea", { style: { ...S.input, minHeight: 80 }, placeholder: "What question do you need the network's help answering?", value: question, onChange: (e) => setQuestion(e.target.value), maxLength: 2000 }), _jsxs("div", { style: { fontSize: 11, color: '#475569', textAlign: 'right' }, children: [question.length, "/2000"] })] }), _jsxs("div", { children: [_jsx("div", { style: S.label, children: "Domain" }), _jsx("select", { style: S.select, value: domain, onChange: (e) => setDomain(e.target.value), children: DOMAIN_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) })] }), disclaimer && (_jsx("div", { style: S.disclaimer, children: disclaimer })), _jsxs("div", { children: [_jsxs("div", { style: S.label, children: ["Context ", _jsx("span", { style: { color: '#64748b' }, children: "(optional)" })] }), _jsx("textarea", { style: { ...S.input, minHeight: 60 }, placeholder: "What's the situation? Any relevant background?", value: context, onChange: (e) => setContext(e.target.value), maxLength: 1000 })] }), _jsxs("div", { children: [_jsxs("div", { style: S.label, children: ["What have you tried? ", _jsx("span", { style: { color: '#64748b' }, children: "(optional)" })] }), _jsx("textarea", { style: { ...S.input, minHeight: 60 }, placeholder: "What sources or approaches have you already tried?", value: priorAttempts, onChange: (e) => setPriorAttempts(e.target.value), maxLength: 500 })] }), _jsxs("div", { children: [_jsx("div", { style: S.label, children: "Bounty" }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsxs("select", { style: { ...S.select, width: 120 }, value: bountyRail, onChange: (e) => setBountyRail(e.target.value), children: [_jsx("option", { value: "marks", children: "Marks" }), _jsx("option", { value: "fiat", children: "Fiat (v0.4.1)" }), _jsx("option", { value: "barter", children: "Barter" })] }), bountyRail !== 'barter' && (_jsx("input", { type: "number", style: { ...S.input, width: 80 }, min: 0, max: bountyRail === 'marks' ? 1000 : 500, value: bountyAmount, onChange: (e) => setBountyAmount(parseInt(e.target.value) || 0) }))] }), bountyRail === 'fiat' && (_jsx("div", { style: { fontSize: 11, color: '#f59e0b', marginTop: 4 }, children: "Fiat payouts coming in v0.4.1 \u2014 use Marks or Barter for now." })), bountyRail === 'barter' && (_jsx("input", { style: { ...S.input, marginTop: 6 }, placeholder: "Describe what you'll trade (e.g. 'I'll answer 3 of your questions')", value: barterDesc, onChange: (e) => setBarterDesc(e.target.value), maxLength: 200 }))] }), _jsxs("div", { children: [_jsx("div", { style: S.label, children: "Persistence" }), _jsx(SaltLevelSelector, { value: saltLevel, onChange: (lvl) => {
                                setSaltLevel(lvl);
                                // Auto-set visibility for preserved tiers
                                if (lvl === 'preserved_open' || lvl === 'preserved_forever') {
                                    setVisibility('cross-cathedral');
                                }
                                else if (lvl === 'seasoning') {
                                    setVisibility('constellation');
                                }
                            }, showPreservedSub: saltLevel === 'preserved_open' || saltLevel === 'preserved_forever' })] }), _jsxs("div", { children: [_jsx("div", { style: S.label, children: "Visibility" }), _jsxs("select", { style: S.select, value: visibility, onChange: (e) => setVisibility(e.target.value), children: [_jsx("option", { value: "lan", children: "\uD83C\uDFE0 LAN only (same network)" }), _jsx("option", { value: "constellation", children: "\uD83C\uDF0C Constellation (connected peers)" }), _jsx("option", { value: "cross-cathedral", children: "\uD83C\uDF10 Cross-Caithedral\u2122 (all Members)" })] })] }), error && (_jsxs("div", { style: { color: '#ef4444', fontSize: 12 }, children: ["Error: ", error] })), _jsx("button", { style: S.submitBtn(!canSubmit), onClick: handleSubmit, disabled: !canSubmit, children: submitting ? 'Posting…' : '📤 Post Diagnosis' })] }) }));
}
// ─── IncomingDiagnosisInbox ────────────────────────────────────────────────────
function IncomingDiagnosisInbox() {
    const [diagnoses, setDiagnoses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [answerText, setAnswerText] = useState('');
    const [sources, setSources] = useState('');
    const [credentials, setCredentials] = useState('');
    const [submittingAnswer, setSubmittingAnswer] = useState(false);
    const [answerResult, setAnswerResult] = useState(null);
    const loadDiagnoses = useCallback(async () => {
        setLoading(true);
        try {
            const result = await window.amplify?.diagnosisList?.({ status: 'open' });
            setDiagnoses(result?.posts ?? []);
        }
        catch {
            setDiagnoses([]);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { void loadDiagnoses(); }, [loadDiagnoses]);
    // Listen for incoming Diagnoses
    useEffect(() => {
        const unsub = window.amplify?.onDiagnosisIncoming?.((_data) => { void loadDiagnoses(); });
        return () => { unsub?.(); };
    }, [loadDiagnoses]);
    const handleSubmitAnswer = async () => {
        if (!selected || !answerText.trim())
            return;
        setSubmittingAnswer(true);
        setAnswerResult(null);
        try {
            const result = await window.amplify?.diagnosisAnswer?.({
                diagnosisId: selected.id,
                answerText: answerText.trim(),
                sources: sources.split('\n').map((s) => s.trim()).filter(Boolean),
                credentials: credentials.trim() || undefined,
            });
            setAnswerResult(result?.ok ? 'Answer submitted!' : (result?.error ?? 'Unknown error'));
            if (result?.ok) {
                setAnswerText('');
                setSources('');
                setCredentials('');
                void loadDiagnoses();
            }
        }
        catch (err) {
            setAnswerResult(String(err));
        }
        finally {
            setSubmittingAnswer(false);
        }
    };
    const handleUpvote = async (diagnosisId, answerId) => {
        await window.amplify?.diagnosisUpvote?.({ diagnosisId, answerId });
        void loadDiagnoses();
    };
    if (loading)
        return _jsx("div", { style: S.emptyState, children: "Loading Diagnoses\u2026" });
    if (selected) {
        const disclaimer = DOMAIN_DISCLAIMERS[selected.domain];
        return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 14 }, children: [_jsx("button", { style: S.submitBtn(false), onClick: () => { setSelected(null); setAnswerResult(null); }, children: "\u2190 Back to inbox" }), _jsxs("div", { style: S.card, children: [_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("span", { style: S.tag('110,231,183'), children: DOMAIN_LABELS[selected.domain] }), _jsx("span", { style: { fontSize: 11, color: '#64748b' }, children: new Date(selected.timestamp).toLocaleDateString() })] }), _jsx("p", { style: { margin: 0, fontSize: 14, color: '#f0fdf4', fontWeight: 600 }, children: selected.question }), selected.context && _jsxs("p", { style: { margin: 0, fontSize: 12, color: '#94a3b8' }, children: [_jsx("b", { children: "Context:" }), " ", selected.context] }), selected.priorAttempts && _jsxs("p", { style: { margin: 0, fontSize: 12, color: '#94a3b8' }, children: [_jsx("b", { children: "Tried:" }), " ", selected.priorAttempts] }), _jsxs("p", { style: { margin: 0, fontSize: 12, color: '#64748b' }, children: ["\uD83D\uDCB0 Bounty: ", selected.bounty.amount, " ", selected.bounty.rail] }), disclaimer && _jsx("div", { style: S.disclaimer, children: disclaimer })] }), selected.answers.length > 0 && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: [_jsxs("div", { style: S.label, children: ["Existing answers (", selected.answers.length, ")"] }), selected.answers.map((answer) => (_jsxs("div", { style: S.answerCard, children: [_jsx("p", { style: { margin: 0, fontSize: 13, color: '#e2e8f0' }, children: answer.answerText }), answer.sources.length > 0 && (_jsxs("p", { style: { margin: 0, fontSize: 11, color: '#64748b' }, children: ["Sources: ", answer.sources.join(', ')] })), answer.credentials && (_jsxs("p", { style: { margin: 0, fontSize: 11, color: '#6ee7b7' }, children: ["Credentials: ", answer.credentials] })), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsxs("button", { style: { ...S.submitBtn(false), padding: '4px 12px', fontSize: 12 }, onClick: () => handleUpvote(selected.id, answer.id), children: ["\uD83D\uDC4D ", answer.upvotes] }), _jsx("span", { style: { fontSize: 11, color: '#64748b' }, children: new Date(answer.timestamp).toLocaleDateString() })] })] }, answer.id)))] })), _jsxs("div", { style: S.card, children: [_jsx("div", { style: S.label, children: "Submit your answer" }), _jsx("textarea", { style: { ...S.input, minHeight: 80 }, placeholder: "Share what you know. Be specific and cite sources where possible.", value: answerText, onChange: (e) => setAnswerText(e.target.value) }), _jsx("textarea", { style: { ...S.input, minHeight: 40 }, placeholder: "Sources (one per line, optional)", value: sources, onChange: (e) => setSources(e.target.value) }), _jsx("input", { style: S.input, placeholder: "Your credentials or expertise (optional, but builds trust)", value: credentials, onChange: (e) => setCredentials(e.target.value) }), answerResult && (_jsx("div", { style: { fontSize: 12, color: answerResult.startsWith('Error') ? '#ef4444' : '#6ee7b7' }, children: answerResult })), _jsx("button", { style: S.submitBtn(!answerText.trim() || submittingAnswer), onClick: handleSubmitAnswer, disabled: !answerText.trim() || submittingAnswer, children: submittingAnswer ? 'Submitting…' : '📥 Submit Answer' })] })] }));
    }
    if (diagnoses.length === 0) {
        return (_jsxs("div", { style: S.emptyState, children: ["No open Diagnoses from your Constellation yet.", _jsx("br", {}), _jsx("span", { style: { fontSize: 12, color: '#334155' }, children: "Connect with peers to see their questions here." })] }));
    }
    // v0.4.1: sort by glow tier descending (golden → bright → visible → dim → none)
    const GLOW_TIER_ORDER_LOCAL = { golden: 5, bright: 4, visible: 3, dim: 2, none: 1 };
    const sortedDiagnoses = [...diagnoses].sort((a, b) => {
        const tierA = getGlowTier(a.bounty?.amount ?? 0);
        const tierB = getGlowTier(b.bounty?.amount ?? 0);
        return (GLOW_TIER_ORDER_LOCAL[tierB] ?? 1) - (GLOW_TIER_ORDER_LOCAL[tierA] ?? 1);
    });
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsxs("div", { style: S.label, children: ["Open Diagnoses (", diagnoses.length, ")"] }), _jsx("div", { style: { fontSize: 10, color: '#475569', fontStyle: 'italic' }, title: "All Diagnoses are visible regardless of glow. Glow surfaces attention, never restricts access.", children: "All visible \u00B7 glow = attention \u2726" })] }), sortedDiagnoses.map((d) => {
                const glowTier = getGlowTier(d.bounty?.amount ?? 0);
                const glowClass = getGlowClass(glowTier);
                return (_jsxs("div", { className: `diagnosis-card ${glowClass}`, style: S.diagnosisItem, onClick: () => setSelected(d), children: [_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx("span", { style: S.tag('110,231,183'), children: DOMAIN_LABELS[d.domain] }), _jsx("span", { style: { fontSize: 11, color: '#64748b' }, children: new Date(d.timestamp).toLocaleDateString() }), d.answers.length > 0 && (_jsxs("span", { style: S.tag('251,191,36'), children: ["\uD83D\uDCAC ", d.answers.length, " answer", d.answers.length !== 1 ? 's' : ''] })), glowTier === 'golden' && (_jsx("span", { style: { fontSize: 11, color: '#fbbf24', fontWeight: 700 }, children: "\uD83D\uDDDD\uFE0F Golden Key" })), d.saltLevel && d.saltLevel !== 'preserved_open' && (_jsxs("span", { style: { fontSize: 10, color: '#64748b' }, children: [SALT_LEVEL_CONFIGS[d.saltLevel]?.icon, " ", SALT_LEVEL_CONFIGS[d.saltLevel]?.label] }))] }), _jsxs("p", { style: { margin: 0, fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }, children: [d.question.slice(0, 120), d.question.length > 120 ? '…' : ''] }), _jsxs("p", { style: { margin: 0, fontSize: 11, color: '#475569' }, children: ["\uD83D\uDCB0 ", d.bounty.amount, " ", d.bounty.rail, " \u00B7 ", d.visibility] })] }, d.id));
            })] }));
}
// ─── TheDiagnosisTab ──────────────────────────────────────────────────────────
// SEG-4 tagline rotation — alternates between canonical phrases
const DIAGNOSIS_TAGLINES = [
    '🧂 The Secret of Mnem... is Salt',
    '🌐 Ask the Network · Human Salt is the 3rd layer',
];
export function TheDiagnosisTab() {
    const [mode, setMode] = useState('ask');
    const [taglineIdx, setTaglineIdx] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setTaglineIdx((i) => (i + 1) % DIAGNOSIS_TAGLINES.length), 6000);
        return () => clearInterval(t);
    }, []);
    return (_jsxs("div", { style: S.container, children: [_jsxs("div", { style: S.header, children: [_jsx("h2", { style: S.title, children: "\uD83E\uDE7A The Diagnosis" }), _jsx("p", { style: S.tagline, children: DIAGNOSIS_TAGLINES[taglineIdx] })] }), _jsxs("div", { style: S.modeToggle, children: [_jsx("button", { style: S.modeBtn(mode === 'ask'), onClick: () => setMode('ask'), children: "\uD83D\uDCE4 Ask" }), _jsx("button", { style: S.modeBtn(mode === 'answer'), onClick: () => setMode('answer'), children: "\uD83D\uDCE5 Answer" })] }), mode === 'ask' && _jsx(PostDiagnosisForm, {}), mode === 'answer' && _jsx(IncomingDiagnosisInbox, {})] }));
}
