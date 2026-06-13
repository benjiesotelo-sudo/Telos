import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Mann-Whitney U cards) — display strings verbatim.
export const MANN_WHITNEY_U: TestSpec = {
  id: 'mann-whitney-u',
  name: 'Mann-Whitney U',
  question: 'nonparametric two-group comparison',
  roles: [
    { id: 'outcome', label: 'Outcome', levels: 'ordinal / interval / ratio', arity: 'exactly 1' },
    { id: 'group', label: 'Grouping var', levels: 'nominal / ordinal', arity: 'exactly 1 · 2 categories' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'tails', label: 'tails', value: 'two', kind: 'display' },
    // Drawn ON. Maps to wilcox.test correct= — only effective on the asymptotic path (spike fact 1).
    { id: 'continuity', label: 'continuity correction', value: 'on', kind: 'toggle', default: true },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'group', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { exact: 2 } },
    ],
    minRule: { kind: 'rows-per-group', n: 3 }, // design §4: same DRAFT rule as the t-test
  },
  tables: [
    { id: 'rank-summary', title: 'Rank summary',
      columns: [{ key: 'group', label: 'Group' }, { key: 'n', label: 'N' }, { key: 'meanRank', label: 'Mean rank' }, { key: 'sumRanks', label: 'Sum of ranks' }] },
    { id: 'mann-whitney', title: 'Mann-Whitney test',
      columns: [{ key: 'u', label: 'U' }, { key: 'z', label: 'Z' }, { key: 'p', label: 'p' }, { key: 'r', label: 'r' }] },
  ],
  tableNote: { kind: 'plain', text: 'r is the rank-biserial effect size.' },
  figures: [{ caption: 'Distribution by group', type: 'boxplot' }],
  howToRead:
    'The nonparametric counterpart to the independent t-test, comparing whole distributions via ranks rather than means. ' +
    "A p below alpha means one group's values tend to be systematically higher or lower (stochastic dominance) — " +
    'this equals a difference in medians only when the two groups have similar distribution shapes. r gives the effect size.',
  apaTemplate: 'A Mann-Whitney U test gave U={u}, Z={z}, p {p}, r={r}.',
  rMap: 'dplyr rank + group_by/summarise (N, mean rank, sum of ranks) → Table 1 · wilcox.test() → U, p · coin::wilcox_test() → standardized Z · effectsize::rank_biserial() → r · geom_boxplot() → figure',
  bundleFiles: ['table_rank-summary.png', 'table_mann-whitney.png', 'figure_boxplot.png'],
}
