import type { TestSpec } from './types'

// Encoded VERBATIM from telos_test_outputs.html + telos_test_inputs.html (Difference-in-differences card).
// Report-only APA — literal "95% CI" (no {pct} token); {lo}/{hi} replaced by builder.
// DiD = Option-B entity fixed effects: plm::plm(y ~ post + post:treated, model='within') with clustered-by-entity
// SE (plm::vcovHC, arellano/HC1). The within transform absorbs the time-invariant Treated main effect, so the
// modelsummary coef table shows only Post + Treated×Post. plm has NO logLik → no AIC/BIC/Log.Lik gof rows.
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
  // modelsummary coef table (design 2026-06-16): one stacked table merges coefficients + model fit.
  // columns = [term, est]; the builder stacks B / (clustered SE) / [CI] per term, a rule, then the gof footer.
  // plm within → NO AIC/BIC/Log.Lik (no logLik method); within R² + F + N entities are the panel gof rows.
  tables: [
    {
      id: 'did', title: 'DiD model', domId: 'did-model', captionStyle: 'bare', kind: 'coef',
      columns: [{ key: 'term', label: '' }, { key: 'est', label: '(1)' }],
      models: [{ key: 'est', label: '(1)' }],
      gof: [
        { key: 'n', label: 'Num.Obs.' }, { key: 'nentities', label: 'N entities' },
        { key: 'r2within', label: 'Within R²' }, { key: 'f', label: 'F' },
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
    'The Treated×Post coefficient is the estimated treatment effect. It rests on the parallel-trends assumption: that the groups would have moved together absent treatment. Similar pre-treatment trends (inspect the pre-period of the plot) make this more plausible but do not prove it — a visual check is supportive, not confirmatory, since the assumption is about the unobservable post-period counterfactual. The note adds a formal pre-trends test (a pre-period leads-and-lags joint F of the treated×time interactions): a small p flags diverging pre-trends, while a large p is consistent with parallel trends. Method: R plm package with clustered standard errors (Croissant & Millo, 2008; Bertrand, Duflo & Mullainathan, 2004).',
  apaTemplate: 'The DiD estimate was B={b}, 95% CI [{lo}, {hi}], p {p} (clustered SE).',
  rMap: 'plm(model="within") with clustered SE → table · ggplot2 → trends plot',
  bundleFiles: ['table_did.png', 'figure_parallel-trends.png'],
}
