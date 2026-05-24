// BP037 — On-Deck Master-of-Ceremonies Panel (Phase 2)
// Read-only view of on_deck queue state from ~/.lb_substrate/on_deck/
//
// Three columns: Sequential | Anytime | Conditional
// Color-coded by target seat: Manager=green Knight=blue Pawn=amber Rook=violet
// Status badges: DRAFTING / READY / FIRED / RETURNED / COMPLETE / FAILED
// Side panel: details of selected item
// Fired archive: collapsible, default hidden

import { useState, useEffect, useCallback } from 'react';

// ─── Type mirrors (avoid importing from main process) ────────────────────────

type TargetSeat = 'manager' | 'knight' | 'pawn' | 'rook';
type Category = 'sequential' | 'anytime' | 'conditional';
type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
type OnDeckStatus = 'DRAFTING' | 'READY' | 'FIRED' | 'RETURNED' | 'COMPLETE' | 'FAILED';

interface OnDeckFrontmatter {
  on_deck_id: string;
  target_seat: TargetSeat;
  category: Category;
  priority: Priority;
  depends_on: string[];
  conditions: string[];
  estimated_cost?: number;
  estimated_time?: number;
  status: OnDeckStatus;
  title?: string;
  created_at?: string;
}

interface OnDeckItem {
  frontmatter: OnDeckFrontmatter;
  body: string;
  file_path: string;
}

interface OnDeckBridgePayload {
  sequential: OnDeckItem[];
  anytime: OnDeckItem[];
  conditional: OnDeckItem[];
  fired_recent: OnDeckItem[];
  base_dir: string;
  scanned_at: string;
}

// ─── Color tokens ─────────────────────────────────────────────────────────────

const SEAT_COLORS: Record<TargetSeat, string> = {
  manager: '#22c55e',
  knight:  '#3b82f6',
  pawn:    '#f59e0b',
  rook:    '#a855f7',
};

const STATUS_COLORS: Record<OnDeckStatus, string> = {
  DRAFTING:  '#718096',
  READY:     '#63b3ed',
  FIRED:     '#f6ad55',
  RETURNED:  '#fc8181',
  COMPLETE:  '#22c55e',
  FAILED:    '#ef4444',
};

const PRIORITY_COLORS: Record<Priority, string> = {
  HIGH:   '#ef4444',
  MEDIUM: '#f6ad55',
  LOW:    '#718096',
};

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  selected,
  onClick,
}: {
  item: OnDeckItem;
  selected: boolean;
  onClick: () => void;
}) {
  const fm = item.frontmatter;
  const seatColor = SEAT_COLORS[fm.target_seat];
  const statusColor = STATUS_COLORS[fm.status];

  return (
    <button
      style={{
        ...styles.card,
        borderLeft: `3px solid ${seatColor}`,
        background: selected ? '#1e2d4a' : '#0f0f1a',
        outline: selected ? `1px solid ${seatColor}` : 'none',
      }}
      onClick={onClick}
      title={fm.on_deck_id}
    >
      <div style={styles.cardTop}>
        <span style={{ ...styles.idBadge, color: seatColor }}>{fm.on_deck_id}</span>
        <span style={{ ...styles.statusBadge, background: statusColor + '22', color: statusColor, border: `1px solid ${statusColor}` }}>
          {fm.status}
        </span>
      </div>
      <div style={styles.cardTitle}>{fm.title ?? fm.on_deck_id}</div>
      <div style={styles.cardMeta}>
        <span style={{ color: seatColor, fontSize: '0.65rem', fontWeight: 600 }}>{fm.target_seat.toUpperCase()}</span>
        <span style={{ ...styles.priorityDot, color: PRIORITY_COLORS[fm.priority] }}>● {fm.priority}</span>
        {fm.estimated_time && <span style={styles.metaChip}>{fm.estimated_time}m</span>}
        {fm.estimated_cost && <span style={styles.metaChip}>${fm.estimated_cost.toFixed(2)}</span>}
      </div>
      {fm.depends_on.length > 0 && (
        <div style={styles.deps}>⛓ depends: {fm.depends_on.join(', ')}</div>
      )}
    </button>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function Column({
  title,
  icon,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  icon: string;
  items: OnDeckItem[];
  selectedId: string | null;
  onSelect: (item: OnDeckItem) => void;
}) {
  return (
    <div style={styles.col}>
      <div style={styles.colHeader}>
        <span>{icon}</span>
        <span style={styles.colTitle}>{title}</span>
        <span style={styles.colCount}>{items.length}</span>
      </div>
      <div style={styles.colBody}>
        {items.length === 0 ? (
          <div style={styles.emptyCol}>— empty —</div>
        ) : (
          items.map((item) => (
            <ItemCard
              key={item.frontmatter.on_deck_id}
              item={item}
              selected={selectedId === item.frontmatter.on_deck_id}
              onClick={() => onSelect(item)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  item,
  onClose,
}: {
  item: OnDeckItem;
  onClose: () => void;
}) {
  const fm = item.frontmatter;
  const seatColor = SEAT_COLORS[fm.target_seat];

  return (
    <div style={styles.detail}>
      <div style={{ ...styles.detailHeader, borderLeft: `3px solid ${seatColor}` }}>
        <span style={{ color: seatColor, fontWeight: 700 }}>{fm.on_deck_id}</span>
        <span style={{ flex: 1, marginLeft: '0.5rem', fontWeight: 600 }}>{fm.title ?? ''}</span>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div style={styles.detailMeta}>
        <MetaRow label="Target seat"  value={fm.target_seat} color={seatColor} />
        <MetaRow label="Category"     value={fm.category} />
        <MetaRow label="Priority"     value={fm.priority} color={PRIORITY_COLORS[fm.priority]} />
        <MetaRow label="Status"       value={fm.status}   color={STATUS_COLORS[fm.status]} />
        {fm.estimated_time && <MetaRow label="Est. time"  value={`${fm.estimated_time} min`} />}
        {fm.estimated_cost !== undefined && <MetaRow label="Est. cost"  value={`$${fm.estimated_cost.toFixed(2)}`} />}
        {fm.created_at && <MetaRow label="Created"      value={new Date(fm.created_at).toLocaleString()} />}
        {fm.depends_on.length > 0 && (
          <MetaRow label="Depends on" value={fm.depends_on.join(', ')} />
        )}
        {fm.conditions.length > 0 && (
          <MetaRow label="Conditions" value={fm.conditions.join('; ')} />
        )}
        <MetaRow label="File" value={item.file_path.split(/[\\/]/).slice(-2).join('/')} mono />
      </div>

      {item.body && (
        <div style={styles.detailBody}>
          <div style={styles.detailBodyLabel}>Body</div>
          <div style={styles.detailBodyText}>{item.body}</div>
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div style={styles.metaRow}>
      <span style={styles.metaLabel}>{label}</span>
      <span style={{ ...styles.metaValue, color: color ?? '#e2e8f0', fontFamily: mono ? 'monospace' : undefined }}>
        {value}
      </span>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function OnDeckPanel() {
  const [payload, setPayload] = useState<OnDeckBridgePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<OnDeckItem | null>(null);
  const [showFired, setShowFired] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await window.amplify.onDeckList?.();
      if (data) {
        setPayload(data);
        setLastScanned(data.scanned_at);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const handleSelect = useCallback((item: OnDeckItem) => {
    setSelectedItem((prev) =>
      prev?.frontmatter.on_deck_id === item.frontmatter.on_deck_id ? null : item,
    );
  }, []);

  const totalActive = (payload?.sequential.length ?? 0) +
    (payload?.anytime.length ?? 0) +
    (payload?.conditional.length ?? 0);

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerIcon}>📋</span>
        <span style={styles.headerTitle}>On Deck</span>
        {loading && <span style={styles.loadingChip}>scanning…</span>}
        <span style={styles.totalBadge}>{totalActive} active</span>
        <div style={{ flex: 1 }} />
        <button style={styles.refreshBtn} onClick={refresh} title="Refresh on-deck queue">
          ↺ Refresh
        </button>
      </div>

      {error && (
        <div style={styles.errorBanner}>⚠ {error}</div>
      )}

      {/* Three-column grid + optional detail side panel */}
      <div style={styles.body}>
        {/* Columns */}
        <div style={{ ...styles.colGrid, flex: selectedItem ? '0 0 55%' : '1 1 auto' }}>
          <Column
            title="Sequential"
            icon="⏩"
            items={payload?.sequential ?? []}
            selectedId={selectedItem?.frontmatter.on_deck_id ?? null}
            onSelect={handleSelect}
          />
          <Column
            title="Anytime"
            icon="🔄"
            items={payload?.anytime ?? []}
            selectedId={selectedItem?.frontmatter.on_deck_id ?? null}
            onSelect={handleSelect}
          />
          <Column
            title="Conditional"
            icon="🔀"
            items={payload?.conditional ?? []}
            selectedId={selectedItem?.frontmatter.on_deck_id ?? null}
            onSelect={handleSelect}
          />
        </div>

        {/* Side panel — shown when an item is selected */}
        {selectedItem && (
          <div style={styles.detailWrapper}>
            <DetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
          </div>
        )}
      </div>

      {/* Fired archive (collapsible) */}
      <div style={styles.firedSection}>
        <button
          style={styles.firedToggle}
          onClick={() => setShowFired((v) => !v)}
        >
          {showFired ? '▼' : '▶'} Fired archive ({payload?.fired_recent.length ?? 0} recent)
        </button>
        {showFired && (
          <div style={styles.firedGrid}>
            {payload?.fired_recent.length === 0 ? (
              <span style={{ color: '#718096', fontSize: '0.72rem' }}>No fired items yet.</span>
            ) : (
              payload?.fired_recent.map((item) => (
                <ItemCard
                  key={item.frontmatter.on_deck_id + item.file_path}
                  item={item}
                  selected={false}
                  onClick={() => handleSelect(item)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        BP037 On-Deck MoC · substrate: {payload?.base_dir ?? '—'}
        {lastScanned && ` · scanned ${new Date(lastScanned).toLocaleTimeString()}`}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a14',
    color: '#e2e8f0',
    height: '100%',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '0.78rem',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.4rem 0.75rem',
    background: '#1a1a2e',
    borderBottom: '1px solid #2d3748',
    flexShrink: 0,
  },
  headerIcon: { fontSize: '1rem' },
  headerTitle: { fontWeight: 700, fontSize: '0.9rem', color: '#63b3ed' },
  loadingChip: { fontSize: '0.65rem', color: '#718096', marginLeft: '0.25rem' },
  totalBadge: {
    fontSize: '0.65rem',
    background: '#2d3748',
    color: '#a0aec0',
    borderRadius: '4px',
    padding: '1px 6px',
  },
  refreshBtn: {
    background: '#2d3748',
    border: '1px solid #4a5568',
    borderRadius: '4px',
    color: '#e2e8f0',
    padding: '0.2rem 0.5rem',
    cursor: 'pointer',
    fontSize: '0.7rem',
  },
  errorBanner: {
    background: '#450a0a',
    color: '#fc8181',
    padding: '0.3rem 0.75rem',
    fontSize: '0.72rem',
    flexShrink: 0,
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    gap: '0.5rem',
    padding: '0.5rem',
    minHeight: 0,
  },
  colGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem',
    overflow: 'hidden',
    minWidth: 0,
  },
  col: {
    display: 'flex',
    flexDirection: 'column',
    background: '#0f0f1a',
    border: '1px solid #2d3748',
    borderRadius: '8px',
    overflow: 'hidden',
    minHeight: 0,
  },
  colHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.4rem 0.6rem',
    background: '#1a1a2e',
    borderBottom: '1px solid #2d3748',
    flexShrink: 0,
  },
  colTitle: { fontWeight: 700, fontSize: '0.75rem', color: '#a0aec0' },
  colCount: {
    marginLeft: 'auto',
    fontSize: '0.65rem',
    background: '#2d3748',
    color: '#718096',
    borderRadius: '10px',
    padding: '0 5px',
  },
  colBody: { flex: 1, overflow: 'auto', padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  emptyCol: { color: '#4a5568', fontSize: '0.7rem', textAlign: 'center', padding: '1rem 0' },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    padding: '0.4rem 0.5rem',
    border: '1px solid #2d3748',
    borderRadius: '5px',
    cursor: 'pointer',
    textAlign: 'left',
    color: '#e2e8f0',
    width: '100%',
    transition: 'background 0.1s',
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: '0.3rem' },
  idBadge: { fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700 },
  statusBadge: {
    marginLeft: 'auto',
    fontSize: '0.6rem',
    borderRadius: '3px',
    padding: '1px 5px',
    fontWeight: 600,
    letterSpacing: '0.04em',
  },
  cardTitle: { fontSize: '0.72rem', lineHeight: 1.3, color: '#cbd5e0' },
  cardMeta: { display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' },
  priorityDot: { fontSize: '0.62rem', fontWeight: 600 },
  metaChip: {
    fontSize: '0.6rem',
    background: '#2d3748',
    color: '#a0aec0',
    borderRadius: '3px',
    padding: '0 4px',
  },
  deps: { fontSize: '0.62rem', color: '#718096' },
  detailWrapper: { flex: '0 0 320px', overflow: 'hidden' },
  detail: {
    background: '#0f0f1a',
    border: '1px solid #2d3748',
    borderRadius: '8px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.5rem 0.75rem',
    background: '#1a1a2e',
    borderBottom: '1px solid #2d3748',
    paddingLeft: '0.75rem',
    fontSize: '0.78rem',
    flexShrink: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#718096',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  detailMeta: {
    padding: '0.5rem 0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    borderBottom: '1px solid #1a1a2e',
    flexShrink: 0,
  },
  metaRow: { display: 'flex', gap: '0.4rem', alignItems: 'baseline' },
  metaLabel: { fontSize: '0.65rem', color: '#718096', minWidth: 80 },
  metaValue: { fontSize: '0.7rem', wordBreak: 'break-all' },
  detailBody: { flex: 1, overflow: 'auto', padding: '0.5rem 0.75rem' },
  detailBodyLabel: { fontSize: '0.65rem', color: '#718096', marginBottom: '0.3rem', fontWeight: 700 },
  detailBodyText: { fontSize: '0.72rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: '#cbd5e0' },
  firedSection: {
    borderTop: '1px solid #2d3748',
    background: '#0a0a14',
    flexShrink: 0,
  },
  firedToggle: {
    background: 'none',
    border: 'none',
    color: '#718096',
    cursor: 'pointer',
    fontSize: '0.7rem',
    padding: '0.4rem 0.75rem',
    width: '100%',
    textAlign: 'left',
  },
  firedGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.3rem',
    padding: '0 0.75rem 0.5rem',
    maxHeight: 150,
    overflow: 'auto',
  },
  footer: {
    fontSize: '0.6rem',
    color: '#4a5568',
    padding: '0.25rem 0.75rem',
    borderTop: '1px solid #1a1a2e',
    flexShrink: 0,
  },
};
