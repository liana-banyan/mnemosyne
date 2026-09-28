// ShareCardsPanel.tsx -- D-BP223-X043-002-D (SEG X043-002-D, MnemosyneC 0.9.40)
//
// Founder ruling: "the two machines sharing a card" is one of the realest proofs. Before this file the
// share worked only through MCP (mnem_share_eblet_to_peer) or raw IPC. This is the button a normal
// person presses, mounted in Settings (SettingsTab.tsx) as one self-contained section, same mounting
// convention as QueryCaptureArchivePanel / NexusAuthoritySettings (own state, own IPC calls).
//
// Two halves:
//   1. "Share one of my cards": lists this computer's own cards that pass the same shareability check the
//      push runs (share:list-my-cards, read-only), a "Share with a peer" button per card opens a picker of
//      saved peers (mic:get-peers, the same list share:push-eblet resolves a peerId against), and the
//      sender-verified receipt comes back in plain words (landed / waiting in their inbox / refused).
//   2. "Cards offered to me": the held offers (share-inbox:list) with Accept and Refuse
//      (share-inbox:accept / share-inbox:reject), and the "accept offered cards from" choice
//      (share-receive:get-settings / share-receive:set-settings).
//
// UI ONLY. It calls the existing handlers and nothing else. It cannot widen consent: a stranger is
// refused in main no matter what this screen shows, and the setting offers only the two values main
// accepts. Every sentence a person reads comes from share_cards_ui_logic.ts (tested there).

import React, { useCallback, useEffect, useState } from 'react';
import {
  ACCEPT_FROM_CHOICES,
  STRANGERS_LINE,
  describeAcceptResult,
  describePushResult,
  describeRefuseResult,
  peerLabel,
  peerStatusWords,
  shortHash,
  sourceWords,
  toPeer,
  trustWords,
  type AcceptFrom,
  type HeldOfferLike,
  type PeerLike,
  type PlainResult,
} from './share_cards_ui_logic';

export interface MyCard {
  connector: string;
  file: string;
  title: string;
  sha256: string;
  qid: number | null;
  sourceStatus: string;
  sourceLabel: string | null;
}

export interface CardResult { peerName: string; plain: PlainResult; sha256: string | null; receiptPath: string | null }

// ─── Presentational pieces (exported so the tests can render them without IPC) ─────────────────

export function PushResultView({ result }: { result: CardResult }): React.ReactElement {
  const color = result.plain.tone === 'good' ? '#22c55e' : result.plain.tone === 'waiting' ? '#fbbf24' : '#f87171';
  return (
    <div data-testid="push-result" style={{ ...st.resultBox, borderColor: color }}>
      <div style={{ ...st.resultHead, color }}>{result.plain.headline}</div>
      <div style={st.small}>{result.plain.detail}</div>
      <div style={st.small}>{result.plain.receiptLine}</div>
      {result.sha256 && <div style={st.mono} title={result.sha256}>Card fingerprint sent: {result.sha256}</div>}
      {result.receiptPath && <div style={st.small}>Receipt saved on this computer: {result.receiptPath}</div>}
    </div>
  );
}

export function PeerPicker(props: { peers: PeerLike[]; busy: boolean; onPick(p: PeerLike): void; onCancel(): void; onRefresh?(): void }): React.ReactElement {
  const { peers, busy, onPick, onCancel, onRefresh } = props;
  return (
    <div data-testid="peer-picker" style={st.picker}>
      <div style={st.small}>Send this card to which machine?</div>
      {peers.length === 0 && (
        <div style={st.small}>No other machines have been found yet. Open MnemosyneC on your other machine, on the same network, then press Look again.</div>
      )}
      {peers.map((p) => (
        <button key={p.id} type="button" disabled={busy} style={st.peerBtn} onClick={() => onPick(p)}>
          <span style={{ fontWeight: 700 }}>{peerLabel(p)}</span>
          <span style={st.small}> {peerStatusWords(p)}</span>
        </button>
      ))}
      <div style={{ display: 'flex', gap: 6 }}>
        {onRefresh && <button type="button" style={st.btn} disabled={busy} onClick={onRefresh}>Look again</button>}
        <button type="button" style={st.btn} disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
      {busy && <div style={st.small}>Sending and waiting for their signed receipt...</div>}
    </div>
  );
}

export function MyCardRow(props: {
  card: MyCard; open: boolean; busy: boolean; peers: PeerLike[]; result: CardResult | null;
  onOpen(): void; onPick(p: PeerLike): void; onCancel(): void; onRefresh?(): void;
}): React.ReactElement {
  const { card, open, busy, peers, result } = props;
  return (
    <div data-testid="my-card" style={st.row}>
      <div style={st.rowTop}>
        <div style={{ minWidth: 0 }}>
          <div style={st.title}>{card.title}</div>
          <div style={st.small}>{sourceWords(card.sourceStatus)}{card.sourceStatus === 'source_pending' ? ' (only your own machines will take it)' : ''}</div>
          <div style={st.mono} title={card.sha256}>Fingerprint {shortHash(card.sha256)}</div>
        </div>
        <button type="button" style={st.primary} disabled={busy} onClick={props.onOpen}>Share with a peer</button>
      </div>
      {open && <PeerPicker peers={peers} busy={busy} onPick={props.onPick} onCancel={props.onCancel} onRefresh={props.onRefresh} />}
      {result && <PushResultView result={result} />}
    </div>
  );
}

export function OfferedCardRow(props: { offer: HeldOfferLike; busy: boolean; message: string | null; onAccept(): void; onRefuse(): void }): React.ReactElement {
  const { offer, busy, message } = props;
  return (
    <div data-testid="offered-card" style={st.row}>
      <div style={st.title}>{offer.title || offer.file}</div>
      <div style={st.small}>From: <strong>{offer.senderPeerId}</strong> ({trustWords(offer.trust)})</div>
      <div style={st.small}>Source: {sourceWords(offer.sourceStatus)}</div>
      <div style={st.mono} title={offer.sha256}>Fingerprint: {offer.sha256}</div>
      <div style={st.small}>Offered at {offer.receivedUtc} (UTC)</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button type="button" style={st.primary} disabled={busy} onClick={props.onAccept}>Accept</button>
        <button type="button" style={st.btn} disabled={busy} onClick={props.onRefuse}>Refuse</button>
      </div>
      {message && <div style={st.small}>{message}</div>}
    </div>
  );
}

export function AcceptFromChooser(props: { value: AcceptFrom; allowPeers: string[]; busy: boolean; onChange(v: AcceptFrom): void }): React.ReactElement {
  return (
    <div data-testid="accept-from" style={{ marginBottom: 8 }}>
      <div style={st.label}>Accept offered cards from</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {ACCEPT_FROM_CHOICES.map((c) => (
          <button
            key={c.value}
            type="button"
            disabled={props.busy}
            aria-pressed={props.value === c.value}
            style={props.value === c.value ? { ...st.chip, ...st.chipOn } : st.chip}
            onClick={() => props.onChange(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div style={st.small}>{ACCEPT_FROM_CHOICES.find((c) => c.value === props.value)?.help}</div>
      {props.allowPeers.length > 0 && <div style={st.small}>Also accepted without asking: {props.allowPeers.join(', ')}</div>}
      <div style={st.small}>{STRANGERS_LINE}</div>
    </div>
  );
}

const unavailable = (name: string): PlainResult =>
  describePushResult({ action: 'error', error: 'Sharing is not available in this version.', receiverPeerId: null, connector: null, file: null, sha256: null, receiptVerified: false, httpStatus: null }, name);

// ─── The section (stateful, calls the IPC) ──────────────────────────────────────────────────────

export function ShareCardsPanel(): React.ReactElement {
  const api = (window as unknown as { amplify?: Window['amplify'] }).amplify;
  const [cards, setCards] = useState<MyCard[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [peers, setPeers] = useState<PeerLike[]>([]);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [busyFor, setBusyFor] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, CardResult>>({});
  const [offers, setOffers] = useState<HeldOfferLike[]>([]);
  const [offerMsgs, setOfferMsgs] = useState<Record<string, string>>({});
  const [offerBusy, setOfferBusy] = useState<string | null>(null);
  const [acceptFrom, setAcceptFrom] = useState<AcceptFrom>('same_owner');
  const [allowPeers, setAllowPeers] = useState<string[]>([]);
  const [settingBusy, setSettingBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    try {
      const r = await api?.listMyShareableCards?.();
      setCards(r?.cards ?? []);
      setSkipped(r?.notShareableCount ?? 0);
    } catch (e) {
      setCards([]);
      setLoadError('Could not read your cards: ' + String((e as Error)?.message ?? e));
    }
  }, [api]);

  const loadOffers = useCallback(async () => {
    try { setOffers((await api?.listHeldShareOffers?.()) ?? []); } catch { setOffers([]); }
  }, [api]);

  const loadPeers = useCallback(async (lookFirst: boolean) => {
    // mic:discover-peers only refreshes who is online; the list shown is always the saved peers
    // (mic:get-peers), because share:push-eblet resolves a peerId against exactly that list.
    if (lookFirst) { try { await api?.micDiscoverPeers?.(); } catch { /* keep the saved list */ } }
    try {
      const raw = (await api?.micGetPeers?.()) ?? [];
      setPeers(raw.map(toPeer).filter((p): p is PeerLike => p !== null));
    } catch { setPeers([]); }
  }, [api]);

  useEffect(() => {
    void loadCards();
    void loadOffers();
    void loadPeers(false);
    (async () => {
      try {
        const s = await api?.getShareReceiveSettings?.();
        if (s) { setAcceptFrom(s.acceptFrom); setAllowPeers(s.allowPeers ?? []); }
      } catch { /* the closed default is already shown */ }
    })();
  }, [api, loadCards, loadOffers, loadPeers]);

  const share = async (card: MyCard, peer: PeerLike) => {
    const name = peerLabel(peer);
    setBusyFor(card.connector);
    try {
      const r = await api?.pushEbletToPeer?.({ peerId: peer.id, connector: card.connector });
      const plain = r ? describePushResult(r, name) : unavailable(name);
      setResults((m) => ({ ...m, [card.connector]: { peerName: name, plain, sha256: r?.sha256 ?? null, receiptPath: r?.receiptPath ?? null } }));
    } catch (e) {
      const plain = describePushResult({ action: 'error', error: String((e as Error)?.message ?? e), receiverPeerId: null, connector: null, file: null, sha256: null, receiptVerified: false, httpStatus: null }, name);
      setResults((m) => ({ ...m, [card.connector]: { peerName: name, plain, sha256: null, receiptPath: null } }));
    } finally {
      setBusyFor(null);
      setOpenFor(null);
    }
  };

  const decide = async (o: HeldOfferLike, accept: boolean) => {
    const key = o.senderPeerId + '/' + o.file;
    setOfferBusy(key);
    try {
      const msg = accept
        ? describeAcceptResult((await api?.acceptHeldShareOffer?.(o.senderPeerId, o.file)) ?? { ok: false, reason: 'not available in this version' })
        : describeRefuseResult((await api?.rejectHeldShareOffer?.(o.senderPeerId, o.file)) ?? { ok: false, reason: 'not available in this version' });
      setOfferMsgs((m) => ({ ...m, [key]: `${o.title || o.file}: ${msg}` }));
    } catch (e) {
      setOfferMsgs((m) => ({ ...m, [key]: `${o.title || o.file}: Something went wrong: ` + String((e as Error)?.message ?? e) }));
    } finally {
      setOfferBusy(null);
      await loadOffers();
      if (accept) await loadCards();
    }
  };

  const changeAcceptFrom = async (v: AcceptFrom) => {
    setSettingBusy(true);
    try {
      const s = await api?.setShareReceiveSettings?.({ acceptFrom: v, allowPeers });
      if (s) { setAcceptFrom(s.acceptFrom); setAllowPeers(s.allowPeers ?? []); }
    } catch { /* keep what main last said */ } finally { setSettingBusy(false); }
  };

  const stillHeld = (k: string) => offers.some((o) => o.senderPeerId + '/' + o.file === k);

  return (
    <section style={{ marginBottom: 16 }} id="settings-section-share-cards">
      <div style={st.sectionHeader}>Share cards with other machines</div>

      <div style={st.card}>
        <div style={st.subHead}>Share one of my cards</div>
        <div style={st.small}>
          Pick a card, then pick a machine. Your own machines take it right away. Anyone else gets it in their
          "Cards offered to me" list and decides. Either way their machine signs a receipt and this one checks it.
        </div>
        {loadError && <div style={st.small}>{loadError}</div>}
        {cards === null && <div style={st.small}>Reading your cards...</div>}
        {cards !== null && cards.length === 0 && (
          <div style={st.small}>You have no cards ready to share yet. A card needs a source (or a "source pending" mark) before it can be shared.</div>
        )}
        {skipped > 0 && <div style={st.small}>{skipped} other file{skipped === 1 ? '' : 's'} in your library cannot be shared yet (no source recorded).</div>}
        {(cards ?? []).map((c) => (
          <MyCardRow
            key={c.connector}
            card={c}
            open={openFor === c.connector}
            busy={busyFor === c.connector}
            peers={peers}
            result={results[c.connector] ?? null}
            onOpen={() => setOpenFor(openFor === c.connector ? null : c.connector)}
            onPick={(p) => void share(c, p)}
            onCancel={() => setOpenFor(null)}
            onRefresh={() => void loadPeers(true)}
          />
        ))}
      </div>

      <div style={{ ...st.card, marginTop: 10 }}>
        <div style={st.subHead}>Cards offered to me</div>
        <AcceptFromChooser value={acceptFrom} allowPeers={allowPeers} busy={settingBusy} onChange={(v) => void changeAcceptFrom(v)} />
        <button type="button" style={st.btn} onClick={() => void loadOffers()}>Check for new offers</button>
        {offers.length === 0 && <div style={st.small}>No cards are waiting for you.</div>}
        {offers.map((o) => {
          const key = o.senderPeerId + '/' + o.file;
          return (
            <OfferedCardRow
              key={key}
              offer={o}
              busy={offerBusy === key}
              message={offerMsgs[key] ?? null}
              onAccept={() => void decide(o, true)}
              onRefuse={() => void decide(o, false)}
            />
          );
        })}
        {Object.entries(offerMsgs).filter(([k]) => !stillHeld(k)).map(([k, m]) => (
          <div key={k} data-testid="offer-outcome" style={st.small}>{m}</div>
        ))}
      </div>
    </section>
  );
}

// ─── Styles (palette matches SettingsTab.tsx dark theme) ───────────────────────────────────────

const st: Record<string, React.CSSProperties> = {
  sectionHeader: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  card: { background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.15)', borderRadius: 8, padding: '10px 12px' },
  subHead: { fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 },
  label: { fontSize: 10, color: '#64748b', marginBottom: 4 },
  small: { fontSize: 10, color: '#94a3b8', marginTop: 3, lineHeight: 1.5 },
  mono: { fontSize: 10, color: '#94a3b8', fontFamily: 'Consolas, monospace', marginTop: 3, wordBreak: 'break-all' },
  title: { fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis' },
  row: { borderTop: '1px solid rgba(100,116,139,0.15)', paddingTop: 8, marginTop: 8 },
  rowTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  picker: { marginTop: 6, padding: 8, borderRadius: 6, background: 'rgba(30,41,59,0.6)', display: 'flex', flexDirection: 'column', gap: 4 },
  peerBtn: { textAlign: 'left', background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.25)', borderRadius: 6, color: '#e2e8f0', fontSize: 11, padding: '6px 10px', cursor: 'pointer' },
  btn: { background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.25)', borderRadius: 6, color: '#94a3b8', fontSize: 10, fontWeight: 600, padding: '5px 12px', cursor: 'pointer', marginTop: 4 },
  primary: { background: 'rgba(110,231,183,0.1)', border: '1px solid rgba(110,231,183,0.35)', borderRadius: 6, color: '#6ee7b7', fontSize: 10, fontWeight: 700, padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' },
  chip: { background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: 6, color: '#64748b', fontSize: 10, fontWeight: 500, padding: '4px 10px', cursor: 'pointer' },
  chipOn: { background: 'rgba(110,231,183,0.1)', borderColor: 'rgba(110,231,183,0.35)', color: '#6ee7b7', fontWeight: 700 },
  resultBox: { marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid', background: 'rgba(15,23,42,0.8)' },
  resultHead: { fontSize: 11, fontWeight: 700 },
};
