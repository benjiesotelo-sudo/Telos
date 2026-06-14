import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { PearsonResult } from '../stats/pearson'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa } from '../format/apa'

const tailsNote = (t: string) => t === 'two.sided' ? '' : ` This was a one-tailed test (${t}).`

export function buildPearson(spec: TestSpec, r: PearsonResult): CardContent {
  const pct = Math.round(r.ciLevel * 100)
  const ciLabel = `${pct}% CI`
  const apa = spec.apaTemplate
    .replace('[X]', r.varA).replace('[Y]', r.varB)
    .replace('{df}', fdf(r.df)).replace('{r}', f01(r.r))
    .replace('{p}', fpApa(r.p))
    .replace('95% CI', ciLabel)
    .replace('{ciLow}', f(r.ciLow)).replace('{ciHigh}', f(r.ciHigh))
  const fig = figuresOf(spec)[0]
  const t1cols = spec.tables[0].columns.map((c) => c.key === 'ci' ? { ...c, label: ciLabel } : c)
  return {
    tables: [{ spec: { ...spec.tables[0], columns: t1cols }, rows: [{
      pair: `${r.varA} – ${r.varB}`, r: f(r.r), ci: `[${f(r.ciLow)}, ${f(r.ciHigh)}]`,
      t: f(r.t), df: fdf(r.df), p: fp(r.p), n: r.n,
    }] }],
    note: null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead.replace('95% CI', ciLabel) + ` Your significance threshold (α) is ${r.alpha}.` + tailsNote(r.tails),
    apa,
    nExcluded: r.nExcluded,
  }
}
