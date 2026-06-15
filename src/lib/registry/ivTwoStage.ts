import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Instrumental variables / 2SLS card).
// Report-only APA — the drawn "X had an effect of B" is SOFTENED to "the 2SLS estimate for X was B" (no
// causal claim). §2.8: weak-IV F, Wu–Hausman, Sargan surfaced as a dynamic diagnostics note (built at runtime).
export const IV_TWO_STAGE: TestSpec = {
  id: 'iv-2sls',
  name: 'Instrumental variables (IV / 2SLS)',
  question: 'a causal effect of an endogenous predictor, recovered with instruments',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the numeric result you measured — wage, income' },
    { id: 'endogenous', label: 'Endogenous regressor', levels: 'any', arity: 'one or more', hint: 'e.g. the predictor you suspect is biased — years of schooling' },
    { id: 'instruments', label: 'Instrument(s)', levels: 'any', arity: 'one or more', hint: 'e.g. shifts the predictor but not the outcome directly — distance to school' },
    { id: 'controls', label: 'Controls (optional)', levels: 'any', arity: 'zero or more', hint: 'e.g. other variables to hold constant — experience, region' },
  ],
  options: [
    { id: 'se', label: 'std. errors', value: 'robust', kind: 'select', choices: ['robust', 'classical'] },
    { id: 'weakTest', label: 'weak-instrument test', value: 'on', kind: 'display' },
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'ci', label: 'CI', value: '95%', kind: 'select', choices: ['90%', '95%', '99%'] },
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
    {
      id: '2sls', title: '2SLS coefficients', domId: 'iv-2sls',
      columns: [
        { key: 'term', label: 'Term' }, { key: 'b', label: 'B' }, { key: 'se', label: 'SE' },
        { key: 't', label: 't' }, { key: 'p', label: 'p' }, { key: 'ci', label: '95% CI' },
      ],
    },
  ],
  figures: [{ caption: 'Coefficients', type: 'coefficient plot (OLS vs. 2SLS)', file: 'coefficients' }],
  howToRead:
    'Check the first-stage F first (rule of thumb > 10 = strong instruments). Then read the 2SLS B for the endogenous predictor as the causal effect, with p/CI. This causal reading rests on the instrument being valid — relevant and affecting the outcome only through the endogenous predictor (the exclusion restriction). That is an assumption you must justify on theory; the Sargan test only checks over-identification (extra instruments), not validity, and is unavailable for just-identified models.',
  apaTemplate: 'The 2SLS estimate for {endogenous} was B = {b}, p {p} (first-stage F = {f}).',
  rMap: 'lm(endogenous ~ instruments + controls) → first stage · ivreg::ivreg(...) + sandwich::vcovHC → 2SLS + robust SE · summary(diagnostics=TRUE) → weak-IV / Wu–Hausman / Sargan · ggplot2 → figure',
  bundleFiles: ['table_first-stage.png', 'table_2sls.png', 'figure_coefficients.png'],
}
