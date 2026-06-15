import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Random effects card).
// Report-only APA (drawn "gave" wording already neutral; templated). Clustered SE like FE.
export const RANDOM_EFFECTS: TestSpec = {
  id: 'random-effects',
  name: 'Random effects',
  question: 'a panel outcome with entity differences modelled as random',
  roles: [
    { id: 'entity', label: 'Entity', levels: 'nominal / ordinal', arity: 'exactly 1', hint: 'e.g. the unit observed repeatedly — firm, country, student' },
    { id: 'time', label: 'Time', levels: 'datetime / ordered', arity: 'exactly 1', hint: 'e.g. the period — month, year' },
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the numeric result you measured — roa, income' },
    { id: 'regressors', label: 'Regressors', levels: 'any', arity: 'one or more', hint: 'e.g. explanatory variables — leverage, R&D spend' },
  ],
  options: [
    { id: 'se', label: 'std. errors', value: 'clustered by entity', kind: 'select', choices: ['clustered by entity', 'classical'] },
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'ci', label: 'CI', value: '95%', kind: 'select', choices: ['90%', '95%', '99%'] },
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
  tables: [
    {
      id: 'coefficients', title: 'Coefficients', domId: 're-coefficients',
      columns: [
        { key: 'term', label: 'Term' }, { key: 'b', label: 'B' }, { key: 'se', label: 'Clustered SE' },
        { key: 't', label: 't' }, { key: 'p', label: 'p' }, { key: 'ci', label: '95% CI' },
      ],
    },
    {
      id: 'model-fit', title: 'Model fit', domId: 're-model-fit',
      columns: [
        { key: 'r2', label: 'R²' }, { key: 'adjR2', label: 'Adj. R²' },
        { key: 'nObs', label: 'N obs' }, { key: 'nEntities', label: 'N entities' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'Unlike fixed effects, random effects retains time-invariant predictors; it is more efficient than fixed effects but only valid when the entity effects are uncorrelated with the predictors — check this with the Hausman test.',
    afterTableId: 're-model-fit',
  },
  figures: [{ caption: 'Coefficients', type: 'coefficient plot (estimate ± CI)', file: 'coefficients' }],
  howToRead:
    'Like fixed effects but treats entity differences as random, allowing time-invariant predictors. Read each B/p as usual — but only trust this model if the Hausman test favours random over fixed effects.',
  apaTemplate: 'In a random-effects model, {predictor} gave B = {b}, p {p}.',
  rMap: 'plm::plm(model="random") → coefficients · plm::vcovHC(method="arellano") → clustered SE · ggplot2 → figure',
  bundleFiles: ['table_coefficients.png', 'table_model-fit.png', 'figure_coefficients.png'],
}
