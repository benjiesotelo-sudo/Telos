# SEM Sub-slice A — Reliability & Factor Analysis: ratify list

> **2026-06-19, Opus 4.8 (1M) ultracode session — built autonomously to GREEN on local `main`, NOTHING pushed/deployed.** Slice = the 5 no-canvas SEM cards (Cronbach's α, AVE, Composite Reliability, EFA, PCA) + shared infra. Authority: the owner-approved convention `2026-06-18-sem-reporting-convention.md` + spec `2026-06-19-telos-sem-reliability-factor-design.md` + plan `2026-06-19-telos-sem-reliability-factor.md`. Built subagent-driven (15 tasks, implementer + reviewer + fix loop each; ledger `.git/sdd/progress.md`). Every statistic native-R-verified (WebR ≡ native R 4.6.0). These are Benjie's calls to confirm at click-through (`npm run preview` :4173).

## What shipped
5 cards flipped `later-slice`→`available` (45 of 47 live). Shared infra: `parallel::makeCluster` serial shim (WASM has no sockets), a `kind:'matrix'` table renderer (Fornell-Larcker / HTMT / Φ), hand-rolled parallel analysis (`psych::fa.parallel` fails in WASM), a shared `runCfaReliability` CFA engine, deterministic factor ordering, and the **construct-slots** input (your chosen UI for AVE/CR). lavaan/semTools/GPArotation added to the WebR preload.

## Ratify items (your calls)

1. **Reliability headline = McDonald's ω, Cronbach's α secondary** (convention §4a) — on the α card T1 (ω first + its 95% bootstrap CI; α + its Feldt CI). Confirm the rendered look.
2. **Construct-slots input for AVE/CR** — you chose "construct slots" this session; the AVE/CR *input* HTML previously described grouping items "on the canvas." I updated those input cards to construct-slots to match your choice (the canvas is sub-slice B). **This supersedes the older canvas wording for these two cards** — confirm.
3. **CR = ω shown as identical columns** on AVE & CR T1. For a unidimensional congeneric model, composite reliability *is* ω (`semTools::compRelSEM`), so the two columns carry the same value — mathematically correct, but visually redundant. Options: keep both (current), drop one, or add a distinct `psych::omega` (hierarchical ω). Your call.
4. **HTMT as the primary discriminant-validity criterion** (convention §4c) — the AVE card shows both the Fornell-Larcker matrix and the HTMT matrix. Confirm.
5. **PCA filed under a new "Data reduction" group**, not "Latent variable models" (convention §4e) — confirm the taxonomy/label in the test picker.
6. **EFA defaults:** extraction = principal-axis, rotation = oblimin (oblique → Φ shown), retention = parallel analysis; a fixed-n factor count input is exposed (used only when retention = fixed-n). Confirm the defaults.
7. **Loading suppression |.32|** (Tabachnick & Fidell) on EFA/PCA loading tables — confirm the threshold.
8. **Spec HTML edited to the convention** (ω-headline, HTMT matrix, EFA Φ + real estimator labels, PCA "data reduction", construct-slots inputs) — faithful to the *approved convention*, but it touches your design canvas, so flagged.
9. **Bootstrap counts (inline, no progress bar in A):** ω CI on the α card uses `nboot=2000`; AVE/CR ω via a CFA bootstrap. These are single-scale/single-model and fast. (The 5,000/10,000 publication counts + the progress-bar UI are sub-slice B, for the heavy SEM/PLS bootstraps.) Confirm 2,000 is fine for the α ω-CI, or bump.

## Carried-forward minors (recorded for a future cleanup pass — none block)
- **Emitter escapes construct names** (AVE/CR): a `"` in a construct name would break the *exported* `analysis.R` string (the in-app WebR path is safe). Escape in `emitters/latent.ts`.
- **ω-CI test** uses generous bounds (nboot=200); could tighten to native bounds (the spike proved lavaan seeded bootstrap is WebR≡native). The ω point estimate is already tightly asserted.
- **`parallelAnalysis.ts`** loads `psych` even on the PCA path (only `smc()` needs it, fa-only) — harmless.
- **e2e** covers Cronbach's α + AVE (construct-slots + matrices) + EFA (scree); PCA & CR not e2e-driven (representative subset). HTMT e2e asserts text not row-count.
- **SEM packages eagerly preloaded** in `Engine.init` (matches the existing 25-package pattern) — adds lavaan/semTools to the first-load download. If first-load size matters, lazy-loading on first SEM run is a future optimization.
- **ConstructSlots** uses index keys; a stable id would be cleaner.

## Final gate — GREEN ✅ (2026-06-20)
- **build** OK
- **full WebR vitest ×2** = **1128/1128 (159 files)** both passes (all engine/parity tests incl. the 5 new SEM cards + runs-in-r)
- **full e2e** = **17/17** (real Chromium, 14 existing + 3 new SEM-A journeys)
- **fresh-clone** (clean `git clone` → `npm install` → `npm run build` → `test:fast` **956/956** → native-R `runs-in-r` **19/19**) — all real, all green
Every statistic native-R-verified (WebR ≡ native R 4.6.0). HEAD `4048aa3` (+ this ratify doc), local `main`, NOTHING pushed/deployed.

## Next
Your click-through + the rulings above → push/deploy (BOTH untouched — your calls) → **sub-slice B: CB-SEM / PLS-SEM + the AMOS canvas** (I'll surface the canvas design for your eyeball before building, per render-faithfully). NEVER push/deploy without your word.
