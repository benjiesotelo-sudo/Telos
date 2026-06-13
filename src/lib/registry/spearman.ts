import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Spearman correlation cards) — display strings verbatim.
export const SPEARMAN: TestSpec = {
  id: 'spearman',
  name: 'Spearman correlation',
  question: 'rank association (ordinal / monotonic)',
  roles: [
    { id: 'variableA', label: 'Variable A', levels: 'ordinal / interval / ratio', arity: 'exactly 1' },
    { id: 'variableB', label: 'Variable B', levels: 'ordinal / interval / ratio', arity: 'exactly 1' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'tails', label: 'tails', value: 'two', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'variableA', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'variableB', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 },
  },
  tables: [
    { id: 'correlation', title: 'Spearman correlation', captionStyle: 'bare', domId: 'spearman-correlation',
      columns: [{ key: 'pair', label: 'Pair' }, { key: 'rho', label: 'ρ' }, { key: 's', label: 'S' }, { key: 'p', label: 'p' }, { key: 'n', label: 'N' }] },
  ],
  tableNote: { kind: 'plain', text: 'no confidence interval — cor.test does not return one for rank correlation.' },
  figures: [{ caption: 'Relationship', type: 'scatter plot (optionally on ranks)', file: 'scatter' }],
  howToRead:
    'ρ measures how well the relationship follows a consistent up-or-down trend (monotonic), using ranks. ' +
    "Read sign and magnitude like Pearson's r; p tests significance.",
  apaTemplate: 'A Spearman correlation gave ρ={rho}, p {p}, N={n}.',
  rMap: 'cor.test(method="spearman") → table · ggplot2 → figure',
  bundleFiles: ['table_correlation.png', 'figure_scatter.png'],
}
