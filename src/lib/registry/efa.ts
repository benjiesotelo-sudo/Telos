import type { TestSpec } from './types'

export const EFA: TestSpec = {
  id: 'efa',
  name: 'Exploratory factor analysis (EFA)',
  question: 'discover underlying factors',
  roles: [
    { id: 'items', label: 'Items', levels: 'ordinal / interval / ratio', arity: '3 or more' },
  ],
  options: [
    { id: 'retention', label: 'retention', value: 'parallel', kind: 'select', choices: ['parallel', 'Kaiser', 'fixed-n'] },
    { id: 'rotation', label: 'rotation', value: 'oblimin', kind: 'select', choices: ['oblimin', 'varimax'] },
    { id: 'extraction', label: 'extraction', value: 'PAF', kind: 'select', choices: ['PAF', 'ML'] },
  ],
  constraints: {
    roles: [
      { roleId: 'items', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 3, max: Infinity } },
    ],
    minRule: { kind: 'values', n: 20 },
  },
  tables: [
    {
      id: 'suitability',
      title: 'Suitability',
      columns: [
        { key: 'kmo', label: 'KMO' },
        { key: 'bartlettChisq', label: "Bartlett's χ²" },
        { key: 'df', label: 'df' },
        { key: 'p', label: 'p' },
      ],
    },
    {
      id: 'variance-explained',
      title: 'Variance explained',
      columns: [
        { key: 'factor', label: 'Factor' },
        { key: 'eigenvalue', label: 'Eigenvalue' },
        { key: 'pctVar', label: '% variance' },
        { key: 'cumPct', label: 'Cumulative %' },
      ],
    },
    {
      id: 'rotated-loadings',
      title: 'Rotated factor loadings',
      columns: [
        { key: 'item', label: 'Item' },
        { key: 'f1', label: 'Factor 1' },
        { key: 'f2', label: 'Factor 2' },
        { key: 'communality', label: 'Communality' },
      ],
    },
    {
      id: 'interfactor-correlations',
      title: 'Interfactor correlations (Φ)',
      columns: [],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'Loading columns expand to the number of retained factors; loadings |< .32| suppressed (Tabachnick & Fidell). Φ (interfactor correlations) shown for oblique rotation (oblimin) only — omitted for varimax (orthogonal). KMO ≥ .60 acceptable, ≥ .70 preferred (Kaiser & Rice, 1974). Bartlett p < .001 required. Parallel analysis (Horn, 1965) is the preferred retention rule; Kaiser eigenvalue > 1 is offered but systematically over-extracts (Zwick & Velicer, 1986). Factor order: descending SS-loadings.',
    afterTableId: 'interfactor-correlations',
  },
  figures: [
    { caption: 'Factor retention', type: 'scree plot (with parallel analysis)', file: 'scree' },
  ],
  howToRead:
    "Check KMO (> .60 acceptable, > .70 preferred; Kaiser & Rice, 1974) and a significant Bartlett's test (p < .001) for suitability. " +
    'Parallel analysis (Horn, 1965) is the recommended retention rule — it corrects the upward bias of the Kaiser eigenvalue > 1 rule (Zwick & Velicer, 1986). ' +
    'Table 3 shows the rotated pattern matrix: each loading is the unique contribution of the factor to that item. ' +
    'Loadings |< .32| (~10% variance) are suppressed; a loading ≥ .32 on two or more factors flags a cross-loader (Tabachnick & Fidell). ' +
    'For oblique rotation (oblimin), the Φ matrix shows interfactor correlations — if all |Φ| < .32, orthogonal rotation (varimax) may be preferred. ' +
    'EFA is exploratory — it discovers structure; to confirm a proposed factor structure run a CFA, ideally on a separate sample (Watkins, 2018).',
  apaTemplate:
    "EFA (KMO = __, Bartlett's χ²(__) = __, p < .001) with parallel analysis retained __ factors explaining __% of variance (__ rotation).",
  rMap: 'psych::KMO()/cortest.bartlett() → Table 1 · R_PARALLEL_ANALYSIS → retention · psych::fa() → Tables 2–3 · fa()$Phi → Table 4 (oblimin only) · ggplot2 → scree figure',
  bundleFiles: [
    'table_suitability.png',
    'table_variance-explained.png',
    'table_rotated-loadings.png',
    'table_interfactor-correlations.png',
    'figure_scree.png',
  ],
}
