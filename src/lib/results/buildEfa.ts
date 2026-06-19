import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { EfaResult } from '../stats/efa'
import type { MatrixTable } from './types'
import type { CardContent, BuiltTable } from './builders'
import { f, f01, fp } from '../format/apa'

const SUPPRESS = 0.32 // |loading| < this → blank cell (Tabachnick & Fidell)

export function buildEfa(spec: TestSpec, r: EfaResult): CardContent {
  const k = r.retain

  // Factor labels
  const factorLabels = Array.from({ length: k }, (_, i) => `F${i + 1}`)

  // T1: Suitability
  const t1rows = [
    {
      kmo: f01(r.kmo),
      bartlettChisq: r.bartlettChisq.toFixed(1),
      df: String(r.bartlettDf),
      p: fp(r.bartlettP),
    },
  ]

  // T2: Variance explained
  const t2rows = r.varianceExplained.map((row) => ({
    factor: row.factor,
    eigenvalue: row.eigenvalue.toFixed(2),
    pctVar: row.pctVar.toFixed(1),
    cumPct: row.cumPct.toFixed(1),
  }))

  // T3: Rotated loadings — dynamic columns (Item + F1..Fk + Communality)
  const t3rows = r.loadings.map((row) => {
    const obj: Record<string, string | number> = { item: row.item }
    row.loadings.forEach((load, fi) => {
      obj[`f${fi + 1}`] = Math.abs(load) < SUPPRESS ? '' : f01(load)
    })
    obj.communality = f01(row.communality)
    return obj
  })

  // Dynamic column defs for T3
  const t3spec: TestSpec['tables'][0] = {
    ...spec.tables[2],
    columns: [
      { key: 'item', label: 'Item' },
      ...factorLabels.map((fl, i) => ({ key: `f${i + 1}`, label: fl })),
      { key: 'communality', label: 'Communality' },
    ],
  }

  const tables: BuiltTable[] = [
    { spec: spec.tables[0], rows: t1rows },
    { spec: spec.tables[1], rows: t2rows },
    { spec: t3spec, rows: t3rows },
  ]

  // T4: Φ interfactor correlation matrix (oblique only; omit for varimax)
  if (r.phi !== null) {
    const phiCells: (string | null)[][] = r.phi.map((rowArr, ri) =>
      rowArr.map((val, ci) => {
        if (ci > ri) return null // upper triangle (lowerOnly)
        if (ci === ri) return '1.00'
        return f(val)
      }),
    )
    const phiMatrix: MatrixTable = {
      kind: 'matrix',
      id: 'interfactor-correlations',
      caption: spec.tables[3].title,
      rowLabels: factorLabels,
      colLabels: factorLabels,
      cells: phiCells,
      diagonal: 'plain',
      lowerOnly: true,
    }
    tables.push({ spec: spec.tables[3], rows: [], matrix: phiMatrix })
  }

  // Figure
  const fig = figuresOf(spec)[0]
  const figures: CardContent['figures'] = [
    { caption: fig.caption, type: fig.type, file: fig.file, png: r.figScreePng },
  ]

  // APA
  const cumPct = r.varianceExplained.at(-1)?.cumPct ?? 0
  const apa = spec.apaTemplate
    .replace('__', f01(r.kmo))
    .replace('__', String(r.bartlettDf))
    .replace('__', r.bartlettChisq.toFixed(1))
    .replace('__', String(r.retain))
    .replace('__', cumPct.toFixed(1))
    .replace('__', r.rotation)

  return {
    tables,
    note: spec.tableNote ?? null,
    figures,
    howToRead: spec.howToRead,
    apa,
    nExcluded: 0,
  }
}
