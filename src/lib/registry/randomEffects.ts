import type { TestSpec } from './types'

// Encoded VERBATIM from telos_test_outputs.html + telos_test_inputs.html (Random effects card).
// Report-only APA — drawn "gave" wording already neutral.
// tableNote verbatim from the drawn card (kind 'plain', afterTableId 're-coefficients').
// Theme-4 econometrics-grade addition: the builder APPENDS the Breusch–Pagan LM test (RE vs pooled OLS,
// plm::plmtest(pooling, type='bp')) + the Swamy–Arora variance components / θ to this drawn note — the drawn
// text below renders verbatim; the LM test + θ are the additive extras (cf. buildFixedEffects's poolability F).
export const RANDOM_EFFECTS: TestSpec = {
  id: 'random-effects',
  name: 'Random effects',
  question: 'panel regression, random entity effects',
  roles: [
    { id: 'entity', label: 'Entity', levels: 'nominal / ordinal', arity: 'exactly 1', hint: 'e.g. the unit observed repeatedly — firm, country, student' },
    { id: 'time', label: 'Time', levels: 'datetime / ordered', arity: 'exactly 1', hint: 'e.g. the date / time-order column — month, year' },
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'regressors', label: 'Regressors', levels: 'any level', arity: 'one or more', hint: 'e.g. explanatory variables — R&D spend, leverage' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'se', label: 'std. errors', value: 'clustered by entity', kind: 'select', choices: ['clustered by entity', 'classical'] },
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
  // Single model column. Per term: B / (clustered SE) / [CI]. plm has no logLik → NO AIC/BIC/Log.Lik. in the GOF.
  // No F row: the stats result does not return one (the FE sibling does; RE does not). Clustered SE conveyed in the note.
  tables: [
    {
      id: 'coefficients', title: 'Coefficients', domId: 're-coefficients', kind: 'coef',
      columns: [{ key: 'term', label: '' }, { key: 'est', label: '(1)' }],
      models: [{ key: 'est', label: '(1)' }],
      gof: [
        { key: 'n', label: 'Num.Obs.' }, { key: 'nentities', label: 'N entities' },
        { key: 'r2', label: 'R²' }, { key: 'adjr2', label: 'R² Adj.' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'standard errors are clustered by entity. unlike fixed effects, time-invariant predictors can be retained. summary(plm) returns a single R² / adj. R² (not a within/between/overall split).',
    afterTableId: 're-coefficients',
  },
  figures: [{ caption: 'Coefficients', type: 'coefficient plot', file: 'coefficients' }],
  howToRead:
    'Like fixed effects but treats entity differences as random, allowing time-invariant predictors. Read each B/p as usual — but only trust this model if the Hausman test favours random over fixed effects.',
  apaTemplate: 'In a random-effects model, predictor X gave B={b}, p {p}.',
  rMap: 'plm(model="random") → Table · ggplot2 → figure',
  bundleFiles: ['table_coefficients.png', 'figure_coefficients.png'],
}
