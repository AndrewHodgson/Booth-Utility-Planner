import { Wifi } from 'lucide-react'
import { type MarkerType } from '../lib/plannerUtils'

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

export function MarkerTypeIcon({
  type,
  size = 15,
  number,
}: {
  type: MarkerType
  size?: number
  number?: number
}) {
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
