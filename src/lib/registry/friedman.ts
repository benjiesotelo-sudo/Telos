import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Friedman cards) — display strings verbatim.
// χ² and related entities are stored as HTML entities to match the spec HTML (strip() does not decode them).
export const FRIEDMAN: TestSpec = {
  id: 'friedman',
  name: 'Friedman',
  question: 'nonparametric repeated measures',
  roles: [
    { id: 'subject', label: 'Subject ID', levels: 'any level', arity: 'exactly 1',
      hint: 'e.g. the column identifying each person — participant_id' },
    { id: 'measures', label: 'Repeated measures', levels: 'ordinal / interval / ratio', arity: '2 or more',
      hint: 'e.g. same measure each time — score_t1, score_t2, score_t3' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'posthoc', label: 'post-hoc', value: 'Nemenyi', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'subject', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'measures', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 2, max: Infinity } },
    ],
    minRule: { kind: 'complete-wide-rows', n: 3 },
  },
  tables: [
    { id: 'rank-summary', domId: 'friedman-rank-summary', title: 'Rank summary',
      columns: [{ key: 'condition', label: 'Condition' }, { key: 'meanRank', label: 'Mean rank' }] },
    { id: 'friedman', domId: 'friedman-friedman', title: 'Friedman test',
      columns: [{ key: 'chi2', label: '&chi;&sup2;' }, { key: 'df', label: 'df' }, { key: 'p', label: 'p' }, { key: 'w', label: "Kendall's W" }] },
    { id: 'posthoc', domId: 'friedman-posthoc', title: 'Post-hoc (Nemenyi)',
      columns: [{ key: 'pair', label: 'Pair' }, { key: 'padj', label: 'p', sub: 'adj' }] },
  ],
  figures: [{ caption: 'Across conditions', type: 'profile / box plot' }],
  howToRead:
    'The nonparametric counterpart to repeated-measures ANOVA. The &chi;&sup2;/p tests whether ranks differ across conditions; Kendall\'s W is the effect size (0–1 agreement). Post-hoc shows which conditions differ.',
  apaTemplate: 'A Friedman test found a difference across conditions, &chi;&sup2;({df})={chi2}, p={p}, W={w}.',
  rMap: 'colMeans(apply(data, 1, rank)) → Table 1 (per-condition mean rank) · friedman.test() → &chi;&sup2;, df, p · rstatix::friedman_effsize() / effectsize::kendalls_w() → Kendall\'s W · PMCMRplus (Nemenyi) → Table 3',
  bundleFiles: ['table_rank-summary.png', 'table_friedman.png', 'table_posthoc.png', 'figure_profile.png'],
}
