import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (Wilcoxon signed-rank card) + telos_test_inputs.html (roles, option strip).
export const WILCOXON_SIGNED_RANK: TestSpec = {
  id: 'wilcoxon-signed-rank',
  name: 'Wilcoxon signed-rank',
  question: 'nonparametric paired comparison',
  roles: [
    { id: 'conditionA', label: 'Condition A', levels: 'ordinal / interval / ratio', arity: 'exactly 1' },
    { id: 'conditionB', label: 'Condition B', levels: 'ordinal / interval / ratio', arity: 'exactly 1' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'tails', label: 'tails', value: 'two', kind: 'display' },
    // Maps to wilcox.test(correct=); matters only on the asymptotic path — the default path is EXACT at small N (spike fact 1).
    { id: 'continuity', label: 'continuity correction', value: 'on', kind: 'toggle', default: true },
  ],
  constraints: {
    roles: [
      { roleId: 'conditionA', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'conditionB', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 }, // design ruling: ≥3 complete pairs (Paired, Wilcoxon)
  },
  tables: [
    { id: 'rank-summary', domId: 'wilcoxon-rank-summary', title: 'Rank summary', // domId: '#table-rank-summary' would collide with Mann-Whitney on a combined page
      columns: [{ key: 'sign', label: 'Sign' }, { key: 'n', label: 'N' }, { key: 'meanRank', label: 'Mean rank' }, { key: 'sumRanks', label: 'Sum of ranks' }] },
    { id: 'signed-rank', title: 'Signed-rank test',
      columns: [{ key: 'v', label: 'V / W' }, { key: 'z', label: 'Z' }, { key: 'p', label: 'p' }, { key: 'r', label: 'r' }] },
  ],
  // NO tableNote: the drawn Wilcoxon card has no note under either table (design ruling; consistency test asserts the absence).
  figures: [{ caption: 'Change per case', type: 'difference' }],
  howToRead:
    'The nonparametric counterpart to the paired t-test. It ranks the size of each paired change; a p below alpha means a systematic shift ' +
    'between the two conditions, with r as the effect size. The shift maps to the median difference only when the within-pair differences are ' +
    'roughly symmetric; the sign of the median difference (or Hodges–Lehmann estimate) gives the direction.',
  // Faithful to the drawn card: the APA line reports only Z, p, r — it omits the V/W its own Table 2 shows (flagged to Benjie, built as drawn).
  apaTemplate: 'A Wilcoxon signed-rank test gave Z={z}, p {p}, r={r}.',
  rMap: 'rank(abs(d)) split by sign(d) → Table 1 (per-sign N / mean rank / sum of ranks) · wilcox.test(paired=TRUE) → V, p · coin::wilcoxsign_test() → standardized Z · effectsize::rank_biserial(paired=TRUE) → r',
  bundleFiles: ['table_rank-summary.png', 'table_signed-rank.png', 'figure_difference.png'],
}
