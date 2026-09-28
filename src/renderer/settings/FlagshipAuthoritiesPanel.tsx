// FlagshipAuthoritiesPanel.tsx -- D-BP223-BM0-X029-019-ASK-FLOW-TRANSMISSION (round 2)
//
// NEXUS AUTHORITIES: HOW EACH FLAGSHIP IS REACHED. Founder k/d74e863d: "Automatic can be set whenever you do the Nexus
// Authorities as well - for subscriptions and API ... So we make it SUPER EASY to use those as well." Founder k/fbce54d5:
// "we don't offer any API keys to ANY users. They use whatever they want to use" and every website "automatic, as well.
// so that each user picks."
//
// PRIOR WORK (build gate): NexusAuthoritySettings.tsx picks which authority answers each ARM, NexusAuthoritySignInPanel.tsx
// signs in to the browser authorities, and KN-BP144-3 unified the on/off authority toggles. None of them holds a per-
// flagship MANUAL / AUTOMATIC choice or the user's own API keys; this section sits beside them in Settings.
//
// One section, mouse only. Every provider starts MANUAL. Each row has one MANUAL / AUTOMATIC switch; a website row shows
// its one-line terms note when AUTOMATIC is chosen, and the user decides. API and aggregator rows take the user's OWN
// key ("Your key, your account, your bill."), saved by the main process (Windows DPAPI) and never shown again.
// The same choices and keys are used by the Conduit's Ask pane: one store, see
// src/main/flagship_authorities/flagship_authorities_store.ts.

import { useCallback, useEffect, useState } from 'react';
import type { FlagshipAuthorityRowView, FlagshipAuthorityResultView } from '../amplify.d';

const GROUPS: Array<[FlagshipAuthorityRowView['kind'], string]> = [
  ['subscription', 'Websites you are logged in to'],
  ['api', 'Your own API keys'],
  ['aggregator', 'Aggregators (one key, many models)'],
];

export function FlagshipAuthoritiesPanel() {
  const [rows, setRows] = useState<FlagshipAuthorityRowView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const api = window.amplify;
  const available = !!(api && api.flagshipAuthoritiesList);

  const load = useCallback(async () => {
    if (!api?.flagshipAuthoritiesList) return;
    try {
      const r = await api.flagshipAuthoritiesList();
      if (r && r.ok) { setRows(r.authorities); setError(null); } else setError('Could not read the flagship settings.');
    } catch (e) { setError('Could not read the flagship settings: ' + String(e)); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const apply = (id: string, res: FlagshipAuthorityResultView | undefined) => {
    if (!res) return;
    if (res.ok) {
      setRows((prev) => (prev ? prev.map((x) => (x.id === id ? res.authority : x)) : prev));
      setNotes((n) => ({ ...n, [id]: '' }));
    } else {
      setNotes((n) => ({ ...n, [id]: res.error }));
    }
  };

  const setMode = async (row: FlagshipAuthorityRowView, automatic: boolean) => {
    if (!api?.flagshipAuthoritiesSetAutomatic) return;
    apply(row.id, await api.flagshipAuthoritiesSetAutomatic(row.id, automatic));
  };

  const saveKey = async (row: FlagshipAuthorityRowView) => {
    const key = (drafts[row.id] || '').trim();
    setDrafts((d) => ({ ...d, [row.id]: '' }));
    if (!key) { setNotes((n) => ({ ...n, [row.id]: 'Paste your key into the box first.' })); return; }
    if (!api?.flagshipAuthoritiesSaveKey) return;
    setNotes((n) => ({ ...n, [row.id]: 'Saving...' }));
    apply(row.id, await api.flagshipAuthoritiesSaveKey(row.id, key));
  };

  const removeKey = async (row: FlagshipAuthorityRowView) => {
    if (!api?.flagshipAuthoritiesRemoveKey) return;
    apply(row.id, await api.flagshipAuthoritiesRemoveKey(row.id));
  };

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>Nexus Authorities: how each flagship is reached</div>
      <div style={styles.card}>
        <div style={styles.introText}>
          Pick how each flagship is reached. MANUAL: you copy the question, ask it yourself, and bring the answer back.
          AUTOMATIC: MnemosyneC carries it for you. Everything starts MANUAL and every choice is yours. We supply no API keys:
          any key here is your key, your account, your bill, and it is never shown again once saved.
        </div>
        {!available && <div style={styles.warn}>This build has no Nexus Authorities channel yet. Restart MnemosyneC after updating.</div>}
        {error && <div style={styles.warn}>{error}</div>}
        {rows && GROUPS.map(([kind, title]) => {
          const group = rows.filter((r) => r.kind === kind);
          if (!group.length) return null;
          return (
            <div key={kind} style={styles.group}>
              <div style={styles.groupTitle}>{title}</div>
              {group.map((row) => (
                <div key={row.id} style={styles.row}>
                  <div style={styles.rowHead}>
                    <span style={styles.rowLabel}>{row.label}</span>
                    <span style={styles.state}>
                      {row.automatic_ready ? 'AUTOMATIC ready' : row.automatic_on ? 'AUTOMATIC, needs your key' : 'MANUAL'}
                    </span>
                  </div>
                  <div style={styles.pillRow}>
                    <button type="button" style={pill(!row.automatic_on)} onClick={() => void setMode(row, false)}>MANUAL</button>
                    <button type="button" style={pill(row.automatic_on)} onClick={() => void setMode(row, true)}>AUTOMATIC</button>
                    {row.kind === 'subscription' && row.open_url && (
                      <a href={row.open_url} target="_blank" rel="noopener noreferrer" style={styles.link}>Open the site</a>
                    )}
                    {row.key_page && <a href={row.key_page} target="_blank" rel="noopener noreferrer" style={styles.link}>Get your key</a>}
                  </div>
                  {row.kind === 'subscription' && row.automatic_on && row.terms_note && (
                    <div style={styles.termsNote}>{row.terms_note}</div>
                  )}
                  {row.bring_your_own && <div style={styles.desc}>{row.bring_your_own}{row.price ? ' Price: ' + row.price : ''}</div>}
                  {row.needs_key && (
                    <div style={styles.pillRow}>
                      <input
                        type="password"
                        autoComplete="off"
                        aria-label={'Your ' + row.label + ' key'}
                        placeholder={row.has_key ? 'key saved (paste to replace)' : 'paste your key ' + (row.key_hint || '')}
                        value={drafts[row.id] || ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                        style={styles.input}
                      />
                      <button type="button" style={pill(false)} onClick={() => void saveKey(row)}>Save key</button>
                      {row.has_key && <button type="button" style={pill(false)} onClick={() => void removeKey(row)}>Remove key</button>}
                    </div>
                  )}
                  {notes[row.id] && <div style={styles.desc}>{notes[row.id]}</div>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function pill(active: boolean): React.CSSProperties {
  return {
    ...styles.pill,
    background: active ? 'rgba(59,130,246,0.25)' : 'transparent',
    borderColor: active ? 'rgba(96,165,250,0.8)' : 'rgba(100,116,139,0.4)',
    color: active ? '#e2e8f0' : '#94a3b8',
  };
}

const styles: Record<string, React.CSSProperties> = {
  section: { margin: '0 0 8px' },
  sectionHeader: { fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 },
  card: { background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 },
  introText: { fontSize: 10.5, color: '#94a3b8', lineHeight: 1.5 },
  warn: { fontSize: 10, color: '#fbbf24' },
  group: { display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(100,116,139,0.12)' },
  groupTitle: { fontSize: 11, fontWeight: 700, color: '#cbd5e1' },
  row: { display: 'flex', flexDirection: 'column', gap: 5, padding: '6px 0' },
  rowHead: { display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  rowLabel: { fontSize: 11, fontWeight: 600, color: '#cbd5e1' },
  state: { fontSize: 9.5, fontWeight: 700, color: '#94a3b8' },
  pillRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  pill: { padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, border: '1px solid' },
  termsNote: { fontSize: 9.5, color: '#fbbf24', lineHeight: 1.5 },
  desc: { fontSize: 9, color: '#64748b', lineHeight: 1.5 },
  link: { fontSize: 10, color: '#60a5fa' },
  input: { fontSize: 10, padding: '3px 6px', minWidth: 180, background: 'rgba(15,23,42,0.8)', color: '#e2e8f0', border: '1px solid rgba(100,116,139,0.4)', borderRadius: 6 },
};
