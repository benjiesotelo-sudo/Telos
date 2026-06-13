import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Fisher's exact cards) — display strings
// verbatim, AFTER the Task-1 R2 amendment (figure_bar.png bundle + ggplot2::geom_bar R map).
export const FISHERS_EXACT: TestSpec = {
  id: 'fishers-exact',
  name: "Fisher's exact",
  question: 'exact test for small categorical tables',
  roles: [
    { id: 'rowVar', label: 'Row variable', levels: 'nominal / ordinal', arity: 'exactly 1' },
    { id: 'colVar', label: 'Column variable', levels: 'nominal / ordinal', arity: 'exactly 1' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'tails', label: 'tails', value: 'two', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'rowVar', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { min: 2 } },
      { roleId: 'colVar', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { min: 2 } },
    ],
    minRule: { kind: 'used-columns', n: 2 },
  },
  tables: [
    { id: 'contingency', title: 'Contingency', domId: 'fishers-exact-contingency',
      columns: [{ key: 'rowcat', label: 'Row \\ Column' }, { key: 'c0', label: 'Col 1' }, { key: 'c1', label: 'Col 2' }, { key: 'total', label: 'Total' }] },
    { id: 'fisher', title: "Fisher's exact test",
      columns: [{ key: 'p', label: 'p (exact)' }, { key: 'or', label: 'Odds ratio' }, { key: 'ci', label: '95% CI' }] },
  ],
  tableNote: { kind: 'plain', text: 'odds ratio & CI are reported for 2×2 tables only; larger tables report the exact p only.' },
  figures: [{ caption: 'Cross-classification', type: 'mosaic / grouped bar chart', file: 'bar' }],
  howToRead:
    'An exact alternative to chi-square for small samples. A p below alpha means the two categories are associated; ' +
    'for 2×2 tables the odds ratio quantifies the association — OR>1 means the outcome is more likely in the first ' +
    'row/group, OR<1 less likely, OR=1 no association. Check the row/column order before reading direction, ' +
    "since the OR reflects the table's orientation.",
  apaTemplate: "A Fisher's exact test of [Var1] by [Var2] gave p {p}.",
  rMap: 'fisher.test() → Table 2 · ggplot2::geom_bar() → figure',
  bundleFiles: ['table_contingency.png', 'table_fisher.png', 'figure_bar.png'],
}
