import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { RddResult } from '../stats/rdd'
import type { CardContent } from './builders'
import { f, fpApa } from '../format/apa'

// modelsummary coef table (design 2026-06-16): one estimand → one 'RD treatment effect' term row
// (estimate / muted (SE) / muted [CI]; z/p drop from the visible cell), a rule, then the GOF footer
// (Bandwidth + effective N left/right). rdrobust has no R²/AIC/etc method — none are shown.
export function buildRdd(spec: TestSpec, r: RddResult): CardContent {
  const t = spec.tables[0]
  const gofValue: Record<string, string> = {
    bandwidth: f(r.bandwidth), nleft: String(r.nLeft), nright: String(r.nRight),
  }
  const rows: Record<string, string | number>[] = [
    { _kind: 'coef', term: 'RD treatment effect', est: f(r.estimate) },
    { _kind: 'se', term: '', est: `(${f(r.se)})` },
    { _kind: 'ci', term: '', est: `[${f(r.ciLow)}, ${f(r.ciHigh)}]` },
    { _kind: 'rule' },
    ...t.gof!.map((g) => ({ _kind: 'gof', term: g.label, est: gofValue[g.key] })),
  ]
  const apa = spec.apaTemplate
    .replace('{b}', f(r.estimate))
    .replace('{lo}', f(r.ciLow))
    .replace('{hi}', f(r.ciHigh))
    .replace('p {p}', `p ${fpApa(r.p)}`)
  const figs = figuresOf(spec)
  return {
    tables: [{ spec: t, rows }],
    note: spec.tableNote ?? null,
    figures: [{ caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figRdPng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
