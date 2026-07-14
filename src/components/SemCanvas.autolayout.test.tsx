import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  SemCanvasUI, autoLayoutSlots, constructRole, contentKey, shouldAutoFit, latentBounds,
  NODE_W, NODE_H,
} from './SemCanvas'
import type { SemCanvasUIProps } from './SemCanvas'
import type { Construct, StructuralPath, Moderation } from '../state/session'

// T8 (R9, board-clearing slice): latent-canvas auto-layout + auto-Fit.
// Owner evidence: with 6 constructs the old default layout (DEFAULT_X + idx*(NODE_W+120)) drew one
// long overlapping row - constructs 4+ landed OUTSIDE the viewBox until Fit was clicked, and the
// exported figure inherited the mess. Un-dragged constructs now take DIAMOND slots classified from
// the structural paths + moderation edges; the connected wrapper auto-Fits after every content
// change unless the user has manually panned/zoomed (flag resets on Fit).

const noop = () => {}

// The 6-construct diamond model the owner evidence describes:
//   A(1), B(2)  exogenous (no incoming path)        -> left column
//   M(3)        mediator (incoming AND outgoing)     -> center column
//   T1(4), T2(5) terminal endogenous (incoming only) -> right column
//   MOD(6)      moderation-only (moderates M->T1)    -> low center
const diamond: Construct[] = [
  { id: 1, name: 'A', items: ['x1', 'x2'] },
  { id: 2, name: 'B', items: ['x3', 'x4'] },
  { id: 3, name: 'M', items: ['x5', 'x6'] },
  { id: 4, name: 'T1', items: ['x7', 'x8'] },
  { id: 5, name: 'T2', items: ['x9'] },
  { id: 6, name: 'MOD', items: ['x1'] },
]
const diamondPaths: StructuralPath[] = [
  { from: 1, to: 3 }, { from: 2, to: 3 }, { from: 3, to: 4 }, { from: 3, to: 5 },
]
const diamondMods: Moderation[] = [{ id: 1, moderatorId: 6, pathIndex: 2 }]

function renderLatent(over: Partial<SemCanvasUIProps> = {}) {
  return renderToStaticMarkup(
    <SemCanvasUI
      testId="cb-sem"
      constructs={diamond}
      columns={[]}
      paths={diamondPaths}
      modelKind="latent"
      mode="draw"
      estimates={null}
      running={false}
      moderations={diamondMods}
      onAddPath={noop}
      onRemovePath={noop}
      onMoveNode={noop}
      onSetMode={noop}
      onAddModeration={noop}
      onRemoveModeration={noop}
      {...over}
    />
  )
}

describe('constructRole - classification from paths + moderations', () => {
  it('classifies the diamond: exogenous / mediator / terminal / moderation-only', () => {
    expect(constructRole(1, diamondPaths, diamondMods)).toBe('exogenous')
    expect(constructRole(2, diamondPaths, diamondMods)).toBe('exogenous')
    expect(constructRole(3, diamondPaths, diamondMods)).toBe('mediator')
    expect(constructRole(4, diamondPaths, diamondMods)).toBe('terminal')
    expect(constructRole(5, diamondPaths, diamondMods)).toBe('terminal')
    expect(constructRole(6, diamondPaths, diamondMods)).toBe('moderator')
  })

  it('an isolated construct (no paths, no moderation) is exogenous (left column)', () => {
    expect(constructRole(9, [], [])).toBe('exogenous')
  })

  it('a construct that moderates but ALSO has its own structural path keeps its structural class', () => {
    // id 6 moderates AND receives a path -> terminal, not moderation-only
    const paths = [...diamondPaths, { from: 3, to: 6 }]
    expect(constructRole(6, paths, diamondMods)).toBe('terminal')
  })
})

describe('autoLayoutSlots - diamond slots for un-dragged constructs', () => {
  const slots = autoLayoutSlots(diamond, diamondPaths, diamondMods)

  it('returns a slot for every construct', () => {
    for (const c of diamond) expect(slots.get(c.id), `slot for ${c.name}`).toBeDefined()
  })

  it('exogenous share the left column, mediator sits right of them, terminals right of the mediator', () => {
    expect(slots.get(1)!.x).toBe(slots.get(2)!.x)          // left column aligned
    expect(slots.get(4)!.x).toBe(slots.get(5)!.x)          // right column aligned
    expect(slots.get(3)!.x).toBeGreaterThan(slots.get(1)!.x)
    expect(slots.get(4)!.x).toBeGreaterThan(slots.get(3)!.x)
  })

  it('the moderation-only construct sits LOW CENTER: mediator-column x, below every other construct', () => {
    expect(slots.get(6)!.x).toBe(slots.get(3)!.x)
    const othersMaxY = Math.max(...[1, 2, 3, 4, 5].map((id) => slots.get(id)!.y))
    expect(slots.get(6)!.y).toBeGreaterThan(othersMaxY + NODE_H)   // clear of the diamond body
  })

  it('same-column constructs stack vertically with even spacing and no oval overlap', () => {
    const pitchLeft = Math.abs(slots.get(1)!.y - slots.get(2)!.y)
    const pitchRight = Math.abs(slots.get(4)!.y - slots.get(5)!.y)
    expect(pitchLeft).toBeGreaterThanOrEqual(NODE_H)
    expect(pitchLeft).toBe(pitchRight)                     // even spacing, same rule per column
  })

  it('no two slots overlap (separated by a full node extent on at least one axis)', () => {
    const ids = diamond.map((c) => c.id)
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const pa = slots.get(ids[a])!; const pb = slots.get(ids[b])!
        const dx = Math.abs(pa.x - pb.x); const dy = Math.abs(pa.y - pb.y)
        expect(dx >= NODE_W || dy >= NODE_H, `slots ${ids[a]},${ids[b]} overlap (dx=${dx} dy=${dy})`).toBe(true)
      }
    }
  })

  it('every slot oval sits fully inside the latentBounds (Fit-target) viewBox - export contains the diagram', () => {
    const vb = latentBounds(diamond, diamondPaths, diamondMods)
    for (const c of diamond) {
      const p = slots.get(c.id)!
      expect(p.x, `${c.name} left`).toBeGreaterThanOrEqual(vb.x)
      expect(p.x + NODE_W, `${c.name} right`).toBeLessThanOrEqual(vb.x + vb.w)
      expect(p.y, `${c.name} top`).toBeGreaterThanOrEqual(vb.y)
      expect(p.y + NODE_H, `${c.name} bottom`).toBeLessThanOrEqual(vb.y + vb.h)
    }
  })

  it('renders the 6-construct diamond without NaN and with all 6 ovals', () => {
    const html = renderLatent({ viewBox: latentBounds(diamond, diamondPaths, diamondMods) })
    expect((html.match(/<ellipse class="sem-oval/g) ?? []).length).toBe(6)
    expect(html).not.toContain('NaN')
  })
})

describe('autoLayoutSlots - manual (dragged) positions override', () => {
  it('a construct with stored x/y renders AT that position; un-dragged siblings keep their slots', () => {
    const dragged = diamond.map((c) => (c.id === 3 ? { ...c, x: 10, y: 500 } : c))
    const html = renderLatent({ constructs: dragged })
    // M's oval center = top-left + half extents
    expect(html).toContain(`cx="${10 + NODE_W / 2}" cy="${500 + NODE_H / 2}"`)
    // an un-dragged sibling (A, id 1) still draws at its auto slot
    const slot = autoLayoutSlots(dragged, diamondPaths, diamondMods).get(1)!
    expect(html).toContain(`cx="${slot.x + NODE_W / 2}" cy="${slot.y + NODE_H / 2}"`)
  })

  it('latentBounds honours the manual position too (the Fit/export box contains the dragged construct)', () => {
    const dragged = diamond.map((c) => (c.id === 3 ? { ...c, x: -400, y: 900 } : c))
    const vb = latentBounds(dragged, diamondPaths, diamondMods)
    expect(vb.x).toBeLessThanOrEqual(-400)
    expect(vb.y + vb.h).toBeGreaterThanOrEqual(900 + NODE_H)
  })
})

describe('autoLayoutSlots - live reclassification as paths are drawn', () => {
  const three: Construct[] = [
    { id: 1, name: 'A', items: ['x1'] },
    { id: 2, name: 'B', items: ['x2'] },
    { id: 3, name: 'C', items: ['x3'] },
  ]

  it('with no paths, every construct is exogenous: one left column (same x)', () => {
    const slots = autoLayoutSlots(three, [], [])
    expect(slots.get(1)!.x).toBe(slots.get(2)!.x)
    expect(slots.get(2)!.x).toBe(slots.get(3)!.x)
  })

  it('drawing A->B moves B (drawn-into, terminal) to the right of A', () => {
    const slots = autoLayoutSlots(three, [{ from: 1, to: 2 }], [])
    expect(slots.get(2)!.x).toBeGreaterThan(slots.get(1)!.x)
  })

  it('drawing B->C after A->B makes B a mediator: A < B < C left-to-right', () => {
    const slots = autoLayoutSlots(three, [{ from: 1, to: 2 }, { from: 2, to: 3 }], [])
    expect(slots.get(2)!.x).toBeGreaterThan(slots.get(1)!.x)
    expect(slots.get(3)!.x).toBeGreaterThan(slots.get(2)!.x)
  })
})

describe('contentKey + shouldAutoFit - the auto-Fit trigger seam (connected wrapper)', () => {
  const base = () => contentKey(diamond, diamondPaths, diamondMods)

  it('is STABLE across x/y drags (a node drag must never re-fit the view)', () => {
    const dragged = diamond.map((c) => ({ ...c, x: 999, y: 999 }))
    expect(contentKey(dragged, diamondPaths, diamondMods)).toBe(base())
  })

  it('changes on construct add', () => {
    const added = [...diamond, { id: 7, name: 'NEW', items: [] }]
    expect(contentKey(added, diamondPaths, diamondMods)).not.toBe(base())
  })

  it('changes on an item toggle (item count changes latentBounds)', () => {
    const toggled = diamond.map((c) => (c.id === 1 ? { ...c, items: [...c.items, 'x9'] } : c))
    expect(contentKey(toggled, diamondPaths, diamondMods)).not.toBe(base())
  })

  it('changes on path add (reclassification can move un-dragged constructs)', () => {
    expect(contentKey(diamond, [...diamondPaths, { from: 4, to: 5 }], diamondMods)).not.toBe(base())
  })

  it('changes on moderation add (moderator placement drops low center)', () => {
    expect(contentKey(diamond, diamondPaths, [...diamondMods, { id: 2, moderatorId: 5, pathIndex: 0 }])).not.toBe(base())
  })

  it('shouldAutoFit: re-fits on a changed key ONLY while the user has not adjusted the view', () => {
    expect(shouldAutoFit('k2', 'k1', false)).toBe(true)    // content changed, view untouched -> fit
    expect(shouldAutoFit('k2', 'k1', true)).toBe(false)    // user panned/zoomed -> leave the view alone
    expect(shouldAutoFit('k1', 'k1', false)).toBe(false)   // nothing changed -> no churn
  })
})
