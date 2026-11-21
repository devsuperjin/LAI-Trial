import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { useId, type ReactNode } from 'react'

/** Scope selection IDs per control, so unrelated menus never animate into one another. */
export function SelectionGroup({ children }: { children: ReactNode }) {
  const id = useId()
  return <LayoutGroup id={id}>{children}</LayoutGroup>
}
export function SelectionIndicator({ className = 'rounded-md bg-fd-secondary' }: { className?: string }) {
  const reduced = useReducedMotion()
  return <motion.span aria-hidden initial={false} layoutId={reduced ? undefined : 'selection'} transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }} className={`pointer-events-none absolute inset-0 ${className}`} />
}
