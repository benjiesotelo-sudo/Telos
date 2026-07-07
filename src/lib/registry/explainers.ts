// Term-led explainer registry (A5): for the ~6 representative cards worked through in the spec
// (docs/superpowers/specs/2026-07-06-telos-citable-complete-design.md §A5+F1), each reported statistic
// gets ONE entry: bold term -> one-sentence meaning -> interpretation of THIS run's value with the
// number woven in (owner's R² example is normative). `key` matches the registry column key / reported
// stat name (machine-checked for full coverage by U8-T2's consistency test - not yet added here).
// `interpret` reads from `ResultValues`, a flat lookup populated per-card by `CardContent.values`
// (wired in U8-T3; this task only builds the module + renderer + these 6 cards' entries).

export type ResultValues = Record<string, number | string | null | undefined>

export interface Explainer {
  key: string
  term: string
  meaning: string
  interpret: (v: ResultValues) => string
}

export const EXPLAINERS: Record<string, Explainer[]> = {
  'independent-t-test': [
    { key: 't', term: 't', meaning: 'How many standard errors the two group means are apart.',
      interpret: (v) => `Here, t(${v.df}) = ${v.t}.` },
    { key: 'p', term: 'p', meaning: 'The probability of a difference this large (or larger) if the groups truly had equal means.',
      interpret: (v) => `Here, p ${v.p}${Number(String(v.p).replace(/[<>=\s]/g, '')) < 0.05 ? ' - below the conventional .05 threshold, a significant difference.' : ' - at or above the conventional .05 threshold, no significant difference detected.'}` },
    { key: 'd', term: "Cohen's d", meaning: 'The size of the gap in standard-deviation units (~0.2 small, 0.5 medium, 0.8 large).',
      interpret: (v) => `Here, d = ${v.d} [${v.dlo}, ${v.dhi}].` },
  ],
  'one-way-anova': [
    { key: 'f', term: 'F', meaning: 'The ratio of between-group to within-group variance - larger means the groups differ more than chance predicts.',
      interpret: (v) => `Here, F(${v.df1}, ${v.df2}) = ${v.f}.` },
    { key: 'eta2', term: 'η²', meaning: 'The proportion of total variance explained by group membership (~.01 small, .06 medium, .14 large).',
      interpret: (v) => `Here, η² = ${v.eta2} [${v.eta2lo}, ${v.eta2hi}].` },
  ],
  pearson: [
    { key: 'r', term: "Pearson's r", meaning: 'The strength and direction of the linear relationship, from -1 to +1.',
      interpret: (v) => `Here, r(${v.df}) = ${v.r}, 95% CI [${v.ciLow}, ${v.ciHigh}] - a ${Math.abs(Number(v.r)) < 0.1 ? 'negligible' : Math.abs(Number(v.r)) < 0.3 ? 'small' : Math.abs(Number(v.r)) < 0.5 ? 'medium' : 'large'} ${Number(v.r) >= 0 ? 'positive' : 'negative'} relationship.` },
  ],
  'multiple-linear-regression': [
    { key: 'r2', term: 'R²', meaning: "The share of the outcome's variance jointly explained by all predictors.",
      interpret: (v) => `Here, R² = ${v.r2}, so the model accounts for about ${v.r2 !== undefined ? Math.round(Number(v.r2) * 100) : '?'}% of the variance in the outcome.` },
    { key: 'vif', term: 'VIF', meaning: "How much a predictor's variance is inflated by overlap with the other predictors (multicollinearity); values above ~5-10 are cause for concern (O'Brien, 2007).",
      interpret: (v) => `Here, the largest VIF in this run is ${v.vifMax}.` },
  ],
  did: [
    { key: 'b', term: 'Treated×Post (B)', meaning: 'The estimated causal effect of the treatment, holding entity and period fixed effects constant.',
      interpret: (v) => `Here, B = ${v.b}, 95% CI [${v.lo}, ${v.hi}], p ${v.p}.` },
  ],
  'cb-sem': [
    { key: 'cfi', term: 'CFI', meaning: 'How much better the model fits than a baseline with no relationships at all (≥ .95 is a common, non-binding guideline).',
      interpret: (v) => `Here, CFI = ${v.cfi}.` },
    { key: 'rmsea', term: 'RMSEA', meaning: 'The average model misfit per degree of freedom, penalizing complexity (≤ .06 is a common, non-binding guideline).',
      interpret: (v) => `Here, RMSEA = ${v.rmsea} [90% CI ${v.rmseaLo}, ${v.rmseaHi}].` },
  ],
}
