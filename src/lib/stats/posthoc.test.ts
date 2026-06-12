import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { loadAnovaFixture } from './fixtures/anova'
import { POSTHOC_EMM_R, type PosthocRow } from './posthoc'

let engine: Engine
beforeAll(async () => { engine = new Engine(); await engine.init() }, 600_000)
afterAll(async () => { await engine.close() })

const run = (adjust: string) => {
  const ds = loadAnovaFixture()
  const env = {
    y: ds.rows.map((r) => r['outcome'] as number),
    g: ds.rows.map((r) => String(r['group'])),
    adjust,
  }
  return engine.runJson<PosthocRow[]>(`
    ${POSTHOC_EMM_R}
    m <- aov(y ~ g, data = data.frame(y = y, g = factor(g)))
    .telos_posthoc(emmeans::emmeans(m, ~g), adjust)`, env)
}

describe('shared emmeans post-hoc (spike known answers, control - drug_a row)', () => {
  it('tukey', async () => {
    const rows = await run('tukey')
    const r = rows.find((x) => x.pair === 'control - drug_a')!
    expect(r.diff).toBeCloseTo(-1.37, 6)
    expect(r.se).toBeCloseTo(2.33956998597995, 6)
    expect(r.pAdj).toBeCloseTo(0.828376280197589, 6)
    expect(r.ciLo).toBeCloseTo(-6.99998369176902, 5)
    expect(r.ciHi).toBeCloseTo(4.25998369176902, 5)
    expect(rows).toHaveLength(3)
  }, 300_000)
  it('bonferroni', async () => {
    const r = (await run('bonferroni')).find((x) => x.pair === 'control - drug_a')!
    expect(r.pAdj).toBeCloseTo(1, 6)
    expect(r.ciLo).toBeCloseTo(-7.14098686270864, 5)
    expect(r.ciHi).toBeCloseTo(4.40098686270864, 5)
  }, 300_000)
  it('scheffe', async () => {
    const r = (await run('scheffe')).find((x) => x.pair === 'control - drug_a')!
    expect(r.pAdj).toBeCloseTo(0.842874697999946, 6)
    expect(r.ciLo).toBeCloseTo(-7.25051064370089, 5)
    expect(r.ciHi).toBeCloseTo(4.51051064370089, 5)
  }, 300_000)
})
