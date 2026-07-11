# Repo cleanup + branding slice (Direction B) - design

**Status:** owner-approved scope (JASP-ecosystem board, 2026-07-10; "go with the cleanup slice", 2026-07-11).
**Goal:** give the now-LIVE, now-public repo the JASP-pattern-at-solo-scale face Benjie chose, and ship his hand-tuned identity everywhere the product shows a face.

## Owner rulings this slice executes (all pre-ruled, none new)

- Direction B: in-place cleanup of THIS repo (no new repo, no clone-rename).
- Dual identity: W1 wordmark (Crimson Pro weight 620, clay full stop) + the Benjie-tuned M6b three-node mark
  (stance 71 / peak 30 / node 6.5 / arrival 9.5 / ink 2.5 / clay 4.3 / no arrow; "three nodes always"; one mark at every size).
- Hero pose: tuned M6b everywhere the mark appears.
- Kill the Vite purple bolt favicon (he spotted it live on launch day).
- Live app: https://telos-stats.pages.dev . Zenodo concept DOI: 10.5281/zenodo.21281648 . ORCID: 0009-0005-8027-6166 . License: AGPL-3.0.

## Units

### U1 - Brand kit lands in the repo (`docs/brand/`)

Move the session-scratchpad logo kit into the repo: `telos-mark.svg` (currentColor ink + clay #d97757),
`telos-mark-light.svg`, `telos-mark-dark.svg`, `favicon.svg`, `geometry.json` (the tuned params, provenance note kept).
`docs/brand/README.md` states the one-mark rule and the tuned parameters.

### U2 - The mark and wordmark in the app

- `public/favicon.svg` replaced by the kit favicon (bolt evicted; `index.html` already points at `/favicon.svg`, so no HTML change).
- New `src/components/TelosMark.tsx`: inline SVG component of the tuned mark - ink strokes `currentColor`,
  clay parts `var(--accent)` - so it follows both themes with zero variant files.
- Welcome screen hero: the placeholder arc-and-dots SVG is REPLACED by `TelosMark` (same `enter-3` slot, centered, ~120px wide).
- Welcome wordmark goes W1: the existing `Telos.` h1 switches to Crimson Pro weight 620 (font stays loaded; the clay
  full stop already exists and keeps `var(--accent)`). No other screen's heading changes.
- Page `<title>` keeps its copy (em dash there is pre-existing owner-approved HTML, untouched).

### U3 - README rewrite (the routed front door)

Full rewrite, current rules applied (no em dashes; one sentence per line):
logo header via `<picture>` (dark/light mark from `docs/brand/`), one-line thesis, LIVE APP link up top,
badges (CI, Zenodo DOI, AGPL-3.0), what-it-is + the verification story (every statistic pinned against native R),
quick-start commands (kept from today's README, they are accurate), docs routing (test documentation index, spec HTMLs' new home,
CONTRIBUTING), citation section (CITATION.cff + DOI), license.
The stale design-language paragraph (blue #185fa5, Workday stepper - two redesigns ago) is deleted, not updated:
the README should describe what the product does, not pin its palette.

### U4 - Specs off root (`docs/specs/`)

`git mv` the three root spec HTMLs (`telos_test_inputs.html`, `telos_test_outputs.html`, `telos_ui_spec.html`) to `docs/specs/`.
Sweep every functional reference - the ~20 consistency tests' `readFileSync('telos_test_*.html')` calls and the
`docs/build-test-doc.mjs` / `scripts/` readers if any - plus source-comment pointers in `src/` and `tests/` (102 files reference
the bare filenames). Historical documents under `docs/superpowers/` are NOT swept (they describe the past truthfully).
File CONTENT is byte-untouched (these are owner-locked spec twins; only their location changes). Gate: full `test:fast`
(the consistency suites re-read them from the new path) + a `git diff --stat` showing zero content changes on the three files.

### U5 - GitHub furniture (`.github/`)

- `workflows/ci.yml`: on push + PR to main - Node 22, `npm ci`, `tsc -b --force`, `npm run test:fast`, `npm run build`.
  Deliberately NOT in CI: the WebR engine suites and Playwright journeys (30+ min, flaky-in-CI class); the README says so honestly.
- `ISSUE_TEMPLATE/bug_report.md` (echoes CONTRIBUTING's minimal-synthetic-CSV rule), `ISSUE_TEMPLATE/feature_request.md`,
  `ISSUE_TEMPLATE/config.yml` (blank issues on, link to the live app), `PULL_REQUEST_TEMPLATE.md` (gates checklist).
- CONTRIBUTING.md gets a light touch only: link the CI workflow and the new docs/specs location if it references paths.

### U6 - CITATION.cff + docs landing + Pages

- `CITATION.cff` (cff-version 1.2.0): author Benjamin Sotelo w/ ORCID, DOI 10.5281/zenodo.21281648, version 1.0.0,
  repository-code, url = live app, license AGPL-3.0. GitHub renders the "Cite this repository" button from it.
- `docs/index.html`: small branded landing (tokens.css values, the mark, both themes) routing to
  test-documentation/index.html (48 audit docs), the spec HTMLs, and the repo.
- GitHub Pages enabled from main:/docs via `gh api` AFTER the push lands (needs the commit present). Pages URL goes in the README.

## Not in scope (parked, by ruling or YAGNI)

Wordmark SVG asset (W1 is a live-text treatment, not an image), og/social cards, app screens beyond Welcome,
docs/superpowers reorganization, CNAME/custom domain, CI running WebR/e2e, README screenshots (doc-hygiene pass owns those).

## Acceptance

tsc clean, test:fast green (proves the spec-file move), full Playwright 53/53 (Welcome changed - visual baselines for
`welcome-*` regenerate, owner reviews the 6 diffs), fresh-clone check (new paths), README + Welcome + favicon render review
by Benjie, Pages URL serving after push.
