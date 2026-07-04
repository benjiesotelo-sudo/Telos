import type { ReactNode } from 'react'
export function OptionRows({ children }: { children: { group: string; node: ReactNode }[] }) {
  const order = [...new Set(children.map((c) => c.group))]
  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
      {order.map((g) => (
        <div key={g} className="opt-group">
          <span className="opt-label">{g}</span>
          {children.filter((c) => c.group === g).map((c) => c.node)}
        </div>
      ))}
    </div>
  )
}
