import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { AveResult } from '../stats/runAve'
import type { MatrixTable } from './types'
import type { CardContent, BuiltTable } from './builders'
import { f01 } from '../format/apa'

export function buildAve(spec: TestSpec, r: AveResult): CardContent {
  const { cfa, figValidityPng } = r
  const { perConstruct, fornellLarcker, htmt, labels } = cfa
  const k = labels.length

  // T1: Convergent validity — Construct / AVE / CR / ω / α
  const t1rows = perConstruct.map((c) => ({
    construct: c.name,
    ave: f01(c.ave),
    cr: f01(c.cr),
    omega: f01(c.omega),
    alpha: f01(c.alpha),
  }))

  const tables: BuiltTable[] = [{ spec: spec.tables[0], rows: t1rows }]

  // T2 and T3 (Fornell-Larcker + HTMT) only when ≥ 2 constructs
  if (k >= 2) {
    // T2: Fornell-Larcker matrix — diagonal = √AVE (bold), off-diagonal = latent correlations; lowerOnly
    const flCells: (string | null)[][] = fornellLarcker.map((row, i) =>
      row.map((val, j) => {
        if (j > i) return null // upper triangle suppressed (lowerOnly)
        return f01(val)
      }),
    )
    const flMatrix: MatrixTable = {
      kind: 'matrix',
      id: 'fornell-larcker',
      caption: spec.tables[1].title,
      rowLabels: labels,
      colLabels: labels,
      cells: flCells,
      diagonal: 'bold',
      lowerOnly: true,
    }
    // matrix field triggers the matrix renderer in ResultPreviewCard; spec/rows are never used for matrix tables
    tables.push({ spec: spec.tables[1], rows: [], matrix: flMatrix })

    // T3: HTMT matrix — lowerOnly; no bold diagonal (diagonal is 1 by definition, suppressed)
    const htmtCells: (string | null)[][] = htmt.map((row, i) =>
      row.map((val, j) => {
        if (j >= i) return null // upper triangle + diagonal suppressed (lowerOnly + no self-HTMT)
        return f01(val)
      }),
    )
    const htmtMatrix: MatrixTable = {
      kind: 'matrix',
      id: 'htmt',
      caption: spec.tables[2].title,
      rowLabels: labels,
      colLabels: labels,
      cells: htmtCells,
      lowerOnly: true,
    }
    tables.push({ spec: spec.tables[2], rows: [], matrix: htmtMatrix })
  }

  // Figure
  const fig = figuresOf(spec)[0]
  const figures: CardContent['figures'] = [
    { caption: fig.caption, type: fig.type, file: fig.file, png: figValidityPng },
  ]

  // Note: tableNote is spec-defined; note on CardContent
  const noteMsg =
    k < 2
      ? 'Discriminant validity (Tables 2 and 3) requires ≥ 2 constructs. Add more constructs to see the Fornell–Larcker and HTMT matrices.'
      : null

  const note: CardContent['note'] = noteMsg
    ? { kind: 'plain', text: noteMsg }
    : (spec.tableNote ?? null)

  return {
    tables,
    note,
    figures,
    howToRead: spec.howToRead,
    apa: spec.apaTemplate,
    nExcluded: 0,
  }
}
