import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import {
  Download,
  Hand,
  Maximize2,
  MousePointer2,
  PlugZap,
  RotateCcw,
  Trash2,
  Upload,
  Wifi,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import './App.css'

type MarkerType =
  | 'main_drop'
  | '120v'
  | '208v_single_phase'
  | '208v_three_phase'
  | '480v_three_phase'
  | 'wifi'

type UtilityMarker = {
  id: string
  label: string
  type: MarkerType
  x: number
  y: number
  amps?: '5A' | '10A' | '20A' | ''
  speed?: string
  is24Hour?: boolean
  connectToMainDrop?: boolean
  notes?: string
}

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
  selectedTool: MarkerType
  renderImage?: {
    dataUrl: string
    fileName: string
    opacity: number
  }
  hasCompletedSetup: boolean
}

const STORAGE_KEY = 'sourceone-booth-utility-planner'
const SNAP_FEET = 0.5
const DEFAULT_TOOL: MarkerType = 'main_drop'
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25
const dimensionOptions = Array.from({ length: 10 }, (_, index) => (index + 1) * 10)

const markerOptions: Array<{
  type: MarkerType
  label: string
  short: string
}> = [
  { type: 'main_drop', label: 'Main Drop', short: 'MD' },
  { type: '120v', label: '120 V', short: '120' },
  { type: '208v_single_phase', label: '208 V Single Phase', short: '208 1P' },
  { type: '208v_three_phase', label: '208 V Three Phase', short: '208 3P' },
  { type: '480v_three_phase', label: '480 V Three Phase', short: '480 3P' },
  { type: 'wifi', label: 'WiFi', short: 'WiFi' },
]

const markerColors: Record<MarkerType, string> = {
  main_drop: '#111827',
  '120v': '#2563eb',
  '208v_single_phase': '#7c3aed',
  '208v_three_phase': '#f97316',
  '480v_three_phase': '#be123c',
  wifi: '#047857',
}

const sourceOneLogoPath = '/SourceOne-Logo-RGB.svg'

function NestedShapeIcon({
  shape,
  size,
}: {
  shape: 'triangle' | 'circle' | 'square' | 'octagon'
  size: number
}) {
  const commonProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="nested-shape-icon"
    >
      {shape === 'triangle' && (
        <>
          <path {...commonProps} strokeWidth="2" d="M12 3 21 20H3L12 3Z" />
          <path {...commonProps} strokeWidth="1.8" d="M12 10.2 15.5 16.8H8.5L12 10.2Z" />
        </>
      )}
      {shape === 'circle' && (
        <>
          <circle {...commonProps} strokeWidth="2" cx="12" cy="12" r="8.5" />
          <circle {...commonProps} strokeWidth="1.8" cx="12" cy="12" r="4.5" />
        </>
      )}
      {shape === 'square' && (
        <>
          <rect {...commonProps} strokeWidth="2" x="4" y="4" width="16" height="16" rx="1.5" />
          <rect {...commonProps} strokeWidth="1.8" x="8" y="8" width="8" height="8" rx="1" />
        </>
      )}
      {shape === 'octagon' && (
        <>
          <path {...commonProps} strokeWidth="2" d="M8 3h8l5 5v8l-5 5H8l-5-5V8l5-5Z" />
          <path {...commonProps} strokeWidth="1.8" d="M9.7 8h4.6l1.7 1.7v4.6L14.3 16H9.7L8 14.3V9.7L9.7 8Z" />
        </>
      )}
    </svg>
  )
}

function MarkerTypeIcon({ type, size = 15 }: { type: MarkerType; size?: number }) {
  switch (type) {
    case 'main_drop':
      return <PlugZap size={size} />
    case '120v':
      return <NestedShapeIcon shape="triangle" size={size} />
    case '208v_single_phase':
      return <NestedShapeIcon shape="circle" size={size} />
    case '208v_three_phase':
      return <NestedShapeIcon shape="square" size={size} />
    case '480v_three_phase':
      return <NestedShapeIcon shape="octagon" size={size} />
    case 'wifi':
      return <Wifi size={size} />
  }
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

function getMarkerLabel(type: MarkerType, markers: UtilityMarker[]) {
  if (type === 'main_drop') {
    return 'MDL-1'
  }

  if (type === 'wifi') {
    const count = markers.filter((marker) => marker.type === 'wifi').length + 1
    return `W${count}`
  }

  const count = markers.filter((marker) => isElectrical(marker.type)).length + 1
  return `E${count}`
}

function isElectrical(type: MarkerType) {
  return type !== 'main_drop' && type !== 'wifi'
}

function markerDisplay(type: MarkerType) {
  return markerOptions.find((option) => option.type === type) ?? markerOptions[0]
}

function markerValue(marker: UtilityMarker) {
  if (isElectrical(marker.type)) {
    return marker.amps || '-'
  }
  if (marker.type === 'wifi') {
    return marker.speed || '-'
  }
  return '-'
}

function markerLocation(marker: UtilityMarker) {
  return `${formatFeet(marker.x)}ft from left, ${formatFeet(marker.y)}ft from front`
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
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
      return ''
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
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

function markerPdfPoint(marker: UtilityMarker, booth: BoothDetails, grid: PdfGridLayout) {
  return {
    x: grid.x + (marker.x / booth.width) * grid.width,
    y: grid.y + ((booth.depth - marker.y) / booth.depth) * grid.height,
  }
}

function drawPdfGrid(doc: jsPDF, planner: PlannerState, grid: PdfGridLayout) {
  const { booth, markers, renderImage } = planner
  const mainDrop = markers.find((marker) => marker.type === 'main_drop')

  if (renderImage) {
    const imageType = renderImage.dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'
    doc.addImage(renderImage.dataUrl, imageType, grid.x, grid.y, grid.width, grid.height)
  }

  doc.setDrawColor(225, 231, 239)
  doc.setLineWidth(0.25)
  for (let x = 0; x <= booth.width; x += 1) {
    const lineX = grid.x + (x / booth.width) * grid.width
    doc.line(lineX, grid.y, lineX, grid.y + grid.height)
  }
  for (let y = 0; y <= booth.depth; y += 1) {
    const lineY = grid.y + (y / booth.depth) * grid.height
    doc.line(grid.x, lineY, grid.x + grid.width, lineY)
  }

  doc.setDrawColor(17, 24, 39)
  doc.setLineWidth(1.4)
  doc.rect(grid.x, grid.y, grid.width, grid.height)

  if (mainDrop) {
    const mainPoint = markerPdfPoint(mainDrop, booth, grid)
    doc.setDrawColor(30, 41, 59)
    doc.setLineWidth(1.4)
    doc.setLineDashPattern([5, 4], 0)
    markers
      .filter(
        (marker) =>
          marker.type !== 'main_drop' &&
          marker.id !== mainDrop.id &&
          marker.connectToMainDrop !== false,
      )
      .forEach((marker) => {
        const point = markerPdfPoint(marker, booth, grid)
        doc.line(point.x, point.y, mainPoint.x, mainPoint.y)
      })
    doc.setLineDashPattern([], 0)
  }

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
    doc.circle(point.x, point.y, 7, 'FD')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.8)
    if (isElectrical(marker.type)) {
      doc.text(marker.label || markerDisplay(marker.type).short, point.x, point.y - 1.5, {
        align: 'center',
      })
      doc.setFontSize(4.8)
      doc.text(marker.amps || '-', point.x, point.y + 4.6, {
        align: 'center',
      })
    } else {
      doc.text(marker.label || markerDisplay(marker.type).short, point.x, point.y + 2, {
        align: 'center',
      })
    }
  })

  doc.setTextColor(17, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  const sideLabelOffset = 22
  doc.text(`Back: ${booth.sideLabels.back || '-'}`, grid.x + grid.width / 2, grid.y - sideLabelOffset, {
    align: 'center',
  })
  doc.text(`Front: ${booth.sideLabels.front || '-'}`, grid.x + grid.width / 2, grid.y + grid.height + sideLabelOffset, {
    align: 'center',
  })
  doc.text(`Left: ${booth.sideLabels.left || '-'}`, grid.x - sideLabelOffset, grid.y + grid.height / 2, {
    angle: 90,
    align: 'center',
  })
  doc.text(`Right: ${booth.sideLabels.right || '-'}`, grid.x + grid.width + sideLabelOffset, grid.y + grid.height / 2, {
    angle: 270,
    align: 'center',
  })
}

function drawPdfFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(75, 85, 99)
    doc.text(
      'Email: exhibitorservices@sourceoneevents.com | Phone: 708.344.3050 | Fax: 708.344.4111',
      margin,
      pageHeight - 24,
    )
  }
}

function drawLegend(doc: jsPDF, markers: UtilityMarker[], x: number, y: number) {
  const presentTypes = markerOptions.filter((option) =>
    markers.some((marker) => marker.type === option.type),
  )
  if (presentTypes.length === 0) {
    return y
  }

  doc.setTextColor(17, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Legend', x, y)

  let cursorX = x
  let cursorY = y + 16
  presentTypes.forEach((option) => {
    const itemWidth = Math.max(74, doc.getTextWidth(option.label) + 20)
    if (cursorX + itemWidth > 560) {
      cursorX = x
      cursorY += 15
    }
    const [r, g, b] = hexToRgb(markerColors[option.type])
    doc.setFillColor(r, g, b)
    doc.circle(cursorX + 4, cursorY - 3, 4, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(55, 65, 81)
    doc.setFontSize(8)
    doc.text(option.label, cursorX + 12, cursorY)
    cursorX += itemWidth
  })

  return cursorY + 14
}

function drawDropTable(doc: jsPDF, planner: PlannerState, startY: number) {
  const margin = 36
  const pageHeight = doc.internal.pageSize.getHeight()
  const columns = [
    { label: 'ID', width: 42 },
    { label: 'Type', width: 82 },
    { label: 'Location', width: 118 },
    { label: 'Amps / Speed', width: 64 },
    { label: '24 Hour', width: 48 },
    { label: 'Connected', width: 60 },
    { label: 'Notes', width: 126 },
  ]
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0)
  let y = startY

  function drawHeader() {
    doc.setFillColor(33, 70, 112)
    doc.rect(margin, y, tableWidth, 18, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(255, 255, 255)
    let x = margin
    columns.forEach((column) => {
      doc.text(column.label, x + 4, y + 12)
      x += column.width
    })
    y += 18
  }

  drawHeader()

  planner.markers.forEach((marker, index) => {
    const cells = [
      marker.label || '-',
      markerDisplay(marker.type).label,
      markerLocation(marker),
      markerValue(marker),
      isElectrical(marker.type) ? (marker.is24Hour ? 'Yes' : 'No') : '-',
      marker.type === 'main_drop' ? '-' : marker.connectToMainDrop === false ? 'No' : 'Yes',
      marker.notes?.trim() || '-',
    ]
    const cellLines = cells.map((cell, cellIndex) =>
      doc.splitTextToSize(cell, columns[cellIndex].width - 8),
    )
    const rowHeight = Math.max(20, Math.max(...cellLines.map((lines) => lines.length)) * 9 + 8)

    if (y + rowHeight > pageHeight - 62) {
      doc.addPage()
      y = margin
      drawHeader()
    }

    doc.setFillColor(index % 2 === 0 ? 248 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 252 : 255)
    doc.rect(margin, y, tableWidth, rowHeight, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.rect(margin, y, tableWidth, rowHeight)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(31, 41, 55)
    let x = margin
    cellLines.forEach((lines, cellIndex) => {
      doc.text(lines, x + 4, y + 11)
      x += columns[cellIndex].width
    })
    y += rowHeight
  })

  return y
}

async function exportPlannerPdf(planner: PlannerState) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36
  const logoDataUrl = await svgAssetToPngDataUrl(sourceOneLogoPath)

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', margin, 30, 150, 45)
  }

  doc.setTextColor(17, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Booth Utility Planner', margin, 94)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    `Show: ${planner.booth.showName || '-'} | Location: ${planner.booth.showLocation || '-'} | Date: ${
      planner.booth.showDate || '-'
    }`,
    margin,
    114,
  )
  doc.text(
    `Booth #: ${planner.booth.boothNumber || '-'} | Booth Size: ${planner.booth.width}ft x ${
      planner.booth.depth
    }ft`,
    margin,
    128,
  )

  const gridMaxWidth = pageWidth - margin * 2 - 70
  const gridMaxHeight = 300
  const gridScale = Math.min(
    gridMaxWidth / planner.booth.width,
    gridMaxHeight / planner.booth.depth,
  )
  const grid = {
    width: planner.booth.width * gridScale,
    height: planner.booth.depth * gridScale,
    x: margin + 35 + (gridMaxWidth - planner.booth.width * gridScale) / 2,
    y: 198,
  }

  drawPdfGrid(doc, planner, grid)
  let y = grid.y + grid.height + 58
  y = drawLegend(doc, planner.markers, margin, y)
  y += 12
  doc.setTextColor(17, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Drop Details', margin, y)
  y = drawDropTable(doc, planner, y + 10)

  if (y > pageHeight - 66) {
    doc.addPage()
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
      },
      markers: Array.isArray(parsed.markers)
        ? parsed.markers.map((marker) => ({
            ...marker,
            connectToMainDrop:
              typeof marker.connectToMainDrop === 'boolean'
                ? marker.connectToMainDrop
                : marker.type !== 'main_drop',
          }))
        : [],
      selectedTool: parsed.selectedTool ?? DEFAULT_TOOL,
      renderImage: parsed.renderImage,
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
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [exportStatus, setExportStatus] = useState('')
  const [stageSize, setStageSize] = useState({ width: 900, height: 680 })
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanMode, setIsPanMode] = useState(false)
  const [isPointerMode, setIsPointerMode] = useState(false)
  const [openPanelSectionId, setOpenPanelSectionId] = useState<string | null>(null)
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
  const mainDrop = planner.markers.find((marker) => marker.type === 'main_drop')
  const mainDropPlaced = planner.markers.some((marker) => marker.type === 'main_drop')

  const gridMetrics = useMemo(() => {
    const maxCell = 64
    const minCell = 5
    const availableWidth = Math.max(260, stageSize.width - 300)
    const availableHeight = Math.max(260, stageSize.height - 270)
    const scale = Math.max(
      minCell,
      Math.min(maxCell, availableWidth / planner.booth.width, availableHeight / planner.booth.depth),
    )
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
      if (!draggingId) {
        return
      }
      const coords = getGridCoords(event.clientX, event.clientY)
      if (!coords) {
        return
      }
      updateMarker(draggingId, coords)
    }

    function stopDragging() {
      setDraggingId(null)
    }

    window.addEventListener('pointermove', moveSelected)
    window.addEventListener('pointerup', stopDragging)
    return () => {
      window.removeEventListener('pointermove', moveSelected)
      window.removeEventListener('pointerup', stopDragging)
    }
  }, [draggingId, getGridCoords])

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

  function deleteMarker(id: string) {
    setPlanner((current) => ({
      ...current,
      markers: current.markers.filter((marker) => marker.id !== id),
    }))
    setSelectedMarkerId(null)
    setAmpPromptMarkerId(null)
  }

  function placeMarker(clientX: number, clientY: number) {
    if (isPanMode || isPointerMode) {
      return
    }
    const coords = getGridCoords(clientX, clientY)
    if (!coords) {
      return
    }

    if (
      planner.selectedTool === 'main_drop' &&
      planner.markers.some((marker) => marker.type === 'main_drop')
    ) {
      const mainDrop = planner.markers.find((marker) => marker.type === 'main_drop')
      setSelectedMarkerId(mainDrop?.id ?? null)
      return
    }

    const nextMarker: UtilityMarker = {
      id: crypto.randomUUID(),
      label: getMarkerLabel(planner.selectedTool, planner.markers),
      type: planner.selectedTool,
      x: coords.x,
      y: coords.y,
      amps: isElectrical(planner.selectedTool) ? '10A' : undefined,
      speed: planner.selectedTool === 'wifi' ? 'Standard' : undefined,
      is24Hour: false,
      connectToMainDrop: planner.selectedTool !== 'main_drop',
      notes: '',
    }

    setPlanner((current) => ({ ...current, markers: [...current.markers, nextMarker] }))
    setSelectedMarkerId(nextMarker.id)
    setOpenPanelSectionId('selected-drop')
    setAmpPromptMarkerId(isElectrical(nextMarker.type) ? nextMarker.id : null)
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

  function handleRenderUpload(file: File | undefined) {
    if (!file) {
      return
    }
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setExportStatus('Upload must be a PNG or JPG under 5MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setPlanner((current) => ({
        ...current,
        renderImage: {
          dataUrl: String(reader.result),
          fileName: file.name,
          opacity: current.renderImage?.opacity ?? 0.28,
        },
      }))
      setExportStatus('')
    }
    reader.readAsDataURL(file)
  }

  function resetPlanner() {
    setPlanner(defaultState)
    setSelectedMarkerId(null)
    setExportStatus('')
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

  function selectTool(selectedTool: MarkerType) {
    setIsPanMode(false)
    setIsPointerMode(false)
    setPlanner((current) => ({ ...current, selectedTool }))
  }

  async function handleExportPdf() {
    if (planner.markers.length === 0) {
      window.alert('No drops have been placed yet. The PDF will export an empty booth layout.')
    } else if (!mainDropPlaced) {
      window.alert('A Main Drop should be placed before exporting.')
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
        <header className="workspace-header">
          <div className="brand-block">
            <img className="sourceone-logo" src={sourceOneLogoPath} alt="SourceOne Events" />
            <div className="show-summary">
              <p className="eyebrow">Booth Utility Planner</p>
              <h1>{planner.booth.showName || 'Untitled Show'}</h1>
              <div className="show-meta">
                {planner.booth.showLocation && <span>{planner.booth.showLocation}</span>}
                {planner.booth.showDate && <span>{planner.booth.showDate}</span>}
              </div>
            </div>
          </div>
        </header>

        <div
          className={`canvas-stage ${isPanMode ? 'is-pan-mode' : ''} ${
            panStart ? 'is-panning' : ''
          }`}
          ref={stageRef}
          onPointerDown={startPan}
        >
          {!mainDropPlaced && (
            <p className="instruction-note">
              Place the Main Drop Location first, then add electrical and WiFi drops as needed.
            </p>
          )}
          <div
            ref={gridRef}
            className="booth-grid"
            style={{
              width: gridMetrics.widthPx,
              height: gridMetrics.heightPx,
              backgroundSize: `${gridMetrics.scale}px ${gridMetrics.scale}px`,
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            }}
            onPointerDown={(event) => {
              if (isPanMode) {
                event.stopPropagation()
                startPan(event)
                return
              }
              if (event.target === event.currentTarget) {
                placeMarker(event.clientX, event.clientY)
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
            <div className="grid-measure grid-measure-width">{planner.booth.width} ft</div>
            <div className="grid-measure grid-measure-depth">{planner.booth.depth} ft</div>
            {mainDrop && (
              <MainDropConnections
                booth={planner.booth}
                mainDrop={mainDrop}
                markers={planner.markers}
              />
            )}
            <div className="side-label side-label-back">
              <strong>Back</strong>
              <span>{planner.booth.sideLabels.back || 'Back side label'}</span>
            </div>
            <div className="side-label side-label-front">
              <strong>Front</strong>
              <span>{planner.booth.sideLabels.front || 'Front side label'}</span>
            </div>
            <div className="side-label side-label-left">
              <strong>Left</strong>
              <span>{planner.booth.sideLabels.left || 'Left side label'}</span>
            </div>
            <div className="side-label side-label-right">
              <strong>Right</strong>
              <span>{planner.booth.sideLabels.right || 'Right side label'}</span>
            </div>
            {planner.markers.map((marker) => (
              <MeasurementGuides
                key={`guides-${marker.id}`}
                marker={marker}
                booth={planner.booth}
                isSelected={marker.id === selectedMarkerId}
              />
            ))}
            {planner.markers.map((marker, index) => {
              const display = markerDisplay(marker.type)
              return (
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
                    setSelectedMarkerId(marker.id)
                    setOpenPanelSectionId('selected-drop')
                    setAmpPromptMarkerId(null)
                    setDraggingId(marker.id)
                  }}
                >
                  <MarkerTypeIcon type={marker.type} size={15} />
                  <span className="marker-copy">
                    <span className="marker-label">{marker.label || display.short}</span>
                    {isElectrical(marker.type) && marker.amps && (
                      <span className="marker-amps">{marker.amps}</span>
                    )}
                  </span>
                </button>
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
          </div>
        </div>

        <BottomToolbar
          selectedTool={planner.selectedTool}
          mainDropPlaced={mainDropPlaced}
          zoom={zoom}
          isPanMode={isPanMode}
          isPointerMode={isPointerMode}
          onSelectTool={selectTool}
          onZoomIn={() => setZoomLevel(zoom + ZOOM_STEP)}
          onZoomOut={() => setZoomLevel(zoom - ZOOM_STEP)}
          onZoomReset={() => {
            setZoom(1)
            setPanOffset({ x: 0, y: 0 })
          }}
          onTogglePan={() => {
            setDraggingId(null)
            setIsPointerMode(false)
            setIsPanMode((current) => !current)
          }}
          onSelectPointer={() => {
            setDraggingId(null)
            setIsPanMode(false)
            setIsPointerMode(true)
          }}
        />
      </section>

      <RightPanel
        planner={planner}
        selectedMarker={selectedMarker}
        exportStatus={exportStatus}
        openSectionId={openPanelSectionId}
        onToggleSection={(sectionId) =>
          setOpenPanelSectionId((current) => (current === sectionId ? null : sectionId))
        }
        onBoothChange={setBooth}
        onToolChange={(selectedTool) => setPlanner((current) => ({ ...current, selectedTool }))}
        onMarkerChange={(id, patch) => updateMarker(id, patch)}
        onMarkerDelete={deleteMarker}
        onRenderUpload={handleRenderUpload}
        onRenderRemove={() => setPlanner((current) => ({ ...current, renderImage: undefined }))}
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
    </main>
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
  const rightDistance = booth.width - marker.x
  const backDistance = booth.depth - marker.y
  const horizontalSide = marker.x <= rightDistance ? 'left' : 'right'
  const verticalSide = marker.y <= backDistance ? 'front' : 'back'
  const horizontalDistance = horizontalSide === 'left' ? marker.x : rightDistance
  const verticalDistance = verticalSide === 'front' ? marker.y : backDistance
  const horizontalLabelLeft =
    horizontalSide === 'left' ? leftPct / 2 : leftPct + (100 - leftPct) / 2
  const verticalLabelTop =
    verticalSide === 'back' ? topPct / 2 : topPct + (100 - topPct) / 2

  const guideStyle = {
    '--guide-color': markerColors[marker.type],
  } as CSSProperties

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
    </div>
  )
}

function MainDropConnections({
  booth,
  mainDrop,
  markers,
}: {
  booth: BoothDetails
  mainDrop: UtilityMarker
  markers: UtilityMarker[]
}) {
  const mainX = (mainDrop.x / booth.width) * 100
  const mainY = ((booth.depth - mainDrop.y) / booth.depth) * 100
  const connectedMarkers = markers.filter(
    (marker) =>
      marker.id !== mainDrop.id &&
      marker.type !== 'main_drop' &&
      marker.connectToMainDrop !== false,
  )

  if (connectedMarkers.length === 0) {
    return null
  }

  return (
    <svg
      className="main-drop-connection-layer"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {connectedMarkers.map((marker) => (
        <line
          key={`connection-${marker.id}`}
          x1={(marker.x / booth.width) * 100}
          y1={((booth.depth - marker.y) / booth.depth) * 100}
          x2={mainX}
          y2={mainY}
        />
      ))}
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
          value={marker.amps || '10A'}
          autoFocus
          onChange={(event) => onSelect(event.target.value as UtilityMarker['amps'])}
          onBlur={onClose}
        >
          <option value="5A">5A</option>
          <option value="10A">10A</option>
          <option value="20A">20A</option>
        </select>
      </label>
    </div>
  )
}

function BottomToolbar({
  selectedTool,
  mainDropPlaced,
  zoom,
  isPanMode,
  isPointerMode,
  onSelectTool,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onTogglePan,
  onSelectPointer,
}: {
  selectedTool: MarkerType
  mainDropPlaced: boolean
  zoom: number
  isPanMode: boolean
  isPointerMode: boolean
  onSelectTool: (tool: MarkerType) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onTogglePan: () => void
  onSelectPointer: () => void
}) {
  return (
    <nav className="bottom-toolbar" aria-label="Utility placement tools">
      {markerOptions.map((option) => {
        const isMainDisabled = option.type === 'main_drop' && mainDropPlaced
        const activeStyle = {
          '--active-color': markerColors[option.type],
        } as CSSProperties
        return (
          <button
            key={option.type}
            type="button"
            className={`tool-${option.type} ${
              !isPanMode && !isPointerMode && selectedTool === option.type ? 'is-active' : ''
            }`}
            disabled={isMainDisabled && selectedTool !== option.type}
            style={activeStyle}
            title={isMainDisabled ? 'Only one Main Drop is allowed' : option.label}
            onClick={() => onSelectTool(option.type)}
          >
            <MarkerTypeIcon type={option.type} size={17} />
            <span>{option.label}</span>
          </button>
        )
      })}
      <div className="toolbar-divider" aria-hidden="true" />
      <button
        type="button"
        className={isPointerMode ? 'is-active' : ''}
        title="Pointer / Select"
        aria-label="Pointer / Select"
        onClick={onSelectPointer}
      >
        <MousePointer2 size={17} />
      </button>
      <button
        type="button"
        className={isPanMode ? 'is-active' : ''}
        title="Pan canvas"
        aria-label="Pan canvas"
        onClick={onTogglePan}
      >
        <Hand size={17} />
      </button>
      <div className="zoom-controls" aria-label="Zoom controls">
        <button type="button" title="Zoom out" onClick={onZoomOut}>
          <ZoomOut size={17} />
        </button>
        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
        <button type="button" title="Zoom in" onClick={onZoomIn}>
          <ZoomIn size={17} />
        </button>
        <button type="button" title="Reset zoom" onClick={onZoomReset}>
          <Maximize2 size={16} />
        </button>
      </div>
    </nav>
  )
}

function RightPanel({
  planner,
  selectedMarker,
  exportStatus,
  openSectionId,
  onToggleSection,
  onBoothChange,
  onToolChange,
  onMarkerChange,
  onMarkerDelete,
  onRenderUpload,
  onRenderRemove,
  onRenderOpacityChange,
  onExport,
  onReset,
}: {
  planner: PlannerState
  selectedMarker?: UtilityMarker
  exportStatus: string
  openSectionId: string | null
  onToggleSection: (sectionId: string) => void
  onBoothChange: (booth: BoothDetails) => void
  onToolChange: (tool: MarkerType) => void
  onMarkerChange: (id: string, patch: Partial<UtilityMarker>) => void
  onMarkerDelete: (id: string) => void
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
        </div>
      </PanelSection>

      <PanelSection
        id="grid-layout"
        title="Grid Layout"
        isOpen={openSectionId === 'grid-layout'}
        onToggle={onToggleSection}
      >
        <div className="panel-field-grid">
          <TextField label="Front" value={booth.sideLabels.front} onChange={(value) => setSideLabel('front', value)} />
          <TextField label="Back" value={booth.sideLabels.back} onChange={(value) => setSideLabel('back', value)} />
          <TextField label="Left" value={booth.sideLabels.left} onChange={(value) => setSideLabel('left', value)} />
          <TextField label="Right" value={booth.sideLabels.right} onChange={(value) => setSideLabel('right', value)} />
        </div>
        <p className="panel-note">Grid: 1 ft squares. Placement snaps to 0.5 ft.</p>
      </PanelSection>

      <PanelSection
        id="selected-drop"
        title="Selected Drop"
        isOpen={openSectionId === 'selected-drop'}
        onToggle={onToggleSection}
      >
        {selectedMarker ? (
          <div className="selected-drop-fields">
            <TextField
              label="Label"
              value={selectedMarker.label}
              onChange={(value) => onMarkerChange(selectedMarker.id, { label: value })}
            />
            <label className="field-group">
              <span className="field-label">Type</span>
              <select
                value={selectedMarker.type}
                onChange={(event) => {
                  const type = event.target.value as MarkerType
                  onMarkerChange(selectedMarker.id, {
                    type,
                    amps: isElectrical(type) ? selectedMarker.amps || '10A' : undefined,
                    speed: type === 'wifi' ? selectedMarker.speed || 'Standard' : undefined,
                    is24Hour: isElectrical(type) ? selectedMarker.is24Hour : false,
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
            <div className="coordinate-readout">
              {formatFeet(selectedMarker.x)} ft from left, {formatFeet(selectedMarker.y)} ft from front
            </div>
            {isElectrical(selectedMarker.type) && (
              <>
                <label className="field-group">
                  <span className="field-label">Amps</span>
                  <select
                    value={selectedMarker.amps || ''}
                    onChange={(event) =>
                      onMarkerChange(selectedMarker.id, { amps: event.target.value as UtilityMarker['amps'] })
                    }
                  >
                    <option value="5A">5A</option>
                    <option value="10A">10A</option>
                    <option value="20A">20A</option>
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
            {selectedMarker.type !== 'main_drop' && (
              <>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={selectedMarker.connectToMainDrop !== false}
                    onChange={(event) =>
                      onMarkerChange(selectedMarker.id, {
                        connectToMainDrop: event.target.checked,
                      })
                    }
                  />
                  <span>Connect to Main Drop</span>
                </label>
                {!planner.markers.some((marker) => marker.type === 'main_drop') && (
                  <p className="panel-note">Connection will appear after a Main Drop is placed.</p>
                )}
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
        ) : (
          <p className="panel-note">Please select a drop on the grid to edit its details.</p>
        )}
      </PanelSection>

      <PanelSection
        id="booth-render-upload"
        title="Booth Render Upload"
        isOpen={openSectionId === 'booth-render-upload'}
        onToggle={onToggleSection}
      >
        <label className="upload-button">
          <Upload size={16} />
          Upload PNG/JPG
          <input
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            onChange={(event) => {
              onRenderUpload(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
        {planner.renderImage ? (
          <div className="upload-status">
            <p>{planner.renderImage.fileName}</p>
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
          <p className="panel-note">Optional top-down booth reference. It appears under the grid at low opacity.</p>
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
          Export PDF placeholder
        </button>
        <button type="button" className="secondary-button full-width" onClick={onReset}>
          <RotateCcw size={16} />
          Reset planner
        </button>
        {exportStatus && <p className="export-status">{exportStatus}</p>}
      </PanelSection>

      <PanelSection
        id="help"
        title="Help"
        isOpen={openSectionId === 'help'}
        onToggle={onToggleSection}
      >
        <div className="help-list">
          <p>
            <strong>Email:</strong>{' '}
            <a href="mailto:exhibitorservices@sourceoneevents.com">
              exhibitorservices@sourceoneevents.com
            </a>
          </p>
          <p>
            <strong>Phone:</strong> <a href="tel:7083443050">708.344.3050</a>
          </p>
          <p>
            <strong>Fax:</strong> 708.344.4111
          </p>
        </div>
      </PanelSection>

      <footer className="panel-footer">Progress saves automatically in this browser.</footer>
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
