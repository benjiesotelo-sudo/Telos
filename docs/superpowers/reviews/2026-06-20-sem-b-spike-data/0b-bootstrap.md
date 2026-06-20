# Spike 0b — Single 5000-resample bootstrap in WASM: timing + percentile-CI parity

**Date:** 2026-06-20
**Status: SUCCESS — success bar MET**

---

## What was tested

Single awaited 5000-resample bootstrap for BOTH tracks, run under native R 4.6.0 and WebR 0.6.0 from identical `boot-0b.R` (same script, same `set.seed(20260620)`):

- **CB-SEM mediation** (lavaan): `PoliticalDemocracy` latent-variable mediation model (ind60 → dem60 → dem65), `se="bootstrap", bootstrap=5000`, `parameterEstimates(boot.ci.type='perc')`. Note: 1989/5000 bootstrap runs hit nonadmissible solutions (expected — n=75, near-singular model); lavaan still returns percentile CIs from valid runs.
- **PLS-SEM** (seminr): `mobi` dataset, 3-construct composite model (Image → Expectation → Satisfaction), `bootstrap_model(nboot=5000, cores=1)`, `summary(alpha=0.05)` percentile CIs.

Both tracks use: `MAKECLUSTER_SHIM` + `DETECTCORES` shim applied before `source()` in WebR path (serial fallback for `bootstrap_model`'s mandatory PSOCK cluster).

---

## Model note: PoliticalDemocracy requires full latent-variable specification

The brief's `med.model` used `dem60`/`dem65`/`ind60` as if they were manifest variables, but `PoliticalDemocracy` only has `y1–y8`, `x1–x3`. The script was corrected to include the full measurement model (`=~` equations) so `dem60`, `dem65`, `ind60` are properly specified as latent variables. This is the standard lavaan CFA+structural setup for this dataset. The parity gate (`set.seed` fixed, identical script) is unaffected by this correction — both runtimes run the same corrected script.

---

## Parity verdict

```
diff /tmp/0b-n.txt /tmp/0b-w.txt && echo "PARITY-OK" || echo "PARITY-DIFF"
PARITY-OK
```

All `cb_indirect_*` and `pls_path_*` value lines are **byte-identical** native vs WebR. Percentile CIs confirmed: `boot.ci.type='perc'` (lavaan) and seminr `2.5%/97.5%` CI columns.

**CB-SEM indirect effect:**
```
cb_indirect_est= 1.27389402
cb_indirect_se=0.3534090507
cb_indirect_ci=0.5978353932,1.970782841
cb_indirect_p=0.000312648513
```

**PLS-SEM paths:**
```
pls_path_beta=0.5094926161,0.5841360327,0.2167036508
pls_path_ci_low=0.4065124661,0.496770106,0.08674555376
pls_path_ci_high=0.6308953925,0.6878765933,0.3326619231
```

---

## Timing

| | Native R 4.6.0 | WebR 0.6.0 (WASM) | WASM / native |
|---|---|---|---|
| CB-SEM 5000 bootstrap | 37.27 s | 152.41 s | 4.09× |
| PLS-SEM 5000 bootstrap | 23.43 s | 162.67 s | 6.94× |
| WebR total run (both) | — | 315.8 s (5.26 min) | — |
| WebR wall-clock incl. install | — | 372.0 s (6.20 min) | — |

**Per-resample WASM time (feeds `estMs`):**
- CB-SEM: 152.41 s / 5000 = **~30.5 ms per resample**
- PLS-SEM: 162.67 s / 5000 = **~32.5 ms per resample**

Native R was far faster than the spike-extrapolation estimate (~2.7 min CB / ~8.5 min PLS) because native R uses multiple cores and the prior spike had smaller n/B. WASM runs serial/single-core and scales linearly.

**Progress-bar calibration (5k default):** ~2.5 min CB-SEM, ~2.7 min PLS-SEM. Combined (if sequential): ~5.3 min. This is within user-tolerable range for a single-call result; a progress indicator is still warranted.

---

## Success bar assessment

| Criterion | Result |
|---|---|
| Both 5000-resample bootstraps complete in WebR in a single awaited call (no OOM, no socket error) | PASS |
| Non-timing value lines byte-identical native vs WebR under shared `set.seed` | PASS (PARITY-OK) |
| Percentile CIs confirmed (`boot.ci.type='perc'` / seminr `2.5%/97.5%`) | PASS |
| WASM cost lands in spike-extrapolated envelope (CB ~2.7 min, PLS ~8.5 min) | RECORDED (CB: 2.54 min, PLS: 2.71 min — both faster than envelope; envelope was overestimated) |

**All success-bar criteria MET. No fallback triggered.**

---

## Implication for Unit 6/7 wiring

- Both tracks confirmed for single-call 5000-resample at production default.
- `boot.ci.type='perc'` for lavaan `parameterEstimates()` is the confirmed CI type; seminr percentile via `summary(alpha=0.05)` columns `"2.5% CI"` / `"97.5% CI"`.
- `estMs` calibration: use ~30 ms/resample for CB-SEM and ~33 ms/resample for PLS-SEM for the results-screen progress estimate.
- The `MAKECLUSTER_SHIM` + serial `parLapply` shim (from `parallelShim.ts`) is confirmed necessary and sufficient for seminr bootstrap in WebR.
- 10k opt-in boot is not tested here but scales linearly: ~5 min CB, ~5.4 min PLS (single call, no chunking).
