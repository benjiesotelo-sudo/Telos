# ANOVA Family Spike Report — verdicts and known answers

Date: 2026-06-12. Fixture: /tmp/anova-spike/fixture.csv (seeded, shared by all engines).
Engines: native R 4.6.0 (macOS arm64, ground truth) vs webr 0.6.0 (R 4.6 WASM, Node) in two
configurations — base-R-only (webr-base.json) and full package set (webr-pkgs.json).
Tolerance: |a-b| <= max(1e-9, 1e-6*max(|a|,|b|)). All comparisons by script
(/tmp/anova-spike/compare.mjs).

## Verdicts (spec section 5 decision gates)

### Gate 1 — afex under WebR (spec fix 1): PASS
- afex 1.5.1 installs AND loads under webr 0.6.0 (requires a one-line
  `parallel::detectCores` shim — unlockBinding/assign 1L/lockBinding — applied before
  `library(afex)`; afterwards all four afex blocks fit in ~1s total, no slowdown).
- Reproduces every native known answer within 1e-9 relative: Mauchly W (rm 0.873515789948938,
  mixed 0.803590686765588), GG eps (rm 0.88771772482694, mixed 0.835834349447321), HF eps
  (rm 0.913297705282412), and partial eta-squared via `anova_table(es = "pes")` for
  factorial, rm, and mixed — all match.
- Consequence: NO fallback to hand-rolled aov+Mauchly/GG/HF needed. Implementation path:
  afex::aov_ez for factorial / RM / mixed, exactly as the cards draw.

### Gate 2 — post-hoc sourcing ladder (spec fix 3): verdict per procedure
Ladder tried in spec order PMCMRplus -> rstatix/FSA -> hand-rolled. PMCMRplus installs in
webr but CANNOT LOAD: its hard Import Rmpfr has no wasm binary on repo.r-wasm.org (R 4.6
contrib). PMCMRplus is therefore unusable in webr for every procedure and falls off the
ladder entirely.

| Procedure | Winning source in webr | Evidence |
|---|---|---|
| Tukey HSD | base `stats::TukeyHSD` (no package needed) | tukey_diff/lo/hi/p match native; emmeans Tukey also cross-checked (addendum) |
| Bonferroni | base `pairwise.t.test` | bonf_p = 1 matches native |
| Scheffe | `emmeans` (pairs, adjust="scheffe") | scheffe_p 0.842874697999946 matches; NOT computable in base (no emmeans) |
| Games-Howell | `rstatix::games_howell_test` | gh_diff 1.37 / gh_p 0.82 match native exactly — CAVEAT: rstatix rounds estimate/p.adj columns; both engines show identical rounded values; hand-roll in BOTH engines later if full precision is ever needed |
| Dunn | `rstatix::dunn_test` (hand-rolled base version also exact) | dunn_z 0.588572301903464, holm 0.556148218919164, bonf 1 — both rstatix-in-webr and the hand-rolled base implementation match native to 1e-9 |
| Nemenyi (Friedman) | HAND-ROLLED (bottom rung) | PMCMRplus unloadable; rstatix/FSA offer no Friedman-Nemenyi. Formula q=(Rbar_t2-Rbar_t1)/sqrt(k(k+1)/(6n)), p=ptukey(|q|*sqrt(2), 3, Inf, lower=FALSE) reproduces native PMCMRplus 1.9.12 value exactly: 2.83863931227479e-05 |

Ship list implied: emmeans + rstatix (+ afex per Gate 1); drop PMCMRplus and FSA (FSA adds an
85-pkg / 86.7 MiB closure for nothing the ladder needs — rstatix covers Dunn).

### Gate 3 — size gate (spec fix 7): PASS for the only shippable artifact form
- Artifact form fact: for R 4.6 contrib, repo.r-wasm.org serves ONLY per-package emscripten
  .tgz binaries (per-package .data VFS images return 403). Self-hosting means hosting .tgz
  files; the Cloudflare 25 MiB hard limit therefore applies to the .tgz files.
- Every hosted .tgz is under 25 MiB. Largest: stringi_1.8.7.tgz at 13.43 MiB. over25MiBTgz = [].
- The literal decompressed measurement DOES flag one file: stringi/libs/icudt74l.dat at
  29.36 MiB. This breaches 25 MiB only if shipped uncompressed (a single combined VFS
  library .data image) — a route also ruled out by its 164.64 MiB total. Per the spec's
  ejection rule, the uncompressed-VFS-image option is ejected; the .tgz route passes clean.
- Union closure of all 5 viable candidates: 100 packages, 104.98 MiB tgz / 164.64 MiB
  decompressed. Cheap subset: emmeans closure 3.56 MiB (5 pkgs), effectsize 7.29 MiB (6 pkgs);
  afex 81.0 MiB (70) and rstatix 80.4 MiB (68) overlap heavily (shared car/lme4/Matrix/
  tidyverse/stringi chains), so the incremental cost of the second is far below standalone.
- Note: the app already runtime-installs ggplot2/effectsize/coin/psych/janitor/nortest from
  the network (src/lib/webr/engine.ts:38), so part of the union is paid today, just not
  self-hosted.

### PMCMRplus availability (spec fixes 1/3 ladder input): FAIL in webr
Indexed on the repo, installs, but loadNamespace fails ("there is no package called 'Rmpfr'").
Rmpfr (MPFR C library) is absent from bin/emscripten/contrib/4.6. Native PMCMRplus 1.9.12 was
still used to generate the Nemenyi ground truth, and note the native gotcha: the matrix
interface `frdAllPairsNemenyiTest(mat)` THROWS for this fixture; the long-format signature
(y=, groups=, blocks=) works.

## Numeric cross-check: full comparison table

110 native keys; 117 comparisons (7 keys independently computed by both webr configurations);
0 mismatches; 0 coverage gaps. Engine column: "base" = webr base-R-only, "pkgs" = webr with
packages (extras blocks mapped back onto their native tests: onew_extras->onew,
welch_extras->welch, kw_extras->kw with eps2_effectsize->eps2, fr_extras->fr).

| Key | Native R 4.6.0 | WebR | Engine | Status |
|---|---|---|---|---|
| onew.F | 2.80500665877123 | 2.80500665877123 | base | match |
| onew.df1 | 2 | 2 | base | match |
| onew.df2 | 57 | 57 | base | match |
| onew.p | 0.0688787403297547 | 0.0688787403297548 | base | match |
| onew.eta2 | 0.0896024935993843 | 0.0896024935993842 | base | match |
| onew.levene_F | 0.0224210736545674 | 0.0224210736545672 | base | match |
| onew.levene_p | 0.977837029926746 | 0.977837029926746 | base | match |
| onew.tukey_diff | 1.37 | 1.37 | base | match |
| onew.tukey_lo | -4.25998369176902 | -4.25998369176875 | base | match |
| onew.tukey_hi | 6.99998369176903 | 6.99998369176876 | base | match |
| onew.tukey_p | 0.828376280197589 | 0.828376280197587 | base | match |
| onew.bonf_p | 1 | 1 | base | match |
| welch.F | 2.57990466333335 | 2.57990466333335 | base | match |
| welch.df1 | 2 | 2 | base | match |
| welch.df2 | 37.9023295774865 | 37.9023295774865 | base | match |
| welch.p | 0.0890313047549131 | 0.0890313047549131 | base | match |
| nested.F_school | 1.4799504544885 | 1.4799504544885 | base | match |
| nested.df1_school | 2 | 2 | base | match |
| nested.df2_school | 3 | 3 | base | match |
| nested.p_school | 0.357127524540067 | 0.357127524540067 | base | match |
| nested.F_class | 1.99454911069684 | 1.99454911069684 | base | match |
| nested.df1_class | 3 | 3 | base | match |
| nested.df2_class | 54 | 54 | base | match |
| nested.p_class | 0.12570562659026 | 0.125705626590261 | base | match |
| nested.omega2_school | 0.0417183289096631 | 0.0417183289096631 | base | match |
| manova.pillai | 0.285431562210818 | 0.285431562210818 | base | match |
| manova.pillai_F | 4.74451724627428 | 4.74451724627427 | base | match |
| manova.pillai_df1 | 4 | 4 | base | match |
| manova.pillai_df2 | 114 | 114 | base | match |
| manova.pillai_p | 0.00140868628003122 | 0.00140868628003124 | base | match |
| manova.wilks | 0.715289868403666 | 0.715289868403666 | base | match |
| manova.wilks_F | 5.10678393890843 | 5.10678393890843 | base | match |
| manova.wilks_p | 0.000811876083019458 | 0.000811876083019466 | base | match |
| manova.fu_outcome_F | 2.80500665877123 | 2.80500665877123 | base | match |
| manova.fu_outcome_p | 0.0688787403297547 | 0.0688787403297548 | base | match |
| manova.fu_outcome_pes | 0.0896024935993843 | 0.0896024935993842 | base | match |
| manova.fu_outcome2_F | 7.71055236740481 | 7.71055236740481 | base | match |
| manova.fu_outcome2_p | 0.00108711814052799 | 0.00108711814052799 | base | match |
| mancova.pillai_group | 0.367525003974141 | 0.367525003974142 | base | match |
| mancova.pillai_F_group | 6.30374133529023 | 6.30374133529023 | base | match |
| mancova.pillai_p_group | 0.000130150921618041 | 0.00013015092161804 | base | match |
| mancova.wilks_group | 0.634151614316368 | 0.634151614316368 | base | match |
| mancova.fu_outcome_F_group | 8.0678942699764 | 8.0678942699764 | base | match |
| mancova.fu_outcome_p_group | 0.000833763379568619 | 0.000833763379568622 | base | match |
| kw.H | 6.56495733622387 | 6.56495733622387 | base | match |
| kw.df | 2 | 2 | base | match |
| kw.p | 0.0375351043416359 | 0.0375351043416359 | base | match |
| kw.eps2 | 0.111270463325828 | 0.111270463325828 | base | match |
| kw.meanrank_control | 24.9 | 24.9 | base | match |
| kw.meanrank_drug_a | 28.15 | 28.15 | base | match |
| kw.meanrank_drug_b | 38.45 | 38.45 | base | match |
| kw.dunn_z | 0.588572301903464 | 0.588572301903464 | base | match |
| kw.dunn_p_holm | 0.556148218919164 | 0.556148218919164 | base | match |
| kw.dunn_p_bonf | 1 | 1 | base | match |
| fr.chi2 | 67.1882845188285 | 67.1882845188285 | base | match |
| fr.df | 2 | 2 | base | match |
| fr.p | 2.57187224967219e-15 | 2.57187224967219e-15 | base | match |
| fr.kendall_w | 0.559902370990237 | 0.559902370990237 | base | match |
| fr.nemenyi_p | 0.0000283863931227479 | 0.0000283863931227479 | base | match |
| fact.F_group | 3.04188224848381 | 3.04188224848381 | pkgs | match |
| fact.p_group | 0.0560001080368759 | 0.0560001080368759 | pkgs | match |
| fact.pes_group | 0.101254715777249 | 0.101254715777249 | pkgs | match |
| fact.F_gender | 2.84368260584025 | 2.84368260584025 | pkgs | match |
| fact.p_gender | 0.097503832286258 | 0.097503832286258 | pkgs | match |
| fact.pes_gender | 0.050026361338315 | 0.050026361338315 | pkgs | match |
| fact.F_int | 2.48491031233834 | 2.48491031233834 | pkgs | match |
| fact.p_int | 0.0928168303408816 | 0.0928168303408816 | pkgs | match |
| fact.pes_int | 0.0842773569943164 | 0.0842773569943164 | pkgs | match |
| fact.se_est | -3.55000000000001 | -3.55000000000001 | pkgs | match |
| fact.se_p | 0.806399369392838 | 0.80639936939284 | pkgs | match |
| rm.F_unc | 78.5112991613406 | 78.5112991613406 | pkgs | match |
| rm.df1_unc | 2 | 2 | pkgs | match |
| rm.df2_unc | 118 | 118 | pkgs | match |
| rm.p_unc | 2.08115277471139e-22 | 2.08115277471139e-22 | pkgs | match |
| rm.p_gg | 3.57330988681511e-20 | 3.57330988681496e-20 | pkgs | match |
| rm.mauchly_W | 0.873515789948938 | 0.873515789948942 | pkgs | match |
| rm.mauchly_p | 0.0198085203154266 | 0.0198085203154286 | pkgs | match |
| rm.gg_eps | 0.88771772482694 | 0.887717724826941 | pkgs | match |
| rm.hf_eps | 0.913297705282412 | 0.913297705282413 | pkgs | match |
| rm.pes | 0.570944348865645 | 0.570944348865645 | pkgs | match |
| rm.ph_diff | -2.86333333333332 | -2.86333333333332 | pkgs | match |
| rm.ph_se | 0.419866582701343 | 0.419866582701343 | pkgs | match |
| rm.ph_p | 1.63816152413875e-8 | 1.63816152413876e-8 | pkgs | match |
| mixed.F_group | 0.24690089648661 | 0.24690089648661 | pkgs | match |
| mixed.p_group | 0.782049251682351 | 0.782049251682351 | pkgs | match |
| mixed.pes_group | 0.00858878309615581 | 0.00858878309615581 | pkgs | match |
| mixed.F_cond | 82.5610819498742 | 82.5610819498742 | pkgs | match |
| mixed.p_cond_gg | 1.51705412973608e-19 | 1.51705412973602e-19 | pkgs | match |
| mixed.pes_cond | 0.591576683100862 | 0.591576683100862 | pkgs | match |
| mixed.F_int | 2.52167386781147 | 2.52167386781147 | pkgs | match |
| mixed.p_int_gg | 0.0561473099306867 | 0.0561473099306866 | pkgs | match |
| mixed.pes_int | 0.0812874855998016 | 0.0812874855998017 | pkgs | match |
| mixed.mauchly_W | 0.803590686765588 | 0.80359068676559 | pkgs | match |
| mixed.mauchly_p | 0.00219268908877968 | 0.00219268908877978 | pkgs | match |
| mixed.gg_eps | 0.835834349447321 | 0.835834349447321 | pkgs | match |
| mixed.ph_diff | -2.86333333333332 | -2.86333333333332 | pkgs | match |
| mixed.ph_p | 1.9397562305748e-8 | 1.93975623057476e-8 | pkgs | match |
| ancova.F_cov | 68.7128748021634 | 68.7128748021634 | pkgs | match |
| ancova.p_cov | 2.58930788888578e-11 | 2.58930788888579e-11 | pkgs | match |
| ancova.F_group | 8.0678942699764 | 8.0678942699764 | pkgs | match |
| ancova.p_group | 0.000833763379568619 | 0.000833763379568619 | pkgs | match |
| ancova.pes_group | 0.223686312530096 | 0.223686312530096 | pkgs | match |
| ancova.adjmean_control | 31.4221627207434 | 31.4221627207434 | pkgs | match |
| ancova.adjse_control | 1.10991244962393 | 1.10991244962393 | pkgs | match |
| ancova.slopes_int_p | 0.87502194014733 | 0.87502194014733 | pkgs | match |
| ancova.ph_adj_diff | -3.59989132599919 | -3.59989132599919 | pkgs | match |
| ancova.ph_adj_p | 0.0675916797250294 | 0.0675916797250287 | pkgs | match |
| onew.scheffe_p | 0.842874697999946 | 0.842874697999946 | pkgs | match |
| onew.levene_F | 0.0224210736545674 | 0.0224210736545673 | pkgs | match |
| onew.levene_p | 0.977837029926746 | 0.977837029926746 | pkgs | match |
| welch.gh_diff | 1.37 | 1.37 | pkgs | match |
| welch.gh_p | 0.82 | 0.82 | pkgs | match |
| kw.dunn_z | 0.588572301903464 | 0.588572301903464 | pkgs | match |
| kw.dunn_p_holm | 0.556148218919164 | 0.556148218919164 | pkgs | match |
| kw.dunn_p_bonf | 1 | 1 | pkgs | match |
| kw.eps2 | 0.111270463325828 | 0.111270463325828 | pkgs | match |
| fr.nemenyi_p | 0.0000283863931227479 | 0.0000283863931227479 | pkgs | match |

### Coverage gaps
None. Every key in native.json has at least one webr counterpart. (Within a single engine:
webr-base alone omits scheffe_p / gh_diff / gh_p and the four afex tests by design; webr-pkgs
covers all of those. The union is complete.)

### Mismatches
None. Max observed relative difference < 1e-9 on all shared keys.

## Package versions

| Package | Version | Native R 4.6.0 | webr 0.6.0 |
|---|---|---|---|
| car | 3.1.5 | works | installs + loads |
| afex | 1.5.1 | works | installs + loads (detectCores shim) |
| emmeans | 2.0.3 | works | installs + loads |
| rstatix | 0.7.3 | works | installs + loads |
| FSA | 0.10.1 | works | installs + loads |
| PMCMRplus | 1.9.12 | works (long-format Nemenyi call only) | installs, FAILS to load (Rmpfr missing) |
| effectsize | 1.0.2 | works | installs + loads |
| jsonlite | 2.0.0 | works | installs + loads |

## Implementation gotchas to carry into the plan
1. `summary.aov` rownames carry trailing whitespace ("school           "); index after
   `trimws(rownames(s))` or partial matching returns NA (bit both native and base agents;
   not WebR-specific).
2. `c(name = namedScalar)` produces compound names ("da_c.drug_a") — `unname()` scalars
   before naming.
3. Multi-statement R for webr's `evalRString` must be wrapped in `{ }`.
4. webr install+compute must run in ONE session (in-memory WASM FS). Install wall time ~130s
   cold / ~56s warm.
5. emmeans labels the rm/mixed condition contrast "t1 - t2" (factor order); record the
   estimate with emmeans' sign => ph_diff is NEGATIVE (-2.8633...).
6. ancova/mancova are SEQUENTIAL (covariate first: outcome ~ baseline + group); fact/rm/mixed
   are afex Type III; nested F_school = MS_school/MS_class (random nesting), omega2 components
   clamped at 0.

## PLAN FACTS — known-answer targets to embed (native R 4.6.0 ground truth, full precision, webr-verified to <=1e-9 relative)

### one-way (onew)
| Key | Value |
| F | 2.80500665877123 |
| df1 | 2 |
| df2 | 57 |
| p | 0.0688787403297547 |
| eta2 | 0.0896024935993843 |
| tukey_p | 0.828376280197589 |

### welch
| Key | Value |
| F | 2.57990466333335 |
| df1 | 2 |
| df2 | 37.9023295774865 |
| p | 0.0890313047549131 |

### factorial (fact)
| Key | Value |
| F_group | 3.04188224848381 |
| p_group | 0.0560001080368759 |
| pes_group | 0.101254715777249 |
| F_gender | 2.84368260584025 |
| p_gender | 0.097503832286258 |
| pes_gender | 0.050026361338315 |
| F_int | 2.48491031233834 |
| p_int | 0.0928168303408816 |
| pes_int | 0.0842773569943164 |
| se_p | 0.806399369392838 |

### repeated-measures (rm) — all keys
| Key | Value |
| F_unc | 78.5112991613406 |
| df1_unc | 2 |
| df2_unc | 118 |
| p_unc | 2.08115277471139e-22 |
| p_gg | 3.57330988681511e-20 |
| mauchly_W | 0.873515789948938 |
| mauchly_p | 0.0198085203154266 |
| gg_eps | 0.88771772482694 |
| hf_eps | 0.913297705282412 |
| pes | 0.570944348865645 |
| ph_diff | -2.86333333333332 |
| ph_se | 0.419866582701343 |
| ph_p | 1.63816152413875e-8 |

### mixed — all keys
| Key | Value |
| F_group | 0.24690089648661 |
| p_group | 0.782049251682351 |
| pes_group | 0.00858878309615581 |
| F_cond | 82.5610819498742 |
| p_cond_gg | 1.51705412973608e-19 |
| pes_cond | 0.591576683100862 |
| F_int | 2.52167386781147 |
| p_int_gg | 0.0561473099306867 |
| pes_int | 0.0812874855998016 |
| mauchly_W | 0.803590686765588 |
| mauchly_p | 0.00219268908877968 |
| gg_eps | 0.835834349447321 |
| ph_diff | -2.86333333333332 |
| ph_p | 1.9397562305748e-8 |

### nested — all keys
| Key | Value |
| F_school | 1.4799504544885 |
| df1_school | 2 |
| df2_school | 3 |
| p_school | 0.357127524540067 |
| F_class | 1.99454911069684 |
| df1_class | 3 |
| df2_class | 54 |
| p_class | 0.12570562659026 |
| omega2_school | 0.0417183289096631 |

### ancova — all keys
| Key | Value |
| F_cov | 68.7128748021634 |
| p_cov | 2.58930788888578e-11 |
| F_group | 8.0678942699764 |
| p_group | 0.000833763379568619 |
| pes_group | 0.223686312530096 |
| adjmean_control | 31.4221627207434 |
| adjse_control | 1.10991244962393 |
| slopes_int_p | 0.87502194014733 |
| ph_adj_diff | -3.59989132599919 |
| ph_adj_p | 0.0675916797250294 |

### manova — Pillai/Wilks/F/p + follow-ups
| Key | Value |
| pillai | 0.285431562210818 |
| pillai_F | 4.74451724627428 |
| pillai_df1 | 4 |
| pillai_df2 | 114 |
| pillai_p | 0.00140868628003122 |
| wilks | 0.715289868403666 |
| wilks_F | 5.10678393890843 |
| wilks_p | 0.000811876083019458 |
| fu_outcome_F | 2.80500665877123 |
| fu_outcome_p | 0.0688787403297547 |
| fu_outcome_pes | 0.0896024935993843 |
| fu_outcome2_F | 7.71055236740481 |
| fu_outcome2_p | 0.00108711814052799 |

### mancova — group rows
| Key | Value |
| pillai_group | 0.367525003974141 |
| pillai_F_group | 6.30374133529023 |
| pillai_p_group | 0.000130150921618041 |
| wilks_group | 0.634151614316368 |
| fu_outcome_F_group | 8.0678942699764 |
| fu_outcome_p_group | 0.000833763379568619 |

### kruskal-wallis (kw) — all keys
| Key | Value |
| H | 6.56495733622387 |
| df | 2 |
| p | 0.0375351043416359 |
| eps2 | 0.111270463325828 |
| meanrank_control | 24.9 |
| meanrank_drug_a | 28.15 |
| meanrank_drug_b | 38.45 |
| dunn_z | 0.588572301903464 |
| dunn_p_holm | 0.556148218919164 |
| dunn_p_bonf | 1 |

### friedman (fr) — all keys
| Key | Value |
| chi2 | 67.1882845188285 |
| df | 2 |
| p | 2.57187224967219e-15 |
| kendall_w | 0.559902370990237 |
| nemenyi_p | 0.0000283863931227479 |

Supplementary full-precision values (other pairs, CIs, SEs) are in
/tmp/anova-spike/native-addendum.json and native-addendum2.json; provenance and recipe notes
in /tmp/anova-spike/native-notes.md.
