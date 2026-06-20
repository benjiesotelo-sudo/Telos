import { useState, useRef } from 'react'
import { useSession } from '../state/session'
import type { Construct, StructuralPath } from '../state/session'
import type { CbSemResult } from '../lib/stats/cbSem'

const BLUE = '#185fa5'

// Layout geometry (static; interactions move x/y in Unit 3b).
const NODE_W = 132   // oval / rectangle width
const NODE_H = 64    // oval / rectangle height
const ITEM_W = 56
const ITEM_H = 22
const ITEM_GAP = 6
const DEFAULT_X = 80
const DEFAULT_Y = 70

export interface SemCanvasUIProps {
  testId: string
  constructs: Construct[]
  columns: string[]
  paths: StructuralPath[]
  modelKind: 'latent' | 'path'
  mode: 'draw' | 'move' | 'delete'
  estimates?: CbSemResult['estimates'] | null
  running: boolean
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

/** Center of a node given its (top-left) x/y, with defaults for unplaced nodes. */
function nodeCenter(n: Node, fallbackIdx: number) {
  const x = (n.x ?? DEFAULT_X + fallbackIdx * (NODE_W + 120)) + NODE_W / 2
  const y = (n.y ?? DEFAULT_Y) + NODE_H / 2
  return { cx: x, cy: y, left: x - NODE_W / 2, top: y - NODE_H / 2 }
}

/** Pure presentational canvas — testable with renderToStaticMarkup. */
export function SemCanvasUI({
  testId, constructs, columns, paths, modelKind, mode, estimates, running,
  onAddPath, onRemovePath, onMoveNode: _onMoveNode, onSetMode,
}: SemCanvasUIProps) {
  // pending draw source (click source → target); cancel when same node re-clicked
  const [pending, setPending] = useState<number | null>(null)

  const isPath = modelKind === 'path'
  const nodes = nodesOf({ constructs, columns, modelKind })

  const empty = nodes.length === 0
  // id → center, for resolving path endpoints by node id (Map uses strict-equality; id 0 is safe).
  const centers = new Map<number, ReturnType<typeof nodeCenter>>()
  nodes.forEach((n, i) => centers.set(n.id, nodeCenter(n, i)))

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
        viewBox="0 0 760 360"
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
                <text className="sem-path-label" x={mx} y={my - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={BLUE}>
                  {beta.toFixed(2)}
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
                  <text className="sem-r2-label" x={c.cx} y={c.top - 6} textAnchor="middle" fontSize={11} fill="var(--muted)" pointerEvents="none">
                    R²={estimates.r2[n.id].toFixed(2)}
                  </text>
                )}
              </g>
            )
          }
          const tooFew = n.items.length < 2
          return (
            <g key={`node-${n.id}`}>
              {n.items.map((item, k) => {
                const ix = c.left - ITEM_W - 28
                const iy = c.top + k * (ITEM_H + ITEM_GAP)
                const load = estimates?.loadings[item]
                return (
                  <g key={`item-${k}`}>
                    <line
                      className="sem-measure"
                      x1={ix + ITEM_W} y1={iy + ITEM_H / 2} x2={c.cx} y2={c.cy}
                      stroke="var(--line)" strokeWidth={1}
                    />
                    <rect className="sem-item" x={ix} y={iy} width={ITEM_W} height={ITEM_H} rx={3} fill="#fff" stroke="var(--line)" />
                    <text x={ix + ITEM_W / 2} y={iy + ITEM_H / 2 + 4} textAnchor="middle" fontSize={11} fill="var(--text)">{item}</text>
                    {load != null && (
                      <text className="sem-load-label" x={ix + ITEM_W + 12} y={iy + ITEM_H / 2 - 2} textAnchor="middle" fontSize={9} fill="var(--muted)">
                        {load.toFixed(2)}
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
                <text className="sem-r2-label" x={c.cx} y={c.top - 6} textAnchor="middle" fontSize={11} fill="var(--muted)" pointerEvents="none">
                  R²={estimates.r2[n.id].toFixed(2)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Store-connected canvas: wires useSession, owns the move-drag + viewBox(zoom/pan) + resize-grip state (Task 13). */
export function SemCanvas({ testId }: { testId: string }) {
  const s = useSession()
  const setup = s.setups[testId]
  const svgRef = useRef<SVGSVGElement | null>(null)
  void svgRef
  if (!setup) return null
  const modelKind = setup.modelKind ?? 'latent'
  const columns = s.columns.filter((c) => c.used).map((c) => c.name)
  const [mode, setMode] = useState<'draw' | 'move' | 'delete'>('draw')
  return (
    <SemCanvasUI
      testId={testId}
      constructs={setup.constructs ?? []}
      columns={columns}
      paths={setup.paths ?? []}
      modelKind={modelKind}
      mode={mode}
      estimates={null}
      running={s.runStatus === 'running'}
      onAddPath={(from, to) => s.addPath(testId, from, to)}
      onRemovePath={(i) => s.removePath(testId, i)}
      onMoveNode={(id, x, y) => s.moveNode(testId, id, x, y)}
      onSetMode={setMode}
    />
  )
}
