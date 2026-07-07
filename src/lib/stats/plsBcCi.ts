/** Hand-rolled z0-adjusted percentile ("bca.simple", a=0 — bias-corrected, NON-accelerated) BC interval from
 *  a raw bootstrap draw vector — the SAME algorithm lavaan's boot.ci.type="bca.simple" uses internally
 *  (ported from lavaan:::parameterestimates' norm.inter/bc_ci; verified byte-identical against lavaan on a
 *  shared fixture — see plsBcCi.test.ts). seminr exposes only the raw boot matrix (bo$boot_paths, no
 *  bca.simple option), so this R text runs INSIDE the PLS R block against that raw array — a
 *  `[from, to, boot_index]` 3D array (confirmed via `str(bootstrap_model(...))`), never a summary object. */
export const BC_CI_R = String.raw`
norm_inter <- function(t, alpha) {
  t <- t[is.finite(t)]; R <- length(t)
  rk <- (R + 1) * alpha
  k <- trunc(rk)
  tstar <- sort(t)
  out <- numeric(length(k))
  for (j in seq_along(k)) {
    if (k[j] == rk[j])      out[j] <- tstar[k[j]]
    else if (k[j] == 0)     out[j] <- tstar[1]
    else if (k[j] == R)     out[j] <- tstar[R]
    else {
      temp1 <- qnorm(alpha[j]); temp2 <- qnorm(k[j] / (R + 1)); temp3 <- qnorm((k[j] + 1) / (R + 1))
      out[j] <- tstar[k[j]] + (temp1 - temp2) / (temp3 - temp2) * (tstar[k[j] + 1] - tstar[k[j]])
    }
  }
  out
}
bc_ci <- function(draws, t0, level = 0.95) {
  draws <- draws[is.finite(draws)]
  zalpha <- qnorm((1 + c(-level, level)) / 2)
  w <- qnorm(sum(draws < t0) / length(draws))
  norm_inter(draws, pnorm(2 * w + zalpha))
}
`
