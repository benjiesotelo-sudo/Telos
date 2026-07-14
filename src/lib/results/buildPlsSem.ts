import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { PlsSemResult } from '../stats/plsSem'
import type { MatrixTable } from './types'
import type { CardContent, BuiltTable } from './builders'
import { f, f01, fp, fpApa } from '../format/apa'

const DASH = '—'
/** Bounded value (|x| ≤ 1): leading-dot 2dp, or em-dash when null/NA. */
const fc = (v: unknown): string => (v == null || !Number.isFinite(Number(v)) ? DASH : f01(Number(v)))
/** Plain 2-dp value (f², VIF, Q², SE — these carry a leading 0). U+2212 minus via house f() so a negative
 *  t or Q²_predict (a real, expected value for poor predictive relevance) never renders an ASCII hyphen. */
const f2 = (v: unknown): string => (v == null || !Number.isFinite(Number(v)) ? DASH : f(Number(v)))
/** Table-cell p, compact no-space house style (fp), not the spaced APA-sentence form (fpApa). */
const fpFmt = (v: unknown): string => {
  const n = Number(v)
  return Number.isFinite(n) ? fp(n) : DASH
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
  // R6 (Hair et al. 2019 completeness): f² (checklist step 4) and inner VIF (structural collinearity,
  // step 1) are Table 3 columns - f² returns from U6-T3's note-line arrangement now that the column
  // exists again, and VIF comes from seminr's s$vif_antecedents (null for a single-antecedent target,
  // where collinearity is undefined -> em dash, never a fabricated 1.00).
  const t3rows = r.structural.map((row, i) => ({
    h: `H${i + 1}`,
    path: String(row.path),
    beta: fc(row.beta),
    p: fpFmt(row.p),
    f2: f2(row.fSquare),
    vif: f2(row.vif),
    ciPercLo: fc(row.ciLower), ciPercHi: fc(row.ciUpper),
    ciBcLo: fc(row.ciBcLower), ciBcHi: fc(row.ciBcUpper),
    result: result(row.ciLower, row.ciUpper),
  }))
  tables.push({ spec: tableById('structural'), rows: t3rows })

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
  // empty PNG placeholder so the figure caption renders. Figure 1 (U6-T5; chart replaced by R4, present
  // only when moderation ran, mirrors buildCbSem.ts): the two-line interaction plot - real PNG bytes
  // from plsSem.ts's capturePlot via the shared interactionPlot.ts module (same figure treatment as CB-SEM).
  const figs = figuresOf(spec)
  const figures: CardContent['figures'] = [
    { caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: new Uint8Array() },
    r.slopes?.length && figs[1]
      ? { caption: figs[1].caption, type: figs[1].type, file: figs[1].file, png: r.figModSlopesPng ?? new Uint8Array(0) }
      : undefined,
  ].filter((x): x is NonNullable<typeof x> => x != null)

  // Dynamic note extras append to the static registry note text, same append pattern as CB-SEM's
  // PATH_ANALYSIS legacy branch (buildCbSem.ts). The U6-T3 R²/f² note line is retired by R6: f² is a
  // Table 3 column again and R² has its own quality table (Table 4), so the note would only duplicate
  // both. Only the bootstrap-count disclosure remains dynamic.
  const noteExtras = [bootNoteText].filter((s): s is string => !!s)
  const note: CardContent['note'] = spec.tableNote
    ? { ...spec.tableNote, text: noteExtras.length ? `${spec.tableNote.text} ${noteExtras.join(' ')}` : spec.tableNote.text }
    : noteExtras.length
      ? { kind: 'plain', text: noteExtras.join(' ') }
      : null

  // APA (U9-T3 fix, 2026-07-06 audit): the template used to be returned VERBATIM, "__" never filled.
  // Worked-example convention (mirrors multiple-linear-regression's "predictor X" -> real term name):
  // fill from the FIRST structural path, plus its target construct's R² from the quality table.
  const firstStruct = r.structural[0] as Record<string, unknown> | undefined
  let apa = spec.apaTemplate
  if (firstStruct) {
    const [fromName, toName] = String(firstStruct.path).split(' → ')
    const target = r.quality.find((q) => String((q as Record<string, unknown>).construct) === toName) as Record<string, unknown> | undefined
    const pNum = Number(firstStruct.p)
    apa = apa
      .replace('X to Y', `${fromName} to ${toName}`)
      .replace('{beta}', fc(firstStruct.beta))
      .replace('p={p}', Number.isFinite(pNum) ? `p ${fpApa(pNum)}` : 'p —')
      .replace('{r2y}', target ? fc(target.r2) : DASH)
  } else {
    apa = apa.replace('X to Y', 'X to Y').replace('{beta}', DASH).replace('p={p}', 'p —').replace('{r2y}', DASH)
  }

  return {
    tables,
    note,
    figures,
    howToRead: spec.howToRead,
    apa,
    nExcluded: 0,
    // U8-T4: keyed to match the 'pls-sem' EXPLAINERS entries in registry/explainers.ts. Every table on
    // this card (measurement/structural/quality/indirect/conditional) is open-cardinality (1+ constructs,
    // 1+ paths, 0+ endogenous constructs, 0+ indirect effects, 0+ moderation levels), so every explainer
    // reads generically off its own table rather than picking one arbitrary row's number; values carries
    // only the run-shape counts, harmless if never read by an interpret().
    values: { nConstructs: labels.length, nPaths: r.structural.length, nEndogenous: r.quality.length },
  }
}
