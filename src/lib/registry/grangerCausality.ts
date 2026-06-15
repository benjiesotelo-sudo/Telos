import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Granger causality card).
// APA template = drawn card verbatim (report-only neutralisation deferred to HTML edit + Benjie ratify).
// §2.5: Granger stays as drawn — the F both-directions table is already complete for this test.
// Single table — captionStyle 'bare' (card shows "Table." not "Table N.").
export const GRANGER_CAUSALITY: TestSpec = {
  id: 'granger-causality',
  name: 'Granger causality',
  question: 'does X predict future Y?',
  roles: [
    { id: 'time', label: 'Time',
      levels: 'datetime / ordered', arity: 'exactly 1',
      hint: 'e.g. the date / time-order column — month, year' },
    { id: 'seriesX', label: 'Series X',
      levels: 'interval / ratio', arity: 'exactly 1',
      hint: 'e.g. the predictor series — ad spend over time' },
    { id: 'seriesY', label: 'Series Y',
      levels: 'interval / ratio', arity: 'exactly 1',
      hint: 'e.g. the outcome series — sales over time' },
  ],
  options: [
    { id: 'maxLag', label: 'max lag', value: '4', kind: 'number', default: 4 },
    { id: 'alpha', label: 'α', value: '0.05', kind: 'number', default: 0.05 },
  ],
  constraints: {
    roles: [
      { roleId: 'time', levels: [], arity: { min: 1, max: 1 }, timeOrder: true },
      { roleId: 'seriesX', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, excludeTag: 'datetime' },
      { roleId: 'seriesY', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, excludeTag: 'datetime' },
    ],
    minRule: { kind: 'values', n: 20 },
  },
  tables: [
    {
      id: 'granger', title: 'Granger tests (both directions)',
      domId: 'granger-causality-granger',
      captionStyle: 'bare',
      columns: [
        { key: 'direction', label: 'Direction' },
        { key: 'f', label: 'F' },
        { key: 'df', label: 'df' },
        { key: 'p', label: 'p' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'tests predictive precedence, not true causation; both series should be stationary first.',
  },
  figures: [
    { caption: 'Series together', type: 'cross-series time plot', file: 'cross-series' },
  ],
  howToRead:
    "A significant X→Y p means past values of X help predict Y beyond Y's own past — this is predictive precedence, not proof that X causes Y. Check both directions. The result depends entirely on the lag order (default 1 in grangertest()): choose it on theory or by AIC/BIC and report it, since different lags can flip the conclusion. Make both series stationary first.",
  apaTemplate: 'X Granger-caused Y, F({df1},{df2})={f}, p={p}, but not the reverse.',
  rMap: 'lmtest::grangertest() run once per direction (or vars::causality()) → the two table rows · ggplot2 → figure',
  bundleFiles: ['table_granger.png', 'figure_cross-series.png'],
}
