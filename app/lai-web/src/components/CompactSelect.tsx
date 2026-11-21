import { useLayoutEffect, useId, useRef, useState } from 'react'

/** Small selection menu in the top layer, so narrow panes cannot clip it. */
export function CompactSelect<T extends string>({ value, options, label, onChange }: {
  value: T
  options: readonly { value: T; label: string }[]
  label: string
  onChange: (value: T) => void
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  function show(focus = false) {
    const rect = trigger.current!.getBoundingClientRect()
    const node = menu.current!
    node.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 184))}px`
    node.style.top = `${rect.bottom + 6}px`
    node.style.width = `${Math.max(144, Math.min(176, rect.width))}px`
    node.showPopover()
    if (focus) node.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
  }
  useLayoutEffect(() => {
    const node = menu.current!
    node.setAttribute('popover', 'auto')
    const sync = () => setOpen(node.matches(':popover-open'))
    node.addEventListener('toggle', sync)
    const close = () => menu.current?.hidePopover()
    const scroll = (event: Event) => { if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) close() }
    window.addEventListener('resize', close)
    document.addEventListener('scroll', scroll, true)
    const observer = new ResizeObserver(close)
    observer.observe(trigger.current!)
    return () => { node.removeEventListener('toggle', sync); window.removeEventListener('resize', close); document.removeEventListener('scroll', scroll, true); observer.disconnect() }
  }, [])
  return <>
    <button ref={trigger} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id}
      className={`flex h-8 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2.5 text-xs font-medium outline-none transition-colors hover:bg-fd-secondary focus-visible:ring-1 focus-visible:ring-fd-primary ${open ? 'bg-fd-secondary text-fd-primary' : 'bg-fd-secondary/60 text-fd-foreground'}`}
      onClick={() => { if (open) menu.current?.hidePopover(); else show() }}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(true) } }}>
      <span className="truncate">{options.find(option => option.value === value)?.label}</span>
      <svg aria-hidden width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}><path d="m4 6 4 4 4-4" /></svg>
    </button>
    <div ref={menu} id={id} role="menu" aria-label={label}
      className="fixed inset-auto m-0 rounded-xl border border-fd-border bg-fd-card p-1 text-fd-foreground shadow-lg outline-none"
      onKeyDown={event => {
        const buttons = [...menu.current!.querySelectorAll<HTMLButtonElement>('button')]
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'ArrowDown' ? (current + 1) % buttons.length : event.key === 'ArrowUp' ? (current - 1 + buttons.length) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : null
        if (next !== null) { event.preventDefault(); buttons[next]?.focus() }
      }}>
      {options.map(option => <button key={option.value} type="button" role="menuitemradio" aria-checked={option.value === value} onClick={() => { onChange(option.value); menu.current?.hidePopover(); trigger.current?.focus() }} className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs outline-none hover:bg-fd-secondary focus-visible:bg-fd-secondary ${option.value === value ? 'bg-fd-primary/5 font-medium text-fd-primary' : ''}`}><span>{option.label}</span><svg aria-hidden width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className={option.value === value ? '' : 'invisible'}><path d="m3 8 3 3 7-7" /></svg></button>)}
    </div>
  </>
}
