import { useId, useRef, useState, type ReactNode } from 'react'

type PickerOption = { value: string; label: string; detail?: string }
type PickerGroup = { label?: string; options: PickerOption[] }

export default function ToolbarSelect({ label, value, groups, onSelect, className, menuWidth, emptyLabel = '', icon, showTitle = true }: {
  label: string
  value: string
  groups: PickerGroup[]
  onSelect: (value: string) => void
  className: string
  menuWidth: number
  emptyLabel?: string
  icon?: ReactNode
  showTitle?: boolean
}) {
  const id = useId()
  const popover = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, width: menuWidth })
  const selectedLabel = groups.flatMap((group) => group.options).find((option) => option.value === value)?.label ?? emptyLabel
  const name = icon ? label : `${label}: ${selectedLabel}`

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={name}
        title={!icon && showTitle ? name : undefined}
        disabled={groups.every((group) => group.options.length === 0)}
        popoverTarget={id}
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          const width = Math.min(menuWidth, window.innerWidth - 16)
          const anchor = icon ? bounds.right - width : bounds.left
          setPosition({
            top: bounds.bottom + 8,
            left: Math.max(8, Math.min(anchor, window.innerWidth - width - 8)),
            width,
          })
        }}
      >
        {icon ?? (
          <>
            <span className="truncate">{selectedLabel}</span>
            <span aria-hidden="true" className="relative -top-0.5 h-2 w-2 shrink-0 rotate-45 border-b border-r border-current text-charcoal-soft" />
          </>
        )}
      </button>
      <div
        id={id}
        ref={popover}
        popover="auto"
        role="dialog"
        aria-label={label}
        style={position}
        className="theme-flyout fixed inset-auto m-0 max-h-[calc(100dvh-64px)] overflow-y-auto rounded-xl border border-forest-200 bg-white p-1 text-charcoal shadow-xl"
      >
        {groups.map((group) => (
          <div key={group.label ?? label} role={group.label ? 'group' : undefined} aria-label={group.label} className="not-first:mt-1">
            {group.label && <p aria-hidden="true" className="px-3 pb-1 pt-2 text-xs font-semibold text-charcoal-soft">{group.label}</p>}
            {group.options.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={value === option.value}
                autoFocus={value === option.value}
                onClick={() => {
                  onSelect(option.value)
                  popover.current?.hidePopover()
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-forest-50 aria-pressed:bg-forest-100 aria-pressed:font-semibold aria-pressed:text-forest-900"
              >
                {option.label}
                {option.detail && <span className="break-all text-xs font-normal text-charcoal-muted"> · {option.detail}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
