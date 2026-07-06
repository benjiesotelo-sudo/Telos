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
  // Fix round (review follow-up a, U3-T5): a nullish/non-finite bound must render a dash, never a
  // fabricated verdict — Number(null) coerces to 0 (finite!), so converting BEFORE the nullish check let
  // a missing bound masquerade as "the CI touches zero" and print "Not supported". Check nullish first.
  const result = (lo: unknown, hi: unknown) => {
    const loN = lo == null ? NaN : Number(lo)
    const hiN = hi == null ? NaN : Number(hi)
    return !Number.isFinite(loN) || !Number.isFinite(hiN) ? '—' : loN > 0 || hiN < 0 ? 'Supported' : 'Not supported'
  }
  const isMerged = spec.id === 'cb-sem'
  // Fix round (review findings 1+2): a direct-paths-only model never bootstraps (the runner's
  // needsBootstrap gate = hasIndirect || moderation), so ciBcLower/Upper come back null — they must
  // render as dashes via fx (the file's null→dash convention), never f01(Number(null)) = ".00" — and
  // ciPercLower/Upper hold delta-method (Wald) CIs from parameterEstimates, not bootstrap percentile
  // CIs, so the ciNote below must say so instead of the bootstrap-count (A&B) claim. Defaults to true:
  // every pre-existing hand-built CbSemResult fixture is bootstrap-shaped. Column headers deliberately
  // stay "Percentile 95% CI"/"BC 95% CI" (static registry spec) — the note carries the honesty.
  const bootstrapped = r.bootstrapped !== false
  // All four CI cells share the fx null→dash guard; a nullish bound renders '—'.
  const ci = (v: unknown) => fx(v == null ? null : Number(v), f01)
  let r2NoteText: string | null = null
  let disclosureText: string | null = null
  let ciNoteText: string | null = null

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
        percLower: ci(row.ciPercLower), percUpper: ci(row.ciPercUpper),
        bcLower: ci(row.ciBcLower), bcUpper: ci(row.ciBcUpper),
        result: result(row.ciPercLower, row.ciPercUpper),
      })
    }
    if (r.indirect?.length) {
      rows.push({ __section: 'Indirect effects' })
      for (const row of r.indirect) rows.push({
        h: `H${h++}`, path: row.pathLabel != null ? String(row.pathLabel) : String(row.label),
        b: f(Number(row.est)), beta: fx(row.stdEst == null ? null : Number(row.stdEst), f01), p: fp(Number(row.p)),
        percLower: ci(row.ciPercLower), percUpper: ci(row.ciPercUpper),
        bcLower: ci(row.ciBcLower), bcUpper: ci(row.ciBcUpper),
        result: result(row.ciPercLower, row.ciPercUpper),
      })
    }
    if (r.moderation?.rows.length) {
      rows.push({ __section: 'Moderation' })
      for (const row of r.moderation.rows) rows.push({
        h: `H${h++}`, path: `${row.pathLabel} × ${row.moderatorName}`,
        b: f(Number(row.b)), beta: f01(Number(row.stdBeta)), p: fp(Number(row.p)),
        percLower: ci(row.ciPercLower), percUpper: ci(row.ciPercUpper),
        bcLower: ci(row.ciBcLower), bcUpper: ci(row.ciBcUpper),
        result: result(row.ciPercLower, row.ciPercUpper),
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

      // CI provenance note (fix round). Bootstrapped runs keep the Andrews & Buchinsky (2000)
      // bootstrap-count disclosure (post-review amendment a): BC CIs are more resample-hungry than
      // percentile CIs; flagged when the run used fewer than 7,000 resamples. Non-bootstrapped runs
      // (direct paths only — zero resamples were drawn) instead state what the CI columns really hold.
      if (bootstrapped) {
        const nboot = Number(r.nboot ?? 5000)
        if (nboot < 7000) {
          ciNoteText =
            'Bias-corrected CIs benefit from ≥7,000 resamples (Andrews & Buchinsky, 2000); consider the 10,000 publication-grade preset for final runs.'
        }
      } else {
        // Review follow-up (b, U3-T5): make explicit that the Result column is still derived from these
        // (Wald, not bootstrap) intervals -- the Result rule itself doesn't change under this branch.
        ciNoteText =
          'CIs are delta-method (Wald) 95% intervals; bootstrap percentile and bias-corrected CIs apply when the model includes indirect or moderation effects. Result is derived from these intervals.'
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

  // Notes (U3-T5): CB-SEM (isMerged) is the labelled-notes worked example for A5 — the single giant
  // tableNote is replaced by several bold-labelled one-liners, content-preserving (every clause from
  // CB_SEM's old tableNote.text maps to exactly one labelled note; nothing dropped, nothing added).
  // PATH_ANALYSIS (legacy shape) is UNCHANGED: it still consumes spec.tableNote via the single `note`
  // field (its dynamic extras are always empty in practice, since itemSampleNote/r2NoteText/
  // disclosureText/ciNoteText are only ever populated inside the isMerged/!isPath branches above).
  let note: CardContent['note'] = null
  let notes: CardContent['notes']
  if (isMerged) {
    if (saturated) {
      notes = [{ label: 'Saturation', text: SATURATION_NOTE }]
    } else {
      const r2Static = 'R² is filled once per endogenous (outcome) construct.'
      // Fix round (U3-T5 review findings, item 1): restore the dropped bootstrap-provenance clause
      // ("each an interaction-term effect from the same bootstrap run", present in the pre-split
      // tableNote) and drop the false forward-reference to a conditional-effects table that Unit 5
      // hasn't built yet -- simple slopes are estimated (as `:=` defined parameters) now, but they are
      // not yet surfaced in a dedicated table.
      const modStatic =
        'Moderation edges appear only when drawn on the canvas, each an interaction-term effect from the same bootstrap run; simple slopes at -1 SD / mean / +1 SD are estimated as defined parameters.'
      notes = [
        { label: 'Scope', text: 'Tables shown follow the pipeline stages you ran (EFA → CFA → fit → structural); if EFA was deselected, the E1/E2 preamble is omitted; if the structural stage was deselected, Table 5 is omitted.' },
        { label: 'Cutoffs', text: 'Good-fit guidelines (Hu & Bentler, 1999; Marsh, Hau & Wen, 2004): CFI/TLI ≥ .95, RMSEA ≤ .06 [90% CI], SRMR ≤ .08 — guidelines, not pass/fail gates; RMSEA is unstable at small df / small N, so interpret it cautiously for compact models.' },
        { label: 'Estimator', text: 'Use WLSMV for ordinal indicators.' },
        { label: 'R²', text: r2NoteText ? `${r2Static} ${r2NoteText}` : r2Static },
        { label: 'Caution', text: 'EFA on the same sample is exploratory — treat it as a diagnostic, not confirmatory evidence.' },
        // Cross-references buildAve.ts's dedicated card, verbatim clause lift from the pre-T5 tableNote.
        { label: 'Discriminant validity', text: 'Discriminant validity also has its own card (AVE / convergent validity); it is included here so one run gives the complete measurement-model writeup.', afterTableId: 'htmt' },
      ]
      if (itemSampleNote) notes.push({ label: 'Item sample', text: itemSampleNote, afterTableId: 'cfa-loadings' })
      notes.push({ label: 'Indirect effects', text: 'The indirect-effects section of Table 5 appears only when the drawn structural paths form a chain (X → M → Y); each indirect effect is a lavaan defined effect with a bootstrapped 95% CI.', afterTableId: 'structural-paths' })
      if (ciNoteText) notes.push({ label: 'CIs', text: ciNoteText, afterTableId: 'structural-paths' })
      notes.push({ label: 'Moderation', text: disclosureText ? `${modStatic} ${disclosureText}` : modStatic })
    }
  } else {
    // PATH_ANALYSIS legacy shape — UNCHANGED from today: single note, spec-driven.
    const noteExtras = [itemSampleNote, r2NoteText, disclosureText, ciNoteText].filter((s): s is string => !!s)
    note = saturated
      ? { kind: 'plain', text: SATURATION_NOTE }
      : spec.tableNote
        ? { ...spec.tableNote, text: noteExtras.length ? `${spec.tableNote.text} ${noteExtras.join(' ')}` : spec.tableNote.text }
        : noteExtras.length
          ? { kind: 'plain', text: noteExtras.join(' ') }
          : null
  }

  // Figure: a placeholder slot so the bundle manifest carries figure_path-diagram.png; the REAL annotated-SVG
  // PNG is layered in ResultsScreen.download() via captureNode (design §4.2), NOT produced here.
  const fig = figuresOf(spec)[0]
  const figures: CardContent['figures'] = fig
    ? [{ caption: fig.caption, type: fig.type, file: fig.file, png: new Uint8Array(0) }]
    : []

  return {
    tables,
    note,
    notes,
    figures,
    howToRead: spec.howToRead,
    apa: spec.apaTemplate,
    nExcluded: 0,
  }
}
