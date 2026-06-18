# Reporting-completeness pass — ratify list (2026-06-17)

Built per the approved spec (`specs/2026-06-17-reporting-completeness-apa7-design.md`) + plan
(`plans/2026-06-17-reporting-completeness-apa7.md`), subagent-driven on local `main`.
**Nothing pushed, nothing deployed** — stops at your click-through. Every new value was native-R-verified
under WebR (the Task-1 spike recorded ground truth; each card's stats test asserts it).

## What landed (the standard, applied)

- **Coefficient tables (13)** → `modelsummary` (Arel-Bundock) — UNCHANGED.
- **Descriptive tables** → Arel-Bundock `datasummary` (Summary stats, Frequencies; export emits `datasummary_*()`).
- **Inferential tables** → APA-7 structure, now with the APA-7 completeness pieces filled in.
- **Cross-cutting APA-7 principles** enforced; **econometrics methods cited**; **computational provenance** surfaced.

| Theme | What | Commit |
|---|---|---|
| 1 — effect-size CIs | CI on ~18 cards (Cohen's d/dz, rank-biserial r, η²/ω²/ε²/W, Cohen's w, Cramér's V; bootstrap ρ/τ; independent-t re-impl) | `44b9964` (+ ref `c7ae540`) |
| 2 — assumptions | paired-t Shapiro on diffs; mixed-ANOVA Levene rendered; within-group normality (independent-t, Welch); Box's M (MANOVA/MANCOVA); nested-ANOVA descriptives + Levene + Shapiro | `569781d` |
| 3 — econ diagnostics | ARIMA Ljung-Box spec; RDD bandwidth/kernel/cutoff + McCrary; stationarity PP in APA; Granger lag note; VAR Portmanteau; PSM common-support; DiD pre-trends | `58cc6f4` |
| 4A — render/completeness | FE/DiD F(df,df),p; Wilcoxon V/W + Hodges-Lehmann; logistic copy fix; MWU/KW medians+IQR; RE BP-LM + θ; Kendall tau-b; Fisher conditional-MLE OR + Cramér's V; χ² per-cell residuals | `f49…`/4A commit |
| 4B — descriptive datasummary | Summary mean-CI + "Kurtosis (excess)"; Frequencies Valid%/Total%+Missing; Distribution-normality skew/kurtosis; export emits `datasummary_skim/crosstab` | 4B commit |
| Provenance | `CITATIONS.txt` in the export bundle; per-card Method reference on the 11 econ cards | provenance commit |
| Backbone | `heplots` + `rddensity` preloaded (spike-confirmed) | `5cf83ab` |

## Decisions for you to ratify

1. **Task 16b is DONE (Option B), committed `e08f82b` on local `main` — not pushed.** After you confirmed the
   `datasummary` look on Summary stats / Frequencies, I surfaced a renderer constraint before building: a faithful
   *transposed* `datasummary_balance` "Table 1" (group names as spanning headers over Mean/Std.Dev. sub-columns)
   needs two-tier spanning column headers, which `ApaTable` doesn't have — that would be a **shared-renderer
   feature** touching all 40 cards, not the cosmetic restyle 16b assumed; and for these single-outcome
   between-group tables the transpose collapses to a thin 1-row table. You ruled **Option B**: emit the real R
   call + relabel the on-screen columns, **NO renderer change, stats unchanged.**
   - **Display:** on the 5 in-scope descriptives tables, `M → "Mean"`, `SD → "Std. Dev."` (datasummary's
     vocabulary); N kept; the clean group-rows layout kept. Registry label + HTML thead mirror; consistency green.
   - **Export:** `analysis.R` now emits the citable `datasummary_balance(~group, data, dinm = FALSE)` for these
     cards (Arel-Bundock; `library(modelsummary)` added; rides the native-R `runs-in-r` gate — now 14/14, with
     new independent-t + factorial reps asserting the balance table reaches stdout).
   - **Scope = 5 cards:** independent-t, one-way / factorial / welch / nested ANOVA. **Excluded:** nonparametric
     rank tests (report median/IQR, not M/SD), within-subject (paired-t, RM-ANOVA — no between-group split),
     one-sample (no group).
   - **SE sub-decision (your call):** independent-t's Table 1 also carries an **SE** column; `datasummary_balance`
     shows only N/Mean/Std.Dev. I **kept SE** (useful, harmless). Say if you'd rather drop it for strict parity.
   - **Borderline cards → saved as a future slice (you ruled 2026-06-18).** ancova, mixed-anova, manova/mancova
     were NOT in 16b. manova/mancova (multi-DV by group) are where a *full transposed* Table 1 with spanning
     headers genuinely pays off — that future slice is the renderer-feature path (two-tier spanning headers in
     `ApaTable`, the change 16b avoided), scoped to manova/mancova. ancova/mixed-anova can ride along or stay as
     simple relabels — to decide when that slice is picked up.
2. **Descriptive `datasummary` display interpretation.** The descriptive tables adopt Arel-Bundock's house style +
   the completeness adds, but KEEP their rich columns (we did NOT regress Summary stats to `datasummary_skim`'s
   spare default, which would drop Skew/Kurtosis). The export emits the real `datasummary_*()` call. Confirm this
   is the look you want, or say if you'd prefer the literal spare `datasummary_skim` display.
3. **Bootstrap for Spearman ρ / Kendall τ** — base R returns no CI, so we add a **seeded base-R percentile
   bootstrap** (seed 20260617, R=2000); WebR ≡ native R bit-identical. (boot's `boot.ci` interpolation differs;
   the hand-roll keeps reproducibility exact.) Confirm the seeded approach.
4. **One-sided CIs** for variance-explained effect sizes (η²/ω²/ε²/W/Cramér's V/Cohen's w) render as `effectsize`
   returns them (upper bound pinned at 1.00, ~1.41 for Cohen's w) — APA convention, not a bug.
5. **No-visible-coefficient-*p* policy UNCHANGED** in the modelsummary coef tables (the ratified decision stands).
   The only logistic change was fixing the how-to-read copy that pointed at a non-existent "z column".

## Gate evidence

- tsc 0 · test:fast 873/873 (incremental, per theme).
- **Final gate GREEN (2026-06-17):** build · **full WebR vitest ×2 = 1021/1021** · **e2e 14/14** · **fresh-clone** (install → build → test:fast 873) · native-R `runs-in-r` gate 12/12. Pushed (no deploy).

## Carryover (your calls, unchanged)
- Push / deploy of this pass (and the export slice already pushed): your call.
- **Task 16b** — DONE (Option B), `e08f82b` on local `main`, not pushed; awaiting your click-through + the SE / borderline-cards calls in decision 1 above.
- Prior ratify lists (export-formats, econometrics, ms-format); design-theme menu.
