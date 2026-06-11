import { describe, it, expect } from 'vitest'
import { buildSummaryStatistics } from './buildSummaryStatistics'
import { SUMMARY_STATISTICS as spec } from '../registry/summaryStatistics'
import type { SummaryStatsResult } from '../stats/summaryStatistics'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

const overall: SummaryStatsResult = {
  grouped: false,
  rows: [
    { variable: 'score', n: 12, mean: 76.33333, sd: 7.08819, min: 66, max: 88, median: 76.5, skew: 0.11440, kurtosis: -1.49220 },
    { variable: 'age', n: 1, mean: 34, sd: null, min: 34, max: 34, median: 34, skew: null, kurtosis: null },
  ],
  histograms: [{ variable: 'score', png: PNG }, { variable: 'age', png: PNG }],
  nExcluded: 0,
}
const byGroup: SummaryStatsResult = {
  grouped: true,
  rows: [
    { variable: 'score', group: 'control', n: 6, mean: 70.33333, sd: 3.14113, min: 66, max: 75, median: 70.5, skew: 0.06692, kurtosis: -1.52006 },
    { variable: 'score', group: 'treatment', n: 6, mean: 82.33333, sd: 3.77712, min: 78, max: 88, median: 82, skew: 0.24881, kurtosis: -1.72169 },
  ],
  histograms: [{ variable: 'score', png: PNG }],
  nExcluded: 0,
}

describe('buildSummaryStatistics', () => {
  it('plain branch: card columns untouched, one formatted row per variable, nulls as em-dashes', () => {
    const c = buildSummaryStatistics(spec, overall)
    expect(c.tables[0].spec.columns.map((col) => col.label)).toEqual(['Variable', 'N', 'M', 'SD', 'Min', 'Max', 'Median', 'Skew', 'Kurtosis'])
    expect(c.tables[0].spec.captionStyle).toBe('bare')
    expect(c.tables[0].rows[0]).toEqual({ variable: 'score', n: 12, mean: '76.33', sd: '7.09', min: '66.00', max: '88.00', median: '76.50', skew: '0.11', kurtosis: '−1.49' })
    expect(c.tables[0].rows[1]).toEqual({ variable: 'age', n: 1, mean: '34.00', sd: '—', min: '34.00', max: '34.00', median: '34.00', skew: '—', kurtosis: '—' })
    expect(c.nExcluded).toBe(0)
  })
  it('group-by branch: a Group column is INSERTED first and stats repeat per group — the registry spec object stays unmutated', () => {
    const c = buildSummaryStatistics(spec, byGroup)
    expect(c.tables[0].spec.columns.map((col) => col.label)).toEqual(['Group', 'Variable', 'N', 'M', 'SD', 'Min', 'Max', 'Median', 'Skew', 'Kurtosis'])
    expect(c.tables[0].rows[0]).toEqual({ group: 'control', variable: 'score', n: 6, mean: '70.33', sd: '3.14', min: '66.00', max: '75.00', median: '70.50', skew: '0.07', kurtosis: '−1.52' })
    expect(c.tables[0].rows[1]).toEqual({ group: 'treatment', variable: 'score', n: 6, mean: '82.33', sd: '3.78', min: '78.00', max: '88.00', median: '82.00', skew: '0.25', kurtosis: '−1.72' })
    expect(spec.tables[0].columns[0].key).toBe('variable') // dynamic insert never touches the registry
  })
  it('carries the plain card note, the fixed APA sentence, and per-variable typed figures', () => {
    const c = buildSummaryStatistics(spec, overall)
    expect(c.note).toEqual({ kind: 'plain', text: 'one row per chosen variable; a Group column is added when "Group by" is used (stats repeat per group).' })
    expect(c.apa).toBe('Table X reports descriptive statistics for the study variables.')
    expect(c.howToRead).toBe(spec.howToRead)
    expect(c.figures.map((f) => f.type)).toEqual(['histogram_score', 'histogram_age']) // unique types ⇒ unique export names
    expect(c.figures[0].caption).toBe('Distribution — score')
  })
})
