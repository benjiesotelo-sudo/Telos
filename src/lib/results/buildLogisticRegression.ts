import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { LogisticResult } from '../stats/logisticRegression'
import type { CardContent } from './builders'
import { f, fp } from '../format/apa'

const pc = (x: number | null) => (x == null ? '—' : `${x.toFixed(1)}%`) // percentages 1 dp (house rule)

export function buildLogisticRegression(spec: TestSpec, r: LogisticResult): CardContent {
  // R1: report-OR off → em-dash OR + CI cells (B/SE/z/p always fill — the column set is card-fixed).
  const coefRows = r.terms.map((x) => ({
    term: x.term, b: f(x.b), se: f(x.se), z: f(x.z), p: fp(x.p),
    or: r.reportOR ? f(x.or) : '—',
    ci: r.reportOR ? `[${f(x.orLow)}, ${f(x.orHigh)}]` : '—',
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
    .replace('{ciLow}', r.reportOR ? f(first.orLow) : '—').replace('{ciHigh}', r.reportOR ? f(first.orHigh) : '—')
    .replace('p={p}', first.p < 0.001 ? 'p<.001' : `p=${fp(first.p)}`)
    .replace('{auc}', f(r.auc))
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: [{ m2ll: f(r.m2ll), aic: f(r.aic), nagelkerke: f(r.nagelkerke), chisq: f(r.omnibusChisq), p: fp(r.omnibusP) }] },
      { spec: spec.tables[1], rows: coefRows },
      { spec: { ...spec.tables[2], columns: classColumns }, rows: classRows },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figRocPng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
