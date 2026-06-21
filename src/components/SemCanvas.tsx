import { useState, useRef } from 'react'
import { useSession } from '../state/session'
import type { Construct, StructuralPath } from '../state/session'
import type { CbSemResult } from '../lib/stats/cbSem'

const BLUE = '#185fa5'

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
const ITEM_W = 56
const ITEM_H = 22
const ITEM_GAP = 6
const ITEM_SIDE_GAP = 28  // gap between oval edge and item stack
const DEFAULT_X = 80
const DEFAULT_Y = 70
const GRID_GAP = 28   // min horizontal gap between path-mode grid columns (used to pick cols-per-row)

/** Choose which side item boxes sit on, based on cx relative to the canvas width W. */
function itemSide(cx: number, W: number): 'left' | 'right' | 'below' {
  if (cx < W * 0.34) return 'left'
  if (cx > W * 0.66) return 'right'
  return 'below'
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
  onAddPath(from: number, to: number): void
  onRemovePath(index: number): void
  onMoveNode(id: number, x: number, y: number): void
  onSetMode(m: 'draw' | 'move' | 'delete'): void
}

/** A canvas node: latent constructs are id-addressed; path-mode columns use their array index as id. */
interface Node { id: number; name: string; items: string[]; x?: number; y?: number }

/** Single source of truth for "what nodes does this model draw, and at what ids". */
export function nodesOf(p: Pick<SemCanvasUIProps, 'constructs' | 'columns' | 'modelKind'>): Node[] {
  if (p.modelKind === 'path') {
    return p.columns.map((name, i) => ({ id: i, name, items: [], x: undefined, y: undefined }))
  }
  return p.constructs
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
  viewBox: vbProp,
  onAddPath, onRemovePath, onMoveNode: _onMoveNode, onSetMode,
}: SemCanvasUIProps) {
  // pending draw source (click source → target); cancel when same node re-clicked
  const [pending, setPending] = useState<number | null>(null)

  const isPath = modelKind === 'path'
  const nodes = nodesOf({ constructs, columns, modelKind })

  const empty = nodes.length === 0
  // id → center, for resolving path endpoints by node id (Map uses strict-equality; id 0 is safe).
  // Path mode auto-grids its column rectangles into the viewBox; latent keeps its approved layout.
  const vbW = vbProp ? vbProp.w : 760
  const vbH = vbProp ? vbProp.h : 360
  const centers = new Map<number, ReturnType<typeof nodeCenter>>()
  nodes.forEach((n, i) =>
    centers.set(n.id, isPath ? pathNodeCenter(i, nodes.length, vbW, vbH) : nodeCenter(n, i)))

  function clickNode(id: number) {
    if (running) return
    if (mode === 'delete') return  // node delete handled by connected wrapper
    if (mode !== 'draw') return
    if (pending === null) { setPending(id); return }
    if (pending === id) { setPending(null); return }   // cancel on same node
    const dup = paths.some((p) => p.from === pending && p.to === id)
    if (!dup) onAddPath(pending, id)                   // dedupe: never add an existing directed edge
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
      {empty && (
        <p className="hint" role="status" style={{ padding: 12 }}>
          {isPath ? 'Assign columns to draw paths.' : 'Add a construct to start the diagram.'}
        </p>
      )}
      <svg
        id={`figure-path-diagram-${testId}`}
        width="100%"
        viewBox={vbProp ? `${vbProp.x} ${vbProp.y} ${vbProp.w} ${vbProp.h}` : '0 0 760 360'}
        preserveAspectRatio="xMidYMid meet"
        style={{ background: '#f0efe9', border: '1px solid var(--line)', borderRadius: 10 }}
      >
        <defs>
          <marker id="sem-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={BLUE} />
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
                  style={{ paintOrder: 'stroke', stroke: '#f0efe9', strokeWidth: 3 }}
                >
                  {`β = ${fmtCoef(beta)}`}
                </text>
              )}
              {mode === 'delete' && (
                <circle
                  data-path-index={i}
                  cx={mx} cy={my} r={9}
                  fill="#fff" stroke={BLUE} style={{ cursor: 'pointer' }}
                  onClick={() => !running && onRemovePath(i)}
                />
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
                  fill="#fff" stroke={BLUE} strokeWidth={2}
                  style={{ cursor: running ? 'default' : mode === 'move' ? 'grab' : 'pointer' }}
                  onClick={() => clickNode(n.id)}
                />
                <text x={c.cx} y={c.cy + 4} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--text)" pointerEvents="none">{n.name}</text>
                {estimates?.r2[n.id] != null && (
                  <text
                    className="sem-r2-label"
                    data-r2={String(n.id)}
                    x={c.cx} y={c.top - 6}
                    textAnchor="middle" fontSize={11} fill="var(--muted)" pointerEvents="none"
                    style={{ paintOrder: 'stroke', stroke: '#f0efe9', strokeWidth: 3 }}
                  >
                    {`R² = ${fmtR2(estimates!.r2[n.id])}`}
                  </text>
                )}
              </g>
            )
          }
          const tooFew = n.items.length < 2
          const W = vbProp ? vbProp.w : 760
          const side = itemSide(c.cx, W)
          const ni = n.items.length
          return (
            <g key={`node-${n.id}`}>
              {n.items.map((item, k) => {
                let ix: number, iy: number, lx1: number, ly1: number, labelX: number, labelAnchor: 'start' | 'middle' | 'end'
                if (side === 'left') {
                  ix = c.left - ITEM_SIDE_GAP - ITEM_W
                  iy = c.cy - ((ni - 1) / 2) * (ITEM_H + ITEM_GAP) + k * (ITEM_H + ITEM_GAP) - ITEM_H / 2
                  lx1 = ix + ITEM_W; ly1 = iy + ITEM_H / 2
                  labelX = ix - 4; labelAnchor = 'end'
                } else if (side === 'right') {
                  ix = c.left + NODE_W + ITEM_SIDE_GAP
                  iy = c.cy - ((ni - 1) / 2) * (ITEM_H + ITEM_GAP) + k * (ITEM_H + ITEM_GAP) - ITEM_H / 2
                  lx1 = ix; ly1 = iy + ITEM_H / 2
                  labelX = ix + ITEM_W + 4; labelAnchor = 'start'
                } else {
                  // below
                  ix = c.cx + (k - (ni - 1) / 2) * (ITEM_W + 12) - ITEM_W / 2
                  iy = c.top + NODE_H + ITEM_SIDE_GAP
                  lx1 = ix + ITEM_W / 2; ly1 = iy
                  labelX = ix + ITEM_W / 2; labelAnchor = 'middle'
                }
                const load = estimates?.loadings[item]
                return (
                  <g key={`item-${k}`}>
                    <line
                      className="sem-measure"
                      x1={lx1} y1={ly1} x2={c.cx} y2={c.cy}
                      stroke="var(--line)" strokeWidth={1}
                    />
                    <rect className="sem-item" x={ix} y={iy} width={ITEM_W} height={ITEM_H} rx={3} fill="#fff" stroke="var(--line)" />
                    <text x={ix + ITEM_W / 2} y={iy + ITEM_H / 2 + 4} textAnchor="middle" fontSize={11} fill="var(--text)">{item}</text>
                    {load != null && (
                      <text
                        className="sem-load-label"
                        data-loading={item}
                        x={labelX} y={iy + ITEM_H / 2 - 2}
                        textAnchor={labelAnchor} fontSize={9} fill="var(--muted)"
                        style={{ paintOrder: 'stroke', stroke: '#f0efe9', strokeWidth: 3 }}
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
                fill="#fff" stroke={BLUE} strokeWidth={2}
                strokeDasharray={tooFew ? '5 4' : undefined}
                opacity={tooFew ? 0.6 : undefined}
                style={{ cursor: running ? 'default' : mode === 'move' ? 'grab' : 'pointer' }}
                onClick={() => clickNode(n.id)}
              />
              <text x={c.cx} y={c.cy + 4} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--text)" pointerEvents="none">{n.name}</text>
              {estimates?.r2[n.id] != null && (
                <text
                  className="sem-r2-label"
                  data-r2={String(n.id)}
                  x={c.cx} y={c.top - 6}
                  textAnchor="middle" fontSize={11} fill="var(--muted)" pointerEvents="none"
                  style={{ paintOrder: 'stroke', stroke: '#f0efe9', strokeWidth: 3 }}
                >
                  {`R² = ${fmtR2(estimates!.r2[n.id])}`}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Store-connected canvas: useSession wiring + pointer-drag move + viewBox zoom/pan + resize grip.
 *  Items "keep their side" for free — SemCanvasUI draws item boxes relative to the (moved) node centre. */
export function SemCanvas({ testId }: { testId: string }) {
  const s = useSession()
  const setup = s.setups[testId]
  const [mode, setMode] = useState<'draw' | 'move' | 'delete'>('draw')
  const [vb, setVb] = useState<ViewBox>(BASE_VB)
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
  const columns = s.columns.filter((c) => c.used).map((c) => c.name)

  const svgRect = () => {
    const svg = wrapRef.current?.querySelector('svg')
    const r = svg?.getBoundingClientRect()
    return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : { left: 0, top: 0, width: vb.w, height: vb.h }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (running) return
    const target = (e.target as Element).closest('[data-node-id]')
    const nodeId = target ? Number(target.getAttribute('data-node-id')) : null
    if (mode === 'move' && nodeId !== null && modelKind === 'latent') {
      // dragging a latent node (path-mode columns are fixed-laid-out, not movable)
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
  const fit = () => setVb(BASE_VB)

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
          onAddPath={(from, to) => s.addPath(testId, from, to)}
          onRemovePath={(i) => s.removePath(testId, i)}
          onMoveNode={(id, x, y) => s.moveNode(testId, id, x, y)}
          onSetMode={setMode}
        />
        <div
          aria-label="Resize canvas"
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          style={{ position: 'absolute', right: 4, bottom: 4, width: 14, height: 14, cursor: 'nwse-resize', borderRight: '2px solid #185fa5', borderBottom: '2px solid #185fa5' }}
        />
      </div>
    </div>
  )
}
