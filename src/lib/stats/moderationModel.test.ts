import { describe, it, expect } from 'vitest'
import { validateModerations, buildModerationLines, moderationIndProdEnv } from './moderationModel'
import { lvNames } from './lvName'
import type { Construct, StructuralPath } from '../../state/session'

const constructs: Construct[] = [
  { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
  { id: 2, name: 'TA', items: ['ta1', 'ta2', 'ta3', 'ta4'] },
  { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
]
const paths: StructuralPath[] = [{ from: 1, to: 3 }]
const rNameOf = (id: number) => { const names = lvNames(constructs.map((c) => c.name)); return names[constructs.findIndex((c) => c.id === id)] }

describe('validateModerations (guards §A7)', () => {
  it('throws on self-moderation (moderator is the path source or target)', () => {
    expect(() => validateModerations([{ id: 1, moderatorId: 1, pathIndex: 0 }], paths, false)).toThrow(/source or target/)
  })
  it('throws on a duplicate moderation (same moderator, same path)', () => {
    const mods = [{ id: 1, moderatorId: 2, pathIndex: 0 }, { id: 2, moderatorId: 2, pathIndex: 0 }]
    expect(() => validateModerations(mods, paths, false)).toThrow(/Duplicate moderation/)
  })
  it('throws in path-analysis (observed-only) mode', () => {
    expect(() => validateModerations([{ id: 1, moderatorId: 2, pathIndex: 0 }], paths, true)).toThrow(/path-analysis/)
  })
  it('throws when pathIndex does not resolve to an existing path', () => {
    expect(() => validateModerations([{ id: 1, moderatorId: 2, pathIndex: 5 }], paths, false)).toThrow(/does not exist/)
  })
  it('passes through cleanly for a valid single moderation', () => {
    expect(() => validateModerations([{ id: 1, moderatorId: 2, pathIndex: 0 }], paths, false)).not.toThrow()
  })
})

describe('buildModerationLines', () => {
  it('matched (equal counts) product-indicator names follow semTools var1[i].var2[i]', () => {
    const { lines, moderationDefs, targetLineExtras } = buildModerationLines(constructs, paths, rNameOf, [{ id: 1, moderatorId: 2, pathIndex: 0 }])
    expect(lines).toContain('INT_1 =~ sn1.ta1 + sn2.ta2 + sn3.ta3 + sn4.ta4')
    expect(lines).toContain('TA ~~ vmod_1*TA')
    expect(targetLineExtras.get(0)).toBe(' + pmod_1*TA + pint_1*INT_1')
    expect(moderationDefs[0].matched).toBe(true)
    expect(moderationDefs[0].pathLabel).toBe('SN → TI')
    expect(moderationDefs[0].pathLabel_).toBe('p_1_3')
  })

  it('unequal counts use match=FALSE all-pairs naming (var1[i].var2[j])', () => {
    const ta3: Construct[] = [
      { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
      { id: 2, name: 'TA3', items: ['ta1', 'ta2', 'ta3'] },
      { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
    ]
    const { lines, moderationDefs } = buildModerationLines(ta3, paths, rNameOf, [{ id: 1, moderatorId: 2, pathIndex: 0 }])
    expect(lines).toContain(
      'INT_1 =~ sn1.ta1 + sn1.ta2 + sn1.ta3 + sn2.ta1 + sn2.ta2 + sn2.ta3 + sn3.ta1 + sn3.ta2 + sn3.ta3 + sn4.ta1 + sn4.ta2 + sn4.ta3',
    )
    expect(moderationDefs[0].matched).toBe(false)
  })

  it('does NOT auto-inject the moderator main effect when it already predicts the target', () => {
    const withModPath: StructuralPath[] = [{ from: 1, to: 3 }, { from: 2, to: 3 }]
    const { targetLineExtras } = buildModerationLines(constructs, withModPath, rNameOf, [{ id: 1, moderatorId: 2, pathIndex: 0 }])
    expect(targetLineExtras.get(0)).toBe(' + pint_1*INT_1')
  })
})

describe('moderationIndProdEnv', () => {
  it('flattens var1/var2 with the item_cols_flat convention', () => {
    const { moderationDefs } = buildModerationLines(constructs, paths, rNameOf, [{ id: 1, moderatorId: 2, pathIndex: 0 }])
    const env = moderationIndProdEnv(moderationDefs)
    expect(env.mod_ids).toEqual([1])
    expect(env.mod_var1_flat).toEqual(['sn1', 'sn2', 'sn3', 'sn4'])
    expect(env.mod_var1_lens).toEqual([4])
    expect(env.mod_var2_flat).toEqual(['ta1', 'ta2', 'ta3', 'ta4'])
    expect(env.mod_var2_lens).toEqual([4])
    expect(env.mod_matched).toEqual([true])
  })
})
