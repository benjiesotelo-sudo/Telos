import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { CompositeReliabilityResult } from '../stats/compositeReliability'
import type { CardContent, BuiltTable } from './builders'
import { f01 } from '../format/apa'

export function buildCompositeReliability(spec: TestSpec, r: CompositeReliabilityResult): CardContent {
  const { cfa, figReliabilityPng } = r
  const { perConstruct } = cfa

  // T1: Composite reliability — Construct / CR / AVE / ω / α
  // CR = ω for a congeneric model (same value — both columns from compRelSEM)
  const t1rows = perConstruct.map((c) => ({
    construct: c.name,
    cr: f01(c.cr),
    ave: f01(c.ave),
    omega: f01(c.omega),
    alpha: f01(c.alpha),
  }))

  const tables: BuiltTable[] = [{ spec: spec.tables[0], rows: t1rows }]

  // Figure
  const fig = figuresOf(spec)[0]
  const figures: CardContent['figures'] = [
    { caption: fig.caption, type: fig.type, file: fig.file, png: figReliabilityPng },
  ]

  return {
    tables,
    note: spec.tableNote ?? null,
    figures,
    howToRead: spec.howToRead,
    apa: spec.apaTemplate,
    nExcluded: 0,
  }
}
