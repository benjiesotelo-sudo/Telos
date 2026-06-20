import type { Construct, StructuralPath } from '../state/session'
import type { CbSemResult } from '../lib/stats/cbSem'

const BLUE = '#185fa5'

/** APA-style: 2 dp, strip the leading zero (0.62 → ".62", -0.40 → "-.40"). */
function fmt(v: number): string {
  const s = Math.abs(v).toFixed(2).replace(/^0/, '')
  return v < 0 ? `-${s}` : s
}

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

  // In latent mode nodes come from constructs (id = Construct.id, user-assigned).
  // In path mode nodes come from columns with id = array index (0, 1, 2, …).
  // StructuralPath.from/to MUST reference those same ids in both modes.
  const nodes = isPath
    ? columns.map((name, i) => ({ id: i, name, items: [] as string[], x: undefined as number | undefined, y: undefined as number | undefined }))
    : constructs

  const empty = nodes.length === 0
  // id → center, for resolving path endpoints by node id (Map uses strict-equality; id 0 is safe).
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

        {/* Structural path arrows + (post-run) β label at the midpoint. */}
        {paths.map((p, i) => {
          const a = centers.get(p.from)
          const b = centers.get(p.to)
          if (!a || !b) return null
          // estimates overlay rendered when provided (wired post-run in Task 3c)
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
                  {fmt(beta)}
                </text>
              )}
            </g>
          )
        })}

        {/* Nodes: latent = oval + item boxes + measurement lines; path = observed rectangle. */}
        {nodes.map((n) => {
          const c = centers.get(n.id)!
          if (isPath) {
            // estimates overlay rendered when provided (wired post-run in Task 3c)
            return (
              <g key={`node-${n.id}`}>
                <rect
                  className="sem-node-rect"
                  x={c.left} y={c.top} width={NODE_W} height={NODE_H} rx={4}
                  fill="#fff" stroke={BLUE} strokeWidth={2}
                />
                <text x={c.cx} y={c.cy + 4} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--text)">{n.name}</text>
                {estimates?.r2[n.id] != null && (
                  <text className="sem-r2-label" x={c.cx} y={c.top - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
                    R²={fmt(estimates.r2[n.id])}
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
                // estimates overlay rendered when provided (wired post-run in Task 3c)
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
                        {fmt(load)}
                      </text>
                    )}
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
              {estimates?.r2[n.id] != null && (
                <text className="sem-r2-label" x={c.cx} y={c.top - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
                  R²={fmt(estimates.r2[n.id])}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
