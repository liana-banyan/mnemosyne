// ScavengerHuntPanel.tsx -- D-BP223-BM0-X033-022 ("Haystack Needle" test #2, inside Prove It Works)
//
// A member types a well-known phrase; the LOCAL substrate is searched for similar stored
// questions (zero model calls -- see src/main/scavenger_hunt.ts's header); the panel asks "Did
// you mean one of these?"; the member picks one; the stored answer is shown WITH its sources,
// plus a stats line (tokens used, milliseconds, model calls, sources: N). Mounted inside
// ProveItWorksTab.tsx, below "My Savings Receipt".

import React, { useCallback, useState } from 'react';

interface Candidate {
  index: number;
  question: string;
  similarity: number;
  wouldAutoServe: boolean;
}

interface AnswerState {
  question: string;
  answer: string;
  sources: string[];
  tokens_used: number;
  latency_ms: number;
  model_calls: 0;
}

type Phase = 'idle' | 'searching' | 'candidates' | 'no_match' | 'empty_substrate' | 'answer' | 'error';

function panelStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.06)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: 6,
  };
}

export function ScavengerHuntPanel() {
  const [phrase, setPhrase] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [normalized, setNormalized] = useState<string>('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchStats, setSearchStats] = useState<{ tokens_used: number; latency_ms: number } | null>(null);
  const [answer, setAnswer] = useState<AnswerState | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [rawPhraseForSelect, setRawPhraseForSelect] = useState('');
  const [aliasesFired, setAliasesFired] = useState<string[]>([]);

  const runSearch = useCallback(async () => {
    const q = phrase.trim();
    if (!q) return;
    setPhase('searching');
    setAnswer(null);
    setErrorText(null);
    try {
      const res = await window.amplify?.scavengerHunt?.search?.({ phrase: q });
      if (!res || !res.ok) {
        setErrorText(res?.error ?? 'No response from scavenger-hunt search');
        setPhase('error');
        return;
      }
      setNormalized(res.normalized_phrase ?? '');
      setRawPhraseForSelect(res.raw_phrase ?? q);
      setAliasesFired(res.aliases_fired ?? []);
      setSearchStats({ tokens_used: res.tokens_used ?? 0, latency_ms: res.latency_ms ?? 0 });
      if (res.substrate_empty) {
        setPhase('empty_substrate');
      } else if (!res.candidates || res.candidates.length === 0) {
        setCandidates([]);
        setPhase('no_match');
      } else {
        setCandidates(res.candidates);
        setPhase('candidates');
      }
    } catch (e) {
      setErrorText(String(e));
      setPhase('error');
    }
  }, [phrase]);

  const pickCandidate = useCallback(async (c: Candidate) => {
    setPhase('searching');
    setErrorText(null);
    try {
      const res = await window.amplify?.scavengerHunt?.select?.({
        question: c.question,
        raw_phrase: rawPhraseForSelect,
        normalized_phrase: normalized,
        candidates_shown: candidates.length,
        aliases_fired: aliasesFired,
      });
      if (!res || !res.ok) {
        setErrorText(res?.error ?? 'No response from scavenger-hunt select');
        setPhase('error');
        return;
      }
      setAnswer({
        question: res.question ?? c.question,
        answer: res.answer ?? '',
        sources: res.sources ?? [],
        tokens_used: res.tokens_used ?? 0,
        latency_ms: res.latency_ms ?? 0,
        model_calls: 0,
      });
      setPhase('answer');
    } catch (e) {
      setErrorText(String(e));
      setPhase('error');
    }
  }, [rawPhraseForSelect, normalized, candidates.length]);

  const reset = useCallback(() => {
    setPhase('idle');
    setCandidates([]);
    setAnswer(null);
    setErrorText(null);
  }, []);

  return (
    <div style={{ ...panelStyle(), marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
        Scavenger Hunt
      </div>
      <div style={{ fontSize: 11, color: '#707070', marginBottom: 10, lineHeight: 1.5 }}>
        Type a well-known phrase or question. MnemosyneC searches what is already stored locally
        for something similar and asks you to confirm -- the answer it shows always comes from a
        stored record, with its sources, and never from a model call.
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
          disabled={phase === 'searching'}
          placeholder="e.g. Ben Franklin's birthday"
          style={{
            flex: 1, boxSizing: 'border-box',
            padding: '6px 10px', borderRadius: 4,
            background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(148,163,184,0.3)',
            color: '#e2e8f0', fontSize: 12, fontFamily: 'system-ui, sans-serif',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={phase === 'searching' || !phrase.trim()}
          style={{
            padding: '6px 16px', borderRadius: 4,
            backgroundColor: 'rgba(100, 200, 150, 0.15)',
            border: '1px solid rgba(100, 200, 150, 0.5)',
            color: '#8bc8a0', fontSize: 12, fontWeight: 600,
            cursor: phase === 'searching' ? 'wait' : 'pointer',
            opacity: !phrase.trim() ? 0.6 : 1,
          }}
        >
          {phase === 'searching' ? 'Searching...' : 'Search'}
        </button>
      </div>

      {phase === 'empty_substrate' && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
          Nothing stored yet. Ask a question first.
        </div>
      )}

      {phase === 'no_match' && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
          Normalized to &quot;{normalized}&quot; -- no similar phrase found in what is stored locally yet.
          {aliasesFired.length > 0 && (
            <span> (matched via: {aliasesFired.join(', ')})</span>
          )}
        </div>
      )}

      {phase === 'error' && errorText && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#f87171' }}>Error: {errorText}</div>
      )}

      {phase === 'candidates' && candidates.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
            Normalized to &quot;{normalized}&quot;. Did you mean one of these?
            {aliasesFired.length > 0 && (
              <span> (matched via: {aliasesFired.join(', ')})</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {candidates.map((c) => (
              <button
                key={c.index}
                type="button"
                onClick={() => void pickCandidate(c)}
                style={{
                  textAlign: 'left', padding: '6px 10px', borderRadius: 4,
                  background: 'rgba(110,231,183,0.06)', border: '1px solid rgba(110,231,183,0.25)',
                  color: '#e2e8f0', fontSize: 12, cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', gap: 10,
                }}
              >
                <span>{c.question}</span>
                <span style={{ color: '#6ee7b7', fontSize: 10, flexShrink: 0 }}>
                  {Math.round(c.similarity * 100)}% match
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'answer' && answer && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{answer.question}</div>
          <div style={{
            padding: 10, borderRadius: 4, background: 'rgba(110,231,183,0.06)',
            border: '1px solid rgba(110,231,183,0.25)', fontSize: 13, color: '#f0fdf4',
            fontWeight: 600, lineHeight: 1.5,
          }}>
            {answer.answer}
          </div>

          {answer.sources.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: 2 }}>Sources:</div>
              {answer.sources.map((s, i) => (
                <div key={i} style={{ wordBreak: 'break-all' }}>
                  {/^https?:\/\//i.test(s) ? (
                    <span
                      role="link"
                      tabIndex={0}
                      onClick={() => window.amplify?.openExternal?.(s)}
                      onKeyDown={(e) => e.key === 'Enter' && window.amplify?.openExternal?.(s)}
                      style={{ color: '#6ee7b7', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      {s}
                    </span>
                  ) : (
                    <span>{s}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 8, fontSize: 10, color: '#64748b' }}>
            tokens used: <b>{answer.tokens_used}</b> · {answer.latency_ms}ms · model calls: <b>{answer.model_calls}</b> · sources: <b>{answer.sources.length}</b>
          </div>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 10, padding: '4px 10px', borderRadius: 4,
              background: 'none', border: '1px solid rgba(148,163,184,0.3)',
              color: '#94a3b8', fontSize: 11, cursor: 'pointer',
            }}
          >
            Search again
          </button>
        </div>
      )}

      {searchStats && (phase === 'candidates' || phase === 'no_match') && (
        <div style={{ marginTop: 8, fontSize: 10, color: '#64748b' }}>
          search: tokens used <b>{searchStats.tokens_used}</b> · {searchStats.latency_ms}ms · model calls: <b>0</b>
        </div>
      )}
    </div>
  );
}
