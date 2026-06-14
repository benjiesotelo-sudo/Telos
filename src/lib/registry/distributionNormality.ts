import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (Distribution & normality card) + telos_test_inputs.html (role slot, option strip).
export const DISTRIBUTION_NORMALITY: TestSpec = {
  id: 'distribution-normality',
  name: 'Distribution & normality',
  question: 'is a variable normally distributed?',
  roles: [
    { id: 'variable', label: 'Variable(s)', levels: 'interval / ratio', arity: 'one or more' },
  ],
  options: [ // descriptive card: no α/tails/CI; both pills display-only this slice (design ruling — only μ₀ and continuity correction are interactive)
    { id: 'normalityTests', label: 'normality tests', value: 'Shapiro-Wilk + K–S', kind: 'display' },
    { id: 'bins', label: 'bins', value: 'auto', kind: 'display' },
  ],
  constraints: {
    roles: [{ roleId: 'variable', levels: ['interval', 'ratio'], arity: { min: 1, max: Infinity } }],
    minRule: { kind: 'values', n: 3 }, // Shapiro-Wilk lower bound (design §constraints: N≥3 per column)
  },
  tables: [
    { id: 'normality', title: 'Normality tests', captionStyle: 'bare', // the card prints bare "Table."
      columns: [{ key: 'variable', label: 'Variable' }, { key: 'test', label: 'Test' }, { key: 'statistic', label: 'Statistic' }, { key: 'n', label: 'N' }, { key: 'p', label: 'p' }] },
  ],
  tableNote: { kind: 'plain', text: 'skewness & kurtosis appear in the Summary statistics card; Shapiro-Wilk applies for 3–5000 cases.' },
  figures: [ // one drawn figbox, two exported files (bundle line) → two specs sharing the caption
    { caption: 'Distribution shape', type: 'histogram' },
    { caption: 'Distribution shape', type: 'qq' },
  ],
  howToRead:
    'A small p (below .05) suggests the data depart from normality. With large samples these tests over-flag trivial deviations; ' +
    'with small samples they have low power, so a p > .05 does not prove normality — it only means no departure was detected. ' +
    'Either way, judge normality mainly from the Q–Q plot — points hugging the diagonal indicate normality.',
  apaTemplate: 'Normality was assessed with the Shapiro-Wilk test, W = {w}, p {p}.',
  rMap: 'shapiro.test() (returns W, p) / nortest::lillie.test() (returns D, p) → table · ggplot2 + stat_qq() → figures',
  bundleFiles: ['table_normality.png', 'figure_histogram.png', 'figure_qq.png'],
}
