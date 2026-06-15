import type { TestSpec } from './types'

// Encoded VERBATIM from telos_test_outputs.html + telos_test_inputs.html (Difference-in-differences card).
// Report-only APA — literal "95% CI" (no {pct} token); {lo}/{hi} replaced by builder.
// DiD = base lm(y ~ treated*post) with clustered-by-entity SE (sandwich::vcovCL); the `did` package is not
// WebR-loadable and not needed for the 2×2 design.
export const DID: TestSpec = {
  id: 'did',
  name: 'Difference-in-differences (DiD)',
  question: 'policy effect, before/after × treated/control',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'treatment', label: 'Treatment group', levels: 'binary nominal', arity: 'exactly 1', hint: 'e.g. who got the treatment — treated = 1 / 0' },
    { id: 'period', label: 'Period (pre / post)', levels: 'binary nominal', arity: 'exactly 1', hint: 'e.g. before vs after — post = 1 / 0' },
    { id: 'entity', label: 'Entity / cluster unit (for clustered SEs)', levels: 'nominal / ordinal', arity: 'exactly 1', hint: 'e.g. the unit observed repeatedly — state, firm' },
    { id: 'time', label: 'Time (for parallel-trends plot)', levels: 'datetime / ordered', arity: 'exactly 1', hint: 'e.g. the date / time-order column — month, year' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'se', label: 'std. errors', value: 'clustered', kind: 'select', choices: ['clustered', 'classical'] },
    { id: 'covariates', label: 'covariates', value: 'none', kind: 'display' },
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
      id: 'did', title: 'DiD model', domId: 'did-model', captionStyle: 'bare',
      columns: [
        { key: 'term', label: 'Term' }, { key: 'b', label: 'B' }, { key: 'se', label: 'Clustered SE' },
        { key: 't', label: 't' }, { key: 'p', label: 'p' }, { key: 'ci', label: '95% CI' },
      ],
    },
  ],
  tableNote: {
    kind: 'assume',
    text: 'the Treated×Post interaction is the DiD effect; valid only if pre-treatment trends are parallel. Under entity fixed effects the time-invariant Treated main effect is absorbed (only Post and Treated×Post are estimated).',
    afterTableId: 'did-model',
  },
  figures: [{ caption: 'Parallel trends', type: 'parallel-trends plot (group means over time, treatment marked)', file: 'parallel-trends' }],
  howToRead:
    'The Treated×Post coefficient is the estimated treatment effect. It rests on the parallel-trends assumption: that the groups would have moved together absent treatment. Similar pre-treatment trends (inspect the pre-period of the plot) make this more plausible but do not prove it — a visual check is supportive, not confirmatory, since the assumption is about the unobservable post-period counterfactual.',
  apaTemplate: 'The DiD estimate was B={b}, 95% CI [{lo}, {hi}], p {p} (clustered SE).',
  rMap: 'fixest::feols() / lm() with clustered SE → table · ggplot2 → trends plot',
  bundleFiles: ['table_did.png', 'figure_parallel-trends.png'],
}
