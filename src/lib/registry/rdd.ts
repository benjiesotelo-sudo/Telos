import type { TestSpec } from './types'

// modelsummary coef table (design 2026-06-16): ONE stacked coef table replaces the old wide RD-estimate row.
// One estimand → one 'RD treatment effect' term row: estimate / (SE) / [CI] stacked (z/p drop from the visible cell).
// GOF footer = Bandwidth + N (left) + N (right); rdrobust has NO R²/AIC/BIC/Log.Lik. method (local nonparametric).
// Report-only APA (drawn "treatment effect was" wording neutral; templated, CI literal 95%).
// Drawn table note carries the robust bias-corrected inference labeling; McCrary caveat stays in howToRead.
export const RDD: TestSpec = {
  id: 'rdd',
  name: 'Regression discontinuity (RDD)',
  question: 'effect at a cutoff',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'running', label: 'Running variable', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the score that decides the cutoff — exam mark' },
  ],
  options: [
    { id: 'cutoff', label: 'cutoff value', value: '50', kind: 'number', default: 50 },
    { id: 'bandwidth', label: 'bandwidth', value: 'auto', kind: 'display' },
    { id: 'poly', label: 'polynomial order', value: '1 · linear', kind: 'select', choices: ['1 · linear', '2 · quadratic'] },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, excludeTag: 'datetime' },
      { roleId: 'running', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, excludeTag: 'datetime' },
    ],
    minRule: { kind: 'values', n: 20 },
  },
  // modelsummary coef table: single model column (1); one term row; GOF footer = bandwidth + effective N on each side.
  tables: [
    {
      id: 'rd-estimate', title: 'RD estimate', domId: 'rd-estimate', captionStyle: 'bare', kind: 'coef',
      columns: [{ key: 'term', label: '' }, { key: 'est', label: '(1)' }],
      models: [{ key: 'est', label: '(1)' }],
      gof: [{ key: 'bandwidth', label: 'Bandwidth' }, { key: 'nleft', label: 'N (left)' }, { key: 'nright', label: 'N (right)' }],
    },
  ],
  tableNote: { kind: 'plain', text: 'inference is robust (bias-corrected): the SE / CI use rdrobust robust standard errors. Bandwidth selector: MSE-optimal (mserd); kernel: triangular.' },
  figures: [{ caption: 'Discontinuity', type: 'RD plot (binned scatter + fitted lines either side of the cutoff)', file: 'rd-plot' }],
  howToRead:
    'Estimates the jump in the outcome right at the cutoff — the estimate is the treatment effect for cases near the threshold. p/CI assess it; the RD plot shows the discontinuity visually. The jump is causal only if subjects cannot control which side of the cutoff they land on and nothing else changes at the same threshold — the footer reports the McCrary density test (a small p flags sorting/manipulation at the cutoff); also run covariate-balance / placebo checks. Method: R rdrobust package (Calonico, Cattaneo & Titiunik, 2014, 2015).',
  apaTemplate: 'At the cutoff, the treatment effect was {b}, 95% CI [{lo}, {hi}], p {p}.',
  rMap: 'rdrobust::rdrobust() → table · rdrobust::rdplot() → figure',
  bundleFiles: ['table_rd-estimate.png', 'figure_rd-plot.png'],
}
