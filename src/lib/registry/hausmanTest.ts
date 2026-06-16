import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Hausman test card).
// Report-only APA — the drawn template hardcoded a verdict ("favoured fixed effects"); NEUTRALISED here to
// report the statistic + p only. modelsummary coef table (design 2026-06-16): the old Hausman-stat table +
// FE-vs-RE table merge into ONE side-by-side FE|RE coef table (+ a Difference column). The old "Decision" column
// is DROPPED — report-only: the how-to-read explains FE-vs-RE; no verdict baked into the table. The Hausman χ²
// renders as a full-width span row after the GOF footer. plm within has NO logLik → no AIC/BIC/Log.Lik gof rows.
export const HAUSMAN_TEST: TestSpec = {
  id: 'hausman-test',
  name: 'Hausman test',
  question: 'fixed vs. random effects?',
  roles: [
    { id: 'entity', label: 'Entity', levels: 'nominal / ordinal', arity: 'exactly 1', hint: 'e.g. the unit observed repeatedly — firm, country, student' },
    { id: 'time', label: 'Time', levels: 'datetime / ordered', arity: 'exactly 1', hint: 'e.g. the date / time-order column — month, year' },
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1', hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'regressors', label: 'Regressors', levels: 'any level', arity: 'one or more', hint: 'e.g. explanatory variables — R&D spend, leverage' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
  ],
  constraints: {
    roles: [
      { roleId: 'entity', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 } },
      { roleId: 'time', levels: [], arity: { min: 1, max: 1 }, timeOrder: true },
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, excludeTag: 'datetime' },
      { roleId: 'regressors', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: Infinity }, excludeTag: 'datetime' },
    ],
    minRule: { kind: 'panel', n: 12 },
  },
  // SHAPE B side-by-side coef table: two model columns (FE | RE) + a kept Difference extraCol.
  // columns = [term, fe, re, diff]; builder stacks B / (clustered SE) / [CI] per term (diff blank on SE/CI),
  // a rule, the gof footer (per-col R²), then a full-width span row carrying the Hausman χ²(df), p.
  tables: [
    {
      id: 'hausman', title: 'Hausman test', domId: 'hausman', kind: 'coef',
      columns: [
        { key: 'term', label: '' }, { key: 'fe', label: 'Fixed effects' }, { key: 're', label: 'Random effects' }, { key: 'diff', label: 'Difference' },
      ],
      models: [{ key: 'fe', label: 'Fixed effects' }, { key: 're', label: 'Random effects' }],
      extraCols: [{ key: 'diff', label: 'Difference' }],
      gof: [
        { key: 'n', label: 'Num.Obs.' }, { key: 'nentities', label: 'N entities' }, { key: 'r2', label: 'R²' },
      ],
    },
  ],
  figures: [{ caption: 'FE vs. RE', type: 'side-by-side coefficient plot', file: 'coefficients' }],
  howToRead:
    'Tests whether the random-effects assumption holds. A p below alpha means the estimates differ systematically → use fixed effects; a non-significant p means random effects is acceptable (and more efficient).',
  apaTemplate: 'A Hausman test comparing the fixed- and random-effects estimates gave χ²({df})={chisq}, p {p}.',
  rMap: 'plm::phtest() + compare within / random fits → Table · ggplot2 → figure',
  bundleFiles: ['table_hausman.png', 'figure_coefficients.png'],
}
