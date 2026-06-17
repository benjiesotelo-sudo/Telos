import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Kendall's tau cards) — display strings verbatim.
export const KENDALLS_TAU: TestSpec = {
  id: 'kendalls-tau',
  name: "Kendall's tau",
  question: 'rank association, robust to ties',
  roles: [
    { id: 'variableA', label: 'Variable A', levels: 'ordinal / interval / ratio', arity: 'exactly 1' },
    { id: 'variableB', label: 'Variable B', levels: 'ordinal / interval / ratio', arity: 'exactly 1' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'tails', label: 'tails', value: 'two-tailed', kind: 'select', choices: ['two-tailed', 'one-tailed (greater)', 'one-tailed (less)'], hint: 'one-tailed needs a directional hypothesis set in advance' },
  ],
  constraints: {
    roles: [
      { roleId: 'variableA', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'variableB', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 },
  },
  tables: [
    { id: 'correlation', title: "Kendall's tau", captionStyle: 'bare', domId: 'kendalls-tau-correlation',
      columns: [{ key: 'pair', label: 'Pair' }, { key: 'tau', label: 'τ [95% CI]' }, { key: 'z', label: 'z' }, { key: 'p', label: 'p' }, { key: 'n', label: 'N' }] },
  ],
  figures: [{ caption: 'Relationship', type: 'scatter plot (optionally on ranks — τ measures monotonic, not linear, association)', file: 'scatter' }],
  howToRead:
    'τ is a rank correlation based on concordant vs. discordant pairs — well suited to small samples and many ties. ' +
    'Sign = direction, magnitude = strength; p tests significance.',
  apaTemplate: "A Kendall's tau correlation gave τ={tau} [{lo}, {hi}], p {p}, N={n}.",
  rMap: 'cor.test(method="kendall") → table · ggplot2 → figure',
  bundleFiles: ['table_correlation.png', 'figure_scatter.png'],
}
