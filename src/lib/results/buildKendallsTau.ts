import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { KendallsTauResult } from '../stats/kendallsTau'
import type { CardContent } from './builders'
import { f, fp } from '../format/apa'

export function buildKendallsTau(spec: TestSpec, r: KendallsTauResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{tau}', f(r.tau))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{n}', String(r.n))
  const fig = figuresOf(spec)[0]
  return {
    tables: [{ spec: spec.tables[0], rows: [{
      pair: `${r.varA} – ${r.varB}`, tau: f(r.tau), z: f(r.z), p: fp(r.p), n: r.n,
    }] }],
    note: null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
