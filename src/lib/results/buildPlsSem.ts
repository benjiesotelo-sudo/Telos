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

  // T3 (U6-T3 reshape): Structural paths — SAME shape as CB-SEM's Table 5 (H | Path | β | p | dual CIs |
  // Result), minus CB-SEM's separate unstandardized-B column (PLS path coefficients are already on the
  // standardized/composite scale, so there is only one 'beta'). BC = hand-rolled z0-adjusted percentile
  // from seminr's raw boot matrix (plsBcCi.ts), computed R-side in plsSem.ts's R block — verified against
  // lavaan's boot.ci.type="bca.simple" on a shared fixture (plsBcCi.test.ts). H-ordering here is creation
  // order (canvas array order); PLS-SEM has no indirect/moderation rows ahead of structural in this task.
  // Result rule mirrors CB-SEM exactly: nullish/non-finite bounds render a dash, never a fabricated verdict
  // (Number(null) coerces to 0, which is finite — check nullish BEFORE the finite check).
  const result = (lo: unknown, hi: unknown): string => {
    const loN = lo == null ? NaN : Number(lo)
    const hiN = hi == null ? NaN : Number(hi)
    return !Number.isFinite(loN) || !Number.isFinite(hiN) ? DASH : loN > 0 || hiN < 0 ? 'Supported' : 'Not supported'
  }
  const t3rows = r.structural.map((row, i) => ({
    h: `H${i + 1}`,
    path: String(row.path),
    beta: fc(row.beta),
    p: fpFmt(row.p),
    ciPercLo: fc(row.ciLower), ciPercHi: fc(row.ciUpper),
    ciBcLo: fc(row.ciBcLower), ciBcHi: fc(row.ciBcUpper),
    result: result(row.ciLower, row.ciUpper),
  }))
  tables.push({ spec: tableById('structural'), rows: t3rows })

  // R²/f² note line (mirrors CB-SEM's R² note-line pattern, U3-T3): one line per endogenous construct's
  // R², with each incoming path's f² parenthesized alongside its source construct — since f² is no longer
  // a structural-table column (dual CIs took its place), it joins the note instead of becoming a silent,
  // unrendered row key. Path strings are always built R-side as "From → To" (plsSem.ts), so splitting on
  // the arrow recovers the source/target names without a second field on the row.
  let r2NoteText: string | null = null
  if (r.quality.length) {
    r2NoteText = r.quality
      .map((q) => {
        const target = String(q.construct)
        const incoming = r.structural.filter((row) => String(row.path).split(' → ')[1] === target)
        const fParts = incoming
          .map((row) => `${String(row.path).split(' → ')[0]}=${f2(row.fSquare)}`)
          .join(', ')
        return `R²(${target}) = ${fc(q.r2)}${fParts ? ` (f² ${fParts})` : ''}`
      })
      .join('; ')
  }

  // Andrews & Buchinsky (2000) bootstrap-count disclosure (mirrors CB-SEM's note exactly) — PLS-SEM's
  // structural table always bootstraps (seminr's estimate_pls has no closed-form SE path), so this note
  // is unconditional on run mode, only on nboot count.
  const nboot = Number(r.nboot ?? 5000)
  const bootNoteText =
    nboot < 7000
      ? 'Bias-corrected CIs benefit from ≥7,000 resamples (Andrews & Buchinsky, 2000); consider the 10,000 publication-grade preset for final runs.'
      : null

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

  // Conditional-effects table (U6-T5): same shape/pattern as buildCbSem.ts's Table 6 (isMultiMod dynamic
  // 'Moderation' column when >1 distinct moderation edge is present), using PLS's OWN formatting helpers
  // (fc/f2/fpFmt/ci already defined above) rather than CB-SEM's apa.ts imports - column label is 'β' (not
  // 'B'/'Std. β') since PLS-SEM has no separate unstandardized-B column anywhere else on this card.
  if (r.slopes?.length) {
    const isMultiMod = new Set(r.slopes.map((s) => s.modId)).size > 1
    const condRows = r.slopes.map((s) => ({
      ...(isMultiMod ? { moderation: s.label } : {}),
      level: s.level, b: fc(s.b), se: f2(s.se), p: fpFmt(s.p), ci: ci(s.ciLower, s.ciUpper),
    }))
    const baseSpec = tableById('conditional-effects')
    const condSpec = isMultiMod
      ? { ...baseSpec, columns: [{ key: 'moderation', label: 'Moderation' }, ...baseSpec.columns] }
      : baseSpec
    tables.push({ spec: condSpec, rows: condRows })
  }

  // Figure 0 - annotated path diagram rasterized via captureNode in ResultsScreen.download(); carry
  // empty PNG placeholder so the figure caption renders. Figure 1 (U6-T5, present only when moderation
  // ran, mirrors buildCbSem.ts): the whiskered simple-slopes plot - real PNG bytes from plsSem.ts's
  // capturePlot via the shared simpleSlopesPlot.ts module (same figure treatment as CB-SEM).
  const figs = figuresOf(spec)
  const figures: CardContent['figures'] = [
    { caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: new Uint8Array() },
    r.slopes?.length && figs[1]
      ? { caption: figs[1].caption, type: figs[1].type, file: figs[1].file, png: r.figModSlopesPng ?? new Uint8Array(0) }
      : undefined,
  ].filter((x): x is NonNullable<typeof x> => x != null)

  // Dynamic note extras (R²/f² line + bootstrap-count disclosure) append to the static registry note
  // text, same append pattern as CB-SEM's PATH_ANALYSIS legacy branch (buildCbSem.ts).
  const noteExtras = [r2NoteText, bootNoteText].filter((s): s is string => !!s)
  const note: CardContent['note'] = spec.tableNote
    ? { ...spec.tableNote, text: noteExtras.length ? `${spec.tableNote.text} ${noteExtras.join(' ')}` : spec.tableNote.text }
    : noteExtras.length
      ? { kind: 'plain', text: noteExtras.join(' ') }
      : null

  return {
    tables,
    note,
    figures,
    howToRead: spec.howToRead,
    apa: spec.apaTemplate,
    nExcluded: 0,
  }
}
