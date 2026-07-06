import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { CbSemResult } from '../stats/runCbSem'
import { isSaturated } from '../stats/semSaturation'
import type { CardContent, BuiltTable } from './builders'
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

  // T6: Structural paths — Path cell uses construct NAMES (fromName/toName from the runner);
  // falls back to numeric ids only if a name is missing. The numeric from/to keys feed the canvas.
  // Std. β renders under 'beta' (cbSem.ts / pathAnalysis.ts spec key), not the runner's 'stdBeta'.
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

  // T7: Indirect effects — Path cell uses the construct-name chain (pathLabel from the runner);
  // falls back to the internal lavaan := label only if pathLabel is absent.
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

  // Note: saturation flag wins; else the spec's tableNote, with the dynamic item-sample clause appended
  // when the merged Table 1 rendered (U3-T1 post-review amendment).
  const note: CardContent['note'] = saturated
    ? { kind: 'plain', text: SATURATION_NOTE }
    : spec.tableNote
      ? { ...spec.tableNote, text: itemSampleNote ? `${spec.tableNote.text} ${itemSampleNote}` : spec.tableNote.text }
      : itemSampleNote
        ? { kind: 'plain', text: itemSampleNote }
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
