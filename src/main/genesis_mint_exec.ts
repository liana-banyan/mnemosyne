/**
 * BP080 Genesis Mint — Direct execution script
 * Federal Body Cam: idempotency check first — never double-write.
 * Run: npx ts-node --project tsconfig.main.json src/main/genesis_mint_exec.ts
 */

import { registerClaim, loadAllEntries } from './ip_ledger/ip_ledger_store';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCode = require('qrcode') as typeof import('qrcode');

async function main(): Promise<void> {
  // ─── IDEMPOTENCY CHECK — Federal Body Cam ──────────────────────────────────
  const allEntries = loadAllEntries();
  const existingGenesis = allEntries.find(e => e.claim === 'genesis:user:000001');
  if (existingGenesis) {
    console.log('IDEMPOTENCY GUARD: genesis:user:000001 already exists — no duplicate write.');
    console.log('Existing ledger_id:', existingGenesis.ledger_id);
    console.log('Registered at:', existingGenesis.registered_at);
    return;
  }

  console.log('=== BP080 Genesis Mint — User 000001 ===');
  console.log('Federal Body Cam: 22 permanent entries about to be written.');
  console.log('Timestamp:', new Date().toISOString());

  // ─── STEP 1: Genesis user entry ──────────────────────────────────────────────
  const genesisEntry = registerClaim({
    registered_by: 'member_000001',
    claim: 'genesis:user:000001',
    claim_body: JSON.stringify({
      display_name: 'FounderDenken',
      email: 'Founder@LianaBanyan.com',
      role: 'founder',
      cooperative: 'MnemosyneC',
      founding_date: '2026-06-11',
      supabase_user_id: 'member_000001',
      provisional_filings_count: 21,
      filing_dockets: ['LB-PROV-001','LB-PROV-002','LB-PROV-003','LB-PROV-004','LB-PROV-005','LB-PROV-006','LB-PROV-007','LB-PROV-008','LB-PROV-009','LB-PROV-010','LB-PROV-011','LB-PROV-012','LB-PROV-013','LB-PROV-014','LB-PROV-015','LB-PROV-016','LB-PROV-017','LB-PROV-018','LB-PROV-019','LB-PROV-020','LB-PROV-021'],
      ratify_quote: 'MINT IT — display_name: FounderDenken — 2026-06-11',
      ratify_session: 'BP080',
      member_id_note: 'supabase_user_id is the immutable anchor; display_name and email are mutable proxies — supersede-chain tracks changes per Federal Body Cam doctrine',
    }),
    evidence: [
      'Asteroid-ProofVault/03_PATENT_BAGS/PROV_21_FILING_CHECKLIST_BP067.md',
      'MEMORY.md — BP070 CLOSE-STAMP canonical filing count 21',
      'Founder explicit ratify 2026-06-11 BP080 — MINT IT display_name FounderDenken',
    ],
    category: 'provisional',
  });
  console.log('✓ genesis:user:000001  ledger_id:', genesisEntry.ledger_id);

  // ─── STEP 2: 21 per-filing entries ───────────────────────────────────────────
  const PROV_FILINGS: Array<{
    docket: string;
    app_number: string;
    filing_date: string;
    title: string;
    conf?: string;
    filing_fee?: string;
    entity_status?: string;
  }> = [
    { docket: 'LB-PROV-001', app_number: '63/925,672', filing_date: '2025-11-26', title: 'see-patent-receipt' },
    { docket: 'LB-PROV-002', app_number: '63/927,674', filing_date: '2025-11-30', title: 'see-patent-receipt' },
    { docket: 'LB-PROV-003', app_number: '63/938,216', filing_date: '2025-12-10', title: 'see-patent-receipt' },
    { docket: 'LB-PROV-004', app_number: '63/967,200', filing_date: '2026-01-23', title: 'see-patent-receipt' },
    { docket: 'LB-PROV-005', app_number: '63/969,601', filing_date: '2026-01-28', title: 'see-patent-receipt' },
    { docket: 'LB-PROV-006', app_number: '63/989,913', filing_date: '2026-02-24', title: 'see-patent-receipt' },
    { docket: 'LB-PROV-007', app_number: '64/006,010', filing_date: '2026-03-15', title: 'see-patent-receipt' },
    { docket: 'LB-PROV-008', app_number: '64/009,803', filing_date: '2026-03-18', title: 'see-patent-receipt' },
    { docket: 'LB-PROV-009', app_number: '64/017,140', filing_date: '2026-03-25', title: 'see-patent-receipt' },
    { docket: 'LB-PROV-010', app_number: '64/017,457', filing_date: 'see-patent-receipt', title: 'see-patent-receipt' },
    { docket: 'LB-PROV-011', app_number: '64/025,635', filing_date: 'see-patent-receipt', title: 'see-patent-receipt' },
    { docket: 'LB-PROV-012', app_number: '64/031,531', filing_date: 'see-patent-receipt', title: '93 innovations #2131-#2224 — Context/Beacon/Distribution/Temporal/Trust/UX clusters (B077-B087)' },
    { docket: 'LB-PROV-013', app_number: '64/036,646', filing_date: '2026-04-12', title: 'Romulator / ROM+Emulator+HAL9000 genesis strain of Mnemosyne' },
    { docket: 'LB-PROV-014', app_number: '64/052,602', filing_date: '2026-04-29', title: 'Cooperative-Platform AI Memory Infrastructure with Discipline-Enforcement Federation' },
    { docket: 'LB-PROV-015', app_number: '64/052,618', filing_date: '2026-04-29', title: 'Cooperative-Platform AI Memory Infrastructure — Agent-Spawn Boundary Pre-Injection, Lossless Vendor-Layer Tablet Capture, Corpus-Alias Registry-Keyword-Extension, Substrate Discipline Primitives' },
    { docket: 'LB-PROV-016', app_number: '64/060,080', filing_date: '2026-05-07', title: 'Method and System for Cooperative-AI-Substrate Platform with Multi-Organism Federation and Substrate-Routed Memory Expansion' },
    { docket: 'LB-PROV-017', app_number: '64/060,093', filing_date: '2026-05-07', title: 'Save-the-World 12-Paper Series + HexIsle Wave 4 + Cooperative Manufacturing Sovereignty + Substrate-IS-the-Primitive' },
    { docket: 'LB-PROV-018', app_number: '64/062,332', filing_date: '2026-05-11', title: 'BP036 substrate canon — PGP/Edition/Aviator + SEG-Cascade + Aircraft Carrier + Excalibur + TCP/IP 4-Tuple substrate-layer' },
    { docket: 'LB-PROV-019', app_number: '64/062,334', filing_date: '2026-05-11', title: 'HexIsle 2D Isometric World Operational Interface + Substrate kernel extensions + Sonnet S7/S8/S1 clusters' },
    { docket: 'LB-PROV-020', app_number: '64/073,890', filing_date: '2026-05-25', title: 'Substrace Theorem + Pheromone Trail + Wrasse-Quartermaster + MENUS + Hard Candy Stitchpunk + Pearl Registry + Cephas + SEG-Cascade + Employ-the-World backbone' },
    { docket: 'LB-PROV-021', app_number: '64/079,336', filing_date: '2026-06-01', title: 'Cooperative AI Substrate Systems: Roll Architecture Peer-Mesh Ratification, Pearl-Class Transmission, Wrasse-Quartermaster Context Pre-Injection, Anti-Hype Empirical Honesty Framework, Caithedral Cathedral Architecture, MENUS-Helm Cooperative Inventory Layer, Hard Candy Stitchpunk Configuration Sharing, Mnemosyne P2P Cold-Storage Capsule Protocol, Employ the World Cooperative-Economy Backbone, Computation-Knowledge Separation via Speckle/Hex-Soccerball/Peanut-Roll/Mass-Crystal Substrate Primitives, AI Tuner Role-Class, and Human-Substrate Anecdote-Corpus Method for Multi-Agent Cooperative Platform Orchestration', conf: '6635', filing_fee: '$65', entity_status: 'micro_entity' },
  ];

  const filingEntries: ReturnType<typeof registerClaim>[] = [];
  for (const f of PROV_FILINGS) {
    const body: Record<string, string> = {
      docket: f.docket,
      app_number: f.app_number,
      filing_date: f.filing_date,
      title: f.title,
      filed_by: 'Jonathan Ray Jones',
      address: '9627 Krier Ct, Converse TX 78109',
      cooperative: 'MnemosyneC',
      genesis_ledger_id_ref: genesisEntry.ledger_id,
    };
    if (f.conf) body['conf'] = f.conf;
    if (f.filing_fee) body['filing_fee'] = f.filing_fee;
    if (f.entity_status) body['entity_status'] = f.entity_status;
    const entry = registerClaim({
      registered_by: 'member_000001',
      claim: `patent:provisional:${f.docket}`,
      claim_body: JSON.stringify(body),
      evidence: [
        'Asteroid-ProofVault/03_PATENT_BAGS/ — folder-verified app number',
        'Founder explicit ratify 2026-06-11 BP080',
      ],
      category: 'provisional',
    });
    filingEntries.push(entry);
    console.log(`✓ ${f.docket}  app: ${f.app_number}  ledger_id: ${entry.ledger_id}`);
  }

  // ─── STEP 3: Generate vCard QR PNG ───────────────────────────────────────────
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:FounderDenken',
    'ORG:MnemosyneC Cooperative',
    'EMAIL:Founder@LianaBanyan.com',
    'URL:https://mnemosynec.ai',
    `NOTE:User 000001 · MnemosyneC Cooperative Founder · 21 provisional filings · genesis:user:000001 · genesis_ledger_id: ${genesisEntry.ledger_id}`,
    'END:VCARD',
  ].join('\n');

  const resourcesDir = resolve(__dirname, '..', '..', 'resources');
  if (!existsSync(resourcesDir)) mkdirSync(resourcesDir, { recursive: true });
  const vcardQrPath = resolve(resourcesDir, 'founder-vcard.png');

  await QRCode.toFile(vcardQrPath, vcard, { width: 300, margin: 2 });
  console.log('✓ vCard QR PNG saved:', vcardQrPath);

  // ─── OUTPUT SUMMARY ───────────────────────────────────────────────────────────
  console.log('\n=== MINT COMPLETE ===');
  console.log('genesis_ledger_id:', genesisEntry.ledger_id);
  console.log('genesis_registered_at:', genesisEntry.registered_at);
  console.log('Filing ledger_ids:');
  for (let i = 0; i < filingEntries.length; i++) {
    console.log(`  ${PROV_FILINGS[i].docket}: ${filingEntries[i].ledger_id}`);
  }
  console.log('vCard QR:', vcardQrPath);
  console.log('Total entries written: 22');
}

main().catch(console.error);
