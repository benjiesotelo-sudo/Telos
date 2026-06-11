import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Summary statistics cards).
export const SUMMARY_STATISTICS: TestSpec = {
  id: 'summary-statistics',
  name: 'Summary statistics',
  question: 'central tendency & spread of numeric variables',
  roles: [
    { id: 'variables', label: 'Variables to summarize', levels: 'interval / ratio', arity: 'one or more' },
    { id: 'groupBy', label: 'Group by (optional)', levels: 'nominal / ordinal', arity: '0 or 1' },
  ],
  options: [
    { id: 'statistics', label: 'statistics', value: 'mean, SD, median, min/max', kind: 'display' },
    { id: 'add', label: 'add', value: 'skew / kurtosis', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'variables', levels: ['interval', 'ratio'], arity: { min: 1, max: Infinity } },
      { roleId: 'groupBy', levels: ['nominal', 'ordinal'], arity: { min: 0, max: 1 } },
    ],
    minRule: { kind: 'used-columns', n: 1 }, // ≥1 usable numeric column (design §min-data)
  },
  tables: [
    { id: 'descriptives', title: 'Descriptive statistics', captionStyle: 'bare',
      columns: [
        { key: 'variable', label: 'Variable' }, { key: 'n', label: 'N' }, { key: 'mean', label: 'M' }, { key: 'sd', label: 'SD' },
        { key: 'min', label: 'Min' }, { key: 'max', label: 'Max' }, { key: 'median', label: 'Median' },
        { key: 'skew', label: 'Skew' }, { key: 'kurtosis', label: 'Kurtosis' },
      ] },
  ],
  tableNote: { kind: 'plain', text: 'one row per chosen variable; a Group column is added when "Group by" is used (stats repeat per group).' },
  figures: [{ caption: 'Distribution', type: 'histogram', optional: true }],
  howToRead:
    'Descriptives summarize your data: the mean and median show the center, the SD and range show the spread, ' +
    'and skew/kurtosis show how far the shape departs from a normal bell curve. There is no significance test here.',
  // The card's exemplar sentence; the builder fills {x} with the literal 'X' — bare "Table." captions mean
  // there is no in-app table number to substitute (recorded decision).
  apaTemplate: 'Table {x} reports descriptive statistics for the study variables.',
  rMap: 'psych::describe() / dplyr summary → table · ggplot2::geom_histogram() → figure',
  bundleFiles: ['table_descriptives.png', 'figure_histogram.png (optional)'],
}
