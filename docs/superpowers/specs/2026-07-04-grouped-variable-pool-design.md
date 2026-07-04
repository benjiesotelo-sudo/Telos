# Grouped variable pool - design spec

Date: 2026-07-04
Owner: Benjie (all rulings his)
Status: approved design, pending spec review
Mockups reviewed on iPad: https://claude.ai/code/artifact/d420909e-3b1b-4b6d-bd64-1163232dd71d
Slice: 1 of 2 (slice 2 = app-wide visual redesign, separate brainstorm/spec)

## Problem

On every drag-and-drop test-configuration screen, the "Your columns" pool renders all used columns as one flat pile of chips in upload order.
Numbers, categories, ordered ratings, and dates look identical, so users must test-drag to learn what fits where.
Incompatible chips each repeat a full inline sentence, which makes larger datasets noisy exactly where clarity matters.

## Owner rulings (locked)

- R1: Section headings are the four measurement levels, verbatim: Nominal, Ordinal, Interval, Ratio.
  They match both the step-4 table where the user assigns levels and the slot requirement text word-for-word.
- R2: Scope is the `DragSlots` pool only.
  The SEM construct picker and canvas item toggles stay untouched; their pools are numeric-only by construction.
  On the record for slice 2: revisit a unified, level-aware column picker during the visual redesign.
- R3: v1 includes the four approved touches: teaching empty shelves, whole-shelf compatibility notes, date/count tag badges, and the assigned-chip marker.
- R4: The slot-to-shelf hover/drag echo is deferred to the visual-redesign slice.
- R5: Cross-slot reuse guard is included (decision delegated to Claude, reasoning below).

## Design

### Shelf structure

The pool card keeps its "Your columns" eyebrow and renders four fixed sections, always in this order: Nominal, Ordinal, Interval, Ratio.
Each shelf header shows the level name and a count of the columns on it.
Chips keep dataset order within their shelf, matching the step-4 table so the two screens agree.
Unused columns and id-tagged columns stay excluded from the pool, exactly as today.
Columns tagged datetime or count always render a small mono suffix badge on the chip (`date`, `count`), regardless of which test is being configured; a few slots key off these tags rather than levels.

An empty shelf stays visible with count 0 and a one-line teaching hint pointing at step 4, for example:
"No ordinal columns - if a column holds ordered categories (e.g. a rating scale), set its level in step 4."
Each level gets its own example phrasing (nominal: unordered categories; ordinal: ordered categories; interval: numeric without a true zero, dates; ratio: numeric with a true zero).

### Compatibility, two tiers

Chip verdicts keep today's logic unchanged: a chip is draggable when at least one open slot accepts it per `slotCompatibility`.

Shelf tier, derived from the same rules rather than a parallel re-implementation:

- A non-empty shelf dims as one unit when no open slot accepts its level in principle (the level alone rules every chip out).
  The reason collapses to a single short header note, e.g. "no open slot takes ordinal", and the chips on it render clean.
- When the shelf's level is accepted but individual chips fail secondary constraints (category count, count tag, date excluded from a numeric series slot), the shelf stays lit and only those chips dim, each with its existing short reason.
- The Time-slot special case (accepts ordinal columns or date-tagged columns regardless of level list) counts as accepting both the ordinal shelf and any date-tagged chip, same as the current rules.

Edge states:

- Empty shelf: teaching hint only, never a dim note.
- All slots filled: chips go non-draggable with no reasons anywhere, same as today.
- Assigned chips are ignored when deriving a shelf's dim state; a shelf whose only lit chips are assigned ones still reads as spoken for, not broken.

### Assigned marker

A chip assigned to any slot of the current test renders with the accent "assigned" tint in the pool (same style as inside the slot).
The marker is binary; no assignment-count badge.
The slots themselves, which list assigned chips with remove buttons, remain the ground truth for where a column went.
The marker reads only the current test's setup; the same column shows plain on another test's configuration screen.

### Cross-slot reuse guard (R5)

Today the store allows the same column in two different slots of one test, while the eligibility engine assumes this never happens (it skips same-column pairings) and no test in the catalog gives a meaningful result from cross-slot reuse.
The guard closes that gap:

- Within one test, a column already assigned to any slot cannot be dropped on another slot.
- The store's `addRole` rejects cross-role duplicates (single enforcement point).
- In the pool, an assigned chip is non-draggable and shows no inline reason; the assigned tint is the signal, and the slot's remove button is the way back.
- Removing the chip from its slot restores normal draggability.
- Multi-column slots are unaffected: distinct columns into one slot work as today, and within-slot duplicates were already blocked.

### Copy

All new user-facing strings (teaching hints, shelf notes) go through `src/content/copy.ts`, following the existing pattern; they are pinned verbatim by the poolShelves and DragSlots unit tests.

## Out of scope

- SEM construct picker and canvas inputs (R2, noted for slice 2).
- Slot-to-shelf hover/drag echo (R4, slice 2).
- Any visual-redesign styling beyond what the shelf structure itself requires; tokens and existing classes are reused as-is.
- Drag-and-drop mechanics, eligibility rules, stats, engine, and export are untouched except for the `addRole` guard.

## Testing

- New `DragSlots.test.tsx` (vitest + testing-library) with a fixture dataset covering all four levels plus date/count tags, asserting:
  fixed shelf order, membership, and counts; empty-shelf teaching copy; whole-shelf dim with header note; individual chip dim inside a lit shelf; tag badges; assigned marker; reuse guard (drop rejected, chip non-draggable, removal restores it).
- Store test for the `addRole` cross-role duplicate rejection.
- Playwright e2e specs checked for selectors that assume the flat pool structure; drag behavior is unchanged, so at most selector touch-ups are expected.
- Full gate before done: tsc, test:fast, e2e, fresh-clone.

## Verification

Success looks like: on any drag-config test, a user can read the slot requirement ("interval / ratio"), find shelves with exactly those names, and see at a glance which shelves are in play, which columns are already spoken for, and why an empty or dimmed shelf is that way - without a single exploratory drag.
