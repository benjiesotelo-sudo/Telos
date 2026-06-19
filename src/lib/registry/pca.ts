import type { TestSpec } from './types'

export const PCA: TestSpec = {
  id: 'pca',
  name: 'Principal component analysis (PCA)',
  question: 'reduce variables to components',
  roles: [
    { id: 'variables', label: 'Variables', levels: 'interval / ratio', arity: 'two or more' },
  ],
  options: [
    { id: 'retention', label: 'retention', value: 'parallel', kind: 'select', choices: ['parallel', 'Kaiser', 'fixed-n'] },
    { id: 'nComponents', label: 'n components', value: '2', kind: 'number', default: 2, hint: 'used only when retention = fixed-n' },
    { id: 'standardize', label: 'standardize', value: 'on', kind: 'toggle', default: true },
  ],
  constraints: {
    roles: [
      { roleId: 'variables', levels: ['interval', 'ratio'], arity: { min: 2, max: Infinity } },
    ],
    minRule: { kind: 'values', n: 10 },
  },
  tables: [
    {
      id: 'variance-explained',
      domId: 'pca-variance-explained',
      title: 'Variance explained',
      columns: [
        { key: 'component', label: 'Component' },
        { key: 'eigenvalue', label: 'Eigenvalue' },
        { key: 'pctVar', label: '% variance' },
        { key: 'cumPct', label: 'Cumulative %' },
      ],
    },
    {
      id: 'component-loadings',
      domId: 'pca-component-loadings',
      title: 'Component loadings',
      columns: [
        { key: 'variable', label: 'Variable' },
        { key: 'pc1', label: 'PC1' },
        { key: 'pc2', label: 'PC2' },
        { key: 'pc3', label: 'PC3' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'Component loading columns expand to the number of retained components; loadings are correlation-scaled (eigenvector × √eigenvalue); loadings |< .32| suppressed. PCA is data reduction — components are weighted composites, not latent factors; communalities are not reported (Jolliffe & Cadima, 2016; Frick et al., 2025).',
    afterTableId: 'component-loadings',
  },
  figures: [
    { caption: 'Component retention', type: 'scree plot (with parallel analysis)', file: 'scree' },
  ],
  howToRead:
    'PCA compresses correlated variables into a few components. The variance explained (Table 1) shows how much information each component retains; the component loadings (Table 2) show how strongly each variable contributes. Loadings are correlation-scaled (eigenvector × √eigenvalue) so they share the unit of a correlation coefficient. PCA is data reduction — components are weighted composites of the observed variables, not reflective latent factors; do not interpret them as constructs and do not report communalities (which belong to factor analysis, not PCA). For a latent-construct model use EFA (psych::fa) or CFA (lavaan). The scree plot overlays the parallel-analysis 95th-percentile threshold — retain components where the observed eigenvalue exceeds that line; the Kaiser eigenvalue > 1 rule is shown for reference but tends to over-extract (Zwick & Velicer, 1986). Cumulative variance ≥ 70% is a common but explicitly subjective target (Jolliffe & Cadima, 2016).',
  apaTemplate:
    'PCA (correlation matrix; parallel analysis) retained __ components explaining __% of total variance.',
  rMap: 'prcomp(scale.=TRUE) → eigenvalues · R_PARALLEL_ANALYSIS (kind="pca") → retention · correlation-scaled loadings (rotation × sdev) → Table 2 · ggplot2 → scree figure',
  bundleFiles: [
    'table_variance-explained.png',
    'table_component-loadings.png',
    'figure_scree.png',
  ],
}
