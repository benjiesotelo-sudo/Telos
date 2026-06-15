import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Difference-in-differences card).
// Report-only APA (drawn "estimate was" wording already neutral; templated, CI level threaded).
// DiD = base lm(y ~ treated*post) with clustered-by-entity SE (sandwich::vcovCL); the `did` package is not
// WebR-loadable and not needed for the 2×2 design.
export const DID: TestSpec = {
  id: 'did',
  name: 'Difference-in-differences (DiD)',
  question: 'a treatment effect estimated from the change in a treated group vs a control group, pre to post',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'treatment', label: 'Treatment group', levels: 'binary nominal', arity: 'exactly 1', hint: 'e.g. treated = 1 / 0' },
    { id: 'period', label: 'Period (pre/post)', levels: 'binary nominal', arity: 'exactly 1', hint: 'e.g. post = 1 / 0' },
    { id: 'entity', label: 'Entity / cluster', levels: 'nominal / ordinal', arity: 'exactly 1', hint: 'e.g. the unit for clustered SEs — state, firm' },
    { id: 'time', label: 'Time', levels: 'datetime / ordered', arity: 'exactly 1', hint: 'e.g. for the parallel-trends plot — month, year' },
  ],
  options: [
    { id: 'se', label: 'std. errors', value: 'clustered', kind: 'select', choices: ['clustered', 'classical'] },
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'ci', label: 'CI', value: '95%', kind: 'select', choices: ['90%', '95%', '99%'] },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, excludeTag: 'datetime' },
      { roleId: 'treatment', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { exact: 2 } },
      { roleId: 'period', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { exact: 2 } },
      { roleId: 'entity', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 } },
      { roleId: 'time', levels: [], arity: { min: 1, max: 1 }, timeOrder: true },
    ],
    minRule: { kind: 'values', n: 12 },
  },
  tables: [
    {
      id: 'did-model', title: 'DiD model', domId: 'did-model',
      columns: [
        { key: 'term', label: 'Term' }, { key: 'b', label: 'B' }, { key: 'se', label: 'Clustered SE' },
        { key: 't', label: 't' }, { key: 'p', label: 'p' }, { key: 'ci', label: '95% CI' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'The Treated×Post coefficient is the DiD effect only if the parallel-trends assumption holds; entity differences are absorbed by the Treated main effect. Inspect the pre-period of the plot — supportive, not confirmatory.',
    afterTableId: 'did-model',
  },
  figures: [{ caption: 'Parallel trends', type: 'group means over time, treatment onset marked', file: 'parallel-trends' }],
  howToRead:
    'The Treated×Post coefficient is the estimated treatment effect. It rests on the parallel-trends assumption: that the groups would have moved together absent treatment. Similar pre-treatment trends (inspect the pre-period of the plot) make this more plausible but do not prove it — a visual check is supportive, not confirmatory, since the assumption is about the unobservable post-period counterfactual.',
  apaTemplate: 'The DiD estimate was B = {b}, {pct}% CI [{lo}, {hi}], p {p} (clustered SE).',
  rMap: 'lm(y ~ treated * post) → coefficients · sandwich::vcovCL(cluster = entity) → clustered SE · ggplot2 → trends plot',
  bundleFiles: ['table_did.png', 'figure_parallel-trends.png'],
}
