import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { PsmResult } from '../stats/propensityScoreMatching'
import type { CardContent } from './builders'
import { f, fp, fpApa } from '../format/apa'

export function buildPropensityScoreMatching(spec: TestSpec, r: PsmResult): CardContent {
  const balanceRows = r.balance.map((b) => ({ covariate: b.covariate, smdPre: f(b.smdPre), smdPost: f(b.smdPost), varRatio: f(b.varRatio) }))
  const attRow = { estimate: f(r.attB), se: f(r.attSe), t: f(r.attT), p: fp(r.attP), ci: `[${f(r.attLo)}, ${f(r.attHi)}]` }
  const apa = spec.apaTemplate
    .replace('{b}', f(r.attB))
    .replace('{lo}', f(r.attLo))
    .replace('{hi}', f(r.attHi))
    .replace('p {p}', `p ${fpApa(r.attP)}`)
  const figs = figuresOf(spec)
  return {
    tables: [
      { spec: spec.tables[0], rows: balanceRows },
      { spec: spec.tables[1], rows: [attRow] },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figLovePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
