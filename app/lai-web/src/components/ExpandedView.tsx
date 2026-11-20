import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../i18n.tsx'

/** Move a stable portal host between inline and modal views without resetting child state. */
export function ExpandedView({ expanded, onClose, title, children }: { expanded: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { t } = useLanguage()
  const titleId = useId()
  const inline = useRef<HTMLDivElement>(null)
  const modalBody = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const [host] = useState(() => { const node = document.createElement('div'); node.className = 'h-full min-h-0'; return node })
  useLayoutEffect(() => {
    const target = expanded ? modalBody.current : inline.current
    target?.append(host)
    const node = dialog.current!
    if (expanded && !node.open) node.showModal()
    else if (!expanded && node.open) node.close()
  }, [expanded, host])
  useEffect(() => {
    const node = dialog.current
    return () => { node?.close(); host.remove() }
  }, [host])
  return <>
    <div ref={inline} className="h-full min-h-0" />
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }} className="m-auto h-[calc(100dvh-2rem)] max-h-none w-[calc(100vw-2rem)] max-w-none overflow-hidden rounded-xl border border-fd-border bg-fd-card p-0 text-fd-foreground shadow-2xl backdrop:bg-black/50">
      <div className="flex h-full min-h-0 flex-col"><header className="flex shrink-0 items-center gap-3 border-b border-fd-border px-4 py-3"><h2 id={titleId} className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2><button type="button" aria-label={t('Close')} title={t('Close')} onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-fd-muted-foreground hover:bg-fd-secondary hover:text-fd-foreground focus-visible:outline-2 focus-visible:outline-fd-primary"><svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg></button></header><div ref={modalBody} className="min-h-0 flex-1 overflow-hidden" /></div>
    </dialog>
    {createPortal(children, host)}
  </>
}
