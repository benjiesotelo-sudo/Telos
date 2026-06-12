import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Chi-square independence cards) — display strings
// verbatim, AFTER the Task-1 amendments (R2: figure_bar.png bundle + ggplot2::geom_bar R map; D1: hand-V R-map entry).
export const CHI_SQUARE_INDEPENDENCE: TestSpec = {
  id: 'chi-square-independence',
  name: 'Chi-square independence',
  question: 'are two categorical variables related?',
  roles: [
    { id: 'rowVar', label: 'Row variable', levels: 'nominal / ordinal', arity: 'exactly 1' },
    { id: 'colVar', label: 'Column variable', levels: 'nominal / ordinal', arity: 'exactly 1' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    // Drawn ON; only effective for 2×2 in R (the card footnote teaches this).
    { id: 'continuity', label: 'continuity correction', value: 'on (2×2)', kind: 'toggle', default: true },
  ],
  constraints: {
    roles: [
      { roleId: 'rowVar', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { min: 2 } },
      { roleId: 'colVar', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { min: 2 } },
    ],
    minRule: { kind: 'used-columns', n: 2 }, // needs two distinct categorical columns
  },
  tables: [
    { id: 'contingency', title: 'Contingency (observed [expected])', domId: 'chi-square-independence-contingency',
      // Drawn placeholders; the builder replaces them with one column per category + Total (frequencies' sanctioned divergence).
      columns: [{ key: 'rowcat', label: 'Row \\ Column' }, { key: 'c0', label: 'Col 1' }, { key: 'c1', label: 'Col 2' }, { key: 'more', label: '…' }, { key: 'total', label: 'Total' }] },
    { id: 'chi-square', title: 'Chi-square test', domId: 'chi-square-independence-chi-square',
      columns: [{ key: 'chisq', label: 'χ²' }, { key: 'df', label: 'df' }, { key: 'p', label: 'p' }, { key: 'v', label: "Cramér's V" }] },
  ],
  tableNote: { kind: 'plain', text:
    "the contingency table is r×c — columns expand to the number of categories in the column variable; expected counts and row/column percentages are shown, with a warning (suggesting Fisher's exact) if expected counts are too small. For 2×2 tables chisq.test() applies Yates' continuity correction by default (set correct=FALSE for the uncorrected χ²)." },
  figures: [{ caption: 'Cross-classification', type: 'mosaic or grouped bar chart', file: 'bar' }],
  howToRead:
    'Tests whether two categorical variables are associated. A p below alpha means they are related; ' +
    "Cramér's V gives the strength of association (0–1). Valid only when expected counts are mostly ≥ 5 " +
    "(the app flags this and suggests Fisher's exact) and each case appears once (raw counts, not percentages).",
  apaTemplate: 'A chi-square test of independence was significant, χ²({df}, N={n})={chisq}, p={p}, V={v}.',
  rMap: 'chisq.test() → Table 2 · sqrt(χ²/(N·min(r−1,c−1))) (matches rcompanion::cramerV) → V · ggplot2::geom_bar() → figure',
  bundleFiles: ['table_contingency.png', 'table_chi-square.png', 'figure_bar.png'],
}
