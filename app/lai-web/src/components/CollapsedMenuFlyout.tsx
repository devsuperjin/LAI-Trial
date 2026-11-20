import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../i18n.tsx'
import type { MenuGroup, Page } from '../router/routes.tsx'

/** A portalled submenu with a hover bridge, delayed exit and keyboard navigation. */
export function CollapsedMenuFlyout({ group, page, onNavigate }: { group: MenuGroup; page: Page; onNavigate: (page: Page) => void }) {
  const { t } = useLanguage()
  const anchor = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const suppressFocus = useRef(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const active = group.children.some(child => child.id === page)
  const id = `${group.id}-flyout`
  function keepOpen() { clearTimeout(timer.current) }
  function hideSoon() { keepOpen(); timer.current = setTimeout(() => setPosition(null), 160) }
  function show() {
    keepOpen()
    const rect = anchor.current!.getBoundingClientRect()
    const height = group.children.length * 40 + 52
    setPosition({ left: rect.right, top: Math.max(8, Math.min(rect.top, window.innerHeight - height - 8)) })
  }
  function blur(target: EventTarget | null) {
    if (target instanceof Node && (popup.current?.contains(target) || anchor.current?.contains(target))) return
    hideSoon()
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => { setPosition(null) }, [page])
  useEffect(() => {
    if (!position) return
    const close = () => setPosition(null)
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!popup.current?.contains(target) && !anchor.current?.contains(target)) close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault(); close()
      if (document.activeElement !== anchor.current) { suppressFocus.current = true; anchor.current?.focus() }
    }
    const scroll = (event: Event) => { if (!(event.target instanceof Node) || !popup.current?.contains(event.target)) close() }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    document.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
      document.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', close)
    }
  }, [position])
  return <><button ref={anchor} type="button" aria-label={t(group.name)} aria-haspopup="menu" aria-expanded={!!position} aria-controls={position ? id : undefined} onMouseEnter={show} onMouseLeave={hideSoon} onFocus={() => { if (suppressFocus.current) suppressFocus.current = false; else show() }} onBlur={event => blur(event.relatedTarget)} onClick={show} onKeyDown={event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); show(); requestAnimationFrame(() => popup.current?.querySelector<HTMLButtonElement>('button')?.focus()) }
  }} className={`flex min-h-10 w-full items-center justify-center rounded-lg px-3 py-2 text-sm hover:bg-fd-secondary focus-visible:outline-2 focus-visible:outline-fd-primary ${active || position ? 'text-fd-primary' : 'text-fd-muted-foreground'}`}>{group.icon()}</button>
    {position && createPortal(<div ref={popup} style={{ left: position.left, top: position.top }} className="fixed z-50 w-[min(15rem,calc(100vw-4rem))] pl-2" onMouseEnter={keepOpen} onMouseLeave={hideSoon} onFocus={keepOpen} onBlur={event => blur(event.relatedTarget)}><div id={id} role="menu" aria-label={t(group.name)} className="fd-scroll max-h-[calc(100vh-1rem)] overflow-y-auto rounded-xl border border-fd-border bg-fd-card p-1.5 text-fd-foreground shadow-xl" onKeyDown={event => {
      const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
      if (!keys.includes(event.key)) return
      event.preventDefault()
      const buttons = [...popup.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
      buttons[index]?.focus()
    }}><div className="px-3 py-2 text-xs font-medium text-fd-muted-foreground">{t(group.name)}</div>{group.children.map(item => <button key={item.id} type="button" role="menuitem" aria-current={page === item.id ? 'page' : undefined} onClick={() => { setPosition(null); onNavigate(item.id) }} className={`flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-fd-primary ${page === item.id ? 'bg-fd-primary/10 font-medium text-fd-primary' : 'hover:bg-fd-secondary'}`}>{t(item.name)}</button>)}</div></div>, document.body)}
  </>
}
