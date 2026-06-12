import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { loadAnovaFixture } from './fixtures/anova'
import { ADJMEANS_R, type AdjustedMeanRow } from './adjustedMeans'

let engine: Engine
beforeAll(async () => { engine = new Engine(); await engine.init() }, 600_000)
afterAll(async () => { await engine.close() })

describe('adjusted means via emmeans (ANCOVA type-3 spike known answers)', () => {
  it('control row matches native R', async () => {
    const ds = loadAnovaFixture()
    const env = {
      y: ds.rows.map((r) => r['outcome'] as number),
      cov: ds.rows.map((r) => r['baseline'] as number),
      g: ds.rows.map((r) => String(r['group'])),
    }
    const rows = await engine.runJson<AdjustedMeanRow[]>(`
      ${ADJMEANS_R}
      d <- data.frame(y = y, cov = cov, g = factor(g))
      m <- lm(y ~ cov + g, data = d, contrasts = list(g = contr.sum))
      .telos_adjmeans(emmeans::emmeans(m, ~g))`, env)
    expect(rows).toHaveLength(3)
    const c = rows.find((r) => r.group === 'control')!
    expect(c.mean).toBeCloseTo(31.4221627207434, 6)
    expect(c.se).toBeCloseTo(1.10991244962393, 6)
    expect(c.ciLo).toBeCloseTo(29.1987409073006, 5)
    expect(c.ciHi).toBeCloseTo(33.6455845341862, 5)
  }, 300_000)
})
