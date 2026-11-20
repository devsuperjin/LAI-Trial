import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Portal avoids clipping by the content scroller; position stays within the viewport. */
export function HelpTip({ text }: { text: string }) {
  const id = useId()
  const anchor = useRef<HTMLButtonElement>(null)
  const tip = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      if (!anchor.current || !tip.current) return
      const a = anchor.current.getBoundingClientRect(), b = tip.current.getBoundingClientRect()
      const left = Math.max(12, Math.min(a.left + a.width / 2 - b.width / 2, window.innerWidth - b.width - 12))
      const top = a.bottom + 8 + b.height <= window.innerHeight - 12 ? a.bottom + 8 : Math.max(12, a.top - b.height - 8)
      setPosition({ left, top })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, text])
  return <span className="inline-flex shrink-0 align-middle" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button ref={anchor} type="button" aria-label={text} aria-describedby={open ? id : undefined} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)} onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }} className="flex h-5 w-5 items-center justify-center rounded-full text-fd-muted-foreground hover:text-fd-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-fd-primary"><svg aria-hidden width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7.5" /><path d="M7.8 7.5a2.3 2.3 0 0 1 4.4.8c0 1.5-2.2 1.7-2.2 3.2" /><circle cx="10" cy="14" r=".7" fill="currentColor" stroke="none" /></svg></button>
    {open && createPortal(<span ref={tip} id={id} role="tooltip" style={position} className="pointer-events-none fixed z-[1000] w-64 max-w-[calc(100vw-24px)] rounded-lg border border-fd-border bg-fd-card px-3 py-2 text-left text-xs font-normal leading-5 text-fd-foreground shadow-lg">{text}</span>, document.body)}
  </span>
}
