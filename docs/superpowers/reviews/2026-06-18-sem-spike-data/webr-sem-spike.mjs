// Boot WebR 0.6.0 in Node, install the SEM packages, and run the IDENTICAL sem-spike.R
// that native Rscript runs — so we can diff the two outputs for WebR == native-R parity.
// Run from repo root:  node docs/superpowers/reviews/2026-06-18-sem-spike-data/webr-sem-spike.mjs
import { WebR } from 'webr'
import { readFileSync } from 'node:fs'

const rcode = readFileSync(new URL('./sem-spike.R', import.meta.url), 'utf8')
const PKGS = ['lavaan', 'semTools', 'psych', 'GPArotation', 'seminr']
const t0 = Date.now()
const el = () => ((Date.now() - t0) / 1000).toFixed(1)

const webR = new WebR()
await webR.init()
console.log(`[webr] init complete @ ${el()}s`)

// Mirror the app's detectCores shim (parallel::detectCores() returns NA under WASM).
await webR.evalRVoid(`tryCatch({
  ns <- asNamespace("parallel"); unlockBinding("detectCores", ns)
  assign("detectCores", function(...) 1L, envir = ns)
}, error = function(e) NULL)`)

const loaded = {}
for (const p of PKGS) {
  const ti = Date.now()
  try {
    await webR.installPackages([p], { quiet: true })
    loaded[p] = true
    console.log(`[webr] installed ${p}  (+${((Date.now() - ti) / 1000).toFixed(1)}s, total ${el()}s)`)
  } catch (e) {
    loaded[p] = false
    console.log(`[webr] !!! INSTALL FAILED ${p}: ${e?.message ?? e}`)
  }
}
console.log(`[webr] package load summary:`, JSON.stringify(loaded))
console.log(`\n[webr] ====== running sem-spike.R under WebR ======\n`)

// Avoid captureR's output channel (throws "WebSocketServer is not a constructor" in this Node setup):
// write the script into WebR's virtual FS, sink output to a file, then read it back.
try {
  await webR.FS.writeFile('/tmp/telos-spike.R', new TextEncoder().encode(rcode))
  const tRun = Date.now()
  await webR.evalRVoid(`
    .telos_con <- file("/tmp/telos-out.txt", open = "wt")
    sink(.telos_con); sink(.telos_con, type = "message")
    tryCatch(source("/tmp/telos-spike.R", echo = FALSE),
             error = function(e) cat("TOP-LEVEL ERROR:", conditionMessage(e), "\\n"))
    sink(type = "message"); sink(); close(.telos_con)
  `)
  console.log(`[webr] script run complete (+${((Date.now() - tRun) / 1000).toFixed(1)}s)`)
  const bytes = await webR.FS.readFile('/tmp/telos-out.txt')
  console.log(new TextDecoder().decode(bytes))
} catch (e) {
  console.log(`[webr] !!! RUN ERROR: ${e?.message ?? e}`)
}
await webR.close()
console.log(`\n[webr] total elapsed ${el()}s`)
