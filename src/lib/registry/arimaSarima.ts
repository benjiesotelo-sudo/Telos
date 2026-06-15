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
  tables: [
    {
      id: 'model-summary', title: 'Model summary', domId: 'arima-sarima-model-summary',
      columns: [
        { key: 'term', label: 'Term' },
        { key: 'estimate', label: 'Estimate' },
        { key: 'se', label: 'SE' },
        { key: 'ci', label: '95% CI' },
      ],
    },
    {
      id: 'diagnostics', title: 'Fit & residual diagnostics', domId: 'arima-sarima-diagnostics',
      columns: [
        { key: 'aic', label: 'AIC' },
        { key: 'bic', label: 'BIC' },
        { key: 'loglik', label: 'Log-lik' },
        { key: 'sigma2', label: 'σ²' },
        { key: 'ljungbox_p', label: 'Ljung–Box p' },
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
    text: 'arima()/auto.arima() return each coefficient with its SE (CI via confint()); they do not produce per-coefficient z/p — add lmtest::coeftest() if those are wanted.',
    afterTableId: 'model-summary',
  },
  figures: [
    { caption: 'Forecast', type: 'forecast plot (history + forecast with prediction intervals)', file: 'forecast' },
    // §2.5 econometrics-grade addition — residual diagnostics (ACF + Q–Q)
    { caption: 'Residual diagnostics', type: 'residual ACF + Normal Q–Q', file: 'residuals' },
  ],
  howToRead:
    'The chosen (p,d,q)(P,D,Q) orders describe the model. Use the Ljung–Box p (large = residuals look like ' +
    'white noise, good) and AIC/BIC to judge fit; the forecast table and plot give predictions with uncertainty ' +
    'bands. AIC/BIC compare models only when fit to the same series with identical differencing (d, D) and ' +
    'transformation; lower is better, but they are relative, not absolute, measures of fit.',
  // Report-only neutralisation: state the model + diagnostic p without a "white noise / good fit" verdict.
  // {pdq} → (p,d,q); {PDQ} → (P,D,Q)[s], filled at build time. Replacing /\{\w+\}/g → __ matches the HTML card line.
  apaTemplate: 'An ARIMA({pdq})({PDQ}) model was fit (AIC={aic}); the Ljung–Box test of residual autocorrelation gave p {ljungbox_p}.',
  rMap: 'forecast::auto.arima() / arima() → Tables · forecast() + autoplot() → figure',
  bundleFiles: ['table_model-summary.png', 'table_diagnostics.png', 'table_forecast.png', 'figure_forecast.png', 'figure_residuals.png'],
}
