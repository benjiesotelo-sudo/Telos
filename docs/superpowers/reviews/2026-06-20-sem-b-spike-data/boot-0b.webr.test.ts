// Spike 0b WebR harness — runs the SAME boot-0b.R native Rscript runs, under WebR 0.6.0 in Node (vitest path).
// DELETE after the spike. Long timeout: single 5000-resample bootstraps are ~minutes in WASM.
import { describe, it } from 'vitest'
import { WebR } from 'webr'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MAKECLUSTER_SHIM } from '../../../../src/lib/webr/parallelShim'

const DETECTCORES = `local({ ns <- asNamespace("parallel"); unlockBinding("detectCores", ns); assign("detectCores", function(logical = TRUE, all.tests = FALSE) 1L, envir = ns) })`

describe('SEM-B spike 0b — single 5000 bootstrap under WebR', () => {
  it('runs CB-SEM mediation + PLS percentile bootstrap to completion', async () => {
    const rcode = readFileSync(resolve(process.cwd(),
      'docs/superpowers/reviews/2026-06-20-sem-b-spike-data/boot-0b.R'), 'utf8')
    const t0 = Date.now()
    const webR = new WebR({})
    await webR.init()
    await webR.evalRVoid(DETECTCORES)
    await webR.evalRVoid(MAKECLUSTER_SHIM)
    for (const p of ['lavaan', 'seminr']) {
      const ti = Date.now()
      await webR.installPackages([p], { quiet: true })
      console.log(`[install] ${p} +${((Date.now() - ti) / 1000).toFixed(1)}s`)
    }
    await webR.FS.writeFile('/tmp/boot-0b.R', new TextEncoder().encode(rcode))
    const tRun = Date.now()
    await webR.evalRVoid(`
      .telos_con <- file("/tmp/boot-0b-out.txt", open = "wt")
      sink(.telos_con); sink(.telos_con, type = "message")
      tryCatch(source("/tmp/boot-0b.R", echo = FALSE),
               error = function(e) cat("TOP-LEVEL ERROR:", conditionMessage(e), "\\n"))
      sink(type = "message"); sink(); close(.telos_con)
    `)
    const runSecs = ((Date.now() - tRun) / 1000).toFixed(1)
    const out = new TextDecoder().decode(await webR.FS.readFile('/tmp/boot-0b-out.txt'))
    const header = `[webr] run=${runSecs}s total=${((Date.now() - t0) / 1000).toFixed(1)}s\n`
    writeFileSync(resolve(process.cwd(),
      'docs/superpowers/reviews/2026-06-20-sem-b-spike-data/0b-webr.txt'), header + out)
    console.log('\n=====0B-WEBR-BEGIN=====\n' + header + out + '\n=====0B-WEBR-END=====\n')
    await webR.close()
  }, 1_200_000)
})
