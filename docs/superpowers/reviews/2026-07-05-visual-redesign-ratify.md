# Visual redesign (slice 2) - build ratify + owner decision list

Date: 2026-07-05
Slice: Anthropic-tribute visual redesign, spec `2026-07-04-telos-visual-redesign-design.md`, plan `2026-07-05-telos-visual-redesign.md`.
Built subagent-driven: 13 tasks, each independently reviewed; whole-branch final review (all Important findings fixed); SDD ledger `.superpowers/sdd/progress.md`.

## Gate (local main, NOT pushed)

- test:fast 1174/1174 (137 files; fresh clone 1171 - the delta is the owner's uncommitted test additions).
- tsc -b / build green (the plain `tsc --noEmit` is vacuous in this repo - the gate learned to trust `npm run build`).
- Playwright e2e 19/19 in 5.6 min.
- Fresh-clone proof: `npm ci` + test:fast + build green.
- WCAG AA contrast audit recorded in `2026-07-05-redesign-contrast-audit.md` (worst small-text pair 4.99; one usage-level fix applied: browse link to accent-deep).

## What shipped

Direction-C tokens (ivory/ink/clay, Archivo display + Crimson Pro prose, self-hosted variable fonts with true weight ranges); five-stage rail with per-test sub-dots (keyboard-focusable buttons) replacing the per-step stepper; narrated RunModule with live percentage or calm indeterminate fill; Welcome tribute (clay-stop wordmark, settling-curve gesture, Fable 5 credit line, single CTA); grouped option rows; slot-to-shelf hover echo; app-wide token sweep (SemCanvas recolor only); screen copy in stage vocabulary; reduced-motion kill switch.

## Deviations applied during build (flagged, need your eyes at click-through)

- D1: A DONE rail stage targets its LAST step, so clicking Data after completing it lands on Configure data, not the Guide (spec said "first enterable step"; the old e2e encoded the one-click back-edit expectation and it is the better UX).
- D2: The "Drawing figures" narration item was dropped from the run module (the mockup showed four phases): no real engine phase ever reports figure drawing (figures render inside each test's R run), and a permanently-pending fake phase is worse than three honest ones.
- D3: Rail nodes show numbers until done (per the stepper-concepts mockup); sub-dots are real buttons SIBLING to the stage button (accessibility - nested buttons are illegal and were mouse-only).
- D4: The config-screen run module from spec §5 was found unreachable (runs navigate to Results instantly) and the final review flagged it; the instance currently remains in code but never renders - see O5.

## Open items - your calls (O-list)

- O1: Spec §6 motion extras not implemented and never planned: screen cross-fade + chip settle scale-in. Do you want them in a polish pass, or drop from spec?
- O2: Spec §4 upload-parse and export-bundle narrated one-liners: untouched (export is synchronous-fast). Keep as-is or add?
- O3: Figure series colors still the old blues (R-side emitters were correctly out of scope) - visibly off the new clay identity and the spec's "sky/olive for figures" sentence. Wants its own small slice (R emitters + native-R re-verify).
- O4: The compact-rail "thread" hides labels and shows the fraction, but the enlarged-current-dot detail from the mockup is not implemented. Care?
- O5: Config-screen RunModule is dead code (D4). Remove it, or stop auto-navigating to Results so runs narrate in place?
- O6: SEM latent-figure export CLIPPING bug is real; a content-fit fix exists in git history at `1c9cb83` (it was reverted from this slice because SemCanvas was recolor-only per R7). Approve as its own properly-scoped task?
- O7: YOUR uncommitted work-in-progress (SemCanvas.tsx/.test.tsx span-relative item sides + related, doc-test artifact updates, document-tests.spec.ts tweak) sits restored and UNCOMMITTED in the working tree, exactly as before this session. During the build it was briefly swept into a commit by mistake and fully restored; content also durable at `1c9cb83`. Tell me what this WIP is meant to become and we will land it properly.
- O8: All 47 per-test doc screenshots show the pre-redesign UI - regenerate after your acceptance (one run covers both slices).
- O9: Rail sub-dot labels use full test names (CATALOG.short is mostly unpopulated) - long names may crowd the rail; check at click-through, populate `short` if needed.
- O10: House lint-zero pass (a handful of pre-existing eslint errors: react-refresh patterns, SemCanvas unused var) + add a `lint` npm script and gate entry.
- O11: The bootstrap progress detail (runProgress.message, e.g. resample counts) is no longer displayed anywhere; surface as a sub-line in the run module?

## Acceptance

Your both-themes click-through is the gate: `npm run preview` after `npm run build`, walk all seven screens light + dark, macOS Reduce Motion on/off, and judge D1-D4 + O9 on sight.
NEVER pushed or deployed without your word; local main only.
