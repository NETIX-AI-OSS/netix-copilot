import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Markdown, parseBlocks } from '../components/markdown'

function html(text: string): string {
  const { container } = render(<Markdown text={text} />)
  return container.innerHTML
}

describe('parseBlocks', () => {
  it('splits headings, paragraphs and lists', () => {
    const blocks = parseBlocks('# Title\n\nSome text\n\n- one\n- two')
    expect(blocks.map((block) => block.kind)).toEqual(['heading', 'paragraph', 'list'])
  })

  it('keeps an unterminated fence as a code block so streaming code stays readable', () => {
    const blocks = parseBlocks('```sql\nSELECT 1')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ kind: 'code', closed: false, lines: ['SELECT 1'] })
  })

  it('marks a closed fence as closed', () => {
    const blocks = parseBlocks('```\nx\n```')
    expect(blocks[0]).toMatchObject({ kind: 'code', closed: true })
  })

  it('distinguishes ordered from unordered lists', () => {
    expect(parseBlocks('1. a\n2. b')[0]).toMatchObject({ kind: 'list', ordered: true })
    expect(parseBlocks('- a')[0]).toMatchObject({ kind: 'list', ordered: false })
  })

  it('reads a blockquote and a horizontal rule', () => {
    expect(parseBlocks('> quoted')[0]).toMatchObject({ kind: 'quote' })
    expect(parseBlocks('---')[0]).toMatchObject({ kind: 'rule' })
  })

  it('produces nothing for empty input', () => {
    expect(parseBlocks('')).toEqual([])
  })
})

describe('Markdown', () => {
  it('renders emphasis, strong and inline code', () => {
    const output = html('a **bold** and *italic* and `code`')
    expect(output).toContain('<strong>bold</strong>')
    expect(output).toContain('<em>italic</em>')
    expect(output).toContain('<code>code</code>')
  })

  it('leaves an unterminated bold marker as literal text mid-stream', () => {
    render(<Markdown text='progress **half' />)
    expect(screen.getByText(/progress \*\*half/)).toBeTruthy()
    expect(document.querySelector('strong')).toBeNull()
  })

  it('leaves an unterminated backtick literal', () => {
    render(<Markdown text='run `npm' />)
    expect(document.querySelector('code')).toBeNull()
  })

  it('renders a safe link and opens it in a new tab', () => {
    render(<Markdown text='see [docs](https://example.com/x)' />)
    const link = screen.getByRole('link', { name: 'docs' })
    expect(link.getAttribute('href')).toBe('https://example.com/x')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('renders a relative link, which is how the assistant deep-links into the host app', () => {
    render(<Markdown text='[work order](/work-orders/12)' />)
    expect(screen.getByRole('link', { name: 'work order' }).getAttribute('href')).toBe(
      '/work-orders/12',
    )
  })

  it('refuses a javascript: URL and leaves the raw token as text', () => {
    render(<Markdown text='[bad](javascript:alert(1))' />)
    expect(document.querySelector('a')).toBeNull()
    expect(screen.getByText(/\[bad\]/)).toBeTruthy()
  })

  it('escapes HTML in model output rather than rendering it', () => {
    const output = html('<img src=x onerror=alert(1)>')
    expect(output).toContain('&lt;img')
    expect(document.querySelector('img')).toBeNull()
  })

  it('renders headings at the requested level', () => {
    render(<Markdown text='## Second' />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Second')
  })

  it('renders list items', () => {
    render(<Markdown text={'- alpha\n- beta'} />)
    expect(screen.getAllByRole('listitem').map((node) => node.textContent)).toEqual([
      'alpha',
      'beta',
    ])
  })

  it('keeps a soft line break inside one paragraph', () => {
    const output = html('line one\nline two')
    expect(output).toContain('<br>')
  })

  it('grows monotonically as the stream arrives', () => {
    const partial = html('The answer is **fo')
    expect(partial).toContain('The answer is **fo')
    const complete = html('The answer is **four**')
    expect(complete).toContain('<strong>four</strong>')
  })
})
