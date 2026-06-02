export type CropPixels = {
  x: number
  y: number
  width: number
  height: number
}

export type ImageOutputSize = {
  width: number
  height: number
}

function getRadianAngle(degrees: number) {
  return (degrees * Math.PI) / 180
}

function getRotatedSize(width: number, height: number, rotation: number) {
  const radians = getRadianAngle(rotation)

  return {
    width: Math.abs(Math.cos(radians) * width) + Math.abs(Math.sin(radians) * height),
    height: Math.abs(Math.sin(radians) * width) + Math.abs(Math.cos(radians) * height),
  }
}

function loadImage(imageSrc: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.addEventListener('load', () => resolve(image), { once: true })
    image.addEventListener('error', reject, { once: true })
    image.src = imageSrc
  })
}

export async function createCroppedImageDataUrl(
  imageSrc: string,
  cropPixels: CropPixels,
  outputSize: ImageOutputSize,
  rotation = 0,
) {
  const image = await loadImage(imageSrc)
  const rotatedSize = getRotatedSize(image.width, image.height, rotation)
  const rotatedCanvas = document.createElement('canvas')
  const rotatedContext = rotatedCanvas.getContext('2d')
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!rotatedContext || !context) {
    throw new Error('Unable to crop image.')
  }

  rotatedCanvas.width = rotatedSize.width
  rotatedCanvas.height = rotatedSize.height
  rotatedContext.translate(rotatedSize.width / 2, rotatedSize.height / 2)
  rotatedContext.rotate(getRadianAngle(rotation))
  rotatedContext.drawImage(image, -image.width / 2, -image.height / 2)

  canvas.width = outputSize.width
  canvas.height = outputSize.height

  context.drawImage(
    rotatedCanvas,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    outputSize.width,
    outputSize.height,
  )

  return canvas.toDataURL('image/jpeg', 0.92)
}

export async function createFadedImageDataUrl(
  imageSrc: string,
  opacity: number,
  outputSize: ImageOutputSize,
) {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Unable to prepare background image.')
  }

  canvas.width = outputSize.width
  canvas.height = outputSize.height
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.globalAlpha = opacity
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/jpeg', 0.92)
}
