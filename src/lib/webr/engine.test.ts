import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from './engine'
describe('Engine', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })
  it('runs R, returns parsed JSON', async () => expect((await engine.runJson<{ s: number }>('list(s = 2 + 3)')).s).toBe(5))
  it('applies the detectCores shim', async () => expect(await engine.runJson<number>('parallel::detectCores()')).toBe(1))
  it('passes JS vectors into R', async () => expect(await engine.runJson<number>('mean(x)', { x: [2, 4, 6] })).toBe(4))
  it('serializes quoted strings, backslashes, non-finite numbers and logicals safely', async () => {
    const r = await engine.runJson<{ s: string; inf: number | null; ok: boolean }>(String.raw`list(s = 'say "hi" \\', inf = 1/0, ok = TRUE)`)
    expect(r).toEqual({ s: 'say "hi" \\', inf: null, ok: true })
  })
  it('captures a base-R plot as PNG bytes', async () => {
    const png = await engine.capturePlot('boxplot(c(1,2,3,4) ~ c("a","a","b","b"))')
    expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})
