import { useEffect, useRef, useState } from 'react'

export function SideLabel({
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
