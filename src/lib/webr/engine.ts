import { WebR } from 'webr'

const BASE_URL = typeof window === 'undefined' ? undefined : '/webr/'
const DETECTCORES_SHIM = `local({ ns <- asNamespace("parallel"); unlockBinding("detectCores", ns); assign("detectCores", function(logical = TRUE, all.tests = FALSE) 1L, envir = ns) })`

// Recursive R->JSON, no package dependency. Handles scalars, vectors, named + unnamed lists, logicals;
// escapes strings (backslash, quote, control chars); maps NA/NaN/±Inf to null. Sandbox-verified.
const TELOS_JSON_HELPER = String.raw`
.telos_str <- function(s) {
  s <- gsub('\\', '\\\\', s, fixed=TRUE); s <- gsub('"', '\\"', s, fixed=TRUE)
  s <- gsub('\n', '\\n', s, fixed=TRUE); s <- gsub('\r', '\\r', s, fixed=TRUE); s <- gsub('\t', '\\t', s, fixed=TRUE)
  paste0('"', s, '"')
}
.telos_json <- function(x) {
  if (is.list(x)) {
    nm <- names(x); if (is.null(nm)) nm <- rep("", length(x))
    parts <- vapply(seq_along(x), function(i) { key <- if (nzchar(nm[i])) paste0('"', nm[i], '":') else ''; paste0(key, .telos_json(x[[i]])) }, character(1))
    if (length(x) && all(nzchar(nm))) paste0('{', paste(parts, collapse=','), '}') else paste0('[', paste(parts, collapse=','), ']')
  } else if (is.logical(x)) { v <- ifelse(is.na(x), 'null', ifelse(x, 'true', 'false')); if (length(x)==1) v else paste0('[', paste(v, collapse=','), ']')
  } else if (is.character(x)) { v <- vapply(x, function(s) if (is.na(s)) 'null' else .telos_str(s), character(1)); if (length(x)==1) v else paste0('[', paste(v, collapse=','), ']')
  } else { v <- ifelse(is.finite(x), formatC(x, format='g', digits=10), 'null'); if (length(x)==1) v else paste0('[', paste(v, collapse=','), ']') }
}`

export class Engine {
  private webr: WebR
  private ready = false
  constructor() { this.webr = new WebR(BASE_URL ? { baseUrl: BASE_URL } : {}) }

  /** Boot R, install core-tests packages (first run downloads from the WebR package repo — the browser caches it; Node re-downloads per instance). */
  async init(onStatus?: (msg: string) => void): Promise<void> {
    if (this.ready) return
    onStatus?.('Loading R engine (first run downloads ~20 MB)…')
    await this.webr.init()
    await this.webr.evalRVoid(DETECTCORES_SHIM)
    await this.webr.evalRVoid(TELOS_JSON_HELPER)
    // Spike-verified under WebR 0.6.0 (R 4.6.0): ggplot2 + nortest + effectsize + psych + coin + janitor all
    // install from the WebR repo. First visit pays the download (~80s Node-side total); the browser caches.
    // ANOVA slice additions spike-verified under WebR 0.6.0 (wf_0a8e8e23-be0): afex (lme4/Matrix/car deps), emmeans, rstatix. PMCMRplus cannot load (Rmpfr lacks a wasm binary) — Nemenyi is hand-rolled in the Friedman stats module.
    // Regression slice additions spike-verified under WebR 0.6.0 (343/343 ≡ native R 4.6.0): pROC (closure 2.54 MiB),
    // parameters (4.35 MiB — β via refit), performance (2.36 MiB — Nagelkerke R², dispersion ratio). caret and broom
    // deliberately NOT shipped (spike D4/B4: 51-pkg ≥26.8 MiB and 21-pkg 23.05 MiB closures; nothing computed needs them
    // — classification is a hand 2×2 tabulation). MASS ships with base R (glm.nb) — load-checked only.
    // Econometrics time-series slice additions — spike-verified install + load under WebR 0.6.0 (2026-06-15-econometrics-spike.md):
    // forecast (auto.arima/forecast), tseries + urca (ADF/KPSS), vars (VAR/IRF), lmtest (Granger). All match native R 4.6.0.
    // Econometrics panel+causal slice additions — native-R-verified (2026-06-15-panel-causal-spike.md):
    // plm (FE/RE/Hausman), sandwich (clustered/robust vcov for DiD/IV), ivreg (2SLS), rdrobust (RDD), MatchIt (PSM).
    // (cobalt NOT shipped — unavailable under WebR; the PSM love plot is hand-rolled in ggplot2.)
    // Reporting-completeness slice additions — spike-verified install + load under WebR 0.6.0 ≡ native R 4.6.0 (2026-06-17-reporting-completeness-spike.md):
    // heplots (Box's M via heplots::boxM — its rgl/broom/purrr/tibble imports all resolve from the r-wasm repo),
    // rddensity (RDD McCrary density test — its lpdensity/ggplot2 deps resolve; LOADS under WebR so no deferral).
    for (const pkg of ['ggplot2', 'nortest', 'effectsize', 'psych', 'coin', 'janitor',
      'afex', 'emmeans', 'car', 'rstatix',
      'pROC', 'parameters', 'performance',
      'forecast', 'tseries', 'urca', 'vars', 'lmtest',
      'plm', 'sandwich', 'ivreg', 'rdrobust', 'MatchIt',
      'heplots', 'rddensity']) {
      onStatus?.(`Loading ${pkg}…`)
      await this.webr.installPackages([pkg], { quiet: true })
    }
    this.ready = true
  }

  /** Evaluate an R block (statements allowed); its last value is serialized to JSON and parsed. */
  async runJson<T>(rBlock: string, env?: Record<string, unknown>): Promise<T> {
    const shelter = await new this.webr.Shelter()
    try {
      // NEVER pass `env: undefined` — webr 0.6.0 throws on a present-but-undefined env key (sandbox-verified); omit the key instead.
      const cap = await shelter.captureR(`cat(.telos_json({\n${rBlock}\n}))`, { captureStreams: true, ...(env ? { env: env as any } : {}) })
      const text = cap.output.filter((o) => o.type === 'stdout').map((o) => o.data).join('')
      return JSON.parse(text) as T
    } finally { await shelter.purge() }
  }

  /** Run plotting R (env-bound), return the PNG bytes from the virtual FS. ggplot2 objects must be print()ed to reach the device. */
  async capturePlot(plotR: string, width = 600, height = 450, env?: Record<string, unknown>): Promise<Uint8Array<ArrayBuffer>> {
    const path = '/tmp/telos-plot.png'
    await this.webr.evalRVoid(`png('${path}', width=${width}, height=${height}, res=110); tryCatch({ ${plotR} }, finally = dev.off())`, env ? { env: env as any } : undefined)
    return (await this.webr.FS.readFile(path)) as Uint8Array<ArrayBuffer> // typed buffer: Uint8Array<ArrayBufferLike> is not a BlobPart under TS 6
  }

  async close(): Promise<void> { if (this.ready) { await this.webr.close(); this.ready = false } }
}
