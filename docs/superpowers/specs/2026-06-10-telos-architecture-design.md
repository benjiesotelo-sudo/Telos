# Telos — Architecture & Build Design (v1)

**Date:** 2026-06-10
**Status:** Approved direction (brainstorming output) — the basis for the implementation plan.
**Scope of this doc:** the *technical / build* architecture for Telos v1.
**Not in this doc:** the *product / content* spec — every screen, the 46 tests, their inputs/outputs, and the SEM behaviour — which lives in the three companion HTML specs (`telos_ui_spec.html`, `telos_test_inputs.html`, `telos_test_outputs.html`). Those remain the source of truth for *what* the app does; this doc covers *how it is built*.

---

## 1. What Telos is

A browser-based statistics web app for thesis students. The flow: upload data → get guided through configuring and running the right statistical tests → see APA-7 results with plain-language "how to read" explainers → export a bundle (PDF, R script, figures). The hardest and most differentiated feature is **SEM** (CB-SEM and PLS-SEM).

## 2. Guiding principles

- **Privacy by architecture** — the student's uploaded data never leaves their browser.
- **Session-based v1** — no accounts, no server. Work in a session, export, done.
- **Simplicity / YAGNI** — build the minimum that delivers v1; design clean *seams* for later additions (e.g. a backend) without building them now.
- **Trustworthy academic tone** — the UI must read as credible and scholarly, not flashy.

## 3. Key decisions (locked)

| Area | Decision | Rationale |
|---|---|---|
| **R execution** | **WebR** (R compiled to WebAssembly), runs **in the browser** | Spike-validated (§4). Keeps data on-device, ~zero hosting cost, no backend to build. |
| **Backend** | **None in v1.** A clean storage *seam* is built so a backend can be added later | Session-based v1 needs no server; adding one later is a localized change, not a rewrite (§13). |
| **Frontend** | **React + TypeScript + Vite**, static SPA (no SSR) | Mature ecosystem for the hard UI (SEM canvas, drag-drop); TS for complex typed state; SSR would fight a client-only WASM app. |
| **SEM canvas** | **React Flow (xyflow)** | Purpose-built node/edge diagrams with drag, zoom, and touch — the single hardest UI piece, largely solved off-the-shelf. |
| **Drag-and-drop (role slots)** | **dnd-kit** | Accessible, touch-friendly. |
| **Data import** | **PapaParse** (CSV) + **SheetJS** (Excel), parsed in-browser | Fits the privacy model — data never leaves the device. |
| **Figures** | Rendered by **ggplot2 inside WebR**, returned as PNG/SVG | R already makes the plots; no JS charting library needed. |
| **Export bundle** | **fflate** (zip). PDF generation **deferred** (R-side vs client) | §15. |
| **State** | **Zustand** | Lightweight session/wizard store; no Redux ceremony. |
| **Styling** | Carry forward the existing Telos CSS tokens (teal/blue cards, dark/light). **Typography: Crimson Pro (display/headings) + Atkinson Hyperlegible (UI/body) — locked.** | Preserves the approved look; the type pairing gives a credible academic feel with maximum legibility. |
| **Hosting** | **Cloudflare Pages** (static, unlimited bandwidth, COOP/COEP headers) | WebR makes every first-time visitor download tens of MB of WASM; unlimited bandwidth removes that worry. |
| **Analytics** | A **cookieless, privacy-friendly** tool (Plausible / Umami / Cloudflare Web Analytics) with three funnel events | Anonymous usage counts without a consent banner; on-brand for a privacy-first tool. |
| **Feedback survey** | A **"Share feedback" button → Google Form** on the Results screen | Zero backend; trivially swappable URL. |
| **Design tooling** | The built-in **`frontend-design`** skill for bespoke components; **UI UX Pro Max** as an *optional idea source* under an explicit academic brief | UI UX Pro Max's typography/colour/a11y output is useful; its "pattern" (landing-page) output is not relevant to the app. |

## 4. WebR spike — evidence the core choice is sound

Ran a real CB-SEM through WebR end-to-end (Node's V8 = Chrome's V8, so representative of the browser):

| Measurement | Result |
|---|---|
| WebR boot | ~0.5 s |
| `lavaan` install (+ deps) | ~11 s cold, ~2 s warm (one-time, cacheable) |
| Single ML CFA (N=301, 3-factor) | ~90 ms |
| Single WLSMV CFA (ordinal) | ~260 ms |
| Full WLSMV structural model (real CB-SEM) | ~290 ms |
| Bootstrap (DWLS, ordinal) | ~0.155 s/rep → 1000 reps ≈ 2.6 min, 5000 ≈ 13 min |

**Conclusions:**
- The full SEM stack (`lavaan`, `semTools`, `psych`, …) runs in WebR. Standard fits are **sub-second** — all 46 tests, including CB-SEM with robust WLSMV SEs, are snappy in-browser.
- The only slow path is **bootstrap-heavy** operations (PLS-SEM's mandatory bootstrap, bootstrapped mediation CIs). This is a **UX problem, not an infrastructure one**: run async with a progress bar, default to ~1000 reps, make 5000 an explicit opt-in.
- **Required shim:** `parallel::detectCores()` returns `NA` under WASM, which breaks lavaan's option check. Fix at R-session init: `unlockBinding`/`assign` to make `detectCores` return `1`. (`ncpus` is not a user-settable lavaan argument, so the override must be at the function level.)

## 5. System architecture

```
                Browser tab (the entire app)
 ┌───────────────────────────────────────────────────────┐
 │  React SPA (UI, wizard, SEM canvas, results, export)   │
 │        │                         ▲                      │
 │        ▼                         │                      │
 │   storage seam  ──►  in-memory + localStorage (session)│
 │        │                         ▲                      │
 │        ▼ run analysis            │ tables / figures     │
 │   R-engine adapter  ──►  WebR worker (R + lavaan, WASM) │
 └───────────────────────────────────────────────────────┘
        │ static assets               │ anonymous event      │ opens
        ▼                             ▼                      ▼
   Cloudflare Pages (CDN,        privacy analytics      Google Form
   COOP/COEP headers)            (cookieless ping)      (feedback)
```

The uploaded dataset stays entirely inside the browser tab. Only two things ever leave it, both optional and non-personal: an **anonymous analytics ping** ("a project finished") and a **feedback form** the user chooses to open.

## 6. Modules (isolation & interfaces)

Each unit has one purpose and a defined interface so it can be built and tested independently.

- **App shell / wizard** — the 7-step flow + routing (state-driven). Depends on: session store.
- **Data ingest** — file upload + CSV/Excel parsing → a typed `Dataset`. Depends on: PapaParse, SheetJS.
- **Column typing & levels** — assign measurement type/level per column (the "configure data" step). Depends on: Dataset.
- **Test registry** — the 46 tests as typed data (id, family, required roles + level/arity constraints, options, R-mapping, outputs). Pure data + types; the single source the UI and engine read from. Mirrors the HTML inputs/outputs specs.
- **Test configuration** — role-slot mapping (drag-drop) + options; the SEM model-building canvas. Depends on: registry, dnd-kit, React Flow. Enforces the *unsatisfiable-test* rule (block with reason when roles can't be filled).
- **R-engine adapter** — the only module that talks to WebR: boot, package preload + caching, the `detectCores` shim, generate R code from a configured test, run it, return tables + figures. Async + progress. Depends on: WebR, registry.
- **Results rendering** — APA-7 tables, R-produced figures, the static "how to read" layer. Depends on: engine output, registry.
- **Export** — assemble the bundle (tables/figures PNGs, R script, cleaned.csv, PDF) → zip (or direct single-file). Depends on: fflate; PDF generator (deferred — see §15).
- **Storage seam** — the only module that reads/writes persisted state. v1: in-memory + `localStorage`. Future: swap to a backend client (§13).
- **Analytics + feedback** — fire the three funnel events; render the feedback button. Depends on: analytics tool.
- **Design system** — tokens, typography, base components, dark/light. Consumed by everything.

## 7. Data flow

`Upload → type & set levels → pick tests → configure each test → Run (WebR) → Results → Export.`
Data lives only in the browser session throughout. "Run" hands a configured test to the R-engine adapter, which generates R, executes it in the WebR worker, and returns tables + figures for rendering. A single SEM selection expands into the EFA → CFA → fit → structural pipeline per the inputs spec.

## 8. The R engine (WebR) — details

- **Boot & packages:** initialise WebR once; preload the package set (`lavaan`, `semTools`, `psych`, `car`, `afex`, `emmeans`, `plm`, `forecast`, etc.) from the WebR binary repo; lean on the browser cache (Cache API / service worker) so repeat visits skip re-download. Lazy-load so light users don't pay the full cost upfront.
- **Session-init shim:** override `parallel::detectCores → 1` (see §4) before any fit.
- **Async + progress:** run analyses off the main thread (WebR worker); show progress for anything slow, especially bootstrap.
- **Bootstrap-heavy ops:** default to ~1000 reps with a progress bar; 5000 is an explicit "this takes a few minutes" opt-in. (If ever unacceptable, the narrow escape hatch is a server for *just* these ops — not built in v1.)
- **Missing data (estimator-aware):** the `missing` method follows the estimator — **FIML** for ML/MLR (continuous), **MI** for WLSMV (ordinal); pairwise/listwise available. Telos **warns** when it differs from the global step-4a setting. (Per the inputs spec.)

## 9. Design system

- **Typography (locked):** **Crimson Pro** for display/headings (card titles, section headers, the Welcome page); **Atkinson Hyperlegible** for all functional text (body, labels, tables, UI). Serif used *sparingly* — never in dense UI.
- **Colour & theme:** carry forward the existing Telos tokens (teal/blue cards, dark/light via `prefers-color-scheme`) as scoped CSS / CSS Modules.
- **Accessibility baseline (build QA):** SVG icons (no emoji), visible focus states, hover transitions, light-mode contrast ≥ 4.5:1, `prefers-reduced-motion` respected, responsive at 375/768/1024/1440.
- **Tooling:** craft the signature components (SEM canvas, role-slot cards, results cards) deliberately with `frontend-design`; use **UI UX Pro Max** only as an *idea source* under an explicit "credible academic, not flashy" brief, harvesting its type/colour/a11y suggestions and ignoring its landing-page patterns.

## 10. Hosting & deployment

- **Host:** Cloudflare Pages (static build output, global CDN, unlimited free bandwidth).
- **Headers:** `COOP: same-origin` + `COEP: require-corp` (cross-origin isolation for WebR's `SharedArrayBuffer`) via a `_headers` file. (This requirement rules out plain GitHub Pages.)
- **Config / env:** the Google Form URL and the analytics site key are single config values (env vars) — swapped post-build with no code changes.
- **CI:** push to git → Cloudflare Pages auto-builds and deploys.

## 11. Error handling

- **Bad upload / parse:** surface a clear message; never crash the wizard.
- **Type/level mismatches:** caught at the configure-data step.
- **Unsatisfiable test:** if the Used columns can't fill a picked test's roles, block it at step 6 with the reason (mirrors the step-5 grey-out rule).
- **R errors (non-convergence, estimation failure):** catch in the engine adapter, show a readable explanation, keep other tests' results intact.
- **WebR load failure / unsupported browser:** detect and show a graceful fallback message.
- **Low-end mobile:** the UI is responsive, but heavy SEM compute may be slow on weak devices — communicate with progress UI; the SEM canvas gets a simplified small-screen treatment.

## 12. Testing approach

- **Unit:** the test registry (constraints, R-mapping) and configuration logic (role validation, unsatisfiable detection).
- **Integration:** the R-engine adapter against real WebR — including a **SEM regression test** derived from the spike (fit a known model, assert it converges and returns expected table shapes).
- **End-to-end:** the vertical slice (one test, upload → export) automated in a headless browser.
- **Accessibility:** automated checks against the §9 baseline.

## 13. Future: adding a backend (designed-for, not built)

The storage seam (§6) is the only place that persists state. v1 implements it over in-memory + `localStorage`. When accounts / cross-device saved projects are wanted:
- Add **Supabase** (managed auth + Postgres) and swap the seam's implementation — the wizard, registry, WebR engine, and results rendering are untouched.
- Heavy **R computation stays in the browser** (keeps privacy + cost); the backend is only thin auth + storage.
- The only other realistic backend reason is a **secret API key** (e.g. a future paid API), which would need a tiny server proxy — not an IP-protection concern.

## 14. Build sequence — vertical slice first

1. **Slice:** one simple test (independent t-test) **end-to-end** — upload → configure → run in WebR → render APA results → export the bundle. This proves the whole architecture (including the WebR engine + export) against reality, cheaply.
2. **Expand by family** — reuse the slice's machinery for the remaining descriptive/comparison/association/regression tests via the registry.
3. **Econometrics** (panel/time-series datasets).
4. **SEM last** — the hardest UI (React Flow canvas) and compute (the spike work feeds straight in).

## 15. Deferred / open (build-time choices, not blockers)

- **Styling system:** plain CSS/CSS Modules (lean) vs Tailwind — decide at the design pass.
- **PDF generation:** R-side (e.g. a typesetting route in WebR) vs client-side (print-to-PDF / a JS PDF lib). Affects export fidelity; pick during the export module build.
- **Analytics vendor:** Plausible vs Umami vs Cloudflare Web Analytics — equivalent for our needs.

---

## Appendix — relationship to the content specs

| Artifact | Owns |
|---|---|
| `telos_ui_spec.html` | The 7-step flow, the results screen, the export bundle, the "how to read" layer. |
| `telos_test_inputs.html` | How each of the 46 tests is configured (roles, options, SEM canvas). |
| `telos_test_outputs.html` | What each test produces (APA tables, figures, R-map, bundle files). |
| **This doc** | How all of the above is built (stack, modules, R engine, hosting, testing). |
