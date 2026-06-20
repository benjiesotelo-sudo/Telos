import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Composite reliability cards) — display strings verbatim.
// Convention (SEM reporting, approved 2026-06-18):
//   - T1 composite reliability: Construct / CR / AVE / ω / α
//   - Figure: CR bar chart per construct
//   - No Fornell-Larcker / no HTMT — those belong to the AVE card
//   - CR = ω for a congeneric model (same engine as AVE — identical columns; correct)
//   NEVER call semTools::reliability() — deprecated 2022. Use compRelSEM() + AVE().
export const COMPOSITE_RELIABILITY: TestSpec = {
  id: 'composite-reliability',
  name: 'Composite reliability (CR)',
  question: 'construct reliability',
  inputKind: 'construct-slots',
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
      id: 'composite-reliability',
      title: 'Composite reliability',
      columns: [
        { key: 'construct', label: 'Construct' },
        { key: 'cr', label: 'CR' },
        { key: 'ave', label: 'AVE' },
        { key: 'omega', label: 'ω' },
        { key: 'alpha', label: 'α' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'CR ≥ .70 indicates adequate reliability (Nunnally, 1978; Bagozzi & Yi, 1988); do not cite CR ≥ .70 to Fornell & Larcker. CR and ω (McDonald\'s) coincide for a congeneric (unidimensional) model — both columns are computed from semTools::compRelSEM(); AVE is from semTools::AVE(); α (Cronbach\'s) is retained as a secondary/legacy column (psych::alpha()). Applies to reflective constructs only.',
    afterTableId: 'composite-reliability',
  },
  figures: [
    { caption: 'Reliability overview', type: 'CR bar chart per construct', file: 'reliability' },
  ],
  howToRead:
    'CR (Composite Reliability) measures how reliably a set of items captures its construct (0–1); ≥ .70 is the conventional threshold (Nunnally, 1978; Bagozzi & Yi, 1988). CR is computed from the CFA loadings via semTools::compRelSEM() — for a congeneric (unidimensional) factor CR equals McDonald\'s ω, so the two columns will always match. AVE is shown alongside for quick convergent-validity reference (≥ .50; Fornell & Larcker, 1981) — for the full discriminant-validity assessment (Fornell–Larcker + HTMT matrices) run the AVE card. α (Cronbach\'s) is a secondary/legacy coefficient — it assumes tau-equivalence (equal loadings) and is a lower bound when loadings differ (McNeish, 2018). All cutoffs are labelled guidelines, not pass/fail gates. Applies to reflective constructs only.',
  apaTemplate: 'Composite reliability was satisfactory (CR = .__ ≥ .70).',
  rMap: 'lavaan::cfa() → fit · semTools::compRelSEM() → CR / ω · semTools::AVE() → AVE · psych::alpha() → α · ggplot2 → figure',
  bundleFiles: ['table_composite-reliability.png', 'figure_reliability.png'],
}
