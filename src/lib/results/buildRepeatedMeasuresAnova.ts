import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { RepeatedMeasuresAnovaResult } from '../stats/repeatedMeasuresAnova'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa } from '../format/apa'
import { posthocTableRows } from '../stats/posthoc'

/** Maps the option select value to the APA correction label. */
const CORRECTION_LABEL: Record<string, string> = {
  'GG correction': 'GG-corrected',
  'HF correction': 'HF-corrected',
  'none': 'uncorrected',
}

export function buildRepeatedMeasuresAnova(spec: TestSpec, r: RepeatedMeasuresAnovaResult): CardContent {
  const pct = Math.round(r.ciLevel * 100)
  const ciLabel = `${pct}% CI`
  const correctionLabel = CORRECTION_LABEL[r.sphericityChoice] ?? 'GG-corrected'
  const apa = spec.apaTemplate
    .replace('{correction}', correctionLabel)
    .replace('{df1}', fdf(r.anova.df1)).replace('{df2}', fdf(r.anova.df2))
    .replace('{f}', f(r.anova.f))
    .replace('p {p}', `p ${fpApa(r.anova.p)}`)
    .replace('{pes}', f01(r.anova.pes))
  const fig = figuresOf(spec)[0]

  // Table 2: single ANOVA row with corrected df (fdf renders '1.78'/'104.75' under GG).
  const anovaTable = {
    spec: spec.tables[1],
    rows: [{ source: r.anova.source, ss: f(r.anova.ss), df: fdf(r.anova.df1), ms: f(r.anova.ms), f: f(r.anova.f), p: fp(r.anova.p), pes: f(r.anova.pes) }],
  }

  // Table 3 (sphericity): only when sphericity rows are non-empty (3+ levels) AND correction is not 'none'.
  const showSphericity = r.sphericity.length > 0 && r.sphericityChoice !== 'none'
  const sphericityTable = showSphericity
    ? { spec: spec.tables[2], rows: r.sphericity.map((s) => ({ effect: s.effect, w: f(s.w), p: fp(s.p), gg: f(s.ggEps), hf: f(s.hfEps) })) }
    : null

  // Table 4 (posthoc): only when posthoc rows are non-empty (toggle was on).
  const t4cols = spec.tables[3].columns.map((c) => c.key === 'ci' ? { ...c, label: ciLabel } : c)
  const posthocTable = r.posthoc.length > 0
    ? { spec: { ...spec.tables[3], columns: t4cols }, rows: posthocTableRows(r.posthoc, { f, fp }) }
    : null

  const tables = [
    { spec: spec.tables[0], rows: r.desc.map((d) => ({ condition: d.condition, n: d.n, m: f(d.m), sd: f(d.sd) })) },
    anovaTable,
    ...(sphericityTable ? [sphericityTable] : []),
    ...(posthocTable ? [posthocTable] : []),
  ]

  // When sphericity is present: note anchors after the sphericity table (before posthoc).
  // When sphericity='none': note anchors after the ANOVA table (before posthoc) and omits
  //   the correction sentence since no correction is applied.
  // When sphericity is absent because of 2 levels (empty array, choice not 'none'): same anchor.
  const noteBase = spec.tableNote ?? null
  let note: CardContent['note'] = null
  if (noteBase) {
    if (showSphericity) {
      note = { ...noteBase, afterTableId: 'sphericity' }
    } else if (r.sphericityChoice === 'none') {
      // Sphericity deliberately omitted — reword to remove the now-inapplicable correction sentence.
      const trimmedText = noteBase.text
        .replace('when sphericity is violated the F-test uses the Greenhouse–Geisser / Huynh–Feldt correction; post-hoc table follows. ', '')
      note = { ...noteBase, text: trimmedText, afterTableId: 'rm-anova' }
    } else {
      // 2-level case: sphericity not needed; no afterTableId — note renders after last table.
      note = { ...noteBase }
    }
  }

  return {
    tables,
    note,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
