import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (One-way ANOVA cards) — display strings verbatim.
export const ONE_WAY_ANOVA: TestSpec = {
  id: 'one-way-anova',
  name: 'One-way ANOVA + post-hoc',
  question: 'do 3+ groups differ, and which pairs?',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1',
      hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'factor', label: 'Factor (grouping)', levels: 'nominal / ordinal', arity: 'exactly 1 · 3+ categories',
      hint: 'e.g. label splitting cases into groups — teaching method' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'posthoc', label: 'post-hoc', value: 'Tukey HSD', kind: 'select',
      choices: ['Tukey HSD', 'Bonferroni', 'Scheffé'],
      hint: "post-hoc choices: Tukey HSD · Bonferroni · Scheffé (Games-Howell lives under Welch's ANOVA, for unequal variances)" },
    { id: 'ci', label: 'CI', value: '95%', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'factor', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { min: 3 } },
    ],
    minRule: { kind: 'rows-per-group', n: 3 }, // DRAFT family rule, same as the t-test
  },
  tables: [
    { id: 'descriptives', domId: 'one-way-anova-descriptives', title: 'Descriptives by group',
      columns: [{ key: 'group', label: 'Group' }, { key: 'n', label: 'N' }, { key: 'm', label: 'M' }, { key: 'sd', label: 'SD' }] },
    { id: 'anova', domId: 'one-way-anova-anova', title: 'ANOVA',
      columns: [{ key: 'source', label: 'Source' }, { key: 'ss', label: 'SS' }, { key: 'df', label: 'df' },
        { key: 'ms', label: 'MS' }, { key: 'f', label: 'F' }, { key: 'p', label: 'p' }, { key: 'eta2', label: 'η²' }] },
    { id: 'posthoc', domId: 'one-way-anova-posthoc', title: 'Post-hoc comparisons',
      columns: [{ key: 'pair', label: 'Pair' }, { key: 'mdiff', label: 'M', sub: 'diff' }, { key: 'se', label: 'SE' },
        { key: 'padj', label: 'p', sub: 'adj' }, { key: 'ci', label: '95% CI' }] },
  ],
  tableNote: { kind: 'assume', text: "assumption checks: Levene's (equal variances) & normality of residuals." },
  figures: [{ caption: 'Group means', type: 'means plot with 95% CI error bars' , file: 'means-plot' }],
  howToRead:
    'The F and its p tell you whether the groups differ overall; η² (or ω²) is the effect size. ' +
    'If significant, the post-hoc table shows which specific pairs differ, with multiplicity-adjusted p-values.',
  apaTemplate: 'A one-way ANOVA gave F({df1},{df2})={f}, p {p}, η²={eta2}. {posthoc} post-hoc tests showed…',
  rMap: 'aov() → Table 2 · emmeans pairwise contrasts (Mdiff, SE, padj, CI) → Table 3 · effectsize::eta_squared() · ggplot2 → means plot',
  bundleFiles: ['table_descriptives.png', 'table_anova.png', 'table_posthoc.png', 'figure_means-plot.png'],
}
