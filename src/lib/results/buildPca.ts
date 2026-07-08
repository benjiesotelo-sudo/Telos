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

  // APA (U9-T3 fix, 2026-07-06 audit): "correlation matrix; parallel analysis" used to be hardcoded,
  // wrong when standardize is off (covariance matrix) or the retention rule wasn't parallel analysis.
  const matrixType = r.standardize ? 'correlation matrix' : 'covariance matrix'
  const retentionLabel =
    r.retention === 'kaiser' ? 'the Kaiser eigenvalue > 1 rule'
    : r.retention === 'fixed' ? 'a fixed-component criterion'
    : 'parallel analysis'
  const cumPct = r.varianceExplained.at(-1)?.cumPct ?? 0
  const apa = spec.apaTemplate
    .replace('{matrixType}', matrixType)
    .replace('{retention}', retentionLabel)
    .replace('{n}', String(r.retain))
    .replace('{pct}', cumPct.toFixed(1))

  // Notes (U8-T4 labelled-notes sweep, mirrors buildCbSem.ts's U3-T5 pilot): pca.ts's single tableNote.text
  // is split into short labelled one-liners, content-preserving — every clause below maps back to a
  // clause in the pre-split tableNote (registry-only prose, not spec-pinned; pca.consistency.test.ts only
  // asserts `spec.tableNote` is defined, never its exact text). No dynamic note-extras exist on this card
  // (note was always spec.tableNote verbatim), so this split is purely static.
  const notes: CardContent['notes'] = [
    { label: 'Method', text: 'Component loading columns expand to the number of retained components; loadings are correlation-scaled (eigenvector × √eigenvalue).' },
    { label: 'Cutoffs', text: 'Loadings |< .32| are suppressed.' },
    { label: 'Scope', text: 'PCA is data reduction - components are weighted composites, not latent factors; communalities are not reported (Jolliffe & Cadima, 2016; Frick et al., 2025).', afterTableId: 'component-loadings' },
  ]

  return {
    tables,
    note: null,
    notes,
    figures,
    howToRead: spec.howToRead,
    apa,
    nExcluded: 0,
    // U8-T4: keyed to match the 'pca' EXPLAINERS entries (component, cumPct, eigenvalue, pc1, pc2, pc3,
    // pctVar, variable) in registry/explainers.ts. The retained-component count and the total cumulative
    // variance (same number the APA sentence reports) are genuine single run-level facts even though
    // their own table (T1) is per-component; T1's eigenvalue/pctVar and T2's per-variable loadings stay
    // generic (open-cardinality, no single "the" value).
    values: { nComponents: r.retain, totalCumPct: cumPct.toFixed(1) },
  }
}
