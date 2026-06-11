import { read, utils } from 'xlsx'
import type { Dataset } from '../stats/types'

export function listSheets(bytes: ArrayBuffer): string[] {
  return read(bytes, { type: 'array' }).SheetNames
}

/** Header = row 1 (per the ui spec). Empty cells → null. Dates → ISO 'YYYY-MM-DD' via cellDates:true + sheet_to_json UTC:true (without cellDates, date cells silently arrive as Excel serial numbers, e.g. 45296). */
export function parseExcelSheet(bytes: ArrayBuffer, sheet: string): Dataset {
  const wb = read(bytes, { type: 'array', cellDates: true })
  const ws = wb.Sheets[sheet]
  if (!ws) throw new Error(`Sheet "${sheet}" not found`)
  const aoa = utils.sheet_to_json<(string | number | boolean | Date | null)[]>(ws, { header: 1, defval: null, UTC: true }) // UTC:true — without it Dates shift by the local offset and the ISO day is wrong east of UTC (sandbox-verified)
  const [header, ...body] = aoa
  const columns = (header ?? []).map((h) => String(h))
  const rows = body.map((cells) => Object.fromEntries(columns.map((c, i) => {
    const v = cells[i] ?? null
    return [c, v instanceof Date ? v.toISOString().slice(0, 10) : v]
  })))
  return { columns, rows }
}
