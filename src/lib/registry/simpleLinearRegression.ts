import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Simple linear regression cards) — display strings
// verbatim, AFTER the Task-1 B4 truth-fix (broom segment dropped from the R map; spike: nothing computed needs broom).
export const SIMPLE_LINEAR_REGRESSION: TestSpec = {
  id: 'simple-linear-regression',
  name: 'Simple linear regression',
  question: 'one numeric outcome, one predictor',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1',
      hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'predictor', label: 'Predictor', levels: 'any level', arity: 'exactly 1',
      hint: 'e.g. one explanatory variable — hours studied' },
  ],
  options: [
    // House convention: α / CI pills are display-only (ratified Association decision 1).
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'ci', label: 'CI', value: '95%', kind: 'select', choices: ['90%', '95%', '99%'] },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'predictor', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 }, // design convention 14 — the real adequacy gate is the run itself
  },
  // modelsummary coef table (design 2026-06-16): one stacked table merges the old Model fit + Coefficients.
  // columns = [term, ...models, ...extraCols]; the builder stacks estimate / (SE) / [CI] per term, a rule, then the gof footer.
  tables: [
    { id: 'coefficients', title: 'Regression coefficients', domId: 'simple-linear-coefficients', kind: 'coef',
      columns: [{ key: 'term', label: '' }, { key: 'est', label: '(1)' }, { key: 'beta', label: 'β' }],
      models: [{ key: 'est', label: '(1)' }],
      extraCols: [{ key: 'beta', label: 'β' }],
      gof: [{ key: 'n', label: 'Num.Obs.' }, { key: 'r2', label: 'R²' }, { key: 'adjr2', label: 'R² Adj.' }, { key: 'f', label: 'F' },
        { key: 'rmse', label: 'RMSE' }, { key: 'aic', label: 'AIC' }, { key: 'bic', label: 'BIC' }, { key: 'll', label: 'Log.Lik.' }] },
  ],
  tableNote: { kind: 'assume', text: 'assumption checks: linearity, normality of residuals, homoscedasticity.' },
  figures: [ // one drawn figbox, two exported files (bundle line) → two specs sharing caption + type (distribution-normality precedent)
    { caption: 'Fit & residuals', type: 'fitted-line scatter + residual diagnostic plots', file: 'fit' },
    { caption: 'Fit & residuals', type: 'fitted-line scatter + residual diagnostic plots', file: 'residuals' },
  ],
  howToRead:
    "R² is the share of outcome variance explained. The predictor's B is the slope (change in outcome per unit), " +
    'with p testing whether it differs from zero and the CI showing precision. β is the standardized slope ' +
    '(change in outcome in SDs per 1 SD change in the predictor), useful for comparing effect sizes on a common scale.',
  apaTemplate: 'A simple linear regression gave B={b}, t({df})={t}, p {p}, R²={r2}.',
  rMap: 'lm() → Tables 1–2 · parameters::standardise_parameters() → β · ggplot2 → figures',
  bundleFiles: ['table_coefficients.png', 'figure_fit.png', 'figure_residuals.png'],
}
