import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Stationarity tests card).
// APA template = drawn card verbatim (report-only neutralisation deferred to HTML edit + Benjie ratify).
// §2.5 econometrics-grade addition: Phillips–Perron row added to the stationarity table (3 rows: ADF, KPSS, PP).
// Single table — captionStyle 'bare' (card shows "Table." not "Table 1.").
export const STATIONARITY_TESTS: TestSpec = {
  id: 'stationarity-tests',
  name: 'Stationarity tests (ADF, KPSS)',
  question: 'is the series stationary?',
  roles: [
    { id: 'time', label: 'Time',
      levels: 'datetime / ordered', arity: 'exactly 1',
      hint: 'e.g. the date / time-order column — month, year' },
    { id: 'series', label: 'Series',
      levels: 'interval / ratio', arity: 'exactly 1',
      hint: 'e.g. numeric series over time — sales, visitors' },
  ],
  options: [
    { id: 'test', label: 'test', value: 'both · ADF + KPSS', kind: 'select',
      default: true, choices: ['both · ADF + KPSS', 'ADF only', 'KPSS only'] },
    { id: 'lags', label: 'lags', value: 'auto', kind: 'select', choices: ['auto'] },
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
  ],
  constraints: {
    roles: [
      { roleId: 'time', levels: [], arity: { min: 1, max: 1 }, timeOrder: true },
      { roleId: 'series', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, excludeTag: 'datetime' },
    ],
    minRule: { kind: 'values', n: 20 },
  },
  tables: [
    {
      id: 'stationarity', title: 'Stationarity tests',
      domId: 'stationarity-tests-stationarity',
      captionStyle: 'bare',
      columns: [
        { key: 'test', label: 'Test' },
        { key: 'statistic', label: 'Statistic' },
        { key: 'lag', label: 'Lag' },
        { key: 'p', label: 'p' },
        { key: 'conclusion', label: 'Conclusion' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'ADF and KPSS have opposite null hypotheses — the conclusion column reconciles them. The Statistic column holds two different metrics (ADF: Dickey–Fuller τ; KPSS: LM statistic); KPSS p-values are interpolated and shown bounded (e.g. “> .10” / “< .01”) rather than exact.',
  },
  figures: [
    { caption: 'Series & structure', type: 'series plot + ACF / PACF (and differenced series)', file: 'series' },
    { caption: 'Series & structure', type: 'series plot + ACF / PACF (and differenced series)', file: 'acf' },
  ],
  howToRead:
    'For ADF, a small p means stationary; for KPSS, a small p means non-stationary. If a series is non-stationary, difference it before modeling. The conclusion column states the verdict. Failing to reject is not proof of the null for either test (both have low power), so strengthen the verdict by also reading the ACF rather than relying on a single p-value.',
  // Report-only neutralisation: report each test's statistic + p and α, no "was non-stationary / differenced" verdict.
  // §2.5 econometrics-grade: Phillips–Perron (PP) is in the table; surface it in the APA line too (Z statistic).
  apaTemplate: 'ADF gave τ={adf}, p {adfp}; KPSS gave LM={kpss}, p {kpssp}; Phillips–Perron gave Z={pp}, p {ppp} (α={alpha}).',
  rMap: 'tseries::adf.test() / tseries::kpss.test() → table · forecast::ggAcf() → figures',
  bundleFiles: ['table_stationarity.png', 'figure_series.png', 'figure_acf.png'],
}
