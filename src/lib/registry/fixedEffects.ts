import type { TestSpec } from './types'

// Encoded VERBATIM from telos_test_outputs.html + telos_test_inputs.html (Fixed effects card).
// Report-only APA — drawn "gave" wording already neutral; p mirrored to the spaced report-only form ("p __").
// §2.8 econometrics-grade addition: poolability F-test (plm::pFtest) is APPENDED to the drawn table note by the
// builder — the drawn within-variation note (below) renders verbatim; poolability is the additive extra (ratify).
export const FIXED_EFFECTS: TestSpec = {
  id: 'fixed-effects',
  name: 'Fixed effects',
  question: 'panel regression, entity effects',
  roles: [
    { id: 'entity', label: 'Entity', levels: 'nominal / ordinal', arity: 'exactly 1', hint: 'e.g. the unit observed repeatedly — firm, country, student' },
    { id: 'time', label: 'Time', levels: 'datetime / ordered', arity: 'exactly 1', hint: 'e.g. the date / time-order column — month, year' },
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'regressors', label: 'Regressors', levels: 'any level', arity: 'one or more', hint: 'e.g. explanatory variables — R&D spend, leverage' },
  ],
  options: [
    { id: 'effects', label: 'effects', value: 'entity', kind: 'select', choices: ['entity', 'time', 'two-way'] },
    { id: 'se', label: 'std. errors', value: 'clustered by entity', kind: 'select', choices: ['clustered by entity', 'classical'] },
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
  ],
  constraints: {
    roles: [
      { roleId: 'entity', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 } },
      { roleId: 'time', levels: [], arity: { min: 1, max: 1 }, timeOrder: true },
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, excludeTag: 'datetime' },
      { roleId: 'regressors', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: Infinity }, excludeTag: 'datetime' },
    ],
    minRule: { kind: 'panel', n: 12 },
  },
  // modelsummary coef table (design 2026-06-16): one stacked table merges the old Coefficients + Model fit.
  // columns = [term, est]; the builder stacks B / (clustered SE) / [CI] per term, a rule, then the gof footer.
  // plm within → NO AIC/BIC/Log.Lik (no logLik method); adj within R² is surfaced here (audit fix).
  tables: [
    {
      id: 'coefficients', title: 'Coefficients (within estimator)', domId: 'fe-coefficients', kind: 'coef',
      columns: [{ key: 'term', label: '' }, { key: 'est', label: '(1)' }],
      models: [{ key: 'est', label: '(1)' }],
      gof: [
        { key: 'n', label: 'Num.Obs.' }, { key: 'nentities', label: 'N entities' },
        { key: 'r2within', label: 'Within R²' }, { key: 'adjr2within', label: 'Adj. within R²' },
        { key: 'f', label: 'F' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'time-invariant predictors are absorbed by the entity effects and drop out; a predictor must also change within entities over time to be estimable — predictors with little within-entity variation give large standard errors and unreliable estimates.',
    afterTableId: 'fe-coefficients',
  },
  figures: [{ caption: 'Coefficients', type: 'coefficient plot (estimate ± CI)', file: 'coefficients' }],
  howToRead:
    'Each B is the within-entity effect of a predictor, controlling for everything stable about each entity. p and the clustered CI assess it; within R² is the variance explained by the time-varying predictors.',
  apaTemplate: 'In a fixed-effects model, predictor X gave B={b}, p {p} (clustered SE).',
  rMap: 'plm(model="within") / fixest::feols() → Table · ggplot2 → figure',
  bundleFiles: ['table_coefficients.png', 'figure_coefficients.png'],
}
