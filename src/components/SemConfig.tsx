// src/components/SemConfig.tsx
import type { ReactNode } from 'react'
import { useSession } from '../state/session'
import type { Construct, StructuralPath } from '../state/session'
import { ConstructSlots } from './ConstructSlots'
import { SemCanvas } from './SemCanvas'

export interface SemConfigUIProps {
  testId: string
  modelKind: 'latent' | 'path'
  constructs: Construct[]
  paths: StructuralPath[]
  columns: string[]
  running: boolean
  canvas: ReactNode   // <SemCanvas> (Unit 3b) — injected so the pure UI is renderToStaticMarkup-testable
  form: ReactNode     // <ConstructSlots> — hidden in path mode
  controls: ReactNode // bespoke pipeline/missing/bootstrap controls (Task 16)
}

/** Pure presentational composite — D3 layout: canvas on top (full-width), construct form below, bespoke controls last. */
export function SemConfigUI({ modelKind, constructs, form, canvas, controls, running }: SemConfigUIProps) {
  const advise3 =
    modelKind === 'latent' &&
    constructs.length > 0 &&
    constructs.some((c) => c.items.length >= 2 && c.items.length < 3)
  return (
    <div className="sem-config">
      {/* Canvas: on top, full-width (D3) */}
      <div className="sem-canvas-region" style={{ marginTop: 8 }}>
        {canvas}
      </div>
      {/* Measurement model: construct-slots form below the canvas — latent only (path mode = observed columns) */}
      {modelKind !== 'path' && (
        <div className="sem-form-region" style={{ marginTop: 16 }}>
          <div className="eyebrow">Measurement model</div>
          {form}
          {advise3 && (
            <p className="hint" role="note" style={{ marginTop: 6 }}>
              Tip: we recommend 3 or more items per construct (2 only works inside a larger model — Kline).
            </p>
          )}
        </div>
      )}
      {/* Bespoke controls (Task 16): pipeline stages · missing data · bootstrap */}
      <div className="sem-controls-region" style={{ marginTop: 16 }} aria-disabled={running}>
        {controls}
      </div>
    </div>
  )
}

/** Store-connected composite — used in production via TestConfigScreen. Controls slot is filled in Task 16. */
export function SemConfig({ testId }: { testId: string }) {
  const s = useSession()
  const setup = s.setups[testId]
  if (!setup) return null
  const modelKind = setup.modelKind ?? 'latent'
  const constructs = setup.constructs ?? []
  const columns = s.columns.filter((c) => c.used && c.level !== null).map((c) => c.name)
  return (
    <SemConfigUI
      testId={testId}
      modelKind={modelKind}
      constructs={constructs}
      paths={setup.paths ?? []}
      columns={columns}
      running={s.runStatus === 'running'}
      canvas={<SemCanvas testId={testId} />}
      form={<ConstructSlots testId={testId} />}
      controls={null /* Task 16 mounts <SemControls testId={testId} /> here */}
    />
  )
}
