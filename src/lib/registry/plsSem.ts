import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (PLS-SEM card, lines 1160-1188) — display strings verbatim.
// Convention (SEM reporting, approved 2026-06-18):
//   - Variance-based SEM (seminr); NO global fit indices (CFI/TLI/RMSEA).
//   - Reliability display order = Construct · α · ρ_A · CR (ρ_C) · AVE; seminr emits alpha/rhoC/AVE/rhoA
//     in a different order → buildPlsSem must SELECT+REORDER into this tuple.
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
      id: 'outer-model',
      title: 'Measurement model (outer loadings / weights)',
      columns: [
        { key: 'path', label: 'Construct → Item' },
        { key: 'loading', label: 'Loading / weight' },
        { key: 't', label: 't' },
        { key: 'p', label: 'p' },
      ],
    },
    {
      id: 'reliability',
      domId: 'pls-sem-reliability',
      title: 'Reliability & convergent validity (per construct)',
      columns: [
        { key: 'construct', label: 'Construct' },
        { key: 'alpha', label: 'α' },
        { key: 'rhoA', label: 'ρ', sub: 'A' },
        { key: 'cr', label: 'CR (ρ', sub: 'C', suffix: ')' },
        { key: 'ave', label: 'AVE' },
      ],
    },
    {
      id: 'htmt',
      domId: 'pls-sem-htmt',
      title: 'Discriminant validity — HTMT (construct × construct)',
      columns: [], // MatrixTable — rendered via ApaTable matrix branch; columns unused
    },
    {
      id: 'structural',
      title: 'Structural paths',
      columns: [
        { key: 'path', label: 'Path' },
        { key: 'beta', label: 'β' },
        { key: 't', label: 't' },
        { key: 'p', label: 'p' },
        { key: 'ci', label: '95% CI' },
        { key: 'f2', label: 'f²' },
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
  ],
  tableNote: {
    kind: 'plain',
    text: 'HTMT is a construct-by-construct matrix (not a per-construct value) — columns expand to the number of constructs in the model; HTMT < .85/.90 supports discriminant validity (Henseler, Ringle & Sarstedt, 2015). Significance comes from bootstrapping (percentile 95% CIs, 5000 resamples); R² and Q² assess the structural model (f²: ~0.02 small, 0.15 medium, 0.35 large; Cohen, 1988). PLS-SEM deliberately has no global fit indices (CFI/TLI/RMSEA) — judge it by reliability & validity, then R²/Q²/f² (Hair et al., 2019). The indirect-effects table appears only when the drawn paths form a chain (X → M → Y). Formative constructs suppress AVE/HTMT and are judged by indicator weights, VIF, and redundancy convergent validity. Moderation is planned for a later version.',
    afterTableId: 'indirect-effects',
  },
  figures: [
    { caption: 'Model', type: 'path diagram (with loadings, path coefficients, R²)', file: 'path-diagram' },
  ],
  howToRead:
    'Like CB-SEM but variance-based and prediction-oriented (good for smaller samples / formative constructs). PLS-SEM does not use CB-SEM global fit indices (CFI/TLI/RMSEA) — judge it instead by reliability & validity (CR, AVE, HTMT), then R², Q² (predictive relevance) and f², with SRMR the only commonly reported approximate fit index. Read the bootstrapped path coefficients (β, p); f² is each path\'s effect size (~0.02 small, 0.15 medium, 0.35 large).',
  apaTemplate: 'In the PLS-SEM, the path from X to Y gave β=__, p=__ (bootstrap); R²Y=__.',
  rMap: 'seminr → Tables & bootstrap · summary() → R²/R²adj · seminr::predict_pls() → Q² · seminr::specific_effect_significance() (on the bootstrapped model) → Table 6 indirect effects · seminr::plot() → diagram',
  bundleFiles: [
    'table_outer-model.png',
    'table_reliability.png',
    'table_htmt.png',
    'table_structural.png',
    'table_structural-quality.png',
    'table_indirect-effects.png (when mediation paths drawn)',
    'figure_path-diagram.png',
  ],
}
