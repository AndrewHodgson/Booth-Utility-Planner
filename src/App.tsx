import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Menu } from 'lucide-react'
import { MarkerTypeIcon } from './components/MarkerTypeIcon'
import { BottomToolbar } from './components/BottomToolbar'
import { RightPanel } from './components/RightPanel'
import { SetupModal } from './components/SetupModal'
import { RenderCropModal } from './components/RenderCropModal'
import { GridLineLayer, MeasurementGuides, UtilityLineLayer, AmpPrompt } from './components/GridOverlays'
import { SideLabel } from './components/SideLabel'
import {
  createCroppedImageDataUrl,
} from './utils/cropImage'
import './App.css'
import {
  type MarkerType,
  type UtilityMarker,
  type UtilityLine,
  type BoothType,
  type FlooringValue,
  BOOTH_TYPES,
  FLOORING_OPTIONS,
  DEFAULT_FLOORING,
  clamp,
  isElectrical,
  markerOptions,
  markerColors,
  formatFeet,
  getLineLabel,
  getLineStartCoords,
  getMarkerShapeNumber,
  collectLineSubtree,
  migrateMarkerType,
  SNAP_FEET,
  getDefaultAmp,
  getValidAmp,
} from './lib/plannerUtils'
import { exportPlannerPdf } from './pdf/exportPlannerPdf'

// Map flooring values saved before the option list was renamed onto the current options.
const LEGACY_FLOORING_MAP: Record<string, FlooringValue> = {
  Carpeted: 'Flooring Ordered',
  'Not Carpeted': 'No Flooring Ordered',
  'Unknown / Not Provided': 'Unknown / Not Provided',
}

function sanitizeFlooring(value: unknown): FlooringValue {
  if (FLOORING_OPTIONS.includes(value as FlooringValue)) {
    return value as FlooringValue
  }
  if (typeof value === 'string' && LEGACY_FLOORING_MAP[value]) {
    return LEGACY_FLOORING_MAP[value]
  }
  return DEFAULT_FLOORING
}

export type BoothDetails = {
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
  flooring: FlooringValue
  sideLabels: {
    front: string
    back: string
    left: string
    right: string
  }
}

export type PlannerState = {
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

export type RenderCropRequest = {
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
const SOURCEONE_LOGO_PATH = '/SourceOne-Logo-RGB.svg'
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
  flooring: DEFAULT_FLOORING,
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

function snapFeet(value: number) {
  return Math.round(value / SNAP_FEET) * SNAP_FEET
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

function getGridMarkerDisplayLabel(type: MarkerType) {
  switch (type) {
    case '120v':
      return '120 V 1P'
    case '208v_single_phase':
      return '208 V 1P'
    case '208v_three_phase':
      return '208 V 3P'
    case '480v_three_phase':
      return '480 V 3P'
    case 'wifi':
      return 'WiFi'
    case 'hanging_sign':
      return 'Hanging'
    case 'custom_drop':
      return 'Custom'
  }
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
            const migratedType = migrateMarkerType(marker.type as string)
            if (!migratedType) {
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
        flooring: sanitizeFlooring(parsed.booth?.flooring),
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

function App() {
  const [planner, setPlanner] = useState<PlannerState>(() => readInitialState())
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [exportStatus, setExportStatus] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [saveError, setSaveError] = useState('')
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
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false)
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
  const renderRatioMismatch = planner.renderImage
    ? Math.abs(
        planner.renderImage.width / planner.renderImage.height -
          planner.booth.width / planner.booth.depth,
      ) /
        (planner.booth.width / planner.booth.depth) >
      ASPECT_RATIO_TOLERANCE
    : false

  const gridMetrics = useMemo(() => {
    const isLargeGrid =
      planner.booth.width > LARGE_GRID_THRESHOLD_FT ||
      planner.booth.depth > LARGE_GRID_THRESHOLD_FT
    const availableWidth = Math.max(260, stageSize.width - (stageSize.width < 700 ? 80 : 300))
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
    // Autosave is an external-system sync that can fail (e.g. localStorage quota
    // exceeded by a large booth image). We surface that failure via state so the
    // app keeps working; saveError is not an effect dependency, so this does not
    // re-trigger the effect or cascade.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(planner))
      // eslint-disable-next-line react-hooks/set-state-in-effect -- report external save result
      setSaveError('')
    } catch {
      setSaveError('Could not save changes locally. The booth image may be too large.')
    }
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
    // Compute the removed cord subtree from the rendered state so selection
    // cleanup matches what setPlanner removes below.
    const directLineIds = planner.lines.filter((l) => l.fromMarkerId === id).map((l) => l.id)
    const removedLineIds = collectLineSubtree(planner.lines, directLineIds)
    setPlanner((current) => {
      const currentDirect = current.lines.filter((l) => l.fromMarkerId === id).map((l) => l.id)
      const currentRemoved = collectLineSubtree(current.lines, currentDirect)
      return {
        ...current,
        markers: current.markers.filter((marker) => marker.id !== id),
        lines: current.lines.filter((line) => !currentRemoved.has(line.id)),
      }
    })
    setSelectedMarkerId((current) => (current === id ? null : current))
    setSelectedLineId((current) => (current && removedLineIds.has(current) ? null : current))
    setAmpPromptMarkerId((current) => (current === id ? null : current))
  }, [planner.lines])

  const deleteLine = useCallback((id: string) => {
    const removedLineIds = collectLineSubtree(planner.lines, [id])
    setPlanner((current) => {
      const currentRemoved = collectLineSubtree(current.lines, [id])
      return {
        ...current,
        lines: current.lines.filter((line) => !currentRemoved.has(line.id)),
      }
    })
    setSelectedLineId((current) => (current && removedLineIds.has(current) ? null : current))
  }, [planner.lines])

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
      {!isMobilePanelOpen && (
        <div className="mobile-topbar">
          <img className="mobile-logo" src={SOURCEONE_LOGO_PATH} alt="SourceOne Events" />
          <span className="mobile-topbar-title">Booth Utility Planner</span>
          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Open planner menu"
            onClick={() => setIsMobilePanelOpen(true)}
          >
            <Menu size={20} />
          </button>
        </div>
      )}

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
          selectedMarkerId={selectedMarkerId}
          selectedLineId={selectedLineId}
          onSelectTool={selectTool}
          onSelectLineTool={selectLineTool}
          onZoomIn={() => setZoomLevel(zoom + ZOOM_STEP)}
          onZoomOut={() => setZoomLevel(zoom - ZOOM_STEP)}
          onZoomReset={fitScreen}
          onTogglePan={togglePanMode}
          onSelectPointer={selectPointerMode}
          onDeleteSelected={() => {
            if (selectedMarkerId) deleteMarker(selectedMarkerId)
            else if (selectedLineId) deleteLine(selectedLineId)
          }}
        />
      </section>

      <RightPanel
        isMobileDrawerOpen={isMobilePanelOpen}
        onMobileDrawerClose={() => setIsMobilePanelOpen(false)}
        planner={planner}
        selectedMarker={selectedMarker}
        selectedLine={selectedLine}
        exportStatus={exportStatus}
        uploadError={uploadError}
        saveError={saveError}
        renderRatioMismatch={renderRatioMismatch}
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

export default App
