import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { RddResult } from '../stats/rdd'
import type { CardContent } from './builders'
import { f, fp, fpApa } from '../format/apa'

export function buildRdd(spec: TestSpec, r: RddResult): CardContent {
  const pct = Math.round(r.ciLevel * 100)
  const t1cols = spec.tables[0].columns.map((c) => (c.key === 'ci' ? { ...c, label: `${pct}% CI` } : c))
  const row = {
    bandwidth: f(r.bandwidth), estimate: f(r.estimate), se: f(r.se), z: f(r.z), p: fp(r.p),
    ci: `[${f(r.ciLow)}, ${f(r.ciHigh)}]`, n: `${r.nLeft} / ${r.nRight}`,
  }
  const apa = spec.apaTemplate
    .replace('{b}', f(r.estimate))
    .replace('{lo}', f(r.ciLow))
    .replace('{hi}', f(r.ciHigh))
    .replace('p {p}', `p ${fpApa(r.p)}`)
  const figs = figuresOf(spec)
  return {
    tables: [{ spec: { ...spec.tables[0], columns: t1cols }, rows: [row] }],
    note: null,
    figures: [{ caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figRdPng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
