import { useLanguage } from '../i18n.tsx'
import type { ChildModel } from '../model/tree.ts'

type ToolCall = ChildModel['tools'][number]
export function ToolCallDetails({ tool, onClose }: { tool: ToolCall; onClose: () => void }) {
  const { t } = useLanguage()
  return <><header className="flex items-center gap-2 border-b border-fd-border px-2 py-1.5"><span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium">{tool.name}</span><span className={`text-[9px] ${tool.isError ? 'text-fd-danger' : 'text-fd-muted-foreground'}`}>{t(tool.pending ? 'Pending result' : tool.isError ? 'Tool failed' : 'Tool result')}</span><button type="button" onClick={onClose} aria-label={t('Close')} title={t('Close')} className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-fd-secondary focus-visible:outline-2 focus-visible:outline-fd-primary">×</button></header><div className="fd-scroll max-h-64 overflow-auto overscroll-contain p-2"><div className="mb-1 text-[9px] font-medium text-fd-muted-foreground">{t('Arguments')}</div><pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-fd-muted-foreground">{tool.preview}</pre><div className="mb-1 mt-2 border-t border-fd-border pt-2 text-[9px] font-medium text-fd-muted-foreground">{t('Tool result')}</div><pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed">{tool.pending ? t('Waiting for tool result…') : tool.result || t('Tool returned no text.')}</pre></div></>
}
