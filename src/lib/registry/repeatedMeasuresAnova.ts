import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Repeated-measures ANOVA cards) — display strings verbatim.
export const REPEATED_MEASURES_ANOVA: TestSpec = {
  id: 'repeated-measures-anova',
  name: 'Repeated-measures ANOVA',
  question: '3+ conditions on the same subjects',
  roles: [
    { id: 'subject', label: 'Subject ID', levels: 'any level', arity: 'exactly 1',
      hint: 'e.g. the column identifying each person — participant_id' },
    { id: 'measures', label: 'Repeated measures', levels: 'interval / ratio', arity: '2 or more',
      hint: 'e.g. same measure each time — score_t1, score_t2, score_t3' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'sphericity', label: 'sphericity', value: 'GG correction', kind: 'select',
      choices: ['GG correction', 'HF correction', 'none'] },
    { id: 'posthoc', label: 'post-hoc', value: 'on', kind: 'toggle', default: true },
  ],
  constraints: {
    roles: [
      { roleId: 'subject', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'measures', levels: ['interval', 'ratio'], arity: { min: 2, max: Infinity } },
    ],
    minRule: { kind: 'complete-wide-rows', n: 3 },
  },
  tables: [
    { id: 'descriptives', domId: 'repeated-measures-anova-descriptives', title: 'Condition descriptives',
      columns: [{ key: 'condition', label: 'Condition' }, { key: 'n', label: 'N' }, { key: 'm', label: 'M' }, { key: 'sd', label: 'SD' }] },
    { id: 'rm-anova', domId: 'repeated-measures-anova-rm-anova', title: 'Repeated-measures ANOVA',
      columns: [{ key: 'source', label: 'Source' }, { key: 'ss', label: 'SS' }, { key: 'df', label: 'df' },
        { key: 'ms', label: 'MS' }, { key: 'f', label: 'F' }, { key: 'p', label: 'p' }, { key: 'pes', label: 'partial η²' }] },
    { id: 'sphericity', domId: 'repeated-measures-anova-sphericity', title: "Sphericity (Mauchly's test)",
      columns: [{ key: 'effect', label: 'Effect' }, { key: 'w', label: 'W' }, { key: 'p', label: 'p' },
        { key: 'gg', label: 'GG ε' }, { key: 'hf', label: 'HF ε' }] },
    { id: 'posthoc', domId: 'repeated-measures-anova-posthoc', title: 'Post-hoc comparisons',
      columns: [{ key: 'pair', label: 'Pair' }, { key: 'mdiff', label: 'M', sub: 'diff' }, { key: 'se', label: 'SE' },
        { key: 'padj', label: 'p', sub: 'adj' }, { key: 'ci', label: '95% CI' }] },
  ],
  tableNote: { kind: 'assume', text: 'when sphericity is violated the F-test uses the Greenhouse–Geisser / Huynh–Feldt correction; post-hoc table follows. Mauchly\'s test & the GG/HF corrections apply only when the repeated factor has 3+ levels (with 2 levels sphericity is automatically met and this table is omitted).' },
  figures: [{ caption: 'Means across conditions', type: 'profile plot (means ± CI across conditions)' , file: 'profile' }],
  howToRead:
    'Tests whether the average differs across conditions measured on the same people. Check sphericity first — if violated, read the corrected F/p. A significant result means conditions differ; post-hoc tests show which.',
  apaTemplate: 'A repeated-measures ANOVA (GG-corrected) found an effect of condition, F({df1},{df2})={f}, p={p}, partial η²={pes}.',
  rMap: 'dplyr::group_by()+summarise() → Table 1 (per-condition N/M/SD) · afex::aov_ez() → Tables 2–3 · emmeans → Table 4 (post-hoc) · ggplot2 → profile plot',
  bundleFiles: ['table_descriptives.png', 'table_rm-anova.png', 'table_sphericity.png', 'table_posthoc.png', 'figure_profile.png'],
}
