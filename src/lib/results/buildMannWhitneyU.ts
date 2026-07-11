import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { MannWhitneyUResult } from '../stats/mannWhitneyU'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa, fx } from '../format/apa'

const tailsNote = (t: string) => t === 'two.sided' ? '' : ` This was a one-tailed test (${t}).`

export function buildMannWhitneyU(spec: TestSpec, r: MannWhitneyUResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{u}', fdf(r.u)).replace('{z}', f(r.z))
    .replace('{p}', fpApa(r.p))
    .replace('{r}', f01(r.rankBiserial)).replace('{rlo}', f01(r.rankBiserialLow)).replace('{rhi}', f01(r.rankBiserialHigh))
  const fig = figuresOf(spec)[0]
  // Hodges-Lehmann location-shift estimate + CI as a full-width span row (cf. buildIvTwoStage diagnostic spans); em-dash NA via fx.
  const hl = `Hodges-Lehmann median difference = ${fx(r.hodgesLehmann, f)}, 95% CI [${fx(r.hlLow, f)}, ${fx(r.hlHigh, f)}]`
  return {
    tables: [
      { spec: spec.tables[0], rows: r.ranks.map((g) => ({ group: g.group, n: g.n, meanRank: f(g.meanRank), median: f(g.median), iqr: f(g.iqr), sumRanks: f(g.sumRanks) })) },
      { spec: spec.tables[1], rows: [
        { u: fdf(r.u), z: f(r.z), p: fp(r.p), r: `${f(r.rankBiserial)} [${f(r.rankBiserialLow)}, ${f(r.rankBiserialHigh)}]` },
        { _kind: 'span', u: hl },
      ] },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    // Method disclosure (R1 gap-fix): wilcox.test()$method names the exact branch that ran (exact vs.
    // asymptotic, with/without continuity correction) — appended at render time, like tailsNote above,
    // so docs/specs/telos_test_outputs.html's static howToRead text is untouched (same pattern as the α/tails suffix).
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.` + tailsNote(r.tails) + ` Method: ${r.method}.`,
    apa,
    nExcluded: r.nExcluded,
    // U8-T4: keyed to match the 'mann-whitney-u' EXPLAINERS entries in registry/explainers.ts.
    // Rank-summary values are genuinely per-group (2 groups), so both are exposed with a 0/1 suffix.
    values: {
      group0: r.ranks[0].group, group1: r.ranks[1].group,
      n0: String(r.ranks[0].n), n1: String(r.ranks[1].n),
      meanRank0: f(r.ranks[0].meanRank), meanRank1: f(r.ranks[1].meanRank),
      median0: f(r.ranks[0].median), median1: f(r.ranks[1].median),
      iqr0: f(r.ranks[0].iqr), iqr1: f(r.ranks[1].iqr),
      sumRanks0: f(r.ranks[0].sumRanks), sumRanks1: f(r.ranks[1].sumRanks),
      u: fdf(r.u), z: f(r.z), p: fpApa(r.p),
      r: f(r.rankBiserial), rlo: f(r.rankBiserialLow), rhi: f(r.rankBiserialHigh),
      // R1 gap-fix: the HL estimate lacked an explainers.ts entry (a hole the U8 coverage gate misses,
      // since it only checks registry COLUMN keys — 'hl' is a span-row value, same class as vifMax).
      hl: fx(r.hodgesLehmann, f), hlLow: fx(r.hlLow, f), hlHigh: fx(r.hlHigh, f),
      method: r.method,
    },
  }
}
