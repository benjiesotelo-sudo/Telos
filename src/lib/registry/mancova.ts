import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (MANCOVA cards) — display strings verbatim.
export const MANCOVA: TestSpec = {
  id: 'mancova',
  name: 'MANCOVA',
  question: 'MANOVA with covariate control',
  roles: [
    { id: 'outcomes', label: 'Outcomes (DVs)', levels: 'interval / ratio', arity: 'two or more',
      hint: 'e.g. two or more numeric outcomes — score, satisfaction' },
    { id: 'factors', label: 'Factor(s)', levels: 'nominal / ordinal', arity: 'one or more',
      hint: 'e.g. grouping labels — method, gender' },
    { id: 'covariates', label: 'Covariate(s)', levels: 'interval / ratio', arity: 'one or more',
      hint: 'e.g. numeric control(s) to hold constant — baseline score, age' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'statistic', label: 'test statistic', value: 'Pillai', kind: 'select',
      choices: ['Pillai', 'Wilks'] },
  ],
  constraints: {
    roles: [
      { roleId: 'outcomes', levels: ['interval', 'ratio'], arity: { min: 2, max: Infinity } },
      { roleId: 'factors', levels: ['nominal', 'ordinal'], arity: { min: 1, max: Infinity } },
      { roleId: 'covariates', levels: ['interval', 'ratio'], arity: { min: 1, max: Infinity } },
    ],
    minRule: { kind: 'rows-per-group', n: 3 },
  },
  tables: [
    { id: 'multivariate', domId: 'mancova-multivariate', title: 'Multivariate tests (covariate-adjusted)',
      columns: [
        { key: 'effect', label: 'Effect' },
        { key: 'stat', label: 'Pillai / Wilks' },
        { key: 'f', label: 'approx F' },
        { key: 'df1', label: 'df1' },
        { key: 'df2', label: 'df2' },
        { key: 'p', label: 'p' },
      ] },
    { id: 'univariate-followups', domId: 'mancova-univariate-followups', title: 'Adjusted univariate follow-ups',
      columns: [
        { key: 'dv', label: 'DV' },
        { key: 'f', label: 'F' },
        { key: 'df1', label: 'df1' },
        { key: 'df2', label: 'df2' },
        { key: 'p', label: 'p' },
        { key: 'pes', label: 'partial η² [95% CI]' },
      ] },
  ],
  tableNote: { kind: 'assume', text: "assumption checks include homogeneity of covariance matrices (Box's M) and homogeneity of regression slopes for each covariate." },
  figures: [{ caption: 'Adjusted means per outcome', type: 'adjusted means plot faceted by DV' , file: 'adjusted-means' }],
  howToRead:
    'Like MANOVA, but group differences on the set of outcomes are assessed after controlling for one or more covariates. ' +
    'Interpret the univariate follow-ups only if the multivariate p is significant, and adjust them for the number of DVs (e.g. Bonferroni) to control familywise error.',
  apaTemplate: "A MANCOVA gave a covariate-adjusted group effect, Pillai's V={v}, F({df1},{df2})={f}, p {p}.",
  rMap: 'manova() + summary(.., test=) (covariates first — matches car::Manova) → Table 1 · summary.aov() → Table 2 (F/df/p) · effectsize::eta_squared(partial=TRUE) → partial η² · emmeans → adjusted means',
  bundleFiles: ['table_multivariate.png', 'table_univariate-followups.png', 'figure_adjusted-means.png'],
}
