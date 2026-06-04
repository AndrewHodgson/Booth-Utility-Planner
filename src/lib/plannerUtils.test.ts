import { describe, expect, it } from 'vitest'
import {
  type MarkerType,
  collectLineSubtree,
  getActivePdfCategoryTitles,
  getMarkerShapeNumber,
  migrateMarkerType,
} from './plannerUtils'

// ---------------------------------------------------------------------------
// Helpers to build minimal test fixtures
// ---------------------------------------------------------------------------

function marker(id: string, type: MarkerType) {
  return { id, type }
}

function lineFromMarker(id: string, fromMarkerId: string) {
  return { id, fromMarkerId }
}

function lineFromLine(id: string, fromLineId: string) {
  return { id, fromLineId }
}

// ---------------------------------------------------------------------------
// PDF category selection
// ---------------------------------------------------------------------------

describe('getActivePdfCategoryTitles', () => {
  it('returns empty array when there are no markers or lines', () => {
    expect(getActivePdfCategoryTitles([], [])).toEqual([])
  })

  it('includes Electrical page when a power drop exists', () => {
    expect(getActivePdfCategoryTitles([marker('m1', '120v')], [])).toContain(
      'Electrical + Extension Cords',
    )
  })

  it('includes Electrical page for every electrical type', () => {
    const types: MarkerType[] = [
      '120v',
      '208v_single_phase',
      '208v_three_phase',
      '480v_three_phase',
    ]
    for (const type of types) {
      expect(getActivePdfCategoryTitles([marker('m', type)], [])).toContain(
        'Electrical + Extension Cords',
      )
    }
  })

  it('includes Electrical page when only extension cords exist (no power drops)', () => {
    expect(
      getActivePdfCategoryTitles([], [lineFromMarker('l1', 'm1')]),
    ).toContain('Electrical + Extension Cords')
  })

  it('includes WiFi page only when a WiFi marker exists', () => {
    expect(getActivePdfCategoryTitles([marker('m1', 'wifi')], [])).toContain('WiFi')
    expect(getActivePdfCategoryTitles([marker('m1', '120v')], [])).not.toContain('WiFi')
  })

  it('includes Hanging Sign page only when a hanging sign exists', () => {
    expect(getActivePdfCategoryTitles([marker('m1', 'hanging_sign')], [])).toContain(
      'Hanging Sign',
    )
    expect(getActivePdfCategoryTitles([marker('m1', 'wifi')], [])).not.toContain(
      'Hanging Sign',
    )
  })

  it('includes Custom Marker page only when a custom marker exists', () => {
    expect(getActivePdfCategoryTitles([marker('m1', 'custom_drop')], [])).toContain(
      'Custom Marker',
    )
    expect(getActivePdfCategoryTitles([marker('m1', '120v')], [])).not.toContain(
      'Custom Marker',
    )
  })

  it('does not include Electrical page for WiFi/Sign/Custom without power drops or cords', () => {
    const markers = [
      marker('m1', 'wifi'),
      marker('m2', 'hanging_sign'),
      marker('m3', 'custom_drop'),
    ]
    expect(getActivePdfCategoryTitles(markers, [])).not.toContain(
      'Electrical + Extension Cords',
    )
  })

  it('returns all four category titles when every marker type is present', () => {
    const markers = [
      marker('m1', '120v'),
      marker('m2', 'wifi'),
      marker('m3', 'hanging_sign'),
      marker('m4', 'custom_drop'),
    ]
    expect(getActivePdfCategoryTitles(markers, [])).toEqual([
      'Electrical + Extension Cords',
      'WiFi',
      'Hanging Sign',
      'Custom Marker',
    ])
  })
})

// ---------------------------------------------------------------------------
// Marker numbering
// ---------------------------------------------------------------------------

describe('getMarkerShapeNumber', () => {
  it('numbers electrical drops as a single category regardless of type mix', () => {
    const markers = [
      marker('m1', '120v'),
      marker('m2', 'wifi'),            // interspersed, different category
      marker('m3', '208v_single_phase'),
      marker('m4', '120v'),
    ]
    expect(getMarkerShapeNumber(markers[0], markers)).toBe(1)
    expect(getMarkerShapeNumber(markers[2], markers)).toBe(2)
    expect(getMarkerShapeNumber(markers[3], markers)).toBe(3)
  })

  it('returns undefined for WiFi (displayed as icon, no shape number)', () => {
    const markers = [marker('m1', 'wifi'), marker('m2', 'wifi')]
    expect(getMarkerShapeNumber(markers[0], markers)).toBeUndefined()
    expect(getMarkerShapeNumber(markers[1], markers)).toBeUndefined()
  })

  it('numbers Hanging Signs in their own independent sequence', () => {
    const markers = [
      marker('m1', '120v'),
      marker('m2', 'hanging_sign'),
      marker('m3', 'hanging_sign'),
    ]
    expect(getMarkerShapeNumber(markers[1], markers)).toBe(1)
    expect(getMarkerShapeNumber(markers[2], markers)).toBe(2)
  })

  it('numbers Custom Markers in their own independent sequence', () => {
    const markers = [marker('m1', 'custom_drop'), marker('m2', 'custom_drop')]
    expect(getMarkerShapeNumber(markers[0], markers)).toBe(1)
    expect(getMarkerShapeNumber(markers[1], markers)).toBe(2)
  })

  it('electrical and Hanging Sign sequences are independent of each other', () => {
    const markers = [marker('m1', 'hanging_sign'), marker('m2', '120v')]
    expect(getMarkerShapeNumber(markers[0], markers)).toBe(1) // Hanging Sign #1
    expect(getMarkerShapeNumber(markers[1], markers)).toBe(1) // Electrical #1
  })
})

// ---------------------------------------------------------------------------
// Extension cord deletion cascade
// ---------------------------------------------------------------------------

describe('collectLineSubtree', () => {
  it('returns empty set for empty root list', () => {
    const lines = [lineFromMarker('l1', 'm1')]
    expect(collectLineSubtree(lines, [])).toEqual(new Set())
  })

  it('includes the root line IDs themselves', () => {
    const lines = [lineFromMarker('l1', 'm1')]
    expect(collectLineSubtree(lines, ['l1']).has('l1')).toBe(true)
  })

  it('collects all descendants recursively (4-level chain)', () => {
    const lines = [
      lineFromMarker('l1', 'm1'),
      lineFromLine('l2', 'l1'),
      lineFromLine('l3', 'l2'),
      lineFromLine('l4', 'l3'),
    ]
    expect(collectLineSubtree(lines, ['l1'])).toEqual(new Set(['l1', 'l2', 'l3', 'l4']))
  })

  it('deleting a mid-chain cord removes it and its descendants but not siblings', () => {
    const lines = [
      lineFromMarker('l1', 'm1'),
      lineFromLine('l2', 'l1'),   // to be deleted
      lineFromLine('l2b', 'l1'),  // sibling of l2, must survive
      lineFromLine('l3', 'l2'),   // child of deleted l2, must go
    ]
    const removed = collectLineSubtree(lines, ['l2'])
    expect(removed.has('l2')).toBe(true)
    expect(removed.has('l3')).toBe(true)
    expect(removed.has('l1')).toBe(false)
    expect(removed.has('l2b')).toBe(false)
  })

  it('removing a marker root removes all cords in the tree', () => {
    const lines = [
      lineFromMarker('l1', 'm1'),
      lineFromLine('l2', 'l1'),
      lineFromLine('l3', 'l2'),
      lineFromLine('l3b', 'l2'), // second branch of l2
    ]
    // Simulate deleteMarker: roots are the cords directly attached to the marker
    const removed = collectLineSubtree(lines, ['l1'])
    expect(removed).toEqual(new Set(['l1', 'l2', 'l3', 'l3b']))
  })
})

// ---------------------------------------------------------------------------
// Persistence / migration
// ---------------------------------------------------------------------------

describe('migrateMarkerType', () => {
  it('maps legacy main_drop to 120v', () => {
    expect(migrateMarkerType('main_drop')).toBe('120v')
  })

  it('maps legacy custom_marker to custom_drop', () => {
    expect(migrateMarkerType('custom_marker')).toBe('custom_drop')
  })

  it('passes through all current valid types unchanged', () => {
    const types: MarkerType[] = [
      '120v',
      '208v_single_phase',
      '208v_three_phase',
      '480v_three_phase',
      'wifi',
      'hanging_sign',
      'custom_drop',
    ]
    for (const type of types) {
      expect(migrateMarkerType(type)).toBe(type)
    }
  })

  it('returns null for unrecognised or garbage type strings', () => {
    expect(migrateMarkerType('garbage')).toBeNull()
    expect(migrateMarkerType('')).toBeNull()
    expect(migrateMarkerType('main_drop_old')).toBeNull()
    expect(migrateMarkerType('WIFI')).toBeNull() // case-sensitive
  })
})
