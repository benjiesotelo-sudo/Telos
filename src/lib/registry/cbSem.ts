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
    { id: 'missing', label: 'missing', value: 'listwise (default) / FIML / MI / pairwise', kind: 'display' },
    { id: 'bootstrap', label: 'bootstrap', value: '5000', kind: 'display' },
  ],
  constraints: {
    roles: [],
    minRule: { kind: 'values', n: 20 },
  },
  tables: [
    {
      id: 'efa-suitability',
      captionStyle: 'preamble',
      preambleLabel: 'E1',
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
      captionStyle: 'preamble',
      preambleLabel: 'E2',
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
      domId: 'cb-sem-cfa-loadings',
      title: 'Measurement model (loadings, reliability & item descriptives)',
      columns: [
        { key: 'path', label: 'Construct / Item' },
        { key: 'mean', label: 'Mean' },
        { key: 'sd', label: 'SD' },
        { key: 'b', label: 'B' },
        { key: 'se', label: 'SE' },
        { key: 'z', label: 'z' },
        { key: 'p', label: 'p' },
        { key: 'std', label: 'Std. loading' },
        { key: 'omega', label: 'ω' },
        { key: 'alpha', label: 'α' },
        { key: 'cr', label: 'CR' },
        { key: 'ave', label: 'AVE' },
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
      id: 'fornell-larcker',
      domId: 'cb-sem-fornell-larcker',
      title: 'Discriminant validity (Fornell–Larcker)',
      columns: [],
    },
    {
      id: 'htmt',
      domId: 'cb-sem-htmt',
      title: 'Discriminant validity (HTMT)',
      columns: [],
    },
    {
      id: 'structural-paths',
      domId: 'cb-sem-structural-paths',
      title: 'Structural paths, indirect effects & moderation',
      columns: [
        { key: 'h', label: 'H' },
        { key: 'path', label: 'Path' },
        { key: 'b', label: 'B' },
        { key: 'beta', label: 'Std. β' },
        { key: 'p', label: 'p' },
        { key: 'percLower', label: 'Lower', span: { group: 'Percentile 95% CI' } },
        { key: 'percUpper', label: 'Upper', span: { group: 'Percentile 95% CI' } },
        { key: 'bcLower', label: 'Lower', span: { group: 'BC 95% CI' } },
        { key: 'bcUpper', label: 'Upper', span: { group: 'BC 95% CI' } },
        { key: 'result', label: 'Result' },
      ],
    },
    {
      id: 'conditional-effects',
      domId: 'cb-sem-conditional-effects',
      title: 'Conditional effects (simple slopes)',
      columns: [
        { key: 'level', label: 'Moderator level' },
        { key: 'b', label: 'B' },
        { key: 'se', label: 'SE' },
        { key: 'p', label: 'p' },
        { key: 'ci', label: 'boot 95% CI' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'Tables shown follow the pipeline stages you ran (EFA → CFA → fit → structural); if EFA was deselected, Tables E1–E2 are omitted; if the structural stage was deselected, Table 5 is omitted. Good-fit guidelines (Hu & Bentler, 1999; Marsh, Hau & Wen, 2004): CFI/TLI ≥ .95, RMSEA ≤ .06 [90% CI], SRMR ≤ .08 - guidelines, not pass/fail gates; RMSEA is unstable at small df / small N, so interpret it cautiously for compact models. Use WLSMV for ordinal indicators. R² is filled once per endogenous (outcome) construct. When the model is saturated (df = 0, e.g. a just-identified path model), the fit-indices table is suppressed and a saturation flag is shown. EFA on the same sample is exploratory - treat it as a diagnostic, not confirmatory evidence. Indirect effects appear only when the drawn structural paths form a chain (X → M → Y), each a lavaan defined effect with a bootstrapped 95% CI; moderation edges appear only when drawn on the canvas, each an interaction-term effect from the same bootstrap run. Discriminant validity also has its own card (AVE / convergent validity); it is included here so one run gives the complete measurement-model writeup.',
    afterTableId: 'structural-paths',
  },
  figures: [
    { caption: 'Model', type: 'path diagram (constructs, loadings, structural paths)', file: 'path-diagram' },
    { caption: 'Simple slopes', type: 'conditional-effects plot (whiskered 95% CI at -1SD/mean/+1SD)', file: 'simple-slopes', optional: true },
  ],
  howToRead:
    'First confirm the measurement model (loadings high, CR/AVE adequate) and overall fit indices. Then read the structural paths: each std. β with p/CI is a hypothesized relationship between constructs; R² shows variance explained in each outcome construct. CB-SEM is confirmatory: the measurement model must be specified from theory a priori - any post-hoc respecification (e.g. from modification indices) is exploratory, must be reported as such, and ideally cross-validated on a fresh sample.',
  apaTemplate: 'The model fit well (CFI={cfi}, RMSEA={rmsea}, SRMR={srmr}); the path from X to Y gave β={beta}, p={p}.',
  rMap: '(if EFA stage run) psych::KMO()/cortest.bartlett() → Table E1 · psych::fa() → Table E2 · lavaan::sem() (estimator ML/MLR or WLSMV) → loadings & structural paths · lavaan::fitMeasures() (or summary(fit, fit.measures=TRUE)) → Table 2 fit indices (χ²/df = chisq/df) · semTools::compRelSEM() / AVE() / psych::alpha() → CR/AVE/ω/α table (Table 1) · lavInspect(fit, "rsquare") → Table 5 R² · defined effects (:= in the lavaan syntax, se="bootstrap") → Table 5 indirect effects · semPlot::semPaths() → diagram',
  bundleFiles: [
    'table_efa-suitability.png (when EFA stage selected)',
    'table_efa-loadings.png (when EFA stage selected)',
    'table_cfa-loadings.png',
    'table_fit-indices.png',
    'table_fornell-larcker.png',
    'table_htmt.png',
    'table_structural-paths.png (when structural stage selected)',
    'table_conditional-effects.png (when moderation present)',
    'figure_path-diagram.png',
    'figure_simple-slopes.png (when moderation present)',
  ],
}
