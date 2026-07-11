/** The Telos mark: three nodes on a path - two open ink rings, a closed clay arrival node.
 *  Geometry is Benjie's hand-tuned M6b (docs/brand/geometry.json: stance 71, peak 30, node 6.5,
 *  arrival 9.5, ink 2.5, clay 4.3, no arrow), and docs/brand/telos-mark.svg is its byte twin -
 *  change one, change both. Ink strokes ride `currentColor` and clay rides `var(--accent)`, so
 *  one component serves both themes. Lines are drawn first (butt caps, trimmed into the ring
 *  centerlines), circles painted on top - the clean-junction construction rule from the kit. */
export function TelosMark({ width = 120, className }: { width?: number; className?: string }) {
  return (
    <svg
      className={`telos-mark${className ? ` ${className}` : ''}`}
      viewBox="0 0 86.5 60"
      width={width}
      aria-hidden="true"
      style={{ display: 'block', margin: '0 auto' }}
    >
      {/* pathLength=1 normalizes both lines to one dash unit, so the motion register's single
        * drawPath rule (tokens.css .enter-3 line) draws either length cleanly. Inert outside
        * an .enter-3 wrapper. */}
      <line x1="14.964" y1="44.301" x2="31.446" y2="24.949" stroke="currentColor" strokeWidth="2.5" pathLength={1} />
      <line x1="41.072" y1="23.6" x2="69.67" y2="42.62" stroke="var(--accent)" strokeWidth="4.3" pathLength={1} />
      <circle cx="10.75" cy="49.25" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="35.66" cy="20" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="74" cy="45.5" r="9.5" fill="var(--accent)" />
    </svg>
  )
}
