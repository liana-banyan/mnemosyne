// SEG-K23-D — Household Scheduler: calendar placeholder + recruitment bounties

import React, { useState, useEffect, useCallback } from 'react';
import type { AuthState } from '../../amplify.d';
import { BountyPoster } from './BountyPoster';

export interface HouseholdSchedulerTabProps {
  authState: AuthState | null;
  onSwitchTab?: (tab: string) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function HouseholdSchedulerTab(_props: HouseholdSchedulerTabProps) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleClaim = useCallback(async (posterId: string) => {
    try {
      const res = await fetch('http://localhost:11480/yoke/ip_ledger/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registered_by: 'anonymous',
          claim: 'BOUNTY_CLAIM',
          claim_body: posterId,
          category: 'other',
        }),
      });
      if (res.ok) {
        setToast('Claimed! Check your IP Ledger.');
      }
    } catch {
      /* silent — endpoint may be offline */
    }
  }, []);

  return (
    <div style={{ padding: 16, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      {toast && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            marginBottom: 12,
            padding: '8px 12px',
            backgroundColor: 'rgba(100, 200, 150, 0.15)',
            border: '1px solid rgba(100, 200, 150, 0.4)',
            borderRadius: 4,
            fontSize: 12,
            color: '#8bc8a0',
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
        Household Scheduler
      </div>
      <div style={{ fontSize: 11, color: '#707070', marginBottom: 20, lineHeight: 1.5 }}>
        Calendar integration for cooperative households — Google Calendar, Apple Calendar, ICS, whatever you already use. Help us build it.
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: '#7a9b8a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Cooperative Calendar Preview
        </div>
        <div
          style={{
            border: '2px dashed rgba(120, 120, 120, 0.5)',
            borderRadius: 6,
            padding: 16,
            backgroundColor: 'rgba(40, 40, 40, 0.4)',
          }}
        >
          <div style={{ fontSize: 10, color: '#808080', marginBottom: 12, fontStyle: 'italic' }}>
            Coming — help us build it
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 12 }}>
            {DAYS.map((day) => (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  fontSize: 10,
                  color: '#606060',
                  padding: '4px 0',
                  borderBottom: '1px solid rgba(120, 120, 120, 0.3)',
                }}
              >
                {day}
              </div>
            ))}
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={`cell-${i}`}
                style={{
                  height: 48,
                  backgroundColor: 'rgba(60, 60, 60, 0.5)',
                  border: '1px solid rgba(80, 80, 80, 0.4)',
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#606060', textAlign: 'center' }}>
            Your cooperative household schedule will appear here once integration is complete.
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#7a9b8a', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        We need people! Help build this:
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <BountyPoster
          posterId="household-calendar-integration"
          headline="Help Program the Calendar Integration"
          whatIsNeeded="Engineers to build Google Calendar, Apple Calendar, and ICS sync for MnemosyneC household scheduler."
          whyItMatters="Cooperative households sharing schedules is the backbone of the Let's Make Dinner, Let's Get Groceries, and Household Concierge initiatives."
          memberGets="Marks + IP Ledger attribution + patent floater eligibility for architectural contributions"
          onClaim={handleClaim}
        />
        <BountyPoster
          posterId="household-sync-server"
          headline="Help Host a Calendar Sync Server"
          whatIsNeeded="A cooperative member to run and maintain a calendar sync relay node — a Node Captain for the scheduling backbone."
          whyItMatters="The cooperative substrate needs distributed calendar sync nodes. One per city ideally."
          memberGets="Marks + Node Captain credit + founding infrastructure attribution"
          onClaim={handleClaim}
        />
        <BountyPoster
          posterId="household-ux-design"
          headline="Help Design the Household Coordination UX"
          whatIsNeeded="A UX/UI designer to spec and prototype the household scheduling interface — shared views, task assignment, meal coordination."
          whyItMatters="Good design here directly serves millions of families who would otherwise use extractive-class calendar apps."
          memberGets="Marks + IP Ledger attribution + patent floater eligibility for novel UX contributions"
          onClaim={handleClaim}
        />
        <BountyPoster
          posterId="household-documentation"
          headline="Help Write Documentation"
          whatIsNeeded="A writer to create user guides, setup walkthroughs, and API documentation for the household scheduler."
          whyItMatters="Documentation is the bridge between the substrate and the people it serves. Clear docs = cooperative accessibility."
          memberGets="Marks + attribution + cooperative contributor credit"
          onClaim={handleClaim}
        />
      </div>
    </div>
  );
}
