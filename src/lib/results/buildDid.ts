import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { DidResult } from '../stats/did'
import type { CardContent } from './builders'
import { f, fp, fpApa } from '../format/apa'

const LABEL: Record<string, string> = { '(Intercept)': 'Intercept', tr: 'Treated', po: 'Post', 'tr:po': 'Treated × Post' }

export function buildDid(spec: TestSpec, r: DidResult): CardContent {
  const pct = Math.round(r.ciLevel * 100)
  const t1cols = spec.tables[0].columns.map((c) => (c.key === 'ci' ? { ...c, label: `${pct}% CI` } : c))
  const rows = r.coefRows.map((x) => ({
    term: LABEL[x.term] ?? x.term, b: f(x.b), se: f(x.se), t: f(x.t), p: fp(x.p), ci: `[${f(x.ciLow)}, ${f(x.ciHigh)}]`,
  }))
  const did = r.coefRows.find((x) => x.term === 'tr:po')
  const apa = spec.apaTemplate
    .replace('{b}', did ? f(did.b) : '—')
    .replace('{lo}', did ? f(did.ciLow) : '—')
    .replace('{hi}', did ? f(did.ciHigh) : '—')
    .replace('p {p}', `p ${did ? fpApa(did.p) : '—'}`)
  const figs = figuresOf(spec)
  return {
    tables: [{ spec: { ...spec.tables[0], columns: t1cols }, rows }],
    note: spec.tableNote ?? null,
    figures: [{ caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figTrendsPng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
