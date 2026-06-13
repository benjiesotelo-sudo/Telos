import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Chi-square goodness-of-fit cards) — display strings verbatim.
export const CHI_SQUARE_GOF: TestSpec = {
  id: 'chi-square-goodness-of-fit',
  name: 'Chi-square goodness-of-fit',
  question: 'do counts match an expected split?',
  roles: [
    { id: 'variable', label: 'Variable', levels: 'nominal / ordinal', arity: 'exactly 1' },
  ],
  options: [
    // Card order: expected proportions first, then α. R1 ruling: custom proportions ship now.
    { id: 'expectedProps', label: 'expected proportions', value: 'equal', kind: 'proportions' },
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
  ],
  constraints: {
    roles: [
      { roleId: 'variable', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { min: 2 } },
    ],
    minRule: { kind: 'used-columns', n: 1 },
  },
  tables: [
    { id: 'observed-expected', title: 'Observed vs. expected',
      columns: [{ key: 'category', label: 'Category' }, { key: 'observed', label: 'Observed' }, { key: 'expected', label: 'Expected' }, { key: 'stdres', label: 'Std. residual' }] },
    { id: 'chi-square', title: 'Goodness-of-fit test', domId: 'gof-chi-square', // 'chi-square' also lives on the independence card
      columns: [{ key: 'chisq', label: 'χ²' }, { key: 'df', label: 'df (k−1)' }, { key: 'p', label: 'p' }, { key: 'w', label: "Cohen's w" }] },
  ],
  tableNote: { kind: 'plain', text: 'here df = number of categories − 1 (not (r−1)(c−1) as in the independence test).' },
  figures: [{ caption: 'Observed vs. expected', type: 'bar chart (observed vs. expected)', file: 'bar' }],
  howToRead:
    "Tests whether one categorical variable's counts depart from an expected distribution (equal by default). " +
    'A p below alpha means the observed split differs from expected; a standardized residual beyond about ±1.96 flags ' +
    'a category that significantly drives the result. Valid only when expected counts are mostly ≥ 5 (some texts allow ' +
    '≥ 1 if no more than 20% are below 5); for sparse categories use an exact / simulated test instead.',
  apaTemplate: 'A goodness-of-fit test, χ²({df}, N={n})={chisq}, p {p}, w={w}.',
  rMap: 'chisq.test(x, p=) → Table 2 · chisq.test(...)$stdres → Table 1 std. residuals · effectsize::cohens_w() → w · chisq.test(..., simulate.p.value=TRUE) for sparse data · ggplot2 → figure',
  bundleFiles: ['table_observed-expected.png', 'table_chi-square.png', 'figure_bar.png'],
}
