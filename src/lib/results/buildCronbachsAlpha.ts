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

  const apa = spec.apaTemplate
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
  }
}
