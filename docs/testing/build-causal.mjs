// build-causal.mjs — deterministic cross-section for the causal-inference tests
// (Instrumental variables / 2SLS, Regression discontinuity, Propensity score matching).
//
// 200 rows. A SEPARATE clean outcome per method (columns are cheap, clarity is not),
// so each test has a clear, non-degenerate target. No Math.random — byte-identical.
//
//   IV : wage  <- 8*educ + 6*ability(unobserved confounder); educ <- 1.2*educ_iv + 0.8*ability.
//        educ_iv drives educ but is excluded from wage -> 2SLS on educ recovers ~8,
//        while OLS is biased upward (ability sits in the error, correlated with educ).
//        (spike: 2SLS educ ~= 7.82, first-stage F ~= 451 -- strong, valid instrument.)
//   RDD: score <- 0.3*running_var + a +10 JUMP at running_var >= 50 (cutoff 50).
//        running_var is CONTINUOUS (integer base + jitter) to avoid rdrobust mass points.
//   PSM: enroll assigned PROBABILISTICALLY (propensity vs a deterministic uniform) so the
//        treated/control groups OVERLAP on covariates (common support) and matching can
//        actually balance them. propensity rises with ability + exper; ability also
//        confounds the outcome (health <- 5*enroll + 4*ability), so the naive treated/
//        control gap is biased and matching on (exper, age, ability) recovers ATT ~5.
//
// Usage: `node docs/testing/build-causal.mjs` -> writes tests/e2e/fixtures/causal.csv
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const N = 200;
const r3 = (x) => Math.round(x * 1000) / 1000;
const jit = (n, s) => (((n * 97 + s * 13) % 41) - 20) / 20; // -1..+1 in 0.05 steps
const unif = (n) => ((n * 577) % 1000) / 1000;              // deterministic pseudo-uniform [0,1)

const rows = [['id', 'wage', 'educ', 'educ_iv', 'score', 'running_var', 'health', 'enroll', 'exper', 'age', 'ability']];
for (let n = 1; n <= N; n++) {
  const ability = 2 * jit(n, 7);                     // -2..+2 (unobserved confounder)
  const exper = 2 + (n % 28);                         // 2..29
  const age = 22 + (n % 38);                          // 22..59
  const educ_iv = 1 + (n % 5) + 0.4 * jit(n, 8);      // ~1..5 (instrument)
  const educ = 10 + 1.2 * educ_iv + 0.8 * ability + 0.5 * jit(n, 1);
  const wage = 200 + 8 * educ + 6 * ability + 3 * jit(n, 2);
  const running_var = ((n * 37) % 101) + jit(n, 9);   // continuous 0..100 (no mass points)
  const score = 50 + 0.3 * running_var + 10 * (running_var >= 50 ? 1 : 0) + 2 * jit(n, 3);
  // PSM: probabilistic treatment for common support
  const linpred = -0.7 + 0.6 * ability;
  const p = 1 / (1 + Math.exp(-linpred));
  const enroll = p > unif(n) ? 1 : 0;
  const health = 100 + 5 * enroll + 4 * ability + 2 * jit(n, 5);
  rows.push([n, r3(wage), r3(educ), r3(educ_iv), r3(score), r3(running_var), r3(health), enroll, exper, age, r3(ability)]);
}

writeFileSync(join(here, '..', '..', 'tests', 'e2e', 'fixtures', 'causal.csv'), rows.map((r) => r.join(',')).join('\n') + '\n');
console.log(`causal.csv: ${rows.length - 1} rows, ${rows[0].length} columns`);
