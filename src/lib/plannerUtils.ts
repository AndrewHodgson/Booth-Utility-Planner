// Pure helpers and shared data model. Everything here is free of React, jsPDF,
// and DOM dependencies so it can be imported by App.tsx, the PDF module, and tests.

// ---------------------------------------------------------------------------
// Booth configuration constants and derived types
// ---------------------------------------------------------------------------

export const BOOTH_TYPES = ['Inline', 'Corner', 'Peninsula', 'End Cap', 'Island'] as const
export type BoothType = (typeof BOOTH_TYPES)[number]

export const FLOORING_OPTIONS = [
  'Choose Flooring',
  'Flooring Ordered',
  'No Flooring Ordered',
  'Unknown / Not Provided',
] as const
export type FlooringValue = (typeof FLOORING_OPTIONS)[number]
export const DEFAULT_FLOORING: FlooringValue = 'Choose Flooring'

// ---------------------------------------------------------------------------
// General-purpose math utility
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

// ---------------------------------------------------------------------------
// Marker types
// ---------------------------------------------------------------------------

export type MarkerType =
  | '120v'
  | '208v_single_phase'
  | '208v_three_phase'
  | '480v_three_phase'
  | 'wifi'
  | 'hanging_sign'
  | 'custom_drop'

export type ElectricalMarkerType = Exclude<MarkerType, 'wifi' | 'hanging_sign' | 'custom_drop'>

export type AmpValue = '10A' | '20A' | '30A' | '60A' | '100A' | '200A' | '400A' | ''

export type UtilityMarker = {
  id: string
  label: string
  type: MarkerType
  x: number
  y: number
  amps?: AmpValue
  speed?: string
  is24Hour?: boolean
  hangingSignHeight?: string
  isRotating?: boolean
  notes?: string
}

export type UtilityLine = {
  id: string
  fromMarkerId?: string   // set when line starts from a marker/drop
  fromLineId?: string     // set when line starts from another line's endpoint
  toX: number
  toY: number
  label?: string
  notes?: string
}

// Structural sub-types used by helpers that only need a subset of fields.
// The full UtilityMarker / UtilityLine types are structurally compatible,
// but keeping narrower parameter types lets tests pass minimal fixtures.
interface MarkerLike { id: string; type: MarkerType }
interface LineLike { id: string; fromMarkerId?: string; fromLineId?: string }

// ---------------------------------------------------------------------------
// Marker metadata
// ---------------------------------------------------------------------------

export const markerOptions: Array<{
  type: MarkerType
  label: string
  short: string
}> = [
  { type: '120v', label: '120 Volt Single Phase', short: '120V' },
  { type: '208v_single_phase', label: '208 Volt Single Phase', short: '208 1P' },
  { type: '208v_three_phase', label: '208 Volt Three Phase', short: '208 3P' },
  { type: '480v_three_phase', label: '480 Volt Three Phase', short: '480 3P' },
  { type: 'wifi', label: 'WiFi', short: 'WiFi' },
  { type: 'hanging_sign', label: 'Hanging Sign', short: 'Sign' },
  { type: 'custom_drop', label: 'Custom Marker', short: 'Custom' },
]

export const markerColors: Record<MarkerType, string> = {
  '120v': '#2563eb',
  '208v_single_phase': '#7c3aed',
  '208v_three_phase': '#f97316',
  '480v_three_phase': '#be123c',
  wifi: '#047857',
  hanging_sign: '#0891b2',
  custom_drop: '#52525b',
}

// ---------------------------------------------------------------------------
// Pure formatting helpers
// ---------------------------------------------------------------------------

export function formatFeet(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

export function formatAmps(amps: string | undefined): string {
  return amps ? amps.replace(/A$/, 'AMP') : '-'
}

export function markerDisplay(type: MarkerType) {
  return markerOptions.find((option) => option.type === type) ?? markerOptions[0]
}

// ---------------------------------------------------------------------------
// Line / extension cord helpers
// ---------------------------------------------------------------------------

// Returns which booth edge is nearest to (x, y) and the distance to it.
// Used by both the canvas measurement guides and the PDF grid dashed lines so
// they always report the same nearest edges and distances.
export function getEdgeDistances(x: number, y: number, booth: { width: number; depth: number }) {
  const rightDistance = booth.width - x
  const backDistance = booth.depth - y
  const horizontalSide: 'left' | 'right' = x <= rightDistance ? 'left' : 'right'
  const verticalSide: 'front' | 'back' = y <= backDistance ? 'front' : 'back'
  return {
    horizontalSide,
    verticalSide,
    horizontalDistance: horizontalSide === 'left' ? x : rightDistance,
    verticalDistance: verticalSide === 'front' ? y : backDistance,
  }
}

export function getLineLabel(line: UtilityLine, index: number) {
  return line.label?.trim() || `L${index + 1}`
}

export function lineLocation(line: UtilityLine) {
  return `${formatFeet(line.toX)}ft from left, ${formatFeet(line.toY)}ft from front`
}

export function getLineStartCoords(
  line: UtilityLine,
  markers: UtilityMarker[],
  lines: UtilityLine[],
): { x: number; y: number } | null {
  if (line.fromMarkerId) {
    const marker = markers.find((m) => m.id === line.fromMarkerId)
    return marker ? { x: marker.x, y: marker.y } : null
  }
  if (line.fromLineId) {
    const source = lines.find((l) => l.id === line.fromLineId)
    return source ? { x: source.toX, y: source.toY } : null
  }
  return null
}

export function lineLengthFt(
  line: UtilityLine,
  markers: UtilityMarker[],
  lines: UtilityLine[],
): number | null {
  const start = getLineStartCoords(line, markers, lines)
  if (!start) return null
  const dx = line.toX - start.x
  const dy = line.toY - start.y
  return Math.sqrt(dx * dx + dy * dy)
}

// ---------------------------------------------------------------------------
// Marker type helpers
// ---------------------------------------------------------------------------

export function isElectrical(type: MarkerType): type is ElectricalMarkerType {
  return (
    type === '120v' ||
    type === '208v_single_phase' ||
    type === '208v_three_phase' ||
    type === '480v_three_phase'
  )
}

function shouldNumberMarkerShape(type: MarkerType): boolean {
  return isElectrical(type) || type === 'hanging_sign' || type === 'custom_drop'
}

export function getMarkerShapeNumber(
  marker: MarkerLike,
  markers: MarkerLike[],
): number | undefined {
  if (!shouldNumberMarkerShape(marker.type)) {
    return undefined
  }
  // Number within the same PDF/details category so the on-screen shape number
  // matches the marker ID used on the PDF grid and in the detail tables.
  // Electrical drops share one category; sign/custom are each their own type.
  const sameCategory = markers.filter((candidate) =>
    isElectrical(marker.type) ? isElectrical(candidate.type) : candidate.type === marker.type,
  )
  return sameCategory.findIndex((candidate) => candidate.id === marker.id) + 1
}

// ---------------------------------------------------------------------------
// Cascade deletion
// ---------------------------------------------------------------------------

// Given a set of extension cords being removed, expand it to include every cord
// that descends from them (cords whose fromLineId chains back to a removed cord),
// so deleting a source removes the whole branch instead of leaving orphan endpoints.
export function collectLineSubtree(
  lines: LineLike[],
  rootLineIds: Iterable<string>,
): Set<string> {
  const removed = new Set<string>(rootLineIds)
  let changed = true
  while (changed) {
    changed = false
    for (const line of lines) {
      if (!removed.has(line.id) && line.fromLineId && removed.has(line.fromLineId)) {
        removed.add(line.id)
        changed = true
      }
    }
  }
  return removed
}

// ---------------------------------------------------------------------------
// PDF page selection (testable proxy for getPdfCategories filter logic)
// ---------------------------------------------------------------------------

// Returns the title of each PDF category page that would be generated for the
// given markers/lines. Mirrors the filter condition in getPdfCategories without
// requiring jsPDF types, so this logic can be exercised in pure-function tests.
export function getActivePdfCategoryTitles(
  markers: MarkerLike[],
  lines: LineLike[],
): string[] {
  const titles: string[] = []
  if (markers.some((m) => isElectrical(m.type)) || lines.length > 0) {
    titles.push('Electrical + Extension Cords')
  }
  if (markers.some((m) => m.type === 'wifi')) titles.push('WiFi')
  if (markers.some((m) => m.type === 'hanging_sign')) titles.push('Hanging Sign')
  if (markers.some((m) => m.type === 'custom_drop')) titles.push('Custom Marker')
  return titles
}

// ---------------------------------------------------------------------------
// Persistence / migration
// ---------------------------------------------------------------------------

const VALID_MARKER_TYPES = new Set<string>([
  '120v',
  '208v_single_phase',
  '208v_three_phase',
  '480v_three_phase',
  'wifi',
  'hanging_sign',
  'custom_drop',
])

// Maps legacy saved marker types to current types.
// Returns null if the result is not a recognised MarkerType.
export function migrateMarkerType(legacyType: string): MarkerType | null {
  const mapped =
    legacyType === 'main_drop' ? '120v'
    : legacyType === 'custom_marker' ? 'custom_drop'
    : legacyType
  return VALID_MARKER_TYPES.has(mapped) ? (mapped as MarkerType) : null
}
