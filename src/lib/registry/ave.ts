import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (AVE cards) — display strings verbatim.
// Convention (SEM reporting, approved 2026-06-18):
//   - T1 convergent validity: Construct / AVE / CR / ω / α
//   - T2 Fornell-Larcker matrix: √AVE on diagonal (bold), latent correlations off-diagonal; lowerOnly
//   - T3 HTMT matrix: lowerOnly; primary discriminant criterion (Henseler/Ringle/Sarstedt 2015)
//   - Figure: AVE / CR bar chart per construct
//   - ≥1 construct required (≥2 for T2/T3 — 1-construct run renders T1 + a note, no error)
//   NEVER call semTools::reliability() — deprecated 2022. Use compRelSEM() + AVE().
export const AVE: TestSpec = {
  id: 'ave',
  name: 'Average variance extracted (AVE)',
  question: 'convergent and discriminant validity',
  constructsInput: true,
  roles: [],
  options: [
    { id: 'estimator', label: 'estimator', value: 'ML (continuous) · WLSMV (ordinal)', kind: 'display' },
  ],
  constraints: {
    roles: [],
    minRule: { kind: 'values', n: 20 },
  },
  tables: [
    {
      id: 'convergent-validity',
      title: 'Convergent validity',
      columns: [
        { key: 'construct', label: 'Construct' },
        { key: 'ave', label: 'AVE' },
        { key: 'cr', label: 'CR' },
        { key: 'omega', label: 'ω' },
        { key: 'alpha', label: 'α' },
      ],
    },
    {
      id: 'fornell-larcker',
      title: 'Discriminant validity (Fornell–Larcker)',
      columns: [], // MatrixTable — rendered via ApaTable matrix branch; columns unused
    },
    {
      id: 'htmt',
      title: 'Discriminant validity (HTMT)',
      columns: [], // MatrixTable — rendered via ApaTable matrix branch; columns unused
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'AVE ≥ .50 indicates adequate convergent validity; computed from the CFA loadings (Fornell & Larcker, 1981). CR ≥ .70 acceptable (Nunnally, 1978; Bagozzi & Yi, 1988); do not cite CR ≥ .70 to Fornell & Larcker. ω (McDonald\'s) is the preferred reliability coefficient — model-based, not assuming tau-equivalence (McNeish, 2018); α is retained as a secondary/legacy column. Fornell–Larcker: diagonal = √AVE (bold); off-diagonal = inter-construct latent correlations. HTMT < .85 indicates discriminant validity for conceptually distinct constructs (Henseler, Ringle & Sarstedt, 2015). When only 1 construct is defined, Tables 2 and 3 are suppressed (discriminant validity requires ≥ 2 constructs). Applies to reflective constructs only.',
    afterTableId: 'htmt',
  },
  figures: [
    { caption: 'Validity overview', type: 'AVE / CR bar chart per construct', file: 'validity' },
  ],
  howToRead:
    'AVE (Average Variance Extracted) is the average share of item variance a construct captures; ≥ .50 means items converge on their construct (Fornell & Larcker, 1981). CR (Composite Reliability) ≥ .70 indicates acceptable construct reliability. ω (McDonald\'s omega) is the preferred headline reliability coefficient; α (Cronbach\'s) is shown as a secondary/legacy coefficient. For discriminant validity, Fornell–Larcker (Table 2): each construct\'s √AVE (bold diagonal) should exceed its correlations with other constructs. HTMT (Table 3): values < .85 support discriminant validity for conceptually distinct constructs — use HTMT as the primary criterion and Fornell–Larcker as a legacy check. AVE < .50 may still be acceptable when CR > .60 (F&L caveat), but treat this as a caution, not a lenient pass. All cutoffs are heuristics, not pass/fail gates. Applies to reflective constructs only.',
  apaTemplate: 'Convergent validity was supported, all AVE ≥ .50 and CR ≥ .70; discriminant validity held, all HTMT < .85.',
  rMap: 'lavaan::cfa() → fit · semTools::AVE() → AVE · semTools::compRelSEM() → CR / ω · psych::alpha() → α · lavInspect(fit,"cor.lv") + sqrt(AVE) on diagonal → Table 2 (Fornell–Larcker) · semTools::htmt() → Table 3 (HTMT) · ggplot2 → figure',
  bundleFiles: ['table_convergent-validity.png', 'table_fornell-larcker.png', 'table_htmt.png', 'figure_validity.png'],
}
