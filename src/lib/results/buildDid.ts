import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { DidResult } from '../stats/did'
import type { CardContent } from './builders'
import { f, f01, fp, fpApa, fx } from '../format/apa'

// plm within term labels: 'po' (Post) and 'po:tr' (Treated × Post). The time-invariant 'tr' main effect is
// absorbed by the within transform — never returned. Order may be (po, po:tr) per plm.
const LABEL: Record<string, string> = { po: 'Post', 'po:tr': 'Treated × Post', 'tr:po': 'Treated × Post' }

// modelsummary coef table (design 2026-06-16): the old Term/B/SE/t/p/CI table becomes one stacked column.
// Per term: B row → muted (clustered/classical SE) row → muted [CI] row. Then a rule, then the panel gof footer.
// No SE column header survives, so clustered-vs-classical is carried in the NOTE + APA (seType-aware).
// plm within has NO logLik → no AIC/BIC/Log.Lik gof rows; the gof footer is N / N entities / Within R² / F.
export function buildDid(spec: TestSpec, r: DidResult): CardContent {
  const t = spec.tables[0]
  const classical = r.seType === 'classical'
  const seLabel = classical ? 'classical SE' : 'clustered SE'
  // Overall within-F rendered as F(df1, df2) = stat, p (em-dash NA via fx when df/p degenerate) — report-only.
  const fGof = `F(${fx(r.fDf1, String)}, ${fx(r.fDf2, String)}) = ${f(r.fStat)}, p ${fx(r.fP, fpApa)}`
  const gofValue: Record<string, string> = {
    n: String(r.nObs), nentities: String(r.nEntities), r2within: f01(r.withinR2), f: fGof,
  }
  const rows: Record<string, string | number>[] = [
    ...r.coefRows.flatMap((x) => [
      { _kind: 'coef', term: LABEL[x.term] ?? x.term, est: f(x.b) },
      { _kind: 'se', term: '', est: `(${f(x.se)})` },
      { _kind: 'ci', term: '', est: `[${f(x.ciLow)}, ${f(x.ciHigh)}]` },
    ]),
    { _kind: 'rule' },
    ...t.gof!.map((g) => ({ _kind: 'gof', term: g.label, est: gofValue[g.key] })),
  ]
  const did = r.coefRows.find((x) => x.term === 'po:tr' || x.term === 'tr:po')
  const apa = spec.apaTemplate
    .replace('{b}', did ? f(did.b) : '—')
    .replace('{lo}', did ? f(did.ciLow) : '—')
    .replace('{hi}', did ? f(did.ciHigh) : '—')
    .replace('p {p}', `p ${did ? fpApa(did.p) : '—'}`)
    .replace('(clustered SE)', `(${seLabel})`)
  // Render the drawn parallel-trends note + state which SE is in parentheses (no SE column header now), then the
  // live pre-trends signal: a pre-period (post=0) leads-and-lags joint F of the treated×time interactions
  // (em-dash NA via fx when the pre window is too short to fit it) — report-only, a small p flags diverging trends.
  const pt = r.preTrend
  const preTrendText = `Pre-trends test (pre-period leads-and-lags joint F of treated×time): F(${fx(pt?.df1 ?? null, String)}, ${fx(pt?.df2 ?? null, String)}) = ${fx(pt?.F ?? null, f)}, p = ${fx(pt?.p ?? null, fp)} — a small p flags diverging pre-trends.`
  const note: CardContent['note'] = spec.tableNote
    ? { ...spec.tableNote, text: `${spec.tableNote.text} Standard errors in parentheses are ${seLabel === 'clustered SE' ? 'clustered by entity' : 'classical'}; the bracketed line is the ${Math.round(r.ciLevel * 100)}% CI. ${preTrendText}` }
    : null
  const figs = figuresOf(spec)
  return {
    tables: [{ spec: t, rows }],
    note,
    figures: [{ caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figTrendsPng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
