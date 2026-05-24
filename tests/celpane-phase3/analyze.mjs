// CelPane Phase 3 Analysis — read raw_runs.jsonl, compute medians, ratios, bootstrap CIs.
// Output: summary.csv, ratios.csv, and prints a verdict block to stdout.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = resolve(__dirname, '..', '..', '..', 'BISHOP_DROPZONE', '14_CanonicalReferences', 'CELPANE_PHASE3_RAW_DATA_BP030');
const RAW_FILE = join(RAW_DIR, 'raw_runs.jsonl');
const SUM_CSV = join(RAW_DIR, 'summary.csv');
const RAT_CSV = join(RAW_DIR, 'ratios.csv');

if (!fs.existsSync(RAW_FILE)) {
  console.error(`[analyze] no raw file: ${RAW_FILE}`);
  process.exit(1);
}
const lines = fs.readFileSync(RAW_FILE, 'utf8').trim().split(/\r?\n/);
const records = lines.map(l => JSON.parse(l));
console.log(`[analyze] loaded ${records.length} records`);

function median(arr) {
  const a = [...arr].sort((x,y)=>x-y);
  const n = a.length; if (n===0) return NaN;
  return n%2 ? a[(n-1)/2] : (a[n/2-1]+a[n/2])/2;
}
function mad(arr) {
  const m = median(arr);
  return median(arr.map(x => Math.abs(x-m)));
}
function trimmedMean(arr, frac=0.1) {
  const a = [...arr].sort((x,y)=>x-y);
  const cut = Math.floor(a.length*frac);
  const t = a.slice(cut, a.length-cut);
  return t.reduce((s,x)=>s+x,0)/t.length;
}
function quantile(arr, q) {
  const a = [...arr].sort((x,y)=>x-y);
  const i = (a.length-1)*q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo===hi ? a[lo] : a[lo] + (a[hi]-a[lo])*(i-lo);
}
// Bootstrap CI for median ratio: resample baseline & substrate independently
function bootstrapMedianRatio(baseArr, subArr, B=10000) {
  const ratios = [];
  for (let b=0; b<B; b++) {
    const bs = []; const sub = [];
    for (let i=0;i<baseArr.length;i++) bs.push(baseArr[Math.floor(Math.random()*baseArr.length)]);
    for (let i=0;i<subArr.length;i++) sub.push(subArr[Math.floor(Math.random()*subArr.length)]);
    const mb = median(bs); const ms = median(sub);
    if (ms > 0) ratios.push(mb / ms);
  }
  ratios.sort((x,y)=>x-y);
  return { lo: ratios[Math.floor(0.025*ratios.length)], hi: ratios[Math.floor(0.975*ratios.length)] };
}
// Mann-Whitney U one-sided: H1 substrate < baseline (substrate faster)
function mannWhitneyU(baseArr, subArr) {
  // Compute U and z-score (normal approximation for n>=20)
  const all = [];
  for (const x of baseArr) all.push({ v: x, g: 'b' });
  for (const x of subArr) all.push({ v: x, g: 's' });
  all.sort((a,b)=>a.v-b.v);
  // Assign ranks (handle ties with average rank)
  let i = 0;
  while (i < all.length) {
    let j = i;
    while (j+1 < all.length && all[j+1].v === all[i].v) j++;
    const r = (i + j) / 2 + 1;
    for (let k=i; k<=j; k++) all[k].rank = r;
    i = j+1;
  }
  let R1 = 0; for (const x of all) if (x.g === 'b') R1 += x.rank;
  const n1 = baseArr.length, n2 = subArr.length;
  const U1 = R1 - n1*(n1+1)/2;
  const U2 = n1*n2 - U1;
  // For "substrate faster" (substrate values smaller), expect U1 large, U2 small
  const U = U2; // smaller U
  const mu = n1*n2/2;
  const sigma = Math.sqrt(n1*n2*(n1+n2+1)/12);
  const z = (U - mu) / sigma;
  // One-sided p (upper tail of |z|)
  const p = 0.5 * (1 - erf(Math.abs(z) / Math.sqrt(2)));
  return { U, z, p };
}
function erf(x) {
  // Abramowitz & Stegun
  const sign = x<0?-1:1; x = Math.abs(x);
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const t = 1/(1+p*x);
  const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t * Math.exp(-x*x);
  return sign*y;
}

// Per-category: pick the headline metric
const HEADLINE = {
  cold: 'total_ms',
  warm: 'mean_frame_ms',
  update: 'mean_update_ms',
  borrow: 'mean_borrow_ms',
};

const summaryRows = [['category','impl','n','median','mad','p95','trimmed_mean']];
const ratioRows = [['category','metric','baseline_median','substrate_median','ratio','ci_lo','ci_hi','mw_z','mw_p','pass_10x']];

const verdict = [];
let categoriesPassed = 0;

for (const cat of ['cold','warm','update','borrow']) {
  const metric = HEADLINE[cat];
  const base = records.filter(r => r.category===cat && r.implementation==='baseline' && typeof r[metric]==='number').map(r => r[metric]);
  const sub  = records.filter(r => r.category===cat && r.implementation==='substrate' && typeof r[metric]==='number').map(r => r[metric]);
  if (base.length===0 || sub.length===0) {
    console.log(`[analyze] SKIP category=${cat} base=${base.length} sub=${sub.length}`);
    continue;
  }
  const mb = median(base), ms = median(sub);
  summaryRows.push([cat,'baseline',base.length, mb.toFixed(3), mad(base).toFixed(3), quantile(base,0.95).toFixed(3), trimmedMean(base).toFixed(3)]);
  summaryRows.push([cat,'substrate',sub.length, ms.toFixed(3), mad(sub).toFixed(3), quantile(sub,0.95).toFixed(3), trimmedMean(sub).toFixed(3)]);
  const ratio = ms > 0 ? mb / ms : NaN;
  const { lo, hi } = bootstrapMedianRatio(base, sub, 5000);
  const mw = mannWhitneyU(base, sub);
  const pass = ratio >= 10 ? 1 : 0;
  if (pass) categoriesPassed++;
  ratioRows.push([cat, metric, mb.toFixed(3), ms.toFixed(3), ratio.toFixed(3), lo.toFixed(3), hi.toFixed(3), mw.z.toFixed(3), mw.p.toExponential(3), pass]);
  verdict.push(`  ${cat.padEnd(8)} ${metric.padEnd(18)}: baseline=${mb.toFixed(2)}ms substrate=${ms.toFixed(2)}ms ratio=${ratio.toFixed(2)}x  CI[${lo.toFixed(2)}, ${hi.toFixed(2)}]  p=${mw.p.toExponential(2)}  ${pass?'PASS-10x':(ratio>=5?'5x band':'FAIL-10x')}`);
}

fs.writeFileSync(SUM_CSV, summaryRows.map(r=>r.join(',')).join('\n'));
fs.writeFileSync(RAT_CSV, ratioRows.map(r=>r.join(',')).join('\n'));

console.log('\n=== VERDICT ===');
verdict.forEach(v => console.log(v));
console.log(`\ncategories_passed_10x = ${categoriesPassed}/4`);
console.log(`OVERALL: ${categoriesPassed >= 3 ? 'PASS (>=3 of 4 categories at 10x)' : 'FAIL-10x THRESHOLD (claim language adjusts to measured ratios)'}`);
console.log(`\nsummary: ${SUM_CSV}`);
console.log(`ratios:  ${RAT_CSV}`);

// Emit machine-readable verdict
fs.writeFileSync(join(RAW_DIR, 'verdict.json'), JSON.stringify({
  categories_passed_10x: categoriesPassed,
  overall_pass: categoriesPassed >= 3,
  per_category: ratioRows.slice(1).map(r => ({
    category: r[0], metric: r[1], baseline_median: parseFloat(r[2]), substrate_median: parseFloat(r[3]),
    ratio: parseFloat(r[4]), ci_lo: parseFloat(r[5]), ci_hi: parseFloat(r[6]),
    mw_z: parseFloat(r[7]), mw_p: r[8], pass_10x: !!r[9]
  })),
  generated_at: new Date().toISOString(),
}, null, 2));
