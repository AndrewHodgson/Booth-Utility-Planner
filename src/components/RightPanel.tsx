import { Download, RotateCcw, Trash2, Upload, X } from 'lucide-react'
import {
  type MarkerType,
  type BoothType,
  type FlooringValue,
  type UtilityMarker,
  type UtilityLine,
  BOOTH_TYPES,
  FLOORING_OPTIONS,
  markerOptions,
  markerDisplay,
  formatAmps,
  formatFeet,
  getEdgeDistances,
  getMarkerShapeNumber,
  getValidAmp,
  getAmpOptions,
  getLineLabel,
  lineLocation,
  isElectrical,
} from '../lib/plannerUtils'
import type { BoothDetails, PlannerState } from '../App'
import { TextField } from './TextField'
import { NumberField, PanelSection } from './PanelFields'

const sourceOneLogoPath = '/SourceOne-Logo-RGB.svg'

export function RightPanel({
  isMobileDrawerOpen = false,
  onMobileDrawerClose,
  planner,
  selectedMarker,
  selectedLine,
  exportStatus,
  uploadError,
  saveError,
  renderRatioMismatch,
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
  isMobileDrawerOpen?: boolean
  onMobileDrawerClose?: () => void
  planner: PlannerState
  selectedMarker?: UtilityMarker
  selectedLine?: UtilityLine
  exportStatus: string
  uploadError: string
  saveError: string
  renderRatioMismatch: boolean
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
    <aside className={`right-panel ${isMobileDrawerOpen ? 'is-mobile-drawer-open' : ''}`}>
      <div className="panel-header">
        <img className="panel-logo" src={sourceOneLogoPath} alt="SourceOne Events" />
        <div className="panel-title">
          <h2>Booth Utility Planner</h2>
        </div>
        {onMobileDrawerClose && (
          <button
            type="button"
            className="panel-close-button"
            aria-label="Close planner menu"
            onClick={onMobileDrawerClose}
          >
            <X size={18} />
          </button>
        )}
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
          <label className="field-group">
            <span className="field-label">Flooring</span>
            <select
              value={booth.flooring}
              onChange={(event) => setBoothField('flooring', event.target.value as FlooringValue)}
            >
              {FLOORING_OPTIONS.map((option) => <option key={option}>{option}</option>)}
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
                  {markerOptions
                    .filter((option) => option.type !== 'hanging_sign' && option.type !== 'custom_drop')
                    .map((option) => (
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
            {(() => {
              if (selectedLine.fromMarkerId) {
                const sourceMarker = planner.markers.find((marker) => marker.id === selectedLine.fromMarkerId)
                if (!sourceMarker) {
                  return <div className="coordinate-readout">Connected to: source removed</div>
                }
                const number = getMarkerShapeNumber(sourceMarker, planner.markers)
                const typeLabel = markerDisplay(sourceMarker.type).label
                return (
                  <div className="coordinate-readout">
                    Connected to: {number ? `Marker ${number} - ` : ''}
                    {typeLabel}
                  </div>
                )
              }
              if (selectedLine.fromLineId) {
                const sourceIndex = planner.lines.findIndex((line) => line.id === selectedLine.fromLineId)
                const sourceLine = sourceIndex >= 0 ? planner.lines[sourceIndex] : undefined
                return (
                  <div className="coordinate-readout">
                    Connected to:{' '}
                    {sourceLine ? `Extension Cord ${getLineLabel(sourceLine, sourceIndex)} endpoint` : 'extension cord endpoint'}
                  </div>
                )
              }
              return <div className="coordinate-readout">Connected to: -</div>
            })()}
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
        {renderRatioMismatch && (
          <p className="upload-error" role="alert">
            Booth dimensions changed. Re-upload or re-crop the booth image for the correct ratio.
          </p>
        )}
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
        {saveError && <p className="upload-error" role="alert">{saveError}</p>}
        <button type="button" className="reset-button" onClick={onReset}>
          <RotateCcw size={14} />
          Reset planner
        </button>
      </footer>
    </aside>
  )
}
