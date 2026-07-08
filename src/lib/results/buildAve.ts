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

  // Notes (U8-T4 labelled-notes sweep, mirrors buildCbSem.ts's U3-T5 pilot): the single tableNote.text
  // (ave.ts) is split into short labelled one-liners, content-preserving — every clause below maps back
  // to a clause in the pre-split tableNote (registry-only prose, not spec-pinned; ave.consistency.test.ts
  // only asserts `spec.tableNote` is defined, never its exact text). When < 2 constructs, T2/T3 are
  // suppressed and the CURRENT builder-composed message (not the tableNote) is shown instead — unchanged
  // behavior, just carried in the same `notes` shape.
  const notes: CardContent['notes'] =
    k < 2
      ? [{ label: 'Scope', text: 'Discriminant validity (Tables 2 and 3) requires ≥ 2 constructs. Add more constructs to see the Fornell–Larcker and HTMT matrices.' }]
      : [
          { label: 'Cutoffs', text: 'AVE ≥ .50 indicates adequate convergent validity, computed from the CFA loadings (Fornell & Larcker, 1981); CR ≥ .70 is acceptable (Nunnally, 1978; Bagozzi & Yi, 1988); do not cite CR ≥ .70 to Fornell & Larcker; HTMT < .85 indicates discriminant validity for conceptually distinct constructs (Henseler, Ringle & Sarstedt, 2015).' },
          { label: 'Reliability', text: "ω (McDonald's) is the preferred reliability coefficient - model-based, not assuming tau-equivalence (McNeish, 2018); α is retained as a secondary/legacy column." },
          { label: 'Fornell–Larcker', text: 'Diagonal = √AVE (bold); off-diagonal = inter-construct latent correlations.', afterTableId: 'fornell-larcker' },
          { label: 'Scope', text: 'When only 1 construct is defined, Tables 2 and 3 are suppressed (discriminant validity requires ≥ 2 constructs). Applies to reflective constructs only.', afterTableId: 'htmt' },
        ]

  // U9-T3 fix (2026-07-06 audit): the APA sentence asserted "was supported" / "held" unconditionally,
  // regardless of the run's own numbers. Condition both clauses on THIS run's AVE/CR (convergent) and
  // HTMT (discriminant, only when computed — needs >= 2 constructs).
  const allAveOk = perConstruct.every((c) => c.ave >= 0.5)
  const allCrOk = perConstruct.every((c) => c.cr >= 0.7)
  const convVerdict = allAveOk && allCrOk ? 'supported' : 'not fully supported'
  let apa: string
  if (k >= 2) {
    const allHtmtOk = htmt.every((row, i) => row.every((val, j) => j >= i || val < 0.85))
    const discVerdict = allHtmtOk ? 'held' : 'did not hold'
    apa = spec.apaTemplate.replace('{convVerdict}', convVerdict).replace('{discVerdict}', discVerdict)
  } else {
    apa = `Convergent validity was ${convVerdict}, all AVE ≥ .50 and CR ≥ .70; discriminant validity was not assessed (fewer than 2 constructs).`
  }

  return {
    tables,
    note: null,
    notes,
    figures,
    howToRead: spec.howToRead,
    apa,
    nExcluded: 0,
    // U8-T4: keyed to match the 'ave' EXPLAINERS entries (alpha, ave, cr, omega) in registry/explainers.ts.
    // All four are per-construct (open-cardinality — 1+ constructs), so their explainers read generically
    // off the table rather than picking one arbitrary construct's number.
    values: { nConstructs: k },
  }
}
