import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (Paired t-test card) + telos_test_inputs.html (roles, option strip).
export const PAIRED_T_TEST: TestSpec = {
  id: 'paired-t-test',
  name: 'Paired t-test',
  question: 'do two related measurements differ?',
  roles: [
    { id: 'conditionA', label: 'Condition A', levels: 'interval / ratio', arity: 'exactly 1' },
    { id: 'conditionB', label: 'Condition B', levels: 'interval / ratio', arity: 'exactly 1' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'tails', label: 'tails', value: 'two', kind: 'display' },
    { id: 'ci', label: 'CI', value: '95%', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'conditionA', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'conditionB', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 },
  },
  tables: [
    { id: 'paired-descriptives', title: 'Paired descriptives',
      columns: [{ key: 'condition', label: 'Condition' }, { key: 'n', label: 'N' }, { key: 'mean', label: 'M' }, { key: 'sd', label: 'SD' }] },
    { id: 't-test', domId: 'paired-t-test', title: 'Paired-samples t-test', // domId: '#table-t-test' would collide with the independent/one-sample Table 2 on a combined page; the zip keeps table_t-test.png
      columns: [{ key: 'pair', label: 'Pair' }, { key: 't', label: 't' }, { key: 'df', label: 'df' }, { key: 'p', label: 'p' },
        { key: 'mdiff', label: 'M', sub: 'diff' }, { key: 'ci', label: '95% CI' }, { key: 'd', label: 'd', sub: 'z' }] },
  ],
  tableNote: { kind: 'assume', text: 'assumption check: normality of the difference scores.' },
  // type 'difference' derives the card's bundle name figure_difference.png; the drawn
  // "type: paired-lines / difference plot" line is pinned literally in the consistency test.
  figures: [{ caption: 'Change per case', type: 'difference' }],
  howToRead:
    'Tests whether the average change between two related measurements (e.g. before vs. after) differs from zero. ' +
    'A p below alpha means a significant change; the mean difference, CI and dz describe its size (their sign depends on the subtraction order, A−B). ' +
    'A p at or above alpha does not prove there was no change — only that none was detected.',
  apaTemplate: 'A paired-samples t-test gave M={mdiff}, t({df})={t}, p {p}, dz={dz}.',
  rMap: 'dplyr::summarise() / psych::describe() → Table 1 (per-condition N/M/SD) · t.test(paired=TRUE) → Table 2 · effectsize::cohens_d(paired=TRUE) → dz · ggplot2 → figure',
  bundleFiles: ['table_paired-descriptives.png', 'table_t-test.png', 'figure_difference.png'],
}
