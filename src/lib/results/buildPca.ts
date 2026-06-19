import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { PcaResult } from '../stats/pca'
import type { CardContent, BuiltTable } from './builders'
import { f01 } from '../format/apa'

const SUPPRESS = 0.32 // |loading| < this → blank cell (Tabachnick & Fidell, consistent with EFA)

export function buildPca(spec: TestSpec, r: PcaResult): CardContent {
  const k = r.retain

  // Component labels
  const compLabels = Array.from({ length: k }, (_, i) => `PC${i + 1}`)

  // T1: Variance explained
  const t1rows = r.varianceExplained.map((row) => ({
    component: row.component,
    eigenvalue: row.eigenvalue.toFixed(3),
    pctVar: row.pctVar.toFixed(1),
    cumPct: row.cumPct.toFixed(1),
  }))

  // T2: Component loadings — dynamic columns (Variable + PC1..PCk); NO communality
  const t2rows = r.loadings.map((row) => {
    const obj: Record<string, string | number> = { variable: row.variable }
    row.loadings.forEach((load, ci) => {
      obj[`pc${ci + 1}`] = Math.abs(load) < SUPPRESS ? '' : f01(load)
    })
    return obj
  })

  // Dynamic column defs for T2
  const t2spec: TestSpec['tables'][0] = {
    ...spec.tables[1],
    columns: [
      { key: 'variable', label: 'Variable' },
      ...compLabels.map((cl, i) => ({ key: `pc${i + 1}`, label: cl })),
    ],
  }

  const tables: BuiltTable[] = [
    { spec: spec.tables[0], rows: t1rows },
    { spec: t2spec, rows: t2rows },
  ]

  // Figure
  const fig = figuresOf(spec)[0]
  const figures: CardContent['figures'] = [
    { caption: fig.caption, type: fig.type, file: fig.file, png: r.figScreePng },
  ]

  // APA
  const cumPct = r.varianceExplained.at(-1)?.cumPct ?? 0
  const apa = spec.apaTemplate
    .replace('__', String(r.retain))
    .replace('__', cumPct.toFixed(1))

  return {
    tables,
    note: spec.tableNote ?? null,
    figures,
    howToRead: spec.howToRead,
    apa,
    nExcluded: 0,
  }
}
