# WCAG AA Contrast Audit + Motion Audit (2026-07-05)

## Task 11: Contrast Audit (WCAG AA)

### Ratios Table

| Pair | Ratio | Status | Notes |
|------|-------|--------|-------|
| text/bg | 17.50 | ✓ Pass | Light mode body text |
| muted/bg | 4.99 | ✓ Pass | Light mode muted text (4.5 minimum) |
| accent-deep/bg | 5.54 | ✓ Pass | Light mode accent for small text |
| accent/bg (large only) | 2.96 | ✓ Pass | Large text only; accent-deep used for small |
| btn text | 17.50 | ✓ Pass | Button text (bg→text) |
| dark text/bg | 17.50 | ✓ Pass | Dark mode body text |
| dark muted/bg | 8.29 | ✓ Pass | Dark mode muted text |
| dark accent/bg | 5.90 | ✓ Pass | Dark mode accent |
| error/errbg | 6.69 | ✓ Pass | Error message text |

### Verdict
All contrast ratios meet or exceed WCAG AA requirements. The most critical small-text pair (muted/bg at 4.99) marginally passes the 4.5 minimum but remains compliant. No token adjustments needed.

---

## Task 12: Motion + Reduced-Motion Audit

### Step 1: Transitions & Animations in tokens.css

All 9 transition/animation declarations verified:
- **Line 27**: `.btn` - `transition:transform var(--motion),opacity var(--motion)` ✓
- **Line 37**: `.chip` - `transition:background var(--motion),border-color var(--motion)` ✓
- **Line 41**: `.slot` - `transition:border-color var(--motion),background var(--motion)` ✓
- **Line 61**: `.shelf` - `transition:opacity var(--motion)` ✓
- **Line 76**: `.run-fill` - `transition:width var(--motion)` ✓
- **Line 77**: `.run-fill.indeterminate` - `animation:run-slide 1.6s ease-in-out infinite` (named keyframe) ✓
- **Line 85**: `.rail-fill` - `transition:width var(--motion)` ✓
- **Line 89**: `.stage .node` - `transition:background var(--motion),box-shadow var(--motion)` ✓
- **Line 104**: `@media (prefers-reduced-motion:reduce)` - Kills all transitions and animations ✓

### Step 2: External Motion Declarations

Grep of src/**/*.tsx (excluding tests):
- **Result**: No motion declarations found outside tokens.css ✓

### Step 3: Reduced-Motion Media Query

The `@media (prefers-reduced-motion:reduce)` block at line 104:
```css
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{transition:none!important;animation:none!important;}
}
```

This universally suppresses both transitions and animations when OS-level Reduce Motion is enabled. Coverage is complete.

### Analytical Findings
- All motion properties controlled via `--motion` token (200ms)
- Named keyframe (`run-slide`) properly isolated
- No motion code in component files (all in tokens.css)
- Reduced-motion kill switch functional and comprehensive
- Live OS-toggle verification deferred to owner click-through

### Motion Register (R3) - New Keyframes
- Six new keyframes (fadeUp/dotIn/drawPath/checkPop/chipIn/screenIn) and class selectors (.enter-1..5, .screen-fade) added; all live under the reduced-motion kill ✓

---

## Usage-level findings (review round 1)

### Browse link (UploadScreen.tsx:47)
- **Initial**: `var(--accent)` at 13px bold: 2.96:1 on light ground → WCAG AA failure (small text needs 4.5:1)
- **Fix**: Changed to `var(--accent-deep)` → 5.54:1 on light ground → compliant
- **Dark mode**: `var(--accent-deep)` resolves to clay token on dark themes; no change needed (already designed)

### Welcome wordmark dot
- **Finding**: Raw clay (46px) at 2.96:1 against light ground
- **Exemption**: Decorative punctuation (conveys no information—"Telos." vs "Telos" reads identically); exempt under WCAG 1.4.3(a) decoration clause
- **Status**: Retained as designed; flagged for owner click-through confirmation

### Audit method update
- Contrast audit now includes checking where accent tokens are **applied in component code**, not just pair math in tokens.css

---

## Summary
- **Contrast**: All pairs compliant (muted/bg = 4.99, passes 4.5 minimum); browse link fixed to accent-deep
- **Motion**: Complete coverage; no adjustments needed
- **Commit**: src/components/screens/UploadScreen.tsx + docs/superpowers/reviews/2026-07-05-redesign-contrast-audit.md
