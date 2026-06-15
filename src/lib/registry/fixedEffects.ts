import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Fixed effects card).
// Report-only APA — the drawn "gave" wording is already neutral; templated here ({predictor}/{b}/{p}).
// §2.8 econometrics-grade addition: poolability F-test (plm::pFtest) appended to the within-variation
// note by the builder at runtime — registry + HTML carry only the drawn note (structural HTML sync deferred).
export const FIXED_EFFECTS: TestSpec = {
  id: 'fixed-effects',
  name: 'Fixed effects',
  question: 'a panel outcome explained by within-entity variation in time-varying predictors',
  roles: [
    { id: 'entity', label: 'Entity', levels: 'nominal / ordinal', arity: 'exactly 1', hint: 'e.g. the unit observed repeatedly — firm, country, student' },
    { id: 'time', label: 'Time', levels: 'datetime / ordered', arity: 'exactly 1', hint: 'e.g. the period — month, year' },
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the numeric result you measured — roa, income' },
    { id: 'regressors', label: 'Regressors', levels: 'any', arity: 'one or more', hint: 'e.g. time-varying predictors — leverage, R&D spend' },
  ],
  options: [
    { id: 'effects', label: 'effects', value: 'entity', kind: 'select', choices: ['entity', 'time', 'two-way'] },
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
      id: 'coefficients', title: 'Coefficients (within estimator)', domId: 'fe-coefficients',
      columns: [
        { key: 'term', label: 'Term' }, { key: 'b', label: 'B' }, { key: 'se', label: 'Clustered SE' },
        { key: 't', label: 't' }, { key: 'p', label: 'p' }, { key: 'ci', label: '95% CI' },
      ],
    },
    {
      id: 'model-fit', title: 'Model fit', domId: 'fe-model-fit',
      columns: [
        { key: 'withinR2', label: 'Within R²' }, { key: 'f', label: 'F' },
        { key: 'nObs', label: 'N obs' }, { key: 'nEntities', label: 'N entities' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'Time-invariant predictors are absorbed by the entity effects and drop out; a predictor with little within-entity variation yields a large SE and an unreliable estimate.',
    afterTableId: 'fe-model-fit',
  },
  figures: [{ caption: 'Coefficients', type: 'coefficient plot (estimate ± CI)', file: 'coefficients' }],
  howToRead:
    'Each B is the within-entity effect of a predictor, controlling for everything stable about each entity. p and the clustered CI assess it; within R² is the variance explained by the time-varying predictors.',
  apaTemplate: 'In a fixed-effects (within) model, {predictor} gave B = {b}, p {p} (clustered SE).',
  rMap: 'plm::plm(model="within") → coefficients · plm::vcovHC(method="arellano") → clustered SE · plm::pFtest → poolability · ggplot2 → figure',
  bundleFiles: ['table_coefficients.png', 'table_model-fit.png', 'figure_coefficients.png'],
}
