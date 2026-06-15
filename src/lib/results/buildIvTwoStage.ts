import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { IvResult } from '../stats/ivTwoStage'
import type { CardContent } from './builders'
import { f, fp, fpApa } from '../format/apa'

export function buildIvTwoStage(spec: TestSpec, r: IvResult): CardContent {
  const pct = Math.round(r.ciLevel * 100)
  const firstStageRows = r.firstStage.map((x) => ({ instrument: x.instrument, coef: f(x.coef), se: f(x.se), partialF: f(x.partialF), p: fp(x.p) }))
  const t2cols = spec.tables[1].columns.map((c) => (c.key === 'ci' ? { ...c, label: `${pct}% CI` } : c))
  const coefRows = r.coefRows.map((x) => ({ term: x.term, b: f(x.b), se: f(x.se), t: f(x.t), p: fp(x.p), ci: `[${f(x.ciLow)}, ${f(x.ciHigh)}]` }))
  const endo = r.endogenous[0]
  const endoCoef = r.coefRows.find((x) => x.term === endo)
  const apa = spec.apaTemplate
    .replace('{endogenous}', endo ?? 'the endogenous regressor')
    .replace('{b}', endoCoef ? f(endoCoef.b) : '—')
    .replace('p {p}', `p ${endoCoef ? fpApa(endoCoef.p) : '—'}`)
    .replace('{f}', f(r.weakF))
  // §2.8 diagnostics surfaced as a dynamic note (weak instruments, Wu–Hausman endogeneity, Sargan over-id).
  const sargan = r.sargan == null ? '— (just-identified, over-identification not testable)' : `${f(r.sargan)}, p ${fpApa(r.sarganP ?? 1)}`
  const note: CardContent['note'] = {
    kind: 'plain',
    text: `Diagnostics — weak instruments: F = ${f(r.weakF)}, p ${fpApa(r.weakP)} (rule of thumb: F > 10); `
      + `Wu–Hausman endogeneity: F = ${f(r.wuF)}, p ${fpApa(r.wuP)}; Sargan over-identification: ${sargan}.`,
    afterTableId: 'iv-2sls',
  }
  const figs = figuresOf(spec)
  return {
    tables: [
      { spec: spec.tables[0], rows: firstStageRows },
      { spec: { ...spec.tables[1], columns: t2cols }, rows: coefRows },
    ],
    note,
    figures: [{ caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figCoefPng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
