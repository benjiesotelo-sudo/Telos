// TEMPORARY SEM feasibility-spike harness — runs under vitest (the proven WebR-in-Node path;
// bare `node` trips WebR's channel: "WebSocketServer is not a constructor"). Boots WebR exactly
// like Engine, installs the SEM packages, runs the SAME sem-spike.R that native Rscript runs, and
// writes the WebR output to /tmp for diffing vs native. DELETE after the spike — not part of the slice.
import { describe, it } from 'vitest'
import { WebR } from 'webr'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('SEM feasibility spike (WebR 0.6.0)', () => {
  it('loads lavaan/semTools/psych/GPArotation/seminr and runs sem-spike.R', async () => {
    const rcode = readFileSync(
      resolve(process.cwd(), 'docs/superpowers/reviews/2026-06-18-sem-spike-data/sem-spike.R'), 'utf8')
    const t0 = Date.now()
    const webR = new WebR({})
    await webR.init()
    await webR.evalRVoid(
      `local({ ns <- asNamespace("parallel"); unlockBinding("detectCores", ns); assign("detectCores", function(logical = TRUE, all.tests = FALSE) 1L, envir = ns) })`)
    // WebR/WASM has no sockets, so parallel::makeCluster (PSOCK) fails ("WebSocketServer is not a constructor").
    // seminr::bootstrap_model ALWAYS builds a cluster (no serial path even at cores=1), so shim the parallel API to run serially.
    await webR.evalRVoid(`local({
      ns <- asNamespace("parallel")
      mk <- function(...) structure(list(), class = c("telosSerialCluster", "SOCKcluster", "cluster"))
      for (fn in c("makeCluster","makePSOCKcluster","makeForkCluster")) if (exists(fn, ns)) { unlockBinding(fn, ns); assign(fn, mk, ns) }
      unlockBinding("parLapply", ns)
      assign("parLapply", function(cl, X, fun, ...) { a <- list(...); a[["chunk.size"]] <- NULL; do.call(base::lapply, c(list(X = X, FUN = fun), a)) }, ns)
      if (exists("parSapply", ns)) { unlockBinding("parSapply", ns); assign("parSapply", function(cl, X, fun, ...) { a <- list(...); a[["chunk.size"]] <- NULL; do.call(base::sapply, c(list(X = X, FUN = fun), a)) }, ns) }
      for (fn in c("clusterExport","clusterEvalQ","clusterCall","clusterApply","clusterApplyLB","stopCluster","clusterSetRNGStream")) if (exists(fn, ns)) { unlockBinding(fn, ns); assign(fn, function(...) invisible(NULL), ns) }
    })`)
    const loaded: Record<string, boolean> = {}
    for (const p of ['lavaan', 'semTools', 'psych', 'GPArotation', 'seminr']) {
      const ti = Date.now()
      try { await webR.installPackages([p], { quiet: true }); loaded[p] = true; console.log(`[install] ${p} +${((Date.now() - ti) / 1000).toFixed(1)}s`) }
      catch (e) { loaded[p] = false; console.log(`[install] ${p} FAILED: ${(e as Error)?.message}`) }
    }
    console.log('[load summary]', JSON.stringify(loaded))
    await webR.FS.writeFile('/tmp/telos-spike.R', new TextEncoder().encode(rcode))
    const tRun = Date.now()
    let runErr = ''
    try {
      await webR.evalRVoid(`
        .telos_con <- file("/tmp/telos-out.txt", open = "wt")
        sink(.telos_con); sink(.telos_con, type = "message")
        tryCatch(source("/tmp/telos-spike.R", echo = FALSE),
                 error = function(e) cat("TOP-LEVEL ERROR:", conditionMessage(e), "\\n"))
        sink(type = "message"); sink(); close(.telos_con)
      `)
    } catch (e) { runErr = (e as Error)?.message ?? String(e) }
    const runSecs = ((Date.now() - tRun) / 1000).toFixed(1)
    let out = ''
    try { out = new TextDecoder().decode(await webR.FS.readFile('/tmp/telos-out.txt')) }
    catch (e) { out = `(could not read sink file: ${(e as Error)?.message})` }
    const header = `[webr] packages=${JSON.stringify(loaded)} run=${runSecs}s total=${((Date.now() - t0) / 1000).toFixed(1)}s runErr=${runErr || 'none'}\n`
    writeFileSync('/tmp/telos-webr-sem-out.txt', header + out)
    console.log('\n=====WEBR-OUTPUT-BEGIN=====\n' + header + out + '\n=====WEBR-OUTPUT-END=====\n')
    await webR.close()
  }, 900_000)
})
