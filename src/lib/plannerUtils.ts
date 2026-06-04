// Pure helpers and the MarkerType union. Everything here is free of React,
// jsPDF, and DOM dependencies so it can be imported by both App.tsx and tests.

export type MarkerType =
  | '120v'
  | '208v_single_phase'
  | '208v_three_phase'
  | '480v_three_phase'
  | 'wifi'
  | 'hanging_sign'
  | 'custom_drop'

export type ElectricalMarkerType = Exclude<MarkerType, 'wifi' | 'hanging_sign' | 'custom_drop'>

// Structural sub-types: only the fields each helper actually reads.
// App.tsx's full UtilityMarker / UtilityLine are structurally compatible.
interface MarkerLike { id: string; type: MarkerType }
interface LineLike { id: string; fromMarkerId?: string; fromLineId?: string }

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
