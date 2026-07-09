// Boot WebR 0.6.0 in Node, install lavaan, and run the SAME estimator/missing matrix as
// scripts/spikes/h1-estimator-spike.R -- so we can diff WebR output against native R
// (parity to 8dp) -- plus the Q5 NaN-marshalling check that lives only in this twin.
// Pattern copied from docs/superpowers/reviews/2026-06-18-sem-spike-data/webr-sem-spike.mjs.
// Run from repo root: node scripts/spikes/h1-estimator-spike.node.mjs
import { WebR } from 'webr'

const PKGS = ['lavaan']
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

// DEVIATION from the native script: this is the SAME model, seed (20260710), and
// estimator/missing matrix as scripts/spikes/h1-estimator-spike.R, but the two
// write.csv() fixture-writing lines are omitted -- WebR's virtual FS in this Node
// harness has no scripts/spikes/ or docs/testing/ directories, and the fixtures are
// already written + pinned by the native run (byte-for-byte deterministic from the
// same seed, so nothing here needs to reproduce them). Same print8()/nd=8 fix as the
// native script (lavaan's print.lavaan.vector / print.lavaan.data.frame hardcode
// nd=3, ignoring round() and options(digits=...)) so the captured output actually
// carries 8 decimal places to diff against native.
const rcode = `
library(lavaan)
print8 <- function(x) print(x, nd = 8)

data(PoliticalDemocracy)
model <- '
  ind60 =~ x1 + x2 + x3
  dem60 =~ y1 + y2 + y3 + y4
  dem60 ~ ind60
'
set.seed(20260710)
pd <- PoliticalDemocracy
for (col in c("y1","y2","y3","y4")) {
  idx <- sample(seq_len(nrow(pd)), size = 6)
  pd[idx, col] <- NA
}

cells <- list(
  list(est = "ML",    miss = "listwise"),
  list(est = "ML",    miss = "ml"),
  list(est = "ML",    miss = "pairwise"),
  list(est = "MLR",   miss = "listwise"),
  list(est = "MLR",   miss = "ml"),
  list(est = "MLR",   miss = "pairwise")
)
for (c_ in cells) {
  cat("=== ", c_$est, "/", c_$miss, " ===\\n")
  fit <- tryCatch(
    lavaan::sem(model, data = pd, estimator = c_$est, missing = c_$miss),
    error = function(e) { cat("CELL FAILED:", conditionMessage(e), "\\n"); NULL }
  )
  if (is.null(fit)) next
  print8(lavaan::fitMeasures(fit))
  print8(lavaan::parameterEstimates(fit)[, c("lhs","op","rhs","est","se","ci.lower","ci.upper")])
}

set.seed(20260710)
n <- 300
lv <- rnorm(n)
lik <- function(x) cut(x + rnorm(n, sd = .8), breaks = c(-Inf, -1, -.3, .3, 1, Inf), labels = FALSE)
likert <- data.frame(a1 = lik(lv), a2 = lik(lv), a3 = lik(lv),
                     b1 = lik(-lv), b2 = lik(-lv), b3 = lik(-lv),
                     cont1 = lv + rnorm(n, sd = .5), cont2 = lv + rnorm(n, sd = .5))
mixed_model <- '
  A =~ a1 + a2 + a3
  C =~ cont1 + cont2
  B =~ b1 + b2 + b3
  B ~ A + C
'
for (miss in c("listwise", "pairwise")) {
  fit <- lavaan::sem(mixed_model, data = likert, estimator = "WLSMV",
                     ordered = c("a1","a2","a3","b1","b2","b3"), missing = miss)
  cat("=== WLSMV /", miss, " ===\\n")
  print8(lavaan::fitMeasures(fit))
  print8(lavaan::parameterEstimates(fit)[, c("lhs","op","rhs","est","se")])
}
`

console.log(`\n[webr] ====== running estimator/missing matrix under WebR ======\n`)
// Avoid captureR's output channel (throws "WebSocketServer is not a constructor" in this Node
// setup): write the script into WebR's virtual FS, sink output to a file, then read it back.
try {
  await webR.FS.writeFile('/tmp/telos-h1-spike.R', new TextEncoder().encode(rcode))
  const tRun = Date.now()
  await webR.evalRVoid(`
    .telos_con <- file("/tmp/telos-h1-out.txt", open = "wt")
    sink(.telos_con); sink(.telos_con, type = "message")
    tryCatch(source("/tmp/telos-h1-spike.R", echo = FALSE),
             error = function(e) cat("TOP-LEVEL ERROR:", conditionMessage(e), "\\n"))
    sink(type = "message"); sink(); close(.telos_con)
  `)
  console.log(`[webr] script run complete (+${((Date.now() - tRun) / 1000).toFixed(1)}s)`)
  const bytes = await webR.FS.readFile('/tmp/telos-h1-out.txt')
  console.log(new TextDecoder().decode(bytes))
} catch (e) {
  console.log(`[webr] !!! RUN ERROR: ${e?.message ?? e}`)
}

// Q5: does a JS NaN placed in a numeric env array arrive in R as a missing value?
// Load-bearing for the production FIML path (Task 3), which will marshal full rows
// (including holes) through the same env mechanism the app uses in
// src/lib/webr/engine.ts (runJson/capturePlot both bind JS values via { env }).
console.log(`\n[webr] ====== Q5: NaN marshalling check ======\n`)
try {
  await webR.evalRVoid(
    `
    .telos_con <- file("/tmp/telos-nan-out.txt", open = "wt")
    sink(.telos_con)
    cat("values:", jsNanArr, "\\n")
    cat("is.na:", is.na(jsNanArr), "\\n")
    cat(if (is.na(jsNanArr[3]) && !is.na(jsNanArr[1]) && !is.na(jsNanArr[2]) && !is.na(jsNanArr[4]))
          "NA-ok" else "NA-FAIL", "\\n")
    sink()
    close(.telos_con)
  `,
    { env: { jsNanArr: [1, 2, NaN, 4] } }
  )
  const nanBytes = await webR.FS.readFile('/tmp/telos-nan-out.txt')
  console.log(new TextDecoder().decode(nanBytes))
} catch (e) {
  console.log(`[webr] !!! Q5 NaN CHECK ERROR: ${e?.message ?? e}`)
}

await webR.close()
console.log(`\n[webr] total elapsed ${el()}s`)
