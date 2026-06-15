import type { TestSpec } from './types'

// Encoded VERBATIM from telos_test_outputs.html + telos_test_inputs.html (Regression discontinuity card).
// Report-only APA (drawn "treatment effect was" wording neutral; templated, CI literal 95%).
// rdrobust auto bandwidth; the single RD-estimate row = Conventional point estimate + Robust inference (SE/z/p/CI).
// No drawn table note — McCrary caveat lives in howToRead only.
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
  tables: [
    {
      id: 'rd-estimate', title: 'RD estimate', domId: 'rd-estimate', captionStyle: 'bare',
      columns: [
        { key: 'bandwidth', label: 'Bandwidth' }, { key: 'estimate', label: 'Estimate' }, { key: 'se', label: 'SE' },
        { key: 'z', label: 'z' }, { key: 'p', label: 'p' }, { key: 'ci', label: '95% CI' }, { key: 'n', label: 'N (left/right)' },
      ],
    },
  ],
  figures: [{ caption: 'Discontinuity', type: 'RD plot (binned scatter + fitted lines either side of the cutoff)', file: 'rd-plot' }],
  howToRead:
    'Estimates the jump in the outcome right at the cutoff — the estimate is the treatment effect for cases near the threshold. p/CI assess it; the RD plot shows the discontinuity visually. The jump is causal only if subjects cannot control which side of the cutoff they land on and nothing else changes at the same threshold — check a density (McCrary) test for sorting and covariate-balance / placebo checks.',
  apaTemplate: 'At the cutoff, the treatment effect was {b}, 95% CI [{lo}, {hi}], p {p}.',
  rMap: 'rdrobust::rdrobust() → table · rdrobust::rdplot() → figure',
  bundleFiles: ['table_rd-estimate.png', 'figure_rd-plot.png'],
}
