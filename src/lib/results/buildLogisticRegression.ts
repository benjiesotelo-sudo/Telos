import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { LogisticResult } from '../stats/logisticRegression'
import type { CardContent } from './builders'
import { f, fp, fpApa, f01 } from '../format/apa'

const pc = (x: number | null) => (x == null ? '—' : `${x.toFixed(1)}%`) // percentages 1 dp (house rule)
// OR table-cell formatter: falls back to '< 0.01' when the value would silently round to '0.00' (finding #1).
const fOr = (x: number) => (Math.abs(x) < 0.01 ? '< 0.01' : f(x))

export function buildLogisticRegression(spec: TestSpec, r: LogisticResult): CardContent {
  const pct = Math.round(r.ciLevel * 100)
  const ciLabel = `${pct}% CI (OR)`
  // R1: report-OR off → em-dash OR + CI cells (B/SE/z/p always fill — the column set is card-fixed).
  const coefRows = r.terms.map((x) => ({
    term: x.term, b: f(x.b), se: f(x.se), z: f(x.z), p: fp(x.p),
    or: r.reportOR ? fOr(x.or) : '—',
    ci: r.reportOR ? `[${fOr(x.orLow)}, ${fOr(x.orHigh)}]` : '—',
  }))
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
  const t2cols = spec.tables[1].columns.map((c) => c.key === 'ci' ? { ...c, label: ciLabel } : c)
  return {
    tables: [
      { spec: spec.tables[0], rows: [{ m2ll: f(r.m2ll), aic: f(r.aic), nagelkerke: f(r.nagelkerke), chisq: f(r.omnibusChisq), p: fp(r.omnibusP) }] },
      { spec: { ...spec.tables[1], columns: t2cols }, rows: coefRows },
      { spec: { ...spec.tables[2], columns: classColumns }, rows: classRows },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figRocPng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
