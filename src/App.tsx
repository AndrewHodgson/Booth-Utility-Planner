import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import {
  Download,
  Hand,
  Maximize2,
  MousePointer2,
  RotateCcw,
  RotateCw,
  Trash2,
  Upload,
  Wifi,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import {
  createCroppedImageDataUrl,
  createFadedImageDataUrl,
} from './utils/cropImage'
import './App.css'

type MarkerType =
  | '120v'
  | '208v_single_phase'
  | '208v_three_phase'
  | '480v_three_phase'
  | 'wifi'
  | 'hanging_sign'
  | 'custom_drop'

type AmpValue = '10A' | '20A' | '30A' | '60A' | '100A' | '200A' | '400A' | ''
type ElectricalMarkerType = Exclude<MarkerType, 'wifi' | 'hanging_sign' | 'custom_drop'>

type UtilityMarker = {
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

type UtilityLine = {
  id: string
  fromMarkerId?: string   // set when line starts from a marker/drop
  fromLineId?: string     // set when line starts from another line's endpoint
  toX: number
  toY: number
  label?: string
  notes?: string
}

const BOOTH_TYPES = ['Inline', 'Corner', 'Peninsula', 'End Cap', 'Island'] as const
type BoothType = (typeof BOOTH_TYPES)[number]

type BoothDetails = {
  name: string
  companyName: string
  email: string
  phone: string
  boothNumber: string
  showName: string
  showDate: string
  showLocation: string
  width: number
  depth: number
  boothType: BoothType
  sideLabels: {
    front: string
    back: string
    left: string
    right: string
  }
}

type PlannerState = {
  booth: BoothDetails
  markers: UtilityMarker[]
  lines: UtilityLine[]
  selectedTool: MarkerType
  renderImage?: RenderImage
  hasCompletedSetup: boolean
}

type RenderImage = {
  dataUrl: string
  fileName: string
  opacity: number
  width: number
  height: number
  wasCropped: boolean
}

type RenderCropRequest = {
  fileName: string
  imageSrc: string
  width: number
  height: number
  outputWidth: number
  outputHeight: number
  aspect: number
  boothWidth: number
  boothDepth: number
}

const STORAGE_KEY = 'sourceone-booth-utility-planner'
const SNAP_FEET = 0.5
const DEFAULT_TOOL: MarkerType = '120v'
const MIN_ZOOM = 1
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25
const LARGE_GRID_THRESHOLD_FT = 50
const LARGE_GRID_CELL_PX = 24
const GRID_MAX_CELL_PX = 64
const GRID_MIN_CELL_PX = 5
const ASPECT_RATIO_TOLERANCE = 0.01
const MAX_RENDER_UPLOAD_BYTES = 5 * 1024 * 1024
const DEFAULT_RENDER_OPACITY = 0.32
const MAX_RENDER_OUTPUT_EDGE = 1800
const PDF_MARGIN = 32
const PDF_FOOTER_BOTTOM_OFFSET = 20
const PDF_SIDE_LABEL_FONT_SIZE = 8
const PDF_SIDE_LABEL_GAP = 10
const PDF_SIDE_LABEL_LINE_HEIGHT = PDF_SIDE_LABEL_FONT_SIZE
const PDF_TABLE_HEADER_HEIGHT = 16
const PDF_TABLE_ROW_MIN_HEIGHT = 17
const PDF_TABLE_LINE_HEIGHT = 8
const PDF_TABLE_BOTTOM_PADDING = 48
const PDF_LOGO_MAX_WIDTH = 126
const PDF_LOGO_MAX_HEIGHT = 38
const dimensionOptions = Array.from({ length: 10 }, (_, index) => (index + 1) * 10)

const markerOptions: Array<{
  type: MarkerType
  label: string
  short: string
}> = [
  { type: '120v', label: '120 V', short: '120V' },
  { type: '208v_single_phase', label: '208 V Single', short: '208 1P' },
  { type: '208v_three_phase', label: '208 V Three', short: '208 3P' },
  { type: '480v_three_phase', label: '480 V Three', short: '480 3P' },
  { type: 'wifi', label: 'WiFi', short: 'WiFi' },
  { type: 'hanging_sign', label: 'Hanging Sign', short: 'Sign' },
  { type: 'custom_drop', label: 'Custom Marker', short: 'Custom' },
]

const ampOptionsByType: Record<ElectricalMarkerType, AmpValue[]> = {
  '120v': ['10A', '20A'],
  '208v_single_phase': ['30A', '60A'],
  '208v_three_phase': ['20A', '30A', '60A', '100A', '200A', '400A'],
  '480v_three_phase': ['30A', '60A', '100A', '200A', '400A'],
}

const markerColors: Record<MarkerType, string> = {
  '120v': '#2563eb',
  '208v_single_phase': '#7c3aed',
  '208v_three_phase': '#f97316',
  '480v_three_phase': '#be123c',
  wifi: '#047857',
  hanging_sign: '#0891b2',
  custom_drop: '#52525b',
}

const sourceOneLogoPath = '/SourceOne-Logo-RGB.svg'

function NumberedShapeIcon({
  shape,
  number,
  size,
}: {
  shape: 'triangle' | 'circle' | 'square' | 'diamond' | 'pentagon' | 'hexagon'
  number?: number
  size: number
}) {
  const strokeProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: '2' as const,
  }
  // Triangle centroid sits at y≈14.3 in a 24×24 viewBox (apex y=3, base y=20)
  const textY = shape === 'triangle' ? 14 : 12.5

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="nested-shape-icon"
    >
      {shape === 'triangle' && <path {...strokeProps} d="M12 3 21 20H3L12 3Z" />}
      {shape === 'circle' && <circle {...strokeProps} cx="12" cy="12" r="8.5" />}
      {shape === 'square' && <rect {...strokeProps} x="4" y="4" width="16" height="16" rx="1.5" />}
      {shape === 'diamond' && <path {...strokeProps} d="M12 2 22 12 12 22 2 12Z" />}
      {shape === 'pentagon' && <path {...strokeProps} d="M12 3 21 10 17.5 21H6.5L3 10 12 3Z" />}
      {shape === 'hexagon' && <path {...strokeProps} d="M7 4H17L22 12 17 20H7L2 12 7 4Z" />}
      {number !== undefined && (
        <text
          x="12"
          y={textY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="currentColor"
          stroke="none"
          fontSize={9}
          fontWeight="900"
          fontFamily="system-ui, sans-serif"
        >
          {number}
        </text>
      )}
    </svg>
  )
}

function MarkerTypeIcon({ type, size = 15, number }: { type: MarkerType; size?: number; number?: number }) {
  switch (type) {
    case '120v':
      return <NumberedShapeIcon shape="triangle" number={number} size={size} />
    case '208v_single_phase':
      return <NumberedShapeIcon shape="square" number={number} size={size} />
    case '208v_three_phase':
      return <NumberedShapeIcon shape="diamond" number={number} size={size} />
    case '480v_three_phase':
      return <NumberedShapeIcon shape="pentagon" number={number} size={size} />
    case 'wifi':
      return <Wifi size={size} />
    case 'hanging_sign':
      return <NumberedShapeIcon shape="circle" number={number} size={size} />
    case 'custom_drop':
      return <NumberedShapeIcon shape="hexagon" number={number} size={size} />
  }
}

function LineToolIcon({ size = 17 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5 17 19 7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle cx="5" cy="17" r="2.5" fill="currentColor" />
      <circle cx="19" cy="7" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

const defaultBooth: BoothDetails = {
  name: '',
  companyName: '',
  email: '',
  phone: '',
  boothNumber: '',
  showName: '',
  showDate: '',
  showLocation: '',
  width: 20,
  depth: 20,
  boothType: 'Inline',
  sideLabels: {
    front: '',
    back: '',
    left: '',
    right: '',
  },
}

const defaultState: PlannerState = {
  booth: defaultBooth,
  markers: [],
  lines: [],
  selectedTool: DEFAULT_TOOL,
  hasCompletedSetup: false,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function snapFeet(value: number) {
  return Math.round(value / SNAP_FEET) * SNAP_FEET
}

function formatFeet(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

function isSupportedRenderFile(file: File) {
  return (
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    /\.(jpe?g|png)$/i.test(file.name)
  )
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.isContentEditable || Boolean(target.closest('input, textarea, select, [contenteditable]'))
}

function readImageFile(file: File) {
  return new Promise<{ imageSrc: string; width: number; height: number }>((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener(
      'load',
      () => {
        const image = new Image()

        image.addEventListener(
          'load',
          () =>
            resolve({
              imageSrc: String(reader.result),
              width: image.naturalWidth,
              height: image.naturalHeight,
            }),
          { once: true },
        )
        image.addEventListener('error', reject, { once: true })
        image.src = String(reader.result)
      },
      { once: true },
    )
    reader.addEventListener('error', reject, { once: true })
    reader.readAsDataURL(file)
  })
}

function getRenderOutputSize(booth: BoothDetails) {
  const aspect = booth.width / booth.depth

  if (aspect >= 1) {
    return {
      width: MAX_RENDER_OUTPUT_EDGE,
      height: Math.max(1, Math.round(MAX_RENDER_OUTPUT_EDGE / aspect)),
    }
  }

  return {
    width: Math.max(1, Math.round(MAX_RENDER_OUTPUT_EDGE * aspect)),
    height: MAX_RENDER_OUTPUT_EDGE,
  }
}

function sanitizeRenderImage(renderImage: unknown): RenderImage | undefined {
  if (!renderImage || typeof renderImage !== 'object') {
    return undefined
  }

  const candidate = renderImage as Partial<RenderImage>
  if (
    typeof candidate.dataUrl !== 'string' ||
    !candidate.dataUrl.startsWith('data:image/') ||
    typeof candidate.fileName !== 'string'
  ) {
    return undefined
  }

  const width = clamp(Number(candidate.width) || 1200, 1, 2400)
  const height = clamp(Number(candidate.height) || 1200, 1, 2400)

  return {
    dataUrl: candidate.dataUrl,
    fileName: candidate.fileName,
    opacity: clamp(Number(candidate.opacity) || DEFAULT_RENDER_OPACITY, 0.05, 0.6),
    width,
    height,
    wasCropped: Boolean(candidate.wasCropped),
  }
}

function getMarkerLabel(type: MarkerType, markers: UtilityMarker[]) {
  if (type === 'wifi') {
    const count = markers.filter((marker) => marker.type === 'wifi').length + 1
    return `W${count}`
  }
  if (type === 'hanging_sign') {
    const count = markers.filter((marker) => marker.type === 'hanging_sign').length + 1
    return `S${count}`
  }
  if (type === 'custom_drop') {
    const count = markers.filter((marker) => marker.type === 'custom_drop').length + 1
    return `C${count}`
  }

  const count = markers.filter((marker) => isElectrical(marker.type)).length + 1
  return `E${count}`
}

function shouldNumberMarkerShape(type: MarkerType) {
  return isElectrical(type) || type === 'hanging_sign' || type === 'custom_drop'
}

function getMarkerShapeNumber(marker: UtilityMarker, markers: UtilityMarker[]) {
  if (!shouldNumberMarkerShape(marker.type)) {
    return undefined
  }
  return markers.filter((candidate) => candidate.type === marker.type).findIndex((candidate) => candidate.id === marker.id) + 1
}

function isElectrical(type: MarkerType): type is ElectricalMarkerType {
  return type === '120v' ||
    type === '208v_single_phase' ||
    type === '208v_three_phase' ||
    type === '480v_three_phase'
}

function getAmpOptions(type: MarkerType) {
  return isElectrical(type) ? ampOptionsByType[type] : []
}

function getDefaultAmp(type: MarkerType): AmpValue | undefined {
  return getAmpOptions(type)[0]
}

function getValidAmp(type: MarkerType, amps: unknown): AmpValue | undefined {
  const options = getAmpOptions(type)
  if (options.length === 0) {
    return undefined
  }
  return options.includes(amps as AmpValue) ? (amps as AmpValue) : options[0]
}

function markerDisplay(type: MarkerType) {
  return markerOptions.find((option) => option.type === type) ?? markerOptions[0]
}

function getToolbarLabelLines(type: MarkerType) {
  switch (type) {
    case '120v':
      return ['120 V', 'Single']
    case '208v_single_phase':
      return ['208 V', 'Single']
    case '208v_three_phase':
      return ['208 V', 'Three']
    case '480v_three_phase':
      return ['480 V', 'Three']
    case 'hanging_sign':
      return ['Hanging', 'Sign']
    case 'custom_drop':
      return ['Custom', 'Marker']
    case 'wifi':
      return ['WiFi']
  }
}

function getGridMarkerDisplayLabel(type: MarkerType) {
  switch (type) {
    case '120v':
      return '120 V S'
    case '208v_single_phase':
      return '208 V S'
    case '208v_three_phase':
      return '208 V T'
    case '480v_three_phase':
      return '480 V T'
    case 'wifi':
      return 'WiFi'
    case 'hanging_sign':
      return 'Hanging'
    case 'custom_drop':
      return 'Custom'
  }
}

function formatAmps(amps: string | undefined): string {
  return amps ? amps.replace(/A$/, 'AMP') : '-'
}

function markerValue(marker: UtilityMarker) {
  if (isElectrical(marker.type)) {
    return formatAmps(marker.amps)
  }
  if (marker.type === 'wifi') {
    return marker.speed || '-'
  }
  if (marker.type === 'hanging_sign') {
    return marker.hangingSignHeight?.trim() || '-'
  }
  if (marker.type === 'custom_drop') {
    return 'Custom'
  }
  return '-'
}

function markerFlag(marker: UtilityMarker) {
  if (isElectrical(marker.type)) {
    return marker.is24Hour ? '24-hour power' : '-'
  }
  if (marker.type === 'hanging_sign') {
    return marker.isRotating ? 'Rotating' : 'Not rotating'
  }
  return '-'
}

function markerLocation(marker: UtilityMarker) {
  return `${formatFeet(marker.x)}ft from left, ${formatFeet(marker.y)}ft from front`
}

// Shared edge logic used by the grid measurement guides and the selected-drop
// details panel so they always report the same nearest edges/distances.
function getEdgeDistances(x: number, y: number, booth: BoothDetails) {
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

function lineLocation(line: UtilityLine) {
  return `${formatFeet(line.toX)}ft from left, ${formatFeet(line.toY)}ft from front`
}

function getLineLabel(line: UtilityLine, index: number) {
  return line.label?.trim() || `L${index + 1}`
}

function getLineStartCoords(
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

function lineLengthFt(
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

function getPdfMarkerId(markers: UtilityMarker[], marker: UtilityMarker) {
  return String(markers.findIndex((candidate) => candidate.id === marker.id) + 1)
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

function fitPdfImage(
  imageWidth: number,
  imageHeight: number,
  maxWidth: number,
  maxHeight: number,
) {
  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight)
  return {
    width: imageWidth * scale,
    height: imageHeight * scale,
  }
}

async function svgAssetToPngDataUrl(path: string) {
  const svg = await fetch(path).then((response) => response.text())
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = reject
      nextImage.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = 720
    canvas.height = Math.max(1, Math.round((image.height / image.width) * canvas.width))
    const context = canvas.getContext('2d')
    if (!context) {
      return null
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

type PdfGridLayout = {
  x: number
  y: number
  width: number
  height: number
}

type PdfPlannerView = PlannerState & {
  allMarkers?: UtilityMarker[]
  allLines?: UtilityLine[]
}

type PdfTableColumn = {
  label: string
  width: number
}

type PdfCategory = {
  title: string
  markers: UtilityMarker[]
  lines: UtilityLine[]
  includeLineLegend?: boolean
  drawDetails: (doc: jsPDF, planner: PdfPlannerView, startY: number) => number
}

type PdfMarkerShape = 'triangle' | 'square' | 'diamond' | 'pentagon' | 'circle' | 'hexagon'

function markerPdfPoint(marker: UtilityMarker, booth: BoothDetails, grid: PdfGridLayout) {
  return {
    x: grid.x + (marker.x / booth.width) * grid.width,
    y: grid.y + ((booth.depth - marker.y) / booth.depth) * grid.height,
  }
}

function linePdfEndpoint(line: UtilityLine, booth: BoothDetails, grid: PdfGridLayout) {
  return {
    x: grid.x + (line.toX / booth.width) * grid.width,
    y: grid.y + ((booth.depth - line.toY) / booth.depth) * grid.height,
  }
}

function getPdfMarkerShape(type: MarkerType): PdfMarkerShape {
  switch (type) {
    case '120v':
      return 'triangle'
    case '208v_single_phase':
      return 'square'
    case '208v_three_phase':
      return 'diamond'
    case '480v_three_phase':
      return 'pentagon'
    case 'hanging_sign':
      return 'circle'
    case 'custom_drop':
      return 'hexagon'
    case 'wifi':
      return 'circle'
  }
}

function getRegularPolygonPoints(
  sides: number,
  centerX: number,
  centerY: number,
  radius: number,
  startAngleRadians: number,
) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = startAngleRadians + (index * 2 * Math.PI) / sides
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    }
  })
}

function drawPdfPolygon(
  doc: jsPDF,
  points: Array<{ x: number; y: number }>,
  style: 'F' | 'FD',
) {
  const [firstPoint, ...remainingPoints] = points
  const vectors = remainingPoints.map((point, index) => {
    const previousPoint = index === 0 ? firstPoint : remainingPoints[index - 1]
    return [point.x - previousPoint.x, point.y - previousPoint.y]
  })
  doc.lines(vectors, firstPoint.x, firstPoint.y, [1, 1], style, true)
}

function drawPdfMarkerShape(
  doc: jsPDF,
  type: MarkerType,
  centerX: number,
  centerY: number,
  size: number,
  style: 'F' | 'FD' = 'FD',
) {
  const radius = size / 2
  const shape = getPdfMarkerShape(type)

  if (shape === 'circle') {
    doc.circle(centerX, centerY, radius, style)
    return
  }

  if (shape === 'square') {
    doc.rect(centerX - radius, centerY - radius, size, size, style)
    return
  }

  if (shape === 'diamond') {
    drawPdfPolygon(doc, [
      { x: centerX, y: centerY - radius },
      { x: centerX + radius, y: centerY },
      { x: centerX, y: centerY + radius },
      { x: centerX - radius, y: centerY },
    ], style)
    return
  }

  if (shape === 'triangle') {
    drawPdfPolygon(doc, [
      { x: centerX, y: centerY - radius },
      { x: centerX + radius, y: centerY + radius * 0.86 },
      { x: centerX - radius, y: centerY + radius * 0.86 },
    ], style)
    return
  }

  drawPdfPolygon(
    doc,
    getRegularPolygonPoints(shape === 'pentagon' ? 5 : 6, centerX, centerY, radius, shape === 'pentagon' ? -Math.PI / 2 : 0),
    style,
  )
}

function getPdfSideLabel(side: keyof BoothDetails['sideLabels'], booth: BoothDetails) {
  const label = side.charAt(0).toUpperCase() + side.slice(1)
  return `${label}: ${booth.sideLabels[side] || '-'}`
}

function drawPdfSideLabels(doc: jsPDF, booth: BoothDetails, grid: PdfGridLayout) {
  doc.setTextColor(17, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(PDF_SIDE_LABEL_FONT_SIZE)

  const labels = {
    back: getPdfSideLabel('back', booth),
    front: getPdfSideLabel('front', booth),
    left: getPdfSideLabel('left', booth),
    right: getPdfSideLabel('right', booth),
  }
  const measuredHeights = Object.values(labels).map((label) => {
    const dimensions = doc.getTextDimensions(label, {
      fontSize: PDF_SIDE_LABEL_FONT_SIZE,
    })
    return dimensions.h || PDF_SIDE_LABEL_LINE_HEIGHT
  })
  const labelHeight = Math.max(PDF_SIDE_LABEL_LINE_HEIGHT, ...measuredHeights)
  const halfLabelHeight = labelHeight / 2
  const textOptions = {
    align: 'center' as const,
    baseline: 'middle' as const,
  }
  const gridCenterX = grid.x + grid.width / 2
  const gridCenterY = grid.y + grid.height / 2

  doc.text(labels.back, gridCenterX, grid.y - PDF_SIDE_LABEL_GAP - halfLabelHeight, textOptions)
  doc.text(
    labels.front,
    gridCenterX,
    grid.y + grid.height + PDF_SIDE_LABEL_GAP + halfLabelHeight,
    textOptions,
  )
  doc.text(labels.left, grid.x - PDF_SIDE_LABEL_GAP - halfLabelHeight, gridCenterY, {
    ...textOptions,
    angle: 90,
  })
  doc.text(labels.right, grid.x + grid.width + PDF_SIDE_LABEL_GAP + halfLabelHeight, gridCenterY, {
    ...textOptions,
    angle: 270,
  })
}

async function drawPdfGrid(doc: jsPDF, planner: PdfPlannerView, grid: PdfGridLayout) {
  const { booth, markers, lines, renderImage } = planner
  const lineMarkerLookup = planner.allMarkers ?? markers
  const lineLookup = planner.allLines ?? lines

  if (renderImage) {
    const fadedImage = await createFadedImageDataUrl(renderImage.dataUrl, renderImage.opacity, {
      width: renderImage.width,
      height: renderImage.height,
    })
    doc.addImage(fadedImage, 'JPEG', grid.x, grid.y, grid.width, grid.height)
  }

  doc.setDrawColor(185, 185, 185)
  doc.setLineWidth(0.35)
  for (let x = 0; x <= booth.width; x += 1) {
    const lineX = grid.x + (x / booth.width) * grid.width
    doc.line(lineX, grid.y, lineX, grid.y + grid.height)
  }
  for (let y = 0; y <= booth.depth; y += 1) {
    const lineY = grid.y + (y / booth.depth) * grid.height
    doc.line(grid.x, lineY, grid.x + grid.width, lineY)
  }

  doc.setDrawColor(17, 24, 39)
  doc.setLineWidth(1.5)
  doc.rect(grid.x, grid.y, grid.width, grid.height)

  lines.forEach((line, index) => {
    const startCoords = getLineStartCoords(line, lineMarkerLookup, lineLookup)
    if (!startCoords) {
      return
    }
    const start = {
      x: grid.x + (startCoords.x / booth.width) * grid.width,
      y: grid.y + ((booth.depth - startCoords.y) / booth.depth) * grid.height,
    }
    const end = linePdfEndpoint(line, booth, grid)
    doc.setDrawColor(33, 70, 112)
    doc.setLineWidth(1.4)
    doc.line(start.x, start.y, end.x, end.y)

    // Length label at midpoint
    const len = lineLengthFt(line, lineMarkerLookup, lineLookup)
    if (len !== null && len > 0) {
      const midX = (start.x + end.x) / 2
      const midY = (start.y + end.y) / 2
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5.5)
      doc.setTextColor(33, 70, 112)
      doc.text(`${formatFeet(len)}ft`, midX, midY - 3, { align: 'center' })
    }

    // Endpoint circle + label
    doc.setFillColor(33, 70, 112)
    doc.circle(end.x, end.y, 3.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5)
    doc.setTextColor(255, 255, 255)
    doc.text(getLineLabel(line, index), end.x, end.y + 1.8, { align: 'center' })
  })

  markers.forEach((marker) => {
    const point = markerPdfPoint(marker, booth, grid)
    const leftDistance = marker.x
    const rightDistance = booth.width - marker.x
    const frontDistance = marker.y
    const backDistance = booth.depth - marker.y
    const horizontalEdgeX =
      leftDistance <= rightDistance ? grid.x : grid.x + grid.width
    const verticalEdgeY =
      frontDistance <= backDistance ? grid.y + grid.height : grid.y
    const horizontalDistance = Math.min(leftDistance, rightDistance)
    const verticalDistance = Math.min(frontDistance, backDistance)
    const [r, g, b] = hexToRgb(markerColors[marker.type])

    doc.setDrawColor(r, g, b)
    doc.setLineWidth(0.9)
    doc.setLineDashPattern([1, 2.5], 0)
    doc.line(point.x, point.y, horizontalEdgeX, point.y)
    doc.line(point.x, point.y, point.x, verticalEdgeY)
    doc.setLineDashPattern([], 0)

    doc.setTextColor(r, g, b)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.8)
    doc.text(`${formatFeet(horizontalDistance)}ft`, (point.x + horizontalEdgeX) / 2, point.y - 4, {
      align: 'center',
    })
    doc.text(`${formatFeet(verticalDistance)}ft`, point.x + 4, (point.y + verticalEdgeY) / 2)
  })

  markers.forEach((marker) => {
    const point = markerPdfPoint(marker, booth, grid)
    const [r, g, b] = hexToRgb(markerColors[marker.type])
    doc.setFillColor(r, g, b)
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(1)
    drawPdfMarkerShape(doc, marker.type, point.x, point.y, 14, 'FD')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.2)
    doc.text(getPdfMarkerId(markers, marker), point.x, point.y + 2.5, { align: 'center' })
  })

  drawPdfSideLabels(doc, booth, grid)
}

function drawPdfFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages()
  const pageHeight = doc.internal.pageSize.getHeight()

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(75, 85, 99)
    doc.text(
      'Email: exhibitorservices@sourceoneevents.com | Phone: 708.344.3050 | Fax: 708.344.4111',
      PDF_MARGIN,
      pageHeight - PDF_FOOTER_BOTTOM_OFFSET,
    )
  }
}

function drawLegend(
  doc: jsPDF,
  markers: UtilityMarker[],
  x: number,
  y: number,
  options: { includeLines?: boolean } = {},
) {
  const presentTypes = markerOptions.filter((option) =>
    markers.some((marker) => marker.type === option.type),
  )
  if (presentTypes.length === 0 && !options.includeLines) {
    return y
  }

  doc.setTextColor(17, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Legend', x, y)

  let cursorX = x
  let cursorY = y + 13
  const legendItems = [
    ...presentTypes.map((option) => ({
      type: option.type,
      label: option.label,
      color: markerColors[option.type],
      kind: 'marker' as const,
    })),
    ...(options.includeLines
      ? [{
          key: 'line',
          label: 'Extension Cord',
          color: '#214670',
          kind: 'line' as const,
        }]
      : []),
  ]

  legendItems.forEach((item) => {
    const itemWidth = Math.max(68, doc.getTextWidth(item.label) + 18)
    if (cursorX + itemWidth > 560) {
      cursorX = x
      cursorY += 13
    }
    const [r, g, b] = hexToRgb(item.color)
    doc.setFillColor(r, g, b)
    doc.setDrawColor(r, g, b)
    if (item.kind === 'line') {
      doc.setLineWidth(1.4)
      doc.line(cursorX, cursorY - 3, cursorX + 8, cursorY - 3)
      doc.circle(cursorX + 8, cursorY - 3, 2.3, 'F')
    } else {
      drawPdfMarkerShape(doc, item.type, cursorX + 4, cursorY - 3, 7, 'F')
    }
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(55, 65, 81)
    doc.setFontSize(7.5)
    doc.text(item.label, cursorX + 12, cursorY)
    cursorX += itemWidth
  })

  return cursorY + 10
}

function drawPdfTable(doc: jsPDF, columns: PdfTableColumn[], rows: string[][], startY: number) {
  const pageHeight = doc.internal.pageSize.getHeight()
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0)
  let y = startY

  function drawHeader() {
    doc.setFillColor(33, 70, 112)
    doc.rect(PDF_MARGIN, y, tableWidth, PDF_TABLE_HEADER_HEIGHT, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(255, 255, 255)
    let x = PDF_MARGIN
    columns.forEach((column) => {
      doc.text(column.label, x + 4, y + 11)
      x += column.width
    })
    y += PDF_TABLE_HEADER_HEIGHT
  }

  drawHeader()

  rows.forEach((cells, index) => {
    const cellLines = cells.map((cell, cellIndex) =>
      doc.splitTextToSize(cell, columns[cellIndex].width - 8),
    )
    const rowHeight = Math.max(
      PDF_TABLE_ROW_MIN_HEIGHT,
      Math.max(...cellLines.map((lines) => lines.length)) * PDF_TABLE_LINE_HEIGHT + 6,
    )

    if (y + rowHeight > pageHeight - PDF_TABLE_BOTTOM_PADDING) {
      doc.addPage()
      y = PDF_MARGIN
      drawHeader()
    }

    doc.setFillColor(index % 2 === 0 ? 248 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 252 : 255)
    doc.rect(PDF_MARGIN, y, tableWidth, rowHeight, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.rect(PDF_MARGIN, y, tableWidth, rowHeight)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(31, 41, 55)
    let x = PDF_MARGIN
    cellLines.forEach((lines, cellIndex) => {
      doc.text(lines, x + 4, y + 10)
      x += columns[cellIndex].width
    })
    y += rowHeight
  })

  return y
}

function drawDropTable(doc: jsPDF, planner: PdfPlannerView, startY: number) {
  const columns = [
    { label: 'ID', width: 28 },
    { label: 'Type', width: 112 },
    { label: 'Location', width: 116 },
    { label: 'Details', width: 64 },
    { label: 'Option', width: 48 },
    { label: 'Notes', width: 172 },
  ]
  const rows = planner.markers.map((marker) => [
    getPdfMarkerId(planner.markers, marker),
    markerDisplay(marker.type).label,
    markerLocation(marker),
    markerValue(marker),
    markerFlag(marker),
    marker.notes?.trim() || '-',
  ])
  return drawPdfTable(doc, columns, rows, startY)
}

function drawLineTable(doc: jsPDF, planner: PdfPlannerView, startY: number) {
  const markerLookup = planner.allMarkers ?? planner.markers
  const lineLookup = planner.allLines ?? planner.lines
  const columns = [
    { label: 'ID', width: 44 },
    { label: 'Connected To', width: 86 },
    { label: 'Connected Type', width: 122 },
    { label: 'End Location', width: 154 },
    { label: 'Notes', width: 134 },
  ]
  const rows = planner.lines.map((line, index) => {
    let connectedId = '-'
    let connectedType = '-'
    if (line.fromMarkerId) {
      const fromMarker = markerLookup.find((m) => m.id === line.fromMarkerId)
      connectedId = fromMarker ? `Marker ${getPdfMarkerId(markerLookup, fromMarker)}` : '-'
      connectedType = fromMarker ? markerDisplay(fromMarker.type).label : '-'
    } else if (line.fromLineId) {
      const fromLine = lineLookup.find((l) => l.id === line.fromLineId)
      const fromLineIndex = lineLookup.findIndex((l) => l.id === line.fromLineId)
      connectedId = fromLine ? `Extension Cord ${getLineLabel(fromLine, fromLineIndex)} endpoint` : '-'
      connectedType = 'Extension Cord endpoint'
    }
    return [
      getLineLabel(line, index),
      connectedId,
      connectedType,
      lineLocation(line),
      line.notes?.trim() || '-',
    ]
  })
  return drawPdfTable(doc, columns, rows, startY)
}

function drawWifiTable(doc: jsPDF, planner: PdfPlannerView, startY: number) {
  const columns = [
    { label: 'ID', width: 32 },
    { label: 'Location', width: 168 },
    { label: 'Speed', width: 110 },
    { label: 'Notes', width: 230 },
  ]
  const rows = planner.markers.map((marker) => [
    getPdfMarkerId(planner.markers, marker),
    markerLocation(marker),
    marker.speed || '-',
    marker.notes?.trim() || '-',
  ])
  return drawPdfTable(doc, columns, rows, startY)
}

function drawHangingSignTable(doc: jsPDF, planner: PdfPlannerView, startY: number) {
  const columns = [
    { label: 'ID', width: 32 },
    { label: 'Location', width: 148 },
    { label: 'Height From Ground', width: 114 },
    { label: 'Rotating', width: 66 },
    { label: 'Notes', width: 180 },
  ]
  const rows = planner.markers.map((marker) => [
    getPdfMarkerId(planner.markers, marker),
    markerLocation(marker),
    marker.hangingSignHeight?.trim() || '-',
    marker.isRotating ? 'Yes' : 'No',
    marker.notes?.trim() || '-',
  ])
  return drawPdfTable(doc, columns, rows, startY)
}

function drawCustomMarkerTable(doc: jsPDF, planner: PdfPlannerView, startY: number) {
  const columns = [
    { label: 'ID', width: 32 },
    { label: 'Location', width: 188 },
    { label: 'Notes', width: 320 },
  ]
  const rows = planner.markers.map((marker) => [
    getPdfMarkerId(planner.markers, marker),
    markerLocation(marker),
    marker.notes?.trim() || '-',
  ])
  return drawPdfTable(doc, columns, rows, startY)
}

function drawPdfPageHeader(
  doc: jsPDF,
  planner: PlannerState,
  logoImage: { dataUrl: string; width: number; height: number } | null,
) {
  if (logoImage) {
    const logoSize = fitPdfImage(
      logoImage.width,
      logoImage.height,
      PDF_LOGO_MAX_WIDTH,
      PDF_LOGO_MAX_HEIGHT,
    )
    doc.addImage(logoImage.dataUrl, 'PNG', PDF_MARGIN, 24, logoSize.width, logoSize.height)
  }

  doc.setTextColor(17, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Booth Utility Planner', PDF_MARGIN, 78)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(
    `Show: ${planner.booth.showName || '-'} | Location: ${planner.booth.showLocation || '-'} | Date: ${
      planner.booth.showDate || '-'
    }`,
    PDF_MARGIN,
    96,
  )
  doc.text(
    `Booth #: ${planner.booth.boothNumber || '-'} | Booth Size: ${planner.booth.width}ft x ${planner.booth.depth}ft | Booth Type: ${planner.booth.boothType || '-'}`,
    PDF_MARGIN,
    109,
  )
}

function getPdfGridLayout(doc: jsPDF, booth: BoothDetails): PdfGridLayout {
  const pageWidth = doc.internal.pageSize.getWidth()
  const gridMaxWidth = pageWidth - PDF_MARGIN * 2 - 52
  const gridMaxHeight = 276
  const gridScale = Math.min(
    gridMaxWidth / booth.width,
    gridMaxHeight / booth.depth,
  )

  return {
    width: booth.width * gridScale,
    height: booth.depth * gridScale,
    x: PDF_MARGIN + 26 + (gridMaxWidth - booth.width * gridScale) / 2,
    y: 156,
  }
}

function drawPdfSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setTextColor(17, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(title, PDF_MARGIN, y)
}

function drawElectricalDetails(doc: jsPDF, planner: PdfPlannerView, startY: number) {
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = startY

  if (planner.markers.length > 0) {
    drawPdfSectionTitle(doc, 'Drop Details', y)
    y = drawDropTable(doc, planner, y + 8)
  }
  if (planner.lines.length > 0) {
    y += planner.markers.length > 0 ? 12 : 0
    if (y > pageHeight - 72) {
      doc.addPage()
      y = PDF_MARGIN
    }
    drawPdfSectionTitle(doc, 'Extension Cord Details', y)
    y = drawLineTable(doc, planner, y + 8)
  }

  return y
}

function drawMarkerDetails(
  title: string,
  drawTable: (doc: jsPDF, planner: PdfPlannerView, startY: number) => number,
) {
  return (doc: jsPDF, planner: PdfPlannerView, startY: number) => {
    drawPdfSectionTitle(doc, title, startY)
    return drawTable(doc, planner, startY + 8)
  }
}

function getPdfCategories(planner: PlannerState): PdfCategory[] {
  const electricalMarkers = planner.markers.filter((marker) => isElectrical(marker.type))
  const wifiMarkers = planner.markers.filter((marker) => marker.type === 'wifi')
  const hangingSignMarkers = planner.markers.filter((marker) => marker.type === 'hanging_sign')
  const customMarkers = planner.markers.filter((marker) => marker.type === 'custom_drop')
  const categories: PdfCategory[] = [
    {
      title: 'Electrical + Extension Cords',
      markers: electricalMarkers,
      lines: planner.lines,
      includeLineLegend: planner.lines.length > 0,
      drawDetails: drawElectricalDetails,
    },
    {
      title: 'WiFi',
      markers: wifiMarkers,
      lines: [],
      drawDetails: drawMarkerDetails('WiFi Details', drawWifiTable),
    },
    {
      title: 'Hanging Sign',
      markers: hangingSignMarkers,
      lines: [],
      drawDetails: drawMarkerDetails('Hanging Sign Details', drawHangingSignTable),
    },
    {
      title: 'Custom Marker',
      markers: customMarkers,
      lines: [],
      drawDetails: drawMarkerDetails('Custom Marker Details', drawCustomMarkerTable),
    },
  ]

  return categories.filter((category) => category.markers.length > 0 || category.lines.length > 0)
}

async function drawPdfCategoryPage(
  doc: jsPDF,
  planner: PlannerState,
  category: PdfCategory,
  logoImage: { dataUrl: string; width: number; height: number } | null,
) {
  drawPdfPageHeader(doc, planner, logoImage)
  doc.setTextColor(33, 70, 112)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(category.title, PDF_MARGIN, 126)
  const grid = getPdfGridLayout(doc, planner.booth)
  const pagePlanner: PdfPlannerView = {
    ...planner,
    markers: category.markers,
    lines: category.lines,
    allMarkers: planner.markers,
    allLines: planner.lines,
  }

  await drawPdfGrid(doc, pagePlanner, grid)
  let y = grid.y + grid.height + 36
  y = drawLegend(doc, category.markers, PDF_MARGIN, y, {
    includeLines: category.includeLineLegend,
  })
  y += 8
  category.drawDetails(doc, pagePlanner, y)
}

async function exportPlannerPdf(planner: PlannerState) {
  const categories = getPdfCategories(planner)
  if (categories.length === 0) {
    return
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const logoImage = await svgAssetToPngDataUrl(sourceOneLogoPath)

  for (const [index, category] of categories.entries()) {
    if (index > 0) {
      doc.addPage()
    }
    await drawPdfCategoryPage(doc, planner, category, logoImage)
  }
  drawPdfFooter(doc)

  const filename = planner.booth.boothNumber
    ? `booth-utility-plan-${planner.booth.boothNumber}.pdf`
    : 'booth-utility-plan.pdf'
  doc.save(filename)
}

function readInitialState(): PlannerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return defaultState
    }

    const parsed = JSON.parse(raw) as Partial<PlannerState>
    const markers = Array.isArray(parsed.markers)
      ? parsed.markers
          .map((marker) => {
            const legacyType = marker.type as string
            const migratedType: MarkerType = legacyType === 'main_drop'
              ? '120v'
              : legacyType === 'custom_marker'
                ? 'custom_drop'
                : (legacyType as MarkerType)
            if (!markerOptions.some((option) => option.type === migratedType)) {
              return null
            }
            return {
              ...marker,
              type: migratedType,
              amps: getValidAmp(migratedType, marker.amps),
              speed: migratedType === 'wifi' ? marker.speed || 'Standard' : undefined,
              is24Hour: isElectrical(migratedType) ? Boolean(marker.is24Hour) : false,
              hangingSignHeight: migratedType === 'hanging_sign' ? String(marker.hangingSignHeight || '') : undefined,
              isRotating: migratedType === 'hanging_sign' ? Boolean(marker.isRotating) : false,
              notes: marker.notes || '',
            } as UtilityMarker
          })
          .filter((marker): marker is UtilityMarker => Boolean(marker))
      : []
    const markerIds = new Set(markers.map((marker) => marker.id))
    const parsedLines: Array<Record<string, unknown>> = Array.isArray(parsed.lines) ? parsed.lines : []
    const parsedLineIds = new Set(parsedLines.map((l) => l.id as string).filter(Boolean))
    const lines: UtilityLine[] = parsedLines
      .filter((line) => {
        if (line.fromMarkerId) return markerIds.has(line.fromMarkerId as string)
        if (line.fromLineId) return parsedLineIds.has(line.fromLineId as string)
        return false
      })
      .map((line, index) => ({
        id: (line.id as string) || crypto.randomUUID(),
        ...(line.fromMarkerId
          ? { fromMarkerId: line.fromMarkerId as string }
          : { fromLineId: line.fromLineId as string }),
        toX: clamp(Number(line.toX) || 0, 0, parsed.booth?.width || 20),
        toY: clamp(Number(line.toY) || 0, 0, parsed.booth?.depth || 20),
        label: (line.label as string) || `L${index + 1}`,
        notes: (line.notes as string) || '',
      }))
    const parsedTool = parsed.selectedTool
    const selectedTool: MarkerType = parsedTool && markerOptions.some((option) => option.type === parsedTool)
      ? parsedTool
      : DEFAULT_TOOL
    return {
      booth: {
        ...defaultBooth,
        ...parsed.booth,
        sideLabels: {
          ...defaultBooth.sideLabels,
          ...parsed.booth?.sideLabels,
        },
        width: clamp(Number(parsed.booth?.width) || 20, 1, 100),
        depth: clamp(Number(parsed.booth?.depth) || 20, 1, 100),
        boothType: BOOTH_TYPES.includes(parsed.booth?.boothType as BoothType)
          ? (parsed.booth?.boothType as BoothType)
          : 'Inline',
      },
      markers,
      lines,
      selectedTool,
      renderImage: sanitizeRenderImage(parsed.renderImage),
      hasCompletedSetup: Boolean(parsed.hasCompletedSetup),
    }
  } catch {
    return defaultState
  }
}

function SetupModal({
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

function RenderCropModal({
  cropRequest,
  onApply,
  onCancel,
}: {
  cropRequest: RenderCropRequest
  onApply: (dataUrl: string) => void
  onCancel: () => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState('')

  async function applyCrop() {
    if (!croppedAreaPixels) {
      return
    }

    setIsApplying(true)
    setError('')

    try {
      const dataUrl = await createCroppedImageDataUrl(
        cropRequest.imageSrc,
        croppedAreaPixels,
        {
          width: cropRequest.outputWidth,
          height: cropRequest.outputHeight,
        },
        rotation,
      )

      onApply(dataUrl)
    } catch {
      setError('Unable to crop that image. Please try a different file.')
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="modal-backdrop crop-modal-backdrop" role="presentation">
      <section
        className="crop-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-modal-title"
      >
        <div className="modal-heading crop-modal-heading">
          <p className="eyebrow">Booth Image Upload</p>
          <h1 id="crop-modal-title">Crop background image</h1>
          <p>
            Reposition and zoom your image to fit the current {cropRequest.boothWidth} ft x{' '}
            {cropRequest.boothDepth} ft booth grid.
          </p>
        </div>

        <div className="crop-stage">
          <Cropper
            image={cropRequest.imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={cropRequest.aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, nextCroppedAreaPixels) =>
              setCroppedAreaPixels(nextCroppedAreaPixels)
            }
          />
        </div>

        <label className="zoom-control">
          <span>Zoom</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>

        {error && <p className="upload-error">{error}</p>}

        <div className="modal-actions crop-modal-actions">
          <div className="crop-action-group" aria-label="Image rotation controls">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setRotation((current) => (current + 270) % 360)}
            >
              <RotateCcw size={15} />
              Rotate Left
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setRotation((current) => (current + 90) % 360)}
            >
              <RotateCw size={15} />
              Rotate Right
            </button>
          </div>
          <div className="crop-action-group">
            <button
              type="button"
              className="primary-button"
              onClick={applyCrop}
              disabled={isApplying || !croppedAreaPixels}
            >
              {isApplying ? 'Applying...' : 'Apply Crop'}
            </button>
            <button type="button" className="secondary-button" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className="field-group">
      <span className="field-label">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function App() {
  const [planner, setPlanner] = useState<PlannerState>(() => readInitialState())
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [exportStatus, setExportStatus] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [cropRequest, setCropRequest] = useState<RenderCropRequest | null>(null)
  const [stageSize, setStageSize] = useState({ width: 900, height: 680 })
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanMode, setIsPanMode] = useState(false)
  const [isPointerMode, setIsPointerMode] = useState(false)
  const [isLineMode, setIsLineMode] = useState(false)
  const [lineStartMarkerId, setLineStartMarkerId] = useState<string | null>(null)
  const [lineStartLineId, setLineStartLineId] = useState<string | null>(null)
  const [draggingLineEndId, setDraggingLineEndId] = useState<string | null>(null)
  const [openPanelSectionId, setOpenPanelSectionId] = useState<string | null>('help')
  const [ampPromptMarkerId, setAmpPromptMarkerId] = useState<string | null>(null)
  const [panStart, setPanStart] = useState<{
    clientX: number
    clientY: number
    originX: number
    originY: number
  } | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const selectedMarker = planner.markers.find((marker) => marker.id === selectedMarkerId)
  const selectedLine = planner.lines.find((line) => line.id === selectedLineId)

  const gridMetrics = useMemo(() => {
    const isLargeGrid =
      planner.booth.width > LARGE_GRID_THRESHOLD_FT ||
      planner.booth.depth > LARGE_GRID_THRESHOLD_FT
    const availableWidth = Math.max(260, stageSize.width - 300)
    const availableHeight = Math.max(260, stageSize.height - 270)
    const fitScale = Math.min(
      availableWidth / planner.booth.width,
      availableHeight / planner.booth.depth,
    )
    const scale = isLargeGrid
      ? LARGE_GRID_CELL_PX
      : clamp(fitScale, GRID_MIN_CELL_PX, GRID_MAX_CELL_PX)

    return {
      scale,
      widthPx: planner.booth.width * scale,
      heightPx: planner.booth.depth * scale,
    }
  }, [planner.booth.depth, planner.booth.width, stageSize.height, stageSize.width])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(planner))
  }, [planner])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) {
      return
    }

    const updateStageSize = () => {
      const rect = stage.getBoundingClientRect()
      setStageSize({
        width: rect.width,
        height: rect.height,
      })
    }

    updateStageSize()
    const observer = new ResizeObserver(updateStageSize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const getGridCoords = useCallback((clientX: number, clientY: number) => {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) {
      return null
    }

    const x = snapFeet(((clientX - rect.left) / rect.width) * planner.booth.width)
    const y = snapFeet(((rect.bottom - clientY) / rect.height) * planner.booth.depth)
    return {
      x: clamp(x, 0, planner.booth.width),
      y: clamp(y, 0, planner.booth.depth),
    }
  }, [planner.booth.depth, planner.booth.width])

  useEffect(() => {
    function moveView(event: PointerEvent) {
      if (!panStart) {
        return
      }
      setPanOffset({
        x: panStart.originX + event.clientX - panStart.clientX,
        y: panStart.originY + event.clientY - panStart.clientY,
      })
    }

    function stopPanning() {
      setPanStart(null)
    }

    window.addEventListener('pointermove', moveView)
    window.addEventListener('pointerup', stopPanning)
    return () => {
      window.removeEventListener('pointermove', moveView)
      window.removeEventListener('pointerup', stopPanning)
    }
  }, [panStart])

  useEffect(() => {
    function moveSelected(event: PointerEvent) {
      if (!draggingId && !draggingLineEndId) {
        return
      }
      const coords = getGridCoords(event.clientX, event.clientY)
      if (!coords) {
        return
      }
      if (draggingId) {
        updateMarker(draggingId, coords)
      }
      if (draggingLineEndId) {
        updateLine(draggingLineEndId, { toX: coords.x, toY: coords.y })
      }
    }

    function stopDragging() {
      setDraggingId(null)
      setDraggingLineEndId(null)
    }

    window.addEventListener('pointermove', moveSelected)
    window.addEventListener('pointerup', stopDragging)
    return () => {
      window.removeEventListener('pointermove', moveSelected)
      window.removeEventListener('pointerup', stopDragging)
    }
  }, [draggingId, draggingLineEndId, getGridCoords])

  function setBooth(booth: BoothDetails) {
    const nextBooth = {
      ...booth,
      width: clamp(Number(booth.width) || 20, 1, 100),
      depth: clamp(Number(booth.depth) || 20, 1, 100),
    }
    setPlanner((current) => ({
      ...current,
      booth: nextBooth,
      markers: current.markers.map((marker) => ({
        ...marker,
        x: clamp(marker.x, 0, nextBooth.width),
        y: clamp(marker.y, 0, nextBooth.depth),
      })),
      lines: current.lines.map((line) => ({
        ...line,
        toX: clamp(line.toX, 0, nextBooth.width),
        toY: clamp(line.toY, 0, nextBooth.depth),
      })),
    }))
  }

  function updateMarker(id: string, patch: Partial<UtilityMarker>) {
    setPlanner((current) => ({
      ...current,
      markers: current.markers.map((marker) =>
        marker.id === id ? { ...marker, ...patch } : marker,
      ),
    }))
  }

  function updateLine(id: string, patch: Partial<UtilityLine>) {
    setPlanner((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }))
  }

  const deleteMarker = useCallback((id: string) => {
    setPlanner((current) => {
      const directlyRemovedIds = new Set(
        current.lines.filter((l) => l.fromMarkerId === id).map((l) => l.id),
      )
      const filteredLines = current.lines.filter(
        (l) => l.fromMarkerId !== id && (!l.fromLineId || !directlyRemovedIds.has(l.fromLineId)),
      )
      return {
        ...current,
        markers: current.markers.filter((marker) => marker.id !== id),
        lines: filteredLines,
      }
    })
    setSelectedMarkerId(null)
    setSelectedLineId((current) =>
      planner.lines.some((line) => line.id === current && line.fromMarkerId === id) ? null : current,
    )
    setAmpPromptMarkerId(null)
  }, [planner.lines])

  const deleteLine = useCallback((id: string) => {
    setPlanner((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.id !== id && line.fromLineId !== id),
    }))
    setSelectedLineId(null)
  }, [])

  function placeMarker(clientX: number, clientY: number) {
    if (isPanMode || isPointerMode || isLineMode) {
      return
    }
    const coords = getGridCoords(clientX, clientY)
    if (!coords) {
      return
    }

    const nextMarker: UtilityMarker = {
      id: crypto.randomUUID(),
      label: getMarkerLabel(planner.selectedTool, planner.markers),
      type: planner.selectedTool,
      x: coords.x,
      y: coords.y,
      amps: getDefaultAmp(planner.selectedTool),
      speed: planner.selectedTool === 'wifi' ? 'Standard' : undefined,
      is24Hour: false,
      hangingSignHeight: planner.selectedTool === 'hanging_sign' ? '' : undefined,
      isRotating: false,
      notes: '',
    }

    setPlanner((current) => ({ ...current, markers: [...current.markers, nextMarker] }))
    setSelectedMarkerId(nextMarker.id)
    setSelectedLineId(null)
    setOpenPanelSectionId('selected-item')
    setAmpPromptMarkerId(isElectrical(nextMarker.type) ? nextMarker.id : null)
  }

  function completeLine(clientX: number, clientY: number) {
    if (!lineStartMarkerId && !lineStartLineId) {
      return
    }
    const coords = getGridCoords(clientX, clientY)
    if (!coords) {
      return
    }
    const nextLine: UtilityLine = {
      id: crypto.randomUUID(),
      ...(lineStartMarkerId ? { fromMarkerId: lineStartMarkerId } : { fromLineId: lineStartLineId! }),
      toX: coords.x,
      toY: coords.y,
      label: `L${planner.lines.length + 1}`,
      notes: '',
    }
    setPlanner((current) => ({ ...current, lines: [...current.lines, nextLine] }))
    setSelectedMarkerId(null)
    setSelectedLineId(nextLine.id)
    setLineStartMarkerId(null)
    setLineStartLineId(null)
    setIsLineMode(false)
    setIsPointerMode(true)
    setOpenPanelSectionId('selected-item')
  }

  function markerPosition(marker: UtilityMarker, index: number) {
    const grouped = planner.markers.filter((candidate) => candidate.x === marker.x && candidate.y === marker.y)
    const groupIndex = grouped.findIndex((candidate) => candidate.id === marker.id)
    const angle = (Math.PI * 2 * groupIndex) / Math.max(grouped.length, 1)
    const offset = grouped.length > 1 ? 12 : 0

    return {
      left: `${(marker.x / planner.booth.width) * 100}%`,
      top: `${((planner.booth.depth - marker.y) / planner.booth.depth) * 100}%`,
      transform: `translate(-50%, -50%) translate(${Math.cos(angle) * offset}px, ${
        Math.sin(angle) * offset
      }px)`,
      backgroundColor: markerColors[marker.type],
      zIndex: selectedMarkerId === marker.id ? 40 : 20 + index,
    }
  }

  async function handleRenderUpload(file: File | undefined) {
    if (!file) {
      return
    }

    if (!isSupportedRenderFile(file)) {
      setUploadError('Please upload a JPG or PNG file.')
      return
    }

    if (file.size > MAX_RENDER_UPLOAD_BYTES) {
      setUploadError('File is too large. JPG and PNG uploads must be 5 MB or smaller.')
      return
    }

    let imageDetails: Awaited<ReturnType<typeof readImageFile>>

    try {
      imageDetails = await readImageFile(file)
    } catch {
      setUploadError('Unable to read that JPG or PNG. Please choose a different file.')
      return
    }

    const outputSize = getRenderOutputSize(planner.booth)
    const requiredRatio = planner.booth.width / planner.booth.depth
    const imageRatio = imageDetails.width / imageDetails.height
    const ratioMatches =
      Math.abs(imageRatio - requiredRatio) / requiredRatio <= ASPECT_RATIO_TOLERANCE

    if (ratioMatches) {
      try {
        const dataUrl = await createCroppedImageDataUrl(
          imageDetails.imageSrc,
          {
            x: 0,
            y: 0,
            width: imageDetails.width,
            height: imageDetails.height,
          },
          outputSize,
        )
        setPlanner((current) => ({
          ...current,
          renderImage: {
            dataUrl,
            fileName: file.name,
            opacity: current.renderImage?.opacity ?? DEFAULT_RENDER_OPACITY,
            width: outputSize.width,
            height: outputSize.height,
            wasCropped: false,
          },
        }))
        setUploadError('')
        setCropRequest(null)
      } catch {
        setUploadError('Unable to prepare that image. Please choose a different file.')
      }
      return
    }

    setCropRequest({
      fileName: file.name,
      imageSrc: imageDetails.imageSrc,
      width: imageDetails.width,
      height: imageDetails.height,
      outputWidth: outputSize.width,
      outputHeight: outputSize.height,
      aspect: requiredRatio,
      boothWidth: planner.booth.width,
      boothDepth: planner.booth.depth,
    })
    setUploadError('')
  }

  function applyCroppedRender(dataUrl: string) {
    if (!cropRequest) {
      return
    }

    setPlanner((current) => ({
      ...current,
      renderImage: {
        dataUrl,
        fileName: cropRequest.fileName,
        opacity: current.renderImage?.opacity ?? DEFAULT_RENDER_OPACITY,
        width: cropRequest.outputWidth,
        height: cropRequest.outputHeight,
        wasCropped: true,
      },
    }))
    setUploadError('')
    setCropRequest(null)
  }

  function removeRenderImage() {
    setPlanner((current) => ({ ...current, renderImage: undefined }))
    setUploadError('')
    setCropRequest(null)
  }

  function resetPlanner() {
    setPlanner(defaultState)
    setSelectedMarkerId(null)
    setSelectedLineId(null)
    setDraggingId(null)
    setDraggingLineEndId(null)
    setLineStartMarkerId(null)
    setLineStartLineId(null)
    setIsPanMode(false)
    setIsPointerMode(false)
    setIsLineMode(false)
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
    setExportStatus('')
    setUploadError('')
    setCropRequest(null)
  }

  function startPan(event: ReactPointerEvent) {
    if (!isPanMode) {
      return
    }
    event.preventDefault()
    setPanStart({
      clientX: event.clientX,
      clientY: event.clientY,
      originX: panOffset.x,
      originY: panOffset.y,
    })
  }

  function setZoomLevel(nextZoom: number) {
    setZoom(clamp(nextZoom, MIN_ZOOM, MAX_ZOOM))
  }

  function fitScreen() {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }

  function selectTool(selectedTool: MarkerType) {
    setIsPanMode(false)
    setIsPointerMode(false)
    setIsLineMode(false)
    setLineStartMarkerId(null)
    setLineStartLineId(null)
    setDraggingLineEndId(null)
    setPlanner((current) => ({ ...current, selectedTool }))
  }

  function selectLineTool() {
    setDraggingId(null)
    setDraggingLineEndId(null)
    setIsPanMode(false)
    setIsPointerMode(false)
    setIsLineMode(true)
    setLineStartMarkerId(null)
    setLineStartLineId(null)
  }

  function selectPanMode() {
    setDraggingId(null)
    setLineStartMarkerId(null)
    setIsLineMode(false)
    setIsPointerMode(false)
    setIsPanMode(true)
  }

  function togglePanMode() {
    setDraggingId(null)
    setLineStartMarkerId(null)
    setIsLineMode(false)
    setIsPointerMode(false)
    setIsPanMode((current) => !current)
  }

  function selectPointerMode() {
    setDraggingId(null)
    setIsPanMode(false)
    setIsLineMode(false)
    setLineStartMarkerId(null)
    setIsPointerMode(true)
  }

  useEffect(() => {
    function handleToolbarShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditableShortcutTarget(event.target)) {
        return
      }

      const key = event.key.toLowerCase()
      if (key === '1') {
        event.preventDefault()
        selectPointerMode()
        return
      }
      if (key === '2') {
        event.preventDefault()
        selectPanMode()
        return
      }
      if (key === '3') {
        event.preventDefault()
        setZoomLevel(zoom + ZOOM_STEP)
        return
      }
      if (key === '4') {
        event.preventDefault()
        setZoomLevel(zoom - ZOOM_STEP)
        return
      }
      if (key === '5') {
        event.preventDefault()
        fitScreen()
        return
      }
    }

    window.addEventListener('keydown', handleToolbarShortcut)
    return () => window.removeEventListener('keydown', handleToolbarShortcut)
  }, [zoom])

  useEffect(() => {
    function handleSelectedItemDelete(event: KeyboardEvent) {
      if (event.defaultPrevented || event.key !== 'Delete' || isEditableShortcutTarget(event.target)) {
        return
      }

      if (selectedMarkerId) {
        event.preventDefault()
        deleteMarker(selectedMarkerId)
        return
      }

      if (selectedLineId) {
        event.preventDefault()
        deleteLine(selectedLineId)
      }
    }

    window.addEventListener('keydown', handleSelectedItemDelete)
    return () => window.removeEventListener('keydown', handleSelectedItemDelete)
  }, [deleteLine, deleteMarker, selectedLineId, selectedMarkerId])

  async function handleExportPdf() {
    if (planner.markers.length === 0 && planner.lines.length === 0) {
      window.alert('Add at least one utility marker or extension cord before exporting.')
      return
    }

    setExportStatus('Generating PDF...')
    try {
      await exportPlannerPdf(planner)
      setExportStatus('PDF downloaded.')
    } catch (error) {
      console.error(error)
      setExportStatus('PDF export failed. Please try again.')
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <div
          className={`canvas-stage ${isPanMode ? 'is-pan-mode' : ''} ${
            panStart ? 'is-panning' : ''
          }`}
          ref={stageRef}
          onPointerDown={startPan}
        >
          <div
            ref={gridRef}
            className="booth-grid"
            style={{
              width: gridMetrics.widthPx,
              height: gridMetrics.heightPx,
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            }}
            onPointerDown={(event) => {
              if (isPanMode) {
                event.stopPropagation()
                startPan(event)
                return
              }
              if (event.target === event.currentTarget) {
                if (isLineMode) {
                  completeLine(event.clientX, event.clientY)
                } else {
                  placeMarker(event.clientX, event.clientY)
                }
              }
            }}
          >
            <div className="booth-number-label">
              Booth # {planner.booth.boothNumber || '-'}
            </div>
            {planner.renderImage && (
              <img
                className="render-reference"
                src={planner.renderImage.dataUrl}
                alt=""
                style={{ opacity: planner.renderImage.opacity }}
              />
            )}
            <GridLineLayer booth={planner.booth} />
            <div className="grid-measure grid-measure-width">{planner.booth.width} ft</div>
            <div className="grid-measure grid-measure-depth">{planner.booth.depth} ft</div>
            <UtilityLineLayer
              booth={planner.booth}
              markers={planner.markers}
              lines={planner.lines}
              selectedLineId={selectedLineId}
              onSelectLine={(lineId) => {
                setSelectedLineId(lineId)
                setSelectedMarkerId(null)
                setLineStartMarkerId(null)
                setAmpPromptMarkerId(null)
                setOpenPanelSectionId('selected-item')
              }}
            />
            <SideLabel
              side="back"
              value={planner.booth.sideLabels.back}
              className="side-label-back"
              onChange={(value) => setBooth({ ...planner.booth, sideLabels: { ...planner.booth.sideLabels, back: value } })}
            />
            <SideLabel
              side="front"
              value={planner.booth.sideLabels.front}
              className="side-label-front"
              onChange={(value) => setBooth({ ...planner.booth, sideLabels: { ...planner.booth.sideLabels, front: value } })}
            />
            <SideLabel
              side="left"
              value={planner.booth.sideLabels.left}
              className="side-label-left"
              onChange={(value) => setBooth({ ...planner.booth, sideLabels: { ...planner.booth.sideLabels, left: value } })}
            />
            <SideLabel
              side="right"
              value={planner.booth.sideLabels.right}
              className="side-label-right"
              onChange={(value) => setBooth({ ...planner.booth, sideLabels: { ...planner.booth.sideLabels, right: value } })}
            />
            {planner.markers.map((marker) => (
              <MeasurementGuides
                key={`guides-${marker.id}`}
                marker={marker}
                booth={planner.booth}
                isSelected={marker.id === selectedMarkerId}
              />
            ))}
            {planner.markers.map((marker, index) => (
                <button
                  key={marker.id}
                  type="button"
                  className={`utility-marker marker-${marker.type} ${
                    selectedMarkerId === marker.id ? 'is-selected' : ''
                  }`}
                  style={markerPosition(marker, index)}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    if (isPanMode) {
                      startPan(event)
                      return
                    }
                    if (isLineMode) {
                      setLineStartMarkerId(marker.id)
                      setSelectedMarkerId(marker.id)
                      setSelectedLineId(null)
                      setAmpPromptMarkerId(null)
                      setOpenPanelSectionId('selected-item')
                      return
                    }
                    setSelectedMarkerId(marker.id)
                    setSelectedLineId(null)
                    setOpenPanelSectionId('selected-item')
                    setAmpPromptMarkerId(null)
                    setDraggingId(marker.id)
                  }}
                >
                  <MarkerTypeIcon
                    type={marker.type}
                    size={15}
                    number={getMarkerShapeNumber(marker, planner.markers)}
                  />
                  <span className="marker-copy">
                    <span className="marker-label">{getGridMarkerDisplayLabel(marker.type)}</span>
                    {isElectrical(marker.type) && marker.amps && (
                      <span className="marker-amps">{marker.amps.replace(/A$/, 'AMP')}</span>
                    )}
                    {isElectrical(marker.type) && marker.is24Hour && (
                      <span className="marker-24hr">24HR</span>
                    )}
                    {marker.type === 'wifi' && marker.speed && (
                      <span className="marker-amps">{marker.speed}</span>
                    )}
                    {marker.type === 'hanging_sign' && marker.hangingSignHeight && (
                      <span className="marker-amps">{marker.hangingSignHeight}</span>
                    )}
                  </span>
                </button>
            ))}
            {isLineMode && (
              <div className="line-start-hint" aria-live="polite">
                {lineStartMarkerId || lineStartLineId
                  ? 'Click a grid point to finish the extension cord.'
                  : 'Click a drop or extension cord endpoint to start the extension cord.'}
              </div>
            )}
            {planner.lines.map((line, index) => {
              const startCoords = getLineStartCoords(line, planner.markers, planner.lines)
              const len = startCoords
                ? Math.sqrt((line.toX - startCoords.x) ** 2 + (line.toY - startCoords.y) ** 2)
                : null
              const endLeftPct = (line.toX / planner.booth.width) * 100
              const endTopPct = ((planner.booth.depth - line.toY) / planner.booth.depth) * 100
              const midLeftPct = startCoords
                ? ((startCoords.x / planner.booth.width + line.toX / planner.booth.width) / 2) * 100
                : endLeftPct
              const midTopPct = startCoords
                ? (((planner.booth.depth - startCoords.y) / planner.booth.depth + (planner.booth.depth - line.toY) / planner.booth.depth) / 2) * 100
                : endTopPct
              const isThisLineStart = lineStartLineId === line.id
              return (
                <React.Fragment key={`ep-${line.id}`}>
                  {len !== null && len > 0 && (
                    <div
                      className="line-length-label"
                      style={{ left: `${midLeftPct}%`, top: `${midTopPct}%` }}
                      aria-hidden="true"
                    >
                      {formatFeet(len)}ft
                    </div>
                  )}
                  <button
                    type="button"
                    className={`line-endpoint-chip ${selectedLineId === line.id ? 'is-selected' : ''} ${isThisLineStart ? 'is-line-start' : ''}`}
                    style={{ left: `${endLeftPct}%`, top: `${endTopPct}%` }}
                    title={getLineLabel(line, index)}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      if (isPanMode) return
                      if (isLineMode) {
                        if (!lineStartMarkerId && !lineStartLineId) {
                          setLineStartLineId(line.id)
                          setLineStartMarkerId(null)
                          setSelectedLineId(line.id)
                          setSelectedMarkerId(null)
                          setOpenPanelSectionId('selected-item')
                        }
                        return
                      }
                      setSelectedLineId(line.id)
                      setSelectedMarkerId(null)
                      setAmpPromptMarkerId(null)
                      setOpenPanelSectionId('selected-item')
                      setDraggingLineEndId(line.id)
                    }}
                  >
                    {getLineLabel(line, index)}
                  </button>
                </React.Fragment>
              )
            })}
            {ampPromptMarkerId &&
              planner.markers
                .filter((marker) => marker.id === ampPromptMarkerId && isElectrical(marker.type))
                .map((marker) => (
                  <AmpPrompt
                    key={`amp-prompt-${marker.id}`}
                    marker={marker}
                    booth={planner.booth}
                    onSelect={(amps) => {
                      updateMarker(marker.id, { amps })
                      setAmpPromptMarkerId(null)
                    }}
                    onClose={() => setAmpPromptMarkerId(null)}
                  />
                ))}
            <p className="grid-helper-text">Grid: 1 ft squares. Placement snaps to 0.5 ft.</p>
          </div>
        </div>

        <BottomToolbar
          selectedTool={planner.selectedTool}
          zoom={zoom}
          isPanMode={isPanMode}
          isPointerMode={isPointerMode}
          isLineMode={isLineMode}
          onSelectTool={selectTool}
          onSelectLineTool={selectLineTool}
          onZoomIn={() => setZoomLevel(zoom + ZOOM_STEP)}
          onZoomOut={() => setZoomLevel(zoom - ZOOM_STEP)}
          onZoomReset={fitScreen}
          onTogglePan={togglePanMode}
          onSelectPointer={selectPointerMode}
        />
      </section>

      <RightPanel
        planner={planner}
        selectedMarker={selectedMarker}
        selectedLine={selectedLine}
        exportStatus={exportStatus}
        uploadError={uploadError}
        openSectionId={openPanelSectionId}
        onToggleSection={(sectionId) =>
          setOpenPanelSectionId((current) => (current === sectionId ? null : sectionId))
        }
        onBoothChange={setBooth}
        onToolChange={(selectedTool) => setPlanner((current) => ({ ...current, selectedTool }))}
        onMarkerChange={(id, patch) => updateMarker(id, patch)}
        onMarkerDelete={deleteMarker}
        onLineChange={(id, patch) => updateLine(id, patch)}
        onLineDelete={deleteLine}
        onRenderUpload={handleRenderUpload}
        onRenderRemove={removeRenderImage}
        onRenderOpacityChange={(opacity) =>
          setPlanner((current) => ({
            ...current,
            renderImage: current.renderImage ? { ...current.renderImage, opacity } : undefined,
          }))
        }
        onExport={handleExportPdf}
        onReset={resetPlanner}
      />

      {!planner.hasCompletedSetup && (
        <SetupModal
          booth={planner.booth}
          onChange={setBooth}
          onComplete={() => setPlanner((current) => ({ ...current, hasCompletedSetup: true }))}
        />
      )}

      {cropRequest && (
        <RenderCropModal
          cropRequest={cropRequest}
          onApply={applyCroppedRender}
          onCancel={() => setCropRequest(null)}
        />
      )}
    </main>
  )
}

function SideLabel({
  side,
  value,
  className,
  onChange,
}: {
  side: string
  value: string
  className: string
  onChange: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const label = side.charAt(0).toUpperCase() + side.slice(1)

  function startEdit() {
    setDraft(value)
    setEditing(true)
  }

  function commit() {
    onChange(draft)
    setEditing(false)
  }

  function cancel() {
    setEditing(false)
  }

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  return (
    <div className={`side-label ${className}`} onDoubleClick={startEdit} title="Double-click to edit">
      <strong>{label}</strong>
      {editing ? (
        <input
          ref={inputRef}
          className="side-label-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') cancel()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span>{value || `${label} side label`}</span>
      )}
    </div>
  )
}

function MeasurementGuides({
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

function GridLineLayer({ booth }: { booth: BoothDetails }) {
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

function UtilityLineLayer({
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

function AmpPrompt({
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

function BottomToolbar({
  selectedTool,
  zoom,
  isPanMode,
  isPointerMode,
  isLineMode,
  onSelectTool,
  onSelectLineTool,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onTogglePan,
  onSelectPointer,
}: {
  selectedTool: MarkerType
  zoom: number
  isPanMode: boolean
  isPointerMode: boolean
  isLineMode: boolean
  onSelectTool: (tool: MarkerType) => void
  onSelectLineTool: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onTogglePan: () => void
  onSelectPointer: () => void
}) {
  const markerToolsBeforeLine = markerOptions.filter((option) =>
    option.type !== 'wifi' && option.type !== 'hanging_sign' && option.type !== 'custom_drop'
  )
  const markerToolsAfterLine = markerOptions.filter((option) =>
    option.type === 'wifi' || option.type === 'hanging_sign' || option.type === 'custom_drop'
  )
  const renderMarkerTool = (option: (typeof markerOptions)[number]) => {
    const activeStyle = {
      '--active-color': markerColors[option.type],
    } as CSSProperties
    return (
      <button
        key={option.type}
        type="button"
        className={`toolbar-button toolbar-tool-button tool-${option.type} ${
          !isPanMode && !isPointerMode && !isLineMode && selectedTool === option.type ? 'is-active' : ''
        }`}
        style={activeStyle}
        title={option.label}
        aria-label={option.label}
        onClick={() => onSelectTool(option.type)}
      >
        <MarkerTypeIcon type={option.type} size={17} />
        <span className="toolbar-label-stack">
          {getToolbarLabelLines(option.type).map((labelLine) => (
            <span key={labelLine}>{labelLine}</span>
          ))}
        </span>
      </button>
    )
  }

  return (
    <nav className="bottom-toolbar" aria-label="Utility placement tools">
      <div className="toolbar-group">
        <span className="toolbar-group-label">Canvas Tools</span>
        <div className="toolbar-group-controls">
          <button
            type="button"
            className={`toolbar-button toolbar-button-compact ${isPointerMode ? 'is-active' : ''}`}
            title="Pointer / Select (1)"
            aria-label="Pointer / Select, shortcut 1"
            onClick={onSelectPointer}
          >
            <span className="shortcut-badge">1</span>
            <MousePointer2 size={17} />
          </button>
          <button
            type="button"
            className={`toolbar-button toolbar-button-compact ${isPanMode ? 'is-active' : ''}`}
            title="Pan canvas (2)"
            aria-label="Pan canvas, shortcut 2"
            onClick={onTogglePan}
          >
            <span className="shortcut-badge">2</span>
            <Hand size={17} />
          </button>
          <div className="zoom-control-group" aria-label="Zoom controls">
            <button
              type="button"
              className="zoom-icon-button"
              title="Zoom in (3)"
              aria-label="Zoom in, shortcut 3"
              onClick={onZoomIn}
            >
              <span className="shortcut-badge">3</span>
              <ZoomIn size={17} />
            </button>
            <span className="zoom-level">{Math.round(Math.max(zoom, MIN_ZOOM) * 100)}%</span>
            <button
              type="button"
              className="zoom-icon-button"
              title="Zoom out (4)"
              aria-label="Zoom out, shortcut 4"
              onClick={onZoomOut}
              disabled={zoom <= MIN_ZOOM}
            >
              <span className="shortcut-badge">4</span>
              <ZoomOut size={17} />
            </button>
          </div>
          <button
            type="button"
            className="toolbar-button toolbar-button-compact"
            title="Fit screen (5)"
            aria-label="Fit screen, shortcut 5"
            onClick={onZoomReset}
          >
            <span className="shortcut-badge">5</span>
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
      <div className="toolbar-group toolbar-group-separated">
        <span className="toolbar-group-label">Power &amp; Cords</span>
        <div className="toolbar-group-controls">
          {markerToolsBeforeLine.map(renderMarkerTool)}
          <button
            type="button"
            className={`toolbar-button toolbar-tool-button tool-line ${isLineMode ? 'is-active' : ''}`}
            title="Extension Cord"
            aria-label="Extension Cord"
            onClick={onSelectLineTool}
          >
            <LineToolIcon size={17} />
            <span className="toolbar-label-stack">
              <span>Extension</span>
              <span>Cord</span>
            </span>
          </button>
        </div>
      </div>
      <div className="toolbar-group toolbar-group-separated">
        <span className="toolbar-group-label">Additional Utilities</span>
        <div className="toolbar-group-controls">
          {markerToolsAfterLine.map(renderMarkerTool)}
        </div>
      </div>
    </nav>
  )
}

function RightPanel({
  planner,
  selectedMarker,
  selectedLine,
  exportStatus,
  uploadError,
  openSectionId,
  onToggleSection,
  onBoothChange,
  onToolChange,
  onMarkerChange,
  onMarkerDelete,
  onLineChange,
  onLineDelete,
  onRenderUpload,
  onRenderRemove,
  onRenderOpacityChange,
  onExport,
  onReset,
}: {
  planner: PlannerState
  selectedMarker?: UtilityMarker
  selectedLine?: UtilityLine
  exportStatus: string
  uploadError: string
  openSectionId: string | null
  onToggleSection: (sectionId: string) => void
  onBoothChange: (booth: BoothDetails) => void
  onToolChange: (tool: MarkerType) => void
  onMarkerChange: (id: string, patch: Partial<UtilityMarker>) => void
  onMarkerDelete: (id: string) => void
  onLineChange: (id: string, patch: Partial<UtilityLine>) => void
  onLineDelete: (id: string) => void
  onRenderUpload: (file: File | undefined) => void
  onRenderRemove: () => void
  onRenderOpacityChange: (opacity: number) => void
  onExport: () => void
  onReset: () => void
}) {
  const booth = planner.booth

  function setBoothField(field: keyof BoothDetails, value: string | number) {
    onBoothChange({ ...booth, [field]: value })
  }

  function setSideLabel(field: keyof BoothDetails['sideLabels'], value: string) {
    onBoothChange({
      ...booth,
      sideLabels: {
        ...booth.sideLabels,
        [field]: value,
      },
    })
  }

  return (
    <aside className="right-panel">
      <div className="panel-header">
        <img className="panel-logo" src={sourceOneLogoPath} alt="SourceOne Events" />
        <div className="panel-title">
          <h2>Booth Utility Planner</h2>
        </div>
      </div>

      <PanelSection
        id="help"
        title="Help / How to Use"
        isOpen={openSectionId === 'help'}
        onToggle={onToggleSection}
      >
        <ol className="how-to-list">
          <li>Confirm your event and booth information under Booth Details.</li>
          <li>
            Add neighboring booth numbers for Front, Back, Left, and Right under Booth Position, or click the labels around the
            grid.
          </li>
          <li>Select a power drop from the bottom toolbar.</li>
          <li>Then click on the grid where the power drop should be placed.</li>
          <li>With the power drop selected, update information under Selected Item.</li>
          <li>
            Add an extension cord if needed by clicking a power drop first, then clicking the extension cord endpoint on
            the grid.
          </li>
          <li>Optional: Upload a top-down booth layout using Booth Image Upload.</li>
          <li>
            Export your layout as a PDF and email it to{' '}
            <a href="mailto:exhibitorservices@sourceoneevents.com">
              exhibitorservices@sourceoneevents.com
            </a>
            .
          </li>
        </ol>
      </PanelSection>

      <PanelSection
        id="booth-details"
        title="Booth Details"
        isOpen={openSectionId === 'booth-details'}
        onToggle={onToggleSection}
      >
        <div className="panel-field-grid">
          <TextField label="Name" value={booth.name} onChange={(value) => setBoothField('name', value)} />
          <TextField
            label="Company"
            value={booth.companyName}
            onChange={(value) => setBoothField('companyName', value)}
          />
          <TextField label="Email" value={booth.email} onChange={(value) => setBoothField('email', value)} />
          <TextField label="Phone" value={booth.phone} onChange={(value) => setBoothField('phone', value)} />
          <TextField
            label="Booth #"
            value={booth.boothNumber}
            onChange={(value) => setBoothField('boothNumber', value)}
          />
          <TextField
            label="Show"
            value={booth.showName}
            onChange={(value) => setBoothField('showName', value)}
          />
          <TextField
            type="date"
            label="Date"
            value={booth.showDate}
            onChange={(value) => setBoothField('showDate', value)}
          />
          <TextField
            label="Location"
            value={booth.showLocation}
            onChange={(value) => setBoothField('showLocation', value)}
          />
          <NumberField label="Width" value={booth.width} onChange={(value) => setBoothField('width', value)} />
          <NumberField label="Depth" value={booth.depth} onChange={(value) => setBoothField('depth', value)} />
          <label className="field-group">
            <span className="field-label">Booth Type</span>
            <select
              value={booth.boothType}
              onChange={(event) => setBoothField('boothType', event.target.value as BoothType)}
            >
              {BOOTH_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
        </div>
      </PanelSection>

      <PanelSection
        id="grid-layout"
        title="Booth Position"
        isOpen={openSectionId === 'grid-layout'}
        onToggle={onToggleSection}
      >
        <div className="panel-field-grid">
          <TextField label="Front" value={booth.sideLabels.front} onChange={(value) => setSideLabel('front', value)} />
          <TextField label="Back" value={booth.sideLabels.back} onChange={(value) => setSideLabel('back', value)} />
          <TextField label="Left" value={booth.sideLabels.left} onChange={(value) => setSideLabel('left', value)} />
          <TextField label="Right" value={booth.sideLabels.right} onChange={(value) => setSideLabel('right', value)} />
        </div>
      </PanelSection>

      <PanelSection
        id="selected-item"
        title="Selected Item"
        isOpen={openSectionId === 'selected-item'}
        onToggle={onToggleSection}
      >
        {selectedMarker ? (
          <div className="selected-drop-fields">
            <div className="coordinate-readout">
              {markerDisplay(selectedMarker.type).label}
            </div>
            {selectedMarker.type !== 'hanging_sign' && selectedMarker.type !== 'custom_drop' && (
              <label className="field-group">
                <span className="field-label">Type</span>
                <select
                  value={selectedMarker.type}
                  onChange={(event) => {
                    const type = event.target.value as MarkerType
                    onMarkerChange(selectedMarker.id, {
                      type,
                      amps: getValidAmp(type, selectedMarker.amps),
                      speed: type === 'wifi' ? selectedMarker.speed || 'Standard' : undefined,
                      is24Hour: isElectrical(type) ? selectedMarker.is24Hour : false,
                      hangingSignHeight: type === 'hanging_sign' ? selectedMarker.hangingSignHeight || '' : undefined,
                      isRotating: type === 'hanging_sign' ? Boolean(selectedMarker.isRotating) : false,
                    })
                    onToolChange(type)
                  }}
                >
                  {markerOptions.map((option) => (
                    <option key={option.type} value={option.type}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(() => {
              const edges = getEdgeDistances(selectedMarker.x, selectedMarker.y, planner.booth)
              return (
                <div className="coordinate-readout">
                  {formatFeet(edges.horizontalDistance)} ft from {edges.horizontalSide},{' '}
                  {formatFeet(edges.verticalDistance)} ft from {edges.verticalSide}
                </div>
              )
            })()}
            {isElectrical(selectedMarker.type) && (
              <>
                <label className="field-group">
                  <span className="field-label">Amps</span>
                  <select
                    value={getValidAmp(selectedMarker.type, selectedMarker.amps) || ''}
                    onChange={(event) =>
                      onMarkerChange(selectedMarker.id, { amps: event.target.value as UtilityMarker['amps'] })
                    }
                  >
                    {getAmpOptions(selectedMarker.type).map((amps) => (
                      <option key={amps} value={amps}>
                        {formatAmps(amps)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedMarker.is24Hour)}
                    onChange={(event) => onMarkerChange(selectedMarker.id, { is24Hour: event.target.checked })}
                  />
                  <span>24-hour power</span>
                </label>
              </>
            )}
            {selectedMarker.type === 'wifi' && (
              <label className="field-group">
                <span className="field-label">Speed</span>
                <select
                  value={selectedMarker.speed || 'Standard'}
                  onChange={(event) => onMarkerChange(selectedMarker.id, { speed: event.target.value })}
                >
                  <option>Basic</option>
                  <option>Standard</option>
                  <option>High Speed</option>
                  <option>Custom</option>
                </select>
              </label>
            )}
            {selectedMarker.type === 'hanging_sign' && (
              <>
                <TextField
                  label="How far is the hanging sign from the ground?"
                  value={selectedMarker.hangingSignHeight || ''}
                  onChange={(value) => onMarkerChange(selectedMarker.id, { hangingSignHeight: value })}
                />
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedMarker.isRotating)}
                    onChange={(event) => onMarkerChange(selectedMarker.id, { isRotating: event.target.checked })}
                  />
                  <span>Sign is rotating</span>
                </label>
              </>
            )}
            <label className="field-group">
              <span className="field-label">Notes</span>
              <textarea
                rows={3}
                value={selectedMarker.notes || ''}
                onChange={(event) => onMarkerChange(selectedMarker.id, { notes: event.target.value })}
              />
            </label>
            <button type="button" className="danger-button" onClick={() => onMarkerDelete(selectedMarker.id)}>
              <Trash2 size={16} />
              Delete marker
            </button>
          </div>
        ) : selectedLine ? (
          <div className="selected-drop-fields">
            <TextField
              label="Extension Cord Label"
              value={selectedLine.label || ''}
              onChange={(value) => onLineChange(selectedLine.id, { label: value })}
            />
            <div className="coordinate-readout">
              Connected drop:{' '}
              {planner.markers.find((marker) => marker.id === selectedLine.fromMarkerId)?.label || '-'}
            </div>
            <div className="coordinate-readout">Endpoint: {lineLocation(selectedLine)}</div>
            <label className="field-group">
              <span className="field-label">Notes</span>
              <textarea
                rows={3}
                value={selectedLine.notes || ''}
                onChange={(event) => onLineChange(selectedLine.id, { notes: event.target.value })}
              />
            </label>
            <button type="button" className="danger-button" onClick={() => onLineDelete(selectedLine.id)}>
              <Trash2 size={16} />
              Delete extension cord
            </button>
          </div>
        ) : (
          <p className="panel-note">Please select a drop or extension cord on the grid to edit its details.</p>
        )}
      </PanelSection>

      <PanelSection
        id="booth-render-upload"
        title="Booth Image Upload"
        isOpen={openSectionId === 'booth-render-upload'}
        onToggle={onToggleSection}
      >
        <p className="panel-note">
          Upload a top-down booth plan or render. The crop uses the current {booth.width} ft x{' '}
          {booth.depth} ft booth ratio.
        </p>
        <label className="upload-button">
          <Upload size={16} />
          {planner.renderImage ? 'Change PNG/JPG' : 'Upload PNG/JPG'}
          <input
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            onChange={(event) => {
              onRenderUpload(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
        {uploadError && <p className="upload-error">{uploadError}</p>}
        {planner.renderImage ? (
          <div className="upload-status">
            <p>{planner.renderImage.fileName}</p>
            <p>
              {planner.renderImage.wasCropped ? 'Cropped background' : 'Uploaded background'} -{' '}
              {planner.renderImage.width} x {planner.renderImage.height}px
            </p>
            <label className="field-group">
              <span className="field-label">Opacity</span>
              <input
                type="range"
                min={0.05}
                max={0.6}
                step={0.05}
                value={planner.renderImage.opacity}
                onChange={(event) => onRenderOpacityChange(Number(event.target.value))}
              />
            </label>
            <button type="button" className="text-button" onClick={onRenderRemove}>
              Remove render
            </button>
          </div>
        ) : (
          <p className="panel-note">JPG or PNG, max 5 MB. No render uploaded.</p>
        )}
      </PanelSection>

      <PanelSection
        id="export"
        title="Export"
        isOpen={openSectionId === 'export'}
        onToggle={onToggleSection}
      >
        <button type="button" className="primary-button full-width" onClick={onExport}>
          <Download size={16} />
          Export PDF
        </button>
        {exportStatus && <p className="export-status">{exportStatus}</p>}
      </PanelSection>

      <footer className="panel-footer">
        <p>Progress saves automatically in this browser.</p>
        <button type="button" className="reset-button" onClick={onReset}>
          <RotateCcw size={14} />
          Reset planner
        </button>
      </footer>
    </aside>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="field-group">
      <span className="field-label">{label}</span>
      <input
        type="number"
        min={1}
        max={100}
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value) || 1, 1, 100))}
      />
    </label>
  )
}

function PanelSection({
  id,
  title,
  isOpen,
  onToggle,
  children,
}: {
  id: string
  title: string
  isOpen: boolean
  onToggle: (sectionId: string) => void
  children: React.ReactNode
}) {
  return (
    <section className="panel-section">
      <button
        type="button"
        className="section-toggle"
        aria-expanded={isOpen}
        aria-controls={`${id}-section`}
        onClick={() => onToggle(id)}
      >
        <span>{title}</span>
        <span aria-hidden="true">{isOpen ? '-' : '+'}</span>
      </button>
      <div id={`${id}-section`} className={`section-body ${isOpen ? 'is-open' : ''}`}>
        <div className="section-inner">{children}</div>
      </div>
    </section>
  )
}

export default App
