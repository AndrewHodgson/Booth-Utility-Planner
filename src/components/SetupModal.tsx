import { useState } from 'react'
import {
  BOOTH_TYPES,
  FLOORING_OPTIONS,
  type BoothType,
  type FlooringValue,
  clamp,
} from '../lib/plannerUtils'
import type { BoothDetails } from '../App'
import { TextField } from './TextField'

// Preset dimension options (10 ft increments from 10 to 100 ft).
// Kept here because it is only used by the setup modal's DimensionField.
const dimensionOptions = Array.from({ length: 10 }, (_, index) => (index + 1) * 10)

function DimensionField({
  label,
  mode,
  value,
  onModeChange,
  onValueChange,
}: {
  label: string
  mode: string
  value: number
  onModeChange: (mode: string) => void
  onValueChange: (value: number) => void
}) {
  return (
    <label className="field-group">
      <span className="field-label">{label}</span>
      <div className="dimension-row">
        <select value={mode} onChange={(event) => onModeChange(event.target.value)}>
          {dimensionOptions.map((option) => (
            <option key={option} value={option}>
              {option} ft
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
        <input
          type="number"
          min={1}
          max={100}
          step={1}
          value={value}
          disabled={mode !== 'custom'}
          onChange={(event) => onValueChange(clamp(Number(event.target.value) || 1, 1, 100))}
        />
      </div>
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
  const [widthMode, setWidthMode] = useState(
    dimensionOptions.includes(booth.width) ? String(booth.width) : 'custom',
  )
  const [depthMode, setDepthMode] = useState(
    dimensionOptions.includes(booth.depth) ? String(booth.depth) : 'custom',
  )

  function updateField(field: keyof BoothDetails, value: string | number) {
    onChange({ ...booth, [field]: value })
  }

  function updateDimension(field: 'width' | 'depth', mode: string) {
    const value = mode === 'custom' ? booth[field] : Number(mode)
    if (field === 'width') {
      setWidthMode(mode)
    } else {
      setDepthMode(mode)
    }
    updateField(field, clamp(Number(value) || 20, 1, 100))
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="welcome-modal" role="dialog" aria-modal="true">
        <div className="modal-brand">
          <span className="sourceone-mark">SourceOne</span>
          <span>Events</span>
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

          <DimensionField
            label="Booth Width"
            mode={widthMode}
            value={booth.width}
            onModeChange={(mode) => updateDimension('width', mode)}
            onValueChange={(value) => updateField('width', value)}
          />
          <DimensionField
            label="Booth Depth"
            mode={depthMode}
            value={booth.depth}
            onModeChange={(mode) => updateDimension('depth', mode)}
            onValueChange={(value) => updateField('depth', value)}
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
