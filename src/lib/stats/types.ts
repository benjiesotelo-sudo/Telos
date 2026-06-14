export interface Dataset { columns: string[]; rows: Record<string, string | number | boolean | null>[] } // null: empty cell; boolean: PapaParse/SheetJS native
export interface GroupStat { group: string; n: number; mean: number; sd: number; se: number }
export interface TTestResult {
  groupStats: [GroupStat, GroupStat]
  contrast: string
  test: 'pooled' | 'welch'
  t: number; df: number; p: number; meanDiff: number; ci: [number, number]; cohensD: number
  levene: { F: number | null; p: number | null } // null when degenerate (n < 3 per group) — rendered as em-dash
  ciLevel: number
  nExcluded: number                              // rows dropped listwise (missing/non-numeric role value)
  figurePng: Uint8Array<ArrayBuffer>
}
