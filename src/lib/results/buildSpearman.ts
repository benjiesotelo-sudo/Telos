import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { SpearmanResult } from '../stats/spearman'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa } from '../format/apa'

export function buildSpearman(spec: TestSpec, r: SpearmanResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{rho}', f01(r.rho))
    .replace('{p}', fpApa(r.p))
    .replace('{n}', String(r.n))
  const fig = figuresOf(spec)[0]
  return {
    tables: [{ spec: spec.tables[0], rows: [{
      pair: `${r.varA} – ${r.varB}`, rho: f(r.rho), s: fdf(r.s), p: fp(r.p), n: r.n,
    }] }],
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
