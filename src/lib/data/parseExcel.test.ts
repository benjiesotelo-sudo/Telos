import { describe, it, expect } from 'vitest'
import { utils, write } from 'xlsx'
import { listSheets, parseExcelSheet } from './parseExcel'

function workbookBytes(): ArrayBuffer {
  const wb = utils.book_new()
  utils.book_append_sheet(wb, utils.aoa_to_sheet([['group', 'score', 'start'], ['A', 10, new Date(2024, 0, 5)], ['B', null, null], ['A', 12.5, new Date(2024, 2, 20)]], { cellDates: true }), 'Survey')
  utils.book_append_sheet(wb, utils.aoa_to_sheet([['x'], [1]]), 'Extra')
  return write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

describe('parseExcel', () => {
  const bytes = workbookBytes()
  it('lists sheet names in workbook order', () => {
    expect(listSheets(bytes)).toEqual(['Survey', 'Extra'])
  })
  it('parses the chosen sheet: header row 1, typed cells, empty cells stay null, dates → ISO day', () => {
    const ds = parseExcelSheet(bytes, 'Survey')
    expect(ds.columns).toEqual(['group', 'score', 'start'])
    expect(ds.rows).toEqual([
      { group: 'A', score: 10, start: '2024-01-05' },
      { group: 'B', score: null, start: null },
      { group: 'A', score: 12.5, start: '2024-03-20' },
    ])
  })
})
