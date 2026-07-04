/**
 * Substrate Developer's Guild -- Landing Page
 * Wave 7 -- BP089 Marathon Session 2
 *
 * Spinout #2 identity (distinct from Spinout #1: CAI Bonfire).
 * Build on the substrate. Cost+20% compute. 83.3% creator pay-through.
 * $5/year membership.
 */

import { useState } from 'react';

const MARKS_EARN_ROWS = [
  { activity: 'Work pool completion', rate: '10% of allocated work value', notes: 'Applied at work close' },
  { activity: 'Peer code review (verified)', rate: '0.05 Marks', notes: 'Verified by one other Guild member' },
  { activity: 'Bounty completion', rate: 'Proportional to bounty size', notes: 'Per bounty specification' },
  { activity: 'Documentation contribution', rate: '0.05 Marks', notes: 'Steward-verified, per accepted doc' },
];

const PRIMITIVES = [
  { name: 'Pheromone Signals', description: 'Stigmergic discovery index -- claim routing and topic resolution' },
  { name: 'Pearl DAG', description: 'Content-addressable knowledge fragments with class hierarchy' },
  { name: 'Soccerball', description: 'Session DAG for cooperative workflow state' },
  { name: 'IP Ledger', description: 'Ed25519-stamped provenance chain for cooperative IP registration' },
  { name: 'Fleet Broadcast', description: 'Peer mesh real-time cooperative networking' },
  { name: 'Keys and Engines', description: 'Local-first AI inference layer with substrate routing' },
];

export default function GuildLandingPage() {
  const [showIntake, setShowIntake] = useState(false);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto', padding: '2rem 1rem', color: '#1a1a1a' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.5rem', letterSpacing: '0.08em' }}>
          SPINOUT #2 -- COOPERATIVE SUBSTRATE
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 0.5rem', lineHeight: 1.1 }}>
          Substrate Developer's Guild
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#444', maxWidth: 600 }}>
          Build cooperative applications on the MnemosyneC substrate. Local-first.
          Peer-native. 83.3% creator pay-through.
        </p>
        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#888', borderLeft: '3px solid #e0e0e0', paddingLeft: '0.75rem' }}>
          Not Spinout #1 (CAI Bonfire -- cooperative AI training contributions).
          This is Spinout #2: developer infrastructure and application layer.
        </div>
      </div>

      {/* Economic model strip */}
      <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '1.25rem', marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a' }}>83.3%</div>
          <div style={{ fontSize: '0.8rem', color: '#555' }}>Creator pay-through<br />(never 83%, never 84%)</div>
        </div>
        <div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a' }}>Cost+20%</div>
          <div style={{ fontSize: '0.8rem', color: '#555' }}>Platform margin on<br />substrate compute</div>
        </div>
        <div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a' }}>$5/yr</div>
          <div style={{ fontSize: '0.8rem', color: '#555' }}>Flat membership<br />no tiers</div>
        </div>
        <div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a' }}>$416.67</div>
          <div style={{ fontSize: '0.8rem', color: '#555' }}>Creator receives<br />on $500 transaction</div>
        </div>
      </div>

      {/* Substrate primitives */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1rem' }}>Build on the Substrate</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
          {PRIMITIVES.map(p => (
            <div key={p.name} style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: '0.875rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{p.name}</div>
              <div style={{ fontSize: '0.85rem', color: '#555' }}>{p.description}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Marks earn */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>Marks Earn (Developer Track)</h2>
        <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.75rem' }}>
          All rates are Founder-ratified per BP086 MARKS CLEARING TABLE.
          Marks are cooperative participation units -- NOT securities.
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 600 }}>Activity</th>
              <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 600 }}>Rate</th>
              <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 600 }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {MARKS_EARN_ROWS.map((r, i) => (
              <tr key={r.activity} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '0.5rem 0.75rem' }}>{r.activity}</td>
                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{r.rate}</td>
                <td style={{ padding: '0.5rem 0.75rem', color: '#666' }}>{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Join CTA */}
      <section style={{ background: '#1a1a1a', color: '#fff', borderRadius: 8, padding: '1.5rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
          Join the Guild
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#ccc', margin: '0 0 1rem' }}>
          Open to all cooperative members. $5/year membership required.
          Build, contribute, and earn Marks through the developer track.
        </p>
        <button
          onClick={() => setShowIntake(!showIntake)}
          style={{
            background: '#fff',
            color: '#1a1a1a',
            border: 'none',
            borderRadius: 5,
            padding: '0.6rem 1.25rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          {showIntake ? 'Hide Intake Form' : 'Open Intake Form'}
        </button>
        {showIntake && (
          <div style={{ marginTop: '1rem', background: '#2a2a2a', borderRadius: 6, padding: '1rem', fontSize: '0.85rem', color: '#ddd' }}>
            <p>
              Download the intake form at{' '}
              <code style={{ background: '#333', padding: '0.15rem 0.4rem', borderRadius: 3 }}>
                ip_ledger/guild/intake_form.md
              </code>
              , complete it, and submit via the cooperative portal or directly to a Guild steward.
            </p>
            <p style={{ marginTop: '0.5rem', color: '#aaa', fontSize: '0.8rem' }}>
              Online submission form: coming in Wave 8 (BP090+).
            </p>
          </div>
        )}
      </section>

      {/* Not securities disclaimer */}
      <div style={{ fontSize: '0.75rem', color: '#999', borderTop: '1px solid #e0e0e0', paddingTop: '1rem' }}>
        Marks are cooperative participation units only -- NOT equity, shares, dividends, or investment instruments.
        Platform tokens do not represent an ownership stake or financial return.
        Membership: $5/year flat fee, no tiers.
      </div>
    </div>
  );
}
