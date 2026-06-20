// Locked interface for CB-SEM results (full implementation comes in Unit 6)
export interface CbSemResult {
  mode: 'full' | 'cfa-only' | 'path'
  saturated: boolean
  efaSuitability?: Record<string, number>
  efaLoadings?: unknown
  cfaLoadings: Array<Record<string, unknown>>
  reliability: Array<Record<string, unknown>>
  fit?: Record<string, number>
  structural?: Array<Record<string, unknown>>
  rsquare?: Record<string, number>
  indirect?: Array<Record<string, unknown>>
  estimates: { paths: Array<{ from: number; to: number; beta: number }>; loadings: Record<string, number>; r2: Record<number, number> }
}
