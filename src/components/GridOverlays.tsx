import type { CSSProperties } from 'react'
import {
  type UtilityMarker,
  type UtilityLine,
  SNAP_FEET,
  markerColors,
  formatFeet,
  formatAmps,
  getEdgeDistances,
  getLineStartCoords,
  getAmpOptions,
  getValidAmp,
} from '../lib/plannerUtils'
import type { BoothDetails } from '../App'

// ---------------------------------------------------------------------------
// GridLineLayer — renders the 1-ft SVG grid lines inside the booth canvas
// ---------------------------------------------------------------------------

export function GridLineLayer({ booth }: { booth: BoothDetails }) {
  const verticalLines = Array.from(
    { length: Math.max(0, Math.ceil(booth.width) - 1) },
    (_, index) => index + 1,
  ).filter((x) => x < booth.width)
  const horizontalLines = Array.from(
    { length: Math.max(0, Math.ceil(booth.depth) - 1) },
    (_, index) => index + 1,
  ).filter((y) => y < booth.depth)

  return (
    <svg
      className="grid-line-layer"
      viewBox={`0 0 ${booth.width} ${booth.depth}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {verticalLines.map((x) => (
        <line key={`v-${x}`} x1={x} y1={0} x2={x} y2={booth.depth} />
      ))}
      {horizontalLines.map((y) => (
        <line key={`h-${y}`} x1={0} y1={y} x2={booth.width} y2={y} />
      ))}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// MeasurementGuides — dashed edge-distance lines and labels for a marker
// ---------------------------------------------------------------------------

export function MeasurementGuides({
  marker,
  booth,
  isSelected,
}: {
  marker: UtilityMarker
  booth: BoothDetails
  isSelected: boolean
}) {
  const leftPct = (marker.x / booth.width) * 100
  const topPct = ((booth.depth - marker.y) / booth.depth) * 100
  const { horizontalSide, verticalSide, horizontalDistance, verticalDistance } = getEdgeDistances(
    marker.x,
    marker.y,
    booth,
  )
  const horizontalLabelLeft =
    horizontalSide === 'left' ? leftPct / 2 : leftPct + (100 - leftPct) / 2
  const verticalLabelTop =
    verticalSide === 'back' ? topPct / 2 : topPct + (100 - topPct) / 2

  const guideStyle = {
    '--guide-color': markerColors[marker.type],
  } as CSSProperties

  const showHorizontal = horizontalDistance > SNAP_FEET
  const showVertical = verticalDistance > SNAP_FEET

  if (!showHorizontal && !showVertical) {
    return null
  }

  return (
    <div
      className={`measurement-layer ${isSelected ? 'is-selected' : ''}`}
      style={guideStyle}
      aria-hidden="true"
    >
      <div
        className="measurement-dot"
        style={{
          left: `${leftPct}%`,
          top: `${topPct}%`,
        }}
      />
      {showHorizontal && (
        <>
          <div
            className="measurement-guide measurement-guide-horizontal"
            style={
              horizontalSide === 'left'
                ? { left: 0, width: `${leftPct}%`, top: `${topPct}%` }
                : { left: `${leftPct}%`, right: 0, top: `${topPct}%` }
            }
          />
          <div
            className="measurement-label measurement-label-horizontal"
            style={{
              left: `${horizontalLabelLeft}%`,
              top: `${topPct}%`,
            }}
          >
            {formatFeet(horizontalDistance)}ft
          </div>
        </>
      )}
      {showVertical && (
        <>
          <div
            className="measurement-guide measurement-guide-vertical"
            style={
              verticalSide === 'back'
                ? { left: `${leftPct}%`, top: 0, height: `${topPct}%` }
                : { left: `${leftPct}%`, top: `${topPct}%`, bottom: 0 }
            }
          />
          <div
            className="measurement-label measurement-label-vertical"
            style={{
              left: `${leftPct}%`,
              top: `${verticalLabelTop}%`,
            }}
          >
            {formatFeet(verticalDistance)}ft
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// UtilityLineLayer — SVG overlay rendering extension cord lines
// ---------------------------------------------------------------------------

export function UtilityLineLayer({
  booth,
  markers,
  lines,
  selectedLineId,
  onSelectLine,
}: {
  booth: BoothDetails
  markers: UtilityMarker[]
  lines: UtilityLine[]
  selectedLineId: string | null
  onSelectLine: (lineId: string) => void
}) {
  if (lines.length === 0) {
    return null
  }

  return (
    <svg
      className="utility-line-layer"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {lines.map((line) => {
        const startCoords = getLineStartCoords(line, markers, lines)
        if (!startCoords) {
          return null
        }
        const x1 = (startCoords.x / booth.width) * 100
        const y1 = ((booth.depth - startCoords.y) / booth.depth) * 100
        const x2 = (line.toX / booth.width) * 100
        const y2 = ((booth.depth - line.toY) / booth.depth) * 100
        const isSelected = line.id === selectedLineId
        return (
          <g key={line.id} className={isSelected ? 'is-selected' : undefined}>
            <line
              className="utility-line-hit"
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              onPointerDown={(event) => {
                event.stopPropagation()
                onSelectLine(line.id)
              }}
            />
            <line className="utility-line-path" x1={x1} y1={y1} x2={x2} y2={y2} />
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// AmpPrompt — on-grid quick-select popover shown after placing a power drop
// ---------------------------------------------------------------------------

export function AmpPrompt({
  marker,
  booth,
  onSelect,
  onClose,
}: {
  marker: UtilityMarker
  booth: BoothDetails
  onSelect: (amps: UtilityMarker['amps']) => void
  onClose: () => void
}) {
  const ampOptions = getAmpOptions(marker.type)

  return (
    <div
      className="amp-prompt"
      style={{
        left: `${(marker.x / booth.width) * 100}%`,
        top: `${((booth.depth - marker.y) / booth.depth) * 100}%`,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <label>
        <span>Amps</span>
        <select
          value={getValidAmp(marker.type, marker.amps) || ''}
          autoFocus
          onChange={(event) => onSelect(event.target.value as UtilityMarker['amps'])}
          onBlur={onClose}
        >
          {ampOptions.map((amps) => (
            <option key={amps} value={amps}>
              {formatAmps(amps)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
