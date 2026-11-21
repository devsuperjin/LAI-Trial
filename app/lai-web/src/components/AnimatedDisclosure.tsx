import { useAppearance } from '../appearance.tsx'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState, type ReactNode } from 'react'

export function AnimatedDisclosure({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const { reduceMotion: reduced } = useAppearance()
  return <section className={className}><button id={`${id}-trigger`} type="button" aria-expanded={open} aria-controls={`${id}-content`} onClick={() => setOpen(value => !value)} className="flex w-full items-center gap-1 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-fd-primary"><motion.svg aria-hidden width="12" height="12" viewBox="0 0 16 16" fill="currentColor" animate={{ rotate: open ? 90 : 0 }} transition={{ duration: reduced ? 0 : .18 }}><path d="m4 2 8 6-8 6Z" /></motion.svg>{title}</button><AnimatePresence initial={false}>{open && <motion.div id={`${id}-content`} role="region" aria-labelledby={`${id}-trigger`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : .2, ease: 'easeInOut' }} className="overflow-hidden"><div className="pt-2">{children}</div></motion.div>}</AnimatePresence></section>
}
