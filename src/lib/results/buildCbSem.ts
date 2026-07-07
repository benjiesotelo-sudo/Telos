import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { CbSemResult } from '../stats/runCbSem'
import { isSaturated } from '../stats/semSaturation'
import type { CardContent, BuiltTable } from './builders'
import type { MatrixTable } from './types'
import { f, f01, fp, fdf, fx, fpApa } from '../format/apa'

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

  // Conditional-effects table (U5-T2): same `moderation.slopes[]` numbers as the whiskered simple-slopes
  // figure (runCbSem.ts) — percentile CI only (binding contract), independent of the isMerged/isPath
  // branching above (moderation never appears in path-analysis mode, design §A7).
  // Fix round (multi-moderation regression): with 2+ moderation edges, slopes holds 3 rows PER edge, all
  // sharing the same 3 `level` values — indistinguishable without the edge identity. Single-moderation
  // (the common case, and the one the master HTML/consistency test pin) keeps the EXACT static 5-column
  // registry spec unchanged (same spec object, same columns array — byte-identical to today). Only when
  // >1 distinct moderation is present does the builder clone the spec with a prepended 'Moderation'
  // column (dynamic-columns-in-the-builder approach, since the registry spec is static per test id).
  if (r.moderation?.slopes.length) {
    const isMultiMod = new Set(r.moderation.slopes.map((s) => s.modId)).size > 1
    const rows = r.moderation.slopes.map((s) => ({
      ...(isMultiMod ? { moderation: s.label } : {}),
      level: s.level, b: f(s.b), se: f(s.se), p: fp(s.p), ci: `[${f01(s.ciPercLower)}, ${f01(s.ciPercUpper)}]`,
    }))
    const baseSpec = specTable(spec, 'conditional-effects')
    const tableSpec = isMultiMod
      ? { ...baseSpec, columns: [{ key: 'moderation', label: 'Moderation' }, ...baseSpec.columns] }
      : baseSpec
    tables.push({ spec: tableSpec, rows })
  }

  // Notes (U3-T5 + U8-T4): CB-SEM (isMerged) was the labelled-notes worked example for A5 — the single
  // giant tableNote is replaced by several bold-labelled one-liners, content-preserving (every clause
  // from CB_SEM's old tableNote.text maps to exactly one labelled note; nothing dropped, nothing added).
  // PATH_ANALYSIS (legacy shape) gets the SAME U8-T4 treatment below, reusing the mechanism, not
  // redoing CB-SEM's decomposition. Its dynamic extras are always empty in practice (itemSampleNote/
  // r2NoteText/disclosureText/ciNoteText are only ever populated inside the isMerged/!isPath branches
  // above), so noteExtras below is a defensive no-op today, kept only so nothing silently drops if a
  // future runner change ever populates one of them for path mode.
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
    // PATH_ANALYSIS labelled notes (U8-T4 sweep, reusing CB-SEM's U3-T5 mechanism — content-preserving
    // split of pathAnalysis.ts's CURRENT tableNote.text, read in full before splitting; nothing dropped,
    // nothing added, no new claims). No table-number references to correct here (path-analysis's
    // tableNote never cited a "Table N"). No moderation scope-boundary sentence exists in the current
    // tableNote/howToRead to reword either (moderation is a latent-model-only feature per §A7/U2-T4's
    // runner guard; path-analysis's own card text simply never discusses moderation at all, so there is
    // no stale future-tense claim carried forward here).
    const noteExtras = [itemSampleNote, r2NoteText, disclosureText, ciNoteText].filter((s): s is string => !!s)
    notes = saturated
      ? [{ label: 'Saturation', text: SATURATION_NOTE }]
      : [
          { label: 'Scope', text: 'Path analysis fits directed relationships among observed variables (lavaan::sem) - no latent measurement model, so no CFA loadings, reliability, or AVE are reported.' },
          { label: 'Fit', text: 'When the model is saturated (df = 0, e.g. a single-mediator X → M → Y chain), it fits the data perfectly by construction and global fit indices (χ², CFI, TLI, RMSEA, SRMR) are not reported; an over-identified model (df > 0) reports fit, interpreting RMSEA cautiously at small df / small N (Kenny, Kaniskan & McCoach, 2015).', afterTableId: 'structural-paths' },
          { label: 'Indirect effects', text: 'Indirect (mediated) effects are tested with bias-uncorrected percentile bootstrap 95% CIs (5,000 resamples; MacKinnon, Lockwood & Williams, 2004); an interval excluding 0 indicates a credible indirect effect.', afterTableId: 'indirect-effects' },
        ]
    if (noteExtras.length) notes.push({ label: 'Notes', text: noteExtras.join(' ') })
  }

  // Figure 0: a placeholder slot so the bundle manifest carries figure_path-diagram.png; the REAL
  // annotated-SVG PNG is layered in ResultsScreen.download() via captureNode (design §4.2), NOT produced
  // here. Figure 1 (U5-T2): the simple-slopes plot IS produced here — real PNG bytes from runCbSem.ts's
  // capturePlot — present only when moderation ran (optional FigureSpec; ResultPreviewCard's figureSlot
  // fix keeps this from being masked by the live canvas, which only ever covers figure 0).
  const figs = figuresOf(spec)
  const figures: CardContent['figures'] = [
    figs[0] ? { caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: new Uint8Array(0) } : undefined,
    r.moderation && figs[1] ? { caption: figs[1].caption, type: figs[1].type, file: figs[1].file, png: r.figModSlopesPng ?? new Uint8Array(0) } : undefined,
  ].filter((x): x is NonNullable<typeof x> => x != null)

  // U8-T4: aggregate helpers for cb-sem/path-analysis's open-cardinality tables (documented aggregate
  // convention, same as multiple-linear-regression's vifMax) — a flat `values` lookup can't hold one
  // number per dynamic-length item/construct/path row, so several explainer keys below report the
  // range actually observed in THIS run's table instead of picking one arbitrary row.
  const nums = (rows: Array<Record<string, unknown>>, key: string) =>
    rows.map((row) => Number(row[key])).filter((n) => Number.isFinite(n))
  const rangeOf = (ns: number[], fmt: (n: number) => string) =>
    ns.length ? { lo: fmt(Math.min(...ns)), hi: fmt(Math.max(...ns)) } : { lo: undefined, hi: undefined }
  // Namespaces a {lo,hi} range under `${prefix}Lo`/`${prefix}Hi` so every aggregate below gets its own
  // distinct values-object keys (no risk of two different concerns colliding on a bare `lo`/`hi`).
  const rekey = (range: { lo: string | undefined; hi: string | undefined }, prefix: string) =>
    ({ [`${prefix}Lo`]: range.lo, [`${prefix}Hi`]: range.hi }) as Record<string, string | undefined>

  // U8-T3/U8-T4: keyed to match the 'cb-sem' EXPLAINERS entries (cfi, rmsea, tli, srmr, chisq, chisqDf,
  // mean, sd, b, se, z, std, omega, alpha, cr, ave, beta, h, percLower, percUpper, bcLower, bcUpper,
  // result — rmseaLower/rmseaUpper convention, T1-review MUST) and the 'path-analysis' EXPLAINERS entries
  // (b, se, z, p, beta, ci, r2, est) in registry/explainers.ts. isMerged/isPath are mutually exclusive per
  // call (one spec.id at a time), so the two cards' distinctly-named keys below never collide; fit values
  // stay empty (not partially-undefined) when fit is suppressed for saturation, mirroring the fit-indices
  // table's own `r.fit && !saturated` gate — a saturated model's fit indices are "not informative", so no
  // explainer line should quote them either. EFA-preamble keys (kmo/bartlettChisq/df/p/f1/f2/communality)
  // have registry entries for coverage but stay unpopulated on purpose — the E1/E2 EFA-preamble stage
  // (design §U3-T4) isn't wired into this runner yet (r.efaSuitability/efaLoadings are still-undefined
  // placeholders on CbSemResult), so those lines correctly self-skip via TermExplainers' guard, exactly
  // as the E1/E2 TABLES themselves are omitted today.
  // path-analysis's own registry spec has no 'fit-indices' table at all (only structural-paths +
  // indirect-effects — its saturation handling is a note/flag, not a rendered fit table), so fit values
  // are cb-sem-only, same gate as measurementValues/structuralValues below.
  const fitValues: CardContent['values'] = !isPath && r.fit && !saturated
    ? {
        cfi: f01(r.fit.cfi), tli: f01(r.fit.tli), rmsea: f01(r.fit.rmsea),
        rmseaLower: f01(r.fit.rmseaLower), rmseaUpper: f01(r.fit.rmseaUpper), srmr: f01(r.fit.srmr),
        chisq: f(r.fit.chisq), chisqDf: f(r.fit.chisq / r.fit.df), fitDf: fdf(r.fit.df), fitP: fp(r.fit.pvalue),
      }
    : {}
  const meanRange = !isPath && r.itemStats.length ? rangeOf(r.itemStats.map((s) => s.mean), f) : { lo: undefined, hi: undefined }
  const sdRange = !isPath && r.itemStats.length ? rangeOf(r.itemStats.map((s) => s.sd), f) : { lo: undefined, hi: undefined }
  const measurementValues: CardContent['values'] = !isPath && r.cfaLoadings.length
    ? {
        itemMeanLo: meanRange.lo, itemMeanHi: meanRange.hi, itemSdLo: sdRange.lo, itemSdHi: sdRange.hi,
        ...rekey(rangeOf(nums(r.cfaLoadings, 'b'), f), 'loadB'),
        ...rekey(rangeOf(nums(r.cfaLoadings, 'se'), f), 'loadSe'),
        ...rekey(rangeOf(nums(r.cfaLoadings, 'z'), fdf), 'loadZ'),
        ...rekey(rangeOf(nums(r.cfaLoadings, 'p'), fp), 'loadP'),
        ...rekey(rangeOf(nums(r.cfaLoadings, 'stdLoading'), f01), 'stdLoad'),
        ...rekey(rangeOf(nums(r.reliability, 'omega'), f01), 'omega'),
        ...rekey(rangeOf(nums(r.reliability, 'alpha'), f01), 'alpha'),
        ...rekey(rangeOf(nums(r.reliability, 'cr'), f01), 'cr'),
        ...rekey(rangeOf(nums(r.reliability, 'ave'), f01), 'ave'),
        nConstructs: r.reliability.length, nItems: r.cfaLoadings.length,
      }
    : {}
  const mergedRows = isMerged
    ? [
        ...(r.structural ?? []).map((row) => ({ lo: row.ciPercLower, hi: row.ciPercUpper, beta: row.stdBeta, p: row.p })),
        ...(r.indirect ?? []).map((row) => ({ lo: row.ciPercLower, hi: row.ciPercUpper, beta: row.stdEst, p: row.p })),
        ...(r.moderation?.rows ?? []).map((row) => ({ lo: row.ciPercLower, hi: row.ciPercUpper, beta: row.stdBeta, p: row.p })),
      ]
    : []
  const structuralValues: CardContent['values'] = isMerged
    ? {
        hCount: mergedRows.length,
        supportedCount: mergedRows.filter((row) => result(row.lo, row.hi) === 'Supported').length,
        ...rekey(rangeOf(nums(mergedRows, 'beta'), f01), 'beta'),
        ...rekey(rangeOf(nums(mergedRows, 'p'), fp), 'structP'),
        ...rekey(rangeOf(nums(r.structural ?? [], 'ciPercLower'), f01), 'percLower'),
        ...rekey(rangeOf(nums(r.structural ?? [], 'ciPercUpper'), f01), 'percUpper'),
        ...rekey(rangeOf(nums(r.structural ?? [], 'ciBcLower'), f01), 'bcLower'),
        ...rekey(rangeOf(nums(r.structural ?? [], 'ciBcUpper'), f01), 'bcUpper'),
        nModerationEdges: new Set((r.moderation?.rows ?? []).map((row) => row.moderatorName)).size,
        // Conditional-effects table's own 'ci' column (simple-slope boot 95% CI) — both bounds combined
        // into one span, since (unlike the structural-paths table) it renders as a single bracketed
        // column, not separate Lower/Upper columns.
        ...rekey(rangeOf((r.moderation?.slopes ?? []).flatMap((s) => [s.ciPercLower, s.ciPercUpper]).filter((n) => Number.isFinite(n)), f01), 'condCi'),
      }
    : {}
  const pathStructural = isPath ? (r.structural ?? []) : []
  const pathIndirect = isPath ? (r.indirect ?? []) : []
  const pathValues: CardContent['values'] = isPath
    ? {
        ...rekey(rangeOf(nums(pathStructural, 'b'), f), 'pathB'),
        ...rekey(rangeOf([...nums(pathStructural, 'se'), ...nums(pathIndirect, 'se')], f), 'pathSe'),
        ...rekey(rangeOf(nums(pathStructural, 'z'), fdf), 'pathZ'),
        ...rekey(rangeOf([...nums(pathStructural, 'p'), ...nums(pathIndirect, 'p')], fp), 'pathP'),
        ...rekey(rangeOf(nums(pathStructural, 'stdBeta'), f01), 'pathBeta'),
        ...rekey(rangeOf(nums(pathStructural, 'r2'), f01), 'pathR2'),
        ...rekey(rangeOf(nums(pathIndirect, 'est'), f), 'indEst'),
        nPaths: pathStructural.length, nIndirect: pathIndirect.length,
      }
    : {}
  const values: CardContent['values'] = { ...fitValues, ...measurementValues, ...structuralValues, ...pathValues }

  // APA (U9-T3 fix, 2026-07-06 audit): CB-SEM's template used to be returned VERBATIM, every "__" left
  // unfilled. Worked-example convention (mirrors multiple-linear-regression's "predictor X" -> the real
  // term name): the path clause is filled from the FIRST structural path; the fit clause from the fit
  // indices, or an honest saturation statement when df=0 (fit is not informative, never left as "__").
  let apa = spec.apaTemplate
  if (isMerged) {
    const firstPath = r.structural?.[0]
    if (firstPath) {
      const fromName = firstPath.fromName != null ? String(firstPath.fromName) : String(firstPath.from)
      const toName = firstPath.toName != null ? String(firstPath.toName) : String(firstPath.to)
      apa = apa
        .replace('X to Y', `${fromName} to ${toName}`)
        .replace('{beta}', f01(Number(firstPath.stdBeta)))
        .replace('p={p}', `p ${fpApa(Number(firstPath.p))}`)
    } else {
      apa = apa.replace('{beta}', '—').replace('p={p}', 'p —')
    }
    apa = r.fit && !saturated
      ? apa.replace('{cfi}', f01(r.fit.cfi)).replace('{rmsea}', f01(r.fit.rmsea)).replace('{srmr}', f01(r.fit.srmr))
      : apa.replace('The model fit well (CFI={cfi}, RMSEA={rmsea}, SRMR={srmr});', 'The model was saturated (df = 0; fit indices are not applicable);')
  }

  return {
    tables,
    note,
    notes,
    figures,
    howToRead: spec.howToRead,
    apa,
    nExcluded: 0,
    values,
  }
}
