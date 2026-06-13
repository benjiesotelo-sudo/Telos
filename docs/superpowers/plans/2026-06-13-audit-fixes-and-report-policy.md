# Plan — Audit fixes + report-only policy + adjustable α/CI (2026-06-13)

Owner-approved (Benjie, 2026-06-13). Autonomous build; **no push/deploy**; local commits; clean tree + green gates ×2 + fresh clone before "done". Findings: `docs/superpowers/reviews/2026-06-13-dogfood-audit.md` (57 confirmed) + `/tmp/telos-audit/findings-by-test.json`. Theme menu (his next decisions): `docs/superpowers/reviews/2026-06-13-design-theme-menu.md`.

## The three workstreams
1. **Audit fixes** — the 57 confirmed findings (6 major / 38 minor / 13 polish).
2. **Report-only + general-teaching policy** — program-wide, all 47 cards.
3. **Adjustable α / CI** — defaults 0.05 / 95%.

## Policy rules (apply IDENTICALLY everywhere)
**APA template = neutral factual report; never a verdict on the user's data.** Strip verdict words ("significant(ly)", "found an effect", "found a difference", "predicted") → neutral verbs ("gave", "yielded", "was", "compared"). Keep ALL numbers. Mirror the already-neutral logistic/Poisson/Pearson voice.
- Example (chi-square): ~~"A chi-square test of independence **was significant**, χ²(2)=4.90, p=.086…"~~ → **"A chi-square test of independence **gave** χ²(2)=4.90, p=.086, Cramér's V=0.18."**
- The where-the-selection-matters majors fold in here: APA names the SELECTED post-hoc / sphericity correction / MANOVA statistic / nesting mode, and reflects interactions-off / fixed-nesting.
**"How to read" = general teaching** (how to interpret p vs your alpha, CI, effect size) — keep; ensure it never asserts the user's specific result.
**α / CI:**
- α → `kind:'number'` default 0.05. Reference-only (report-only ⇒ no verdict to compute); shown + referenced in "how to read". No computational effect.
- CI → `kind:'select'` choices `['90%','95%','99%']` default `'95%'`. Threaded into R via a `level` param (`confint(level=)`, `conf.level=`, `qt(1-(1-level)/2,…)`). Default 0.95 ⇒ identical numbers to today ⇒ known-answer tests stay green.
- `freshSetup` auto-stores them once kind≠display. `builders.ts` RUNNER wrappers pass `ciLevel(setup)` ('95%'→0.95, default 0.95). Stats runners gain a trailing `level=0.95` param.
- Spec HTML α/CI pills updated to read as adjustable (faithfulness); consistency test checks {label,value} only → keep label/value, stays green.

## Backbone (serial, me) — must land first
- `src/lib/format/apa.ts`: add `fpApa(p)` → `'< .001'` | `'= .034'` (spaced, operator-prefixed; templates use `p {p}`); `f01(n,d=2)` → leading-zero-drop for bounded stats (W, D, η², ω², R², r, β). Keep `fp`/`f` for table cells (`<.001` no-space stays house style).
- `src/components/ResultPreviewCard.tsx`: (a) render note inline after its anchor table (`note.afterTableId`/index) not after all tables; (b) render `howToRead`/`apa` as sanitized HTML (capability for bold/italic/subscript; plain strings render unchanged); (c) label "APA template:" not "APA:".
- `src/lib/format/ciLevel.ts` (or in apa): `ciLevel(setup)` helper.
- CSS (`tokens.css`/global): sticky stepper scroll clearance (~57–64px) so it stops overlapping card content.

## Phase order
1. Backbone (above) → commit → tsc + fast gate.
2. **Per-test fan-out** (workflow, sonnet, edit-only on main, non-overlapping files): per live test — neutral apaTemplate (+ `p {p}`/fpApa, f01), selection-aware APA wording, the test's audit bug-fixes (builder/stats/registry), update that test's unit tests. NOT the full suite. → I integrate + gate.
3. **α/CI** (me, serial): option-kind in all registries w/ pills; `ciLevel` wiring in builders.ts; `level` param in stats runners; spec HTML pills.
4. **Spec HTML** (me): neutral APA + flagged spec text (one-way "Tukey", factorial "significant interaction", nested note, RM "(GG-corrected)", MANOVA Pillai disclosure) across 47 cards; howToRead parity.
5. **e2e + gates loop** (me): update e2e APA assertions (`flow`/`anova`/`association`/`regression`.spec); run tsc + full vitest + e2e + consistency; fix until green ×2 + fresh clone.
6. **Verify** (me): re-screenshot changed cards via `/tmp/telos-audit/drive-lib.cjs`; eyeball correctness + reads-well + α/CI controls work.
7. README/ROADMAP counts; memory; PushNotification + report (incl. theme menu + α/CI p-hacking caution).

## Conscious calls (documented for review)
- α = reference-only (report-only ⇒ no verdict); CI = the one with computational effect. Independent controls (no forced α↔CI linkage) — simplest.
- Rich-text markup in the 29 registry strings is the highest-churn polish: add the RENDER capability now; apply markup conservatively (APA stat symbols) only if low-risk — else note as a clean follow-up. Text is fully readable meanwhile.
- `tails` left as-is (his ruling was α/CI; tails is a separate theme-menu item).
- α/CI p-hacking caution (from theme menu) implemented as ruled; flagged for his review; trivially revertible (not pushed).

## Gate criteria for "done"
tsc 0 · full vitest all-pass ×2 · e2e all-pass ×2 · all consistency tests pass · fresh-clone install→tsc→test→build green · changed-card screenshots eyeballed · tree clean, committed locally, NOT pushed.
