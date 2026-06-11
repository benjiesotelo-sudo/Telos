import Papa from 'papaparse'
import type { Dataset } from '../stats/types'
export function parseCsv(text: string): Dataset {
  const out = Papa.parse<Record<string, string | number | null>>(text.trim(), { header: true, dynamicTyping: true, skipEmptyLines: true })
  return { columns: out.meta.fields ?? Object.keys(out.data[0] ?? {}), rows: out.data }
}
