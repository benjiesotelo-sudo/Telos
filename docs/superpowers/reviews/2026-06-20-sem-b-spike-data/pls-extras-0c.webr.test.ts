// Spike 0c WebR harness — runs the SAME pls-extras-0c.R native Rscript runs, under WebR 0.6.0 (vitest path).
// DELETE after the spike.
import { describe, it } from 'vitest'
import { WebR } from 'webr'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MAKECLUSTER_SHIM } from '../../../../src/lib/webr/parallelShim'

const DETECTCORES = `local({ ns <- asNamespace("parallel"); unlockBinding("detectCores", ns); assign("detectCores", function(logical = TRUE, all.tests = FALSE) 1L, envir = ns) })`

describe('SEM-B spike 0c — PLS extras under WebR', () => {
  it('runs f^2 / Q^2 / indirect CI / mixed formative model', async () => {
    const rcode = readFileSync(resolve(process.cwd(),
      'docs/superpowers/reviews/2026-06-20-sem-b-spike-data/pls-extras-0c.R'), 'utf8')
    const t0 = Date.now()
    const webR = new WebR({})
    await webR.init()
    await webR.evalRVoid(DETECTCORES)
    await webR.evalRVoid(MAKECLUSTER_SHIM)
    const ti = Date.now()
    await webR.installPackages(['seminr'], { quiet: true })
    console.log(`[install] seminr +${((Date.now() - ti) / 1000).toFixed(1)}s`)
    await webR.FS.writeFile('/tmp/pls-extras-0c.R', new TextEncoder().encode(rcode))
    const tRun = Date.now()
    await webR.evalRVoid(`
      .telos_con <- file("/tmp/pls-extras-0c-out.txt", open = "wt")
      sink(.telos_con); sink(.telos_con, type = "message")
      tryCatch(source("/tmp/pls-extras-0c.R", echo = FALSE),
               error = function(e) cat("TOP-LEVEL ERROR:", conditionMessage(e), "\\n"))
      sink(type = "message"); sink(); close(.telos_con)
    `)
    const runSecs = ((Date.now() - tRun) / 1000).toFixed(1)
    const out = new TextDecoder().decode(await webR.FS.readFile('/tmp/pls-extras-0c-out.txt'))
    const header = `[webr] run=${runSecs}s total=${((Date.now() - t0) / 1000).toFixed(1)}s\n`
    writeFileSync(resolve(process.cwd(),
      'docs/superpowers/reviews/2026-06-20-sem-b-spike-data/0c-webr.txt'), header + out)
    console.log('\n=====0C-WEBR-BEGIN=====\n' + header + out + '\n=====0C-WEBR-END=====\n')
    await webR.close()
  }, 900_000)
})
