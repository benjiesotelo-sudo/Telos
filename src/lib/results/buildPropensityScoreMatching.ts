import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { PsmResult } from '../stats/propensityScoreMatching'
import type { CardContent } from './builders'
import { f, fpApa, fx } from '../format/apa'

// Table 1 (balance) stays a classic table. Table 2 (ATT) is a modelsummary coef table (design 2026-06-16):
// one term row Treatment (ATT) → est / (SE) / [CI] (z/p drop, D1); matched-N footer below a rule (no R²/AIC — spike).
export function buildPropensityScoreMatching(spec: TestSpec, r: PsmResult): CardContent {
  const balanceRows = r.balance.map((b) => ({ covariate: b.covariate, smdPre: f(b.smdPre), smdPost: f(b.smdPost), varRatio: f(b.varRatio) }))
  const att = spec.tables[1]
  const gofValue: Record<string, string> = { matchedN: String(r.matchedN), treatedN: String(r.nT), controlN: String(r.nC) }
  // Common-support / overlap diagnostic surfaced as full-width span rows (matches the IV/Hausman convention):
  // treated units dropped off the region of common support + the propensity-score overlap range by group. Em-dash NA.
  const psRange = (lo: number | null, hi: number | null) => `[${fx(lo, f)}, ${fx(hi, f)}]`
  const attRows: Record<string, string | number>[] = [
    { _kind: 'coef', term: 'Treatment (ATT)', est: f(r.attB) },
    { _kind: 'se', term: '', est: `(${f(r.attSe)})` },
    { _kind: 'ci', term: '', est: `[${f(r.attLo)}, ${f(r.attHi)}]` },
    { _kind: 'rule' },
    ...att.gof!.map((g) => ({ _kind: 'gof', term: g.label, est: gofValue[g.key] })),
    { _kind: 'span', term: `Common support: ${fx(r.treatedDropped, (n) => String(n))} treated unit(s) dropped (off common support)` },
    { _kind: 'span', term: `Propensity overlap: treated ${psRange(r.psTreatedLo, r.psTreatedHi)}, control ${psRange(r.psControlLo, r.psControlHi)}` },
  ]
  const apa = spec.apaTemplate
    .replace('{b}', f(r.attB))
    .replace('{lo}', f(r.attLo))
    .replace('{hi}', f(r.attHi))
    .replace('p {p}', `p ${fpApa(r.attP)}`)
  const figs = figuresOf(spec)
  return {
    tables: [
      { spec: spec.tables[0], rows: balanceRows },
      { spec: att, rows: attRows },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figLovePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
