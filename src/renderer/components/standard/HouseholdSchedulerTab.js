import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SEG-K23-D — Household Scheduler: calendar placeholder + recruitment bounties
import { useState, useEffect, useCallback } from 'react';
import { BountyPoster } from './BountyPoster';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function HouseholdSchedulerTab(_props) {
    const [toast, setToast] = useState(null);
    useEffect(() => {
        if (!toast)
            return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);
    const handleClaim = useCallback(async (posterId) => {
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
        }
        catch {
            /* silent — endpoint may be offline */
        }
    }, []);
    return (_jsxs("div", { style: { padding: 16, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }, children: [toast && (_jsx("div", { style: {
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
                }, children: toast })), _jsx("div", { style: { fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }, children: "Household Scheduler" }), _jsx("div", { style: { fontSize: 11, color: '#707070', marginBottom: 20, lineHeight: 1.5 }, children: "Calendar integration for cooperative households \u2014 Google Calendar, Apple Calendar, ICS, whatever you already use. Help us build it." }), _jsxs("div", { style: { marginBottom: 24 }, children: [_jsx("div", { style: { fontSize: 12, color: '#7a9b8a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }, children: "Cooperative Calendar Preview" }), _jsxs("div", { style: {
                            border: '2px dashed rgba(120, 120, 120, 0.5)',
                            borderRadius: 6,
                            padding: 16,
                            backgroundColor: 'rgba(40, 40, 40, 0.4)',
                        }, children: [_jsx("div", { style: { fontSize: 10, color: '#808080', marginBottom: 12, fontStyle: 'italic' }, children: "Coming \u2014 help us build it" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 12 }, children: [DAYS.map((day) => (_jsx("div", { style: {
                                            textAlign: 'center',
                                            fontSize: 10,
                                            color: '#606060',
                                            padding: '4px 0',
                                            borderBottom: '1px solid rgba(120, 120, 120, 0.3)',
                                        }, children: day }, day))), Array.from({ length: 7 }).map((_, i) => (_jsx("div", { style: {
                                            height: 48,
                                            backgroundColor: 'rgba(60, 60, 60, 0.5)',
                                            border: '1px solid rgba(80, 80, 80, 0.4)',
                                            borderRadius: 2,
                                        } }, `cell-${i}`)))] }), _jsx("div", { style: { fontSize: 11, color: '#606060', textAlign: 'center' }, children: "Your cooperative household schedule will appear here once integration is complete." })] })] }), _jsx("div", { style: { fontSize: 12, color: '#7a9b8a', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }, children: "We need people! Help build this:" }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 16 }, children: [_jsx(BountyPoster, { posterId: "household-calendar-integration", headline: "Help Program the Calendar Integration", whatIsNeeded: "Engineers to build Google Calendar, Apple Calendar, and ICS sync for MnemosyneC household scheduler.", whyItMatters: "Cooperative households sharing schedules is the backbone of the Let's Make Dinner, Let's Get Groceries, and Household Concierge initiatives.", memberGets: "Marks + IP Ledger attribution + patent floater eligibility for architectural contributions", onClaim: handleClaim }), _jsx(BountyPoster, { posterId: "household-sync-server", headline: "Help Host a Calendar Sync Server", whatIsNeeded: "A cooperative member to run and maintain a calendar sync relay node \u2014 a Node Captain for the scheduling backbone.", whyItMatters: "The cooperative substrate needs distributed calendar sync nodes. One per city ideally.", memberGets: "Marks + Node Captain credit + founding infrastructure attribution", onClaim: handleClaim }), _jsx(BountyPoster, { posterId: "household-ux-design", headline: "Help Design the Household Coordination UX", whatIsNeeded: "A UX/UI designer to spec and prototype the household scheduling interface \u2014 shared views, task assignment, meal coordination.", whyItMatters: "Good design here directly serves millions of families who would otherwise use extractive-class calendar apps.", memberGets: "Marks + IP Ledger attribution + patent floater eligibility for novel UX contributions", onClaim: handleClaim }), _jsx(BountyPoster, { posterId: "household-documentation", headline: "Help Write Documentation", whatIsNeeded: "A writer to create user guides, setup walkthroughs, and API documentation for the household scheduler.", whyItMatters: "Documentation is the bridge between the substrate and the people it serves. Clear docs = cooperative accessibility.", memberGets: "Marks + attribution + cooperative contributor credit", onClaim: handleClaim })] })] }));
}
