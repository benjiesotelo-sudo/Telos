import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { CbSemResult } from '../stats/runCbSem'
import { isSaturated } from '../stats/semSaturation'
import type { CardContent, BuiltTable } from './builders'
import type { MatrixTable } from './types'
import { f, f01, fp, fdf, fx } from '../format/apa'

const SATURATION_NOTE =
  'The model is saturated (df = 0): it has zero degrees of freedom, so global fit indices are not informative and are suppressed. Estimated paths and effects below are still interpretable.'

const blank = (id: string) => ({ id, title: '', columns: [] })
const specTable = (spec: TestSpec, id: string) =>
  spec.tables.find((t) => t.id === id) ?? blank(id)

export function buildCbSem(spec: TestSpec, r: CbSemResult): CardContent {
  const isPath = r.mode === 'path'
  const tables: BuiltTable[] = []
  let itemSampleNote: string | null = null

  // T1 (merged, U3-T1): Measurement model (loadings, reliability & item descriptives) — latent only.
  // Construct rows (__group marker, A6 renderer device) carry ω/α/CR/AVE once; item rows (indented by
  // the renderer) carry Mean/SD (item descriptives) and the CFA loading (B/SE/z/p/Std. loading), leaving
  // the construct-level columns blank. Row keys MUST match the registry spec's column keys (ApaTable
  // renders row[column.key]) — the standardized loading renders under 'std' (cbSem.ts spec), not the
  // runner's 'stdLoading'.
  if (!isPath && r.cfaLoadings.length) {
    const relByConstruct = new Map(r.reliability.map((row) => [String(row.construct), row]))
    const itemByKey = new Map(r.itemStats.map((s) => [`${s.construct}::${s.item}`, s]))
    const rows: BuiltTable['rows'] = []
    let lastConstruct: string | null = null
    for (const row of r.cfaLoadings) {
      const construct = String(row.construct)
      if (construct !== lastConstruct) {
        const rel = relByConstruct.get(construct)
        rows.push({
          __group: construct,
          path: construct, mean: '', sd: '', b: '', se: '', z: '', p: '', std: '',
          omega: rel ? f01(Number(rel.omega)) : '—', alpha: rel ? f01(Number(rel.alpha)) : '—',
          cr: rel ? f01(Number(rel.cr)) : '—', ave: rel ? f01(Number(rel.ave)) : '—',
        })
        lastConstruct = construct
      }
      const item = itemByKey.get(`${construct}::${row.item}`)
      rows.push({
        path: String(row.item), // indented child — CSS/LaTeX render the indent, not the string itself
        mean: item ? f(item.mean) : '—', sd: item ? f(item.sd) : '—',
        b: f(Number(row.b)), se: f(Number(row.se)), z: fdf(Number(row.z)), p: fp(Number(row.p)),
        std: f01(Number(row.stdLoading)), omega: '', alpha: '', cr: '', ave: '',
      })
    }
    tables.push({ spec: specTable(spec, 'cfa-loadings'), rows })

    // Note text is dynamic per missing-setting (post-review amendment): the item Mean/SD sample depends
    // on which `missing` option the run actually used, so a static registry sentence can't say this
    // correctly for both cases. Appended to note.text below (folded into U3-T5's labelled notes once
    // that task lands).
    const missingSetting = String(r.missing ?? 'listwise')
    const itemSampleClause = missingSetting === 'listwise'
      ? 'the listwise estimation sample (the same N as the model fit)'
      : "each item's own observed cases (N can vary by item under fiml/mi/pairwise; the model fit itself remains listwise)"
    itemSampleNote = `Item Mean/SD are computed on ${itemSampleClause}.`
  }

  // T4/T5 (U3-T2): Discriminant validity — Fornell-Larcker (italic √AVE diagonal, starred off-diagonal
  // latent correlations from corLvP) + HTMT; mirrors buildAve.ts's matrix construction, suppressed below
  // 2 constructs (same rule as the AVE card). corLvP's diagonal is R's NA_real_ -> null (never NaN), but
  // it is never read here: cellStars only touches the strict lower triangle (j < i).
  if (!isPath && r.fornellLarcker.length >= 2) {
    const stars = (p: number) => (p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : '')
    const flCells = r.fornellLarcker.map((row, i) => row.map((val, j) => (j > i ? null : f01(val))))
    const cellStars = r.fornellLarcker.map((row, i) =>
      row.map((_, j) => (j >= i ? null : stars(r.corLvP[i][j]))),
    )
    const flMatrix: MatrixTable = {
      kind: 'matrix', id: 'fornell-larcker', caption: specTable(spec, 'fornell-larcker').title,
      rowLabels: r.discriminantLabels, colLabels: r.discriminantLabels, cells: flCells,
      diagonalStyle: 'italic', lowerOnly: true, cellStars,
      starNote: '*p<.05, **p<.01, ***p<.001',
    }
    tables.push({ spec: specTable(spec, 'fornell-larcker'), rows: [], matrix: flMatrix })

    const htmtCells = r.htmt.map((row, i) => row.map((val, j) => (j >= i ? null : f01(val))))
    const htmtMatrix: MatrixTable = {
      kind: 'matrix', id: 'htmt', caption: specTable(spec, 'htmt').title,
      rowLabels: r.discriminantLabels, colLabels: r.discriminantLabels, cells: htmtCells, lowerOnly: true,
    }
    tables.push({ spec: specTable(spec, 'htmt'), rows: [], matrix: htmtMatrix })
  }

  // T5: Fit indices — suppressed when saturated (df==0). One shared predicate from semSaturation.ts.
  const saturated = r.saturated || isSaturated(r)
  if (r.fit && !saturated) {
    const fit = r.fit
    const rows = [{
      chisq: `${f(fit.chisq)} (${fdf(fit.df)}, ${fp(fit.pvalue)})`,
      chisqDf: f(fit.chisq / fit.df),
      cfi: f01(fit.cfi),
      tli: f01(fit.tli),
      rmsea: `${f01(fit.rmsea)} [${f01(fit.rmseaLower)}, ${f01(fit.rmseaUpper)}]`,
      srmr: f01(fit.srmr),
    }]
    tables.push({ spec: specTable(spec, 'fit-indices'), rows })
  }

  // T6/T7 merged (U3-T3): CB-SEM merges structural paths + indirect effects + moderation into ONE
  // H-numbered, dual-CI (percentile + BC), Result-ruled table (registry id 'structural-paths', now the
  // sole owner of that id in cbSem.ts). PATH_ANALYSIS keeps its OWN two-table legacy shape (id
  // 'structural-paths' + 'indirect-effects', single '95% CI' column, no H/spans/sections/Result) —
  // branch on spec.id, the only discriminator available here since both share the runner's row shape.
  // Result is Supported/Not supported from the PERCENTILE 95% CI excluding zero, α fixed .05 (design §U3-T3).
  const result = (lo: number, hi: number) => (lo > 0 || hi < 0 ? 'Supported' : 'Not supported')
  const isMerged = spec.id === 'cb-sem'
  let r2NoteText: string | null = null
  let disclosureText: string | null = null
  let abText: string | null = null

  if (isMerged) {
    const rows: BuiltTable['rows'] = []
    let h = 1
    if (r.structural?.length) {
      rows.push({ __section: 'Direct paths' })
      for (const row of r.structural) rows.push({
        h: `H${h++}`,
        path:
          row.fromName != null && row.toName != null
            ? `${row.fromName} → ${row.toName}`
            : `${row.from} → ${row.to}`,
        b: f(Number(row.b)), beta: f01(Number(row.stdBeta)), p: fp(Number(row.p)),
        percLower: f01(Number(row.ciPercLower)), percUpper: f01(Number(row.ciPercUpper)),
        bcLower: f01(Number(row.ciBcLower)), bcUpper: f01(Number(row.ciBcUpper)),
        result: result(Number(row.ciPercLower), Number(row.ciPercUpper)),
      })
    }
    if (r.indirect?.length) {
      rows.push({ __section: 'Indirect effects' })
      for (const row of r.indirect) rows.push({
        h: `H${h++}`, path: row.pathLabel != null ? String(row.pathLabel) : String(row.label),
        b: f(Number(row.est)), beta: fx(row.stdEst == null ? null : Number(row.stdEst), f01), p: fp(Number(row.p)),
        percLower: f01(Number(row.ciPercLower)), percUpper: f01(Number(row.ciPercUpper)),
        bcLower: f01(Number(row.ciBcLower)), bcUpper: f01(Number(row.ciBcUpper)),
        result: result(Number(row.ciPercLower), Number(row.ciPercUpper)),
      })
    }
    if (r.moderation?.rows.length) {
      rows.push({ __section: 'Moderation' })
      for (const row of r.moderation.rows) rows.push({
        h: `H${h++}`, path: `${row.pathLabel} × ${row.moderatorName}`,
        b: f(Number(row.b)), beta: f01(Number(row.stdBeta)), p: fp(Number(row.p)),
        percLower: f01(Number(row.ciPercLower)), percUpper: f01(Number(row.ciPercUpper)),
        bcLower: f01(Number(row.ciBcLower)), bcUpper: f01(Number(row.ciBcUpper)),
        result: result(Number(row.ciPercLower), Number(row.ciPercUpper)),
      })
    }
    if (rows.length) {
      tables.push({ spec: specTable(spec, 'structural-paths'), rows })

      // R² note: one line per endogenous construct, keyed by construct id and named via the structural
      // rows' toName (R² is always for the "to" side of a structural path).
      if (r.rsquare && Object.keys(r.rsquare).length) {
        const nameByTo = new Map(
          (r.structural ?? []).map((row) => [Number(row.to), row.toName != null ? String(row.toName) : String(row.to)]),
        )
        r2NoteText = Object.entries(r.rsquare)
          .map(([id, val]) => `R²(${nameByTo.get(Number(id)) ?? id}) = ${f01(Number(val))}`)
          .join(', ')
      }

      // match=FALSE disclosure (post-review amendment b): one de-duplicated note line when any
      // moderation row carries the unequal-indicator-counts disclosure (U2-T4).
      const disclosures = (r.moderation?.rows ?? []).map((row) => row.disclosure).filter((d): d is string => !!d)
      if (disclosures.length) disclosureText = Array.from(new Set(disclosures)).join(' ')

      // Andrews & Buchinsky (2000) bootstrap-count disclosure (post-review amendment a): BC CIs are more
      // resample-hungry than percentile CIs; flag when the run used fewer than 7,000 resamples.
      const nboot = Number(r.nboot ?? 5000)
      if (nboot < 7000) {
        abText =
          'Bias-corrected CIs benefit from ≥7,000 resamples (Andrews & Buchinsky, 2000); consider the 10,000 publication-grade preset for final runs.'
      }
    }
  } else {
    // PATH_ANALYSIS legacy shape — UNCHANGED from today: single 'ci' column, no H/spans/sections/Result.
    if (r.structural?.length) {
      const rows = r.structural.map((row) => ({
        path:
          row.fromName != null && row.toName != null
            ? `${row.fromName} → ${row.toName}`
            : `${row.from} → ${row.to}`,
        b: f(Number(row.b)),
        se: f(Number(row.se)),
        z: fdf(Number(row.z)),
        p: fp(Number(row.p)),
        beta: f01(Number(row.stdBeta)),
        ci: `[${f01(Number(row.ciLower))}, ${f01(Number(row.ciUpper))}]`,
        r2: fx(row.r2 == null ? null : Number(row.r2), f01),
      }))
      tables.push({ spec: specTable(spec, 'structural-paths'), rows })
    }
    if (r.indirect?.length) {
      const rows = r.indirect.map((row) => ({
        path: row.pathLabel != null ? String(row.pathLabel) : String(row.label),
        est: f(Number(row.est)),
        stdEst: fx(row.stdEst == null ? null : Number(row.stdEst), f01),
        se: f(Number(row.se)),
        ci: row.ciLower == null || row.ciUpper == null
          ? '—'
          : `[${Number(row.ciLower).toFixed(2)}, ${Number(row.ciUpper).toFixed(2)}]`,
        p: fp(Number(row.p)),
      }))
      tables.push({ spec: specTable(spec, 'indirect-effects'), rows })
    }
  }

  // Note: saturation flag wins; else the spec's tableNote, with the dynamic clauses appended (item-sample
  // from U3-T1, R²/disclosure/Andrews-Buchinsky from U3-T3 — folded into U3-T5's labelled notes once that
  // task lands).
  const noteExtras = [itemSampleNote, r2NoteText, disclosureText, abText].filter((s): s is string => !!s)
  const note: CardContent['note'] = saturated
    ? { kind: 'plain', text: SATURATION_NOTE }
    : spec.tableNote
      ? { ...spec.tableNote, text: noteExtras.length ? `${spec.tableNote.text} ${noteExtras.join(' ')}` : spec.tableNote.text }
      : noteExtras.length
        ? { kind: 'plain', text: noteExtras.join(' ') }
        : null

  // Figure: a placeholder slot so the bundle manifest carries figure_path-diagram.png; the REAL annotated-SVG
  // PNG is layered in ResultsScreen.download() via captureNode (design §4.2), NOT produced here.
  const fig = figuresOf(spec)[0]
  const figures: CardContent['figures'] = fig
    ? [{ caption: fig.caption, type: fig.type, file: fig.file, png: new Uint8Array(0) }]
    : []

  return {
    tables,
    note,
    figures,
    howToRead: spec.howToRead,
    apa: spec.apaTemplate,
    nExcluded: 0,
  }
}
