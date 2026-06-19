// WebR/WASM has no sockets, so parallel::makeCluster (PSOCK) throws "WebSocketServer is not a constructor".
// seminr::bootstrap_model ALWAYS builds a cluster with no serial path (even at cores=1).
// This shim replaces the cluster API with a serial fallback, mirroring the detectCores shim pattern.
// Verified working under WebR 0.6.0 — see docs/superpowers/reviews/2026-06-18-sem-spike-data/webr-sem-spike.test.ts.
export const MAKECLUSTER_SHIM = `local({
  ns <- asNamespace("parallel")
  mk <- function(...) structure(list(), class = c("telosSerialCluster", "SOCKcluster", "cluster"))
  for (fn in c("makeCluster","makePSOCKcluster","makeForkCluster")) if (exists(fn, ns)) { unlockBinding(fn, ns); assign(fn, mk, ns) }
  unlockBinding("parLapply", ns)
  assign("parLapply", function(cl, X, fun, ...) { a <- list(...); a[["chunk.size"]] <- NULL; do.call(base::lapply, c(list(X = X, FUN = fun), a)) }, ns)
  if (exists("parSapply", ns)) { unlockBinding("parSapply", ns); assign("parSapply", function(cl, X, fun, ...) { a <- list(...); a[["chunk.size"]] <- NULL; do.call(base::sapply, c(list(X = X, FUN = fun), a)) }, ns) }
  for (fn in c("clusterExport","clusterEvalQ","clusterCall","clusterApply","clusterApplyLB","stopCluster","clusterSetRNGStream")) if (exists(fn, ns)) { unlockBinding(fn, ns); assign(fn, function(...) invisible(NULL), ns) }
})`
