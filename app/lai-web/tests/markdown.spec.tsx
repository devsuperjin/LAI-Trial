import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { MarkdownContent } from '../src/components/MarkdownContent.tsx'
it('renders Markdown blocks, emphasis, code, links and GFM tables', () => {
  const html = renderToStaticMarkup(createElement(MarkdownContent, { children: '# Report\n\n- **Failed** stage\n\n```sh\npnpm check\n```\n\n| Stage | Result |\n| --- | --- |\n| Triage | Failed |\n\n[Evidence](https://example.com)' }))
  for (const value of ['<h1>Report</h1>', '<ul>', '<strong>Failed</strong>', '<pre>', '<table>', 'rel="noopener noreferrer"']) expect(html).toContain(value)
})
it('does not execute embedded HTML, unsafe links or remote images', () => {
  const html = renderToStaticMarkup(createElement(MarkdownContent, { children: '<script>alert(1)</script>\n\n[bad](javascript:alert)\n\n![evidence](https://example.com/track.png)' }))
  expect(html).not.toContain('<script')
  expect(html).not.toContain('href="javascript:')
  expect(html).not.toContain('<img')
})
