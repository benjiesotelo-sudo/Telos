import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Multiple linear regression cards) — display strings
// verbatim, AFTER the Task-1 R2 amendment ('changeable' dropped from the config guide). The R map keeps the drawn
// ggplot2/performance::check_model() either-or phrasing (recorded decision 9 — figures are pure ggplot2, performance ships).
export const MULTIPLE_LINEAR_REGRESSION: TestSpec = {
  id: 'multiple-linear-regression',
  name: 'Multiple linear regression',
  question: 'one numeric outcome, several predictors',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1',
      hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'predictors', label: 'Predictors', levels: 'any level', arity: 'one or more',
      hint: 'e.g. explanatory variables — age, gender, hours studied' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'ci', label: 'CI', value: '95%', kind: 'select', choices: ['90%', '95%', '99%'] },
    // Drawn OFF. R1 ruling: off → em-dash β cells, on → filled; the column set is card-fixed either way.
    { id: 'standardize', label: 'standardize', value: 'off', kind: 'toggle', default: false,
      hint: 'Turn standardize on if you want comparable (beta) coefficients.' },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'predictors', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: Infinity } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 }, // design convention 14 — the real adequacy gate is the run itself
  },
  tables: [
    { id: 'model-fit', title: 'Model fit', domId: 'multiple-linear-model-fit',
      columns: [{ key: 'r2', label: 'R²' }, { key: 'adjR2', label: 'Adj. R²' }, { key: 'f', label: 'F' },
        { key: 'df1', label: 'df1' }, { key: 'df2', label: 'df2' }, { key: 'p', label: 'p' }] },
    { id: 'coefficients', title: 'Coefficients', domId: 'multiple-linear-coefficients',
      columns: [{ key: 'term', label: 'Term' }, { key: 'b', label: 'B' }, { key: 'se', label: 'SE' }, { key: 'beta', label: 'β' },
        { key: 't', label: 't' }, { key: 'p', label: 'p' }, { key: 'ci', label: '95% CI' }, { key: 'vif', label: 'VIF' }] },
  ],
  tableNote: { kind: 'assume', text: 'assumption checks: linearity, normality, homoscedasticity, and multicollinearity (VIF).' },
  // Two drawn figboxes (owner-ruled #11 → build the coefficient plot): residual diagnostics + a standardized-β
  // forest plot with 95% CIs (β CI = raw B CI × the rescaling factor — spike-pinned ≡ the refit method, 4.4e-16).
  figures: [
    { caption: 'Residual diagnostics', type: 'residual / diagnostic plots', file: 'residuals' },
    { caption: 'Coefficient plot', type: 'coefficient plot, standardized β with 95% CI', file: 'coefficient-plot' },
  ],
  howToRead:
    "Each predictor's B is its effect holding the others constant; p and CI assess it. R² is the joint variance " +
    'explained; VIF flags predictors that overlap too much (multicollinearity). B is in each predictor\'s own units, ' +
    'so to compare which predictors matter most use the standardized coefficient (β), not B.',
  apaTemplate: 'The model explained R²={r2} of the variance, F({df1},{df2})={f}, p {p}; predictor X gave B={b}, p {p2}.',
  rMap: 'lm() → Tables 1–2 · parameters::standardise_parameters() → β · car::vif() → VIF · ggplot2/performance::check_model() → figures',
  bundleFiles: ['table_model-fit.png', 'table_coefficients.png', 'figure_residuals.png', 'figure_coefficient-plot.png'],
}
