import { useState, useRef } from 'react'
import { useSession } from '../state/session'
import type { Construct, StructuralPath, Moderation, NodePosition } from '../state/session'
import type { CbSemResult } from '../lib/stats/cbSem'

const BLUE = 'var(--info)'

/** APA leading-zero-stripped, fixed 2-dp formatter for in-[-1,1] coefficients (β, loadings). */
function fmtCoef(v: number): string {
  const s = Math.abs(v).toFixed(2).replace(/^0/, '')
  return (v < 0 ? '-' : '') + s
}
/** R² is reported 2-dp, leading zero stripped, never negative-signed in display. */
function fmtR2(v: number): string {
  return v.toFixed(2).replace(/^0/, '')
}

export interface ViewBox { x: number; y: number; w: number; h: number }

/** Map a screen-space point (clientX/Y) into the SVG viewBox space, accounting for zoom+pan.
 *  Pure + DOM-free so the drag math is unit-tested without a real SVG. */
export function screenToViewBox(
  clientX: number, clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  vb: ViewBox,
): { x: number; y: number } {
  return {
    x: vb.x + ((clientX - rect.left) / rect.width) * vb.w,
    y: vb.y + ((clientY - rect.top) / rect.height) * vb.h,
  }
}

const BASE_VB: ViewBox = { x: 0, y: 0, w: 720, h: 320 }
const ZOOM_STEP = 1.2

// Layout geometry (static; interactions move x/y in Unit 3b).
export const NODE_W = 132   // oval / rectangle width
export const NODE_H = 64    // oval / rectangle height
export const ITEM_W = 56
export const ITEM_H = 22
const ITEM_GAP = 6
const ITEM_SIDE_GAP = 28  // gap between oval edge and item stack
const DEFAULT_X = 80
const DEFAULT_Y = 70
const GRID_GAP = 28   // min horizontal gap between path-mode grid columns (used to pick cols-per-row)

/** Which side a construct's item boxes sit on, from its center's position WITHIN the span of all
 *  construct centers — viewBox-INDEPENDENT, so zoom/pan/fit never reflow the items (and the
 *  content-fitting viewBox can contain them): leftmost third → left, rightmost third → right,
 *  middle → below. A single (or colocated) construct has no span, so its items sit below. */
function itemSide(cx: number, minCx: number, maxCx: number): 'left' | 'right' | 'below' {
  const span = maxCx - minCx
  if (span < 1) return 'below'
  if (cx <= minCx + span / 3) return 'left'
  if (cx >= maxCx - span / 3) return 'right'
  return 'below'
}

interface Center { cx: number; cy: number; left: number; top: number }
interface ItemGeom { ix: number; iy: number; lx1: number; ly1: number; labelX: number; labelAnchor: 'start' | 'middle' | 'end' }

/** Geometry of item box k (of ni) for a construct centered at c, given its chosen side. Shared by the
 *  renderer and latentBounds so the drawn boxes and the fitted viewBox can never disagree. */
function itemGeom(side: 'left' | 'right' | 'below', c: Center, ni: number, k: number): ItemGeom {
  const stackY = c.cy - ((ni - 1) / 2) * (ITEM_H + ITEM_GAP) + k * (ITEM_H + ITEM_GAP) - ITEM_H / 2
  if (side === 'left') {
    const ix = c.left - ITEM_SIDE_GAP - ITEM_W
    return { ix, iy: stackY, lx1: ix + ITEM_W, ly1: stackY + ITEM_H / 2, labelX: ix - 4, labelAnchor: 'end' }
  }
  if (side === 'right') {
    const ix = c.left + NODE_W + ITEM_SIDE_GAP
    return { ix, iy: stackY, lx1: ix, ly1: stackY + ITEM_H / 2, labelX: ix + ITEM_W + 4, labelAnchor: 'start' }
  }
  const ix = c.cx + (k - (ni - 1) / 2) * (ITEM_W + 12) - ITEM_W / 2
  const iy = c.top + NODE_H + ITEM_SIDE_GAP
  return { ix, iy, lx1: ix + ITEM_W / 2, ly1: iy, labelX: ix + ITEM_W / 2, labelAnchor: 'middle' }
}

export interface SemCanvasUIProps {
  testId: string
  constructs: Construct[]
  columns: string[]
  paths: StructuralPath[]
  modelKind: 'latent' | 'path'
  mode: 'draw' | 'move' | 'delete'
  estimates?: CbSemResult['estimates'] | null
  running: boolean
  viewBox?: ViewBox
  moderations: Moderation[]
  /** Model estimator (e.g. 'ML', 'WLSMV'); moderation is blocked under WLSMV/ordinal. Defaults to 'ML'. */
  estimator?: string
  /** P2 shelf model (path mode only, spec Amendment A - 2026-07-11): drag-moved node positions keyed
   *  by column NAME (T2, session.ts `TestSetup.nodePositions`). A column absent from this map has
   *  never been dragged - it falls back to the existing auto-grid slot (pathNodeCenter) for its
   *  placed-index, same "undefined means default" convention latent already uses for Construct.x/y. */
  nodePositions?: Record<string, NodePosition>
  /** P2 shelf model (path mode only): used-eligible columns NOT currently placed on the canvas -
   *  rendered as add-chips in a shelf strip below the svg. Undefined/omitted → no shelf renders
   *  (latent mode, or any caller that hasn't wired the shelf). */
  shelfColumns?: string[]
  onAddPath(from: number, to: number): void
  onRemovePath(index: number): void
  onMoveNode(id: number, x: number, y: number): void
  onSetMode(m: 'draw' | 'move' | 'delete'): void
  onAddModeration(moderatorId: number, pathIndex: number): void
  onRemoveModeration(id: number): void
  /** P2 shelf model (path mode only): click a shelf chip to place its column onto the canvas
   *  (spec Amendment A item 1). */
  onPlaceColumn?(name: string): void
  /** P2 shelf model (path mode only): delete-mode click on a placed node - "delete = back to the
   *  shelf" (spec Amendment A item 2; its touching paths go with it, per the store's removeColumn).
   *  Latent mode's node-delete stays a no-op here (paths-only rule - untouched, its own open
   *  question, not this slice's scope). */
  onRemoveNode?(id: number): void
}

/** Whether a delete-mode node click removes the node, by model kind (P2 shelf model, spec
 *  Amendment A item 2 - path mode only; latent stays a no-op, the paths-only rule, untouched this
 *  slice). Extracted as a pure predicate (mirrors moderationGuardReason) so the decision is
 *  unit-testable without simulating a click. */
export function nodeDeleteAction(modelKind: 'latent' | 'path'): boolean {
  return modelKind === 'path'
}

export interface ModerationGuardArgs {
  moderatorId: number
  pathIndex: number
  constructs: Construct[]
  paths: StructuralPath[]
  moderations: Moderation[]
  estimator: string
  modelKind: 'latent' | 'path'
}

/** Pure validation for the moderation gesture (A7 guards) — returns null when the gesture is valid,
 *  else a plain-language reason to show the user. Called BEFORE onAddModeration fires so an invalid
 *  gesture never reaches the store. Order matches the spec's guard list: mode -> estimator -> self -> dup. */
export function moderationGuardReason(a: ModerationGuardArgs): string | null {
  if (a.modelKind === 'path') return 'Moderation is not available in path-analysis (observed-only) mode.'
  if (a.estimator === 'WLSMV') return 'Moderation requires an ML-family estimator; switch off WLSMV (ordinal) to draw a moderation edge.'
  const p = a.paths[a.pathIndex]
  if (!p) return null   // stale index — no-op, not a user-facing guard
  if (a.moderatorId === p.from || a.moderatorId === p.to) return 'A construct cannot moderate its own path (it is already the source or target).'
  if (a.moderations.some((m) => m.moderatorId === a.moderatorId && m.pathIndex === a.pathIndex)) {
    return 'That construct already moderates this path.'
  }
  return null
}

/** A canvas node: latent constructs are id-addressed; path-mode columns use their array index as id. */
interface Node { id: number; name: string; items: string[]; x?: number; y?: number }

/** Single source of truth for "what nodes does this model draw, and at what ids". Path mode: a
 *  node's id is its POSITION in `columns` (the PLACED-columns list, P2 shelf model - T2, session.ts
 *  `withPathModeConstructs`/`moveNode` share this same indexing). x/y come from `nodePositions` when
 *  the node has been dragged; undefined otherwise (falls back to the auto-grid slot at render time -
 *  see SemCanvasUI's center resolution). */
export function nodesOf(p: Pick<SemCanvasUIProps, 'constructs' | 'columns' | 'modelKind' | 'nodePositions'>): Node[] {
  if (p.modelKind === 'path') {
    return p.columns.map((name, i) => {
      const pos = p.nodePositions?.[name]
      return { id: i, name, items: [], x: pos?.x, y: pos?.y }
    })
  }
  return p.constructs
}

/** Content-fitting viewBox for the latent (Full-AMOS) figure: the bounding box of every construct
 *  oval and every item box, plus padding for the loading / R² labels. Used as the canvas's initial
 *  viewBox and the "Fit" target so the captured/exported figure always contains the whole diagram
 *  (fixes the export clip where the outermost constructs' item boxes ran off a fixed viewBox). */
export function latentBounds(constructs: Construct[]): ViewBox {
  if (!constructs.length) return BASE_VB
  const centers = constructs.map((n, i) => nodeCenter(n, i))
  const cxs = centers.map((c) => c.cx)
  const minCx = Math.min(...cxs)
  const maxCx = Math.max(...cxs)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const grow = (x: number, y: number, w = 0, h = 0) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h)
  }
  constructs.forEach((n, i) => {
    const c = centers[i]
    grow(c.left, c.top, NODE_W, NODE_H)            // construct oval
    const side = itemSide(c.cx, minCx, maxCx)
    n.items.forEach((_, k) => {
      const g = itemGeom(side, c, n.items.length, k)
      grow(g.ix, g.iy, ITEM_W, ITEM_H)             // each item box
    })
  })
  const PAD = 30   // room for measurement (loading) labels beside items + R² labels above the ovals
  return { x: minX - PAD, y: minY - PAD, w: (maxX - minX) + 2 * PAD, h: (maxY - minY) + 2 * PAD }
}

/** Cursor affordance for a canvas node, by tool mode - same rule for BOTH node kinds since the P2
 *  shelf model (spec Amendment A item 3): path-mode nodes now drag through the identical pointer
 *  mechanism as latent, so grab is no longer latent-only. Default while running (no gesture is
 *  live); pointer otherwise (draw/delete click gestures). */
function nodeCursor(running: boolean, mode: 'draw' | 'move' | 'delete'): string {
  return running ? 'default' : mode === 'move' ? 'grab' : 'pointer'
}

/** Center of a latent node given its (top-left) x/y, with a left-to-right default for unplaced nodes. */
function nodeCenter(n: Node, fallbackIdx: number) {
  const x = (n.x ?? DEFAULT_X + fallbackIdx * (NODE_W + 120)) + NODE_W / 2
  const y = (n.y ?? DEFAULT_Y) + NODE_H / 2
  return { cx: x, cy: y, left: x - NODE_W / 2, top: y - NODE_H / 2 }
}

/** Path-mode column nodes are auto-laid in a wrapped grid sized to the viewBox so up to ~9 observed
 *  rectangles stay WITHIN [0,W]×[0,H] (and thus clickable). Positions derive purely from index/count
 *  + viewBox dims (path nodes carry no x/y), so estimate overlays keyed off the same centers track it. */
export function pathNodeCenter(idx: number, count: number, W: number, H: number) {
  // Columns per row: as many as fit the width with a small inter-node gap, capped so we never overflow.
  const cols = Math.max(1, Math.min(count, Math.floor((W + GRID_GAP) / (NODE_W + GRID_GAP))))
  const rows = Math.ceil(count / cols)
  const col = idx % cols
  const row = Math.floor(idx / cols)
  // Even horizontal pitch that centers the whole row block within W; same for vertical within H.
  const pitchX = cols > 1 ? (W - NODE_W) / (cols - 1) : 0
  const cx = (cols > 1 ? NODE_W / 2 + col * pitchX : W / 2)
  const pitchY = rows > 1 ? (H - NODE_H) / (rows - 1) : 0
  const cy = (rows > 1 ? NODE_H / 2 + row * pitchY : H / 2)
  return { cx, cy, left: cx - NODE_W / 2, top: cy - NODE_H / 2 }
}

/** Pure presentational canvas — testable with renderToStaticMarkup. */
export function SemCanvasUI({
  testId, constructs, columns, paths, modelKind, mode, estimates, running,
  viewBox: vbProp, moderations, estimator = 'ML', nodePositions, shelfColumns,
  onAddPath, onRemovePath, onMoveNode: _onMoveNode, onSetMode,
  onAddModeration, onRemoveModeration, onPlaceColumn, onRemoveNode,
}: SemCanvasUIProps) {
  // pending draw source (click source → target); cancel when same node re-clicked
  const [pending, setPending] = useState<number | null>(null)
  // last-blocked-gesture explanation (A7 guards); cleared on the next valid gesture
  const [modGuard, setModGuard] = useState<string | null>(null)

  const isPath = modelKind === 'path'
  const nodes = nodesOf({ constructs, columns, modelKind, nodePositions })

  const empty = nodes.length === 0
  // id → center, for resolving path endpoints by node id (Map uses strict-equality; id 0 is safe).
  // Path mode: a MOVED node (both x/y set, via nodePositions) resolves like a latent node; an
  // unmoved one auto-grids into the viewBox (P2 shelf model, spec Amendment A item 3 - this slice).
  const vbW = vbProp ? vbProp.w : 760
  const vbH = vbProp ? vbProp.h : 360
  const centers = new Map<number, ReturnType<typeof nodeCenter>>()
  nodes.forEach((n, i) =>
    centers.set(n.id, isPath
      ? (n.x !== undefined && n.y !== undefined ? nodeCenter(n, i) : pathNodeCenter(i, nodes.length, vbW, vbH))
      : nodeCenter(n, i)))
  // Span of construct centers → viewBox-independent item-side selection (latent only).
  const latentCxs = isPath ? [] : nodes.map((n) => centers.get(n.id)!.cx)
  const minCx = latentCxs.length ? Math.min(...latentCxs) : 0
  const maxCx = latentCxs.length ? Math.max(...latentCxs) : 0

  function clickNode(id: number) {
    if (running) return
    if (mode === 'delete') {
      // P2 shelf model (spec Amendment A item 2): path-mode delete removes the node (paths go with
      // it, chip returns to the shelf) via the connected wrapper's onRemoveNode. Latent stays a
      // no-op here - the paths-only rule, untouched this slice, its own open question.
      if (nodeDeleteAction(modelKind)) onRemoveNode?.(id)
      return
    }
    if (mode !== 'draw') return
    if (pending === null) { setPending(id); return }
    if (pending === id) { setPending(null); return }   // cancel on same node
    const dup = paths.some((p) => p.from === pending && p.to === id)
    if (!dup) onAddPath(pending, id)                   // dedupe: never add an existing directed edge
    setPending(null)
  }

  // Completes the OTHER half of the same draw-mode gesture: a pending moderator-candidate node,
  // clicked into an existing path's midpoint handle, records a moderation edge instead of a path.
  function clickPathMidpoint(pathIndex: number) {
    if (running || mode !== 'draw' || pending === null) return
    const reason = moderationGuardReason({
      moderatorId: pending, pathIndex, constructs, paths, moderations, estimator, modelKind,
    })
    if (reason) { setModGuard(reason); setPending(null); return }
    setModGuard(null)
    onAddModeration(pending, pathIndex)
    setPending(null)
  }

  const toolBtn = (m: 'draw' | 'move' | 'delete', label: string) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={mode === m}
      className={`btn ghost${mode === m ? ' on' : ''}`}
      disabled={running}
      onClick={() => onSetMode(m)}
    >
      {label}
    </button>
  )

  return (
    <div className="sem-canvas" style={{ position: 'relative' }}>
      <div role="toolbar" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {toolBtn('draw', 'Draw path')}
        {toolBtn('move', 'Move')}
        {toolBtn('delete', 'Delete')}
      </div>
      {modGuard && (
        <p className="hint" role="alert" style={{ color: 'var(--error-tx)', marginTop: 4 }}>{modGuard}</p>
      )}
      {empty && (
        // DRAFT copy - owner render review pending (spec Amendment A item 7, P2 shelf model)
        <p className="hint" role="status" style={{ padding: 12 }}>
          {isPath
            ? 'Your canvas is empty. Add variables from the shelf below, then draw paths between them.'
            : 'Add a construct to start the diagram.'}
        </p>
      )}
      <svg
        id={`figure-path-diagram-${testId}`}
        width="100%"
        viewBox={vbProp ? `${vbProp.x} ${vbProp.y} ${vbProp.w} ${vbProp.h}` : '0 0 760 360'}
        preserveAspectRatio="xMidYMid meet"
        style={{ background: 'var(--fill)', border: '1px solid var(--line)', borderRadius: 10 }}
      >
        <defs>
          <marker id="sem-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={BLUE} />
          </marker>
          <marker id="sem-arrow-mod" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
          </marker>
        </defs>

        {/* Structural path arrows + (post-run) β label at the midpoint. */}
        {paths.map((p, i) => {
          const a = centers.get(p.from)
          const b = centers.get(p.to)
          if (!a || !b) return null
          const beta = estimates?.paths.find((e) => e.from === p.from && e.to === p.to)?.beta
          const mx = (a.cx + b.cx) / 2
          const my = (a.cy + b.cy) / 2
          return (
            <g key={`path-${i}`}>
              <line
                className="sem-path"
                x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
                stroke={BLUE} strokeWidth={2}
                markerEnd="url(#sem-arrow)"
              />
              {beta != null && (
                <text
                  className="sem-path-label"
                  data-beta={`${p.from}-${p.to}`}
                  x={mx} y={my - 6}
                  textAnchor="middle" fontSize={11} fontWeight={600} fill={BLUE}
                  style={{ paintOrder: 'stroke', stroke: 'var(--fill)', strokeWidth: 3 }}
                >
                  {`β = ${fmtCoef(beta)}`}
                </text>
              )}
            </g>
          )
        })}

        {/* Moderation edges: dashed clay arrow from the moderator's oval to the moderated path's
         *  midpoint, with a delete-mode handle of its own and a post-run interaction-β label. */}
        {moderations.map((m) => {
          const modC = centers.get(m.moderatorId)
          const p = paths[m.pathIndex]
          const a = p ? centers.get(p.from) : undefined
          const b = p ? centers.get(p.to) : undefined
          if (!modC || !a || !b) return null
          const mx = (a.cx + b.cx) / 2
          const my = (a.cy + b.cy) / 2
          const beta = estimates?.moderation?.find(
            (e) => e.moderatorId === m.moderatorId && e.pathIndex === m.pathIndex,
          )?.beta
          const hx = (modC.cx + mx) / 2
          const hy = (modC.cy + my) / 2
          return (
            <g key={`mod-${m.id}`}>
              <line
                className="sem-mod-arrow"
                x1={modC.cx} y1={modC.cy} x2={mx} y2={my}
                stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 4"
                markerEnd="url(#sem-arrow-mod)"
              />
              {beta != null && (
                <text
                  className="sem-mod-label"
                  x={hx} y={hy - 6}
                  textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--accent)"
                  style={{ paintOrder: 'stroke', stroke: 'var(--fill)', strokeWidth: 3 }}
                >
                  {`β = ${fmtCoef(beta)}`}
                </text>
              )}
            </g>
          )
        })}

        {/* Nodes: latent = oval + item boxes + measurement lines; path = observed rectangle. */}
        {nodes.map((n) => {
          const c = centers.get(n.id)!
          if (isPath) {
            return (
              <g key={`node-${n.id}`}>
                <rect
                  className="sem-node-rect"
                  data-node-id={n.id}
                  x={c.left} y={c.top} width={NODE_W} height={NODE_H} rx={4}
                  fill="var(--card)" stroke={BLUE} strokeWidth={2}
                  // P2 shelf model (spec Amendment A item 3): path-mode nodes drag now too (the
                  // connected wrapper's onPointerDown gate was relaxed from latent-only), so the
                  // cursor rule is identical to a latent oval's - see nodeCursor.
                  style={{ cursor: nodeCursor(running, mode) }}
                  onClick={() => clickNode(n.id)}
                />
                <text x={c.cx} y={c.cy + 4} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--text)" pointerEvents="none">{n.name}</text>
                {estimates?.r2[n.id] != null && (
                  <text
                    className="sem-r2-label"
                    data-r2={String(n.id)}
                    x={c.cx} y={c.top - 6}
                    textAnchor="middle" fontSize={11} fill="var(--muted)" pointerEvents="none"
                    style={{ paintOrder: 'stroke', stroke: 'var(--fill)', strokeWidth: 3 }}
                  >
                    {`R² = ${fmtR2(estimates!.r2[n.id])}`}
                  </text>
                )}
              </g>
            )
          }
          const tooFew = n.items.length < 2
          const side = itemSide(c.cx, minCx, maxCx)
          const ni = n.items.length
          return (
            <g key={`node-${n.id}`}>
              {n.items.map((item, k) => {
                const { ix, iy, lx1, ly1, labelX, labelAnchor } = itemGeom(side, c, ni, k)
                const load = estimates?.loadings[item]
                return (
                  <g key={`item-${k}`}>
                    <line
                      className="sem-measure"
                      x1={lx1} y1={ly1} x2={c.cx} y2={c.cy}
                      stroke="var(--line)" strokeWidth={1}
                    />
                    <rect className="sem-item" x={ix} y={iy} width={ITEM_W} height={ITEM_H} rx={3} fill="var(--card)" stroke="var(--line)" />
                    <text x={ix + ITEM_W / 2} y={iy + ITEM_H / 2 + 4} textAnchor="middle" fontSize={11} fill="var(--text)">{item}</text>
                    {load != null && (
                      <text
                        className="sem-load-label"
                        data-loading={item}
                        x={labelX} y={iy + ITEM_H / 2 - 2}
                        textAnchor={labelAnchor} fontSize={9} fill="var(--muted)"
                        style={{ paintOrder: 'stroke', stroke: 'var(--fill)', strokeWidth: 3 }}
                      >
                        {fmtCoef(load)}
                      </text>
                    )}
                  </g>
                )
              })}
              {/* latent oval — pending highlight ring rendered first so oval draws on top */}
              {pending === n.id && (
                <ellipse
                  cx={c.cx} cy={c.cy} rx={NODE_W / 2 + 6} ry={NODE_H / 2 + 6}
                  fill="none" stroke={BLUE} strokeWidth={1} strokeDasharray="3 3" pointerEvents="none"
                />
              )}
              <ellipse
                className={`sem-oval${tooFew ? ' incomplete' : ''}`}
                data-node-id={n.id}
                cx={c.cx} cy={c.cy} rx={NODE_W / 2} ry={NODE_H / 2}
                fill="var(--card)" stroke={BLUE} strokeWidth={2}
                strokeDasharray={tooFew ? '5 4' : undefined}
                opacity={tooFew ? 0.6 : undefined}
                style={{ cursor: nodeCursor(running, mode) }}
                onClick={() => clickNode(n.id)}
              />
              <text x={c.cx} y={c.cy + 4} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--text)" pointerEvents="none">{n.name}</text>
              {estimates?.r2[n.id] != null && (
                <text
                  className="sem-r2-label"
                  data-r2={String(n.id)}
                  x={c.cx} y={c.top - 6}
                  textAnchor="middle" fontSize={11} fill="var(--muted)" pointerEvents="none"
                  style={{ paintOrder: 'stroke', stroke: 'var(--fill)', strokeWidth: 3 }}
                >
                  {`R² = ${fmtR2(estimates!.r2[n.id])}`}
                </text>
              )}
            </g>
          )
        })}

        {/* Active midpoint handles — rendered AFTER the nodes layer (above) so a covering node oval/rect
         *  never intercepts the click. A default 3-construct chain lays SN-TI's midpoint exactly under
         *  TA's oval, so painting/hit-testing this layer earlier made that path un-clickable. Lines and
         *  β-labels stay in their layer above; only the clickable handle circles move. */}
        {paths.map((p, i) => {
          if (!(mode === 'delete' || (mode === 'draw' && pending !== null))) return null
          const a = centers.get(p.from)
          const b = centers.get(p.to)
          if (!a || !b) return null
          const mx = (a.cx + b.cx) / 2
          const my = (a.cy + b.cy) / 2
          return (
            <circle
              key={`path-handle-${i}`}
              className={mode === 'delete' ? undefined : 'sem-mod-target'}
              data-path-index={i}
              cx={mx} cy={my} r={mode === 'delete' ? 9 : 7}
              fill="var(--card)"
              stroke={mode === 'delete' ? BLUE : 'var(--accent)'}
              style={{ cursor: 'pointer' }}
              onClick={() => (mode === 'delete' ? (!running && onRemovePath(i)) : clickPathMidpoint(i))}
            />
          )
        })}
        {mode === 'delete' && moderations.map((m) => {
          const modC = centers.get(m.moderatorId)
          const p = paths[m.pathIndex]
          const a = p ? centers.get(p.from) : undefined
          const b = p ? centers.get(p.to) : undefined
          if (!modC || !a || !b) return null
          const mx = (a.cx + b.cx) / 2
          const my = (a.cy + b.cy) / 2
          const hx = (modC.cx + mx) / 2
          const hy = (modC.cy + my) / 2
          return (
            <circle
              key={`mod-handle-${m.id}`}
              className="sem-mod-delete-target"
              cx={hx} cy={hy} r={9}
              fill="var(--card)" stroke="var(--accent)" style={{ cursor: 'pointer' }}
              onClick={() => !running && onRemoveModeration(m.id)}
            />
          )
        })}
      </svg>
      {/* P2 shelf model (path mode only, spec Amendment A item 1): every used-eligible column NOT
       *  yet placed waits here as an add-chip; one click places it on the canvas (auto-position at
       *  the next free grid slot - see nodesOf/pathNodeCenter). Reuses the app's .chip idiom
       *  (DragSlots.tsx) with a "+ name" affordance, styled as a plain button so no drag machinery
       *  is needed for a single-target placement. */}
      {isPath && shelfColumns && onPlaceColumn && (
        <div className="sem-shelf" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {shelfColumns.map((name) => (
            <button
              key={name}
              type="button"
              className="chip"
              aria-label={`Add ${name} to the canvas`}
              disabled={running}
              onClick={() => onPlaceColumn(name)}
              style={{ border: '1px solid var(--line)', font: 'inherit', cursor: running ? 'not-allowed' : 'pointer' }}
            >
              {`+ ${name}`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** The canvas's default/"Fit" viewBox: content-fitted to the constructs in latent mode (so the
 *  exported figure contains the whole diagram); the fixed BASE_VB in path mode (the column grid
 *  auto-fits BASE_VB) and as the empty/loading fallback. */
function defaultVb(setup: { modelKind?: 'latent' | 'path'; constructs?: Construct[] } | undefined): ViewBox {
  if (setup && (setup.modelKind ?? 'latent') === 'latent' && setup.constructs && setup.constructs.length) {
    return latentBounds(setup.constructs)
  }
  return BASE_VB
}

/** Store-connected canvas: useSession wiring + pointer-drag move + viewBox zoom/pan + resize grip.
 *  Items "keep their side" for free — SemCanvasUI draws item boxes relative to the (moved) node centre. */
export function SemCanvas({ testId }: { testId: string }) {
  const s = useSession()
  const setup = s.setups[testId]
  const [mode, setMode] = useState<'draw' | 'move' | 'delete'>('draw')
  const [vb, setVb] = useState<ViewBox>(() => defaultVb(s.setups[testId]))
  const [height, setHeight] = useState(360)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  // active gesture: dragging a node (move tool) or panning the canvas (any tool, blank-space drag)
  const drag = useRef<
    | { kind: 'node'; id: number; offX: number; offY: number }
    | { kind: 'pan'; startX: number; startY: number; vb0: ViewBox }
    | { kind: 'resize'; startY: number; h0: number }
    | null
  >(null)

  if (!setup) return null
  const running = s.runStatus === 'running'
  const modelKind = setup.modelKind ?? 'latent'
  const usedColumns = s.columns.filter((c) => c.used).map((c) => c.name)
  // P2 shelf model (spec Amendment A item 1, this slice): the canvas's node source is the setup's
  // PLACED columns (T2, session.ts), not every used column - "the model you see is the model that
  // runs". The shelf below the canvas offers every used-eligible column NOT yet placed.
  const placed = setup.placed ?? []
  const columns = modelKind === 'path' ? placed : usedColumns
  const shelfColumns = modelKind === 'path' ? usedColumns.filter((name) => !placed.includes(name)) : undefined

  const svgRect = () => {
    const svg = wrapRef.current?.querySelector('svg')
    const r = svg?.getBoundingClientRect()
    return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : { left: 0, top: 0, width: vb.w, height: vb.h }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (running) return
    const target = (e.target as Element).closest('[data-node-id]')
    const nodeId = target ? Number(target.getAttribute('data-node-id')) : null
    // P2 shelf model (spec Amendment A item 3): the modelKind==='latent' gate is relaxed to include
    // 'path' too - path-mode nodes now drag through this SAME mechanism (moveNode's path branch,
    // T2, persists the result keyed by column name).
    if (mode === 'move' && nodeId !== null && modelKind === 'latent') {
      // dragging a latent node
      const idx = setup.constructs?.findIndex((x) => x.id === nodeId) ?? -1
      const c = idx >= 0 ? setup.constructs![idx] : undefined
      // Guard: abort if the node id does not match any current construct (stale data-node-id)
      if (c === undefined) { drag.current = null; return }
      // A construct added via the form has no x/y yet — start the drag from where the node is
      // actually drawn (SemCanvasUI's nodeCenter default), so the first drag doesn't jump from NaN.
      const cx = c.x ?? DEFAULT_X + idx * (NODE_W + 120)
      const cy = c.y ?? DEFAULT_Y
      const p = screenToViewBox(e.clientX, e.clientY, svgRect(), vb)
      drag.current = { kind: 'node', id: nodeId, offX: p.x - cx, offY: p.y - cy }
    } else if (mode === 'move' && nodeId !== null && modelKind === 'path') {
      // dragging a path-mode node: start from wherever it is ACTUALLY drawn right now - a moved
      // node's nodePositions entry (top-left, same convention as latent's Construct.x/y), or its
      // auto-grid slot (pathNodeCenter) for a node that has never been dragged - the exact
      // resolution SemCanvasUI's own centers use, so the first drag never jumps.
      const name = placed[nodeId]
      if (name === undefined) { drag.current = null; return }
      const pos = setup.nodePositions?.[name]
      const slot = pathNodeCenter(nodeId, placed.length, vb.w, vb.h)
      const x0 = pos?.x ?? slot.left
      const y0 = pos?.y ?? slot.top
      const p = screenToViewBox(e.clientX, e.clientY, svgRect(), vb)
      drag.current = { kind: 'node', id: nodeId, offX: p.x - x0, offY: p.y - y0 }
    } else {
      drag.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, vb0: vb }
    }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    if (d.kind === 'node') {
      const p = screenToViewBox(e.clientX, e.clientY, svgRect(), vb)
      s.moveNode(testId, d.id, Math.round(p.x - d.offX), Math.round(p.y - d.offY))
    } else if (d.kind === 'pan') {
      const r = svgRect()
      const dx = ((e.clientX - d.startX) / r.width) * vb.w
      const dy = ((e.clientY - d.startY) / r.height) * vb.h
      setVb({ ...d.vb0, x: d.vb0.x - dx, y: d.vb0.y - dy })
    }
  }

  function onPointerUp() { drag.current = null }

  function onResizeDown(e: React.PointerEvent) {
    drag.current = { kind: 'resize', startY: e.clientY, h0: height }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  function onResizeMove(e: React.PointerEvent) {
    const d = drag.current
    if (d?.kind === 'resize') setHeight(Math.max(240, d.h0 + (e.clientY - d.startY)))
  }
  function onResizeUp() { drag.current = null }

  const zoom = (factor: number) =>
    setVb((v) => {
      const w = v.w / factor; const h = v.h / factor
      return { x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2, w, h }   // zoom about the centre
    })
  const fit = () => setVb(defaultVb(setup))

  return (
    <div ref={wrapRef}>
      <div role="toolbar" style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <button type="button" aria-label="Zoom out" className="btn ghost" disabled={running} onClick={() => zoom(1 / ZOOM_STEP)}>−</button>
        <button type="button" aria-label="Zoom in" className="btn ghost" disabled={running} onClick={() => zoom(ZOOM_STEP)}>+</button>
        <button type="button" aria-label="Fit" className="btn ghost" disabled={running} onClick={fit}>Fit</button>
      </div>
      <div
        style={{ height, position: 'relative' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <SemCanvasUI
          testId={testId}
          constructs={setup.constructs ?? []}
          columns={columns}
          paths={setup.paths ?? []}
          modelKind={modelKind}
          mode={mode}
          estimates={(s.runs[testId]?.result as { estimates?: CbSemResult['estimates'] } | undefined)?.estimates ?? null}
          running={running}
          viewBox={vb}
          moderations={setup.moderations ?? []}
          estimator={String(setup.options['estimator'] ?? 'ML')}
          nodePositions={setup.nodePositions}
          shelfColumns={shelfColumns}
          onAddPath={(from, to) => s.addPath(testId, from, to)}
          onRemovePath={(i) => s.removePath(testId, i)}
          onMoveNode={(id, x, y) => s.moveNode(testId, id, x, y)}
          onSetMode={setMode}
          onAddModeration={(moderatorId, pathIndex) => s.addModeration(testId, moderatorId, pathIndex)}
          onRemoveModeration={(id) => s.removeModeration(testId, id)}
          onPlaceColumn={(name) => s.placeColumn(testId, name)}
          onRemoveNode={(id) => { const name = placed[id]; if (name !== undefined) s.removeColumn(testId, name) }}
        />
        <div
          aria-label="Resize canvas"
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          style={{ position: 'absolute', right: 4, bottom: 4, width: 14, height: 14, cursor: 'nwse-resize', borderRight: '2px solid var(--info)', borderBottom: '2px solid var(--info)' }}
        />
      </div>
    </div>
  )
}
