// Build timeseries.csv — a monthly time-series fixture for the econometrics time-series tests.
//
// 72 monthly rows (2015-01 .. 2020-12) with ISO dates so `month` auto-detects as datetime.
// Deterministic (no RNG): trend + 12-month seasonality + a LEAD/LAG so the tests are non-degenerate —
//   ad_spend LEADS sales (sales depends on the previous month's ad_spend) → Granger ad_spend→sales shows up;
//   sales trends upward → ADF/KPSS read non-stationary (the teaching case); auto.arima picks differencing;
//   visitors co-moves on trend+season → VAR(sales, visitors) has joint structure.
// Usage: node docs/testing/build-timeseries.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const N = 72
const season = (i) => 10 * Math.sin((2 * Math.PI * i) / 12)
const r1 = (x) => Math.round(x * 10) / 10

// ad_spend first (it leads sales)
const ad = []
for (let i = 0; i < N; i++) ad[i] = 100 + 0.8 * i + season(i) + ((i * 37) % 11 - 5)

const rows = [['month', 'sales', 'visitors', 'ad_spend']]
for (let i = 0; i < N; i++) {
  const month = new Date(Date.UTC(2015, i, 1)).toISOString().slice(0, 10) // YYYY-MM-DD
  const prevAd = ad[i === 0 ? 0 : i - 1]
  const sales = 50 + 1.2 * i + 0.6 * prevAd + 0.7 * season(i) + ((i * 53) % 9 - 4)
  const visitors = 200 + 1.5 * i + season(i) + ((i * 29) % 13 - 6)
  rows.push([month, r1(sales), r1(visitors), r1(ad[i])])
}

const here = dirname(fileURLToPath(import.meta.url))
writeFileSync(join(here, 'timeseries.csv'), rows.map((r) => r.join(',')).join('\n') + '\n')
console.log(`timeseries.csv: ${rows.length - 1} monthly rows, columns ${rows[0].join(', ')}`)
