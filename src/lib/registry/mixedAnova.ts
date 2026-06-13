import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Mixed ANOVA cards, commit 42526c1) — display strings verbatim.
export const MIXED_ANOVA: TestSpec = {
  id: 'mixed-anova',
  name: 'Mixed ANOVA',
  question: 'between-groups × repeated conditions',
  roles: [
    { id: 'subject', label: 'Subject ID', levels: 'any level', arity: 'exactly 1',
      hint: 'e.g. the column identifying each person — participant_id' },
    { id: 'between', label: 'Between-groups factor', levels: 'nominal / ordinal', arity: 'exactly 1',
      hint: 'e.g. the column splitting people into groups — treatment vs control' },
    { id: 'measures', label: 'Repeated measures', levels: 'interval / ratio', arity: '2 or more',
      hint: 'e.g. same measure each time — score_t1, score_t2, score_t3' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'sphericity', label: 'sphericity', value: 'GG correction', kind: 'select',
      choices: ['GG correction', 'HF correction', 'none'] },
    { id: 'posthoc', label: 'post-hoc', value: 'on', kind: 'toggle', default: true },
  ],
  constraints: {
    roles: [
      { roleId: 'subject', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'between', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 } },
      { roleId: 'measures', levels: ['interval', 'ratio'], arity: { min: 2, max: Infinity } },
    ],
    minRule: { kind: 'complete-wide-rows', n: 3 },
  },
  tables: [
    { id: 'descriptives', domId: 'mixed-anova-descriptives', title: 'Descriptives by group × condition',
      columns: [{ key: 'group', label: 'Group' }, { key: 'condition', label: 'Condition' },
        { key: 'n', label: 'N' }, { key: 'm', label: 'M' }, { key: 'sd', label: 'SD' }] },
    { id: 'mixed-anova', domId: 'mixed-anova-mixed-anova', title: 'Mixed ANOVA',
      columns: [{ key: 'source', label: 'Source' }, { key: 'ss', label: 'SS' }, { key: 'df', label: 'df' },
        { key: 'ms', label: 'MS' }, { key: 'f', label: 'F' }, { key: 'p', label: 'p' },
        { key: 'pes', label: 'partial η²' }] },
    { id: 'sphericity', domId: 'mixed-anova-sphericity', title: "Sphericity (Mauchly's test)",
      columns: [{ key: 'effect', label: 'Effect' }, { key: 'w', label: 'W' }, { key: 'p', label: 'p' },
        { key: 'gg', label: 'GG ε' }, { key: 'hf', label: 'HF ε' }] },
    { id: 'posthoc', domId: 'mixed-anova-posthoc', title: 'Post-hoc comparisons (condition pairs)',
      columns: [{ key: 'pair', label: 'Pair' }, { key: 'mdiff', label: 'M', sub: 'diff' },
        { key: 'se', label: 'SE' }, { key: 'padj', label: 'p', sub: 'adj' }, { key: 'ci', label: '95% CI' }] },
  ],
  tableNote: { kind: 'assume', text: 'between and within effects are tested against different error terms; when sphericity is violated the within and interaction F-tests use the Greenhouse–Geisser / Huynh–Feldt correction. Mauchly\'s test & the GG/HF corrections apply only when the repeated factor has 3+ levels (with 2 levels sphericity is automatically met and this table is omitted).' },
  figures: [{ caption: 'Means across conditions by group', type: 'profile plot (one line per group, means ± CI across conditions)' , file: 'profile' }],
  howToRead:
    'Read the Group × Condition interaction first — a significant interaction means the groups changed differently across conditions; only then read the main effects. ' +
    'Check sphericity for the within and interaction terms — if violated, read the corrected F/p. ' +
    "When the group × condition interaction is significant, the overall condition comparisons in the post-hoc table can mislead — read each group's line on the profile plot instead.",
  apaTemplate: 'A mixed ANOVA yielded a {between_name} × {within_name} interaction, F({df1},{df2})={f}, p {p}, partial η²={pes}.',
  rMap: 'dplyr::group_by()+summarise() → Table 1 (group × condition N/M/SD) · afex::aov_ez() → Tables 2–3 · emmeans → Table 4 (post-hoc) · ggplot2 → profile plot',
  bundleFiles: ['table_descriptives.png', 'table_mixed-anova.png', 'table_sphericity.png', 'table_posthoc.png', 'figure_profile.png'],
}
