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

/** Center of a node given its (top-left) x/y, with defaults for unplaced nodes. */
function nodeCenter(n: { x?: number; y?: number }, fallbackIdx: number) {
  const x = (n.x ?? DEFAULT_X + fallbackIdx * (NODE_W + 120)) + NODE_W / 2
  const y = (n.y ?? DEFAULT_Y) + NODE_H / 2
  return { cx: x, cy: y, left: x - NODE_W / 2, top: y - NODE_H / 2 }
}

/** Pure presentational canvas — testable with renderToStaticMarkup. Static render (Unit 3a). */
export function SemCanvasUI({
  testId, constructs, columns, paths, modelKind, estimates,
}: SemCanvasUIProps) {
  const isPath = modelKind === 'path'
  // In latent mode nodes come from constructs; in path mode from columns (Task 11).
  const nodes = isPath
    ? columns.map((name, i) => ({ id: i, name, items: [] as string[], x: undefined as number | undefined, y: undefined as number | undefined }))
    : constructs

  const empty = nodes.length === 0
  // id → center, for resolving path endpoints by construct id.
  const centers = new Map<number, ReturnType<typeof nodeCenter>>()
  nodes.forEach((n, i) => centers.set(n.id, nodeCenter(n, i)))

  return (
    <div className="sem-canvas" style={{ position: 'relative' }}>
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

        {/* Structural path arrows (drawn first, under the nodes). */}
        {paths.map((p, i) => {
          const a = centers.get(p.from)
          const b = centers.get(p.to)
          if (!a || !b) return null
          return (
            <line
              key={`path-${i}`}
              className="sem-path"
              x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
              stroke={BLUE} strokeWidth={2}
              markerEnd="url(#sem-arrow)"
            />
          )
        })}

        {/* Nodes: latent = oval + item boxes + measurement lines; path = rectangle (Task 11). */}
        {nodes.map((n, i) => {
          const c = centers.get(n.id)!
          const tooFew = !isPath && n.items.length < 2
          if (isPath) return null // rectangles handled in Task 11
          return (
            <g key={`node-${n.id}`}>
              {/* measurement lines + item boxes */}
              {n.items.map((item, k) => {
                const ix = c.left - ITEM_W - 28
                const iy = c.top + k * (ITEM_H + ITEM_GAP)
                return (
                  <g key={`item-${k}`}>
                    <line
                      className="sem-measure"
                      x1={ix + ITEM_W} y1={iy + ITEM_H / 2} x2={c.cx} y2={c.cy}
                      stroke="var(--line)" strokeWidth={1}
                    />
                    <rect className="sem-item" x={ix} y={iy} width={ITEM_W} height={ITEM_H} rx={3} fill="#fff" stroke="var(--line)" />
                    <text x={ix + ITEM_W / 2} y={iy + ITEM_H / 2 + 4} textAnchor="middle" fontSize={11} fill="var(--text)">{item}</text>
                  </g>
                )
              })}
              {/* latent oval */}
              <ellipse
                className={`sem-oval${tooFew ? ' incomplete' : ''}`}
                cx={c.cx} cy={c.cy} rx={NODE_W / 2} ry={NODE_H / 2}
                fill="#fff" stroke={BLUE} strokeWidth={2}
                strokeDasharray={tooFew ? '5 4' : undefined}
              />
              <text x={c.cx} y={c.cy + 4} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--text)">{n.name}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
