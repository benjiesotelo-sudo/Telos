import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { HausmanResult } from '../stats/hausmanTest'
import type { CardContent } from './builders'
import { f, fp, fpApa } from '../format/apa'

export function buildHausmanTest(spec: TestSpec, r: HausmanResult): CardContent {
  const decision = r.p < r.alpha ? 'FE' : 'RE' // computed from actual p vs α — never hardcoded (report-only)
  const compareRows = r.compareRows.map((x) => ({ term: x.term, feB: f(x.feB), reB: f(x.reB), diff: f(x.diff) }))
  const apa = spec.apaTemplate
    .replace('{df}', String(r.df))
    .replace('{chisq}', f(r.chisq))
    .replace('p {p}', `p ${fpApa(r.p)}`)
  const figs = figuresOf(spec)
  return {
    tables: [
      { spec: spec.tables[0], rows: [{ chisq: f(r.chisq), df: String(r.df), p: fp(r.p), decision }] },
      { spec: spec.tables[1], rows: compareRows },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figCoefPng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
