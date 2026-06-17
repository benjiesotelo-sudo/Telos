import type { TestSpec } from '../registry/types'
import type { CardContent } from './builders'
import type { WilcoxonSignedRankResult } from '../stats/wilcoxonSignedRank'
import { f, f01, fp, fpApa, fx } from '../format/apa'

const tailsNote = (t: string) => t === 'two.sided' ? '' : ` This was a one-tailed test (${t}).`

export function buildWilcoxonSignedRank(spec: TestSpec, r: WilcoxonSignedRankResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{z}', f(r.z))
    .replace('{p}', fpApa(r.p))
    .replace('{r}', f01(r.r)).replace('{rlo}', f01(r.rLow)).replace('{rhi}', f01(r.rHigh))
  const fig = spec.figures![0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.ranks.map((row) => ({ sign: row.sign, n: row.n, meanRank: fx(row.meanRank, f), sumRanks: row.n === 0 ? '—' : f(row.sumRanks) })) },
      { spec: spec.tables[1], rows: [{ v: f(r.v), z: f(r.z), p: fp(r.p), r: `${f(r.r)} [${f(r.rLow)}, ${f(r.rHigh)}]` }] },
    ],
    note: null, // the drawn Wilcoxon card has no table note (design ruling)
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.` + tailsNote(r.tails),
    apa,
    nExcluded: r.nExcluded,
  }
}
