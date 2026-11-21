import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLanguage } from '../i18n.tsx'

const DEFAULT_RATIO = .28
export function ResizableSplitView({ left, right, storageKey }: { left: ReactNode; right: ReactNode; storageKey: string }) {
  const { t } = useLanguage()
  const root = useRef<HTMLDivElement>(null)
  const id = useId()
  const [width, setWidth] = useState(0)
  const [ratio, setRatio] = useState(() => {
    try { const saved = Number(localStorage.getItem(storageKey)); if (saved > 0 && saved < 1) return saved } catch { /* Storage is optional. */ }
    return DEFAULT_RATIO
  })
  const [dragging, setDragging] = useState(false)
  const max = Math.max(160, Math.min(width * .65, width - 320))
  const min = Math.min(200, max)
  const leftWidth = Math.round(Math.max(min, Math.min(max, width * ratio)))
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(entry.contentRect.width) })
    observer.observe(root.current!)
    return () => observer.disconnect()
  }, [])
  useEffect(() => { try { localStorage.setItem(storageKey, String(ratio)) } catch { /* Storage is optional. */ } }, [ratio, storageKey])
  useEffect(() => {
    if (!dragging) return
    const { cursor, userSelect } = document.body.style
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'
    return () => { document.body.style.cursor = cursor; document.body.style.userSelect = userSelect }
  }, [dragging])
  function resize(pixels: number) { if (width) setRatio(Math.max(min, Math.min(max, pixels)) / width) }
  return <div ref={root} style={{ '--split-left': width ? `${leftWidth}px` : '28%' } as CSSProperties} className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 md:grid md:grid-cols-[minmax(0,var(--split-left))_12px_minmax(0,1fr)] md:gap-0">
    <div id={`${id}-list`} className="flex min-h-0 min-w-0 flex-col">{left}</div>
    <div role="separator" aria-label={t('Resize run panels')} aria-orientation="vertical" aria-controls={`${id}-list ${id}-detail`} aria-valuemin={Math.round(min)} aria-valuemax={Math.round(max)} aria-valuenow={leftWidth} tabIndex={0}
      className="group hidden touch-none select-none items-center justify-center rounded-md outline-none hover:bg-fd-primary/5 focus-visible:bg-fd-primary/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fd-primary md:flex md:cursor-col-resize"
      onDoubleClick={() => setRatio(DEFAULT_RATIO)}
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); setDragging(true) }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resize(event.clientX - root.current!.getBoundingClientRect().left - 6) }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setDragging(false) }}
      onPointerCancel={() => setDragging(false)} onLostPointerCapture={() => setDragging(false)}
      onKeyDown={event => { const next = event.key === 'ArrowLeft' ? leftWidth - 24 : event.key === 'ArrowRight' ? leftWidth + 24 : event.key === 'Home' ? min : event.key === 'End' ? max : null; if (next !== null) { event.preventDefault(); resize(next) } }}>
      <span className={`h-10 w-1 rounded-full transition-colors ${dragging ? 'bg-fd-primary' : 'bg-fd-border group-hover:bg-fd-primary/60 group-focus-visible:bg-fd-primary'}`} />
    </div>
    <div id={`${id}-detail`} className="flex min-h-0 min-w-0 flex-1 flex-col">{right}</div>
  </div>
}
