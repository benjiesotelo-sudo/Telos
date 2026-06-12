import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Logistic regression cards) — display strings
// verbatim, AFTER the Task-1 D4 truth-fix (caret::confusionMatrix() → table(predicted, observed): caret is not
// shipped; the classification table is a hand 2×2 tabulation).
export const LOGISTIC_REGRESSION: TestSpec = {
  id: 'logistic-regression',
  name: 'Logistic regression',
  question: 'predict a yes/no outcome',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'nominal', arity: 'exactly 1 · 2 categories',
      hint: 'e.g. the yes/no result you measured — passed, churned' },
    { id: 'predictors', label: 'Predictors', levels: 'any level', arity: 'one or more',
      hint: 'e.g. explanatory variables — age, gender, hours studied' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'ci', label: 'CI', value: '95%', kind: 'display' },
    // Drawn ON. R1 ruling: off → em-dash OR + 95% CI (OR) cells (and the APA's OR/CI slots — recorded decision 4).
    { id: 'reportOR', label: 'report odds ratios', value: 'on', kind: 'toggle', default: true,
      hint: 'Keep report odds ratios on so each coefficient reads as the multiplier on the odds of the outcome.' },
    // B2 level-select: choices = the assigned outcome column's two levels; default = second level alphabetically.
    { id: 'event', label: 'event category', value: 'passed · second level', kind: 'level-select', fromRole: 'outcome',
      hint: 'Event category is the outcome level the model predicts (here passed, the second level) — switch it if the odds should describe the other category.' },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['nominal'], arity: { min: 1, max: 1 }, categories: { exact: 2 } },
      { roleId: 'predictors', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: Infinity } },
    ],
    // Recorded decision 2: complete-pairs is numeric-only (a string outcome counts 0 pairs) — the role-candidate
    // check enforces the 2-category nominal candidate; the adequacy gate is the run itself.
    minRule: { kind: 'used-columns', n: 1 },
  },
  tables: [
    { id: 'model-fit', title: 'Model fit', domId: 'logistic-model-fit',
      columns: [{ key: 'm2ll', label: '−2LL' }, { key: 'aic', label: 'AIC' }, { key: 'nagelkerke', label: 'Nagelkerke R²' },
        { key: 'chisq', label: 'Omnibus χ²' }, { key: 'p', label: 'p' }] },
    { id: 'coefficients', title: 'Coefficients', domId: 'logistic-coefficients',
      columns: [{ key: 'term', label: 'Term' }, { key: 'b', label: 'B' }, { key: 'se', label: 'SE' }, { key: 'z', label: 'z' },
        { key: 'p', label: 'p' }, { key: 'or', label: 'OR' }, { key: 'ci', label: '95% CI (OR)' }] },
    { id: 'classification', title: 'Classification', // unique id across all shipped specs — no domId needed
      // Drawn placeholders; the builder replaces 0/1 with the REAL outcome level names (convention 7).
      columns: [{ key: 'pred', label: 'Predicted \\ Observed' }, { key: 'c0', label: '0' }, { key: 'c1', label: '1' }, { key: 'pct', label: '% correct' }] },
  ],
  figures: [{ caption: 'Classifier performance', type: 'ROC curve (with AUC)', file: 'roc' }],
  howToRead:
    "Each predictor's odds ratio tells how the odds of the outcome change per unit (>1 increases, <1 decreases); " +
    'p tests significance (read it from the z column, z = B/SE). Model fit and the ROC/AUC show how well it classifies overall.',
  apaTemplate: 'Predictor X was associated with the outcome, OR={or}, 95% CI [{ciLow}, {ciHigh}], p={p} (AUC={auc}).',
  rMap: 'glm(family=binomial) → B/SE/z/p · exp(cbind(OR=coef(m), confint(m))) → OR + 95% CI · performance::r2_nagelkerke(m) → Nagelkerke R² · AIC(m) → AIC · anova(m, test="Chisq") → omnibus χ² / −2LL · table(predicted, observed) → Table 3 (classification) · pROC → ROC/AUC',
  bundleFiles: ['table_model-fit.png', 'table_coefficients.png', 'table_classification.png', 'figure_roc.png'],
}
