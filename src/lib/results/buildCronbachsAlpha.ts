import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { CronbachResult } from '../stats/cronbachsAlpha'
import type { CardContent } from './builders'
import { f, f01 } from '../format/apa'

export function buildCronbachsAlpha(spec: TestSpec, r: CronbachResult): CardContent {
  // T1: headline ω row; α column shows raw or standardized α per the option
  const displayAlpha = r.useStandardizedAlpha ? r.stdAlpha : r.alpha
  const t1rows = [{
    omega: f01(r.omega),
    alpha: f01(displayAlpha),
    ci: `[${f(r.omegaCi[0])}, ${f(r.omegaCi[1])}]`,
    nItems: r.nItems,
    nCases: r.nCases,
  }]

  const fig = figuresOf(spec)[0]

  // U9-T3 fix (2026-07-06 audit): the verdict adjective used to be hardcoded "high" regardless of the
  // run's own omega -- a low-reliability run still claimed "high". Condition it on the card's OWN stated
  // thresholds (howToRead: >= .70 acceptable, >= .80 good; > .95 flags redundancy via separate prose).
  const verdict = r.omega >= 0.8 ? 'good' : r.omega >= 0.7 ? 'acceptable' : 'below the conventional .70 threshold'
  const apa = spec.apaTemplate
    .replace('{verdict}', verdict)
    .replace('{omega}', f01(r.omega))
    .replace('{ciLow}', f(r.omegaCi[0]))
    .replace('{ciHigh}', f(r.omegaCi[1]))
    .replace('{alpha}', f01(displayAlpha))

  // T2 and figure are only included when drop-item statistics are present
  const tables: CardContent['tables'] = [{ spec: spec.tables[0], rows: t1rows }]
  const figures: CardContent['figures'] = []
  if (r.itemTotal.length > 0 && r.figItemTotalPng) {
    const t2rows = r.itemTotal.map(({ item, r: rVal, alphaDropped }) => ({
      item,
      r: f(rVal),
      alphaDropped: f01(alphaDropped),
    }))
    tables.push({ spec: spec.tables[1], rows: t2rows })
    figures.push({ caption: fig.caption, type: fig.type, file: fig.file, png: r.figItemTotalPng })
  }

  return {
    tables,
    note: null,
    figures,
    howToRead: spec.howToRead,
    apa,
    nExcluded: 0, // listwise deletion is done inside runCronbachsAlpha; nExcluded is not separately tracked
    // U8-T4: keyed to match the 'cronbachs-alpha' EXPLAINERS entries (alpha, alphaDropped, ci, nCases,
    // nItems, omega, r) in registry/explainers.ts. Item-total r and alpha-if-dropped are per-item
    // (open-cardinality) so their own explainers read generically off the table; alphaDropped's interpret
    // still weaves the overall `alpha` value below for the "higher than the overall α" comparison.
    values: {
      omega: f01(r.omega), alpha: f01(displayAlpha),
      ci: `[${f(r.omegaCi[0])}, ${f(r.omegaCi[1])}]`, ciLow: f(r.omegaCi[0]), ciHigh: f(r.omegaCi[1]),
      nItems: r.nItems, nCases: r.nCases,
    },
  }
}
