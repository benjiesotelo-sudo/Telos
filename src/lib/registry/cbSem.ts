import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (CB-SEM card, lines 1126-1157) -- display strings verbatim.
// Convention (SEM reporting, approved 2026-06-18):
//   - Pipeline modes resolve to fixed output shapes: full (EFA?+CFA+fit+structural) / cfa-only / path.
//   - CFA loadings carry B/SE/z/p alongside the standardized loading (label stays "Std. loading"); reliability adds omega.
//   - Structural paths carry B alongside Std. beta. Fit table suppressed when fitMeasures(fit,'df')==0 (saturation).
//   - Bootstrap 5000 (percentile CI); standardizedSolution()/standardizedSolution_boot(); compRelSEM() not reliability().
export const CB_SEM: TestSpec = {
  id: 'cb-sem',
  name: 'CB-SEM',
  question: 'confirmatory structural model',
  inputKind: 'sem-canvas',
  roles: [],
  options: [
    { id: 'estimator', label: 'estimator', value: 'WLSMV (ordinal) / ML / MLR', kind: 'display' },
    { id: 'missing', label: 'missing', value: 'MI', kind: 'display' },
    { id: 'bootstrap', label: 'bootstrap', value: '5000', kind: 'display' },
  ],
  constraints: {
    roles: [],
    minRule: { kind: 'values', n: 20 },
  },
  tables: [
    {
      id: 'efa-suitability',
      title: 'EFA suitability',
      columns: [
        { key: 'kmo', label: 'KMO' },
        { key: 'bartlettChisq', label: "Bartlett's χ²" },
        { key: 'df', label: 'df' },
        { key: 'p', label: 'p' },
      ],
    },
    {
      id: 'efa-loadings',
      title: 'EFA rotated factor loadings',
      columns: [
        { key: 'item', label: 'Item' },
        { key: 'f1', label: 'Factor 1' },
        { key: 'f2', label: 'Factor 2' },
        { key: 'communality', label: 'Communality' },
      ],
    },
    {
      id: 'cfa-loadings',
      title: 'Measurement model (CFA loadings)',
      columns: [
        { key: 'path', label: 'Construct → Item' },
        { key: 'b', label: 'B' },
        { key: 'se', label: 'SE' },
        { key: 'z', label: 'z' },
        { key: 'p', label: 'p' },
        { key: 'std', label: 'Std. loading' },
      ],
    },
    {
      id: 'reliability',
      title: 'Reliability & validity',
      columns: [
        { key: 'construct', label: 'Construct' },
        { key: 'cr', label: 'CR' },
        { key: 'ave', label: 'AVE' },
        { key: 'omega', label: 'ω' },
        { key: 'alpha', label: 'α' },
      ],
    },
    {
      id: 'fit-indices',
      title: 'Fit indices',
      columns: [
        { key: 'chisq', label: 'χ² (df, p)' },
        { key: 'chisqDf', label: 'χ²/df' },
        { key: 'cfi', label: 'CFI' },
        { key: 'tli', label: 'TLI' },
        { key: 'rmsea', label: 'RMSEA [90% CI]' },
        { key: 'srmr', label: 'SRMR' },
      ],
    },
    {
      id: 'structural-paths',
      title: 'Structural paths',
      columns: [
        { key: 'path', label: 'Path' },
        { key: 'b', label: 'B' },
        { key: 'se', label: 'SE' },
        { key: 'z', label: 'z' },
        { key: 'p', label: 'p' },
        { key: 'beta', label: 'Std. β' },
        { key: 'ci', label: '95% CI' },
        { key: 'r2', label: 'R²' },
      ],
    },
    {
      id: 'indirect-effects',
      title: 'Indirect effects (mediation)',
      columns: [
        { key: 'path', label: 'Path' },
        { key: 'est', label: 'Estimate' },
        { key: 'se', label: 'SE' },
        { key: 'ci', label: 'boot 95% CI' },
        { key: 'p', label: 'p' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'Tables shown follow the pipeline stages you ran (EFA → CFA → fit → structural); if EFA was deselected, Tables 1–2 are omitted; if the structural stage was deselected, Tables 6–7 are omitted. Good-fit guidelines (Hu & Bentler, 1999; Marsh, Hau & Wen, 2004): CFI/TLI ≥ .95, RMSEA ≤ .06 [90% CI], SRMR ≤ .08 — guidelines, not pass/fail gates; RMSEA is unstable at small df / small N, so interpret it cautiously for compact models. Use WLSMV for ordinal indicators. R² is filled once per endogenous (outcome) construct. When the model is saturated (df = 0, e.g. a just-identified path model), the fit-indices table is suppressed and a saturation flag is shown. EFA on the same sample is exploratory — treat it as a diagnostic, not confirmatory evidence. The indirect-effects table appears only when the drawn structural paths form a chain (X → M → Y); each indirect effect is a lavaan defined effect with a bootstrapped 95% CI. Moderation is planned for a later version.',
    afterTableId: 'indirect-effects',
  },
  figures: [
    { caption: 'Model', type: 'path diagram (constructs, loadings, structural paths)', file: 'path-diagram' },
  ],
  howToRead:
    'First confirm the measurement model (loadings high, CR/AVE adequate) and overall fit indices. Then read the structural paths: each std. β with p/CI is a hypothesized relationship between constructs; R² shows variance explained in each outcome construct. CB-SEM is confirmatory: the measurement model must be specified from theory a priori — any post-hoc respecification (e.g. from modification indices) is exploratory, must be reported as such, and ideally cross-validated on a fresh sample.',
  apaTemplate: 'The model fit well (CFI=__, RMSEA=__, SRMR=__); the path from X to Y gave β=__, p=__.',
  rMap: '(if EFA stage run) psych::KMO()/cortest.bartlett() → Table 1 · psych::fa() → Table 2 · lavaan::sem() (estimator ML/MLR or WLSMV) → loadings & structural paths · lavaan::fitMeasures() (or summary(fit, fit.measures=TRUE)) → Table 5 fit indices (χ²/df = chisq/df) · semTools::compRelSEM() / AVE() / psych::alpha() → CR/AVE/ω/α table · lavInspect(fit, "rsquare") → Table 6 R² · defined effects (:= in the lavaan syntax, se="bootstrap") → Table 7 indirect effects · semPlot::semPaths() → diagram',
  bundleFiles: [
    'table_efa-suitability.png (when EFA stage selected)',
    'table_efa-loadings.png (when EFA stage selected)',
    'table_cfa-loadings.png',
    'table_reliability.png',
    'table_fit-indices.png',
    'table_structural-paths.png (when structural stage selected)',
    'table_indirect-effects.png (when mediation paths drawn)',
    'figure_path-diagram.png',
  ],
}
