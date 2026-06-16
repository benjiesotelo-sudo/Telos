import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Poisson / negative binomial cards) — display strings verbatim.
export const POISSON_NEGATIVE_BINOMIAL: TestSpec = {
  id: 'poisson-negative-binomial',
  name: 'Poisson / negative binomial',
  question: 'predict a count outcome',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'count', arity: 'non-negative integers · exactly 1',
      hint: 'e.g. a count of events you tallied — complaints, visits' },
    { id: 'predictors', label: 'Predictors', levels: 'any level', arity: 'one or more',
      hint: 'e.g. explanatory variables — age, gender, hours studied' },
    { id: 'exposure', label: 'Exposure (optional)', levels: 'interval / ratio', arity: '0 or 1 · offset',
      hint: 'e.g. observation time / population at risk (log offset)' },
  ],
  options: [
    { id: 'model', label: 'model', value: 'Poisson', kind: 'select', choices: ['Poisson', 'negative binomial'],
      hint: 'Start with Poisson, but switch to negative binomial if the dispersion check shows the counts are over-dispersed.' },
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'ci', label: 'CI', value: '95%', kind: 'select', choices: ['90%', '95%', '99%'] },
    // Display-only (convention 11): the pill reflects the Exposure role slot, exactly as drawn.
    { id: 'offset', label: 'offset', value: 'from Exposure', kind: 'display' },
  ],
  constraints: {
    roles: [
      // Recorded decision 6: 'count' is a columnMeta TAG (B1), not a measurement level — machine levels are interval/ratio.
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, tag: 'count' },
      { roleId: 'predictors', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: Infinity } },
      { roleId: 'exposure', levels: ['interval', 'ratio'], arity: { min: 0, max: 1 } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 }, // count outcome is numeric — complete-pairs works here (convention 14)
  },
  // modelsummary coef table (design 2026-06-16): the old Model fit + Coefficients merge into ONE stacked table.
  // SHAPE A (exponentiated two-column B | IRR): per term a coef row (B, IRR) then a muted row — (SE) under
  // Log-count (B), the IRR confidence interval under IRR. z/p drop from the visible cell (report-only, D1: no stars).
  // GOF footer (glm family): Num.Obs. → model-aware Dispersion (Poisson ratio / NB θ) → Residual deviance + df →
  // Log.Lik. → AIC → BIC. The Dispersion label is static here; the model-aware NOTE explains the Poisson↔θ swap (convention 10).
  tables: [
    { id: 'coefficients', title: 'Coefficients', domId: 'poisson-nb-coefficients', kind: 'coef',
      columns: [{ key: 'term', label: '' }, { key: 'b', label: 'Log-count (B)' }, { key: 'irr', label: 'IRR' }],
      models: [{ key: 'b', label: 'Log-count (B)' }, { key: 'irr', label: 'IRR' }],
      gof: [
        { key: 'n', label: 'Num.Obs.' },
        { key: 'dispersion', label: 'Dispersion' },
        { key: 'dev', label: 'Residual deviance' },
        { key: 'df', label: 'df' },
        { key: 'll', label: 'Log.Lik.' },
        { key: 'aic', label: 'AIC' },
        { key: 'bic', label: 'BIC' },
      ] },
  ],
  tableNote: { kind: 'assume', text:
    'dispersion check (Poisson): if variance >> mean (over-dispersion), switch to negative binomial, which instead reports theta (its overdispersion parameter) rather than this ratio.' },
  figures: [{ caption: 'Fit / residuals', type: 'fitted vs. residual plot', file: 'residuals' }],
  howToRead:
    "Models event counts. Each predictor's incidence-rate ratio (IRR) gives the multiplicative change in the expected " +
    'count per unit (>1 more, <1 fewer); p tests significance. Check dispersion to pick Poisson vs. negative binomial. ' +
    'If cases have unequal exposure (different observation time/area/population), add an offset of log(exposure) so the ' +
    'model predicts rates, not raw counts — omitting it biases the IRRs.',
  apaTemplate: 'Predictor X was associated with the count, IRR={irr}, 95% CI [{ciLow}, {ciHigh}], p {p}.',
  rMap: 'glm(family=poisson, offset=log(exposure)) / MASS::glm.nb() → B/SE/z/p · exp(cbind(IRR=coef(m), confint(m))) → IRR + 95% CI · performance::check_overdispersion() → dispersion',
  bundleFiles: ['table_coefficients.png', 'figure_residuals.png'],
}
