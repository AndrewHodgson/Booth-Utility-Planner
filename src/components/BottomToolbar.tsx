import { useState, type CSSProperties } from 'react'
import { Hand, Maximize2, MousePointer2, Plus, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import { type MarkerType, markerOptions, markerColors } from '../lib/plannerUtils'
import { MarkerTypeIcon } from './MarkerTypeIcon'

// Minimum zoom level — must match MIN_ZOOM in App.tsx.
const MIN_ZOOM = 1

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

function getMobilePickerLabel(type: MarkerType): string {
  switch (type) {
    case '120v': return '120 V 1 Phase'
    case '208v_single_phase': return '208 V 1 Phase'
    case '208v_three_phase': return '208 V 3 Phase'
    case '480v_three_phase': return '480 V 3 Phase'
    case 'wifi': return 'Internet'
    case 'hanging_sign': return 'Hanging Sign'
    case 'custom_drop': return 'Custom'
  }
}

function getToolbarLabelLines(type: MarkerType) {
  switch (type) {
    case '120v':
      return ['120 V', '1 Phase']
    case '208v_single_phase':
      return ['208 V', '1 Phase']
    case '208v_three_phase':
      return ['208 V', '3 Phase']
    case '480v_three_phase':
      return ['480 V', '3 Phase']
    case 'hanging_sign':
      return ['Hanging', 'Sign']
    case 'custom_drop':
      return ['Custom', 'Marker']
    case 'wifi':
      return ['Internet']
  }
}

export function BottomToolbar({
  selectedTool,
  zoom,
  isPanMode,
  isPointerMode,
  isLineMode,
  selectedMarkerId,
  selectedLineId,
  onSelectTool,
  onSelectLineTool,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onTogglePan,
  onSelectPointer,
  onDeleteSelected,
}: {
  selectedTool: MarkerType
  zoom: number
  isPanMode: boolean
  isPointerMode: boolean
  isLineMode: boolean
  selectedMarkerId: string | null
  selectedLineId: string | null
  onSelectTool: (tool: MarkerType) => void
  onSelectLineTool: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onTogglePan: () => void
  onSelectPointer: () => void
  onDeleteSelected: () => void
}) {
  const [isMarkerPickerOpen, setIsMarkerPickerOpen] = useState(false)
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

  const isMarkerMode = !isPanMode && !isPointerMode && !isLineMode

  function selectMobileMarker(type: MarkerType) {
    onSelectTool(type)
    setIsMarkerPickerOpen(false)
  }

  return (
    <nav className="bottom-toolbar" aria-label="Utility placement tools">
      <div className="desktop-toolbar-content">
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
            <button
              type="button"
              className="toolbar-button toolbar-button-compact"
              title="Delete selected"
              aria-label="Delete selected item"
              disabled={!selectedMarkerId && !selectedLineId}
              onClick={onDeleteSelected}
            >
              <Trash2 size={16} />
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
      </div>

      <div className="mobile-toolbar-content">
        {isMarkerPickerOpen && (
          <div className="mobile-picker" role="menu" aria-label="Marker types">
            <p className="mobile-picker-section-label">Power &amp; Cords</p>
            <div className="mobile-picker-section">
              {markerToolsBeforeLine.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  className={`mobile-picker-option ${isMarkerMode && selectedTool === option.type ? 'is-active' : ''}`}
                  style={{ '--active-color': markerColors[option.type] } as CSSProperties}
                  onClick={() => selectMobileMarker(option.type)}
                  role="menuitem"
                >
                  <MarkerTypeIcon type={option.type} size={15} />
                  <span>{getMobilePickerLabel(option.type)}</span>
                </button>
              ))}
              <button
                type="button"
                className={`mobile-picker-option ${isLineMode ? 'is-active' : ''}`}
                onClick={() => {
                  onSelectLineTool()
                  setIsMarkerPickerOpen(false)
                }}
                role="menuitem"
              >
                <LineToolIcon size={15} />
                <span>Extension Cord</span>
              </button>
            </div>
            <hr className="mobile-picker-divider" aria-hidden="true" />
            <p className="mobile-picker-section-label">Additional Utilities</p>
            <div className="mobile-picker-section">
              {markerToolsAfterLine.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  className={`mobile-picker-option ${isMarkerMode && selectedTool === option.type ? 'is-active' : ''}`}
                  style={{ '--active-color': markerColors[option.type] } as CSSProperties}
                  onClick={() => selectMobileMarker(option.type)}
                  role="menuitem"
                >
                  <MarkerTypeIcon type={option.type} size={15} />
                  <span>{getMobilePickerLabel(option.type)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="toolbar-group mobile-canvas-group">
          <span className="toolbar-group-label">Canvas Tools</span>
          <div className="toolbar-group-controls">
            <button
              type="button"
              className={`toolbar-button toolbar-button-compact ${isPointerMode ? 'is-active' : ''}`}
              title="Pointer / Select (1)"
              aria-label="Pointer / Select, shortcut 1"
              onClick={() => {
                onSelectPointer()
                setIsMarkerPickerOpen(false)
              }}
            >
              <span className="shortcut-badge">1</span>
              <MousePointer2 size={17} />
            </button>
            <button
              type="button"
              className={`toolbar-button toolbar-button-compact ${isPanMode ? 'is-active' : ''}`}
              title="Pan canvas (2)"
              aria-label="Pan canvas, shortcut 2"
              onClick={() => {
                onTogglePan()
                setIsMarkerPickerOpen(false)
              }}
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
            <button
              type="button"
              className="toolbar-button toolbar-button-compact"
              title="Delete selected"
              aria-label="Delete selected item"
              disabled={!selectedMarkerId && !selectedLineId}
              onClick={() => {
                onDeleteSelected()
                setIsMarkerPickerOpen(false)
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="toolbar-group toolbar-group-separated mobile-marker-group">
          <span className="toolbar-group-label">Utilities</span>
          <div className="toolbar-group-controls">
            <button
              type="button"
              className={`toolbar-button toolbar-tool-button mobile-markers-button ${
                isMarkerPickerOpen || isMarkerMode || isLineMode ? 'is-active' : ''
              }`}
              onClick={() => setIsMarkerPickerOpen((current) => !current)}
              aria-expanded={isMarkerPickerOpen}
            >
              <Plus size={17} />
              <span>Markers</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
