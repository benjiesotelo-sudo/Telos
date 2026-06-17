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
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'tails', label: 'tails', value: 'two-tailed', kind: 'select', choices: ['two-tailed', 'one-tailed (greater)', 'one-tailed (less)'], hint: 'one-tailed needs a directional hypothesis set in advance' },
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
      columns: [{ key: 'p', label: 'p (exact)' }, { key: 'or', label: 'Odds ratio (cond. MLE)' }, { key: 'ci', label: '95% CI' }, { key: 'v', label: "Cramér's V [95% CI]" }] },
  ],
  tableNote: { kind: 'plain', text: "the odds ratio is fisher.test()'s conditional MLE (not the sample cross-product) and, with its CI, is reported for 2×2 tables only; for larger tables the OR is undefined, so Cramér's V (effectsize::cramers_v) reports the strength of association alongside the exact p." },
  figures: [{ caption: 'Cross-classification', type: 'mosaic / grouped bar chart', file: 'bar' }],
  howToRead:
    'An exact alternative to chi-square for small samples. A p below alpha means the two categories are associated; ' +
    "for 2×2 tables the odds ratio quantifies the association — this is fisher.test()'s conditional MLE (the " +
    'non-central hypergeometric estimate), not the sample cross-product. OR>1 means the outcome is more likely in the ' +
    'first row/group, OR<1 less likely, OR=1 no association; check the row/column order before reading direction, ' +
    "since the OR reflects the table's orientation. For tables larger than 2×2 the odds ratio is undefined, so " +
    "Cramér's V (0–1) reports the strength of association instead.",
  apaTemplate: "A Fisher's exact test of [Var1] by [Var2] gave p {p}.",
  rMap: 'fisher.test() → Table 2 · ggplot2::geom_bar() → figure',
  bundleFiles: ['table_contingency.png', 'table_fisher.png', 'figure_bar.png'],
}
