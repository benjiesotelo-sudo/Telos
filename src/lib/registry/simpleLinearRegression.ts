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
  tables: [
    { id: 'model-fit', title: 'Model fit', domId: 'simple-linear-model-fit', // all four regression cards draw 'model-fit' (zip keeps it; DOM must not collide)
      columns: [{ key: 'r2', label: 'R²' }, { key: 'adjR2', label: 'Adj. R²' }, { key: 'f', label: 'F' },
        { key: 'df1', label: 'df1' }, { key: 'df2', label: 'df2' }, { key: 'p', label: 'p' }, { key: 'se', label: 'SE' }] },
    { id: 'coefficients', title: 'Coefficients', domId: 'simple-linear-coefficients',
      columns: [{ key: 'term', label: 'Term' }, { key: 'b', label: 'B' }, { key: 'se', label: 'SE' }, { key: 'beta', label: 'β' },
        { key: 't', label: 't' }, { key: 'p', label: 'p' }, { key: 'ci', label: '95% CI' }] },
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
  bundleFiles: ['table_model-fit.png', 'table_coefficients.png', 'figure_fit.png', 'figure_residuals.png'],
}
