import { describe, it, expect, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useSession } from '../state/session'
import { ConstructSlotsUI } from './ConstructSlots'
import type { Construct } from '../state/session'
import type { ColumnMeta } from '../lib/data/columnMeta'

// Minimal column fixtures
const numericCol = (name: string): ColumnMeta => ({ name, detected: 'float64', tags: [], level: 'ratio', used: true })
const nominalCol = (name: string): ColumnMeta => ({ name, detected: 'object', tags: [], level: 'nominal', used: true })

const TEST_ID = 'ave-cr'
const NUMERIC_COLS = ['q1', 'q2', 'q3']
const noop = () => {}

function renderUI(constructs: Construct[], numericColumns = NUMERIC_COLS, running = false) {
  return renderToStaticMarkup(
    <ConstructSlotsUI
      constructs={constructs}
      numericColumns={numericColumns}
      running={running}
      onAddConstruct={noop}
      onRemoveConstruct={noop}
      onSetName={noop}
      onToggleItem={noop}
    />
  )
}

function seedStore() {
  useSession.setState({
    selection: [TEST_ID],
    columns: [numericCol('q1'), numericCol('q2'), numericCol('q3'), nominalCol('group')],
    setups: { [TEST_ID]: { roles: {}, options: {}, props: {}, blocked: null, constructs: [] } },
  })
}

// ── Store mutation tests ────────────────────────────────────────────────────

describe('ConstructSlots — store mutations', () => {
  beforeEach(() => { useSession.getState().reset(); seedStore() })

  it('initial constructs array is empty', () => {
    expect(useSession.getState().setups[TEST_ID].constructs).toEqual([])
  })

  it('addConstruct appends a new blank construct', () => {
    useSession.getState().addConstruct(TEST_ID)
    const constructs = useSession.getState().setups[TEST_ID].constructs ?? []
    expect(constructs).toHaveLength(1)
    expect(constructs[0]).toEqual({ name: '', items: [] })
  })

  it('setConstructName updates the name of a construct by index', () => {
    useSession.getState().addConstruct(TEST_ID)
    useSession.getState().setConstructName(TEST_ID, 0, 'Engagement')
    const constructs = useSession.getState().setups[TEST_ID].constructs ?? []
    expect(constructs[0].name).toBe('Engagement')
  })

  it('toggleConstructItem adds an item when not present, removes when present', () => {
    useSession.getState().addConstruct(TEST_ID)
    useSession.getState().toggleConstructItem(TEST_ID, 0, 'q1')
    expect(useSession.getState().setups[TEST_ID].constructs?.[0].items).toEqual(['q1'])
    useSession.getState().toggleConstructItem(TEST_ID, 0, 'q1')
    expect(useSession.getState().setups[TEST_ID].constructs?.[0].items).toEqual([])
  })

  it('removeConstruct removes the construct at the given index', () => {
    useSession.getState().addConstruct(TEST_ID)
    useSession.getState().addConstruct(TEST_ID)
    useSession.getState().setConstructName(TEST_ID, 0, 'A')
    useSession.getState().setConstructName(TEST_ID, 1, 'B')
    useSession.getState().removeConstruct(TEST_ID, 0)
    const constructs = useSession.getState().setups[TEST_ID].constructs ?? []
    expect(constructs).toHaveLength(1)
    expect(constructs[0].name).toBe('B')
  })

  it('an item assigned to construct 0 cannot be assigned to construct 1 (partition)', () => {
    useSession.getState().addConstruct(TEST_ID)
    useSession.getState().addConstruct(TEST_ID)
    useSession.getState().toggleConstructItem(TEST_ID, 0, 'q1')
    useSession.getState().toggleConstructItem(TEST_ID, 1, 'q1')
    const constructs = useSession.getState().setups[TEST_ID].constructs ?? []
    expect(constructs[0].items).toContain('q1')
    expect(constructs[1].items).not.toContain('q1')
  })
})

// ── Rendering tests (ConstructSlotsUI — props-based, SSR-safe) ────────────

describe('ConstructSlotsUI — rendering', () => {
  it('renders the Add construct button', () => {
    const html = renderUI([])
    expect(html).toContain('Add construct')
  })

  it('shows a no-constructs validation message when constructs array is empty', () => {
    const html = renderUI([])
    expect(html).toContain('least 1 construct')
  })

  it('renders numeric columns as item options inside a construct block', () => {
    const constructs: Construct[] = [{ name: 'Scale A', items: [] }]
    const html = renderUI(constructs, ['q1', 'q2', 'q3'])
    expect(html).toContain('q1')
    expect(html).toContain('q2')
    expect(html).toContain('q3')
  })

  it('does not render nominal columns (only numeric columns are passed as props)', () => {
    // The filtering of numeric vs nominal happens in the store-connected ConstructSlots;
    // ConstructSlotsUI renders whatever columns it receives.
    // A nominal column passed via numericColumns would appear — but the store wrapper
    // filters it out. This test confirms the UI renders exactly what's passed.
    const constructs: Construct[] = [{ name: 'Scale A', items: [] }]
    const html = renderUI(constructs, ['q1', 'q2']) // group not included → not rendered
    expect(html).not.toContain('group')
  })

  it('shows a validation error when a construct has fewer than 2 items', () => {
    const constructs: Construct[] = [{ name: 'Scale A', items: ['q1'] }]
    const html = renderUI(constructs)
    expect(html).toContain('least 2 items')
  })

  it('does not show item-count error when a construct has 2 or more items', () => {
    const constructs: Construct[] = [{ name: 'Scale A', items: ['q1', 'q2'] }]
    const html = renderUI(constructs)
    expect(html).not.toContain('least 2 items')
  })

  it('marks an item as incompatible (inOther) when it is in another construct', () => {
    const constructs: Construct[] = [
      { name: 'A', items: ['q1'] },
      { name: 'B', items: [] },
    ]
    const html = renderUI(constructs)
    // In construct B's item list, q1 is in construct A → gets the incompatible class
    expect(html).toContain('incompatible')
  })

  it('no-constructs message is absent when at least one construct exists', () => {
    const constructs: Construct[] = [{ name: 'A', items: ['q1', 'q2'] }]
    const html = renderUI(constructs)
    expect(html).not.toContain('least 1 construct')
  })
})
