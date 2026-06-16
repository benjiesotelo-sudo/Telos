import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { RandomEffectsResult } from '../stats/randomEffects'
import type { CardContent } from './builders'
import { f, f01, fp, fpApa } from '../format/apa'

export function buildRandomEffects(spec: TestSpec, r: RandomEffectsResult): CardContent {
  const pct = Math.round(r.ciLevel * 100)
  const classical = r.seType === 'classical'
  const t1cols = spec.tables[0].columns.map((c) =>
    c.key === 'ci' ? { ...c, label: `${pct}% CI` }
      : c.key === 'se' && classical ? { ...c, label: 'SE' } // "Clustered SE" only when clustered
        : c)
  const coefRows = r.coefRows.map((x) => ({
    term: x.term, b: f(x.b), se: f(x.se), t: f(x.t), p: fp(x.p), ci: `[${f(x.ciLow)}, ${f(x.ciHigh)}]`,
  }))
  const first = r.coefRows.find((x) => x.term !== '(Intercept)') // APA names the first slope, not the intercept
  const apa = spec.apaTemplate
    .replace('predictor X', first ? `predictor ${first.term}` : 'predictor X')
    .replace('{b}', first ? f(first.b) : '—')
    .replace('p {p}', `p ${first ? fpApa(first.p) : '—'}`)
  const figs = figuresOf(spec)
  return {
    tables: [
      { spec: { ...spec.tables[0], columns: t1cols }, rows: coefRows },
      { spec: spec.tables[1], rows: [{ r2: f01(r.r2), adjR2: f01(r.adjR2), nObs: String(r.nObs), nEntities: String(r.nEntities) }] },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figCoefPng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
