import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Regression discontinuity card).
// Report-only APA (drawn "treatment effect was" wording neutral; templated, CI threaded). rdrobust auto
// bandwidth; the single RD-estimate row = Conventional point estimate + Robust inference (SE/z/p/CI).
export const RDD: TestSpec = {
  id: 'rdd',
  name: 'Regression discontinuity (RDD)',
  question: 'a treatment effect at a cutoff in a running variable',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the numeric result — score, earnings' },
    { id: 'running', label: 'Running variable', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the variable whose cutoff assigns treatment — test score, age' },
  ],
  options: [
    { id: 'cutoff', label: 'cutoff value', value: '50', kind: 'number', default: 50 },
    { id: 'bandwidth', label: 'bandwidth', value: 'auto', kind: 'display' },
    { id: 'poly', label: 'polynomial order', value: '1', kind: 'select', choices: ['1', '2'] },
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'ci', label: 'CI', value: '95%', kind: 'select', choices: ['90%', '95%', '99%'] },
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
      id: 'rd-estimate', title: 'RD estimate', domId: 'rd-estimate',
      columns: [
        { key: 'bandwidth', label: 'Bandwidth' }, { key: 'estimate', label: 'Estimate' }, { key: 'se', label: 'SE' },
        { key: 'z', label: 'z' }, { key: 'p', label: 'p' }, { key: 'ci', label: '95% CI' }, { key: 'n', label: 'N (left/right)' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'The jump is causal only if subjects cannot control which side of the cutoff they land on and nothing else changes at the same threshold — check a density (McCrary) test for sorting and covariate-balance / placebo checks.',
    afterTableId: 'rd-estimate',
  },
  figures: [{ caption: 'RD plot', type: 'binned scatter + fitted lines either side of the cutoff', file: 'rd-plot' }],
  howToRead:
    'Estimates the jump in the outcome right at the cutoff — the estimate is the treatment effect for cases near the threshold. p/CI assess it; the RD plot shows the discontinuity visually. The jump is causal only if subjects cannot control which side of the cutoff they land on and nothing else changes at the same threshold — check a density (McCrary) test for sorting and covariate-balance / placebo checks.',
  apaTemplate: 'At the cutoff, the RD estimate was {b}, {pct}% CI [{lo}, {hi}], p {p}.',
  rMap: 'rdrobust::rdrobust(y, x, c=cutoff) → estimate (Conventional point + Robust inference) · rdrobust::rdplot → figure',
  bundleFiles: ['table_rd-estimate.png', 'figure_rd-plot.png'],
}
