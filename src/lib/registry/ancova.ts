import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (ANCOVA cards) — display strings verbatim.
export const ANCOVA: TestSpec = {
  id: 'ancova',
  name: 'ANCOVA',
  question: 'group means adjusted for a covariate',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1',
      hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'factor', label: 'Factor', levels: 'nominal / ordinal', arity: 'one or more',
      hint: 'e.g. a grouping label — teaching method' },
    { id: 'covariates', label: 'Covariate(s)', levels: 'interval / ratio', arity: 'one or more',
      hint: 'e.g. numeric control(s) to hold constant — baseline score, age' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'posthoc', label: 'post-hoc', value: 'adjusted means', kind: 'display' },
    { id: 'ci', label: 'CI', value: '95%', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'factor', levels: ['nominal', 'ordinal'], arity: { min: 1, max: Infinity } },
      { roleId: 'covariates', levels: ['interval', 'ratio'], arity: { min: 1, max: Infinity } },
    ],
    minRule: { kind: 'rows-per-group', n: 3 },
  },
  tables: [
    { id: 'adjusted-means', domId: 'ancova-adjusted-means', title: 'Adjusted (estimated marginal) means',
      columns: [
        { key: 'group', label: 'Group' },
        { key: 'adjm', label: 'Adj. M' },
        { key: 'se', label: 'SE' },
        { key: 'ci', label: '95% CI' },
      ] },
    { id: 'ancova', domId: 'ancova-ancova', title: 'ANCOVA',
      columns: [
        { key: 'source', label: 'Source' },
        { key: 'ss', label: 'SS' },
        { key: 'df', label: 'df' },
        { key: 'ms', label: 'MS' },
        { key: 'f', label: 'F' },
        { key: 'p', label: 'p' },
        { key: 'pes', label: 'partial η²' },
      ] },
    { id: 'posthoc', domId: 'ancova-posthoc', title: 'Post-hoc comparisons (adjusted means)',
      columns: [
        { key: 'pair', label: 'Pair' },
        { key: 'mdiff', label: 'M', sub: 'diff', suffix: ' (adj.)' },
        { key: 'se', label: 'SE' },
        { key: 'padj', label: 'p', sub: 'adj' },
        { key: 'ci', label: '95% CI' },
      ] },
  ],
  tableNote: { kind: 'assume', text: "assumption checks: homogeneity of regression slopes (factor×covariate interaction) & Levene's; post-hoc on adjusted means.", afterTableId: 'ancova' },
  figures: [{ caption: 'Adjusted means', type: 'adjusted means plot (covariate-controlled, ± CI)' , file: 'adjusted-means' }],
  howToRead:
    'Compares group means after statistically removing the influence of a numeric covariate. First confirm the ' +
    'factor×covariate interaction is non-significant (homogeneity of slopes) — if it is significant, the ' +
    'adjusted-means interpretation is not valid and a different model is needed. Then read the Factor row\'s ' +
    'F/p for the adjusted group effect, and the adjusted means for the covariate-controlled group values.',
  apaTemplate: 'Controlling for the covariate, an ANCOVA gave F({df1},{df2})={f}, p {p}, partial η²={pes}.',
  rMap: 'car::Anova(type=3) → Table 2 (SS/df/F/p) · effectsize::eta_squared(partial=TRUE) → partial η² · emmeans → adjusted means & Table 3 (post-hoc) · ggplot2 → figure',
  bundleFiles: ['table_adjusted-means.png', 'table_ancova.png', 'table_posthoc.png', 'figure_adjusted-means.png'],
}
