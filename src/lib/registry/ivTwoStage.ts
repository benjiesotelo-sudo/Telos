import type { TestSpec } from './types'

// Encoded VERBATIM from telos_test_outputs.html + telos_test_inputs.html (Instrumental variables / 2SLS card).
// Report-only APA — neutral "the 2SLS estimate for X was B" (no causal claim). §2.8: weak-IV F, Wu–Hausman,
// Sargan surfaced as a dynamic diagnostics note appended to spec.tableNote.text (builder constructs the full note).
export const IV_TWO_STAGE: TestSpec = {
  id: 'iv-2sls',
  name: 'Instrumental variables (IV / 2SLS)',
  question: 'effect with an endogenous predictor',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'endogenous', label: 'Endogenous regressor', levels: 'any level', arity: 'one or more', hint: 'e.g. the predictor you suspect is biased — years of schooling' },
    { id: 'instruments', label: 'Instrument(s)', levels: 'any level', arity: 'one or more', hint: 'e.g. shifts the predictor but not the outcome directly — distance to school' },
    { id: 'controls', label: 'Controls (optional)', levels: 'any level', arity: 'zero or more', hint: 'e.g. other variables to hold constant — age, region' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'se', label: 'std. errors', value: 'robust', kind: 'select', choices: ['robust', 'classical'] },
    { id: 'weakTest', label: 'weak-instrument test', value: 'on', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, excludeTag: 'datetime' },
      { roleId: 'endogenous', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: Infinity }, excludeTag: 'datetime' },
      { roleId: 'instruments', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: Infinity }, excludeTag: 'datetime' },
      { roleId: 'controls', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 0, max: Infinity }, excludeTag: 'datetime' },
    ],
    minRule: { kind: 'values', n: 20 },
  },
  tables: [
    {
      id: 'first-stage', title: 'First stage (instrument strength)', domId: 'iv-first-stage',
      columns: [
        { key: 'instrument', label: 'Instrument' }, { key: 'coef', label: 'Coef.' }, { key: 'se', label: 'SE' },
        { key: 'partialF', label: 'Partial F' }, { key: 'p', label: 'p' },
      ],
    },
    // modelsummary OLS|2SLS shape (design 2026-06-16): side-by-side model columns; the builder stacks
    // estimate / (SE) / [CI] per term, a rule, then the gof footer, then span rows for the §2.8 diagnostics.
    // ivreg has NO logLik → no AIC/BIC/Log.Lik gof rows. Structural Wald F = summary(.,diagnostics=T)$waldtest[1].
    {
      id: '2sls', title: '2SLS coefficients', domId: 'iv-2sls', kind: 'coef',
      columns: [{ key: 'term', label: '' }, { key: 'ols', label: 'OLS' }, { key: 'iv', label: '2SLS' }],
      models: [{ key: 'ols', label: 'OLS' }, { key: 'iv', label: '2SLS' }],
      gof: [{ key: 'n', label: 'Num.Obs.' }, { key: 'rmse', label: 'RMSE' }, { key: 'structF', label: 'F' }],
    },
  ],
  figures: [{ caption: 'Coefficients', type: 'coefficient plot (OLS vs. 2SLS)', file: 'coefficients' }],
  howToRead:
    'Check the first-stage F first (rule of thumb > 10 = strong instruments). Then read the 2SLS B for the endogenous predictor as the causal effect, with p/CI. This causal reading rests on the instrument being valid — relevant and affecting the outcome only through the endogenous predictor (the exclusion restriction). That is an assumption you must justify on theory; the Sargan test only checks over-identification (extra instruments), not validity, and is unavailable for just-identified models. Method: R ivreg / AER package; weak-instrument F (Stock & Yogo, 2005).',
  tableNote: {
    kind: 'plain',
    text: 'diagnostics: weak-instrument (first-stage F), Wu-Hausman endogeneity, and Sargan over-identification (when applicable).',
    afterTableId: 'iv-2sls',
  },
  apaTemplate: 'The 2SLS estimate for X was B={b}, p {p} (first-stage F={f}).',
  rMap: 'lm(endog ~ instruments + covariates) → Table 1 (first-stage coef./SE/partial F) · summary(AER::ivreg(...), diagnostics=TRUE) → Table 2 (2SLS) + weak-IV F, Wu-Hausman, Sargan',
  bundleFiles: ['table_first-stage.png', 'table_2sls.png', 'figure_coefficients.png'],
}
