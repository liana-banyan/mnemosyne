// substrate-market-stripe.test.ts
// Unit tests for substrate-market-stripe canonical fee computation

import { computeApplicationFee } from './substrate-market-stripe';

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
