import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Nested ANOVA cards) — display strings verbatim.
export const NESTED_ANOVA: TestSpec = {
  id: 'nested-anova',
  name: 'Nested ANOVA',
  question: 'one factor nested within another',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1',
      hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'factor', label: 'Factor', levels: 'nominal / ordinal', arity: 'exactly 1',
      hint: 'e.g. a grouping label — teaching method' },
    { id: 'nested', label: 'Nested factor', levels: 'nominal / ordinal', arity: 'exactly 1 · within Factor',
      hint: 'e.g. a sub-group inside the factor — classroom within school' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'nesting', label: 'nesting', value: 'random', kind: 'select', choices: ['random', 'fixed'] },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'factor', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 } },
      { roleId: 'nested', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 } },
    ],
    minRule: { kind: 'rows-per-group', n: 3 },
  },
  tables: [
    { id: 'nested-anova', domId: 'nested-anova-nested-anova', title: 'Nested ANOVA', captionStyle: 'bare',
      columns: [
        { key: 'source', label: 'Source' }, { key: 'ss', label: 'SS' }, { key: 'df', label: 'df' },
        { key: 'ms', label: 'MS' }, { key: 'f', label: 'F' }, { key: 'p', label: 'p' },
        { key: 'omega2', label: 'ω² [95% CI]' },
      ] },
  ],
  tableNote: { kind: 'plain', text: "Under random nesting the F for the upper factor (A) uses the nested factor's mean square B(A) as its error term, while B(A) is tested against the residual — so the two F rows do not share the same denominator. Variance components (or ω²) are reported as the effect size where estimable." },
  figures: [{ caption: 'Grouped means', type: 'grouped means plot (nested groups within each top-level group)' , file: 'grouped-means' }],
  howToRead:
    'Used when one factor sits inside another (e.g. classes within schools). The top factor is tested against variation among its nested units, not raw residuals — a significant F means the top-level groups differ beyond the nested-unit variability.',
  apaTemplate: 'A nested ANOVA for A gave F({df1},{df2})={f}, p {p}, ω²={o2} [{lo}, {hi}].',
  rMap: 'aov(y ~ A + Error(A:B)) (random) / aov(y ~ A/B) (fixed) → table · effectsize::omega_squared() → effect size · ggplot2 → figure',
  bundleFiles: ['table_nested-anova.png', 'figure_grouped-means.png'],
}
