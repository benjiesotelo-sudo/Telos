import { describe, it, expect } from 'vitest'
import { CATALOG, SPECS } from './catalog'
import { readSpec, strip } from './specHtml'

// Scope to the picker tree: from the picktree div to the assumption-diagnostics tbd line.
const html = readSpec('telos_ui_spec.html')
const tree = html.slice(html.indexOf('class="picktree"'), html.indexOf('Assumption diagnostics'))

// Parse the tree into [{ family, subfamily, leaf }] in document order.
const rows: { family: string; subfamily?: string; leaf: string }[] = []
let family = '', subfamily: string | undefined
for (const m of tree.matchAll(/<div class="(fam|sub|leaf)">(.*?)<\/div>/gs)) {
  const text = strip(m[2].replace(/<span class="nt">.*?<\/span>/gs, '')) // drop tree-note annotations (e.g. the SEM pipeline note)
  if (m[1] === 'fam') { family = text.replace(/^\d+ · /, ''); subfamily = undefined }
  else if (m[1] === 'sub') subfamily = text
  else rows.push({ family, ...(subfamily ? { subfamily } : {}), leaf: text })
}

describe('catalog stays faithful to the ui-spec picker tree', () => {
  it('has exactly the 47 leaves, in tree order, under the right family/subfamily', () => {
    expect(rows).toEqual(CATALOG.map((c) => ({ family: c.family, ...(c.subfamily ? { subfamily: c.subfamily } : {}), leaf: c.name })))
  })
  it('the available tests match the shipped specs, in tree order', () => {
    expect(CATALOG.filter((c) => c.status === 'available').map((c) => c.id)).toEqual(['summary-statistics', 'frequencies-crosstabs', 'distribution-normality', 'one-sample-t-test', 'independent-t-test', 'paired-t-test', 'one-way-anova', 'factorial-anova', 'repeated-measures-anova', 'mixed-anova', 'nested-anova', 'welch-anova', 'ancova', 'manova', 'mancova', 'mann-whitney-u', 'wilcoxon-signed-rank', 'kruskal-wallis', 'friedman', 'pearson', 'spearman', 'kendalls-tau', 'chi-square-independence', 'chi-square-goodness-of-fit', 'fishers-exact', 'simple-linear-regression', 'multiple-linear-regression', 'logistic-regression', 'poisson-negative-binomial'])
  })
  it('every table DOM id is unique across all shipped specs (combined-results-page seam)', () => {
    const ids = Object.values(SPECS).flatMap((s) => s.tables.map((t) => t.domId ?? t.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('ANOVA-family zip figure names derive from FigureSpec.file ?? type and equal the card bundle entries', () => {
    for (const id of ['one-way-anova', 'factorial-anova', 'repeated-measures-anova', 'mixed-anova', 'nested-anova', 'welch-anova', 'ancova', 'manova', 'mancova', 'kruskal-wallis', 'friedman']) {
      const s = SPECS[id]!
      expect(s.figures!.map((f) => `figure_${f.file ?? f.type}.png`)).toEqual(s.bundleFiles.filter((b) => b.startsWith('figure_')))
    }
  })
  it('Association-family zip figure names derive from FigureSpec.file ?? type and equal the card bundle entries', () => {
    for (const id of ['pearson', 'spearman', 'kendalls-tau', 'chi-square-independence', 'chi-square-goodness-of-fit', 'fishers-exact']) {
      const s = SPECS[id]!
      expect(s.figures!.map((f) => `figure_${f.file ?? f.type}.png`)).toEqual(s.bundleFiles.filter((b) => b.startsWith('figure_')))
    }
  })
  it('Regression-family zip figure names derive from FigureSpec.file ?? type and equal the card bundle entries', () => {
    for (const id of ['simple-linear-regression', 'multiple-linear-regression', 'logistic-regression', 'poisson-negative-binomial']) {
      const s = SPECS[id]!
      expect(s.figures!.map((f) => `figure_${f.file ?? f.type}.png`)).toEqual(s.bundleFiles.filter((b) => b.startsWith('figure_')))
    }
  })
})
