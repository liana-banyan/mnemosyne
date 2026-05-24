// B61 Phase 0 smoke test — substrate I/O + dispatch/status pattern verification
// Tests the substrate file I/O without real API keys (PENDING + COMPLETE + receipt_hash)
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { randomUUID, createHash } from 'crypto';

const LB_SUBSTRATE_ROOT = process.env.LB_SUBSTRATE_ROOT ?? resolve(homedir(), '.lb_substrate');
const PAWN_DIR = resolve(LB_SUBSTRATE_ROOT, 'yoke_dispatch', 'pawn');
const ROOK_DIR = resolve(LB_SUBSTRATE_ROOT, 'yoke_dispatch', 'rook');

let passed = 0;
let failed = 0;
function ok(cond, label) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

// Ensure dirs exist
for (const d of [PAWN_DIR, ROOK_DIR]) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}
ok(existsSync(PAWN_DIR), `yoke_dispatch/pawn dir exists at ${PAWN_DIR}`);
ok(existsSync(ROOK_DIR), `yoke_dispatch/rook dir exists at ${ROOK_DIR}`);

// --- Pawn dispatch round-trip ---
const pawnId = randomUUID();
const pawnRequest = { dispatch_id: pawnId, session: 'B61-SMOKE', prompt: 'test prompt', spawn_timestamp: new Date().toISOString(), recipient: 'pawn', status: 'PENDING' };
writeFileSync(resolve(PAWN_DIR, `${pawnId}.request.json`), JSON.stringify(pawnRequest, null, 2));
const pendingRead = JSON.parse(readFileSync(resolve(PAWN_DIR, `${pawnId}.request.json`), 'utf8'));
ok(pendingRead.status === 'PENDING', 'Pawn request written with status PENDING');
ok(pendingRead.dispatch_id === pawnId, 'Pawn dispatch_id round-trips correctly');
ok(pendingRead.recipient === 'pawn', 'Pawn recipient field correct');

const pawnReply = 'Pawn mock reply from sonar-reasoning-pro';
const pawnCompletedTs = new Date().toISOString();
const pawnHash = createHash('sha256').update(JSON.stringify({ dispatchId: pawnId, reply: pawnReply, completedTs: pawnCompletedTs })).digest('hex').slice(0, 32);
const pawnReceipt = { ...pawnRequest, status: 'COMPLETE', reply: pawnReply, completed_timestamp: pawnCompletedTs, receipt_hash: pawnHash };
writeFileSync(resolve(PAWN_DIR, `${pawnId}.receipt.json`), JSON.stringify(pawnReceipt, null, 2));
const pawnReceiptRead = JSON.parse(readFileSync(resolve(PAWN_DIR, `${pawnId}.receipt.json`), 'utf8'));
ok(pawnReceiptRead.status === 'COMPLETE', 'Pawn receipt status COMPLETE');
ok(pawnReceiptRead.receipt_hash === pawnHash, 'Pawn receipt_hash matches computed SHA-256 slice');
ok(pawnReceiptRead.reply === pawnReply, 'Pawn reply round-trips correctly');

// --- Rook dispatch round-trip ---
const rookId = randomUUID();
const rookRequest = { dispatch_id: rookId, session: 'B61-SMOKE', prompt: 'test rook prompt', spawn_timestamp: new Date().toISOString(), recipient: 'rook', status: 'PENDING' };
writeFileSync(resolve(ROOK_DIR, `${rookId}.request.json`), JSON.stringify(rookRequest, null, 2));
const rookPendingRead = JSON.parse(readFileSync(resolve(ROOK_DIR, `${rookId}.request.json`), 'utf8'));
ok(rookPendingRead.status === 'PENDING', 'Rook request written with status PENDING');
ok(rookPendingRead.recipient === 'rook', 'Rook recipient field correct');

const rookReply = 'Rook mock reply from gemini-2.0-flash';
const rookCompletedTs = new Date().toISOString();
const rookHash = createHash('sha256').update(JSON.stringify({ dispatchId: rookId, reply: rookReply, completedTs: rookCompletedTs })).digest('hex').slice(0, 32);
const rookReceipt = { ...rookRequest, model: 'gemini-2.0-flash', status: 'COMPLETE', reply: rookReply, completed_timestamp: rookCompletedTs, receipt_hash: rookHash };
writeFileSync(resolve(ROOK_DIR, `${rookId}.receipt.json`), JSON.stringify(rookReceipt, null, 2));
const rookReceiptRead = JSON.parse(readFileSync(resolve(ROOK_DIR, `${rookId}.receipt.json`), 'utf8'));
ok(rookReceiptRead.status === 'COMPLETE', 'Rook receipt status COMPLETE');
ok(rookReceiptRead.receipt_hash === rookHash, 'Rook receipt_hash matches computed SHA-256 slice');
ok(rookReceiptRead.model === 'gemini-2.0-flash', 'Rook model field present');

// --- Status path logic (simulates GET /yoke/pawn/status/:id) ---
const notFoundId = 'not-a-real-dispatch';
ok(!existsSync(resolve(PAWN_DIR, `${notFoundId}.receipt.json`)), 'Status 404: receipt not found for unknown id');
ok(!existsSync(resolve(PAWN_DIR, `${notFoundId}.request.json`)), 'Status 404: request not found for unknown id');

console.log(`\nB61 Phase 0 smoke test: ${passed} PASS / ${failed} FAIL`);
if (failed > 0) process.exit(1);
console.log('G0 substrate I/O pattern: VERIFIED');
