import { describe, it, expect } from 'vitest'
import { CATALOG } from './catalog'
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
  it('has exactly the 46 leaves, in tree order, under the right family/subfamily', () => {
    expect(rows).toEqual(CATALOG.map((c) => ({ family: c.family, ...(c.subfamily ? { subfamily: c.subfamily } : {}), leaf: c.name })))
  })
  it('exactly one test is available in this slice: the independent t-test', () => {
    expect(CATALOG.filter((c) => c.status === 'available').map((c) => c.id)).toEqual(['independent-t-test'])
  })
})
