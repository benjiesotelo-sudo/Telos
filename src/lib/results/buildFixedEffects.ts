import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { FixedEffectsResult } from '../stats/fixedEffects'
import type { CardContent } from './builders'
import { f, f01, fpApa } from '../format/apa'

// modelsummary coef table (design 2026-06-16): the old Coefficients + Model fit merge into one stacked table.
// Per term: B row → muted (clustered/classical SE) row → muted [CI] row. Then a rule, then the gof footer.
// No SE column header survives, so the clustered-vs-classical distinction is carried in the NOTE + APA (seType-aware).
// plm within has NO logLik → no AIC/BIC/Log.Lik gof rows; adj within R² is surfaced here (audit fix).
export function buildFixedEffects(spec: TestSpec, r: FixedEffectsResult): CardContent {
  const t = spec.tables[0]
  const classical = r.seType === 'classical'
  const seLabel = classical ? 'classical SE' : 'clustered SE'
  const gofValue: Record<string, string> = {
    n: String(r.nObs), nentities: String(r.nEntities),
    r2within: f01(r.withinR2), adjr2within: f01(r.adjR2), f: f(r.fStat),
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
  const first = r.coefRows[0]
  const apa = spec.apaTemplate
    .replace('predictor X', `predictor ${first ? first.term : 'X'}`)
    .replace('{b}', first ? f(first.b) : '—')
    .replace('p {p}', `p ${first ? fpApa(first.p) : '—'}`)
    .replace('(clustered SE)', `(${seLabel})`)
  // Render the drawn within-variation note + state which SE is in parentheses (no SE column header now) +
  // APPEND the §2.8 poolability F (like buildIvTwoStage appends diagnostics).
  const note: CardContent['note'] = spec.tableNote
    ? { ...spec.tableNote, text: `${spec.tableNote.text} Standard errors in parentheses are ${seLabel === 'clustered SE' ? 'clustered by entity' : 'classical'}; the bracketed line is the ${Math.round(r.ciLevel * 100)}% CI. F-test for individual effects (poolability): F = ${f(r.poolF)}, p ${fpApa(r.poolP)} — a low p favours the entity effects over pooled OLS.` }
    : null
  const figs = figuresOf(spec)
  return {
    tables: [{ spec: t, rows }],
    note,
    figures: [{ caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figCoefPng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
