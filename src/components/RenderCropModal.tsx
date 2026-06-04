import { useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { RotateCcw, RotateCw } from 'lucide-react'
import { createCroppedImageDataUrl } from '../utils/cropImage'
import type { RenderCropRequest } from '../App'

export function RenderCropModal({
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
