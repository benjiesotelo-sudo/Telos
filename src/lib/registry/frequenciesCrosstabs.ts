import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (Frequencies & cross-tabs card) + telos_test_inputs.html (role slot, option strip).
export const FREQUENCIES_CROSSTABS: TestSpec = {
  id: 'frequencies-crosstabs',
  name: 'Frequencies & cross-tabs',
  question: 'counts for categorical data',
  roles: [
    { id: 'variables', label: 'Variable(s)', levels: 'nominal / ordinal', arity: '1 to 2',
      hint: 'Drag one category column into Variable(s) for a simple frequency table, or drag a second category column to build a cross-tab that counts the combinations of the two.' },
  ],
  options: [ // both pills informational — interactive options this slice are ONLY One-sample μ₀ + the MW/Wilcoxon continuity toggle (Benjie's ruling)
    { id: 'countsPercentages', label: 'counts / percentages', value: 'counts', kind: 'display' },
    { id: 'crosstab', label: 'cross-tab', value: 'when 2 variables', kind: 'display' },
  ],
  constraints: {
    roles: [{ roleId: 'variables', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 2 } }],
    minRule: { kind: 'used-columns', n: 1 }, // ≥1 compatible Used column
  },
  tables: [
    { id: 'frequencies', title: 'Frequency distribution (one variable)',
      columns: [{ key: 'category', label: 'Category' }, { key: 'n', label: 'n' }, { key: 'pct', label: '%' }, { key: 'cumpct', label: 'Cumulative %' }] },
    // Drawn PLACEHOLDER columns. The builder replaces Col 1/Col 2/… with one column per category of the
    // SECOND variable + Total ("cross-tab columns expand to the number of categories in the column variable").
    { id: 'crosstab', title: 'Cross-tabulation (two variables · n, row %, col %)',
      columns: [{ key: 'rowcat', label: 'Row \\ Column' }, { key: 'c1', label: 'Col 1' }, { key: 'c2', label: 'Col 2' }, { key: 'more', label: '…' }, { key: 'total', label: 'Total' }] },
  ],
  tableNote: { kind: 'plain', text: 'cross-tab columns expand to the number of categories in the column variable; each cell shows the count plus row and column percentages.' },
  figures: [{ caption: 'Category counts', type: 'bar' }], // card ftype "bar chart (grouped bar for a cross-tab)" → one slot, type 'bar' (bundle: figure_bar.png)
  howToRead:
    'Frequencies show how many cases fall in each category and what share of the total that is. ' +
    'A cross-tab shows counts for combinations of two categories — to test whether the two are related, run a chi-square test.',
  apaTemplate: 'Frequencies (and cross-tabulations) are reported in Table {n}.',
  rMap: 'janitor::tabyl() (+ adorn_* for cross-tab %, cumsum() for cumulative %) → tables · ggplot2::geom_bar() → figure',
  bundleFiles: ['table_frequencies.png', 'table_crosstab.png', 'figure_bar.png'],
}
