// DevModeTab — SAGA 11 BP046B · v0.1.8 BP052 NOVACULA W1 SEG-FT-4
// Developer Mode — 6 inspector panels (pill tabs at top):
//   1. Caithedral™ Inspector   — retrieval log (W2 full implementation)
//   2. Eblet™ Inspector        — searchable Eblet store (W2 full implementation)
//   3. Pheromone Visualizer    — trail heat map (W2 full implementation)
//   4. Banyan Metric™ Ledger   — composite score ledger (W2 full implementation)
//   5. Atlas™ Panel            — links to Atlas™ scheduling tab
//   6. SEG Controls            — Wave/Drekaskip/Novacula/AutoBaton + Gauntlet surfaces

import React, { useState } from 'react';
import type { AuthState } from '../amplify.d';
import { CaiSymbol } from './CaiSymbol';
import { CaithedralInspector } from '../kitchen_table/CaithedralInspector';
import { EbletInspector } from '../kitchen_table/EbletInspector';
import { PheromoneVisualizer } from '../kitchen_table/PheromoneVisualizer';
import { BanyanMetricLedger } from '../kitchen_table/BanyanMetricLedger';
import { SubstratedFoldersPanel } from './SubstratedFoldersPanel';

type DevSurface = 'submit-test' | 'uploads' | 'fork-strain' | 'seg-control' | 'project-connect' | 'variant-voting';
type DevPanel = 'caithedral' | 'eblet' | 'pheromone' | 'banyan-metric' | 'atlas' | 'seg-controls' | 'substrate';

interface DevModeTabProps {
  authState: AuthState | null;
  onDisable: () => void;
  onStepByStep: (surfaceId: DevSurface) => void;
}

const SURFACES: Array<{ id: DevSurface; icon: string; label: string; desc: string }> = [
  { id: 'submit-test',     icon: '📝', label: 'Submit New Test',    desc: 'Define a Gauntlet variant · upload test data · register as project' },
  { id: 'uploads',         icon: '📋', label: 'My Uploads',         desc: 'Full ledger · every upload logged with timestamp + status + project' },
  { id: 'fork-strain',     icon: '🍴', label: 'Fork Strain',        desc: 'Clone MnemosyneC strain · modify · run · submit upstream or maintain fork' },
  { id: 'seg-control',     icon: '⚙️', label: 'SEG Count Control',  desc: 'Wave / Drekaskip / Novacula / AutoBaton selectors · parallel SEG count' },
  { id: 'project-connect', icon: '🔗', label: 'Project Connect',    desc: 'Link upload to project · family/tribe/guild/business · Counterpart peer' },
  { id: 'variant-voting',  icon: '🗳️', label: 'Variant Voting',     desc: 'Submit to /gauntlet/variants/ · community votes · Level 3 auto-offer as strain' },
];

// ─── Inspector panel definitions ──────────────────────────────────────────────

const PANELS: Array<{ id: DevPanel; label: string; mark?: string }> = [
  { id: 'caithedral',    label: 'Caithedral™' },
  { id: 'eblet',         label: 'Eblet™' },
  { id: 'pheromone',     label: 'Pheromone' },
  { id: 'banyan-metric', label: 'Banyan Metric™' },
  { id: 'atlas',         label: 'Atlas™' },
  { id: 'seg-controls',  label: 'SEG Controls' },
  { id: 'substrate',     label: 'Substrate™' },
];

export function DevModeTab({ authState, onDisable, onStepByStep }: DevModeTabProps) {
  const [activePanel, setActivePanel] = useState<DevPanel>('caithedral');
  const [activeSurface, setActiveSurface] = useState<DevSurface | null>(null);
  const [flippedCard, setFlippedCard] = useState<DevSurface | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid rgba(245,158,11,0.15)',
        padding: '6px 12px', flexShrink: 0,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
          <CaiSymbol size="0.9em" color="#f59e0b" />
          Developer Mode
          <span style={{ fontSize: 8, color: '#64748b', fontWeight: 400 }}>· cooperative peer-witness real</span>
        </div>
        <button
          onClick={onDisable}
          style={{
            background: 'none', border: '1px solid rgba(100,116,139,0.25)',
            color: '#475569', borderRadius: 6, padding: '3px 8px', fontSize: 9, cursor: 'pointer',
          }}
        >
          Disable
        </button>
      </div>

      {/* Pill-style panel tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 12px 0',
        borderBottom: '1px solid rgba(100,116,139,0.12)',
        flexShrink: 0, overflowX: 'auto',
      }}>
        {PANELS.map((panel) => (
          <button
            key={panel.id}
            onClick={() => setActivePanel(panel.id)}
            style={{
              padding: '4px 10px',
              borderRadius: 12,
              fontSize: 10,
              fontWeight: activePanel === panel.id ? 700 : 400,
              cursor: 'pointer',
              border: activePanel === panel.id ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(100,116,139,0.15)',
              background: activePanel === panel.id ? 'rgba(245,158,11,0.08)' : 'transparent',
              color: activePanel === panel.id ? '#f59e0b' : '#64748b',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {panel.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activePanel === 'caithedral' && <CaithedralInspector />}
        {activePanel === 'eblet' && <EbletInspector />}
        {activePanel === 'pheromone' && <PheromoneVisualizer />}
        {activePanel === 'banyan-metric' && <BanyanMetricLedger />}
        {activePanel === 'atlas' && <AtlasPanel />}
        {activePanel === 'seg-controls' && (
          <SegControlsPanel
            authState={authState}
            onDisable={onDisable}
            onStepByStep={onStepByStep}
            activeSurface={activeSurface}
            setActiveSurface={setActiveSurface}
            flippedCard={flippedCard}
            setFlippedCard={setFlippedCard}
          />
        )}
        {activePanel === 'substrate' && <SubstratedFoldersPanel />}
      </div>
    </div>
  );
}

// ─── Atlas™ Panel — links to Atlas tab ────────────────────────────────────────

function AtlasPanel() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)',
        borderRadius: 8, padding: '16px 14px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', marginBottom: 4 }}>Atlas™ Scheduling</div>
        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6 }}>
          Atlas™ is available in its own primary tab.<br />
          Switch to the Atlas™ tab to manage calendar events, participants, and P2P sync.
        </div>
        <div style={{ fontSize: 9, color: '#334155', marginTop: 10 }}>
          Dev panel integration coming in a future wave — will show Atlas sync state, P2P event queue, and AI-suggest logs.
        </div>
      </div>
    </div>
  );
}

// ─── SEG Controls Panel (existing DevModeTab surface grid + original Gauntlet surfaces) ───

function SegControlsPanel({
  authState,
  onDisable,
  onStepByStep,
  activeSurface,
  setActiveSurface,
  flippedCard,
  setFlippedCard,
}: {
  authState: AuthState | null;
  onDisable: () => void;
  onStepByStep: (s: DevSurface) => void;
  activeSurface: DevSurface | null;
  setActiveSurface: (s: DevSurface | null) => void;
  flippedCard: DevSurface | null;
  setFlippedCard: (s: DevSurface | null) => void;
}) {
  if (activeSurface) {
    return (
      <SurfaceView
        surface={activeSurface}
        authState={authState}
        onBack={() => setActiveSurface(null)}
      />
    );
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {SURFACES.map((s) => (
          <div key={s.id} style={{ position: 'relative', perspective: 600, height: 120 }}>
            <div
              style={{
                position: 'absolute', inset: 0,
                transformStyle: 'preserve-3d',
                transition: 'transform 0.35s ease',
                transform: flippedCard === s.id ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* FRONT */}
              <div
                style={{
                  position: 'absolute', inset: 0,
                  backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                  background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.15)',
                  borderRadius: 10, padding: '12px 12px',
                  display: 'flex', flexDirection: 'column', cursor: 'pointer', boxSizing: 'border-box',
                }}
                onClick={() => setActiveSurface(s.id)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'; e.currentTarget.style.background = 'rgba(245,158,11,0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(100,116,139,0.15)'; e.currentTarget.style.background = 'rgba(15,23,42,0.6)'; }}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>{s.label}</div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 3, lineHeight: 1.5, flex: 1 }}>{s.desc}</div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFlippedCard(s.id); }}
                  style={{ alignSelf: 'flex-end', marginTop: 4, background: 'none', border: '1px solid rgba(100,116,139,0.2)', color: '#475569', borderRadius: 4, padding: '2px 7px', fontSize: 8, cursor: 'pointer' }}
                  title={`More info about ${s.label}`}
                >
                  More Info
                </button>
              </div>
              {/* BACK */}
              <div
                style={{
                  position: 'absolute', inset: 0,
                  backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: 10, padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', boxSizing: 'border-box',
                }}
              >
                <CardDetailContent surfaceId={s.id} />
                <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                  <button onClick={() => setFlippedCard(null)} style={{ flex: 1, background: 'none', border: '1px solid rgba(100,116,139,0.2)', color: '#64748b', borderRadius: 6, padding: '4px 0', fontSize: 9, cursor: 'pointer' }}>← Back</button>
                  <button onClick={() => { setFlippedCard(null); onStepByStep(s.id); }} style={{ flex: 1, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', borderRadius: 6, padding: '4px 0', fontSize: 9, cursor: 'pointer', fontWeight: 600 }}>Step-By-Step</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(100,116,139,0.1)', borderRadius: 8, padding: '8px 12px' }}>
        <div style={{ fontSize: 9, color: '#475569', lineHeight: 1.6 }}>
          <span style={{ color: '#64748b', fontWeight: 600 }}>Cooperative Defensive Patent Pledge #2260</span>
          {' '}— all Developer Mode submissions are bound by this pledge.
          Variants crossing community Level 3 (1,000+ credits) are auto-offered as optional download strains.
        </div>
      </div>
    </div>
  );
}

// ─── Card detail content (flip back face) ─────────────────────────────────────

const CARD_DETAIL: Record<DevSurface, { headline: string; body: string }> = {
  'submit-test': {
    headline: 'Submit New Test',
    body: 'Define a new Gauntlet variant. Describe a task, upload or point to test data, and register it as a named project. Community runs it. Pioneer Bonus fires if you are first.',
  },
  'uploads': {
    headline: 'My Uploads',
    body: 'Full ledger of every file or dataset you have submitted — timestamp, content snapshot, processing status, linked project, and its place in the variant lineage.',
  },
  'fork-strain': {
    headline: 'Fork Strain',
    body: 'Clone the current MnemosyneC strain, modify it, run it locally against your own tests, then submit a pull upstream or maintain your own fork permanently.',
  },
  'seg-control': {
    headline: 'SEG Count Control',
    body: 'Choose your orchestration pattern: Wave (sequential fan-out), Drekaskip (priority-skip routing), Novacula (18-SEG parallel — current default), or AutoBaton (Maestro auto-selects).',
  },
  'project-connect': {
    headline: 'Project Connect',
    body: 'Link an upload to a specific project — your own, a family member, tribe group, guild, business, or a Counterpart peer node in the cooperative.',
  },
  'variant-voting': {
    headline: 'Variant Voting',
    body: 'Submit a Gauntlet variant to the community voting pool. Community members vote with credits. A variant reaching Level 3 (1,000+ credits) is auto-offered as an optional download strain.',
  },
};

function CardDetailContent({ surfaceId }: { surfaceId: DevSurface }) {
  const c = CARD_DETAIL[surfaceId];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{c.headline}</div>
      <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.6 }}>{c.body}</div>
    </div>
  );
}

// ─── Surface view placeholder ─────────────────────────────────────────────────

function SurfaceView({ surface, authState, onBack }: {
  surface: DevSurface;
  authState: AuthState | null;
  onBack: () => void;
}) {
  const def = SURFACES.find((s) => s.id === surface)!;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: 0 }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
            {def.icon} {def.label}
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{def.desc}</div>
        </div>
      </div>

      {/* Surface-specific UI — SAGA 11 full implementation fills these out */}
      {surface === 'submit-test' && <SubmitTestForm authState={authState} />}
      {surface === 'uploads' && <UploadsLedger />}
      {surface === 'fork-strain' && <ForkStrainPanel />}
      {surface === 'seg-control' && <SEGControlPanel />}
      {surface === 'project-connect' && <ProjectConnectPanel />}
      {surface === 'variant-voting' && <VariantVotingPanel />}
    </div>
  );
}

// ─── Surface stubs (SAGA 11 fills these out) ─────────────────────────────────

function SubmitTestForm({ authState }: { authState: AuthState | null }) {
  return (
    <div style={{ color: '#64748b', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>📝</div>
      <div>Gauntlet variant submission form</div>
      <div style={{ fontSize: 10, marginTop: 4 }}>SAGA 11 full implementation · define test · upload data · register project</div>
    </div>
  );
}

function UploadsLedger() {
  return (
    <div style={{ color: '#64748b', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
      <div>Uploads ledger — every upload logged</div>
      <div style={{ fontSize: 10, marginTop: 4 }}>Timestamp · content snapshot · status · project association · variant lineage</div>
    </div>
  );
}

function ForkStrainPanel() {
  return (
    <div style={{ color: '#64748b', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>🍴</div>
      <div>Fork current MnemosyneC strain</div>
      <div style={{ fontSize: 10, marginTop: 4 }}>Clone · modify · run locally · submit upstream OR maintain personal fork</div>
    </div>
  );
}

function SEGControlPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[
        { id: 'wave',     label: '🌊 Wave',      desc: 'Standard sequential fan-out' },
        { id: 'drekaskip', label: '🐉 Drekaskip', desc: 'Priority-routing skip-class' },
        { id: 'novacula',  label: '⚡ Novacula',   desc: '18-SEG parallel fan-out (current)' },
        { id: 'autobaton', label: '🎯 AutoBaton',  desc: 'Maestro-class automatic selection' },
      ].map((opt) => (
        <div key={opt.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.15)',
          borderRadius: 8, padding: '10px 12px',
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{opt.label}</div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{opt.desc}</div>
          </div>
          <input type="radio" name="orchestrator" value={opt.id} defaultChecked={opt.id === 'novacula'} />
        </div>
      ))}
    </div>
  );
}

function ProjectConnectPanel() {
  return (
    <div style={{ color: '#64748b', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>🔗</div>
      <div>Connect to a project</div>
      <div style={{ fontSize: 10, marginTop: 4 }}>Own project · family/tribe/guild/business · Counterpart peer</div>
    </div>
  );
}

function VariantVotingPanel() {
  return (
    <div style={{ color: '#64748b', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>🗳️</div>
      <div>Submit variant to community voting</div>
      <div style={{ fontSize: 10, marginTop: 4 }}>Level 3 (1,000+ credits) → auto-offered as optional download strain</div>
    </div>
  );
}
