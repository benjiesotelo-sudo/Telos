import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (MANOVA cards) — display strings verbatim.
export const MANOVA: TestSpec = {
  id: 'manova',
  name: 'MANOVA',
  question: 'groups compared on several outcomes at once',
  roles: [
    { id: 'outcomes', label: 'Outcomes (DVs)', levels: 'interval / ratio', arity: 'two or more',
      hint: 'e.g. two or more numeric outcomes — score, satisfaction' },
    { id: 'factors', label: 'Factor(s)', levels: 'nominal / ordinal', arity: 'one or more',
      hint: 'e.g. grouping labels — method, gender' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'statistic', label: 'test statistic', value: 'Pillai', kind: 'select',
      choices: ['Pillai', 'Wilks'] },
    { id: 'followups', label: 'follow-up ANOVAs', value: 'on', kind: 'toggle', default: true },
  ],
  constraints: {
    roles: [
      { roleId: 'outcomes', levels: ['interval', 'ratio'], arity: { min: 2, max: Infinity } },
      { roleId: 'factors', levels: ['nominal', 'ordinal'], arity: { min: 1, max: Infinity } },
    ],
    minRule: { kind: 'rows-per-group', n: 3 },
  },
  tables: [
    { id: 'multivariate', domId: 'manova-multivariate', title: 'Multivariate tests',
      columns: [
        { key: 'effect', label: 'Effect' },
        { key: 'stat', label: 'Pillai / Wilks' },
        { key: 'f', label: 'approx F' },
        { key: 'df1', label: 'df1' },
        { key: 'df2', label: 'df2' },
        { key: 'p', label: 'p' },
      ] },
    { id: 'univariate-followups', domId: 'manova-univariate-followups', title: 'Follow-up univariate ANOVAs (per DV)',
      columns: [
        { key: 'dv', label: 'DV' },
        { key: 'f', label: 'F' },
        { key: 'df1', label: 'df1' },
        { key: 'df2', label: 'df2' },
        { key: 'p', label: 'p' },
        { key: 'pes', label: 'partial η²' },
      ] },
  ],
  figures: [{ caption: 'Group means per outcome', type: 'means plot faceted by DV' , file: 'means' }],
  howToRead:
    'Tests whether groups differ on a set of outcomes jointly. Read the multivariate p (Pillai\'s trace is robust) first; if significant, the per-DV follow-up ANOVAs show which individual outcomes drive it. Because you run one ANOVA per outcome, correct those follow-up p-values for multiple comparisons (e.g. Bonferroni: divide alpha by the number of outcomes) before calling each significant.',
  apaTemplate: "A MANOVA gave Pillai's V={v}, F({df1},{df2})={f}, p {p}.",
  rMap: 'manova() + summary(.., test="Pillai") → Table 1 · summary.aov() → Table 2 (F/df/p) · effectsize::eta_squared(partial=TRUE) → partial η²',
  bundleFiles: ['table_multivariate.png', 'table_univariate-followups.png', 'figure_means.png'],
}
