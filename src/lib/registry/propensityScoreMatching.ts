import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Propensity score matching card).
// Report-only APA — the drawn template asserted balance ("all SMDs < .1") that may be FALSE; NEUTRALISED to
// report the ATT only (balance is reported in Table 1). cobalt unavailable → love plot hand-rolled in ggplot2.
// v1: method='nearest' only (optimal/full need optmatch, not WebR-shipped); covariates numeric.
export const PROPENSITY_SCORE_MATCHING: TestSpec = {
  id: 'propensity-score-matching',
  name: 'Propensity score matching',
  question: 'a treatment effect estimated after matching treated and control cases on covariates',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the numeric result you measured — health, earnings' },
    { id: 'treatment', label: 'Treatment', levels: 'binary nominal', arity: 'exactly 1', hint: 'e.g. enrolled = 1 / 0 (2 groups)' },
    { id: 'covariates', label: 'Covariates', levels: 'interval / ratio', arity: 'one or more', hint: 'e.g. variables that drive selection — experience, age, ability' },
  ],
  options: [
    { id: 'method', label: 'matching method', value: 'nearest', kind: 'display' },
    { id: 'ratio', label: 'ratio', value: '1:1', kind: 'select', choices: ['1:1', '2:1', '3:1'] },
    { id: 'caliper', label: 'caliper', value: '0', kind: 'number', default: 0, hint: '0 = off; otherwise in propensity-SD units' },
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
    { id: 'ci', label: 'CI', value: '95%', kind: 'select', choices: ['90%', '95%', '99%'] },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, excludeTag: 'datetime' },
      { roleId: 'treatment', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { exact: 2 } },
      { roleId: 'covariates', levels: ['interval', 'ratio'], arity: { min: 1, max: Infinity }, excludeTag: 'datetime' },
    ],
    minRule: { kind: 'rows-per-group', n: 10 },
  },
  tables: [
    {
      id: 'balance', title: 'Covariate balance (before / after)', domId: 'psm-balance',
      columns: [
        { key: 'covariate', label: 'Covariate' }, { key: 'smdPre', label: 'Std. mean diff (pre)' },
        { key: 'smdPost', label: 'Std. mean diff (post)' }, { key: 'varRatio', label: 'Variance ratio' },
      ],
    },
    {
      id: 'att', title: 'Treatment effect (ATT)', domId: 'psm-att',
      columns: [
        { key: 'estimate', label: 'Estimate' }, { key: 'se', label: 'SE' },
        { key: 't', label: 't' }, { key: 'p', label: 'p' }, { key: 'ci', label: '95% CI' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'Confirm balance first — matched groups should have small standardized differences (a rule of thumb is < .1). PSM only balances the covariates you measured and included; the causal reading also assumes no important confounder was left unmeasured (ignorability), which cannot be verified from the data.',
    afterTableId: 'psm-att',
  },
  figures: [{ caption: 'Balance (love plot)', type: 'standardized differences before vs. after matching', file: 'love-plot' }],
  howToRead:
    'First confirm balance — matched groups should look alike on the covariates (small standardized differences). Then read the ATT as the treatment effect for the treated, with p/CI. PSM only balances the covariates you measured and included, so the causal reading also assumes no important confounder was left unmeasured (ignorability) — an assumption that cannot be verified from the data.',
  apaTemplate: 'After propensity-score matching, the ATT was {b}, {pct}% CI [{lo}, {hi}], p {p}.',
  rMap: 'MatchIt::matchit(treat ~ covariates, method="nearest") → balance + matched data · lm(y ~ treat, weights) → ATT · ggplot2 → love plot',
  bundleFiles: ['table_balance.png', 'table_att.png', 'figure_love-plot.png'],
}
