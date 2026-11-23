import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

const POSITION_KEY = 'phone-preview.button'
const SIZE = 56
const MARGIN = 12
const DRAG_THRESHOLD = 4

interface Point {
  x: number
  y: number
}

function clampToViewport(point: Point): Point {
  const maxX = Math.max(MARGIN, window.innerWidth - SIZE - MARGIN)
  const maxY = Math.max(MARGIN, window.innerHeight - SIZE - MARGIN)

  return {
    x: Math.min(Math.max(point.x, MARGIN), maxX),
    y: Math.min(Math.max(point.y, MARGIN), maxY),
  }
}

function readPosition(): Point {
  const fallback = {
    x: window.innerWidth - SIZE - 24,
    y: window.innerHeight - SIZE - 24,
  }

  try {
    const raw = window.localStorage.getItem(POSITION_KEY)
    if (!raw) return clampToViewport(fallback)

    const parsed = JSON.parse(raw) as Partial<Point>
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
      return clampToViewport(fallback)
    }

    return clampToViewport({ x: parsed.x, y: parsed.y })
  } catch {
    return clampToViewport(fallback)
  }
}

interface DraggableRestoreButtonProps {
  dark: boolean
  onRestore: () => void
}

/**
 * Floating "back to the phone" control for fill mode. Drag it anywhere; a click
 * without movement restores the frame. It lives in the simulator chrome, so it
 * can never appear inside the app being tested.
 */
export default function DraggableRestoreButton({ dark, onRestore }: DraggableRestoreButtonProps) {
  const [position, setPosition] = useState<Point>(() => readPosition())
  const drag = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(POSITION_KEY, JSON.stringify(position))
    } catch {
      // Private browsing; position simply is not remembered.
    }
  }, [position])

  useEffect(() => {
    const onResize = () => setPosition((current) => clampToViewport(current))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current
    if (!state) return

    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY

    if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return

    state.moved = true
    setPosition(clampToViewport({ x: state.originX + dx, y: state.originY + dy }))
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current
    drag.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (!state?.moved) onRestore()
  }

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      // Keyboard activation arrives as a click with detail 0; pointer clicks are
      // already handled on pointerup.
      if (event.detail === 0) onRestore()
    },
    [onRestore],
  )

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      aria-label="Show the phone frame"
      data-theme={dark ? 'dark' : 'light'}
      style={{ left: position.x, top: position.y, width: SIZE, height: SIZE }}
      className="preview-return fixed z-50 grid touch-none select-none place-items-center rounded-full border border-forest-200 bg-white/95 text-charcoal shadow-xl backdrop-blur transition-colors hover:bg-white active:cursor-grabbing"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
        <path d="M10.5 18.5h3" strokeLinecap="round" />
      </svg>
    </button>
  )
}
