import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (VAR card).
// APA template = drawn card verbatim (report-only neutralisation deferred to HTML edit + Benjie ratify).
// §2.5 econometrics-grade additions:
//   - Table 3: Forecast-error variance decomposition (FEVD) via vars::fevd at the IRF horizon.
//   - tableNote: stability check (vars::roots max modulus < 1 → stable).
//   - Bundle += table_fevd.png.
export const VAR: TestSpec = {
  id: 'var',
  name: 'VAR',
  question: 'several interrelated series',
  roles: [
    { id: 'time', label: 'Time',
      levels: 'datetime / ordered', arity: 'exactly 1',
      hint: 'e.g. the date / time-order column — month, year' },
    { id: 'series', label: 'Series',
      levels: 'interval / ratio', arity: 'two or more',
      hint: 'e.g. numeric series over time — sales, visitors' },
  ],
  options: [
    { id: 'lagOrder', label: 'lag order', value: 'auto', kind: 'select', choices: ['auto'] },
    { id: 'irfHorizon', label: 'IRF horizon', value: '10', kind: 'number', default: 10 },
  ],
  constraints: {
    roles: [
      { roleId: 'time', levels: [], arity: { min: 1, max: 1 }, timeOrder: true },
      { roleId: 'series', levels: ['interval', 'ratio'], arity: { min: 2, max: Infinity }, excludeTag: 'datetime' },
    ],
    minRule: { kind: 'complete-wide-rows', n: 20 },
  },
  tables: [
    {
      id: 'lag-selection', title: 'Lag selection', domId: 'var-lag-selection',
      columns: [
        { key: 'lag', label: 'Lag' },
        { key: 'aic', label: 'AIC' },
        { key: 'bic', label: 'BIC' },
        { key: 'hq', label: 'HQ' },
      ],
    },
    // modelsummary coef table (design 2026-06-16) — SIDE-BY-SIDE, ONE COLUMN PER EQUATION.
    // This registry entry is a PLACEHOLDER: the column/model count is data-dependent (one per series),
    // so buildVar OVERRIDES `columns` + `models` at runtime with the real response-series labels
    // (same pattern as buildDid's runtime column override). The single placeholder model column below
    // is a representative example for the static drawn card. Per term: estimate / (SE) / [CI] (t/p drop).
    // Footer gof per equation: Num.Obs. / R² / R² Adj. / RMSE / Log.Lik. (each equation is an lm → all exist),
    // then SYSTEM span rows (selected lag p, max-root modulus + stability, Portmanteau serial test) emitted by the builder.
    {
      id: 'var-coefficients', title: 'VAR coefficients (per equation)', domId: 'var-var-coefficients',
      kind: 'coef',
      columns: [{ key: 'term', label: '' }, { key: 'eq1', label: 'Series 1' }],
      models: [{ key: 'eq1', label: 'Series 1' }],
      gof: [
        { key: 'nobs', label: 'Num.Obs.' },
        { key: 'r2', label: 'R²' },
        { key: 'adjr2', label: 'R² Adj.' },
        { key: 'rmse', label: 'RMSE' },
        { key: 'll', label: 'Log.Lik.' },
      ],
    },
    // §2.5 addition: Forecast-error variance decomposition (FEVD) — long format (Variable · Impulse · Share)
    // so the table has fixed columns regardless of series count. vars::fevd at irfHorizon.
    {
      id: 'fevd', title: 'Forecast-error variance decomposition', domId: 'var-fevd',
      columns: [
        { key: 'variable', label: 'Variable' },
        { key: 'impulse', label: 'Impulse' },
        { key: 'share', label: 'Share' },
      ],
    },
  ],
  // §2.5 addition: stability check as tableNote (vars::roots max modulus; < 1 → stable).
  tableNote: {
    kind: 'plain',
    text: 'one column per equation (response series); each cell stacks the estimate, its (SE), and the [95% CI] — ' +
      'the per-coefficient t/p are dropped. orthogonalised (Cholesky) IRFs depend on the ordering of the series; ' +
      'a level VAR assumes stationarity. stability check: max companion-eigenvalue modulus < 1 indicates a stable VAR. ' +
      'serial-correlation check: the Portmanteau test (vars::serial.test, asymptotic) tests the null of no residual ' +
      'autocorrelation — a small p suggests remaining serial correlation (consider a higher lag order).',
    afterTableId: 'var-coefficients',
  },
  figures: [
    { caption: 'Dynamic response', type: 'impulse-response function plots', file: 'irf' },
  ],
  howToRead:
    'A VAR models several series as functions of their joint past. The impulse-response plots show how a shock to one series propagates to the others over time; read each IRF together with its bootstrap confidence band, and note that orthogonalised (Cholesky) IRFs depend on the ordering of the series. Lag selection picks how many past periods to include. A level VAR assumes stationary series — difference them (or use a VECM) if they are not. The Portmanteau test (vars::serial.test) checks the residuals for remaining serial correlation: a small p suggests the lag order is too low to whiten the residuals. Method: R vars package (Pfaff, 2008; Lütkepohl, New Introduction to Multiple Time Series Analysis).',
  // Report-only neutralisation: state the selected order + that IRFs are shown, no "analysis showed…" lead-in.
  apaTemplate: 'A VAR({p}) model was selected by AIC; impulse-response functions are shown (Figure).',
  rMap: 'vars::VARselect() → Table 1 · vars::VAR() → Table 2 · vars::irf() → figure',
  bundleFiles: ['table_lag-selection.png', 'table_var-coefficients.png', 'figure_irf.png', 'table_fevd.png'],
}
