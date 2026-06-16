import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { RandomEffectsResult } from '../stats/randomEffects'
import type { CardContent } from './builders'
import { f, fpApa } from '../format/apa'

// modelsummary coef table (design 2026-06-16) — merges the old Coefficients + Model fit into one stacked table.
// Per term: B row → muted (clustered SE) row → muted [CI] row. Then a rule, then one gof row per spec.tables[0].gof.
// No significance stars (D1); t/p drop from the visible cell. Single model column key 'est'. plm has no logLik → no AIC/BIC.
export function buildRandomEffects(spec: TestSpec, r: RandomEffectsResult): CardContent {
  const t = spec.tables[0]
  const gofValue: Record<string, string> = {
    n: String(r.nObs), nentities: String(r.nEntities), r2: f(r.r2), adjr2: f(r.adjR2),
  }
  const rows: Record<string, string | number>[] = [
    ...r.coefRows.flatMap((x) => [
      { _kind: 'coef', term: x.term, est: f(x.b) },
      { _kind: 'se', term: '', est: `(${f(x.se)})` },
      { _kind: 'ci', term: '', est: `[${f(x.ciLow)}, ${f(x.ciHigh)}]` },
    ]),
    { _kind: 'rule' },
    ...t.gof!.map((g) => ({ _kind: 'gof', term: g.label, est: gofValue[g.key] })),
  ]
  const first = r.coefRows.find((x) => x.term !== '(Intercept)') // APA names the first slope, not the intercept
  const apa = spec.apaTemplate
    .replace('predictor X', first ? `predictor ${first.term}` : 'predictor X')
    .replace('{b}', first ? f(first.b) : '—')
    .replace('p {p}', `p ${first ? fpApa(first.p) : '—'}`)
  const figs = figuresOf(spec)
  return {
    tables: [{ spec: t, rows }],
    note: spec.tableNote ?? null,
    figures: [{ caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figCoefPng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
