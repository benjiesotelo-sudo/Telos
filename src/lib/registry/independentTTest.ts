import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (Independent t-test exemplar) + telos_test_inputs.html (roles, option strip).
export const INDEPENDENT_T_TEST: TestSpec = {
  id: 'independent-t-test',
  name: 'Independent t-test',
  question: "do two groups' means differ?",
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1' },
    { id: 'group', label: 'Grouping variable', levels: 'nominal / ordinal', arity: 'exactly 1 · 2 categories' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05' },
    { id: 'tails', label: 'tails', value: 'two' },
    { id: 'equalVariance', label: 'equal variance', value: 'off · Welch' }, // drawn default: OFF → Welch runs (Benjie's ruling)
    { id: 'ci', label: 'CI', value: '95%' },
  ],
  tables: [
    { id: 'group-statistics', title: 'Group statistics',
      columns: [{ key: 'group', label: 'Group' }, { key: 'n', label: 'N' }, { key: 'mean', label: 'M' }, { key: 'sd', label: 'SD' }, { key: 'se', label: 'SE' }] },
    { id: 't-test', title: 'Independent-samples t-test',
      columns: [{ key: 'contrast', label: 'Contrast' }, { key: 't', label: 't' }, { key: 'df', label: 'df' }, { key: 'p', label: 'p' }, { key: 'mdiff', label: 'M', sub: 'diff' }, { key: 'ci', label: '95% CI' }, { key: 'd', label: 'd' }] },
  ],
  assumptionNote: "assumption check: Levene's test for equal variances; a Welch row replaces the pooled row when equal-variance is off.",
  figure: { caption: 'Distribution of the outcome by group', type: 'boxplot' },
  howToRead:
    "Asks whether two groups' averages differ by more than chance. Look at p: below alpha (e.g. .05) means significant. " +
    "The mean difference and 95% CI show the size and precision of the gap; Cohen's d gives effect size (~0.2 small, 0.5 medium, 0.8 large). " +
    "A large p means no significant difference was detected — not that the group means are equal.",
  apaTemplate:
    'An independent-samples t-test found a difference between {g1} (M={m1}, SD={sd1}) and {g2} (M={m2}, SD={sd2}), t({df})={t}, p={p}, d={d}.',
  rMap: 't.test() → Table 2 · summary → Table 1 · effectsize::cohens_d() → d · car::leveneTest() → assumption · geom_boxplot() → figure',
  bundleFiles: ['table_group-statistics.png', 'table_t-test.png', 'figure_boxplot.png'],
}
