import { useState, useEffect } from 'react'
import {
  BOOTH_TYPES,
  FLOORING_OPTIONS,
  type BoothType,
  type FlooringValue,
  clamp,
} from '../lib/plannerUtils'
import type { BoothDetails } from '../App'
import { TextField } from './TextField'

const sourceOneLogoPath = '/SourceOne-Logo-RGB.svg'

function DimensionInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))

  // Sync draft when value changes externally (e.g. parent resets the modal).
  useEffect(() => { setDraft(String(value)) }, [value])

  function commit(raw: string) {
    const clamped = clamp(Number(raw) || 1, 1, 100)
    onChange(clamped)
    setDraft(String(clamped))
  }

  return (
    <label className="field-group">
      <span className="field-label">{label}</span>
      <input
        type="number"
        min={1}
        max={100}
        step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
    </label>
  )
}

export function SetupModal({
  booth,
  onChange,
  onComplete,
}: {
  booth: BoothDetails
  onChange: (booth: BoothDetails) => void
  onComplete: () => void
}) {
  function updateField(field: keyof BoothDetails, value: string | number) {
    onChange({ ...booth, [field]: value })
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="welcome-modal" role="dialog" aria-modal="true">
        <div className="modal-brand">
          <img className="modal-logo" src={sourceOneLogoPath} alt="SourceOne Events" />
        </div>
        <div className="modal-heading">
          <p className="eyebrow">Booth Utility Planner</p>
          <h1>Set up the booth layout</h1>
          <p>
            Enter the exhibitor, show, and booth dimensions to create a 1-foot
            planning grid.
          </p>
        </div>

        <div className="setup-grid">
          <TextField label="Name" value={booth.name} onChange={(value) => updateField('name', value)} />
          <TextField
            label="Company Name"
            value={booth.companyName}
            onChange={(value) => updateField('companyName', value)}
          />
          <TextField label="Email" value={booth.email} onChange={(value) => updateField('email', value)} />
          <TextField label="Phone" value={booth.phone} onChange={(value) => updateField('phone', value)} />
          <TextField
            label="Booth Number"
            value={booth.boothNumber}
            onChange={(value) => updateField('boothNumber', value)}
          />
          <TextField
            label="Show Name"
            value={booth.showName}
            onChange={(value) => updateField('showName', value)}
          />
          <TextField
            type="date"
            label="Show Date"
            value={booth.showDate}
            onChange={(value) => updateField('showDate', value)}
          />
          <TextField
            label="Show Location"
            value={booth.showLocation}
            onChange={(value) => updateField('showLocation', value)}
          />

          <DimensionInput
            label="Booth Width"
            value={booth.width}
            onChange={(value) => updateField('width', value)}
          />
          <DimensionInput
            label="Booth Depth"
            value={booth.depth}
            onChange={(value) => updateField('depth', value)}
          />
          <label className="field-group">
            <span className="field-label">Booth Type</span>
            <select
              value={booth.boothType}
              onChange={(event) => updateField('boothType', event.target.value as BoothType)}
            >
              {BOOTH_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="field-group">
            <span className="field-label">Flooring</span>
            <select
              value={booth.flooring}
              onChange={(event) => updateField('flooring', event.target.value as FlooringValue)}
            >
              {FLOORING_OPTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onComplete}>
            Start planning
          </button>
        </div>
      </section>
    </div>
  )
}
