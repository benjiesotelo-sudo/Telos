export interface SwitchTest { id: string; label: string; n: number; state: 'done' | 'current' | 'todo'; enabled: boolean }

/** Spec R1: the on-screen test switcher - finger-sized targets; rail sub-dots stay indicators only. */
export function TestSwitcher({ tests, onGo }: { tests: SwitchTest[]; onGo: (id: string) => void }) {
  if (tests.length < 2) return null
  return (
    <div className="tswitch" role="group" aria-label="Your tests">
      {tests.map((t) => (
        <button key={t.id} type="button" className={`tswitch-pill ${t.state}`}
          aria-current={t.state === 'current' ? 'true' : undefined}
          aria-label={t.state === 'done' ? `${t.n} · ${t.label}, configured` : undefined}
          disabled={!t.enabled || t.state === 'current'}
          onClick={() => onGo(t.id)}>
          {t.state === 'done' && <span className="tick" aria-hidden="true">✓ </span>}{t.n} · {t.label}
        </button>
      ))}
    </div>
  )
}
