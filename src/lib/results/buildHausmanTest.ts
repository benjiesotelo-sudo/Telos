import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { HausmanResult } from '../stats/hausmanTest'
import type { CardContent } from './builders'
import { f, f01, fp, fpApa } from '../format/apa'

// modelsummary coef table (design 2026-06-16): the old Hausman-stat + FE-vs-RE tables merge into ONE side-by-side
// FE | RE coef table (+ a kept Difference column). Per term (FE slopes — within has no intercept): a coef row
// {fe,re,diff}, a muted (clustered SE) row {fe,re} (diff blank), a muted [CI] row {fe,re} (diff blank). Then a rule,
// the gof footer (Num.Obs. + N entities shared in the FE column; R² per model column), then the Hausman χ²(df), p
// as a full-width span row. No "Decision" column — report-only: the how-to-read explains FE vs RE (no baked verdict).
// plm within has NO logLik → no AIC/BIC/Log.Lik rows.
export function buildHausmanTest(spec: TestSpec, r: HausmanResult): CardContent {
  const t = spec.tables[0]
  const pct = Math.round(r.ciLevel * 100)
  const gofRows = (t.gof ?? []).map((g) => {
    if (g.key === 'n') return { _kind: 'gof', term: g.label, fe: String(r.nObs), re: '', diff: '' }
    if (g.key === 'nentities') return { _kind: 'gof', term: g.label, fe: String(r.nEntities), re: '', diff: '' }
    // r2: within R² under the FE column, the random-effects R² under the RE column
    return { _kind: 'gof', term: g.label, fe: f01(r.feR2), re: f01(r.reR2), diff: '' }
  })
  const rows: Record<string, string | number>[] = [
    ...r.compareRows.flatMap((x) => [
      { _kind: 'coef', term: x.term, fe: f(x.feB), re: f(x.reB), diff: f(x.diff) },
      { _kind: 'se', term: '', fe: `(${f(x.feSe)})`, re: `(${f(x.reSe)})`, diff: '' },
      { _kind: 'ci', term: '', fe: `[${f(x.feCiLow)}, ${f(x.feCiHigh)}]`, re: `[${f(x.reCiLow)}, ${f(x.reCiHigh)}]`, diff: '' },
    ]),
    { _kind: 'rule' },
    ...gofRows,
    // Hausman diagnostic spans all columns — text in the first column's key (ApaTable renders row-span full-width).
    { _kind: 'span', term: `Hausman χ²(${r.df}) = ${f(r.chisq)}, p ${fp(r.p)}` },
  ]
  const apa = spec.apaTemplate
    .replace('{df}', String(r.df))
    .replace('{chisq}', f(r.chisq))
    .replace('p {p}', `p ${fpApa(r.p)}`)
  const figs = figuresOf(spec)
  return {
    tables: [{ spec: t, rows }],
    note: spec.tableNote ?? null,
    figures: [{ caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figCoefPng }],
    howToRead: spec.howToRead + ` The standard errors in parentheses are clustered by entity; the bracketed line is the ${pct}% CI. Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
