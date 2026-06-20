import type { TestSpec } from './types'

// Path analysis = observed-only CB-SEM. Distinct picker entry → the CB-SEM output card in
// auto-detected observed-only mode (modelKind: 'path'): nodes are single observed columns
// (drawn as rectangles, not ovals), NO item assignment, NO measurement model. lavaan::sem on the
// observed variables. Measurement / EFA / CFA / reliability / AVE tables are SUPPRESSED.
// The fit table is suppressed strictly when fitMeasures(fit,'df') == 0 (saturated, e.g. the canonical
// X -> M -> Y mediation) via the ONE shared predicate (src/lib/stats/semSaturation.ts); a saturation
// flag is shown instead. df > 0 reports fit (with the small-df/small-N RMSEA-instability caveat).
// Path analysis has NO drawn output card of its own — it reuses the CB-SEM card with the measurement
// tables absent. Mediation (chained paths) → indirect-effects table with bootstrap percentile CIs.
// Column convention (matches runCbSem + the cb-sem emitter in path mode): each construct.name IS the
// observed column; constructs carry the single column as their only item; paths address constructs by id.
export const PATH_ANALYSIS: TestSpec = {
  id: 'path-analysis',
  name: 'Path analysis',
  question: 'directed relationships among observed variables (path / mediation models)',
  inputKind: 'sem-canvas',
  modelKind: 'path',
  roles: [],
  options: [
    { id: 'estimator', label: 'estimator', value: 'ML', kind: 'display' },
    { id: 'bootstrap', label: 'bootstrap resamples', value: '5000', kind: 'display' },
  ],
  constraints: {
    roles: [],
    minRule: { kind: 'values', n: 20 },
  },
  tables: [
    {
      id: 'structural-paths',
      domId: 'path-analysis-structural-paths',
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
      domId: 'path-analysis-indirect-effects',
      title: 'Indirect effects',
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
    text: 'Path analysis fits directed relationships among observed variables (lavaan::sem) — no latent measurement model, so no CFA loadings, reliability, or AVE are reported. When the model is saturated (df = 0, e.g. a single-mediator X → M → Y chain), it fits the data perfectly by construction and global fit indices (χ², CFI, TLI, RMSEA, SRMR) are not reported; an over-identified model (df > 0) reports fit, interpreting RMSEA cautiously at small df / small N (Kenny, Kaniskan & McCoach, 2015). Indirect (mediated) effects are tested with bias-uncorrected percentile bootstrap 95% CIs (5,000 resamples; MacKinnon, Lockwood & Williams, 2004); an interval excluding 0 indicates a credible indirect effect.',
    afterTableId: 'indirect-effects',
  },
  figures: [
    { caption: 'Path diagram', type: 'app-drawn path diagram with fitted estimates', file: 'path-diagram' },
  ],
  howToRead:
    'Path analysis estimates a system of regressions among observed variables at once, letting one variable be both an outcome and a predictor (mediation). Structural paths: each B is the unstandardized effect, Std. β the standardized effect, with z, p, and a 95% CI; R² is the variance explained in each endogenous variable. Indirect effects: the product of the paths through a mediator (e.g. X → M → Y), judged by its bootstrap 95% CI — an interval excluding 0 indicates mediation. When df = 0 the model is saturated (it reproduces the data exactly), so fit indices are not informative and are omitted; only with extra constraints (df > 0) do global fit indices apply, and even then read RMSEA cautiously at small df / small N. All thresholds are heuristics, not pass/fail gates.',
  apaTemplate: 'A path model fit to the observed variables; the indirect effect of X on Y through M was significant, bootstrap 95% CI excluding 0.',
  rMap: 'lavaan::sem() on observed variables (regressions only; no =~) → fit · standardizedSolution() + lavInspect(fit,"rsquare") → Table 1 (structural paths + R²) · auto := indirect-effect definitions + bootstrap (boot.ci.type="perc", R = 5000) → Table 2 (indirect effects) · fit indices suppressed when fitMeasures(fit,"df") == 0 (saturated) · semPlot::semPaths() → figure (rectangles = observed)',
  bundleFiles: ['table_structural-paths.png', 'table_indirect-effects.png', 'figure_path-diagram.png'],
}
