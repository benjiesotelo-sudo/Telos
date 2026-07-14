import type { TestSpec } from './types'

// Encoded from docs/specs/telos_test_outputs.html (PLS-SEM card, lines 1160-1188) — display strings verbatim.
// Convention (SEM reporting, approved 2026-06-18; measurement table merged U6-T1):
//   - Variance-based SEM (seminr); NO global fit indices (CFI/TLI/RMSEA).
//   - Measurement model (Table 1, A6 grouped device): construct rows (group header) carry α · ρ_A · CR (ρ_C) ·
//     AVE once; indicator child rows carry Mean · SD · the merged Loading/weight column · t · p. seminr
//     emits reliability as alpha/rhoC/AVE/rhoA → buildPlsSem SELECTS+REORDERS the group-row quadruple to
//     α/ρ_A/CR/AVE (Hair 2019 recommends ρ_A for PLS reliability reporting).
//   - HTMT (primary discriminant criterion) = construct × construct matrix (rendered via the matrix branch).
//   - Bootstrap 5000 (percentile CI); structural f² from summary(pls)$fSquare; Q² per §5.2 (blindfolding else PLSpredict).
//   - Indirect effects via seminr::specific_effect_significance() on the bootstrapped model.
export const PLS_SEM: TestSpec = {
  id: 'pls-sem',
  name: 'PLS-SEM',
  question: 'variance-based structural model',
  inputKind: 'sem-canvas',
  roles: [],
  options: [
    { id: 'weighting', label: 'weighting', value: 'path', kind: 'display' },
    { id: 'bootstrap', label: 'bootstrap', value: '5000', kind: 'display' },
    { id: 'missing', label: 'missing', value: 'global step-4a setting', kind: 'display' },
  ],
  constraints: {
    roles: [],
    minRule: { kind: 'values', n: 20 },
  },
  tables: [
    {
      id: 'measurement',
      domId: 'pls-sem-measurement',
      title: 'Measurement model',
      columns: [
        { key: 'path', label: 'Construct / item' },
        { key: 'alpha', label: 'α' },
        { key: 'rhoA', label: 'ρ', sub: 'A' },
        { key: 'rhoC', label: 'CR (ρ', sub: 'C', suffix: ')' },
        { key: 'ave', label: 'AVE' },
        { key: 'mean', label: 'Mean' },
        { key: 'sd', label: 'SD' },
        { key: 'loading', label: 'Loading / weight' },
        { key: 't', label: 't' },
        { key: 'p', label: 'p' },
      ],
    },
    {
      id: 'htmt',
      domId: 'pls-sem-htmt',
      title: 'Discriminant validity - HTMT (construct × construct)',
      columns: [], // MatrixTable — rendered via ApaTable matrix branch; columns unused
    },
    {
      id: 'structural',
      title: 'Structural paths',
      columns: [
        { key: 'h', label: 'H' },
        { key: 'path', label: 'Path' },
        { key: 'beta', label: 'β' },
        { key: 'p', label: 'p' },
        // R6 (Hair et al. 2019 completeness): f² (effect size per path, checklist step 4) and inner
        // VIF (structural collinearity, checklist step 1). Added after the spec twin was byte-pinned;
        // plsSem.consistency.test.ts's thead check filters exactly these two leaves (justified there).
        { key: 'f2', label: 'f²' },
        { key: 'vif', label: 'VIF' },
        { key: 'ciPercLo', label: 'Lower', span: { group: 'Percentile 95% CI' } },
        { key: 'ciPercHi', label: 'Upper', span: { group: 'Percentile 95% CI' } },
        { key: 'ciBcLo', label: 'Lower', span: { group: 'BC 95% CI' } },
        { key: 'ciBcHi', label: 'Upper', span: { group: 'BC 95% CI' } },
        { key: 'result', label: 'Result' },
      ],
    },
    {
      id: 'structural-quality',
      title: 'Structural model quality (per endogenous construct)',
      columns: [
        { key: 'construct', label: 'Construct' },
        { key: 'r2', label: 'R²' },
        { key: 'r2adj', label: 'R²', sub: 'adj' },
        { key: 'q2', label: 'Q²' },
      ],
    },
    {
      id: 'indirect-effects',
      domId: 'pls-sem-indirect-effects',
      title: 'Indirect effects (mediation)',
      columns: [
        { key: 'path', label: 'Path' },
        { key: 'est', label: 'Estimate' },
        { key: 'se', label: 'SE' },
        { key: 'ci', label: 'boot 95% CI' },
        { key: 'p', label: 'p' },
      ],
    },
    {
      id: 'conditional-effects',
      domId: 'pls-sem-conditional-effects',
      title: 'Conditional effects (simple slopes)',
      columns: [
        { key: 'level', label: 'Moderator level' },
        { key: 'b', label: 'β' },
        { key: 'se', label: 'SE' },
        { key: 'p', label: 'p' },
        { key: 'ci', label: 'boot 95% CI' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'HTMT is a construct-by-construct matrix (not a per-construct value) - columns expand to the number of constructs in the model; HTMT < .85/.90 supports discriminant validity (Henseler, Ringle & Sarstedt, 2015). Structural paths carry dual bootstrap 95% CIs from ONE run - percentile (primary) and a hand-rolled bias-corrected, non-accelerated interval (the same z0-adjusted-percentile algorithm as lavaan’s boot.ci.type=“bca.simple”, applied to seminr’s raw bootstrap draws since seminr has no built-in BC option; verified to match lavaan to 6 decimals on a shared fixture). Result is Supported/Not supported from the percentile CI excluding zero (α=.05); the BC column is comparative context. R² and Q² assess the structural model (f²: ~0.02 small, 0.15 medium, 0.35 large; Cohen, 1988). PLS-SEM deliberately has no global fit indices (CFI/TLI/RMSEA) - judge it by reliability & validity, then R²/Q²/f² (Hair et al., 2019). The indirect-effects table appears only when the drawn paths form a chain (X → M → Y). Formative constructs suppress AVE/HTMT and are judged by indicator weights, VIF, and redundancy convergent validity. Discriminant validity also has its own card (AVE / convergent validity); it is included here so one run gives the complete measurement-model writeup. Moderation edges (drawn on the canvas) appear as an additional structural row - an interaction construct via seminr’s two-stage method (Henseler & Chin, 2010) - with the same dual bootstrap CIs as every other path. Inner VIF (Table 3) checks collinearity among each endogenous construct’s predictors before their paths are interpreted (below 3 is ideal, above 5 signals collinearity problems; Hair et al., 2019); it shows a dash for a construct with a single predictor, where collinearity is undefined. Which tradition, when: CB-SEM (its own card) is confirmatory and factor-based - it tests a theory-derived model and is judged by global fit indices. PLS-SEM is prediction-oriented and composite-based - it maximizes explained variance in the endogenous constructs and has no global fit indices by design, which is why this card shows no fit-index table. Prefer CB-SEM to test an established theory; prefer PLS-SEM to predict key outcomes, for smaller samples, or when formative constructs are in the model (Hair et al., 2019).',
    afterTableId: 'indirect-effects',
  },
  figures: [
    { caption: 'Model', type: 'path diagram (with loadings, path coefficients, R²)', file: 'path-diagram' },
    { caption: 'Interaction plot (simple slopes)', type: 'two-line interaction plot (predicted outcome at IV -1SD/+1SD by moderator level; Aiken & West, 1991)', file: 'interaction-plot', optional: true },
  ],
  howToRead:
    'Like CB-SEM but variance-based and prediction-oriented (good for smaller samples / formative constructs). PLS-SEM does not use CB-SEM global fit indices (CFI/TLI/RMSEA) - judge it instead by reliability & validity (CR, AVE, HTMT), then R², Q² (predictive relevance) and f², with SRMR the only commonly reported approximate fit index. Read the bootstrapped path coefficients (β, p); f² is each path\'s effect size (~0.02 small, 0.15 medium, 0.35 large).',
  apaTemplate: 'In the PLS-SEM, the path from X to Y gave β={beta}, p={p} (bootstrap); R²Y={r2y}.',
  rMap: 'seminr → Tables & bootstrap · summary() → R²/R²adj · seminr::predict_pls() → Q² · seminr::specific_effect_significance() (on the bootstrapped model) → Table 5 indirect effects · seminr::plot() → diagram',
  bundleFiles: [
    'table_measurement.png',
    'table_htmt.png',
    'table_structural.png',
    'table_structural-quality.png',
    'table_indirect-effects.png (when mediation paths drawn)',
    'table_conditional-effects.png (when moderation present)',
    'figure_path-diagram.png',
    'figure_interaction-plot.png (when moderation present)',
  ],
}
