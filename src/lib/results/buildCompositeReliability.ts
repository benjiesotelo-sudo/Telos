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

  // U9-T3 fix (2026-07-06 audit): the ".__" placeholder was NEVER filled -- the builder returned
  // spec.apaTemplate verbatim. Worked-example convention (mirrors multiple-linear-regression's "predictor
  // X" -> the first term): report the FIRST construct's own name, CR value, and a live verdict.
  const first = perConstruct[0]
  const apa = spec.apaTemplate
    .replace('{construct}', first.name)
    .replace('{verdict}', first.cr >= 0.7 ? 'satisfactory' : 'not satisfactory')
    .replace('{cr}', f01(first.cr))

  return {
    tables,
    note: spec.tableNote ?? null,
    figures,
    howToRead: spec.howToRead,
    apa,
    nExcluded: 0,
    // U8-T4: keyed to match the 'composite-reliability' EXPLAINERS entries (alpha, ave, cr, omega) in
    // registry/explainers.ts. All four are per-construct (open-cardinality), so their explainers read
    // generically off the table rather than picking one arbitrary construct's number.
    values: { nConstructs: perConstruct.length },
  }
}
