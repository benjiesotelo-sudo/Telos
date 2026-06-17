import type { TestSpec, ColumnDef, ModelCol } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { VarResult } from '../stats/var'
import type { CardContent } from './builders'
import { f, f01, fx, fpApa } from '../format/apa'

// modelsummary coef table (design 2026-06-16) — SIDE-BY-SIDE, ONE COLUMN PER EQUATION.
// The number of equation columns is data-dependent (one per series), so this builder OVERRIDES the
// registry placeholder's `columns` + `models` at runtime (same pattern as buildDid). Per term (union of
// lagged terms across equations, ordered by first appearance): estimate row → muted (SE) row → muted [CI]
// row; t/p drop from the visible cell. Then a rule, then one gof row per spec.tables[1].gof with a value
// PER equation column (each equation is an lm → R²/R² Adj./RMSE/Log.Lik./Num.Obs. all exist). Finally three
// SYSTEM span rows (full-width): the selected lag p, the max companion-root modulus + stability flag, and the
// Portmanteau residual serial-correlation diagnostic (vars::serial.test).
// No significance stars (D1). Table 1 (lag selection) + Table 3 (FEVD) stay classic; the IRF figure and the
// Cholesky/stability note are unchanged.
export function buildVar(spec: TestSpec, r: VarResult): CardContent {
  const lagRows = r.lagRows.map((row) => ({
    lag: row.lag, aic: f(row.aic), bic: f(row.bic), hq: f(row.hq),
  }))

  // ── Dynamic per-equation columns (override the registry placeholder) ──
  const eqKey = (i: number) => `eq${i + 1}`
  const eqCols: ColumnDef[] = r.seriesNames.map((name, i) => ({ key: eqKey(i), label: name }))
  const eqModels: ModelCol[] = r.seriesNames.map((name, i) => ({ key: eqKey(i), label: name }))
  const columns: ColumnDef[] = [{ key: 'term', label: '' }, ...eqCols]
  // keyForEquation: map a stats equation name → its column key (preserves seriesNames order)
  const colKeyOf: Record<string, string> = {}
  r.seriesNames.forEach((name, i) => { colKeyOf[name] = eqKey(i) })

  // Union of lagged terms, ordered by first appearance across the equation coef rows.
  const termOrder: string[] = []
  for (const row of r.coefRows) if (!termOrder.includes(row.term)) termOrder.push(row.term)
  // Index coef rows by (term, equation) for per-column lookup.
  const cellOf: Record<string, Record<string, VarResult['coefRows'][number]>> = {}
  for (const row of r.coefRows) {
    ;(cellOf[row.term] ??= {})[colKeyOf[row.equation]] = row
  }

  const blankEqs = (): Record<string, string> =>
    Object.fromEntries(eqCols.map((c) => [c.key, '']))

  const termRows: Record<string, string | number>[] = termOrder.flatMap((term) => {
    const cells = cellOf[term] ?? {}
    const coef: Record<string, string | number> = { _kind: 'coef', term, ...blankEqs() }
    const se: Record<string, string | number> = { _kind: 'se', term: '', ...blankEqs() }
    const ci: Record<string, string | number> = { _kind: 'ci', term: '', ...blankEqs() }
    for (const c of eqCols) {
      const cell = cells[c.key]
      if (!cell) continue // term absent from this equation (rare; keeps the cell blank)
      coef[c.key] = f(cell.estimate)
      se[c.key] = `(${f(cell.se)})`
      ci[c.key] = `[${f(cell.ciLow)}, ${f(cell.ciHigh)}]`
    }
    return [coef, se, ci]
  })

  // ── GOF footer: one value per equation column per gof label ──
  const gofValueOf = (key: string, eqName: string): string => {
    const g = r.eqGof.find((x) => x.equation === eqName)
    if (!g) return ''
    switch (key) {
      case 'nobs': return String(g.nobs)
      case 'r2': return f01(g.r2)
      case 'adjr2': return f01(g.adjR2)
      case 'rmse': return f(g.rmse)
      case 'll': return f(g.logLik)
      default: return ''
    }
  }
  const gofRows: Record<string, string | number>[] = (spec.tables[1].gof ?? []).map((g) => {
    const row: Record<string, string | number> = { _kind: 'gof', term: g.label }
    for (const c of eqCols) row[c.key] = gofValueOf(g.key, c.label)
    return row
  })

  // ── SYSTEM span rows (full-width): selected lag + stability + serial-correlation diagnostic ──
  const stab = r.stable ? 'stable' : 'unstable'
  // Portmanteau (vars::serial.test) residual serial-correlation diagnostic — em-dash NA via fx.
  const st = r.serialTest
  const serialSpan = st
    ? `Portmanteau (serial) χ²(${st.df}) = ${f(st.stat)}, p ${fpApa(st.p)}`
    : `Portmanteau (serial) χ² = ${fx(null, f)}`
  const spanRows: Record<string, string | number>[] = [
    { _kind: 'span', term: `Selected lag (p) = ${r.selectedLag}` },
    { _kind: 'span', term: `Max root modulus = ${f01(r.maxRootModulus)} (${stab})` },
    { _kind: 'span', term: serialSpan },
  ]

  const coefTableRows = [...termRows, { _kind: 'rule' }, ...gofRows, ...spanRows]

  const fevdRows = r.fevdRows.map((row) => ({
    variable: row.variable, impulse: row.impulse, share: f01(row.share),
  }))

  const apa = spec.apaTemplate.replace('{p}', String(r.selectedLag))
  const figs = figuresOf(spec)
  return {
    tables: [
      { spec: spec.tables[0], rows: lagRows },
      // Override the placeholder columns/models with the real per-equation set.
      { spec: { ...spec.tables[1], columns, models: eqModels }, rows: coefTableRows },
      { spec: spec.tables[2], rows: fevdRows },
    ],
    note: spec.tableNote ?? null,
    figures: [
      { caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figIrfPng },
    ],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
