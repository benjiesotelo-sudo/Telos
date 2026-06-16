import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { LogisticResult } from '../stats/logisticRegression'
import type { CardContent } from './builders'
import { f, fp, fpApa, f01 } from '../format/apa'

const pc = (x: number | null) => (x == null ? '—' : `${x.toFixed(1)}%`) // percentages 1 dp (house rule)
// OR table-cell formatter: falls back to '< 0.01' when the value would silently round to '0.00' (finding #1).
const fOr = (x: number) => (Math.abs(x) < 0.01 ? '< 0.01' : f(x))

// modelsummary coef table (design 2026-06-16) — SHAPE A two-column B|OR. Per term: a 'coef' row (B in 'b', exp(B)=OR in
// 'or'), then ONE muted 'se' row ('(SE)' under B, the exponentiated CI '[ORlo, ORhi]' under OR). z/p drop from the visible
// cell (report-only, D1). Then a rule, then the glm gof footer (Nagelkerke R²/omnibus χ²/Log.Lik./AIC/BIC; the omnibus row
// carries its p inline). R1: report-OR off → the OR column reads em-dash (B/SE always fill). Classification + ROC unchanged.
export function buildLogisticRegression(spec: TestSpec, r: LogisticResult): CardContent {
  const t = spec.tables[0]
  const pct = Math.round(r.ciLevel * 100)
  const gofValue: Record<string, string> = {
    n: String(r.n), nagelkerke: f(r.nagelkerke),
    chi2: `${f(r.omnibusChisq)} (p ${fp(r.omnibusP)})`, // omnibus χ² with its p inline (report-only, no verdict)
    ll: f(r.logLik), aic: f(r.aic), bic: f(r.bic),
  }
  const rows: Record<string, string | number>[] = [
    ...r.terms.flatMap((x) => [
      { _kind: 'coef', term: x.term, b: f(x.b), or: r.reportOR ? fOr(x.or) : '—' },
      { _kind: 'se', term: '', b: `(${f(x.se)})`, or: r.reportOR ? `[${fOr(x.orLow)}, ${fOr(x.orHigh)}]` : '—' },
    ]),
    { _kind: 'rule' },
    ...t.gof!.map((g) => ({ _kind: 'gof', term: g.label, b: gofValue[g.key] })),
  ]
  // Classification (convention 7): real level names replace the drawn 0/1 headers; rows = predicted levels.
  const classColumns = [{ key: 'pred', label: 'Predicted \\ Observed' },
    { key: 'c0', label: r.levels[0] }, { key: 'c1', label: r.levels[1] }, { key: 'pct', label: '% correct' }]
  const classRows = r.levels.map((lvl, i) => ({
    pred: lvl, c0: r.classCounts[i][0], c1: r.classCounts[i][1], pct: pc(r.pctCorrect[i]),
  }))
  const first = r.terms.find((x) => x.term !== '(Intercept)')! // APA "Predictor X" = first coefficient row (recorded decision 3)
  const apa = spec.apaTemplate
    .replace('Predictor X', `Predictor ${first.term}`)
    .replace('{or}', r.reportOR ? f(first.or) : '—')           // decision 4: the toggle masks the APA slots too
    .replace('95% CI', `${pct}% CI`)
    .replace('{ciLow}', r.reportOR ? f(first.orLow) : '—').replace('{ciHigh}', r.reportOR ? f(first.orHigh) : '—')
    .replace('{p}', fpApa(first.p))                             // policy (3): spaced APA p, "p = .035" / "p < .001"
    .replace('{auc}', f01(r.auc))                               // policy (3): bounded stat drops leading zero
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: t, rows },
      { spec: { ...spec.tables[1], columns: classColumns }, rows: classRows },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figRocPng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
