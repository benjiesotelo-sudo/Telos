// build-tourism-esg.mjs - W4: a tourist ESG-perception / behavioral-intention survey, extending the
// sem-moderation.csv world (sn/ta/ti) with plain-language construct names and two more constructs.
// 400 respondents, 5 latent constructs, 19 items + 5 observed composite scores. Deterministic -
// no Math.random, byte-identical on every run. Continuous, roughly standardized item scores (same
// style as scale.csv / sem-moderation.csv), NOT integer Likert - lavaan/seminr treat them as
// continuous indicators.
//
// Domain: does a tourist's perception of a destination's ESG practices (esg), subjective norm
// (norm), and perceived service quality (service_quality) predict their intention to return
// (intent) - and does the tourist's own environmental attitude (attitude) MODERATE the norm ->
// intent path? Attitude also carries its own main effect on intent (mirroring the reference
// paper's Travel Attitude construct, and the spike's DGP recipe in
// .superpowers/sdd/spike-moderation/gen-moderation-data.mjs: main effect .3 + interaction .15) -
// without it, attitude is connected to the rest of the model ONLY through a mean-zero product
// term, which starves PLS mode-A weight estimation of any real structural signal and produces a
// degenerate (negative rhoA) construct. Population model (per respondent, xi_* are independent
// ~N(0,1) exogenous factors):
//
//   F_intent = 0.40*xi_esg + 0.35*xi_norm + 0.28*xi_sq + 0.30*xi_att + 0.15*(xi_norm*xi_att) + 0.75*residual
//
// Each item is loading*factor + sqrt(1-loading^2)*unique-error (loadings ~0.75-0.85, a congeneric
// model) - items load cleanly on their OWN factor only; the cross-construct correlation lives at
// the structural level (as in any real SEM), moderate enough (~0.3-0.4) that EFA on the esg/norm/
// intent items still recovers 3 clean factors under oblique rotation. Composite score columns
// (mean of each construct's items) are included for the path-analysis card (observed variables,
// no measurement model).
//
// Usage: `node tests/docs/fixtures-src/build-tourism-esg.mjs` -> writes tests/e2e/fixtures/tourism-esg.csv
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const N = 400
const r5 = (x) => Math.round(x * 100000) / 100000
function hash01(n, s) {
  let h = (Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(s ^ 0xc2b2ae35, 0x27d4eb2f)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 2246822519)
  h ^= h >>> 13
  h = Math.imul(h, 3266489917)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
const jit = (n, s) => hash01(n, s) * 2 - 1 // -1..+1

// Approximate standard normal via a sum of 6 independent jitter draws (CLT), variance-normalized
// (each jit ~ Uniform(-1,1), Var = 1/3; sum of 6 has Var = 2 -> divide by sqrt(2)).
const normalish = (n, seed) => {
  let s = 0
  for (let k = 0; k < 6; k++) s += jit(n, seed * 13 + k)
  return s / Math.SQRT2
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length

// item = loading*factor + sqrt(1-loading^2)*uniqueError
const item = (factor, loading, uniqueErr) => loading * factor + Math.sqrt(1 - loading * loading) * uniqueErr

const ESG_L = [0.82, 0.78, 0.80, 0.76]
const NORM_L = [0.81, 0.77, 0.83, 0.79]
const INTENT_L = [0.84, 0.80, 0.82]
const ATT_L = [0.79, 0.83, 0.77, 0.81]
const SQ_L = [0.80, 0.76, 0.82, 0.78]

const header = [
  'esg1', 'esg2', 'esg3', 'esg4',
  'norm1', 'norm2', 'norm3', 'norm4',
  'intent1', 'intent2', 'intent3',
  'attitude1', 'attitude2', 'attitude3', 'attitude4',
  'service_quality1', 'service_quality2', 'service_quality3', 'service_quality4',
  'esg_score', 'norm_score', 'intent_score', 'attitude_score', 'service_quality_score',
]
const rows = [header]

for (let n = 1; n <= N; n++) {
  const xiEsg = normalish(n, 100)
  const xiNorm = normalish(n, 200)
  const xiAtt = normalish(n, 300)
  const xiSq = normalish(n, 400)
  const residual = normalish(n, 500)
  const fIntent = 0.40 * xiEsg + 0.35 * xiNorm + 0.28 * xiSq + 0.30 * xiAtt + 0.15 * (xiNorm * xiAtt) + 0.75 * residual

  const esg = ESG_L.map((l, k) => item(xiEsg, l, normalish(n, 110 + k)))
  const norm = NORM_L.map((l, k) => item(xiNorm, l, normalish(n, 210 + k)))
  const intent = INTENT_L.map((l, k) => item(fIntent, l, normalish(n, 510 + k)))
  const attitude = ATT_L.map((l, k) => item(xiAtt, l, normalish(n, 310 + k)))
  const sq = SQ_L.map((l, k) => item(xiSq, l, normalish(n, 410 + k)))

  rows.push([
    ...esg, ...norm, ...intent, ...attitude, ...sq,
    mean(esg), mean(norm), mean(intent), mean(attitude), mean(sq),
  ].map(r5))
}

writeFileSync(join(here, '..', '..', '..', 'tests', 'e2e', 'fixtures', 'tourism-esg.csv'), rows.map((r) => r.join(',')).join('\n') + '\n')
console.log(`tourism-esg.csv: ${rows.length - 1} rows, ${rows[0].length} columns`)
