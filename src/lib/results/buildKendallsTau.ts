import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { KendallsTauResult } from '../stats/kendallsTau'
import type { CardContent } from './builders'
import { f, f01, fp, fpApa } from '../format/apa'

const tailsNote = (t: string) => t === 'two.sided' ? '' : ` This was a one-tailed test (${t}).`

export function buildKendallsTau(spec: TestSpec, r: KendallsTauResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{tau}', f01(r.tau))
    .replace('{lo}', f01(r.tauLow)).replace('{hi}', f01(r.tauHigh))
    .replace('p {p}', `p ${fpApa(r.p)}`)
    .replace('{n}', String(r.n))
  const fig = figuresOf(spec)[0]
  return {
    tables: [{ spec: spec.tables[0], rows: [{
      pair: `${r.varA} – ${r.varB}`, tau: `${f(r.tau)} [${f(r.tauLow)}, ${f(r.tauHigh)}]`, z: f(r.z), p: fp(r.p), n: r.n,
    }] }],
    note: null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.` + tailsNote(r.tails),
    apa,
    nExcluded: r.nExcluded,
  }
}
