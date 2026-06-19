import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { CronbachResult } from '../stats/cronbachsAlpha'
import type { CardContent } from './builders'
import { f, f01 } from '../format/apa'

export function buildCronbachsAlpha(spec: TestSpec, r: CronbachResult): CardContent {
  // T1: headline ω row, then CI covers the ω bootstrap CI (the shared 95% CI block)
  const t1rows = [{
    omega: f01(r.omega),
    alpha: f01(r.alpha),
    ci: `[${f(r.omegaCi[0])}, ${f(r.omegaCi[1])}]`,
    nItems: r.nItems,
    nCases: r.nCases,
  }]

  // T2: item-total statistics — one row per item
  const t2rows = r.itemTotal.map(({ item, r: rVal, alphaDropped }) => ({
    item,
    r: f(rVal),
    alphaDropped: f01(alphaDropped),
  }))

  const fig = figuresOf(spec)[0]

  const apa = spec.apaTemplate
    .replace('{omega}', f01(r.omega))
    .replace('{ciLow}', f(r.omegaCi[0]))
    .replace('{ciHigh}', f(r.omegaCi[1]))
    .replace('{alpha}', f01(r.alpha))

  return {
    tables: [
      { spec: spec.tables[0], rows: t1rows },
      { spec: spec.tables[1], rows: t2rows },
    ],
    note: null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figItemTotalPng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: 0, // listwise deletion is done inside runCronbachsAlpha; nExcluded is not separately tracked
  }
}
