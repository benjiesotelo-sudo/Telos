# Association Slice Spike Report — WebR ≡ native R + package verdicts

Date: 2026-06-12. Fixture: /tmp/assoc-spike/fixture.csv (set.seed(42), n=40, RNG draw order fixed; see fixture.R).
Engines: native R 4.6.0 (macOS arm64, ground truth; effectsize 1.0.2 + rcompanion 2.5.2 in /tmp/assoc-spike/Rlib)
vs webr 0.6.0 (R 4.6 WASM, Node, repo node_modules). ONE shared battery (battery.R) sourced verbatim by both.
Tolerance: |a-b| <= max(1e-9, 1e-6*max(|a|,|b|)) via compare.mjs (full output: compare-output.txt).

## Verdict table — WebR ≡ native per test

| Battery section | Keys | Result |
|---|---|---|
| 1. Pearson (r, t, df, p, 90/95/99% CIs, one-sided) | 11 | PASS — all match |
| 2. Spearman exact=FALSE (continuous + tied ordinal) | 6 | PASS — all match |
| 3. Kendall exact=FALSE (continuous + tied ordinal) | 8 | PASS — all match (incl. statistic names) |
| 4. GoF chi-sq (equal + custom p, stdres, Cohen's w) | 16 | PASS — all match |
| 5. Independence chi-sq + Cramer's V (2x2 Yates/uncorrected, 3x2) | 14 webr / 16 native | PASS on all shared keys; 2 rcompanion keys intentionally absent from webr (see verdict) |
| 6. Fisher exact (2x2 two/one-sided + OR/CI, 3x3 p) | 7 | PASS — all match |

**61 keys compared; 0 mismatches; 2 one-sided keys (both = ind*_V_rcompanion, dropped from webr by design).**

## Verdict 1 — rcompanion under webr 0.6.0: INSTALLS BUT CANNOT LOAD. DO NOT SHIP.

- `installPackages(['rcompanion'])` "succeeds" in 55.1 s, pulling a 65-package / **53.65 MiB** tgz closure
  (every tgz sized from the repo.r-wasm.org PACKAGES index; delta measured by installed.packages()
  before/after on a session that had only effectsize pre-installed — app-incremental would be smaller
  since coin/nortest etc. are already in the engine's list, but it's moot).
- `library(rcompanion)` then FAILS: `there is no package called 'rootSolve'`. rootSolve (a DescTools hard
  dep) is entirely absent from repo.r-wasm.org bin/emscripten/contrib/4.6 — the exact PMCMRplus/Rmpfr
  lesson: install succeeds while a wasm-less binary dep breaks loadNamespace.
- **Consequence: hand-formula Cramer's V is the implementation in BOTH engines.** The webr JSON drops
  `ind22_V_rcompanion` / `ind32_V_rcompanion`; the hand keys match native to 1e-9.
- **Which chi-sq does rcompanion's default correspond to? The UNCORRECTED one.** Native full precision:
  `cramerV(t22)` = 0.3504383 = sqrt(chisq_uncorrected/N) = ind22_V_hand_unc (corrected gives 0.3003757 —
  no match). `cramerV(t32)` = 0.3501256 = ind32_V_hand. Note cramerV prints 4-decimal-rounded by default
  (0.3504 / 0.3501 in native.json); raise `digits=` for full precision. So the hand implementation
  `V = sqrt(chisq.test(tab, correct=FALSE)$statistic / (N * min(r-1, c-1)))` reproduces rcompanion's
  default convention exactly.

## Verdict 2 — effectsize::cohens_w with custom p: WORKS, IDENTICAL, EQUALS HAND VALUE

- Exact call used: `effectsize::cohens_w(tab, p = c(0.5, 0.3, 0.2))$Cohens_w` (p in alphabetical category
  order alpha/beta/gamma; equal-p call is `effectsize::cohens_w(tab)$Cohens_w`). The API accepts specified
  proportions directly.
- gof_cust_w = 0.224072161 in native AND webr, and equals the hand value sqrt(chisq/N) =
  sqrt(2.008333333/40) = 0.224072161 (gof_cust_w_hand). effectsize 1.0.2 applies no extra normalization
  for non-uniform p at these values.

## Verdict 3 — Kendall statistic name on the exact=FALSE path: "z" CONFIRMED

`names(ct$statistic)` is `"z"` in BOTH engines for BOTH the continuous (x,y) and tied (ord1,ord2) runs
(keys kendall_cont_statname / kendall_tied_statname, string-compared). Spearman's statistic is S as usual.

## Known answers (native R 4.6.0 ground truth = webr values; implementation test targets)

Full machine-readable values: native.json / webr.json (10 sig digits via .telos_json).

| Key | Value | | Key | Value |
|---|---|---|---|---|
| pearson_r | 0.7016484693 | | gof_eq_chisq | 0.95 |
| pearson_t | 6.070330284 | | gof_eq_df | 2 |
| pearson_df | 38 | | gof_eq_p | 0.6218850565 |
| pearson_p | 4.558820127e-07 | | gof_eq_stdres_alpha | 0.894427191 |
| pearson_ci95_lo | 0.4992630807 | | gof_eq_stdres_beta | -0.1118033989 |
| pearson_ci95_hi | 0.8314317357 | | gof_eq_stdres_gamma | -0.7826237921 |
| pearson_ci90_lo | 0.5371405653 | | gof_eq_w | 0.1541103501 |
| pearson_ci90_hi | 0.8147345573 | | gof_cust_chisq | 2.008333333 |
| pearson_ci99_lo | 0.4194928684 | | gof_cust_df | 2 |
| pearson_ci99_hi | 0.8601715632 | | gof_cust_p | 0.3663497991 |
| pearson_p_greater | 2.279410064e-07 | | gof_cust_stdres_alpha | -1.264911064 |
| spearman_cont_rho | 0.6549233014 | | gof_cust_stdres_beta | 0.3450327797 |
| spearman_cont_S | 3678.517607 | | gof_cust_stdres_gamma | 1.185854123 |
| spearman_cont_p | 4.536450066e-06 | | gof_cust_w | 0.224072161 |
| spearman_tied_rho | 0.8468402828 | | gof_cust_w_hand | 0.224072161 |
| spearman_tied_S | 1632.682586 | | ind22_corr_chisq | 3.609022556 |
| spearman_tied_p | 5.716192287e-12 | | ind22_corr_df | 1 |
| kendall_cont_tau | 0.4688504499 | | ind22_corr_p | 0.05746688583 |
| kendall_cont_z | 4.253493058 | | ind22_unc_chisq | 4.912280702 |
| kendall_cont_p | 2.104614657e-05 | | ind22_unc_p | 0.02666640835 |
| kendall_tied_tau | 0.7490683239 | | ind22_V_hand_unc | 0.350438322 |
| kendall_tied_z | 5.708916072 | | ind22_V_hand_corr | 0.3003757046 |
| kendall_tied_p | 1.136979369e-08 | | ind22_V_rcompanion (native only) | 0.3504 (rounded) |
| fish22_p | 0.05616092643 | | ind32_chisq | 4.903517535 |
| fish22_or | 4.163405972 | | ind32_df | 2 |
| fish22_ci_lo | 0.9694478355 | | ind32_p | 0.08614194953 |
| fish22_ci_hi | 20.18251251 | | ind32_V_hand | 0.3501256037 |
| fish22_p_greater | 0.02808046322 | | ind32_V_rcompanion (native only) | 0.3501 (rounded) |
| fish22_p_less | 0.9948066489 | | ind32_minExpected | 5.225 |
| fish33_p | 0.5354022782 | | | |

## Notes / surprises

- min(r-1, c-1) = 1 for BOTH the 2x2 and the 3x2 tables here, so every V is sqrt(chisq/N); a future
  fixture with min dim - 1 = 2 (e.g. 3x3) would exercise the denominator — fish33's t33 exists but its V
  wasn't in scope.
- ind32_minExpected = 5.225 (> 5): the 3x2 chi-sq is approximation-safe on this fixture; chisq.test calls
  are wrapped in suppressWarnings anyway for engine parity.
- chisq.test default applies Yates ONLY to 2x2 (ind32 is uncorrected by construction).
- rcompanion install-vs-load: a third confirmed case (after PMCMRplus/Rmpfr) that webr installPackages
  success is NOT evidence of loadability — always gate on `library()`.
- webr first-init + package downloads ~2 min total in Node (no cache); the battery itself runs in <1 s.

## Artifacts

fixture.R, fixture.csv, battery.R, run-native.R, run-webr.mjs, compare.mjs, native.json, webr.json,
webr-meta.json (rcompanion install timing/closure), compare-output.txt — all in /tmp/assoc-spike/.
Native package lib: /tmp/assoc-spike/Rlib (effectsize 1.0.2, rcompanion 2.5.2 + deps).
