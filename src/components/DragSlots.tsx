import { useState } from 'react'
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { TestSpec, RoleConstraint } from '../lib/registry/types'
import { useSession, workingDataset } from '../state/session'
import { slotCompatibility } from '../lib/eligibility/eligibility'
import { buildShelves, roleAcceptsLevel, type Shelf } from '../lib/eligibility/poolShelves'
import { POOL_TEACH } from '../content/copy'

function Chip({ name, disabled, reason, assigned, badges, armed, onTap }: {
  name: string; disabled: boolean; reason: string | null; assigned: boolean; badges: string[]
  armed: boolean; onTap: () => void
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: name, disabled })
  return (
    <span ref={setNodeRef} {...listeners} {...attributes}
      onClick={disabled ? undefined : onTap}
      className={`chip${assigned ? ' assigned' : disabled ? ' incompatible' : ''}${armed ? ' armed' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), touchAction: 'none', cursor: disabled ? (assigned ? 'default' : 'not-allowed') : 'grab' }}>
      {name}{badges.map((b) => <span key={b} className="tag">{b}</span>)}
      {!assigned && disabled && reason ? <span className="hint"> — {reason}</span> : null}
    </span>
  )
}

function Slot({ spec, role, assigned, onRemove, onHoverChange, onTap }: {
  spec: TestSpec; role: RoleConstraint; assigned: string[]; onRemove: (roleId: string, column: string) => void
  onHoverChange: (roleId: string | null) => void; onTap: (roleId: string) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: role.roleId })
  const display = spec.roles.find((r) => r.id === role.roleId)!
  return (
    <div ref={setNodeRef} className={`slot${isOver ? ' over' : ''}`} data-role={role.roleId}
      onMouseEnter={() => onHoverChange(role.roleId)} onMouseLeave={() => onHoverChange(null)}
      onFocus={() => onHoverChange(role.roleId)} onBlur={() => onHoverChange(null)}
      onClick={() => onTap(role.roleId)}>
      {display.label} <span className="hint">{display.levels} · {display.arity}</span>
      {display.hint && <div className="hint" style={{ marginTop: 4 }}>{display.hint}</div>}
      {assigned.map((col) => (
        <div key={col} style={{ marginTop: 5 }}>
          <span className="chip assigned">{col}{' '}
            <button type="button" aria-label={`remove ${col}`} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'inherit' }}
              onClick={(e) => { e.stopPropagation(); onRemove(role.roleId, col) }}>×</button>
          </span>
        </div>
      ))}
    </div>
  )
}

/** Props-based rendering (SSR-testable, ConstructSlots/SemConfig idiom): the connected wrapper below owns the store. */
export function DragSlotsUI({ spec, shelves, roles, onDrop, onRemove, echoRole, armedChip }: {
  spec: TestSpec
  shelves: Shelf[]
  roles: Record<string, string[]>
  onDrop: (roleId: string, column: string) => void
  onRemove: (roleId: string, column: string) => void
  echoRole?: string | null // overrides the internal hover state - test seam only
  armedChip?: string | null // overrides the internal tap-to-assign state - test seam only
}) {
  // A bare PointerSensor activates on pointerdown (no movement needed) and immediately arms dnd-kit's
  // own document-capture click-suppressor - so a stationary tap/click on a chip never reaches our onClick.
  // A small distance constraint defers activation until real movement happens, letting taps/clicks through
  // while leaving drag-with-movement (12-step mouse moves in the e2e helper, real touch drags) unaffected.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor))
  const onDragEnd = (e: DragEndEvent) => { if (e.over) onDrop(String(e.over.id), String(e.active.id)) }
  const [echo, setEcho] = useState<string | null>(null)
  const active = echoRole ?? echo
  // active may name a roleId absent from this spec (stale hover across a spec swap) - guard rather than crash.
  const activeRole = active ? spec.constraints.roles.find((r) => r.roleId === active) : undefined
  const [armedState, setArmed] = useState<string | null>(null)
  const armed = armedChip ?? armedState
  const onChipTap = (name: string) => setArmed((a) => (a === name ? null : name))
  const onSlotTap = (roleId: string) => {
    if (!armed) return
    onDrop(roleId, armed)
    setArmed(null)
  }
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div className="card" style={{ flex: 1, marginTop: 0 }}>
          <div className="eyebrow">Your columns</div>
          {shelves.map((sh) => {
            const echoed = Boolean(activeRole) && !sh.dim && sh.chips.length > 0 &&
              roleAcceptsLevel(activeRole!, sh.level, sh.chips.map((c) => c.col))
            return (
              <div key={sh.level} className={`shelf${sh.dim ? ' off' : ''}${echoed ? ' echo' : ''}`}>
                <div className="shelf-head">{sh.level} <span className="count">{sh.chips.length}</span>
                  {sh.note && <span className="note"> · {sh.note}</span>}</div>
                {sh.chips.length ? (
                  <div className="pool">
                    {sh.chips.map((ch) => (
                      <Chip key={ch.col.name} name={ch.col.name} disabled={!ch.ok} reason={ch.reason} assigned={ch.assigned}
                        badges={ch.col.tags.filter((t) => t === 'datetime' || t === 'count').map((t) => t === 'datetime' ? 'date' : t)}
                        armed={armed === ch.col.name} onTap={() => onChipTap(ch.col.name)} />
                    ))}
                  </div>
                ) : (
                  <p className="hint teach">{POOL_TEACH[sh.level]}</p>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ flex: 1.2 }}>
          {spec.constraints.roles.map((r) => (
            <Slot key={r.roleId} spec={spec} role={r} assigned={roles[r.roleId] ?? []} onRemove={onRemove} onHoverChange={setEcho} onTap={onSlotTap} />
          ))}
        </div>
      </div>
    </DndContext>
  )
}

export function DragSlots({ testId, spec }: { testId: string; spec: TestSpec }) {
  const s = useSession()
  const working = workingDataset(s)
  const openRoles = spec.constraints.roles.filter((r) => (s.setups[testId]?.roles[r.roleId] ?? []).length < r.arity.max)
  const assignedSet = new Set(Object.values(s.setups[testId]?.roles ?? {}).flat())
  const shelves = buildShelves(s.columns, openRoles, assignedSet, working)
  const onDrop = (roleId: string, column: string) => {
    const role = spec.constraints.roles.find((r) => r.roleId === roleId)
    const col = s.columns.find((c) => c.name === column)
    if (!role || !col) return
    const assigned = s.setups[testId]?.roles[role.roleId] ?? []
    const isOpen = assigned.length < role.arity.max
    if (isOpen && !assigned.includes(col.name) && slotCompatibility(role, col, working).ok) s.addRole(testId, role.roleId, col.name)
  }
  return (
    <DragSlotsUI spec={spec} shelves={shelves} roles={s.setups[testId]?.roles ?? {}}
      onDrop={onDrop} onRemove={(roleId, col) => s.removeRole(testId, roleId, col)} />
  )
}
