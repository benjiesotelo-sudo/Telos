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

  // T3: Measurement model (CFA) — latent only. CFA rows already carry construct + item names.
  if (!isPath && r.cfaLoadings.length) {
    const rows = r.cfaLoadings.map((row) => ({
      path: `${row.construct} → ${row.item}`,
      b: f(Number(row.b)),
      se: f(Number(row.se)),
      z: fdf(Number(row.z)),
      p: fp(Number(row.p)),
      stdLoading: f01(Number(row.stdLoading)),
    }))
    tables.push({ spec: specTable(spec, 'cfa-loadings'), rows })
  }

  // T4: Reliability & validity — latent only
  if (!isPath && r.reliability.length) {
    const rows = r.reliability.map((row) => ({
      construct: String(row.construct),
      cr: f01(Number(row.cr)),
      ave: f01(Number(row.ave)),
      omega: f01(Number(row.omega)),
      alpha: f01(Number(row.alpha)),
    }))
    tables.push({ spec: specTable(spec, 'reliability'), rows })
  }

  // T5: Fit indices — suppressed when saturated (df==0)
  const saturated = r.saturated || (r.fit ? isSaturated(r.fit.df) : false)
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
      stdBeta: f01(Number(row.stdBeta)),
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

  // Note: saturation flag wins; else the spec's tableNote.
  const note: CardContent['note'] = saturated
    ? { kind: 'plain', text: SATURATION_NOTE }
    : (spec.tableNote ?? null)

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
