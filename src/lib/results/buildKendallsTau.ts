import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { KendallsTauResult } from '../stats/kendallsTau'
import type { CardContent } from './builders'
import { f, f01, fp, fpApa } from '../format/apa'

export function buildKendallsTau(spec: TestSpec, r: KendallsTauResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{tau}', f01(r.tau))
    .replace('p {p}', `p ${fpApa(r.p)}`)
    .replace('{n}', String(r.n))
  const fig = figuresOf(spec)[0]
  return {
    tables: [{ spec: spec.tables[0], rows: [{
      pair: `${r.varA} – ${r.varB}`, tau: f(r.tau), z: f(r.z), p: fp(r.p), n: r.n,
    }] }],
    note: null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
