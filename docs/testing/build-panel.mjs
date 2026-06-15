// build-panel.mjs — deterministic balanced panel for the econometrics panel tests
// (Fixed effects, Random effects, Hausman, Difference-in-differences).
//
// 12 firms x 8 years (2017-2024) = 96 rows, long format. No Math.random — running
// this always produces byte-identical output, so the testing dataset never drifts.
//
//   roa[i,t] = firmFE_i  - 2.0*leverage + 1.5*rd_spend + 0.1*size
//                        + 1.5*(treated_i * post_t)   + small noise
//
// firmFE_i (the firm intercept FE absorbs) increases with i, and so does the
// rd_spend baseline — so the firm effect CORRELATES with a regressor, which makes
// fixed- and random-effects estimates differ and the Hausman test non-trivial.
// treated = firms 1-6; post = year >= 2021 -> a clean +1.5 DiD effect.
//
// Constants are first-draft; the Task-1 verification spike tunes them if any target
// (within-effect significance, FE/RE divergence, DiD jump) comes out degenerate.
// Usage: `node docs/testing/build-panel.mjs` -> writes tests/e2e/fixtures/panel.csv
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const r3 = (x) => Math.round(x * 1000) / 1000;
const jit = (i, y, s) => (((i * 131 + y * 17 + s) % 41) - 20) / 20; // -1..+1 in 0.05 steps

const rows = [['firm', 'year', 'roa', 'leverage', 'rd_spend', 'size', 'treated', 'post']];
for (let i = 1; i <= 12; i++) {
  const firm = `firm${String(i).padStart(2, '0')}`;
  const firmFE = 5 + i * 0.7;       // firm intercept (absorbed by FE)
  const levBase = 0.2 + i * 0.03;
  const rdBase = 2 + i * 0.2;       // correlates with firmFE -> FE != RE
  const sizeBase = 10 + i;
  const treated = i <= 6 ? 1 : 0;
  for (let y = 2017; y <= 2024; y++) {
    const k = y - 2017;
    const leverage = levBase + 0.05 * Math.sin(k) + 0.03 * jit(i, y, 1);
    const rd_spend = rdBase + 0.3 * k + 0.2 * jit(i, y, 2);
    const size = sizeBase + 0.5 * k + 0.2 * jit(i, y, 3);
    const post = y >= 2021 ? 1 : 0;
    const noise = 0.4 * jit(i, y, 4);
    const roa = firmFE - 2.0 * leverage + 1.5 * rd_spend + 0.1 * size + 1.5 * (treated * post) + noise;
    rows.push([firm, y, r3(roa), r3(leverage), r3(rd_spend), r3(size), treated, post]);
  }
}

writeFileSync(join(here, '..', '..', 'tests', 'e2e', 'fixtures', 'panel.csv'), rows.map((r) => r.join(',')).join('\n') + '\n');
console.log(`panel.csv: ${rows.length - 1} rows, ${rows[0].length} columns`);
