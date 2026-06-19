import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Cronbach's alpha cards) — display strings verbatim.
// Convention: McDonald's ω is the headline reliability coefficient (McNeish 2018); Cronbach's α is retained as a
// secondary/legacy column. Both reported with a shared 95% CI block (the CI row covers ω; α CI not separately shown
// on the output card). This is the first SEM-slice card — the template all others in the slice copy.
export const CRONBACHS_ALPHA: TestSpec = {
  id: 'cronbachs-alpha',
  name: "Cronbach's alpha",
  question: 'internal consistency of one scale',
  roles: [
    { id: 'items', label: 'Items', levels: 'ordinal / interval', arity: '3 or more · one construct' },
  ],
  options: [
    { id: 'standardizedAlpha', label: 'standardized alpha', value: 'off', kind: 'toggle', default: false },
    { id: 'dropItem', label: 'drop-item statistics', value: 'on', kind: 'toggle', default: true },
  ],
  constraints: {
    roles: [
      { roleId: 'items', levels: ['ordinal', 'interval'], arity: { min: 3, max: Infinity } },
    ],
    minRule: { kind: 'values', n: 3 }, // CFA needs ≥3 items to be identified
  },
  tables: [
    {
      id: 'reliability',
      title: 'Reliability',
      columns: [
        { key: 'omega', label: 'ω' },
        { key: 'alpha', label: 'α' },
        { key: 'ci', label: '95% CI' },
        { key: 'nItems', label: 'N items' },
        { key: 'nCases', label: 'N cases' },
      ],
    },
    {
      id: 'item-total-statistics',
      title: 'Item-total statistics',
      columns: [
        { key: 'item', label: 'Item' },
        { key: 'r', label: 'Corrected item-total r' },
        { key: 'alphaDropped', label: 'α if item dropped' },
      ],
    },
  ],
  figures: [
    { caption: 'Item contribution', type: 'item-total correlation bar chart', file: 'item-total-correlation' },
  ],
  howToRead:
    'ω (McDonald\'s omega) is the headline reliability coefficient; it assumes only a congeneric (one-factor) model and is preferred over α when item loadings differ (McNeish, 2018). ' +
    'α (Cronbach\'s alpha) assumes tau-equivalence (equal loadings) and is a lower bound when loadings differ; it is retained as a secondary/legacy coefficient because reviewers still request it. ' +
    'Both range 0–1; ≥ .70 is commonly considered acceptable, ≥ .80 good, > .95 suggests item redundancy — treat these as heuristics, not pass/fail thresholds. ' +
    'The "α if item dropped" column flags items that, if removed, would raise α — candidates for review. ' +
    'A high coefficient does not prove unidimensionality.',
  apaTemplate: "Internal consistency was high, ω={omega} (95% CI [{ciLow}, {ciHigh}]); Cronbach's α={alpha}.",
  rMap: 'psych::alpha() → α + item-total · lavaan::cfa() + semTools::compRelSEM() → ω + 95% CI · ggplot2 → figure',
  bundleFiles: ['table_reliability.png', 'table_item-total-statistics.png', 'figure_item-total-correlation.png'],
}
