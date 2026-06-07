import { jsPDF } from 'jspdf'
import { createFadedImageDataUrl } from '../utils/cropImage'
import {
  type MarkerType,
  type UtilityMarker,
  type UtilityLine,
  isElectrical,
  markerOptions,
  markerColors,
  markerDisplay,
  formatFeet,
  formatAmps,
  getLineLabel,
  lineLocation,
  getLineStartCoords,
  lineLengthFt,
  getEdgeDistances,
} from '../lib/plannerUtils'
import type { BoothDetails, PlannerState } from '../App'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const PDF_MARGIN = 32
const PDF_FOOTER_BOTTOM_OFFSET = 20
const PDF_SIDE_LABEL_FONT_SIZE = 8
const PDF_GRID_BORDER_WIDTH = 1.5
const PDF_SIDE_LABEL_GAP = 12
const PDF_SIDE_LABEL_LINE_HEIGHT = PDF_SIDE_LABEL_FONT_SIZE
const PDF_LEGEND_ICON_SIZE = 7
const PDF_LEGEND_ICON_LABEL_GAP = 8
const PDF_LEGEND_ITEM_GAP = 24
const PDF_LEGEND_ROW_GAP = 13
const PDF_TABLE_HEADER_HEIGHT = 16
const PDF_TABLE_ROW_MIN_HEIGHT = 17
const PDF_TABLE_LINE_HEIGHT = 8
const PDF_TABLE_BOTTOM_PADDING = 48
const PDF_LOGO_MAX_WIDTH = 126
const PDF_LOGO_MAX_HEIGHT = 38

const sourceOneLogoPath = '/SourceOne-Logo-RGB.svg'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// PDF-only helpers
// ---------------------------------------------------------------------------

function markerLocation(marker: UtilityMarker) {
  return `${formatFeet(marker.x)}ft from left, ${formatFeet(marker.y)}ft from front`
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

// ---------------------------------------------------------------------------
// Marker shapes
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Side labels
// ---------------------------------------------------------------------------

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
  const getLabelHeight = (label: string) => {
    const dimensions = doc.getTextDimensions(label, {
      fontSize: PDF_SIDE_LABEL_FONT_SIZE,
    })
    return dimensions.h || PDF_SIDE_LABEL_LINE_HEIGHT
  }
  const horizontalLabelHeight = Math.max(
    PDF_SIDE_LABEL_LINE_HEIGHT,
    getLabelHeight(labels.back),
    getLabelHeight(labels.front),
  )
  const horizontalLabelOffset = PDF_GRID_BORDER_WIDTH / 2 + PDF_SIDE_LABEL_GAP + horizontalLabelHeight / 2
  const rotatedLabelCenterOffset = PDF_GRID_BORDER_WIDTH / 2 + PDF_SIDE_LABEL_GAP + PDF_SIDE_LABEL_LINE_HEIGHT / 2
  const lineHeightFactor = doc.getLineHeightFactor()
  const baselineDescent = PDF_SIDE_LABEL_LINE_HEIGHT * (lineHeightFactor - 1)
  // Distance from the text baseline to the vertical visual center of the line box,
  // measured toward the ascender. This mirrors how jsPDF's baseline:"middle" centers
  // the Front/Back labels, so all four labels share the same visual centering model.
  const baselineToVisualCenter = PDF_SIDE_LABEL_LINE_HEIGHT / 2 - baselineDescent
  const textOptions = {
    align: 'center' as const,
    baseline: 'middle' as const,
  }
  const gridCenterX = grid.x + grid.width / 2
  const gridCenterY = grid.y + grid.height / 2

  // The line that the rotated label's perpendicular (across-thickness) center must sit on.
  // Both sides use the same offset so Left/Right are equidistant from their grid borders.
  const leftLabelCenterX = grid.x - rotatedLabelCenterOffset
  const rightLabelCenterX = grid.x + grid.width + rotatedLabelCenterOffset

  doc.text(labels.back, gridCenterX, grid.y - horizontalLabelOffset, textOptions)
  doc.text(
    labels.front,
    gridCenterX,
    grid.y + grid.height + horizontalLabelOffset,
    textOptions,
  )

  // jsPDF's align:"center" is unreliable with rotated text: the centering offset is applied
  // in page-horizontal space *before* the rotation matrix, which shifts the label
  // perpendicular to its reading direction by half the text width (so the gap from the grid
  // changes with text length). Instead anchor manually with align:"left" and account for the
  // rotated baseline ourselves so the visual center is fixed regardless of text length.
  const leftLabelWidth = doc.getTextWidth(labels.left)
  const rightLabelWidth = doc.getTextWidth(labels.right)

  // Left label reads bottom-to-top (angle 90): the ascender direction maps to -X, so the
  // visual center sits baselineToVisualCenter to the left of the baseline anchor. Text grows
  // upward from the anchor, so offsetting the anchor by +width/2 centers it on the grid.
  doc.text(
    labels.left,
    leftLabelCenterX + baselineToVisualCenter,
    gridCenterY + leftLabelWidth / 2,
    { align: 'left', baseline: 'alphabetic', angle: 90 },
  )
  // Right label reads top-to-bottom (angle 270): the ascender direction maps to +X, and text
  // grows downward from the anchor, so the offsets are mirrored.
  doc.text(
    labels.right,
    rightLabelCenterX - baselineToVisualCenter,
    gridCenterY - rightLabelWidth / 2,
    { align: 'left', baseline: 'alphabetic', angle: 270 },
  )
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

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
  doc.setLineWidth(PDF_GRID_BORDER_WIDTH)
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
    const end = {
      x: grid.x + (line.toX / booth.width) * grid.width,
      y: grid.y + ((booth.depth - line.toY) / booth.depth) * grid.height,
    }
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
    const point = {
      x: grid.x + (marker.x / booth.width) * grid.width,
      y: grid.y + ((booth.depth - marker.y) / booth.depth) * grid.height,
    }
    const { horizontalSide, verticalSide, horizontalDistance, verticalDistance } =
      getEdgeDistances(marker.x, marker.y, booth)
    // Convert nearest-side names to PDF pixel coordinates.
    // The booth y-axis is flipped in PDF space: front (y=0) maps to the grid bottom.
    const horizontalEdgeX = horizontalSide === 'left' ? grid.x : grid.x + grid.width
    const verticalEdgeY = verticalSide === 'front' ? grid.y + grid.height : grid.y
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
    const point = {
      x: grid.x + (marker.x / booth.width) * grid.width,
      y: grid.y + ((booth.depth - marker.y) / booth.depth) * grid.height,
    }
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

// ---------------------------------------------------------------------------
// Footer, legend, tables
// ---------------------------------------------------------------------------

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

  const pageWidth = doc.internal.pageSize.getWidth()
  const maxX = pageWidth - PDF_MARGIN
  let cursorX = x
  let cursorY = y + PDF_LEGEND_ROW_GAP
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
    const iconWidth = item.kind === 'line' ? PDF_LEGEND_ICON_SIZE + 3 : PDF_LEGEND_ICON_SIZE
    const labelX = cursorX + iconWidth + PDF_LEGEND_ICON_LABEL_GAP
    const itemWidth = iconWidth + PDF_LEGEND_ICON_LABEL_GAP + doc.getTextWidth(item.label)
    if (cursorX > x && cursorX + itemWidth > maxX) {
      cursorX = x
      cursorY += PDF_LEGEND_ROW_GAP
    }
    const [r, g, b] = hexToRgb(item.color)
    doc.setFillColor(r, g, b)
    doc.setDrawColor(r, g, b)
    if (item.kind === 'line') {
      doc.setLineWidth(1.4)
      const lineY = cursorY - 3
      doc.line(cursorX, lineY, cursorX + iconWidth, lineY)
      doc.circle(cursorX + iconWidth, lineY, 2.3, 'F')
    } else {
      drawPdfMarkerShape(doc, item.type, cursorX + PDF_LEGEND_ICON_SIZE / 2, cursorY - 3, PDF_LEGEND_ICON_SIZE, 'F')
    }
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(55, 65, 81)
    doc.setFontSize(7.5)
    doc.text(item.label, labelX, cursorY)
    cursorX += itemWidth + PDF_LEGEND_ITEM_GAP
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

// ---------------------------------------------------------------------------
// Detail tables
// ---------------------------------------------------------------------------

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
      if (fromMarker) {
        // Number against the markers shown on this PDF page (e.g. the electrical
        // list), so the table reference matches the number drawn on the grid.
        const pageIndex = planner.markers.findIndex((m) => m.id === fromMarker.id)
        connectedId = pageIndex >= 0 ? `Marker ${pageIndex + 1}` : markerDisplay(fromMarker.type).label
        connectedType = markerDisplay(fromMarker.type).label
      }
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

// ---------------------------------------------------------------------------
// Page assembly
// ---------------------------------------------------------------------------

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
    `Booth #: ${planner.booth.boothNumber || '-'} | Booth Size: ${planner.booth.width}ft x ${planner.booth.depth}ft | Booth Type: ${planner.booth.boothType || '-'} | Flooring: ${planner.booth.flooring}`,
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
      title: 'Internet',
      markers: wifiMarkers,
      lines: [],
      drawDetails: drawMarkerDetails('Internet Details', drawWifiTable),
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

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function exportPlannerPdf(planner: PlannerState) {
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
