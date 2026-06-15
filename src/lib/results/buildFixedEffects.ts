import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { FixedEffectsResult } from '../stats/fixedEffects'
import type { CardContent } from './builders'
import { f, f01, fp, fpApa } from '../format/apa'

export function buildFixedEffects(spec: TestSpec, r: FixedEffectsResult): CardContent {
  const pct = Math.round(r.ciLevel * 100)
  const t1cols = spec.tables[0].columns.map((c) => (c.key === 'ci' ? { ...c, label: `${pct}% CI` } : c))
  const coefRows = r.coefRows.map((x) => ({
    term: x.term, b: f(x.b), se: f(x.se), t: f(x.t), p: fp(x.p), ci: `[${f(x.ciLow)}, ${f(x.ciHigh)}]`,
  }))
  const first = r.coefRows[0]
  const apa = spec.apaTemplate
    .replace('{predictor}', first ? first.term : 'the predictor')
    .replace('{b}', first ? f(first.b) : '—')
    .replace('p {p}', `p ${first ? fpApa(first.p) : '—'}`)
  // §2.8 poolability F appended to the drawn within-variation note (registry/HTML carry only the drawn text).
  const note = spec.tableNote
    ? { ...spec.tableNote, text: `${spec.tableNote.text} F-test for individual effects (poolability): F = ${f(r.poolF)}, p ${fpApa(r.poolP)}.` }
    : null
  const figs = figuresOf(spec)
  return {
    tables: [
      { spec: { ...spec.tables[0], columns: t1cols }, rows: coefRows },
      { spec: spec.tables[1], rows: [{ withinR2: f01(r.withinR2), f: f(r.fStat), nObs: String(r.nObs), nEntities: String(r.nEntities) }] },
    ],
    note,
    figures: [{ caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figCoefPng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
