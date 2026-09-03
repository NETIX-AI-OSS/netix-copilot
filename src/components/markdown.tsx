// A small markdown renderer built for streaming text.
//
// react-markdown is present in viz-ui and cafm-v2-ui but absent from prism-ui, and pinning a
// version of it here would drag a parser tree into every consumer. This renderer covers what the
// assistant actually emits and, more importantly, degrades gracefully on a half-arrived
// document: an unclosed fence still renders as code, and an unclosed emphasis marker stays
// literal text rather than swallowing the rest of the answer.
//
// Everything is built as React elements, so there is no dangerouslySetInnerHTML anywhere and
// model output cannot inject markup.

import type { ReactNode } from 'react'
import { Fragment } from 'react'

const INLINE_PATTERN = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]*\]\([^)\s]+\))/g
const LINK_PATTERN = /^\[([^\]]*)\]\(([^)\s]+)\)$/
const SAFE_HREF = /^(https?:\/\/|\/|mailto:)/i

export function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  INLINE_PATTERN.lastIndex = 0

  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]
    const key = `${keyPrefix}-${match.index}`
    if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*')) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    } else {
      const link = LINK_PATTERN.exec(token)
      if (link && SAFE_HREF.test(link[2] ?? '')) {
        nodes.push(
          <a key={key} href={link[2]} target='_blank' rel='noreferrer noopener'>
            {link[1] === '' ? link[2] : link[1]}
          </a>,
        )
      } else {
        nodes.push(token)
      }
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

interface BlockBase {
  key: string
}

type Block =
  | (BlockBase & { kind: 'paragraph'; lines: string[] })
  | (BlockBase & { kind: 'heading'; level: 1 | 2 | 3; text: string })
  | (BlockBase & { kind: 'code'; language?: string; lines: string[]; closed: boolean })
  | (BlockBase & { kind: 'list'; ordered: boolean; items: string[] })
  | (BlockBase & { kind: 'quote'; lines: string[] })
  | (BlockBase & { kind: 'rule' })

// Split a possibly-incomplete document into blocks.
export function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split('\n')
  const blocks: Block[] = []
  let index = 0
  let counter = 0
  const nextKey = () => `b${(counter += 1)}`

  while (index < lines.length) {
    const line = lines[index] ?? ''

    const fence = /^```(.*)$/.exec(line.trim())
    if (fence) {
      const language = (fence[1] ?? '').trim()
      const body: string[] = []
      index += 1
      let closed = false
      while (index < lines.length) {
        const current = lines[index] ?? ''
        if (current.trim() === '```') {
          closed = true
          index += 1
          break
        }
        body.push(current)
        index += 1
      }
      blocks.push({
        kind: 'code',
        key: nextKey(),
        lines: body,
        closed,
        ...(language === '' ? {} : { language }),
      })
      continue
    }

    if (line.trim() === '') {
      index += 1
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ kind: 'rule', key: nextKey() })
      index += 1
      continue
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({
        kind: 'heading',
        key: nextKey(),
        level: (heading[1] ?? '#').length as 1 | 2 | 3,
        text: heading[2] ?? '',
      })
      index += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoted: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
        quoted.push((lines[index] ?? '').replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push({ kind: 'quote', key: nextKey(), lines: quoted })
      continue
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || ordered) {
      const isOrdered = ordered !== null && bullet === null
      const items: string[] = []
      while (index < lines.length) {
        const current = lines[index] ?? ''
        const nextBullet = /^\s*[-*+]\s+(.*)$/.exec(current)
        const nextOrdered = /^\s*\d+[.)]\s+(.*)$/.exec(current)
        const item = isOrdered ? nextOrdered : nextBullet
        if (!item) break
        items.push(item[1] ?? '')
        index += 1
      }
      blocks.push({ kind: 'list', key: nextKey(), ordered: isOrdered, items })
      continue
    }

    const paragraph: string[] = []
    while (index < lines.length) {
      const current = lines[index] ?? ''
      if (
        current.trim() === '' ||
        /^```/.test(current.trim()) ||
        /^#{1,3}\s/.test(current) ||
        /^>\s?/.test(current) ||
        /^\s*[-*+]\s+/.test(current) ||
        /^\s*\d+[.)]\s+/.test(current)
      ) {
        break
      }
      paragraph.push(current)
      index += 1
    }
    blocks.push({ kind: 'paragraph', key: nextKey(), lines: paragraph })
  }

  return blocks
}

function renderLines(lines: string[], keyPrefix: string): ReactNode[] {
  return lines.flatMap((line, position) => {
    const rendered = renderInline(line, `${keyPrefix}-${position}`)
    return position === lines.length - 1
      ? rendered
      : [...rendered, <br key={`${keyPrefix}-br-${position}`} />]
  })
}

export interface MarkdownProps {
  text: string
  // Draws the caret after the last character rather than under the last block.
  streaming?: boolean
}

export function Markdown({ text, streaming = false }: MarkdownProps): ReactNode {
  const blocks = parseBlocks(text)
  const caret = streaming ? <span className='nxcp-caret' aria-hidden='true' /> : null
  if (blocks.length === 0) return caret
  return (
    <>
      {blocks.map((block, index) => {
        const tail = index === blocks.length - 1 ? caret : null
        switch (block.kind) {
          case 'heading': {
            const Tag = (['h1', 'h2', 'h3'] as const)[block.level - 1] ?? 'h3'
            return (
              <Tag key={block.key}>
                {renderInline(block.text, block.key)}
                {tail}
              </Tag>
            )
          }
          case 'code':
            return (
              <pre key={block.key} data-closed={block.closed ? 'true' : 'false'}>
                <code {...(block.language ? { 'data-language': block.language } : {})}>
                  {block.lines.join('\n')}
                </code>
                {tail}
              </pre>
            )
          case 'list': {
            const items = block.items.map((item, position) => (
              <li key={`${block.key}-${position}`}>
                {renderInline(item, `${block.key}-${position}`)}
                {position === block.items.length - 1 ? tail : null}
              </li>
            ))
            return block.ordered ? (
              <ol key={block.key}>{items}</ol>
            ) : (
              <ul key={block.key}>{items}</ul>
            )
          }
          case 'quote':
            return (
              <blockquote key={block.key}>
                {renderLines(block.lines, block.key)}
                {tail}
              </blockquote>
            )
          case 'rule':
            return (
              <Fragment key={block.key}>
                <hr />
                {tail}
              </Fragment>
            )
          default:
            return (
              <p key={block.key}>
                {renderLines(block.lines, block.key)}
                {tail}
              </p>
            )
        }
      })}
    </>
  )
}
