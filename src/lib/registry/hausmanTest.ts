import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Hausman test card).
// Report-only APA — the drawn template hardcoded a verdict ("favoured fixed effects"); NEUTRALISED here to
// report the statistic + p only. The Decision column is computed from actual p vs α (never hardcoded).
export const HAUSMAN_TEST: TestSpec = {
  id: 'hausman-test',
  name: 'Hausman test',
  question: 'fixed vs. random effects?',
  roles: [
    { id: 'entity', label: 'Entity', levels: 'nominal / ordinal', arity: 'exactly 1', hint: 'e.g. the unit observed repeatedly — firm, country, student' },
    { id: 'time', label: 'Time', levels: 'datetime / ordered', arity: 'exactly 1', hint: 'e.g. the date / time-order column — month, year' },
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'regressors', label: 'Regressors', levels: 'any level', arity: 'one or more', hint: 'e.g. explanatory variables — R&D spend, leverage' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
  ],
  constraints: {
    roles: [
      { roleId: 'entity', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 } },
      { roleId: 'time', levels: [], arity: { min: 1, max: 1 }, timeOrder: true },
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, excludeTag: 'datetime' },
      { roleId: 'regressors', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: Infinity }, excludeTag: 'datetime' },
    ],
    minRule: { kind: 'panel', n: 12 },
  },
  tables: [
    {
      id: 'hausman', title: 'Hausman test', domId: 'hausman',
      columns: [
        { key: 'chisq', label: 'χ²' }, { key: 'df', label: 'df' }, { key: 'p', label: 'p' }, { key: 'decision', label: 'Decision' },
      ],
    },
    {
      id: 'fe-vs-re', title: 'FE vs. RE coefficients', domId: 'hausman-fe-vs-re',
      columns: [
        { key: 'term', label: 'Term' }, { key: 'feB', label: 'FE B' }, { key: 'reB', label: 'RE B' }, { key: 'diff', label: 'Difference' },
      ],
    },
  ],
  figures: [{ caption: 'FE vs. RE', type: 'side-by-side coefficient plot', file: 'coefficients' }],
  howToRead:
    'Tests whether the random-effects assumption holds. A p below alpha means the estimates differ systematically → use fixed effects; a non-significant p means random effects is acceptable (and more efficient).',
  apaTemplate: 'A Hausman test comparing the fixed- and random-effects estimates gave χ²({df})={chisq}, p {p}.',
  rMap: 'plm::phtest() → Table 1 · compare plm fits → Table 2',
  bundleFiles: ['table_hausman.png', 'table_fe-vs-re.png', 'figure_coefficients.png'],
}
