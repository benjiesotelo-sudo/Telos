import { describe, it, expect } from 'vitest'
import { unzipSync } from 'fflate'
import { buildBundle } from './bundle'
describe('buildBundle', () => {
  it('zips files under their exact paths (per-test folder per the ui spec tree)', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    const files = unzipSync(buildBundle({ '01_independent-t-test/table_t-test.png': png, '01_independent-t-test/figure_boxplot.png': png }))
    expect(Object.keys(files).sort()).toEqual(['01_independent-t-test/figure_boxplot.png', '01_independent-t-test/table_t-test.png'])
  })
})
