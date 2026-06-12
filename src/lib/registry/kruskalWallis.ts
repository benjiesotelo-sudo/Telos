import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Kruskal-Wallis cards) -- display strings verbatim.
export const KRUSKAL_WALLIS: TestSpec = {
  id: 'kruskal-wallis',
  name: 'Kruskal-Wallis',
  question: 'nonparametric 3+ group comparison',
  roles: [
    { id: 'outcome', label: 'Outcome', levels: 'ordinal / interval / ratio', arity: 'exactly 1',
      hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'group', label: 'Grouping var', levels: 'nominal / ordinal', arity: 'exactly 1 · 3+ categories',
      hint: 'e.g. label splitting cases into 3+ groups — teaching method' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'posthoc', label: 'post-hoc', value: "Dunn's test", kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'group', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { min: 3 } },
    ],
    minRule: { kind: 'rows-per-group', n: 3 },
  },
  tables: [
    { id: 'rank-summary', domId: 'kruskal-wallis-rank-summary', title: 'Rank summary',
      columns: [{ key: 'group', label: 'Group' }, { key: 'n', label: 'N' }, { key: 'meanRank', label: 'Mean rank' }] },
    { id: 'kruskal-wallis', title: 'Kruskal-Wallis test',
      columns: [{ key: 'h', label: 'H' }, { key: 'df', label: 'df' }, { key: 'p', label: 'p' }, { key: 'eps2', label: 'ε²' }] },
    { id: 'posthoc', domId: 'kruskal-wallis-posthoc', title: 'Dunn post-hoc',
      columns: [{ key: 'pair', label: 'Pair' }, { key: 'z', label: 'Z' }, { key: 'padj', label: 'p', sub: 'adj' }] },
  ],
  figures: [{ caption: 'Distribution by group', type: 'boxplot' }],
  howToRead:
    'The nonparametric counterpart to one-way ANOVA. The H/p tests whether any group tends to have systematically higher or lower values (stochastic dominance) — ' +
    'read it as a "median difference" only when the groups have similar distribution shapes. ' +
    "If significant, Dunn's post-hoc shows which pairs differ, with adjusted p-values. ε² is the effect size.",
  apaTemplate: 'A Kruskal-Wallis test found a difference, H({df})={h}, p={p}, ε²={eps2}.',
  rMap: 'kruskal.test() → H, df, p · rstatix::kruskal_effsize() / effectsize::rank_epsilon_squared() → ε² · dunn.test/FSA::dunnTest() → Table 3',
  bundleFiles: ['table_rank-summary.png', 'table_kruskal-wallis.png', 'table_posthoc.png', 'figure_boxplot.png'],
}
