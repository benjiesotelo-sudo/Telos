import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Pearson correlation cards) — display strings verbatim.
export const PEARSON: TestSpec = {
  id: 'pearson',
  name: 'Pearson correlation',
  question: 'linear association of two numeric variables',
  roles: [
    { id: 'variableA', label: 'Variable A', levels: 'interval / ratio', arity: 'exactly 1' },
    { id: 'variableB', label: 'Variable B', levels: 'interval / ratio', arity: 'exactly 1' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'tails', label: 'tails', value: 'two-tailed', kind: 'select', choices: ['two-tailed', 'one-tailed (greater)', 'one-tailed (less)'], hint: 'one-tailed needs a directional hypothesis set in advance' },
    { id: 'ci', label: 'CI', value: '95%', kind: 'select', choices: ['90%', '95%', '99%'] },
  ],
  constraints: {
    roles: [
      { roleId: 'variableA', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'variableB', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 }, // r needs df = n−2 ≥ 1
  },
  tables: [
    { id: 'correlation', title: 'Pearson correlation', captionStyle: 'bare', domId: 'pearson-correlation', // three correlation cards share id 'correlation' (zip keeps it; DOM must not collide)
      columns: [{ key: 'pair', label: 'Pair' }, { key: 'r', label: 'r' }, { key: 'ci', label: '95% CI' }, { key: 't', label: 't' }, { key: 'df', label: 'df' }, { key: 'p', label: 'p' }, { key: 'n', label: 'N' }] },
  ],
  figures: [{ caption: 'Relationship', type: 'scatter plot with fitted line', file: 'scatter' }],
  howToRead:
    'r ranges from −1 to +1: the sign is the direction, the magnitude the strength (~.1 small, .3 medium, .5 large). ' +
    'p tests whether it differs from zero; the 95% CI shows the precision. r measures only linear association — ' +
    'a strong curved relationship can give r near 0, and r is sensitive to outliers, so always inspect the scatterplot ' +
    "(use Spearman's rs for monotonic-but-nonlinear or outlier-affected data). Correlation does not imply causation.",
  apaTemplate: '[X] and [Y] were correlated, r({df})={r}, p {p}, 95% CI [{ciLow}, {ciHigh}].',
  rMap: 'cor.test() → table · geom_point()+geom_smooth(method="lm") → figure',
  bundleFiles: ['table_correlation.png', 'figure_scatter.png'],
}
