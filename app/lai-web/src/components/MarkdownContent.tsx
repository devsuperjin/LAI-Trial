import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownContent({ children }: { children: string }) {
  return <div className="lai-markdown min-w-0 text-sm leading-relaxed"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div>,
    // Result text must not silently make remote image requests.
    img: ({ alt }) => <span>{alt}</span>,
  }}>{children}</Markdown></div>
}
