import { describe, it, expect } from 'vitest'
import { buildModel } from './runCbSem'
import { lvNames } from './lvName'
import type { Construct, StructuralPath } from '../../state/session'

const constructs: Construct[] = [
  { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
  { id: 2, name: 'TA', items: ['ta1', 'ta2', 'ta3', 'ta4'] },
  { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
]
const paths: StructuralPath[] = [{ from: 1, to: 3 }]
const rNameOf = (id: number) => { const names = lvNames(constructs.map((c) => c.name)); return names[constructs.findIndex((c) => c.id === id)] }

describe('buildModel — moderation guards + naming (pure, no WebR)', () => {
  it('rejects self-moderation (moderator is the path source or target)', () => {
    expect(() => buildModel(constructs, paths, false, rNameOf, [{ id: 1, moderatorId: 1, pathIndex: 0 }])).toThrow(/source or target/)
  })
  it('rejects a duplicate moderation (same moderator, same path)', () => {
    const mods = [{ id: 1, moderatorId: 2, pathIndex: 0 }, { id: 2, moderatorId: 2, pathIndex: 0 }]
    expect(() => buildModel(constructs, paths, false, rNameOf, mods)).toThrow(/Duplicate moderation/)
  })
  it('rejects moderation in path-analysis (observed-only) mode', () => {
    expect(() => buildModel(constructs, paths, true, rNameOf, [{ id: 1, moderatorId: 2, pathIndex: 0 }])).toThrow(/path-analysis/)
  })
  it('matched (equal counts) product-indicator names follow semTools var1[i].var2[i]', () => {
    const { model, moderationDefs } = buildModel(constructs, paths, false, rNameOf, [{ id: 1, moderatorId: 2, pathIndex: 0 }])
    expect(model).toContain('INT_1 =~ sn1.ta1 + sn2.ta2 + sn3.ta3 + sn4.ta4')
    expect(model).toContain('TI ~ p_1_3*SN + pmod_1*TA + pint_1*INT_1')
    expect(moderationDefs[0].matched).toBe(true)
  })
  it('unequal counts use match=FALSE all-pairs naming (var1[i].var2[j])', () => {
    const ta3: Construct[] = [
      { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
      { id: 2, name: 'TA3', items: ['ta1', 'ta2', 'ta3'] },
      { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
    ]
    const { model, moderationDefs } = buildModel(ta3, paths, false, rNameOf, [{ id: 1, moderatorId: 2, pathIndex: 0 }])
    expect(model).toContain(
      'INT_1 =~ sn1.ta1 + sn1.ta2 + sn1.ta3 + sn2.ta1 + sn2.ta2 + sn2.ta3 + sn3.ta1 + sn3.ta2 + sn3.ta3 + sn4.ta1 + sn4.ta2 + sn4.ta3',
    )
    expect(moderationDefs[0].matched).toBe(false)
  })
  it('no moderations is a no-op (existing 47 tests keep passing unmodified)', () => {
    const { model, moderationDefs } = buildModel(constructs, paths, false, rNameOf)
    expect(model).not.toContain('INT_')
    expect(moderationDefs).toEqual([])
  })
})
