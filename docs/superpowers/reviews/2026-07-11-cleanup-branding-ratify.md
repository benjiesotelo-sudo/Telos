# Cleanup + branding slice - ratify list (2026-07-11)

Slice = Direction B in-place cleanup + the identity kit, per the JASP-ecosystem board rulings and
"go with the cleanup slice". Spec: `specs/2026-07-11-repo-cleanup-branding-design.md`.
Four commits: `46134d5` (spec) · `dcabdcd` (specs move) · `e7be1e6` (brand) · `462c073` (repo face).

## (a) What shipped

1. **Brand kit in-repo** (`docs/brand/`): tuned mark (3 SVG variants + favicon), `geometry.json` =
   source of truth (stance 71 / peak 30 / node 6.5 / arrival 9.5 / ink 2.5 / clay 4.3 / no arrow),
   kit README with the one-mark rule and the clean-junction construction rule.
2. **Identity in the app - YOUR RULING B (hero board)**: the settling curve you liked stays as the
   Welcome hero, untouched; W1 wordmark = the `Telos.` h1 now Crimson Pro weight 620 (clay stop
   kept); the mark carries the identity on external surfaces only (favicon, README, docs landing);
   `public/favicon.svg` = the kit mark with ADAPTIVE INK (your favicon-board ruling: embedded dark-mode media query flips ink to paper; OS-theme-follows + patchy-Safari limitation accepted), cache-busted (`?v=3`) - **the Vite purple bolt is dead**
   (the bolt in your tab was your browser's cache; it dies on redeploy). My first build replaced
   the curve with the mark - you corrected it, the board offered A-D, you picked B (`a0da0c0`).
3. **README rewrite**: logo `<picture>` header, live-app link first, CI/DOI/AGPL badges, the
   native-R verification story, docs routing, citation section, honest CI-scope note.
   The stale design-language paragraph (blue `#185fa5`, Workday stepper - two redesigns ago) was
   deleted; the stale Atkinson Hyperlegible licence row replaced with Archivo.
4. **Specs off root**: the three locked spec HTMLs moved to `docs/specs/`, 90 files swept
   (readFileSync paths + comments in src/tests/scripts + CONTRIBUTING); content byte-identical
   (`git diff` on the moves shows pure renames); `docs/superpowers/` history deliberately not swept.
5. **GitHub furniture**: `ci.yml` (Node 22: typecheck + test:fast + build on push/PR - WebR,
   native-R parity, and Playwright stay local release gates BY DESIGN, and the README says so),
   bug/feature issue templates (minimal-synthetic-CSV rule, expected-vs-got framing),
   PR template with the gates checklist, config.yml linking the live app + verification docs.
6. **CITATION.cff** (GitHub "Cite this repository" button): Zenodo DOI, ORCID, FEU affiliation,
   AGPL-3.0, v1.0.0.
7. **docs/index.html**: branded Pages landing (both themes) routing to the 48 audit docs, the spec
   twins, the app, and the repo.

## (b) Caught in my own render review (fixed before you saw it)

**Latent reduced-motion a11y bug, pre-existing**: the motion register hid `.enter-3` circles at
`opacity:0` and relied on the entrance animation to reveal them; the reduced-motion block killed
animations WITHOUT restoring the resting state, so reduced-motion users have been seeing the arc
without its dots since slice 3 - and would have seen the mark without its three nodes.
Fix: the reduced-motion block now explicitly restores `opacity:1` / undashed strokes for enter-3.
(Under ruling B the register kept its original curve rules; only the reduced-motion neutralizer
remains from this fix - the curve's seven dots now render for reduced-motion users.)

## (c) YOUR render review (the acceptance)

1. **Welcome screen** at http://localhost:4173 (both themes): the curve back as before, the W1
   wordmark weight (Crimson Pro 620), the original entrance sequence.
2. **The 6 welcome baseline diffs**: `.superpowers/sdd/cleanup-baseline-diffs/`.
3. **README** as GitHub will show it (mark header, badges - CI badge is red/missing until the
   workflow's first run completes after push).
4. **Favicon** in the browser tab (hard-refresh may be needed; the bolt dies on redeploy).
5. **docs landing**: open `docs/index.html` - it becomes https://benjiesotelo-sudo.github.io/Telos/
   once Pages is enabled (post-push step).

## (d) Held / notes

1. Pages enablement (`gh api`) happens AFTER your push word lands the commit; the README's
   verification-docs link points at the future Pages URL and 404s until then (hours-scale gap).
2. The e2e suite and CI both green-gate the moved spec paths; if you ever relocate them again,
   `grep -rl "docs/specs/telos_"` is the sweep list.
3. Wordmark stays live text by rule (docs/brand/README.md); no wordmark image asset exists.
4. Inline execution: this slice ran inline (spec -> tasks -> TDD -> gates) rather than
   subagent-driven - mechanical scope, every decision pre-ruled on your boards. Flagging the
   process deviation for your awareness.

## (e) Gate evidence

| Gate | Result |
|---|---|
| tsc -b --force | clean |
| test:fast | 162 files, 1689/1689 (consistency suites read specs at the new path) |
| Playwright full 5-project suite | 53/53 post-ruling-B (6.9m) |
| Visual | 12/12; only the 6 welcome baselines changed (owner diff set staged) |
| Fresh clone | install + tsc + test:fast 1689/1689 + build, all green |
| Welcome unit | 7/7 (mark structure, W1 weight, copy verbatim, CTA, stagger classes) |
