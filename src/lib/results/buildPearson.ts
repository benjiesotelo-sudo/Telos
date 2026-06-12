import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { PearsonResult } from '../stats/pearson'
import type { CardContent } from './builders'
import { f, fdf, fp } from '../format/apa'

export function buildPearson(spec: TestSpec, r: PearsonResult): CardContent {
  const apa = spec.apaTemplate
    .replace('[X]', r.varA).replace('[Y]', r.varB)
    .replace('{df}', fdf(r.df)).replace('{r}', f(r.r))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{ciLow}', f(r.ciLow)).replace('{ciHigh}', f(r.ciHigh))
  const fig = figuresOf(spec)[0]
  return {
    tables: [{ spec: spec.tables[0], rows: [{
      pair: `${r.varA} – ${r.varB}`, r: f(r.r), ci: `[${f(r.ciLow)}, ${f(r.ciHigh)}]`,
      t: f(r.t), df: fdf(r.df), p: fp(r.p), n: r.n,
    }] }],
    note: null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
