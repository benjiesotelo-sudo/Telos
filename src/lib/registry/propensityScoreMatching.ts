import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Propensity score matching card).
// Report-only APA — the drawn template asserted balance ("all SMDs < .1") that may be FALSE; NEUTRALISED to
// report the ATT only (balance is reported in Table 1). cobalt unavailable → love plot hand-rolled in ggplot2.
// v1: method='nearest' only (optimal/full need optmatch, not WebR-shipped); covariates numeric.
export const PROPENSITY_SCORE_MATCHING: TestSpec = {
  id: 'propensity-score-matching',
  name: 'Propensity score matching',
  question: 'treatment effect via matching',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'treatment', label: 'Treatment', levels: 'binary nominal', arity: 'exactly 1 · 2 categories', hint: 'e.g. who got the treatment — treated = 1 / 0' },
    { id: 'covariates', label: 'Covariates', levels: 'any level', arity: 'one or more', hint: 'e.g. variables to match / control on — age, baseline score' },
  ],
  options: [
    { id: 'method', label: 'matching method', value: 'nearest', kind: 'display' },
    { id: 'caliper', label: 'caliper', value: 'off', kind: 'number', default: 0, hint: '0 = off; otherwise in propensity-SD units' },
    { id: 'ratio', label: 'ratio', value: '1:1', kind: 'select', choices: ['1:1', '2:1', '3:1'] },
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
    // modelsummary coef table (design 2026-06-16): ATT as one stacked term — est / (SE) / [CI] (z/p drop).
    // matched-N footer merges in (matching is preprocessing, not a fit → no R²/AIC/BIC/Log.Lik., spike 2026-06-16).
    {
      id: 'att', title: 'Treatment effect (ATT)', domId: 'psm-att', kind: 'coef',
      columns: [{ key: 'term', label: '' }, { key: 'est', label: '(1)' }],
      models: [{ key: 'est', label: '(1)' }],
      gof: [{ key: 'matchedN', label: 'Num.Obs.' }, { key: 'treatedN', label: 'Treated (matched)' }, { key: 'controlN', label: 'Control (matched)' }],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'good matching drives post-matching standardized mean differences toward 0 (commonly < 0.1). The common-support rows report how many treated units fell off the region of common support (dropped) and the propensity-score overlap range by group — wide non-overlap weakens the comparison.',
    afterTableId: 'psm-att',
  },
  figures: [{ caption: 'Balance', type: 'love plot (standardized differences before vs. after matching)', file: 'love-plot' }],
  howToRead:
    'First confirm balance — matched groups should look alike on the covariates (small standardized differences). Then read the ATT as the treatment effect for the treated, with p/CI. The common-support rows tell you how many treated units were dropped for lacking a comparable control and where the two groups’ propensity scores overlap — good overlap with few drops means the ATT generalizes to most of the treated. PSM only balances the covariates you measured and included, so the causal reading also assumes no important confounder was left unmeasured (ignorability) — an assumption that cannot be verified from the data.',
  apaTemplate: 'After propensity-score matching, the ATT was {b}, 95% CI [{lo}, {hi}], p {p}.',
  rMap: 'MatchIt::matchit() → balance + matched data · lm()/marginaleffects on matched data → ATT · cobalt::love.plot()',
  bundleFiles: ['table_balance.png', 'table_att.png', 'figure_love-plot.png'],
}
