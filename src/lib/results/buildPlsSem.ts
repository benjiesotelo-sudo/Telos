import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { PlsSemResult } from '../stats/plsSem'
import type { MatrixTable } from './types'
import type { CardContent, BuiltTable } from './builders'
import { f01 } from '../format/apa'

const DASH = '—'
/** Bounded value (|x| ≤ 1): leading-dot 2dp, or em-dash when null/NA. */
const fc = (v: unknown): string => (v == null || !Number.isFinite(Number(v)) ? DASH : f01(Number(v)))
/** Plain 2-dp value (f², VIF, Q², SE — these carry a leading 0). */
const f2 = (v: unknown): string => (v == null || !Number.isFinite(Number(v)) ? DASH : Number(v).toFixed(2))
const fpFmt = (v: unknown): string => {
  const n = Number(v)
  if (!Number.isFinite(n)) return DASH
  return n < 0.001 ? '< .001' : f01(n, 3)
}
const ci = (lo: unknown, hi: unknown): string => `[${fc(lo)}, ${fc(hi)}]`

export function buildPlsSem(spec: TestSpec, r: PlsSemResult): CardContent {
  const tableById = (id: string) => spec.tables.find((t) => t.id === id)!

  // T1 (merged, U6-T1): Measurement model — construct rows (__group marker, A6 renderer device) carry
  // α/ρA/CR (ρC)/AVE once; indicator rows (indented by the renderer) carry Mean/SD (item descriptives) and
  // the merged Loading/weight column (loading for reflective indicators, weight for formative ones) plus
  // t/p, leaving the construct-level columns blank. Row keys MUST match the registry spec's column keys
  // (ApaTable renders row[column.key]) — mirrors buildCbSem's cfa-loadings __group shape (U3-T1).
  const measurementRows: BuiltTable['rows'] = []
  for (const rel of r.reliability) {
    measurementRows.push({
      __group: String(rel.construct),
      path: String(rel.construct),
      alpha: fc(rel.alpha), rhoA: fc(rel.rhoA), rhoC: fc(rel.cr), ave: fc(rel.ave),
      mean: '', sd: '', loading: '', t: '', p: '',
    })
    for (const row of r.outer.filter((o) => o.construct === rel.construct)) {
      measurementRows.push({
        path: String(row.item), // indented child — CSS/LaTeX render the indent via __group, not the string itself
        alpha: '', rhoA: '', rhoC: '', ave: '',
        mean: f2(row.mean), sd: f2(row.sd),
        loading: fc(row.loading ?? row.weight), t: f2(row.t), p: fpFmt(row.p),
      })
    }
  }

  const tables: BuiltTable[] = [
    { spec: tableById('measurement'), rows: measurementRows },
  ]

  // T2: HTMT matrix (lowerOnly) — only when ≥ 2 constructs
  const labels = r.htmt.labels
  if (labels.length >= 2) {
    const htmtCells: (string | null)[][] = r.htmt.cells.map((rowCells, i) =>
      rowCells.map((val, j) => (j >= i || val == null ? null : f01(Number(val)))),
    )
    const htmtMatrix: MatrixTable = {
      kind: 'matrix',
      id: 'htmt',
      caption: tableById('htmt').title,
      rowLabels: labels,
      colLabels: labels,
      cells: htmtCells,
      lowerOnly: true,
    }
    tables.push({ spec: tableById('htmt'), rows: [], matrix: htmtMatrix })
  }

  // T3: Structural paths — Path · β · t · p · 95% CI · f² (spec column key 'f2')
  const t3rows = r.structural.map((row) => ({
    path: String(row.path),
    beta: fc(row.beta),
    t: f2(row.t),
    p: fpFmt(row.p),
    ci: ci(row.ciLower, row.ciUpper),
    f2: f2(row.fSquare),
  }))
  tables.push({ spec: tableById('structural'), rows: t3rows })

  // T4: Structural quality — Construct · R² · R²adj · Q²_predict
  const t4rows = r.quality.map((row) => ({
    construct: String(row.construct),
    r2: fc(row.r2),
    r2adj: fc(row.r2adj),
    q2: f2(row.q2),
  }))
  tables.push({ spec: tableById('structural-quality'), rows: t4rows })

  // T5: Indirect effects — only when chained paths exist
  if (r.indirect && r.indirect.length > 0) {
    const t5rows = r.indirect.map((row) => ({
      path: String(row.path),
      est: fc(row.est),
      se: f2(row.se),
      ci: ci(row.ciLower, row.ciUpper),
      p: fpFmt(row.p),
    }))
    tables.push({ spec: tableById('indirect-effects'), rows: t5rows })
  }

  // Figure — annotated path diagram rasterized via captureNode in ResultsScreen.download();
  // carry empty PNG placeholder so the figure caption renders.
  const fig = figuresOf(spec)[0]
  const figures: CardContent['figures'] = [
    { caption: fig.caption, type: fig.type, file: fig.file, png: new Uint8Array() },
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
