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
  it('loads the ANOVA-slice packages', async () => {
    const ok = await engine.runJson<string[]>(`
      pkgs <- c('afex','emmeans','car','rstatix')
      as.list(pkgs[vapply(pkgs, requireNamespace, logical(1), quietly = TRUE)])`)
    expect(ok).toEqual(['afex', 'emmeans', 'car', 'rstatix'])
  }, 600_000)
  it('loads the Regression-slice packages (library(), not just requireNamespace) incl. preinstalled MASS', async () => {
    const ok = await engine.runJson<string[]>(`
      pkgs <- c('pROC','parameters','performance','MASS')
      as.list(pkgs[vapply(pkgs, function(p) tryCatch({ library(p, character.only = TRUE); TRUE }, error = function(e) FALSE), logical(1))])`)
    expect(ok).toEqual(['pROC', 'parameters', 'performance', 'MASS'])
  }, 600_000)
  it('lazily installs seminr and runs estimate_pls on the mobi dataset under WebR', async () => {
    await engine.ensureSeminr()
    const r = await engine.runJson<{ loaded: boolean; rows: number; cols: number; constructs: string[]; satR2: number }>(`
      suppressMessages(library(seminr))
      mm <- constructs(
        composite("Image",        multi_items("IMAG", 1:5)),
        composite("Expectation",  multi_items("CUEX", 1:3)),
        composite("Quality",      multi_items("PERQ", 1:7)),
        composite("Value",        multi_items("PERV", 1:2)),
        composite("Satisfaction", multi_items("CUSA", 1:3)),
        composite("Complaints",   single_item("CUSCO")),
        composite("Loyalty",      multi_items("CUSL", 1:3)))
      sm <- relationships(
        paths(from = "Image",        to = c("Expectation","Satisfaction","Loyalty")),
        paths(from = "Expectation",  to = c("Quality","Value","Satisfaction")),
        paths(from = "Quality",      to = c("Value","Satisfaction")),
        paths(from = "Value",        to = "Satisfaction"),
        paths(from = "Satisfaction", to = c("Complaints","Loyalty")),
        paths(from = "Complaints",   to = "Loyalty"))
      pls <- estimate_pls(data = mobi, measurement_model = mm, structural_model = sm)
      s <- summary(pls)
      list(
        loaded     = requireNamespace("seminr", quietly = TRUE),
        rows       = nrow(mobi),
        cols       = ncol(mobi),
        constructs = rownames(s$reliability),
        satR2      = unname(round(s$paths["R^2", "Satisfaction"], 3)))`)
    expect(r.loaded).toBe(true)
    expect(r.rows).toBe(250)
    expect(r.cols).toBe(24)
    expect(r.constructs).toEqual(['Image', 'Expectation', 'Quality', 'Value', 'Satisfaction', 'Complaints', 'Loyalty'])
    expect(r.satR2).toBe(0.681)
  }, 600_000)
  it('ensureSeminr is idempotent — a second call is a no-op and seminr stays loaded', async () => {
    await engine.ensureSeminr()
    await engine.ensureSeminr()
    expect(await engine.runJson<boolean>(`requireNamespace("seminr", quietly = TRUE)`)).toBe(true)
  }, 600_000)
})
