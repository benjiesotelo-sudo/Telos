import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { TestSpec, RoleConstraint } from '../lib/registry/types'
import { useSession, workingDataset } from '../state/session'
import { slotCompatibility } from '../lib/eligibility/eligibility'

function Chip({ name, disabled, reason }: { name: string; disabled: boolean; reason: string | null }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: name, disabled })
  return (
    <span ref={setNodeRef} {...listeners} {...attributes} className={`chip${disabled ? ' incompatible' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), touchAction: 'none', cursor: disabled ? 'not-allowed' : 'grab' }}>
      {name}{disabled && reason ? <span className="hint"> — {reason}</span> : null}
    </span>
  )
}

function Slot({ testId, spec, role }: { testId: string; spec: TestSpec; role: RoleConstraint }) {
  const s = useSession()
  const { isOver, setNodeRef } = useDroppable({ id: role.roleId })
  const display = spec.roles.find((r) => r.id === role.roleId)!
  const assigned = s.setups[testId]?.roles[role.roleId] ?? null
  return (
    <div ref={setNodeRef} className={`slot${isOver ? ' over' : ''}`} data-role={role.roleId}>
      {display.label} <span className="hint">{display.levels} · {display.arity}</span>
      {assigned && (
        <div style={{ marginTop: 5 }}>
          <span className="chip assigned">{assigned}{' '}
            <button type="button" aria-label={`remove ${assigned}`} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'inherit' }}
              onClick={() => s.assignRole(testId, role.roleId, null)}>×</button>
          </span>
        </div>
      )}
    </div>
  )
}

export function DragSlots({ testId, spec }: { testId: string; spec: TestSpec }) {
  const s = useSession()
  const working = workingDataset(s)
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return
    const role = spec.constraints.roles.find((r) => r.roleId === String(e.over!.id))
    const col = s.columns.find((c) => c.name === String(e.active.id))
    if (role && col && slotCompatibility(role, col, working).ok) s.assignRole(testId, role.roleId, col.name)
  }
  const openRoles = spec.constraints.roles.filter((r) => !s.setups[testId]?.roles[r.roleId])
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div className="card" style={{ flex: 1, marginTop: 0 }}>
          <div className="eyebrow">Your columns</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {s.columns.filter((c) => c.used).map((c) => {
              // a chip is draggable if at least one OPEN slot accepts it
              const fits = openRoles.map((r) => slotCompatibility(r, c, working))
              const ok = fits.some((v) => v.ok)
              const reason = ok || !openRoles.length ? null : fits[0].reason
              return <Chip key={c.name} name={c.name} disabled={!ok} reason={reason} />
            })}
          </div>
        </div>
        <div style={{ flex: 1.2 }}>
          {spec.constraints.roles.map((r) => <Slot key={r.roleId} testId={testId} spec={spec} role={r} />)}
        </div>
      </div>
    </DndContext>
  )
}
