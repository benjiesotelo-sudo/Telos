import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (ARIMA / SARIMA card).
// APA template = drawn card verbatim (report-only neutralisation deferred to HTML edit + Benjie ratify).
// §2.5 econometrics-grade addition: figure_residuals.png (residual ACF + Q–Q) added to bundle.
// &sigma; in decode: added to specHtml.ts decode() for σ² header.
export const ARIMA_SARIMA: TestSpec = {
  id: 'arima-sarima',
  name: 'ARIMA / SARIMA',
  question: 'model & forecast one series',
  roles: [
    { id: 'time', label: 'Time variable',
      levels: 'datetime / ordered', arity: 'exactly 1',
      hint: 'e.g. the date / time-order column — month, year' },
    { id: 'series', label: 'Series (value)',
      levels: 'interval / ratio', arity: 'exactly 1',
      hint: 'e.g. the numeric value over time — monthly sales' },
  ],
  options: [
    { id: 'order', label: 'order', value: 'auto-select', kind: 'arima-order', default: true },
    { id: 'seasonalPeriod', label: 'seasonal period', value: '12', kind: 'number', default: 12 },
    { id: 'horizon', label: 'forecast horizon', value: '12', kind: 'number', default: 12 },
  ],
  constraints: {
    roles: [
      { roleId: 'time', levels: [], arity: { min: 1, max: 1 }, timeOrder: true },
      { roleId: 'series', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, excludeTag: 'datetime' },
    ],
    minRule: { kind: 'values', n: 20 },
  },
  // modelsummary coef table (design 2026-06-16): Table 1 (Model summary) + Table 2 (diagnostics)
  // merge into ONE stacked coef table — per ARIMA term estimate / (SE) / [CI], then the GOF footer
  // (Num.Obs. + σ² + Ljung–Box p + AIC/BIC/Log.Lik.). Table 2 (Forecast) stays a classic table.
  tables: [
    {
      id: 'model-summary', title: 'Model summary', domId: 'arima-sarima-model-summary', kind: 'coef',
      columns: [{ key: 'term', label: '' }, { key: 'est', label: '(1)' }],
      models: [{ key: 'est', label: '(1)' }],
      gof: [
        { key: 'n', label: 'Num.Obs.' },
        { key: 'sigma2', label: 'σ²' },
        { key: 'ljungbox', label: 'Ljung–Box p' },
        { key: 'aic', label: 'AIC' },
        { key: 'bic', label: 'BIC' },
        { key: 'll', label: 'Log.Lik.' },
      ],
    },
    {
      id: 'forecast', title: 'Forecast', domId: 'arima-sarima-forecast',
      columns: [
        { key: 'period', label: 'Period' },
        { key: 'forecast', label: 'Forecast' },
        { key: 'pi80', label: '80% PI' },
        { key: 'pi95', label: '95% PI' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'arima()/auto.arima() return each coefficient with its SE (CI via confint()); they do not produce per-coefficient z/p — add lmtest::coeftest() if those are wanted. The Ljung–Box row tests residual autocorrelation jointly to lag = max(10, 2 × seasonal period), with df adjusted for the number of fitted ARMA terms (p + q + P + Q).',
    afterTableId: 'model-summary',
  },
  figures: [
    { caption: 'Forecast', type: 'forecast plot (history + forecast with prediction intervals)', file: 'forecast' },
    // §2.5 econometrics-grade addition — residual diagnostics (ACF + Q–Q)
    { caption: 'Residual diagnostics', type: 'residual ACF + Normal Q–Q', file: 'residuals' },
  ],
  howToRead:
    'The chosen (p,d,q)(P,D,Q) orders describe the model. The Ljung–Box Q(df) row tests whether the residuals ' +
    'still carry autocorrelation up to the reported lag (a large p means none is detected); use it with AIC/BIC ' +
    'to judge fit. The forecast table and plot give predictions with uncertainty bands. AIC/BIC compare models ' +
    'only when fit to the same series with identical differencing (d, D) and transformation; lower is better, but ' +
    'they are relative, not absolute, measures of fit. ' +
    'Method: R forecast package (Hyndman & Khandakar, 2008; Hyndman & Athanasopoulos, Forecasting: Principles and Practice).',
  // Report-only neutralisation: state the model + diagnostic p without a "white noise / good fit" verdict.
  // {pdq} → (p,d,q); {PDQ} → (P,D,Q)[s], filled at build time. Replacing /\{\w+\}/g → __ matches the HTML card line.
  apaTemplate: 'An ARIMA({pdq})({PDQ}) model was fit (AIC={aic}); the Ljung–Box test of residual autocorrelation gave p {ljungbox_p}.',
  rMap: 'forecast::auto.arima() / arima() → Tables · forecast() + autoplot() → figure',
  bundleFiles: ['table_model-summary.png', 'table_forecast.png', 'figure_forecast.png', 'figure_residuals.png'],
}
