import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (One-sample t-test card) + telos_test_inputs.html (Outcome slot, option strip).
export const ONE_SAMPLE_T_TEST: TestSpec = {
  id: 'one-sample-t-test',
  name: 'One-sample t-test',
  question: 'does a mean differ from a fixed value?',
  roles: [
    { id: 'outcome', label: 'Outcome', levels: 'interval / ratio', arity: 'exactly 1' },
  ],
  options: [
    // μ₀ is interactive this slice (design ruling): typed scalar, drawn default 0 — feeds Table 2's 'Test value' cell and the figure's reference line.
    { id: 'mu0', label: 'test value (μ₀)', value: '0', kind: 'number', default: 0,
      hint: 'The test value defaults to 0, so be sure to set it to the figure that actually matters for your question.' },
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'tails', label: 'tails', value: 'two-tailed', kind: 'select', choices: ['two-tailed', 'one-tailed (greater)', 'one-tailed (less)'], hint: 'one-tailed needs a directional hypothesis set in advance' },
    { id: 'ci', label: 'CI', value: '95%', kind: 'select', choices: ['90%', '95%', '99%'] },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
    ],
    minRule: { kind: 'values', n: 3 }, // design §4: N ≥ 3 single column (Shapiro lower bound)
  },
  tables: [
    { id: 'descriptives', domId: 'one-sample-descriptives', title: 'Descriptives', // domId: '#table-descriptives' would collide with Summary statistics on a combined page
      columns: [{ key: 'variable', label: 'Variable' }, { key: 'n', label: 'N' }, { key: 'mean', label: 'M' }, { key: 'sd', label: 'SD' }, { key: 'se', label: 'SE' }] },
    { id: 't-test', domId: 'one-sample-t-test', title: 'One-sample t-test', // domId: '#table-t-test' would collide with the independent/paired Table 2 on a combined page; the zip keeps table_t-test.png
      columns: [{ key: 'mu0', label: 'Test value' }, { key: 't', label: 't' }, { key: 'df', label: 'df' }, { key: 'p', label: 'p' }, { key: 'mdiff', label: 'M', sub: 'diff' }, { key: 'ci', label: '95% CI' }, { key: 'd', label: 'd' }] },
  ],
  tableNote: { kind: 'assume', text: 'assumption check: normality (Shapiro-Wilk) reported under the descriptives.' },
  figures: [{ caption: 'Value vs. test value', type: 'distribution' }],
  howToRead:
    'Compares your sample mean to a fixed value. A p below alpha means the mean differs from that value; ' +
    'the mean difference and 95% CI show by how much (its sign tells you whether the mean is above or below the test value), ' +
    "and Cohen's d gives the effect size. A p at or above alpha does not prove the mean equals the test value — only that you lack evidence it differs.",
  apaTemplate: 'A one-sample t-test gave M={m} vs. {mu0}, t({df})={t}, p {p}, d={d}.',
  rMap: 't.test(x, mu=) → Table 2 · effectsize::cohens_d() → d · ggplot2 → figure',
  bundleFiles: ['table_descriptives.png', 'table_t-test.png', 'figure_distribution.png'],
}
