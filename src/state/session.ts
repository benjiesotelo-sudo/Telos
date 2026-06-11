import { create } from 'zustand'
import type { Dataset, TTestResult } from '../lib/stats/types'
type Status = 'idle' | 'running' | 'done' | 'error'
interface Config { outcome: string | null; group: string | null; equalVariance: boolean }
interface S {
  dataset: Dataset | null; config: Config; result: TTestResult | null; status: Status; error: string | null
  setDataset: (d: Dataset) => void; setConfig: (c: Partial<Config>) => void
  setStatus: (s: Status) => void; setResult: (r: TTestResult) => void; setError: (e: string) => void; reset: () => void
}
// equalVariance: false = the card's drawn default 'off · Welch'
const initial = { dataset: null, config: { outcome: null, group: null, equalVariance: false }, result: null, status: 'idle' as Status, error: null }
export const useSession = create<S>((set) => ({
  ...initial,
  setDataset: (dataset) => set({ dataset, result: null, status: 'idle', error: null }),
  // a config change invalidates any displayed result — the screen must never show output of a previous config
  setConfig: (c) => set((s) => ({ config: { ...s.config, ...c }, result: null, status: 'idle', error: null })),
  setStatus: (status) => set({ status }), setResult: (result) => set({ result, status: 'done' }),
  // an error clears the previous result so ExportButton can't capture a half-gone DOM
  setError: (error) => set({ error, status: 'error', result: null }), reset: () => set({ ...initial }),
}))
