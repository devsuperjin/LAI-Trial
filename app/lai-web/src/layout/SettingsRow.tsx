import type { ReactNode } from 'react'

/** Responsive settings rows keep labels and controls aligned across a panel. */
export function SettingsRow({ label, description, children }: {
  label: string
  description: string
  children: ReactNode
}) {
  return <div className="grid items-center gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-8">
    <div className="min-w-0">
      <h3 className="text-sm font-medium">{label}</h3>
      <p className="mt-1 text-xs leading-5 text-fd-muted-foreground">{description}</p>
    </div>
    <div className="flex items-center sm:justify-end">{children}</div>
  </div>
}
