import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Factorial ANOVA cards) — display strings verbatim.
export const FACTORIAL_ANOVA: TestSpec = {
  id: 'factorial-anova',
  name: 'Factorial ANOVA',
  question: 'main effects + interaction of 2+ factors',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1',
      hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'factors', label: 'Factors', levels: 'nominal / ordinal', arity: 'two or more',
      hint: 'e.g. grouping labels — method, gender' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'interactions', label: 'interactions', value: 'on', kind: 'toggle', default: true },
    { id: 'posthoc', label: 'post-hoc', value: 'Tukey', kind: 'display' },
    { id: 'ci', label: 'CI', value: '95%', kind: 'select', choices: ['90%', '95%', '99%'] },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'factors', levels: ['nominal', 'ordinal'], arity: { min: 2, max: Infinity } },
    ],
    minRule: { kind: 'rows-per-group', n: 3 },
  },
  tables: [
    { id: 'cell-descriptives', domId: 'factorial-anova-cell-descriptives', title: 'Cell descriptives',
      columns: [{ key: 'cell', label: 'Factor A × B' }, { key: 'n', label: 'N' }, { key: 'm', label: 'M' }, { key: 'sd', label: 'SD' }] },
    { id: 'anova', domId: 'factorial-anova-anova', title: 'ANOVA (main effects + interaction)',
      columns: [{ key: 'source', label: 'Source' }, { key: 'ss', label: 'SS' }, { key: 'df', label: 'df' },
        { key: 'ms', label: 'MS' }, { key: 'f', label: 'F' }, { key: 'p', label: 'p' }, { key: 'pes', label: 'partial η² [95% CI]' }] },
    { id: 'simple-effects', domId: 'factorial-anova-simple-effects', title: 'Simple effects / post-hoc',
      columns: [{ key: 'contrast', label: 'Contrast' }, { key: 'mdiff', label: 'M', sub: 'diff' }, { key: 'se', label: 'SE' },
        { key: 'padj', label: 'p', sub: 'adj' }, { key: 'ci', label: '95% CI' }] },
  ],
  tableNote: { kind: 'assume', text: "assumption checks: Levene's & normality of residuals; post-hoc / simple-effects table when an effect is significant." },
  figures: [{ caption: 'Interaction', type: 'interaction plot (one line per level of a factor)' , file: 'interaction' }],
  howToRead:
    "Each factor's F/p is its main effect; the A×B row tests whether the effect of one factor depends on the other. " +
    'A significant interaction usually takes priority — read it from the interaction plot before the main effects. ' +
    "A significant effect for any factor with 3+ levels tells you the levels differ somewhere, not which ones — " +
    'use the post-hoc / simple-effects (emmeans) table to find the specific pairs.',
  apaTemplate: 'A two-way ANOVA gave A×B interaction F({df1},{df2})={f}, p {p}, partial η²={pes} [{lo}, {hi}].',
  rMap: 'aov() / afex::aov_car() → Table 2 · emmeans → Table 3 · ggplot2 → interaction plot',
  bundleFiles: ['table_cell-descriptives.png', 'table_anova.png', 'table_simple-effects.png', 'figure_interaction.png'],
}
