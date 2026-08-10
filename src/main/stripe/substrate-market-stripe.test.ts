// substrate-market-stripe.test.ts
// Unit tests for substrate-market-stripe canonical fee computation
//
// NOTE ON require() vs import (D-BP151-039): this file previously used ESM `import` syntax
// against an extensionless sibling path (`from './substrate-market-stripe'`). Node's native
// TypeScript type-stripping resolves `import` via strict ESM rules, which do NOT probe the
// `.ts` extension the way tsc's own moduleResolution does -- this threw ERR_MODULE_NOT_FOUND
// on every run (confirmed empirically this session), even though `substrate-market-stripe.ts`
// itself has zero sibling .ts imports and is otherwise directly `require()`-able with zero
// build step. Mirrors this tree's own prior-art convention (src/main/crystal/crystal_store.test.ts,
// src/main/rooting_rule.test.ts): plain `require()` with an explicit `.ts` extension.

const { computeApplicationFee } = require('./substrate-market-stripe.ts') as typeof import('./substrate-market-stripe');

// Assert: computeApplicationFee(10000) === 1670 (16.7% of $100.00)
const result = computeApplicationFee(10000);
if (result !== 1670) {
  throw new Error(`computeApplicationFee(10000) expected 1670, got ${result}`);
}
console.log(`computeApplicationFee(10000) = ${result} -- PASS`);

// Additional boundary checks
const fee500 = computeApplicationFee(500);
const expected500 = Math.round(500 * 0.167); // 84
if (fee500 !== expected500) {
  throw new Error(`computeApplicationFee(500) expected ${expected500}, got ${fee500}`);
}
console.log(`computeApplicationFee(500) = ${fee500} -- PASS`);

const fee0 = computeApplicationFee(0);
if (fee0 !== 0) {
  throw new Error(`computeApplicationFee(0) expected 0, got ${fee0}`);
}
console.log(`computeApplicationFee(0) = ${fee0} -- PASS`);

console.log('All computeApplicationFee tests passed.');
