import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Welch's ANOVA cards) — display strings verbatim.
export const WELCH_ANOVA: TestSpec = {
  id: 'welch-anova',
  name: "Welch's ANOVA",
  question: '3+ groups, unequal variances',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1',
      hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'factor', label: 'Factor', levels: 'nominal / ordinal', arity: 'exactly 1 · 3+ categories',
      hint: 'e.g. a grouping label — teaching method' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'posthoc', label: 'post-hoc', value: 'Games-Howell', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'factor', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { min: 3 } },
    ],
    minRule: { kind: 'rows-per-group', n: 3 },
  },
  tables: [
    { id: 'descriptives', domId: 'welch-anova-descriptives', title: 'Descriptives by group',
      columns: [{ key: 'group', label: 'Group' }, { key: 'n', label: 'N' }, { key: 'm', label: 'M' }, { key: 'sd', label: 'SD' }] },
    { id: 'welch-anova', domId: 'welch-anova-welch-anova', title: "Welch's ANOVA",
      columns: [{ key: 'f', label: 'F' }, { key: 'df1', label: 'df1' }, { key: 'df2', label: 'df2' }, { key: 'p', label: 'p' }] },
    { id: 'posthoc', domId: 'welch-anova-posthoc', title: 'Games-Howell post-hoc',
      columns: [{ key: 'pair', label: 'Pair' }, { key: 'mdiff', label: 'M', sub: 'diff' }, { key: 'padj', label: 'p', sub: 'adj' }, { key: 'ci', label: '95% CI' }] },
  ],
  tableNote: { kind: 'plain', text: "Welch's adjusts the degrees of freedom so equal variances are not assumed (df2 is fractional)." },
  figures: [{ caption: 'Group means', type: 'means plot with 95% CI error bars' , file: 'means-plot' }],
  howToRead:
    'A one-way ANOVA that relaxes the equal-variance assumption but still assumes roughly normal data within each group. ' +
    'A significant F means at least one group mean differs from the others; the Games-Howell post-hoc (also variance-robust) then shows which specific pairs differ.',
  apaTemplate: "Welch's ANOVA gave F({df1},{df2})={f}, p {p}.",
  rMap: 'oneway.test(var.equal=FALSE) → Table 2 · rstatix::games_howell_test() → Table 3',
  bundleFiles: ['table_descriptives.png', 'table_welch-anova.png', 'table_posthoc.png', 'figure_means-plot.png'],
}
